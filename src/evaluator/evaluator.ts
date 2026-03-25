import { readFile } from "node:fs/promises";
import path from "node:path";

import { runPoqo } from "../engine.js";
import { benchmarkManifest, benchmarkOrder } from "./benchmark-manifest.js";
import type {
  BenchmarkId,
  CombinedEvaluationReport,
  EvaluationReport,
  EvaluationResult,
  EvaluationSummary,
  PoqoResult,
  ProfileId,
  PromptCase,
  PromptSetFile,
  ResponseQualityAssessment
} from "../types.js";

const varianceProfiles: ProfileId[] = ["default", "founder", "kidsafe"];

export async function loadPromptSet(label: BenchmarkId = "v1"): Promise<PromptSetFile> {
  const raw = await readFile(path.join(process.cwd(), benchmarkManifest[label].filePath), "utf8");
  return JSON.parse(raw) as PromptSetFile;
}

function assessResponseQuality(promptCase: PromptCase, result: PoqoResult): ResponseQualityAssessment {
  const response = result.finalResponse;
  const normalized = response.toLowerCase();
  const hasBranching =
    /\bif\b/.test(normalized) ||
    /smallest next question:/i.test(response) ||
    /^\d+\./m.test(response);
  const hasConcreteProgress =
    /part of this is answerable now|the likely answer depends on|keep the hard constraint|working answer|basis:|smallest useful answer|use plain html|single local config file/i.test(
      response
    );
  const genericClarify =
    /can you provide more details|provide more details|tell me more|need more information|more information is needed/i.test(normalized);

  const forwardMotion = result.move === "DIRECT" || result.move === "PROVE" || hasBranching || hasConcreteProgress;
  const stalled = result.move === "NARROW" && (genericClarify || !forwardMotion);
  const overNarrowed =
    (result.move === "NARROW" && promptCase.expectedMove === "DIRECT") ||
    (result.move === "NARROW" && !stalled && !hasBranching && !hasConcreteProgress);
  const overProved =
    (result.move === "PROVE" && promptCase.expectedProof === "none") ||
    (result.move === "PROVE" && result.proofType !== "none" && !/Basis:/i.test(response));

  const notes: string[] = [];

  if (forwardMotion) {
    notes.push("The response made practical progress.");
  } else {
    notes.push("The response did not reduce uncertainty enough.");
  }

  if (stalled) {
    notes.push("The response stalled instead of moving the decision forward.");
  }
  if (overNarrowed) {
    notes.push("The response narrowed harder than needed.");
  }
  if (overProved) {
    notes.push("The response used more proof framing than the prompt needed.");
  }

  return {
    forwardMotion,
    stalled,
    overNarrowed,
    overProved,
    notes
  };
}

function buildSummary(results: EvaluationResult[], promptTotal = results.length): EvaluationSummary {
  const moveMatches = results.filter((result) => result.moveMatch).length;
  const proofMatches = results.filter((result) => result.proofMatch).length;
  const forwardMotionPasses = results.filter((result) => result.quality.forwardMotion).length;
  const stalls = results.filter((result) => result.quality.stalled).length;
  const overNarrowCases = results.filter((result) => result.quality.overNarrowed).length;
  const overProofCases = results.filter((result) => result.quality.overProved).length;
  const profileDriftCases = results.filter((result) => result.profileDrift).length;

  return {
    promptTotal,
    totalRuns: results.length,
    moveMatches,
    proofMatches,
    moveAccuracy: moveMatches / results.length,
    proofAccuracy: proofMatches / results.length,
    forwardMotionPasses,
    stalls,
    overNarrowCases,
    overProofCases,
    profileDriftCases
  };
}

function buildEvaluationResult(
  promptCase: PromptCase,
  profileId: ProfileId,
  result: PoqoResult,
  profileDrift = false,
  driftReason?: string
): EvaluationResult {
  return {
    promptCase,
    profileId,
    actualMove: result.move,
    actualProof: result.proofType,
    moveMatch: result.move === promptCase.expectedMove,
    proofMatch: result.proofType === promptCase.expectedProof,
    routingExplanation: result.routingExplanation,
    quality: assessResponseQuality(promptCase, result),
    profileDrift,
    driftReason
  };
}

function buildReport(label: BenchmarkId, results: EvaluationResult[], promptTotal: number): EvaluationReport {
  const metadata = benchmarkManifest[label];

  return {
    label,
    benchmarkId: metadata.id,
    benchmarkName: metadata.name,
    benchmarkFilePath: metadata.filePath,
    frozen: metadata.frozen,
    summary: buildSummary(results, promptTotal),
    results
  };
}

function applyVarianceDriftChecks(results: EvaluationResult[]): EvaluationResult[] {
  const anyExpectedMatch = results.some((result) => result.moveMatch && result.proofMatch);
  const anyForwardMotion = results.some((result) => result.quality.forwardMotion);
  const distinctMoves = new Set(results.map((result) => result.actualMove));
  const distinctProofs = new Set(results.map((result) => result.actualProof));
  const divergentAcrossProfiles = distinctMoves.size > 1 || distinctProofs.size > 1;

  return results.map((result) => {
    const mismatch = !result.moveMatch || !result.proofMatch;
    const forwardMotionDrift = !result.quality.forwardMotion && anyForwardMotion;
    const profileDrift = (mismatch && (divergentAcrossProfiles || anyExpectedMatch)) || forwardMotionDrift;

    let driftReason: string | undefined;

    if (profileDrift) {
      if (!result.quality.forwardMotion && anyForwardMotion) {
        driftReason = "This profile lost forward motion while peers still moved the answer forward.";
      } else if (!result.moveMatch && !result.proofMatch) {
        driftReason = "This profile changed both move and proof basis for the same underlying ask.";
      } else if (!result.moveMatch) {
        driftReason = "This profile changed the move for a stylistic or presentation-driven reason.";
      } else if (!result.proofMatch) {
        driftReason = "This profile changed the proof basis even though the grounding need stayed the same.";
      }
    }

    return {
      ...result,
      profileDrift,
      driftReason
    };
  });
}

async function evaluateVariancePromptSet(): Promise<EvaluationReport> {
  const promptSet = await loadPromptSet("variance");
  const results: EvaluationResult[] = [];

  for (const promptCase of promptSet.prompts) {
    const profiles = promptCase.profilesToRun?.length ? promptCase.profilesToRun : varianceProfiles;
    const promptResults: EvaluationResult[] = [];

    for (const profileId of profiles) {
      const result = await runPoqo(promptCase.prompt, profileId);
      promptResults.push(buildEvaluationResult(promptCase, profileId, result));
    }

    results.push(...applyVarianceDriftChecks(promptResults));
  }

  return buildReport("variance", results, promptSet.prompts.length);
}

export async function evaluatePromptSet(label: BenchmarkId = "v1"): Promise<EvaluationReport> {
  if (label === "variance") {
    return evaluateVariancePromptSet();
  }

  const promptSet = await loadPromptSet(label);
  const results: EvaluationResult[] = [];

  for (const promptCase of promptSet.prompts) {
    const profileId = promptCase.profileId ?? "default";
    const result = await runPoqo(promptCase.prompt, profileId);
    results.push(buildEvaluationResult(promptCase, profileId, result));
  }

  return buildReport(label, results, promptSet.prompts.length);
}

export async function evaluateAllPromptSets(): Promise<CombinedEvaluationReport> {
  const reports = await Promise.all(benchmarkOrder.map((label) => evaluatePromptSet(label)));

  return {
    label: "all",
    reports,
    summary: buildSummary(
      reports.flatMap((report) => report.results),
      reports.reduce((sum, report) => sum + report.summary.promptTotal, 0)
    )
  };
}
