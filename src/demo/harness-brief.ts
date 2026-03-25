import type { InterventionMode, PoqoResult, RuntimeGuide } from "../types.js";
import { isFramePreservingDirect } from "../response/builder.js";

function pickModeVariant(
  interventionMode: InterventionMode,
  variants: { calm: string; counter: string; blunt: string }
): string {
  return variants[interventionMode];
}

function joinIfAny(label: string, values: string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return `${label}: ${values.join("; ")}`;
}

function buildNarrowingLines(result: PoqoResult, interventionMode: InterventionMode): string[] {
  if (result.analysis.signals.priorityDecisionWithoutContext) {
    return [
      "Decision frame: first work usually earns its place through core user value, learning, or risk reduction.",
      "Missing variable: the actual feature and why it belongs before the rest.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "what feature are you deciding about?",
        counter: "that is a strong priority call. what feature are you deciding about?",
        blunt: "no, that is not enough to judge. what feature are you actually deciding about?"
      })}`
    ];
  }

  if (result.analysis.signals.vagueConcernReaction) {
    return [
      "Decision frame: there is a real concern here, but it is still too vague to engage well.",
      "Missing variable: the specific part that feels wrong.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "what feels off about it?",
        counter: "something is missing here. what part feels off?",
        blunt: "that is too vague as stated. what exactly feels off?"
      })}`
    ];
  }

  if (result.analysis.signals.contestedFramingClaim) {
    return [
      "Decision frame: this argument bundles contested definitions and labels before the frame is aligned.",
      "Missing variable: the definition or classification rule the claim is using.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "what definition of left and right are you using here?",
        counter: "you are mixing labels. what definition of left and right are you using here?",
        blunt: "no, that frame does not hold as stated. what definition of left and right are you using here?"
      })}`
    ];
  }

  if (result.analysis.signals.coherentCritiqueBundle) {
    return [
      "Decision frame: the critique already names what feels broken across several outcomes.",
      "Missing variable: what better would look like or what should change first.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "what would you want different?",
        counter: "you have a full critique here. what would you change first?",
        blunt: "if it is that broken, what exactly should replace it?"
      })}`
    ];
  }

  if (result.analysis.signals.argumentLoadedStatement) {
    return [
      "Decision frame: this is a strong multi-claim statement, not a clean direct-answer prompt.",
      "Missing variable: the basis or frame that should anchor the next turn.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "what are you basing that on?",
        counter: "that is a strong claim. what are you basing it on?",
        blunt: "no, that does not land as stated. what are you basing it on?"
      })}`
    ];
  }

  if (result.analysis.signals.strongUnsupportedStance) {
    return [
      "Decision frame: this is a broad or forceful claim, so the next move is to surface what it rests on.",
      "Missing variable: the concrete basis, event, or example behind the claim.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "what are you basing that on?",
        counter: "that is a strong claim. what are you basing it on?",
        blunt: "no, that does not land as stated. what are you basing it on?"
      })}`
    ];
  }

  if (result.analysis.signals.materialReferencedButMissing) {
    return [
      "Decision frame: part of the answer is possible now, but the source material is missing.",
      "Missing variable: the actual text to work from.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "can you paste the material?",
        counter: "I need the actual text. can you paste it?",
        blunt: "no, I cannot work from a missing source. paste the material."
      })}`
    ];
  }

  if (result.analysis.signals.scopeConflict) {
    return [
      "Decision frame: two stated constraints are pulling against each other.",
      "Missing variable: which constraint is actually non-negotiable.",
      `Smallest next question: ${pickModeVariant(interventionMode, {
        calm: "which constraint wins if they conflict?",
        counter: "you need to choose. which constraint wins if they conflict?",
        blunt: "both constraints cannot win. which one actually wins?"
      })}`
    ];
  }

  return [
    "Decision frame: a practical answer is possible once the missing variable is named.",
    "Missing variable: the key decision rule that would make one answer reliable.",
    `Smallest next question: ${pickModeVariant(interventionMode, {
      calm: "what single variable most controls this decision?",
      counter: "what single variable actually controls this decision?",
      blunt: "what variable actually decides this?"
    })}`
  ];
}

function buildDomainLockLines(domainAnchor: string | null): string[] {
  if (!domainAnchor) {
    return [];
  }

  if (domainAnchor === "minecraft") {
    return [
      "Domain anchor: minecraft.",
      "Domain lock: stay inside Minecraft. Do not switch to real-world building, engineering, armor, or survival language unless the user asks."
    ];
  }

  if (domainAnchor === "product-ui") {
    return [
      "Domain anchor: product-ui.",
      "Domain lock: stay inside the app, product, or UI feedback domain. Do not widen into generic sociology, management theory, or unrelated real-world analogies unless the user asks."
    ];
  }

  if (domainAnchor === "healthcare") {
    return [
      "Domain anchor: healthcare.",
      "Domain lock: stay inside the healthcare policy or service domain. Do not widen into unrelated institutions or adjacent domains unless the user asks."
    ];
  }

  return [
    "Domain anchor: " + domainAnchor + ".",
    "Domain lock: stay inside the user's domain. Do not switch to adjacent domains or real-world analogies unless the user asks."
  ];
}

export function buildPromptGuideLines(runtimeGuide: RuntimeGuide): string[] {
  // The harness shows only the distilled guide so developers can inspect the
  // live boundary without turning the brief into a second constitution source.
  const lines = [
    joinIfAny("Tone hints", runtimeGuide.promptGuide.toneHints.slice(0, 3)),
    joinIfAny("Default behavior", runtimeGuide.promptGuide.defaultBehavior.slice(0, 3)),
    joinIfAny("Must not", runtimeGuide.promptGuide.forbiddenBehavior.slice(0, 2))
  ].filter((value): value is string => Boolean(value));

  return lines;
}

export function buildPoqoBrief(result: PoqoResult, runtimeGuide: RuntimeGuide, interventionMode: InterventionMode, domainAnchorOverride: string | null = null): string {
  // The brief reflects a routing decision that already exists. Profile tone may
  // shape wording here, but it must not change move, proof, posture, or domain lock.
  const domainAnchor = domainAnchorOverride ?? result.analysis.domainAnchor;
  const lines = [
    `Move: ${result.move}`,
    `Proof type: ${result.proofType}`,
    `Routing explanation: ${result.routingExplanation}`,
    `Intervention mode: ${interventionMode}`
  ];

  if (result.move === "DIRECT") {
    if (result.analysis.signals.violenceRisk) {
      lines.push("Strategy: do not validate violence, redirect toward non-violent options, and encourage urgent help if there is immediate danger.");
      lines.push("Safety frame: no tactical or harmful guidance.");
      lines.push("Next move: calm the situation, step back, and involve trusted support or emergency help if needed.");
    } else if (result.analysis.signals.answerableSubjectiveQuestion) {
      lines.push(
        pickModeVariant(interventionMode, {
          calm: "Strategy: answer calmly, normalize the feeling, and give one simple reassuring step if helpful.",
          counter: "Strategy: answer directly, keep the tone firmer, and allow intelligent pushback if it helps the answer.",
          blunt: "Strategy: answer plainly. If you reject the premise, do it immediately, replace it with the competing claim, and stand on that replacement."
        })
      );
    } else if (isFramePreservingDirect(result.analysis, result.move)) {
      if (result.analysis.signals.personallyScopedEvaluation) {
        lines.push(
          pickModeVariant(interventionMode, {
            calm: "Strategy: stay inside the user's frame, acknowledge the experience naturally, and help express or extend it without forcing justification.",
            counter: "Strategy: stay with the user's frame first, but you may question weak reasoning or oppose the take if it helps.",
            blunt: "Strategy: if you oppose the takeaway, reject it clearly, replace it with the stronger claim, and stand on that replacement without drifting into both-sides language."
          })
        );
      } else if (result.analysis.signals.nonActionableRemark) {
        lines.push(
          pickModeVariant(interventionMode, {
            calm: "Strategy: respond briefly, keep it respectful, and redirect only if it helps.",
            counter: "Strategy: respond briefly, allow firmer pushback, and keep the remark from taking over the turn.",
            blunt: "Strategy: reject the remark directly, replace it with a cleaner line if helpful, and move on without theatricality."
          })
        );
      } else {
        lines.push(
          pickModeVariant(interventionMode, {
            calm: "Strategy: stay inside the user's frame, do not rebut or rebalance, and help express, refine, or extend the idea.",
            counter: "Strategy: stay with the user's frame first, but apply intelligent pushback, question weak reasoning, and press weak spots without becoming theatrical.",
            blunt: "Strategy: reject the claim clearly, replace it with a competing claim, and stand on that replacement. Do not soften into both-sides framing, hedging, or clarification."
          })
        );
      }
    } else if (result.analysis.utteranceType === "greeting") {
      lines.push("Strategy: acknowledge briefly and naturally.");
    } else if (result.analysis.utteranceType === "observation") {
      lines.push("Strategy: mirror the observation lightly and keep it simple.");
    } else if (result.analysis.utteranceType === "emotional_reaction") {
      lines.push("Strategy: acknowledge the feeling briefly and avoid forcing a question.");
    } else if (result.analysis.utteranceType === "opinion_statement") {
      lines.push(
        pickModeVariant(interventionMode, {
          calm: "Strategy: stay inside the user's frame, do not rebut or rebalance, and help express, refine, or extend the idea.",
          counter: "Strategy: stay with the user's frame first, but apply intelligent pushback where it helps.",
          blunt: "Strategy: reject the claim clearly if you disagree, replace it with the competing claim, and stand on that replacement."
        })
      );
    } else {
      lines.push(
        pickModeVariant(interventionMode, {
          calm: "Strategy: answer directly, stay compact, and follow the profile tone.",
          counter: "Strategy: answer directly with more pressure or skepticism where it helps.",
          blunt: "Strategy: answer directly. If you oppose the claim, reject it in the first sentence and replace it with the stronger claim."
        })
      );
    }
  } else if (result.move === "NARROW") {
    lines.push(
      pickModeVariant(interventionMode, {
        calm: "Strategy: answer the part that is ready, name the missing variable, and ask the smallest useful next question.",
        counter: "Strategy: keep the narrowing move, but press the missing variable more firmly and do not let the weak spot hide.",
        blunt: "Strategy: keep the narrowing move, but make it sharp. Do not debate yet; force the missing variable into view with one clean question."
      })
    );
    lines.push(...buildNarrowingLines(result, interventionMode));
  } else if (result.proofType === "world") {
    lines.push(
      pickModeVariant(interventionMode, {
        calm: "Strategy: use outside facts for the final answer and stay explicit where current verification matters.",
        counter: "Strategy: use outside facts and allow intelligent pushback where the evidence supports it.",
        blunt: "Strategy: use outside facts. If the evidence cuts against the claim, reject it clearly and replace it with the stronger claim."
      })
    );
  } else if (result.proofType === "chat") {
    lines.push(
      pickModeVariant(interventionMode, {
        calm: "Strategy: ground the final answer in the active chat constraints instead of generic best practice.",
        counter: "Strategy: ground the answer in the active chat constraints and allow firmer pushback if needed.",
        blunt: "Strategy: ground the answer in the active chat constraints. If you reject the claim, do it clearly and stand on the replacement."
      })
    );
  } else if (result.proofType === "document") {
    lines.push(
      pickModeVariant(interventionMode, {
        calm: "Strategy: ground the final answer in the provided material and avoid inventing beyond the text.",
        counter: "Strategy: ground the answer in the provided material and allow firmer pushback when the text supports it.",
        blunt: "Strategy: ground the answer in the provided material. If the text cuts against the claim, reject it clearly and replace it with the stronger claim."
      })
    );
  } else {
    lines.push("Strategy: make the next move visible and keep the answer inspectable.");
  }

  lines.push(...buildDomainLockLines(domainAnchor));

  if (result.analysis.constraints.length > 0) {
    lines.push(`Active constraints: ${result.analysis.constraints.join("; ")}`);
  }

  lines.push(...buildPromptGuideLines(runtimeGuide));
  return lines.join("\n");
}
