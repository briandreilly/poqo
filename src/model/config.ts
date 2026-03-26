import type { ModelConfig, ModelProvider, ResponseLength } from "../types.js";

const DEFAULT_PROVIDER: ModelProvider = "openai";
const DEFAULT_MODEL_NAME = "gpt-5.4";
const DEFAULT_TRY_MODEL_NAME = "gpt-4.1-mini";
const DEFAULT_TRY_SHORT_MAX_OUTPUT_TOKENS = 60;
const DEFAULT_TRY_MEDIUM_MAX_OUTPUT_TOKENS = 100;
const DEFAULT_TRY_LONG_MAX_OUTPUT_TOKENS = 180;
type ModelEnvSource = Record<string, string | undefined | null>;

function resolveProvider(source: ModelEnvSource): ModelProvider {
  const raw = (source.MODEL_PROVIDER ?? DEFAULT_PROVIDER).trim().toLowerCase();

  if (raw !== "openai") {
    throw new Error(`Unsupported MODEL_PROVIDER: ${raw}`);
  }

  return raw;
}

// poqo instances are single-model by design. This config surface stays tiny on
// purpose so provider details do not spread into core judgment code.
export function getModelConfigFromSource(source: ModelEnvSource): ModelConfig {
  return {
    provider: resolveProvider(source),
    apiKey: source.MODEL_API_KEY ?? source.OPENAI_API_KEY ?? null,
    name: source.MODEL_NAME ?? source.OPENAI_MODEL ?? DEFAULT_MODEL_NAME
  };
}

export function getModelConfig(): ModelConfig {
  return getModelConfigFromSource(process.env as ModelEnvSource);
}

function getTryMaxOutputTokens(length: ResponseLength): number {
  if (length === "medium") {
    return DEFAULT_TRY_MEDIUM_MAX_OUTPUT_TOKENS;
  }

  if (length === "long") {
    return DEFAULT_TRY_LONG_MAX_OUTPUT_TOKENS;
  }

  return DEFAULT_TRY_SHORT_MAX_OUTPUT_TOKENS;
}

export function getTryModelConfigFromSource(source: ModelEnvSource, length: ResponseLength = "short"): ModelConfig {
  const base = getModelConfigFromSource(source);

  return {
    ...base,
    name: source.TRY_MODEL_NAME ?? DEFAULT_TRY_MODEL_NAME,
    maxOutputTokens: getTryMaxOutputTokens(length)
  };
}

export function getTryModelConfig(length: ResponseLength = "short"): ModelConfig {
  return getTryModelConfigFromSource(process.env as ModelEnvSource, length);
}
