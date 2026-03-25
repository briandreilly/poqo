const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL_NAME = "gpt-5.4";
function resolveProvider() {
    const raw = (process.env.MODEL_PROVIDER ?? DEFAULT_PROVIDER).trim().toLowerCase();
    if (raw !== "openai") {
        throw new Error(`Unsupported MODEL_PROVIDER: ${raw}`);
    }
    return raw;
}
// poqo instances are single-model by design. This config surface stays tiny on
// purpose so provider details do not spread into core judgment code.
export function getModelConfig() {
    return {
        provider: resolveProvider(),
        apiKey: process.env.MODEL_API_KEY ?? process.env.OPENAI_API_KEY ?? null,
        name: process.env.MODEL_NAME ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL_NAME
    };
}
