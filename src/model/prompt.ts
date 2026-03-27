import type { DomainAnchor, ModelExecutionInput, ModelExecutionPrompt } from "../types.js";

// This file converts already-decided poqo judgment into a provider-neutral
// execution prompt. It must not reinterpret routing, change proof basis,
// alter domain lock, or invent a new response objective.

function buildDomainConstraint(domainAnchor: DomainAnchor): string | null {
  if (!domainAnchor) {
    return null;
  }

  if (domainAnchor === "minecraft") {
    return "Domain lock: stay inside Minecraft. Do not switch to real-world construction, architecture, engineering, safety, armor, or materials language unless the user asks.";
  }

  if (domainAnchor === "product-ui") {
    return "Domain lock: stay inside the app, product, or UI feedback domain. Do not widen into generic culture, psychology, or real-world analogies unless the user asks.";
  }

  if (domainAnchor === "healthcare") {
    return "Domain lock: stay inside the healthcare policy or service domain. Do not widen into unrelated institutions or adjacent domains unless the user asks.";
  }

  return "Domain lock: stay inside the user's domain. Do not switch to adjacent domains or real-world analogies unless the user asks.";
}

function buildToneConstraint(tone: ModelExecutionInput["responseConfig"]["tone"]): string {
  if (tone === "direct") {
    return "Response tone: direct. Keep the wording concise, firm, and minimally cushioned without changing the reasoning.";
  }

  return "Response tone: neutral. Keep the wording balanced and professional.";
}

function buildTryToneInstruction(tone: ModelExecutionInput["responseConfig"]["tone"]): string {
  if (tone === "direct") {
    return "Use shorter clauses, fewer qualifiers, and firmer wording with minimal cushioning.";
  }

  return "Use plain, professional baseline wording.";
}

function buildLanguageConstraint(language: ModelExecutionInput["responseConfig"]["language"]): string {
  return language === "es" ? "Output language: answer in Spanish." : "Output language: answer in English.";
}

function buildResponseConfigConstraint(input: ModelExecutionInput): string {
  const config = input.responseConfig;

  const attitudeConstraint = config.attitude === "balanced"
    ? "Response attitude: balanced. Stay cooperative, nuanced, and lower-friction."
    : "Response attitude: challenging. Apply stronger pressure, reject weak framing sooner, and keep a lower tolerance for overbroad claims.";

  return [
    attitudeConstraint,
    buildToneConstraint(config.tone),
    buildLanguageConstraint(config.language),
    config.customToneNotes ? `Custom tone note: ${config.customToneNotes}.` : null,
    config.customBehaviorNotes ? `Custom behavior note: ${config.customBehaviorNotes}.` : null,
    config.prefer.length > 0 ? `Prefer if compatible: ${config.prefer.join("; ")}.` : null,
    config.forbid.length > 0 ? `Avoid if compatible: ${config.forbid.join("; ")}.` : null,
    "Ignore any response configuration item that conflicts with routing, proof basis, domain lock, or core poqo rules."
  ].filter(Boolean).join(" ");
}

function buildResponseConfigTaskLines(input: ModelExecutionInput): string[] {
  const config = input.responseConfig;
  const lines = [
    `responseAttitude: ${config.attitude}`,
    `responseTone: ${config.tone}`,
    `responseLanguage: ${config.language}`
  ];

  if (config.customToneNotes) {
    lines.push(`customToneNotes: ${config.customToneNotes}`);
  }

  if (config.customBehaviorNotes) {
    lines.push(`customBehaviorNotes: ${config.customBehaviorNotes}`);
  }

  if (config.prefer.length > 0) {
    lines.push(`prefer: ${config.prefer.join("; ")}`);
  }

  if (config.forbid.length > 0) {
    lines.push(`forbid: ${config.forbid.join("; ")}`);
  }

  return lines;
}

function buildTryLengthInstruction(length: ModelExecutionInput["responseLength"]): string {
  if (length === "reaction") {
    return "Respond in 2 words maximum. Make it sound like a natural human reaction, not a classifier label or internal tag.";
  }

  if (length === "medium") {
    return "Respond in exactly 2 sentences. Keep it concise and controlled, with no extra elaboration, and stay within about 30 to 35 words total.";
  }

  if (length === "long") {
    return "Respond with a fully developed answer in 50 to 100 words. Keep it answer-only, and include the core reasoning and limits without turning it into a breakdown.";
  }

  return "Respond in a single sentence under 10 words. Give a direct answer only, with no filler and no extra clause.";
}

function classifyTryInputShape(prompt: string): "question" | "statement" {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "statement";
  }

  if (trimmed.endsWith("?")) {
    return "question";
  }

  return /^(?:is|are|am|do|does|did|can|could|should|would|will|what|why|how|when|where|who|whom|whose|which)\b/i.test(trimmed)
    ? "question"
    : "statement";
}

function buildTryAttitudeInstruction(input: ModelExecutionInput): string {
  if (input.responseConfig.attitude === "challenging") {
    return input.responseLength === "reaction"
      ? "Keep the answer compressed, firmer, and quicker to reject weak framing."
      : "Keep the answer firmer, more pressuring, and quicker to reject weak or overbroad framing, but still clean and answer-only.";
  }

  return "Keep the answer balanced, nuanced, and lower-friction.";
}

function buildTryAnswerObjective(input: ModelExecutionInput): string {
  const inputShape = classifyTryInputShape(input.prompt);

  if (inputShape === "question") {
    if (input.move === "PROVE") {
      return "Answer the question directly while making clear that the claim still needs evidence before it can be treated as settled.";
    }

    return "Answer the question directly. If the boundary is still loose, keep the answer provisional instead of asking a clarifying question.";
  }

  if (input.move === "NARROW") {
    return "Return the best tightened declarative statement you can. Preserve the user's core intent, remove overreach, and add a boundary if needed. If the statement is underspecified, say so declaratively instead of asking the user a question.";
  }

  if (input.move === "PROVE") {
    return "Return a declarative answer that makes clear the claim still needs evidence before it can be treated as settled.";
  }

  if (input.framePreservingDirect && input.interventionMode === "calm") {
    return "Treat the user's claim as the working premise and answer inside that frame without rebutting it.";
  }

  if (input.interventionMode === "counter") {
    return "Return the best tightened declarative answer you can, with intelligent pressure where poqo's chosen move permits it.";
  }

  if (input.interventionMode === "blunt") {
    return "Return the best declarative answer you can and reject weak framing faster where poqo's chosen move permits it.";
  }

  return "Give the best final declarative answer to the claim while following poqo's chosen move.";
}

function buildTryAnswerPrompt(input: ModelExecutionInput): ModelExecutionPrompt {
  const domainConstraint = buildDomainConstraint(input.domainAnchor);
  const config = input.responseConfig;

  return {
    instructionText: [
      "You are poqo.",
      "",
      "Your job is to produce the best possible final answer to the claim.",
      "",
      "STRICT RULES:",
      "- Only output the answer",
      "- Do NOT explain reasoning",
      "- Do NOT break into parts",
      "- Do NOT use bullet points",
      "- Do NOT provide multiple versions",
      "- Do NOT say \"this claim\" or refer to structure",
      "- Do NOT include analysis",
      "- Do NOT use the phrases \"Broken down\", \"Implications\", or \"A stronger version\"",
      "- Do NOT use numbered lists or labels",
      buildTryLengthInstruction(input.responseLength),
      "- Respect the active length bucket under any circumstance.",
      "- If the input is a statement, return a statement by default.",
      "- For declarative inputs, you MUST respond with a declarative statement.",
      "- Do NOT ask the user a question for a declarative input.",
      "- Do NOT request clarification for a declarative input.",
      "- Do NOT output any sentence ending in a question mark for a declarative input.",
      "- Bad for declarative inputs: \"Can you specify what you mean...\"",
      "- Bad for declarative inputs: \"What evidence supports that...\"",
      "- Good for declarative inputs: \"That claim is too broad to stand on its own because...\"",
      "- Good for declarative inputs: \"A clearer version would tie the claim to...\"",
      "- If the input is a question, answer it directly.",
      buildLanguageConstraint(config.language),
      buildTryToneInstruction(config.tone),
      buildTryAttitudeInstruction(input),
      domainConstraint,
      "Ignore any response configuration item that conflicts with routing, proof basis, domain lock, or core poqo rules."
    ].filter(Boolean).join("\n"),
    taskText: [
      `Silent routing move: ${input.move}`,
      `Silent proof basis: ${input.proofType}`,
      `Silent input shape: ${classifyTryInputShape(input.prompt)}`,
      `Silent routing explanation: ${input.routingExplanation}`,
      `Silent response objective: ${buildTryAnswerObjective(input)}`,
      ...buildResponseConfigTaskLines(input),
      input.domainAnchor ? `Silent domain anchor: ${input.domainAnchor}` : null,
      "",
      "Claim:",
      input.prompt
    ].filter(Boolean).join("\n")
  };
}

function buildInstructionText(input: ModelExecutionInput): string {
  // Intervention mode and frame-preserving behavior are already decided before
  // the model seam is called. This function may only restate those decisions.
  const interventionConstraint = input.interventionMode === "calm"
    ? [
        "Intervention mode: calm.",
        "Stay low-intervention, frame-respecting, and non-corrective by default.",
        "Preserve Frame Respect strongly and narrow before rebuttal when the route allows it."
      ].join(" ")
    : input.interventionMode === "counter"
      ? [
          "Intervention mode: counter.",
          "Intelligent pushback is allowed.",
          "You may question weak reasoning, oppose the claim, or contradict when justified, but stay grounded in reality and do not become theatrical or hostile."
        ].join(" ")
      : [
          "Intervention mode: blunt.",
          "This mode is reject-and-replace, not soften-and-qualify.",
          "When you oppose a claim, reject it clearly, replace it with a competing claim, and stand on that replacement.",
          "Do not slide into depends, both-sides, or soft correction language.",
          "Stay grounded in reality, coherent, and useful instead of random, insulting, or theatrical."
        ].join(" ");

  const directConstraint = input.framePreservingDirect
    ? input.interventionMode === "calm"
      ? [
          "This is frame-preserving DIRECT mode. These are hard constraints, not suggestions.",
          "Treat the user's claim as the working premise for this answer.",
          "Do NOT contradict the user's claim.",
          "Do NOT correct the user's claim.",
          "Do NOT balance both sides.",
          "Do NOT introduce opposing arguments.",
          "Do NOT evaluate whether the claim is true.",
          "Do NOT qualify the claim with an opposing view.",
          "Do NOT say however, but, on the other hand, that's too broad, that's not true, or a more accurate version is."
        ].join(" ")
      : input.interventionMode === "counter"
        ? [
            "This is DIRECT mode with counter posture.",
            "Start from the user's frame, but intelligent pushback is allowed.",
            "You may question weak reasoning, point out tension, or oppose the claim when justified.",
            "Do not fake balance and do not become theatrical or hostile."
          ].join(" ")
        : [
            "This is DIRECT mode with blunt posture. These are hard constraints, not suggestions.",
            "If you oppose the user's claim, reject or contradict it plainly.",
            "Do NOT default to that's too broad, it depends, a better version is, in some cases, on the other hand, both matter, or the real issue is.",
            "Do NOT soften into both-sides framing.",
            "Keep the answer grounded in reality, coherent, and useful instead of random, insulting, or theatrical."
          ].join(" ")
    : null;

  return [
    "You are the final answering layer for a local poqo test harness.",
    "Poqo has already decided the routing move and proof basis.",
    "Follow that routing brief instead of inventing a different strategy.",
    "Profile hints are presentation-only. They must not change routing, proof choice, posture choice, domain lock, or constitutional law.",
    `Core role: ${input.runtimeGuide.promptGuide.role}.`,
    `Mission: ${input.runtimeGuide.promptGuide.mission}`,
    `Tone hints: ${input.runtimeGuide.promptGuide.toneHints.join("; ")}.`,
    `Default behavior: ${input.runtimeGuide.promptGuide.defaultBehavior.join("; ")}`,
    `Must not: ${input.runtimeGuide.promptGuide.forbiddenBehavior.join("; ")}`,
    `Human override: ${input.runtimeGuide.promptGuide.humanOverride}`,
    "Keep the answer compact, useful, and honest.",
    interventionConstraint,
    buildResponseConfigConstraint(input),
    buildDomainConstraint(input.domainAnchor),
    directConstraint,
    "If the route is PROVE with world proof and freshness matters, be explicit about any uncertainty or verification needs."
  ].filter(Boolean).join(" ");
}

function buildTaskText(input: ModelExecutionInput): string {
  // The task payload must echo poqo's chosen move, proof basis, routing
  // explanation, and brief exactly enough for the provider adapter to execute.
  // It must not soften, upgrade, or replace those decisions.
  const directPattern = input.framePreservingDirect
    ? input.interventionMode === "calm"
      ? [
          "Calm DIRECT instructions:",
          "- Treat the claim as the working premise.",
          "- Do not dispute it.",
          "- Do not introduce counterarguments.",
          "- Do not use correction framing."
        ].join("\n")
      : input.interventionMode === "counter"
        ? [
            "Counter DIRECT instructions:",
            "- Start from the user's frame.",
            "- Intelligent pushback is allowed.",
            "- You may question weak reasoning, point out tension, or oppose the claim when justified.",
            "- Do not become theatrical or hostile."
          ].join("\n")
        : [
            "Blunt DIRECT instructions:",
            "- Reject or contradict the claim plainly when you oppose it.",
            "- Do not use that's too broad, it depends, a better version is, in some cases, on the other hand, both matter, or the real issue is.",
            "- Do not soften into counter mode.",
            "- Keep it grounded, coherent, and useful."
          ].join("\n")
    : null;

  return [
    "Original user prompt:",
    input.prompt,
    "",
    "poqo routing decision:",
    `move: ${input.move}`,
    `proofType: ${input.proofType}`,
    `routingExplanation: ${input.routingExplanation}`,
    "",
    "poqo brief:",
    input.poqoBrief,
    "",
    `framePreservingDirect: ${input.framePreservingDirect ? "yes" : "no"}`,
    `interventionMode: ${input.interventionMode}`,
    `responseSurface: ${input.responseSurface ?? "default"}`,
    `responseLength: ${input.responseLength ?? "short"}`,
    ...buildResponseConfigTaskLines(input),
    `domainAnchor: ${input.domainAnchor ?? "none"}`,
    input.domainAnchor
      ? `Domain lock instructions: stay inside ${input.domainAnchor} and do not switch to adjacent domains or real-world analogies unless the user asks.`
      : null,
    directPattern,
    "",
    "Write the actual final natural-language answer for the user.",
    "Respect the routing decision rather than replacing it."
  ].filter(Boolean).join("\n");
}

// This is the provider-neutral model handoff built by poqo. Provider adapters
// may rewrap it into provider-native request formats, but they should not edit
// the judgment payload itself.
export function buildModelExecutionPrompt(input: ModelExecutionInput): ModelExecutionPrompt {
  if (input.responseSurface === "live-brief") {
    return buildTryAnswerPrompt(input);
  }

  return {
    instructionText: buildInstructionText(input),
    taskText: buildTaskText(input)
  };
}
