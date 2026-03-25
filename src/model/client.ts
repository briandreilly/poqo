import { getModelConfig } from "./config.js";
import { buildModelExecutionPrompt } from "./prompt.js";
import { runOpenAIModel } from "./providers/openai.js";
import type { HarnessStatus, ModelExecutionInput, ModelExecutionResult } from "../types.js";

// The model client is an execution seam only. It selects the configured
// provider adapter, but it must not inspect the prompt content to revise move,
// proof, posture, profile influence, or domain lock.

function hasUsableApiKey(apiKey: string | null): boolean {
  const normalized = apiKey?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return normalized !== "your_model_api_key_here" && normalized !== "your_openai_api_key_here";
}

export function getModelStatus(): HarnessStatus {
  const config = getModelConfig();

  return {
    modelAvailable: hasUsableApiKey(config.apiKey),
    modelProvider: config.provider,
    modelName: config.name
  };
}

export async function runConfiguredModel(input: ModelExecutionInput): Promise<ModelExecutionResult> {
  const config = getModelConfig();

  if (!hasUsableApiKey(config.apiKey)) {
    throw new Error("MODEL_API_KEY is not set. Replace the example placeholder in .env to use the model harness.");
  }

  const prompt = buildModelExecutionPrompt(input);

  if (config.provider === "openai") {
    return runOpenAIModel(config, prompt);
  }

  throw new Error(`Unsupported model provider: ${config.provider}`);
}
