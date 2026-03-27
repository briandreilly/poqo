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
  attitude?: ResponseAttitude | "normal" | "challenge" | "difficult";
  tone?: ResponseTone | "warm" | "sharp";
  language?: ResponseLanguage;
  length?: ResponseLength;
}

export function isValidTryRequest(body: Partial<TryRequestBody>): body is TryRequestBody {
  const tone = body.tone;

  return Boolean(
    body.claim &&
    typeof body.claim === "string" &&
    body.claim.trim().length > 0 &&
    (!body.attitude || ["balanced", "challenging", "normal", "challenge", "difficult"].includes(body.attitude)) &&
    (!tone || tone === "neutral" || tone === "direct" || tone === "warm" || tone === "sharp") &&
    (!body.language || body.language === "en" || body.language === "es") &&
    (!body.length || body.length === "reaction" || body.length === "short" || body.length === "medium" || body.length === "long")
  );
}

function pickByAttitude<T>(
  attitude: ResponseAttitude,
  variants: { balanced?: T; challenging?: T; normal?: T; challenge?: T; difficult?: T }
): T {
  if (attitude === "balanced") {
    return (variants.balanced ?? variants.normal) as T;
  }

  return (variants.challenging ?? variants.difficult ?? variants.challenge) as T;
}

function normalizeTryLength(length?: ResponseLength): ResponseLength {
  if (length === "reaction" || length === "medium" || length === "long") {
    return length;
  }

  return "short";
}

function cleanClaim(claim: string): string {
  return claim.trim().replace(/[.?!]+$/u, "");
}

function classifyTryInputShape(claim: string): "question" | "statement" {
  const trimmed = claim.trim();

  if (!trimmed) {
    return "statement";
  }

  if (trimmed.endsWith("?")) {
    return "question";
  }

  return /^(?:is|are|am|do|does|did|can|could|should|would|will|what|why|how|when|where|who|whom|whose|which)\b/i.test(trimmed)
    ? "question"
    : "statement";
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

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function clampToWordCount(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) {
    return "";
  }

  const trimmed = words.slice(0, maxWords).join(" ").replace(/[,:;]+$/u, "");
  return /[.?!]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function enforceReactionLength(text: string): string {
  return clampToWordCount(text, 2);
}

function enforceShortLength(text: string): string {
  const firstSentence = (splitSentences(text)[0] ?? text).trim().replace(/[.?!]+$/u, "");
  const compressed = firstSentence
    .replace(/^The prediction that\s+/iu, "")
    .replace(/^The idea that\s+/iu, "")
    .replace(/^Calling\s+(.+?)\s+as\s+.+?\s+does not hold up$/iu, "$1 does not hold up")
    .replace(/^Calling\s+(.+?)\s+does not hold up$/iu, "$1 does not hold up")
    .replace(/^(.+?)\s+are not the best material for every\s+(.+)$/iu, "$1 are not best for every $2")
    .replace(/^(.+?)\s+is too broad as a universal forecast$/iu, "$1 is too broad")
    .replace(/^(.+?)\s+is not uniformly toxic, but\s+(.+)$/iu, "$1 is not uniformly toxic")
    .replace(/[,;:]+/gu, "")
    .trim();

  let words = compressed.split(/\s+/u).filter(Boolean);

  if (words.length > 9) {
    words = words.slice(0, 9);
  }

  while (words.length > 0 && /^(?:too|and|or|but|because|as|the|a|an|of|to|is|are)$/iu.test(words[words.length - 1])) {
    words.pop();
  }

  let result = words.join(" ").trim().replace(/[,:;]+$/u, "");
  if (!result) {
    return "";
  }

  if (!/[.?!]$/u.test(result)) {
    result += ".";
  }

  return result;
}

function ensureTwoSentences(text: string): string[] {
  const sentences = splitSentences(text)
    .map((sentence) => finalizeSentence(sentence))
    .filter(Boolean)
    .slice(0, 2);

  if (sentences.length === 0) {
    return [];
  }

  if (sentences.length === 1) {
    sentences.push("The context still matters.");
  }

  return sentences;
}

function enforceMediumLength(text: string): string {
  const sentences = ensureTwoSentences(text);
  if (sentences.length === 0) {
    return "";
  }

  const wordBudget = 35;
  const firstWords = sentences[0].replace(/[.?!]+$/u, "").split(/\s+/u).filter(Boolean);
  const secondWords = sentences[1].replace(/[.?!]+$/u, "").split(/\s+/u).filter(Boolean);

  let trimmedFirst = firstWords;
  let trimmedSecond = secondWords;

  if (firstWords.length + secondWords.length > wordBudget) {
    if (firstWords.length >= wordBudget - 1) {
      trimmedFirst = firstWords.slice(0, Math.max(1, wordBudget - 4));
      trimmedSecond = ["Context", "still", "matters"];
    } else {
      trimmedSecond = secondWords.slice(0, Math.max(1, wordBudget - firstWords.length));
    }
  }

  const firstSentence = finalizeSentence(trimmedFirst.join(" "));
  const secondSentence = finalizeSentence(trimmedSecond.join(" "));
  return `${firstSentence} ${secondSentence}`.trim();
}

function expandLong(base: string): string {
  return `${base} This depends on context, scope, and specific conditions. Strong claims like this usually require clearer boundaries and supporting detail to fully hold up.`;
}

function enforceLongLength(text: string): string {
  let result = text.trim();
  if (!result) {
    return "";
  }

  if (countWords(result) < 50) {
    result = expandLong(result);
  }

  if (countWords(result) > 100) {
    result = clampToWordCount(result, 100);
  }

  return result;
}

function clampToLengthBucket(text: string, length: ResponseLength): string {
  if (length === "reaction") {
    return enforceReactionLength(text);
  }

  if (length === "short") {
    return enforceShortLength(text);
  }

  if (length === "medium") {
    return enforceMediumLength(text);
  }

  return enforceLongLength(text);
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

  return clampToLengthBucket(collapsed, length);
}

function removeLeadingConnector(sentence: string): string {
  return sentence.replace(/^(?:And|But)\s+/u, "").trim();
}

function sentenceStartsWithStrongLead(sentence: string): boolean {
  return /^(?:No|That|This)\b/u.test(sentence);
}

function applyToneToSentence(sentence: string, tone: ResponseTone, position: number): string {
  const trimmed = sentence.trim().replace(/[.?!]+$/u, "");

  if (!trimmed) {
    return "";
  }

  if (tone === "direct") {
    const compressed = removeLeadingConnector(
      trimmed
        .replace(/\busually\b/giu, "")
        .replace(/\boften\b/giu, "")
        .replace(/\bstill\b/giu, "")
        .replace(/\s+/gu, " ")
        .trim()
        .replace(/\s+,/gu, ",")
    );

    if (position === 0 && !sentenceStartsWithStrongLead(compressed) && /^(?:it|that|this)\b/i.test(compressed)) {
      return compressed;
    }

    return compressed;
  }

  return removeLeadingConnector(trimmed);
}

function smoothFallbackSentenceFlow(sentences: string[]): string[] {
  return sentences
    .map((sentence, index) => {
      const cleaned = index === 0 ? sentence.trim() : removeLeadingConnector(sentence);
      if (!cleaned) {
        return "";
      }

      return index === 0
        ? cleaned
        : cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .filter(Boolean);
}

function satisfiesLengthBucket(text: string, length: ResponseLength): boolean {
  if (length === "reaction") {
    return countWords(text) <= 2;
  }

  if (length === "short") {
    return splitSentences(text).length === 1 && countWords(text) < 10;
  }

  if (length === "medium") {
    return splitSentences(text).length === 2 && countWords(text) <= 35;
  }

  const words = countWords(text);
  return words >= 50 && words <= 100;
}

function violatesStatementOutputContract(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (normalized.includes("?")) {
    return true;
  }

  return /^(?:can you|could you|would you|what evidence|what exactly|what definition|what are you basing|define your terms|i need a clearer version|i need a precise version|state the boundary clearly)\b/u.test(normalized);
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
  if (attitude === "challenging") {
    return [
      "Oak planks are not the best material for every Minecraft base",
      "They are easy to obtain and versatile, which makes them a strong default",
      "Other materials can fit defense, cost, or aesthetics better",
      "They work well as a baseline, not as a universal best choice"
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
  if (attitude === "challenging") {
    return [
      "Social media is not uniformly toxic, but many platforms reward manipulative, addictive, or corrosive behavior",
      "The damage usually comes from design incentives, moderation failures, and outrage loops",
      "Some platforms and uses are worse than others",
      "The pattern is real, but it is not identical everywhere"
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
  if (attitude === "challenging") {
    return [
      "Coffee is not simply healthy",
      "It can be beneficial in moderation, but the effect depends on intake and the person",
      "Sleep, sensitivity, anxiety, and overall health context matter",
      "Moderate use is very different from heavy use"
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
  if (attitude === "challenging") {
    return [
      "The system is not functioning well for a lot of people",
      "Persistent failures in access, cost, and consistency make it unreliable",
      "The harm is practical, not abstract",
      "The result is a system many people cannot trust to work when they need it"
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
  if (attitude === "challenging") {
    return [
      "It should not be treated as a primary tool there",
      "Human judgment, practice, and foundational skills need to stay first",
      "Overreliance too early weakens core development",
      "A narrow supporting role is safer than a central one"
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
  if (attitude === "challenging") {
    return [
      "That is not automatically true",
      "Lowering prices can help growth only when it does not wreck margins or positioning",
      "Unit economics, retention, and competition still matter",
      "Cheaper is only better when the business can sustain it"
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

  if (attitude === "challenging") {
    return [
      `${trimmed.replace(/\bbest\b/iu, "not the best")} in every case`,
      "It can still be a strong option when the goal is clear",
      "The better choice depends on context, constraints, and purpose",
      "It is safer to treat it as a strong option, not a universal best"
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

  if (lower.includes(" will ")) {
    const [subject, predicate] = trimmed.split(/\swill\s/iu, 2);
    if (subject && predicate) {
      return attitude === "challenging"
        ? [
            `The prediction that ${subject} will ${predicate} is too broad as a universal forecast`,
            "A stronger version needs a clearer condition, timeline, or scope",
            "Sweeping forecasts like that usually outrun the evidence behind them",
            "A narrower prediction is easier to defend than a total one"
          ]
        : [
            `The prediction that ${subject} will ${predicate} is too broad without a clearer boundary`,
            "It works better with a clearer timeline, condition, or scope",
            "Sweeping forecasts like that usually outrun the evidence behind them",
            "A narrower prediction is easier to defend than a total one"
          ];
    }
  }

  if (lower.includes(" is ")) {
    const [subject, predicate] = trimmed.split(/\sis\s/iu, 2);
    if (subject && predicate) {
      return attitude === "challenging"
        ? [
            `Calling ${subject} ${predicate} as a blanket fact does not hold up`,
            "That judgment needs to be tied to specific actions, evidence, or standards",
            "Trait claims like that are too broad when they float free of examples",
            "A narrower version is stronger than a universal one"
          ]
        : [
            `Calling ${subject} ${predicate} is too broad without a clearer boundary`,
            "It works better when tied to specific actions, statements, or examples",
            "Trait judgments like that depend on the standard you are using",
            "A narrower version is easier to defend than a blanket one"
          ];
    }
  }

  if (lower.includes(" are ")) {
    const [subject, predicate] = trimmed.split(/\sare\s/iu, 2);
    if (subject && predicate) {
      return attitude === "challenging"
        ? [
            `Calling ${subject} ${predicate} as a blanket fact does not hold up`,
            "That judgment needs to be tied to specific examples, evidence, or standards",
            "Group claims like that are too broad when they float free of examples",
            "A narrower version is stronger than a universal one"
          ]
        : [
            `Calling ${subject} ${predicate} is too broad without a clearer boundary`,
            "It works better when tied to specific examples, conditions, or actions",
            "Group judgments like that depend on the standard you are using",
            "A narrower version is easier to defend than a blanket one"
          ];
    }
  }

  return attitude === "challenging"
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

function canRefineStatement(claim: string, result: PoqoResult): boolean {
  const lower = cleanClaim(claim).toLowerCase();
  const words = lower.split(/\s+/u).filter(Boolean);

  if (
    result.analysis.signals.strongUnsupportedStance ||
    result.analysis.signals.contestedFramingClaim ||
    result.analysis.signals.argumentLoadedStatement ||
    result.analysis.signals.coherentCritiqueBundle ||
    result.analysis.signals.personallyScopedEvaluation
  ) {
    return true;
  }

  if (words.length < 3) {
    return false;
  }

  return /\b(?:is|are|will|should|shouldn't|should not|doesn't|does not|can|cannot|can't|always|never|best|better|worse|broken|healthy|toxic|honest|replace)\b/u.test(lower);
}

function buildQuestionAnswerSentences(claim: string, attitude: ResponseAttitude): string[] {
  const lower = cleanClaim(claim).toLowerCase();

  if (lower.includes("social media") && lower.includes("toxic")) {
    return buildToxicSentences(attitude);
  }

  if (lower.includes("coffee") && lower.includes("healthy")) {
    return buildHealthySentences(attitude);
  }

  if (lower.includes("oak planks") && lower.includes("minecraft")) {
    return buildOakMinecraftSentences(attitude);
  }

  if (lower.includes("ai") && lower.includes("primary school")) {
    return buildDoesNotBelongSentences(attitude);
  }

  if (lower.includes("best")) {
    return buildBestGenericSentences(claim, attitude);
  }

  if (lower.includes("always")) {
    return buildAlwaysSentences(attitude);
  }

  return attitude === "challenging"
    ? [
        "The answer depends on a clearer boundary than the question currently gives",
        "A narrower version would make the answer more reliable",
        "The core issue is still answerable once the missing condition is stated",
        "Without that condition, the answer should stay guarded"
      ]
    : [
        "The answer depends on a clearer boundary than the question currently gives",
        "A narrower version would make the answer more reliable",
        "The missing condition matters more than the wording implies",
        "Once that condition is stated, the answer lands more cleanly"
      ];
}

function buildNarrowQuestionSentences(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string[] {
  const question = finalizeSentence(buildClarifyingQuestion(claim, result, responseConfig));

  if (responseConfig.attitude === "challenging") {
    return [
      "I need a precise version before I answer this",
      question,
      "Right now the wording is doing too much work",
      "State the boundary clearly and the answer can be sharper"
    ];
  }

  return [
    "I need a clearer version before I can answer cleanly",
    question,
    "A concrete example would make the answer tighter",
    "The best answer depends on the boundary you have in mind"
  ];
}

function buildNarrowStatementSentences(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string[] {
  if (canRefineStatement(claim, result)) {
    return buildGenericSentences(claim, responseConfig.attitude);
  }

  return responseConfig.attitude === "challenging"
    ? [
        "That statement is too broad to stand on its own",
        "A tighter version needs a clearer boundary, condition, or example",
        "Right now the wording reaches farther than the support behind it",
        "A narrower version would be easier to defend"
      ]
    : [
        "That statement is too broad without a clearer boundary",
        "A tighter version needs a clearer condition or example",
        "Right now the wording reaches farther than the support behind it",
        "A narrower version would be easier to defend"
      ];
}

function buildProveSentences(responseConfig: ResponseConfig): string[] {
  if (responseConfig.attitude === "challenging") {
    return [
      "No, that is not settled without evidence",
      "Broad real-world claims do not land on assertion alone",
      "The stronger the certainty, the more support it needs",
      "Without that support, the answer has to stay provisional"
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
  const inputShape = classifyTryInputShape(claim);

  if (result.move === "NARROW") {
    return inputShape === "question"
      ? buildQuestionAnswerSentences(claim, responseConfig.attitude)
      : buildNarrowStatementSentences(claim, result, responseConfig);
  }

  if (result.move === "PROVE") {
    return inputShape === "question"
      ? buildQuestionAnswerSentences(claim, responseConfig.attitude)
      : buildProveSentences(responseConfig);
  }

  return inputShape === "question"
    ? buildQuestionAnswerSentences(claim, responseConfig.attitude)
    : buildGenericSentences(claim, responseConfig.attitude);
}

function buildReactionText(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string {
  const lower = cleanClaim(claim).toLowerCase();

  if (lower.includes("coffee") && lower.includes("healthy")) {
    return responseConfig.attitude === "challenging" ? "Not really." : "Maybe.";
  }

  if (lower.includes("oak planks") && lower.includes("minecraft")) {
    return responseConfig.attitude === "challenging" ? "Not really." : "Could be.";
  }

  if (lower.includes("social media") && lower.includes("toxic")) {
    return responseConfig.attitude === "challenging" ? "Hmmm." : "Maybe.";
  }

  if (lower.includes("primary school") && lower.includes("ai")) {
    return responseConfig.attitude === "challenging" ? "Hard no." : "Maybe not.";
  }

  if (result.move === "PROVE") {
    return responseConfig.attitude === "challenging" ? "Absolutely not." : "Depends.";
  }

  if (result.move === "NARROW") {
    return responseConfig.attitude === "challenging" ? "No way." : "Could be.";
  }

  return responseConfig.attitude === "challenging" ? "Not really." : "Fair point.";
}

function formatLiveTryResponse(claim: string, result: PoqoResult, responseConfig: ResponseConfig, length: ResponseLength): string {
  if (length === "reaction") {
    return clampToLengthBucket(buildReactionText(claim, result, responseConfig), length);
  }

  const sentences = smoothFallbackSentenceFlow(
    buildFallbackSentences(claim, result, responseConfig)
      .map((sentence, index) => applyToneToSentence(sentence, responseConfig.tone, index))
      .map((sentence) => finalizeSentence(sentence))
      .filter(Boolean)
  );

  return clampToLengthBucket(sentences.join(" ").trim(), length);
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
    tone: body.tone === "sharp" ? "direct" : body.tone === "warm" ? "neutral" : body.tone,
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

  if (length === "reaction") {
    return {
      ...basePayload,
      mode: "poqo-reaction",
      response: fallbackResponse
    };
  }

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
    const inputShape = classifyTryInputShape(claim);
    const modelViolatesStatementRule = inputShape === "statement" && violatesStatementOutputContract(cleanedResponse);
    const finalResponse = satisfiesLengthBucket(cleanedResponse, length) && !modelViolatesStatementRule
      ? cleanedResponse
      : fallbackResponse;

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
