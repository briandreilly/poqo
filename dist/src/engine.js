import { loadRuntimeGuide } from "./constitution/loader.js";
import { interpretInput } from "./interpreter/interpreter.js";
import { selectProof } from "./proof/selector.js";
import { buildPoqoResult } from "./response/builder.js";
import { routeJudgment } from "./router/router.js";
export async function runPoqo(input, profileId) {
    const analysis = interpretInput(input);
    const decision = routeJudgment(analysis);
    const proof = selectProof(analysis);
    // Profile loading happens only after routing and proof are fixed.
    // This keeps presentation overlays out of judgment behavior.
    const runtimeGuide = await loadRuntimeGuide(profileId);
    return buildPoqoResult(runtimeGuide, analysis, decision.move, proof, decision.explanation);
}
