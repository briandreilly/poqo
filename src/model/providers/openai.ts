import type { ModelConfig, ModelExecutionPrompt, ModelExecutionResult } from "../../types.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// Provider adapters may translate prompt shape and normalize provider output,
// but they must not reinterpret poqo's judgment payload or add a second layer
// of operating policy.

interface OpenAIOutputContent {
  type?: string;
  text?: string;
}

interface OpenAIOutputItem {
  type?: string;
  content?: OpenAIOutputContent[];
}

interface OpenAIResponsesPayload {
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
}

function extractOutputText(payload: OpenAIResponsesPayload): string {
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
export async function runOpenAIModel(
  config: ModelConfig,
  prompt: ModelExecutionPrompt
): Promise<ModelExecutionResult> {
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

  const payload = (await response.json()) as OpenAIResponsesPayload;

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
