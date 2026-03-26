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
  if (tone === "warm") {
    return "Response tone: warm. Keep the wording friendly and encouraging without changing the reasoning.";
  }

  if (tone === "direct") {
    return "Response tone: direct. Keep the wording concise and minimal without changing the reasoning.";
  }

  if (tone === "sharp") {
    return "Response tone: sharp. Keep the wording firm and low-patience without changing the reasoning or hardening the chosen attitude on your own.";
  }

  return "Response tone: neutral. Keep the wording balanced and professional.";
}

function buildLanguageConstraint(language: ModelExecutionInput["responseConfig"]["language"]): string {
  return language === "es" ? "Output language: answer in Spanish." : "Output language: answer in English.";
}

function buildResponseConfigConstraint(input: ModelExecutionInput): string {
  const config = input.responseConfig;

  const attitudeConstraint = config.attitude === "normal"
    ? "Response attitude: normal. Stay cooperative, clarifying, and low-friction."
    : config.attitude === "challenge"
      ? "Response attitude: challenge. Push for definition, test weak claims, and ask for support when needed."
      : "Response attitude: difficult. Reject weak framing earlier, redirect faster, and keep a low tolerance for weak claims.";

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

function buildLiveBriefConstraint(input: ModelExecutionInput): string | null {
  if (input.responseSurface !== "live-brief") {
    return null;
  }

  return [
    "This is the live /try surface.",
    "Output only three short parts labeled Judgment, Reason, and either Sharper version or Clarifying question.",
    "Keep the whole answer to about 3 to 6 short lines total.",
    "Do not output long breakdowns, essay-style implications, multiple rewrite options, or extended lists.",
    "Prefer one best rewrite over several alternatives.",
    "If the claim is too vague to sharpen responsibly, ask one clarifying question instead."
  ].join(" ");
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
          "Do NOT say however, but, on the other hand, that's too broad, that's not true, or a more accurate version is.",
          "Allowed moves: restate or sharpen the claim, break it into components, expand implications or consequences, suggest clearer or stronger wording, and identify assumptions without disputing them.",
          "Preferred output pattern: restate or sharpen the claim, break it into components, expand implications, then offer clearer or stronger wording."
        ].join(" ")
      : input.interventionMode === "counter"
        ? [
            "This is DIRECT mode with counter posture.",
            "Start from the user's frame, but intelligent pushback is allowed.",
            "You may question weak reasoning, point out tension, or oppose the claim when justified.",
            "Do not fake balance and do not become theatrical or hostile.",
            "Preferred output pattern: restate the claim, pressure the weak point, expand implications, then sharpen the wording."
          ].join(" ")
        : [
            "This is DIRECT mode with blunt posture. These are hard constraints, not suggestions.",
            "If you oppose the user's claim, the first sentence must reject or contradict it plainly.",
            "The next step must present the competing claim you are asserting instead.",
            "Then justify that replacement.",
            "Do NOT default to that's too broad, it depends, a better version is, in some cases, on the other hand, both matter, or the real issue is.",
            "Do NOT ask for sources or clarification unless the route is already NARROW.",
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
    buildLiveBriefConstraint(input),
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
          "- Do not use correction framing.",
          "- Output shape: restate or sharpen the claim; break it into components; expand implications; offer clearer or stronger wording."
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
            "- First sentence: reject or contradict the claim plainly.",
            "- Second move: replace it with the competing claim you actually stand on.",
            "- Then justify that replacement.",
            "- Do not use that's too broad, it depends, a better version is, in some cases, on the other hand, both matter, or the real issue is.",
            "- Do not soften into counter mode.",
            "- Do not ask for sources or clarification unless the route is already NARROW.",
            "- Keep it grounded, coherent, and useful."
          ].join("\n")
    : null;

  const liveBriefPattern = input.responseSurface === "live-brief"
    ? [
        "Live /try output shape:",
        "- Use exactly these labels: Judgment, Reason, and either Sharper version or Clarifying question.",
        "- Keep each part to one short sentence.",
        "- Keep the total output to about 3 to 6 short lines.",
        "- Do not add extra sections, long lists, or multiple rewrite options."
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
    ...buildResponseConfigTaskLines(input),
    `domainAnchor: ${input.domainAnchor ?? "none"}`,
    input.domainAnchor
      ? `Domain lock instructions: stay inside ${input.domainAnchor} and do not switch to adjacent domains or real-world analogies unless the user asks.`
      : null,
    liveBriefPattern,
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
  return {
    instructionText: buildInstructionText(input),
    taskText: buildTaskText(input)
  };
}
