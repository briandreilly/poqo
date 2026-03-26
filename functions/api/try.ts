import { buildTryResponse, isValidTryRequest, type TryRequestBody } from "../../src/demo/try-response.js";
import { getTryModelConfigFromSource } from "../../src/model/config.js";

interface PagesTryContext {
  request: Request;
  env: Record<string, string | undefined | null>;
}

export async function onRequestPost(context: PagesTryContext): Promise<Response> {
  let body: unknown;

  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidTryRequest(body as Record<string, unknown>)) {
    return Response.json({ error: "claim is required" }, { status: 400 });
  }

  const requestBody = body as TryRequestBody;
  const response = await buildTryResponse(requestBody, {
    modelConfig: getTryModelConfigFromSource(context.env, requestBody.length ?? "short")
  });

  return Response.json(response, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
