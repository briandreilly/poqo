import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { loadCoreConstitution, loadRuntimeGuide } from "../constitution/loader.js";
import { runPoqo } from "../engine.js";
import { interpretInput } from "../interpreter/interpreter.js";
import { buildModelExecutionPrompt } from "../model/prompt.js";
import { updateConversationState } from "../summary/state.js";
import { selectProof } from "../proof/selector.js";
import { routeJudgment } from "../router/router.js";
import type { DomainAnchor, ModelExecutionInput, Move, ProfileId, ProofType } from "../types.js";

interface ArchitectureBoundaryCase {
  id: string;
  prompt: string;
  expectedMove: Move;
  expectedProof: ProofType;
  expectedDomainAnchor?: DomainAnchor;
  notes: string;
}

interface ArchitectureBoundaryFile {
  version: string;
  profiles: ProfileId[];
  prompts: ArchitectureBoundaryCase[];
}

const constitutionDir = path.join(process.cwd(), "constitution");
const boundaryFilePath = path.join(process.cwd(), "prompts", "prompt-set-architecture-boundary.json");

function moveLabelFor(profileGuide: Awaited<ReturnType<typeof loadRuntimeGuide>>, move: Move): string {
  return move === "DIRECT"
    ? profileGuide.profile.responseLabels.direct
    : move === "NARROW"
      ? profileGuide.profile.responseLabels.narrow
      : profileGuide.profile.responseLabels.prove;
}

async function assertSingleConstitutionSource(): Promise<void> {
  const constitutionFiles = (await readdir(constitutionDir)).filter((file) => file.endsWith(".json")).sort();
  assert.deepEqual(constitutionFiles, ["core.json"], "poqo should have exactly one real Constitution file");

  const core = await loadCoreConstitution();
  assert.ok(core.identity.role.length > 0, "core constitution should load");
  assert.ok(core.purpose.mission.length > 0, "core constitution should contain a mission");
}

async function assertPromptGuideIsDistilled(): Promise<void> {
  const runtimeGuide = await loadRuntimeGuide("default");
  const promptGuideKeys = Object.keys(runtimeGuide.promptGuide).sort();

  assert.deepEqual(
    promptGuideKeys,
    ["defaultBehavior", "forbiddenBehavior", "humanOverride", "mission", "role", "toneHints"],
    "prompt guide should stay distilled and small"
  );

  assert.ok(!("responseLabels" in runtimeGuide.promptGuide), "prompt guide must not expose profile labels");
  assert.ok(!("termSubstitutions" in runtimeGuide.promptGuide), "prompt guide must not expose profile substitutions");
  assert.ok(!("title" in runtimeGuide.promptGuide), "prompt guide must not expose profile titles");
}

async function assertArchitectureBoundaryCases(): Promise<void> {
  const boundaryFile = JSON.parse(await readFile(boundaryFilePath, "utf8")) as ArchitectureBoundaryFile;

  for (const promptCase of boundaryFile.prompts) {
    const baselineAnalysis = interpretInput(promptCase.prompt);
    const baselineDecision = routeJudgment(baselineAnalysis);
    const baselineProof = selectProof(baselineAnalysis);

    assert.equal(baselineDecision.move, promptCase.expectedMove, `${promptCase.id} baseline move changed`);
    assert.equal(baselineProof.type, promptCase.expectedProof, `${promptCase.id} baseline proof changed`);

    if (Object.prototype.hasOwnProperty.call(promptCase, "expectedDomainAnchor")) {
      assert.equal(
        baselineAnalysis.domainAnchor,
        promptCase.expectedDomainAnchor ?? null,
        `${promptCase.id} baseline domain anchor changed`
      );
    }

    const baselineAnalysisJson = JSON.stringify(baselineAnalysis);

    for (const profileId of boundaryFile.profiles) {
      const result = await runPoqo(promptCase.prompt, profileId);
      const runtimeGuide = await loadRuntimeGuide(profileId);

      assert.equal(result.move, promptCase.expectedMove, `${promptCase.id}/${profileId} move drifted across profiles`);
      assert.equal(result.proofType, promptCase.expectedProof, `${promptCase.id}/${profileId} proof drifted across profiles`);
      assert.equal(
        JSON.stringify(result.analysis),
        baselineAnalysisJson,
        `${promptCase.id}/${profileId} analysis drifted across profiles`
      );
      assert.ok(
        result.finalResponse.startsWith(moveLabelFor(runtimeGuide, result.move) + "\n"),
        `${promptCase.id}/${profileId} should apply profile labels only after judgment`
      );
    }
  }
}

async function assertModelSeamPreservesDecidedJudgment(): Promise<void> {
  const runtimeGuide = await loadRuntimeGuide("default");
  const input: ModelExecutionInput = {
    prompt: "Diamond armor is always the best choice in Minecraft.",
    runtimeGuide,
    move: "DIRECT",
    proofType: "none",
    routingExplanation: "DIRECT because the question is short, specific, and answer-ready.",
    poqoBrief: "Move: DIRECT\nProof type: none\nRouting explanation: DIRECT because the question is short, specific, and answer-ready.",
    framePreservingDirect: false,
    interventionMode: "counter",
    responseConfig: {
      attitude: "challenging",
      tone: "direct",
      language: "en",
      customToneNotes: "",
      customBehaviorNotes: "",
      forbid: [],
      prefer: []
    },
    domainAnchor: "minecraft"
  };

  const snapshot = JSON.stringify(input);
  const prompt = buildModelExecutionPrompt(input);

  assert.equal(JSON.stringify(input), snapshot, "model seam must not mutate already-decided judgment input");
  assert.match(prompt.taskText, /move: DIRECT/, "model seam must preserve the chosen move in the execution payload");
  assert.match(prompt.taskText, /proofType: none/, "model seam must preserve the chosen proof basis in the execution payload");
  assert.match(prompt.taskText, /responseAttitude: challenging/, "model seam must preserve the configured response attitude in the execution payload");
  assert.match(prompt.taskText, /responseTone: direct/, "model seam must preserve the configured response tone in the execution payload");
  assert.match(prompt.taskText, /responseLanguage: en/, "model seam must preserve the configured response language in the execution payload");
  assert.match(prompt.taskText, /domainAnchor: minecraft/, "model seam must preserve the chosen domain anchor in the execution payload");
  assert.match(prompt.taskText, /Routing explanation: DIRECT because the question is short, specific, and answer-ready\./, "model seam must preserve the routing explanation instead of rewriting it");
}

function assertConversationSummaryLayer(): void {
  const claim = "Barry Bonds should not be in the Hall of Fame because of PED use.";

  let update = updateConversationState(null, {
    speakerId: "user-1",
    speakerType: "user",
    text: claim
  });
  assert.equal(update.state.activeClaim, claim, "first meaningful external turn should set the active claim");
  assert.equal(update.latestTurn.speakerId, "user-1", "first turn should preserve speaker identity");
  assert.equal(update.latestTurn.speakerType, "user", "first turn should preserve speaker type");
  assert.equal(update.latestTurn.stance, "support", "first active-claim turn should align with the baseline claim");

  update = updateConversationState(update.state, {
    speakerId: "poqo",
    speakerType: "poqo",
    text: "Bonds should not be in the HOF based on PEDs."
  });
  assert.equal(update.latestTurn.speakerId, "poqo", "poqo turns should keep poqo identity");
  assert.equal(update.latestTurn.stance, "support", "poqo support should be labeled support");

  update = updateConversationState(update.state, {
    speakerId: "user-1",
    speakerType: "user",
    text: "Actually the Hall should focus on greatness, not character."
  });
  assert.ok(
    update.latestTurn.stance === "refine" || update.latestTurn.stance === "contradict",
    "user stance shifts should register as refine or contradict"
  );
  assert.match(update.state.runningSummary, /user-1/, "running summary should preserve speaker identity");

  update = updateConversationState(update.state, {
    speakerId: "ai-2",
    speakerType: "external_ai",
    text: "Bonds belongs in the Hall because his achievements still meet the standard."
  });
  assert.equal(update.latestTurn.speakerId, "ai-2", "external AI turns should keep their own identity");
  assert.equal(update.latestTurn.stance, "contradict", "opposing external AI turn should be labeled contradict");

  update = updateConversationState(update.state, {
    speakerId: "poqo",
    speakerType: "poqo",
    text: "That shifts the argument from character judgment to Hall standards."
  });
  assert.equal(update.latestTurn.stance, "refine", "poqo boundary-setting turn should be labeled refine");
  assert.match(update.state.runningSummary, /ai-2/, "running summary should preserve non-poqo participants");
  assert.match(update.state.runningSummary, /poqo/, "running summary should preserve poqo identity too");

  update = updateConversationState(update.state, {
    speakerId: "user-2",
    speakerType: "user",
    text: "Oak planks are a strong default block in Minecraft."
  });
  assert.equal(update.latestTurn.speakerId, "user-2", "new participant should not collapse into the first user identity");
  assert.equal(update.latestTurn.stance, "unrelated", "topic-shift turn should register as unrelated to the previous claim");
  assert.equal(update.activeClaimChanged, true, "clearly different external turns should replace the active claim");
  assert.equal(update.state.activeClaim, "Oak planks are a strong default block in Minecraft.", "active claim should shift on topic change");
  assert.equal(update.state.turnLog.length, 1, "turn log should rotate around the new active claim");
  assert.equal(update.state.turnLog[0].speakerId, "user-2", "rotated turn log should preserve the new speaker identity");
}

async function main(): Promise<void> {
  await assertSingleConstitutionSource();
  await assertPromptGuideIsDistilled();
  await assertArchitectureBoundaryCases();
  await assertModelSeamPreservesDecidedJudgment();
  assertConversationSummaryLayer();
  console.log("architecture boundary checks passed");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
