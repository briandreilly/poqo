import { loadRuntimeGuide } from "./constitution/loader.js";
import { interpretInput } from "./interpreter/interpreter.js";
import { selectProof } from "./proof/selector.js";
import { buildPoqoResult } from "./response/builder.js";
import { routeJudgment } from "./router/router.js";
import { updateConversationState } from "./summary/state.js";
import type { PoqoResult, ProfileId, RunPoqoOptions } from "./types.js";

export async function runPoqo(input: string, profileId: ProfileId, options: RunPoqoOptions = {}): Promise<PoqoResult> {
  const analysis = interpretInput(input);
  const decision = routeJudgment(analysis);
  const proof = selectProof(analysis);

  // Profile loading happens only after routing and proof are fixed.
  // This keeps presentation overlays out of judgment behavior.
  const runtimeGuide = await loadRuntimeGuide(profileId);
  const result = buildPoqoResult(runtimeGuide, analysis, decision.move, proof, decision.explanation);

  const externalTurnUpdate = updateConversationState(options.conversationState ?? null, {
    speakerId: options.speakerId,
    speakerType: options.speakerType ?? "user",
    speakerLabel: options.speakerLabel,
    text: input
  });

  const poqoTurnUpdate = updateConversationState(externalTurnUpdate.state, {
    speakerId: "poqo",
    speakerType: "poqo",
    speakerLabel: "poqo",
    text: result.finalResponse
  });

  return {
    ...result,
    conversationState: poqoTurnUpdate.state,
    conversationLogLine: poqoTurnUpdate.latestTurn.compactText,
    conversationStance: poqoTurnUpdate.latestTurn.stance,
    activeClaimChanged: externalTurnUpdate.activeClaimChanged
  };
}
