import { loadRuntimeGuide } from "../constitution/loader.js";
import { resolveDomainAnchor } from "../domain-anchor.js";
import { runPoqo } from "../engine.js";
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
  ResponseTone
} from "../types.js";
import { buildPoqoBrief } from "./harness-brief.js";

export const DEFAULT_TRY_PROFILE_ID: ProfileId = "default";

export interface TryRequestBody {
  claim?: string;
  attitude?: ResponseAttitude;
  tone?: ResponseTone;
  language?: ResponseLanguage;
}

export function isValidTryRequest(body: Partial<TryRequestBody>): body is TryRequestBody {
  return Boolean(
    body.claim &&
    typeof body.claim === "string" &&
    body.claim.trim().length > 0 &&
    (!body.attitude || body.attitude === "normal" || body.attitude === "challenge" || body.attitude === "difficult") &&
    (!body.tone || body.tone === "neutral" || body.tone === "warm" || body.tone === "direct" || body.tone === "sharp") &&
    (!body.language || body.language === "en" || body.language === "es")
  );
}

function pickByAttitude<T>(attitude: ResponseAttitude, variants: { normal: T; challenge: T; difficult: T }): T {
  return variants[attitude];
}

function buildJudgment(result: PoqoResult, responseConfig: ResponseConfig): string {
  if (result.move === "NARROW") {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Needs a clearer boundary first.",
      challenge: "Not solid enough as stated.",
      difficult: "Too weak as stated."
    });
  }

  if (result.move === "PROVE") {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Potentially testable, but not settled.",
      challenge: "Testable, but it needs proof.",
      difficult: "Not accepted without proof."
    });
  }

  if (result.analysis.signals.answerableSubjectiveQuestion) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Clear enough to answer directly.",
      challenge: "Answerable, but still worth tightening.",
      difficult: "Usable, but loose as phrased."
    });
  }

  return pickByAttitude(responseConfig.attitude, {
    normal: "Clear enough to engage, but still broad.",
    challenge: "Usable, but still too loose.",
    difficult: "Still too loose as stated."
  });
}

function buildReason(result: PoqoResult, responseConfig: ResponseConfig): string {
  if (result.analysis.signals.contestedFramingClaim) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "It mixes labels and definitions before the frame is aligned.",
      challenge: "It mixes contested labels before the definitions are clear.",
      difficult: "It bundles contested labels without a usable frame."
    });
  }

  if (result.analysis.signals.coherentCritiqueBundle) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "The critique is clear, but the target change still is not.",
      challenge: "The critique lands, but the actual change is still undefined.",
      difficult: "The complaint is clear; the replacement is not."
    });
  }

  if (result.analysis.signals.strongUnsupportedStance || result.analysis.signals.argumentLoadedStatement) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "It makes a forceful claim without showing what it rests on.",
      challenge: "It pushes a strong claim without enough support.",
      difficult: "It asserts too much without enough basis."
    });
  }

  if (result.analysis.signals.vagueConcernReaction) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "It points to a problem without naming the actual issue.",
      challenge: "It signals a problem, but the missing piece is still unnamed.",
      difficult: "It is too vague to work with as stated."
    });
  }

  if (result.analysis.signals.materialReferencedButMissing) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "The source material is missing.",
      challenge: "The source is missing, so the claim cannot be checked yet.",
      difficult: "There is no source here to work from."
    });
  }

  if (result.move === "PROVE") {
    return pickByAttitude(responseConfig.attitude, {
      normal: "This depends on evidence or a clearer test.",
      challenge: "This needs evidence instead of assertion.",
      difficult: "This is not something to accept on assertion alone."
    });
  }

  return pickByAttitude(responseConfig.attitude, {
    normal: "The wording still needs a clearer boundary or condition.",
    challenge: "The wording is still broader than it should be.",
    difficult: "The wording is too broad to carry as-is."
  });
}

function buildClarifyingQuestion(result: PoqoResult, responseConfig: ResponseConfig): string {
  if (result.analysis.signals.contestedFramingClaim) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "What definition are you using here?",
      challenge: "What definition are you using, exactly?",
      difficult: "Define your terms first."
    });
  }

  if (result.analysis.signals.coherentCritiqueBundle) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "What would you want different?",
      challenge: "What would you change first?",
      difficult: "What exactly should replace it?"
    });
  }

  if (result.analysis.signals.vagueConcernReaction) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "What feels off about it?",
      challenge: "What part feels off, exactly?",
      difficult: "What exactly is wrong here?"
    });
  }

  if (result.analysis.signals.materialReferencedButMissing) {
    return pickByAttitude(responseConfig.attitude, {
      normal: "Can you paste the text?",
      challenge: "Can you paste the actual text?",
      difficult: "Paste the text first."
    });
  }

  return pickByAttitude(responseConfig.attitude, {
    normal: "What are you basing that on?",
    challenge: "What evidence supports that?",
    difficult: "What is that based on?"
  });
}

function cleanClaim(claim: string): string {
  return claim.trim().replace(/[.?!]+$/u, "");
}

function buildSharperVersion(claim: string, result: PoqoResult): string | null {
  const trimmed = cleanClaim(claim);
  const lower = trimmed.toLowerCase();

  if (result.move === "NARROW") {
    return null;
  }

  if (lower.includes("doesn't belong") || lower.includes("does not belong")) {
    return trimmed.replace(/doesn't belong|does not belong/i, "should have a very limited role") + " and stay secondary to clear human judgment.";
  }

  if (lower.includes(" is toxic")) {
    return trimmed.replace(/ is toxic/i, " often rewards manipulative, addictive, or corrosive behavior") + ".";
  }

  if (lower.includes(" is healthy")) {
    return trimmed.replace(/ is healthy/i, " can be beneficial in moderation") + ", but the effects depend on intake and the person.";
  }

  if (lower.includes(" is broken")) {
    return trimmed.replace(/ is broken/i, " has persistent failures that make it unreliable for many people") + ".";
  }

  if (lower.includes(" always ")) {
    return trimmed.replace(/\balways\b/i, "often") + ", depending on the actual conditions.";
  }

  if (lower.includes(" best ")) {
    return trimmed.replace(/\bbest\b/i, "one of the stronger") + " options when the goal is stated clearly.";
  }

  if (lower.includes(" is ")) {
    const [subject, predicate] = trimmed.split(/\sis\s/i, 2);
    if (subject && predicate) {
      return `${subject} can be ${predicate}, but the claim needs a clearer boundary to hold.`;
    }
  }

  if (lower.includes(" are ")) {
    const [subject, predicate] = trimmed.split(/\sare\s/i, 2);
    if (subject && predicate) {
      return `${subject} can be ${predicate}, but the claim needs a clearer boundary to hold.`;
    }
  }

  return null;
}

function formatLiveTryResponse(claim: string, result: PoqoResult, responseConfig: ResponseConfig): string {
  const judgment = buildJudgment(result, responseConfig);
  const reason = buildReason(result, responseConfig);
  const sharperVersion = buildSharperVersion(claim, result);
  const useClarifyingQuestion = result.move === "NARROW" || !sharperVersion;
  const thirdLabel = useClarifyingQuestion ? "Clarifying question" : "Sharper version";
  const thirdLine = useClarifyingQuestion ? buildClarifyingQuestion(result, responseConfig) : sharperVersion;

  return [
    `Judgment: ${judgment}`,
    `Reason: ${reason}`,
    `${thirdLabel}: ${thirdLine}`
  ].join("\n");
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
    tone: body.tone,
    language: body.language
  });
  const interventionMode: InterventionMode = mapResponseAttitudeToInterventionMode(responseConfig.attitude);
  const modelStatus = getModelStatus(options?.modelConfig);
  const claim = body.claim!.trim();
  const profileId = options?.profileId ?? DEFAULT_TRY_PROFILE_ID;
  const poqoResult = await runPoqo(claim, profileId);
  const runtimeGuide = await loadRuntimeGuide(profileId);
  const effectiveDomainAnchor = resolveDomainAnchor(claim, null);
  const poqoBrief = buildPoqoBrief(poqoResult, runtimeGuide, responseConfig, effectiveDomainAnchor);
  const framePreservingDirect = isFramePreservingDirect(poqoResult.analysis, poqoResult.move);
  const fallbackResponse = formatLiveTryResponse(claim, poqoResult, responseConfig);

  const basePayload = {
    ok: true,
    claim,
    attitude: responseConfig.attitude,
    tone: responseConfig.tone,
    language: responseConfig.language,
    modelProvider: modelStatus.modelProvider,
    modelName: modelStatus.modelName,
    modelAvailable: modelStatus.modelAvailable
  };

  if (!modelStatus.modelAvailable) {
    return {
      ...basePayload,
      mode: "fallback-no-model",
      response: fallbackResponse,
      poqoBrief
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
        responseSurface: "live-brief"
      },
      options?.modelConfig
    );

    return {
      ...basePayload,
      mode: "poqo-plus-model",
      response: modelResult.responseText,
      modelProvider: modelResult.provider,
      modelName: modelResult.modelName
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Model request failed.";
    return {
      ...basePayload,
      mode: "fallback-model-error",
      response: fallbackResponse,
      modelError: message,
      poqoBrief
    };
  }
}
