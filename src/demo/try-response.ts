import { loadRuntimeGuide } from "../constitution/loader.js";
import { resolveDomainAnchor } from "../domain-anchor.js";
import { runPoqo } from "../engine.js";
import { getTryModelConfig } from "../model/config.js";
import { getModelStatus, runConfiguredModel } from "../model/client.js";
import { isFramePreservingDirect } from "../response/builder.js";
import { mapResponseAttitudeToInterventionMode, normalizeResponseConfig } from "../response/config.js";
import type {
  InterventionMode,
  ModelConfig,
  PoqoResult,
  ProfileId,
  ResponseAttitude,
  ResponseConfig,
  ResponseLanguage,
  ResponseLength,
  ResponseTone
} from "../types.js";
import { buildPoqoBrief } from "./harness-brief.js";

export const DEFAULT_TRY_PROFILE_ID: ProfileId = "default";

export interface TryRequestBody {
  claim?: string;
  attitude?: ResponseAttitude;
  tone?: ResponseTone | "warm";
  language?: ResponseLanguage;
  length?: ResponseLength;
}

export function isValidTryRequest(body: Partial<TryRequestBody>): body is TryRequestBody {
  const tone = body.tone;

  return Boolean(
    body.claim &&
    typeof body.claim === "string" &&
    body.claim.trim().length > 0 &&
    (!body.attitude || body.attitude === "normal" || body.attitude === "challenge" || body.attitude === "difficult") &&
    (!tone || tone === "neutral" || tone === "warm" || tone === "direct" || tone === "sharp") &&
    (!body.language || body.language === "en" || body.language === "es") &&
    (!body.length || body.length === "short" || body.length === "medium" || body.length === "long")
  );
}

function pickByAttitude<T>(attitude: ResponseAttitude, variants: { normal: T; challenge: T; difficult: T }): T {
  return variants[attitude];
}

function normalizeTryLength(length?: ResponseLength): ResponseLength {
  return length === "medium" || length === "long" ? length : "short";
}

function cleanClaim(claim: string): string {
  return claim.trim().replace(/[.?!]+$/u, "");
}

function finalizeSentence(text: string): string {
  const trimmed = text.trim().replace(/[.?!]+$/u, "");
  return trimmed ? `${trimmed}.` : "";
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [])
    .map((part) => part.trim())
    .filter(Boolean);
}

function getMinSentences(length: ResponseLength): number {
  if (length === "medium") {
    return 2;
  }

  if (length === "long") {
    return 4;
  }

  return 1;
}

function getMaxSentences(length: ResponseLength): number {
  if (length === "medium") {
    return 3;
  }

  if (length === "long") {
    return 6;
  }

  return 1;
}

function enforceSentenceCount(text: string, length: ResponseLength): string {
  const sentences = splitSentences(text)
    .map((sentence) => finalizeSentence(sentence))
    .filter(Boolean);

  if (sentences.length === 0) {
    return "";
  }

  return sentences.slice(0, getMaxSentences(length)).join(" ").trim();
}

function sanitizeTryResponseText(text: string, length: ResponseLength): string {
  const collapsed = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-•]\s/u.test(line) && !/^\d+\.\s/u.test(line))
    .map((line) => line.replace(/^(?:Judgment|Reason|Sharper version|Clarifying question)\s*:\s*/iu, ""))
    .join(" ")
    .replace(/\b(?:Broken down|Implications|A stronger version)\b:?/giu, "")
    .replace(/\bthis claim\b/giu, "it")
    .replace(/\s+/gu, " ")
    .trim();

  return enforceSentenceCount(collapsed, length);
}

function applyToneToSentence(sentence: string, tone: ResponseTone, position: number): string {
  const trimmed = sentence.trim().replace(/[.?!]+$/u, "");

  if (!trimmed) {
    return "";
  }

  if (tone === "direct") {
    return trimmed
      .replace(/\busually\b/giu, "")
      .replace(/\boften\b/giu, "")
      .replace(/\bstill\b/giu, "")
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/\s+,/gu, ",");
  }

  if (tone === "sharp") {
    if (position === 0) {
      if (/^No\b/u.test(trimmed)) {
        return trimmed;
      }

      if (/^That\b/u.test(trimmed) || /^This\b/u.test(trimmed)) {
        return trimmed;
      }

      return `No, ${lowerFirst(trimmed)}`;
    }

    return `And ${lowerFirst(trimmed)}`;
  }

  return trimmed;
}

function meetsLengthRequirement(text: string, length: ResponseLength): boolean {
  const sentences = splitSentences(text);
  return sentences.length >= getMinSentences(length) && sentences.length <= getMaxSentences(length);
}

function buildClarifyingQuestion(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string {
  const lower = cleanClaim(claim).toLowerCase();

  if (lower.includes("toxic")) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Do you mean addictive design, harassment, misinformation, or something else",
      challenge: "What exactly makes it toxic here: addictive design, harassment, misinformation, or something else",
      difficult: "What exactly do you mean by toxic here"
    });
  }

  if (lower.includes("healthy")) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Do you mean moderate use, heavy use, or a specific health effect",
      challenge: "Which health effect and which consumption level are you talking about",
      difficult: "What exact health effect and what amount are you talking about"
    });
  }

  if (lower.includes("broken")) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Do you mean cost, access, speed, fairness, or something else",
      challenge: "Which failure matters here: cost, access, speed, fairness, or something else",
      difficult: "What exact failure are you talking about"
    });
  }

  if (result.analysis.signals.contestedFramingClaim) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "What definition are you using here",
      challenge: "What exact definition are you using here",
      difficult: "Define your terms first"
    });
  }

  if (result.analysis.signals.coherentCritiqueBundle) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "What would you want different",
      challenge: "What would you change first",
      difficult: "What exactly should replace it"
    });
  }

  return pickByAttitude(responseConfig.attitude, {
    normal: "What are you basing that on",
    challenge: "What evidence supports that",
    difficult: "What is that based on"
  });
}

function buildOakMinecraftSentences(attitude: ResponseAttitude): string[] {
  if (attitude === "difficult") {
    return [
      "Oak planks are not the best material for every Minecraft base",
      "They are easy to obtain and versatile, which makes them a strong default",
      "Other materials can fit defense, cost, or aesthetics better",
      "They work well as a baseline, not as a universal best choice"
    ];
  }

  if (attitude === "challenge") {
    return [
      "Oak planks are a reliable default for a Minecraft base because they are easy to obtain and versatile, but best is too broad as stated",
      "Calling them the best is too broad because different builds reward different materials",
      "Stone, deep slate, or specialty blocks can fit defense or style better",
      "They are strong as a default, not as a universal winner"
    ];
  }

  return [
    "Oak planks are a reliable default for a Minecraft base because they are easy to obtain and versatile",
    "They fit early builds well and stay useful later",
    "Other materials can better suit specific defenses, resources, or aesthetics",
    "They work best as a baseline, not as a universal best choice"
  ];
}

function buildToxicSentences(attitude: ResponseAttitude): string[] {
  if (attitude === "difficult") {
    return [
      "Social media is not uniformly toxic, but many platforms reward manipulative, addictive, or corrosive behavior",
      "The damage usually comes from design incentives, moderation failures, and outrage loops",
      "Some platforms and uses are worse than others",
      "The pattern is real, but it is not identical everywhere"
    ];
  }

  if (attitude === "challenge") {
    return [
      "Social media often rewards manipulative, addictive, or corrosive behavior, but that needs a clearer boundary",
      "That pattern is strongest when engagement is optimized at any cost",
      "Platform design, incentives, and moderation shape most of the harm",
      "The effect is real, but it varies by platform and use"
    ];
  }

  return [
    "Social media often rewards manipulative, addictive, or corrosive behavior",
    "The worst effects usually come from platform design, incentives, and moderation failures",
    "Some platforms and uses are more harmful than others",
    "The broad concern is real even if the intensity varies"
  ];
}

function buildHealthySentences(attitude: ResponseAttitude): string[] {
  if (attitude === "difficult") {
    return [
      "Coffee is not simply healthy",
      "It can be beneficial in moderation, but the effect depends on intake and the person",
      "Sleep, sensitivity, anxiety, and overall health context matter",
      "Moderate use is very different from heavy use"
    ];
  }

  if (attitude === "challenge") {
    return [
      "Coffee can be beneficial in moderation, but healthy is still too broad without a clearer boundary",
      "The word healthy is too broad if you do not specify the benefit or the amount",
      "Sleep, sensitivity, anxiety, and overall health context still matter",
      "Moderate use is not the same as heavy use"
    ];
  }

  return [
    "Coffee can be beneficial in moderation, but its effects depend on intake and the person",
    "Alertness benefits do not cancel out sleep disruption or sensitivity issues",
    "Moderation and health context matter",
    "Heavy use is not the same as moderate use"
  ];
}

function buildBrokenSentences(attitude: ResponseAttitude): string[] {
  if (attitude === "difficult") {
    return [
      "The system is not functioning well for a lot of people",
      "Persistent failures in access, cost, and consistency make it unreliable",
      "The harm is practical, not abstract",
      "The result is a system many people cannot trust to work when they need it"
    ];
  }

  if (attitude === "challenge") {
    return [
      "The system has persistent failures that make it unreliable for many people, but broken is still too broad without a clearer target",
      "The biggest problems usually show up in cost, access, and consistency",
      "Those failures are structural rather than isolated",
      "That is why the criticism keeps resurfacing"
    ];
  }

  return [
    "The system has persistent failures that make it unreliable for many people",
    "Access, cost, and consistency are the biggest sources of failure",
    "Those failures create predictable harm over time",
    "That is why the criticism feels durable"
  ];
}

function buildDoesNotBelongSentences(attitude: ResponseAttitude): string[] {
  if (attitude === "difficult") {
    return [
      "It should not be treated as a primary tool there",
      "Human judgment, practice, and foundational skills need to stay first",
      "Overreliance too early weakens core development",
      "A narrow supporting role is safer than a central one"
    ];
  }

  if (attitude === "challenge") {
    return [
      "It should have a very limited role there and stay secondary to human judgment, but the boundary still needs to stay clear",
      "Foundational skills, practice, and human instruction still need priority",
      "Too much dependence too early weakens core development",
      "A supporting role makes more sense than a central one"
    ];
  }

  return [
    "It should have a very limited role there and stay secondary to human judgment",
    "Foundational skills, play, and human instruction still need priority",
    "Too much dependence too early can weaken core development",
    "A supporting role makes more sense than a central one"
  ];
}

function buildAlwaysSentences(attitude: ResponseAttitude): string[] {
  if (attitude === "difficult") {
    return [
      "That is not automatically true",
      "Lowering prices can help growth only when it does not wreck margins or positioning",
      "Unit economics, retention, and competition still matter",
      "Cheaper is only better when the business can sustain it"
    ];
  }

  if (attitude === "challenge") {
    return [
      "Lowering prices can help growth when it improves acquisition without wrecking margins, but always is too broad as stated",
      "Always is too broad because retention, unit economics, and positioning still matter",
      "A cheaper price is not automatically a better strategy",
      "The right move depends on whether the business can sustain the tradeoff"
    ];
  }

  return [
    "Lowering prices can help growth when it improves acquisition without wrecking margins",
    "Retention, unit economics, and positioning still matter",
    "A cheaper price is not automatically the best strategy",
    "The right move depends on whether the business can sustain the tradeoff"
  ];
}

function buildBestGenericSentences(claim: string, attitude: ResponseAttitude): string[] {
  const trimmed = cleanClaim(claim);

  if (attitude === "difficult") {
    return [
      `${trimmed.replace(/\bbest\b/iu, "not the best")} in every case`,
      "It can still be a strong option when the goal is clear",
      "The better choice depends on context, constraints, and purpose",
      "It is safer to treat it as a strong option, not a universal best"
    ];
  }

  if (attitude === "challenge") {
    return [
      `${trimmed.replace(/\bbest\b/iu, "a strong option")} when the goal is clear, but best is still too broad as stated`,
      "Calling it the best is too broad because context and purpose still matter",
      "A different option can be better under different constraints",
      "That is why a universal best is hard to defend"
    ];
  }

  return [
    `${trimmed.replace(/\bbest\b/iu, "a strong option")} when the goal is clear`,
    "It is not the best in every case",
    "The better choice depends on context, constraints, and purpose",
    "It is safer to treat it as a strong option than a universal best"
  ];
}

function buildGenericSentences(claim: string, attitude: ResponseAttitude): string[] {
  const trimmed = cleanClaim(claim);
  const lower = trimmed.toLowerCase();

  if (lower.includes("oak planks") && lower.includes("minecraft")) {
    return buildOakMinecraftSentences(attitude);
  }

  if (lower.includes("doesn't belong") || lower.includes("does not belong")) {
    return buildDoesNotBelongSentences(attitude);
  }

  if (lower.includes(" is toxic")) {
    return buildToxicSentences(attitude);
  }

  if (lower.includes(" is healthy")) {
    return buildHealthySentences(attitude);
  }

  if (lower.includes(" is broken")) {
    return buildBrokenSentences(attitude);
  }

  if (lower.includes(" always ")) {
    return buildAlwaysSentences(attitude);
  }

  if (lower.includes(" best ")) {
    return buildBestGenericSentences(claim, attitude);
  }

  if (lower.includes(" is ")) {
    const [subject, predicate] = trimmed.split(/\sis\s/iu, 2);
    if (subject && predicate) {
      return attitude === "difficult"
        ? [
            `${subject} is not automatically ${predicate}`,
            "The context and standard still matter",
            "A universal reading goes too far",
            "It is safer to treat it as conditional rather than absolute"
          ]
        : [
            `${subject} can be ${predicate} in some contexts`,
            "The context and standard still matter",
            "A universal reading reaches too far",
            "It is safer to treat it as conditional rather than absolute"
          ];
    }
  }

  if (lower.includes(" are ")) {
    const [subject, predicate] = trimmed.split(/\sare\s/iu, 2);
    if (subject && predicate) {
      return attitude === "difficult"
        ? [
            `${subject} are not automatically ${predicate}`,
            "The context and standard still matter",
            "A universal reading goes too far",
            "It is safer to treat it as conditional rather than absolute"
          ]
        : [
            `${subject} can be ${predicate} in some contexts`,
            "The context and standard still matter",
            "A universal reading reaches too far",
            "It is safer to treat it as conditional rather than absolute"
          ];
    }
  }

  return attitude === "difficult"
    ? [
        `${trimmed} is not strong enough as a universal statement`,
        "The context still matters",
        "A narrower version would land better",
        "A universal reading goes too far"
      ]
    : [
        `${trimmed} can be true in some contexts`,
        "The context still matters",
        "A narrower version would land better",
        "A universal reading reaches too far"
      ];
}

function buildNarrowSentences(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string[] {
  const question = finalizeSentence(buildClarifyingQuestion(claim, result, responseConfig));

  if (responseConfig.attitude === "difficult") {
    return [
      "I need a precise version before I answer this",
      question,
      "Right now the wording is doing too much work",
      "State the boundary clearly and the answer can be sharper"
    ];
  }

  if (responseConfig.attitude === "challenge") {
    return [
      "I need a clearer version before this can be answered well",
      question,
      "The missing definition is doing too much work right now",
      "A concrete example would let the answer land cleanly"
    ];
  }

  return [
    "I need a clearer version before I can answer cleanly",
    question,
    "A concrete example would make the answer tighter",
    "The best answer depends on the boundary you have in mind"
  ];
}

function buildProveSentences(responseConfig: ResponseConfig): string[] {
  if (responseConfig.attitude === "difficult") {
    return [
      "No, that is not settled without evidence",
      "Broad real-world claims do not land on assertion alone",
      "The stronger the certainty, the more support it needs",
      "Without that support, the answer has to stay provisional"
    ];
  }

  if (responseConfig.attitude === "challenge") {
    return [
      "That needs evidence before it can be treated as settled",
      "Broad real-world claims do not land on assertion alone",
      "The stronger the certainty, the more support it needs",
      "Without that support, the answer should stay provisional"
    ];
  }

  return [
    "That needs evidence before it can be treated as settled",
    "Broad real-world claims do not land on assertion alone",
    "The stronger the certainty, the more support it needs",
    "Without that support, the answer should stay provisional"
  ];
}

function buildFallbackSentences(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string[] {
  if (result.move === "NARROW") {
    return buildNarrowSentences(claim, result, responseConfig);
  }

  if (result.move === "PROVE") {
    return buildProveSentences(responseConfig);
  }

  return buildGenericSentences(claim, responseConfig.attitude);
}

function formatLiveTryResponse(claim: string, result: PoqoResult, responseConfig: ResponseConfig, length: ResponseLength): string {
  const sentences = buildFallbackSentences(claim, result, responseConfig)
    .map((sentence, index) => applyToneToSentence(sentence, responseConfig.tone, index))
    .map((sentence) => finalizeSentence(sentence))
    .filter(Boolean);

  const targetCount = length === "short" ? 1 : length === "medium" ? 2 : 4;
  return sentences.slice(0, targetCount).join(" ").trim();
}

export async function buildTryResponse(
  body: TryRequestBody,
  options?: {
    profileId?: ProfileId;
    modelConfig?: ModelConfig;
  }
) {
  const responseConfig = normalizeResponseConfig({
    attitude: body.attitude,
    tone: body.tone === "warm" ? "neutral" : body.tone,
    language: body.language
  });
  const length = normalizeTryLength(body.length);
  const interventionMode: InterventionMode = mapResponseAttitudeToInterventionMode(responseConfig.attitude);
  const tryModelConfig = options?.modelConfig ?? getTryModelConfig(length);
  const modelStatus = getModelStatus(tryModelConfig);
  const claim = body.claim!.trim();
  const profileId = options?.profileId ?? DEFAULT_TRY_PROFILE_ID;
  const poqoResult = await runPoqo(claim, profileId);
  const runtimeGuide = await loadRuntimeGuide(profileId);
  const effectiveDomainAnchor = resolveDomainAnchor(claim, null);
  const poqoBrief = buildPoqoBrief(poqoResult, runtimeGuide, responseConfig, effectiveDomainAnchor);
  const framePreservingDirect = isFramePreservingDirect(poqoResult.analysis, poqoResult.move);
  const fallbackResponse = formatLiveTryResponse(claim, poqoResult, responseConfig, length);

  const basePayload = {
    ok: true,
    claim,
    attitude: responseConfig.attitude,
    tone: responseConfig.tone,
    language: responseConfig.language,
    length,
    modelProvider: modelStatus.modelProvider,
    modelName: modelStatus.modelName,
    modelAvailable: modelStatus.modelAvailable
  };

  if (!modelStatus.modelAvailable) {
    return {
      ...basePayload,
      mode: "fallback-no-model",
      response: fallbackResponse
    };
  }

  try {
    const modelResult = await runConfiguredModel(
      {
        prompt: claim,
        runtimeGuide,
        move: poqoResult.move,
        proofType: poqoResult.proofType,
        routingExplanation: poqoResult.routingExplanation,
        poqoBrief,
        framePreservingDirect,
        interventionMode,
        responseConfig,
        domainAnchor: effectiveDomainAnchor,
        responseSurface: "live-brief",
        responseLength: length
      },
      tryModelConfig
    );

    const cleanedResponse = sanitizeTryResponseText(modelResult.responseText, length);
    const finalResponse = meetsLengthRequirement(cleanedResponse, length) ? cleanedResponse : fallbackResponse;

    return {
      ...basePayload,
      mode: "poqo-plus-model",
      response: finalResponse,
      modelProvider: modelResult.provider,
      modelName: modelResult.modelName
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Model request failed.";
    return {
      ...basePayload,
      mode: "fallback-model-error",
      response: fallbackResponse,
      modelError: message
    };
  }
}
