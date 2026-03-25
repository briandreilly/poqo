const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
function extractOutputText(payload) {
    if (typeof payload.output_text === "string" && payload.output_text.trim()) {
        return payload.output_text.trim();
    }
    const text = (payload.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text" && typeof item.text === "string")
        .map((item) => item.text?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n");
    return text || "Model returned no text output.";
}
// OpenAI-specific request formatting stays here so poqo core does not depend on
// Responses API payload shape, role assumptions, or response parsing details.
export async function runOpenAIModel(config, prompt) {
    if (!config.apiKey) {
        throw new Error("MODEL_API_KEY is not set. Add it locally to use the model harness.");
    }
    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: config.name,
            input: [
                {
                    role: "system",
                    content: [{ type: "input_text", text: prompt.instructionText }]
                },
                {
                    role: "user",
                    content: [{ type: "input_text", text: prompt.taskText }]
                }
            ]
        })
    });
    const payload = (await response.json());
    if (!response.ok) {
        const message = payload.error?.message ?? `Model request failed with status ${response.status}`;
        throw new Error(message);
    }
    return {
        provider: config.provider,
        modelName: config.name,
        responseText: extractOutputText(payload)
    };
}
