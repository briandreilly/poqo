import { getModelConfig } from "./config.js";
import { buildModelExecutionPrompt } from "./prompt.js";
import { runOpenAIModel } from "./providers/openai.js";
// The model client is an execution seam only. It selects the configured
// provider adapter, but it must not inspect the prompt content to revise move,
// proof, posture, profile influence, or domain lock.
export function getModelStatus() {
    const config = getModelConfig();
    return {
        modelAvailable: Boolean(config.apiKey),
        modelProvider: config.provider,
        modelName: config.name
    };
}
export async function runConfiguredModel(input) {
    const config = getModelConfig();
    const prompt = buildModelExecutionPrompt(input);
    if (config.provider === "openai") {
        return runOpenAIModel(config, prompt);
    }
    throw new Error(`Unsupported model provider: ${config.provider}`);
}
