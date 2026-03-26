import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadRuntimeGuide } from "../constitution/loader.js";
import { resolveDomainAnchor } from "../domain-anchor.js";
import { runPoqo } from "../engine.js";
import { getModelStatus, runConfiguredModel } from "../model/client.js";
import { isFramePreservingDirect } from "../response/builder.js";
import { mapResponseAttitudeToInterventionMode, normalizeResponseConfig } from "../response/config.js";
import { buildPoqoBrief } from "./harness-brief.js";
import { loadLocalEnv } from "./load-env.js";
import type { ProfileId, ResponseAttitude, ResponseTone } from "../types.js";

loadLocalEnv();

const DEFAULT_PROFILE_ID: ProfileId = "default";

const ATTITUDE_OPTIONS: Array<{ value: ResponseAttitude; label: string }> = [
  { value: "normal", label: "normal" },
  { value: "challenge", label: "challenge" },
  { value: "difficult", label: "difficult" }
];

const TONE_OPTIONS: Array<{ value: ResponseTone; label: string }> = [
  { value: "neutral", label: "neutral" },
  { value: "direct", label: "direct" },
  { value: "sharp", label: "sharp" }
];

function printOptions(options: Array<{ label: string }>): void {
  options.forEach((option, index) => {
    console.log(`${index + 1} ${option.label}`);
  });
}

async function chooseOption<T extends string>(
  rl: readline.Interface,
  promptText: string,
  options: Array<{ value: T; label: string }>,
  defaultIndex: number
): Promise<T> {
  console.log(promptText);
  printOptions(options);

  const answer = (await rl.question("> ")).trim().toLowerCase();
  if (!answer) {
    return options[defaultIndex].value;
  }

  const numeric = Number(answer);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) {
    return options[numeric - 1].value;
  }

  const byLabel = options.find((option) => option.label.toLowerCase() === answer);
  return byLabel?.value ?? options[defaultIndex].value;
}

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log("Enter claim:");
    const prompt = (await rl.question("> ")).trim();

    if (!prompt) {
      console.error("A claim is required.");
      process.exitCode = 1;
      return;
    }

    console.log();
    const attitude = await chooseOption(rl, "Select attitude:", ATTITUDE_OPTIONS, 0);
    console.log();
    const tone = await chooseOption(rl, "Select tone:", TONE_OPTIONS, 0);

    const responseConfig = normalizeResponseConfig({
      attitude,
      tone,
      language: "en"
    });

    const interventionMode = mapResponseAttitudeToInterventionMode(responseConfig.attitude);
    const poqoResult = await runPoqo(prompt, DEFAULT_PROFILE_ID);
    const runtimeGuide = await loadRuntimeGuide(DEFAULT_PROFILE_ID);
    const effectiveDomainAnchor = resolveDomainAnchor(prompt, null);
    const poqoBrief = buildPoqoBrief(poqoResult, runtimeGuide, responseConfig, effectiveDomainAnchor);
    const framePreservingDirect = isFramePreservingDirect(poqoResult.analysis, poqoResult.move);
    const modelStatus = getModelStatus();

    console.log();
    console.log(`Selected attitude: ${responseConfig.attitude}`);
    console.log(`Selected tone: ${responseConfig.tone}`);
    console.log(`Output language: ${responseConfig.language}`);
    console.log();

    if (!modelStatus.modelAvailable) {
      console.log("Model API key missing. Showing poqo brief instead of a model answer.");
      console.log();
      console.log(poqoBrief);
      return;
    }

    const modelResult = await runConfiguredModel({
      prompt,
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

    console.log("poqo response:");
    console.log(modelResult.responseText);
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
