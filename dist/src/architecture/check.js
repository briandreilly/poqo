import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadCoreConstitution, loadRuntimeGuide } from "../constitution/loader.js";
import { runPoqo } from "../engine.js";
import { interpretInput } from "../interpreter/interpreter.js";
import { buildModelExecutionPrompt } from "../model/prompt.js";
import { selectProof } from "../proof/selector.js";
import { routeJudgment } from "../router/router.js";
const constitutionDir = path.join(process.cwd(), "constitution");
const boundaryFilePath = path.join(process.cwd(), "prompts", "prompt-set-architecture-boundary.json");
function moveLabelFor(profileGuide, move) {
    return move === "DIRECT"
        ? profileGuide.profile.responseLabels.direct
        : move === "NARROW"
            ? profileGuide.profile.responseLabels.narrow
            : profileGuide.profile.responseLabels.prove;
}
async function assertSingleConstitutionSource() {
    const constitutionFiles = (await readdir(constitutionDir)).filter((file) => file.endsWith(".json")).sort();
    assert.deepEqual(constitutionFiles, ["core.json"], "poqo should have exactly one real Constitution file");
    const core = await loadCoreConstitution();
    assert.ok(core.identity.role.length > 0, "core constitution should load");
    assert.ok(core.purpose.mission.length > 0, "core constitution should contain a mission");
}
async function assertPromptGuideIsDistilled() {
    const runtimeGuide = await loadRuntimeGuide("default");
    const promptGuideKeys = Object.keys(runtimeGuide.promptGuide).sort();
    assert.deepEqual(promptGuideKeys, ["defaultBehavior", "forbiddenBehavior", "humanOverride", "mission", "role", "toneHints"], "prompt guide should stay distilled and small");
    assert.ok(!("responseLabels" in runtimeGuide.promptGuide), "prompt guide must not expose profile labels");
    assert.ok(!("termSubstitutions" in runtimeGuide.promptGuide), "prompt guide must not expose profile substitutions");
    assert.ok(!("title" in runtimeGuide.promptGuide), "prompt guide must not expose profile titles");
}
async function assertArchitectureBoundaryCases() {
    const boundaryFile = JSON.parse(await readFile(boundaryFilePath, "utf8"));
    for (const promptCase of boundaryFile.prompts) {
        const baselineAnalysis = interpretInput(promptCase.prompt);
        const baselineDecision = routeJudgment(baselineAnalysis);
        const baselineProof = selectProof(baselineAnalysis);
        assert.equal(baselineDecision.move, promptCase.expectedMove, `${promptCase.id} baseline move changed`);
        assert.equal(baselineProof.type, promptCase.expectedProof, `${promptCase.id} baseline proof changed`);
        if (Object.prototype.hasOwnProperty.call(promptCase, "expectedDomainAnchor")) {
            assert.equal(baselineAnalysis.domainAnchor, promptCase.expectedDomainAnchor ?? null, `${promptCase.id} baseline domain anchor changed`);
        }
        const baselineAnalysisJson = JSON.stringify(baselineAnalysis);
        for (const profileId of boundaryFile.profiles) {
            const result = await runPoqo(promptCase.prompt, profileId);
            const runtimeGuide = await loadRuntimeGuide(profileId);
            assert.equal(result.move, promptCase.expectedMove, `${promptCase.id}/${profileId} move drifted across profiles`);
            assert.equal(result.proofType, promptCase.expectedProof, `${promptCase.id}/${profileId} proof drifted across profiles`);
            assert.equal(JSON.stringify(result.analysis), baselineAnalysisJson, `${promptCase.id}/${profileId} analysis drifted across profiles`);
            assert.ok(result.finalResponse.startsWith(moveLabelFor(runtimeGuide, result.move) + "\n"), `${promptCase.id}/${profileId} should apply profile labels only after judgment`);
        }
    }
}
async function assertModelSeamPreservesDecidedJudgment() {
    const runtimeGuide = await loadRuntimeGuide("default");
    const input = {
        prompt: "Diamond armor is always the best choice in Minecraft.",
        runtimeGuide,
        move: "DIRECT",
        proofType: "none",
        routingExplanation: "DIRECT because the question is short, specific, and answer-ready.",
        poqoBrief: "Move: DIRECT\nProof type: none\nRouting explanation: DIRECT because the question is short, specific, and answer-ready.",
        framePreservingDirect: false,
        interventionMode: "counter",
        domainAnchor: "minecraft"
    };
    const snapshot = JSON.stringify(input);
    const prompt = buildModelExecutionPrompt(input);
    assert.equal(JSON.stringify(input), snapshot, "model seam must not mutate already-decided judgment input");
    assert.match(prompt.taskText, /move: DIRECT/, "model seam must preserve the chosen move in the execution payload");
    assert.match(prompt.taskText, /proofType: none/, "model seam must preserve the chosen proof basis in the execution payload");
    assert.match(prompt.taskText, /domainAnchor: minecraft/, "model seam must preserve the chosen domain anchor in the execution payload");
    assert.match(prompt.taskText, /Routing explanation: DIRECT because the question is short, specific, and answer-ready\./, "model seam must preserve the routing explanation instead of rewriting it");
}
async function main() {
    await assertSingleConstitutionSource();
    await assertPromptGuideIsDistilled();
    await assertArchitectureBoundaryCases();
    await assertModelSeamPreservesDecidedJudgment();
    console.log("architecture boundary checks passed");
}
main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
});
