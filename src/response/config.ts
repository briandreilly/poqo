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
  attitude: "balanced",
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

    if (normalized.some((existing) => existing.toLowerCase() == item.toLowerCase())) {
      continue;
    }

    normalized.push(item);

    if (normalized.length >= MAX_LIST_ITEMS) {
      break;
    }
  }

  return normalized;
}

function normalizeResponseAttitude(value: unknown): ResponseAttitude {
  if (value === "challenging" || value === "challenge" || value === "difficult") {
    return "challenging";
  }

  if (value === "balanced" || value === "normal") {
    return "balanced";
  }

  return DEFAULT_RESPONSE_CONFIG.attitude;
}

function normalizeResponseTone(value: unknown): ResponseTone {
  if (value === "direct" || value === "sharp") {
    return "direct";
  }

  if (value === "neutral" || value === "warm") {
    return "neutral";
  }

  return DEFAULT_RESPONSE_CONFIG.tone;
}

function isResponseLanguage(value: unknown): value is ResponseLanguage {
  return value === "en" || value === "es";
}

export function mapResponseAttitudeToInterventionMode(attitude: ResponseAttitude): InterventionMode {
  return attitude === "balanced" ? "calm" : "blunt";
}

function mapLegacyInterventionMode(mode: InterventionMode): ResponseAttitude {
  return mode === "calm" ? "balanced" : "challenging";
}

export function normalizeResponseConfig(
  input?: ResponseConfigInput | null,
  legacyInterventionMode?: InterventionMode | null
): ResponseConfig {
  const attitude = input?.attitude
    ? normalizeResponseAttitude(input.attitude)
    : legacyInterventionMode
      ? mapLegacyInterventionMode(legacyInterventionMode)
      : DEFAULT_RESPONSE_CONFIG.attitude;

  return {
    attitude,
    tone: normalizeResponseTone(input?.tone),
    language: isResponseLanguage(input?.language) ? input.language : DEFAULT_RESPONSE_CONFIG.language,
    customToneNotes: sanitizeShortString(input?.customToneNotes),
    customBehaviorNotes: sanitizeShortString(input?.customBehaviorNotes),
    forbid: sanitizeList(input?.forbid),
    prefer: sanitizeList(input?.prefer)
  };
}
