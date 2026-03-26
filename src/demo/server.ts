import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { listProfiles, loadRuntimeGuide } from "../constitution/loader.js";
import { runPoqo } from "../engine.js";
import { evaluatePromptSet, loadPromptSet } from "../evaluator/evaluator.js";
import { getModelStatus, runConfiguredModel } from "../model/client.js";
import { buildPoqoBrief } from "./harness-brief.js";
import { isFramePreservingDirect } from "../response/builder.js";
import { mapResponseAttitudeToInterventionMode, normalizeResponseConfig } from "../response/config.js";
import { loadLocalEnv } from "./load-env.js";
import { resolveDomainAnchor } from "../domain-anchor.js";
import type { HarnessRequest, HarnessResponse, HarnessStatus, InterventionMode, ProfileId } from "../types.js";

loadLocalEnv();

const publicDir = path.join(process.cwd(), "public");
const port = Number(process.env.PORT ?? 3030);

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

async function serveIndex(response: ServerResponse): Promise<void> {
  const html = await readFile(path.join(publicDir, "index.html"), "utf8");
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
}

function buildHarnessStatus(): HarnessStatus {
  return getModelStatus();
}

async function buildHarnessResponse(body: HarnessRequest): Promise<HarnessResponse> {
  const responseConfig = normalizeResponseConfig(body.responseConfig, body.interventionMode ?? null);
  const interventionMode: InterventionMode = mapResponseAttitudeToInterventionMode(responseConfig.attitude);
  const modelStatus = getModelStatus();
  const poqoStartedAt = new Date().toISOString();
  const poqoResult = await runPoqo(body.prompt, body.profileId);
  const poqoFinishedAt = new Date().toISOString();
  // Keep the harness in the same order as the engine: routing and proof first,
  // then load the presentation overlay for briefing and final answer shaping.
  const runtimeGuide = await loadRuntimeGuide(body.profileId);
  const effectiveDomainAnchor = resolveDomainAnchor(body.prompt, body.domainContextAnchor ?? null);
  const poqoBrief = buildPoqoBrief(poqoResult, runtimeGuide, responseConfig, effectiveDomainAnchor);
  const framePreservingDirect = isFramePreservingDirect(poqoResult.analysis, poqoResult.move);
  const response: HarnessResponse = {
    profile: body.profileId,
    prompt: body.prompt,
    mode: body.mode,
    interventionMode,
    responseConfig,
    effectiveDomainAnchor,
    move: poqoResult.move,
    proofType: poqoResult.proofType,
    routingExplanation: poqoResult.routingExplanation,
    poqoBrief,
    modelResponse: null,
    modelProvider: modelStatus.modelProvider,
    modelName: modelStatus.modelName,
    modelAvailable: modelStatus.modelAvailable,
    poqoCompletedBeforeModel: true,
    poqoStartedAt,
    poqoFinishedAt,
    modelStartedAt: null,
    modelFinishedAt: null
  };

  if (body.mode === "poqo-plus-model") {
    const modelStartMs = Math.max(Date.now(), Date.parse(poqoFinishedAt) + 1);
    response.modelStartedAt = new Date(modelStartMs).toISOString();
    response.poqoCompletedBeforeModel = poqoFinishedAt < response.modelStartedAt;

    try {
      const modelResult = await runConfiguredModel({
        prompt: body.prompt,
        runtimeGuide,
        move: poqoResult.move,
        proofType: poqoResult.proofType,
        routingExplanation: poqoResult.routingExplanation,
        poqoBrief,
        framePreservingDirect,
        interventionMode,
        responseConfig,
        domainAnchor: effectiveDomainAnchor
      });
      response.modelResponse = modelResult.responseText;
      response.modelProvider = modelResult.provider;
      response.modelName = modelResult.modelName;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Model request failed.";
      response.modelError = message;
    } finally {
      response.modelFinishedAt = new Date().toISOString();
    }
  }

  return response;
}

function isValidHarnessRequest(body: Partial<HarnessRequest>): body is HarnessRequest {
  return Boolean(
      body.profileId &&
      body.prompt &&
      typeof body.prompt === "string" &&
      (body.mode === "poqo-only" || body.mode === "poqo-plus-model") &&
      (!body.interventionMode || body.interventionMode === "calm" || body.interventionMode === "counter" || body.interventionMode === "blunt") &&
      (!body.responseConfig || typeof body.responseConfig === "object")
  );
}

async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/") {
    await serveIndex(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/profiles") {
    sendJson(response, { profiles: await listProfiles() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/prompts") {
    const promptSet = await loadPromptSet();
    sendJson(response, { prompts: promptSet.prompts });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/evaluate") {
    const report = await evaluatePromptSet();
    sendJson(response, report);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/harness/status") {
    sendJson(response, buildHarnessStatus());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/judge") {
    const body = (await readJsonBody(request)) as {
      profileId?: ProfileId;
      prompt?: string;
    };

    if (!body.profileId || !body.prompt) {
      sendJson(response, { error: "profileId and prompt are required" }, 400);
      return;
    }

    const result = await runPoqo(body.prompt, body.profileId as ProfileId);
    sendJson(response, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/harness/run") {
    const body = (await readJsonBody(request)) as Partial<HarnessRequest>;

    if (!isValidHarnessRequest(body)) {
      sendJson(response, { error: "profileId, prompt, and mode are required" }, 400);
      return;
    }

    const harnessResponse = await buildHarnessResponse({
      profileId: body.profileId as ProfileId,
      prompt: body.prompt,
      mode: body.mode,
      interventionMode: body.interventionMode ?? "calm",
      responseConfig: body.responseConfig,
      domainContextAnchor: typeof body.domainContextAnchor === "string" ? body.domainContextAnchor : null
    });

    sendJson(response, harnessResponse);
    return;
  }

  sendJson(response, { error: "Not found" }, 404);
}

createServer((request, response) => {
  handler(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected error";
    sendJson(response, { error: message }, 500);
  });
}).listen(port, () => {
  console.log(`poqo demo listening on http://localhost:${port}`);
});
