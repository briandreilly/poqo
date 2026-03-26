import type {
  InterventionMode,
  ResponseConfig,
  ResponseConfigInput,
  ResponseLanguage,
  ResponseAttitude,
  ResponseTone
} from "../types.js";

const MAX_NOTE_LENGTH = 120;
const MAX_LIST_ITEMS = 4;
const MAX_LIST_ITEM_LENGTH = 40;
const CONTROL_PATTERN = /\b(route|routing|move|direct|narrow|prove|proof|domain|anchor|constitution|profile|override|threshold|judge|judgment|law)\b/i;

export const DEFAULT_RESPONSE_CONFIG: ResponseConfig = {
  attitude: "normal",
  tone: "neutral",
  language: "en",
  customToneNotes: "",
  customBehaviorNotes: "",
  forbid: [],
  prefer: []
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeShortString(value: unknown, maxLength = MAX_NOTE_LENGTH): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = normalizeWhitespace(value).slice(0, maxLength);
  if (!normalized || CONTROL_PATTERN.test(normalized)) {
    return "";
  }

  return normalized;
}

function sanitizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];

  for (const value of values) {
    const item = sanitizeShortString(value, MAX_LIST_ITEM_LENGTH);
    if (!item) {
      continue;
    }

    if (normalized.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      continue;
    }

    normalized.push(item);

    if (normalized.length >= MAX_LIST_ITEMS) {
      break;
    }
  }

  return normalized;
}

function isResponseAttitude(value: unknown): value is ResponseAttitude {
  return value === "normal" || value === "challenge" || value === "difficult";
}

function isResponseTone(value: unknown): value is ResponseTone {
  return value === "neutral" || value === "warm" || value === "direct" || value === "sharp";
}

function isResponseLanguage(value: unknown): value is ResponseLanguage {
  return value === "en" || value === "es";
}

export function mapResponseAttitudeToInterventionMode(attitude: ResponseAttitude): InterventionMode {
  return attitude === "normal" ? "calm" : attitude === "challenge" ? "counter" : "blunt";
}

function mapLegacyInterventionMode(mode: InterventionMode): ResponseAttitude {
  return mode === "calm" ? "normal" : mode === "counter" ? "challenge" : "difficult";
}

export function normalizeResponseConfig(
  input?: ResponseConfigInput | null,
  legacyInterventionMode?: InterventionMode | null
): ResponseConfig {
  const attitude = isResponseAttitude(input?.attitude)
    ? input.attitude
    : legacyInterventionMode
      ? mapLegacyInterventionMode(legacyInterventionMode)
      : DEFAULT_RESPONSE_CONFIG.attitude;

  return {
    attitude,
    tone: isResponseTone(input?.tone) ? input.tone : DEFAULT_RESPONSE_CONFIG.tone,
    language: isResponseLanguage(input?.language) ? input.language : DEFAULT_RESPONSE_CONFIG.language,
    customToneNotes: sanitizeShortString(input?.customToneNotes),
    customBehaviorNotes: sanitizeShortString(input?.customBehaviorNotes),
    forbid: sanitizeList(input?.forbid),
    prefer: sanitizeList(input?.prefer)
  };
}
