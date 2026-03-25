function isFramePreservingDirectAnalysis(analysis) {
    return (!analysis.signals.directQuestionReady &&
        analysis.utteranceType !== "greeting" &&
        analysis.utteranceType !== "observation" &&
        analysis.utteranceType !== "emotional_reaction" &&
        analysis.utteranceType !== "factual_request" &&
        analysis.utteranceType !== "decision_request" &&
        analysis.utteranceType !== "proof_request" &&
        !analysis.signals.answerableSubjectiveQuestion &&
        !analysis.signals.violenceRisk &&
        !analysis.signals.priorityDecisionWithoutContext &&
        !analysis.signals.vagueConcernReaction);
}
export function isFramePreservingDirect(analysis, move) {
    return move === "DIRECT" && isFramePreservingDirectAnalysis(analysis);
}
function pickTopic(input) {
    return input
        .replace(/^(please|can you|could you|would you|tell me|give me|write|draft|explain|show me)\s+/i, "")
        .replace(/[?.!]+$/, "")
        .trim();
}
function chooseNames(topic) {
    const words = topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((word) => word.length > 2);
    const pool = Array.from(new Set(["Poqo", "Scope", "Basis", "Next", "Signal", "Local", "Plain", ...words.map((word) => word[0].toUpperCase() + word.slice(1))]));
    return [0, 1, 2].map((index) => `${pool[index]}${pool[index + 1] ?? ""}`);
}
function directCore(analysis) {
    const input = analysis.normalizedInput;
    const topic = pickTopic(input);
    if (analysis.signals.violenceRisk) {
        return [
            "I can't help with hurting people or backing violence as the answer.",
            "Step back from acting on this right now and move toward a non-violent next step.",
            "If there is immediate danger, contact emergency services now or get help from someone nearby you trust."
        ].join("\n");
    }
    if (analysis.signals.answerableSubjectiveQuestion) {
        if (/\btoo hard\b/i.test(input)) {
            return "Maybe. If the game stops feeling fun, lower the difficulty or take a break. A good challenge should feel tough, not miserable.";
        }
        return `Sometimes, yes. ${topic[0]?.toUpperCase() ?? "It"}${topic.slice(1)} can feel scary or creepy to some people, and okay to others. If it feels too intense, take a break or change the setting.`;
    }
    if (analysis.signals.personallyScopedEvaluation) {
        return "Treat the user's experience as the working premise. Acknowledge it naturally, do not contradict or rebalance it, and invite more detail only if that would help.";
    }
    if (analysis.signals.nonActionableRemark) {
        return "Handle the remark briefly without escalating it. Do not correct it, do not rebalance it, do not introduce an opposing view, and do not ask a weird follow-up question. Redirect or set a respectful boundary only if needed.";
    }
    if (analysis.utteranceType === "greeting") {
        return "A short greeting is enough here. Acknowledge warmly and leave room for the next turn.";
    }
    if (analysis.utteranceType === "observation") {
        return "A light acknowledgment is enough here. Mirror the observation briefly and keep it natural.";
    }
    if (analysis.utteranceType === "emotional_reaction") {
        return "A brief acknowledgment is enough here. Mirror the feeling lightly without forcing a question.";
    }
    if (isFramePreservingDirectAnalysis(analysis)) {
        return "Treat the user's claim as the working premise. Do not contradict it, do not correct it, do not balance both sides, and do not replace it with a safer version. Restate or sharpen the claim, break it into parts, expand implications, or suggest stronger wording without disputing the premise.";
    }
    if (/\bname|names\b/i.test(input)) {
        const names = chooseNames(topic);
        return names.map((name) => `- ${name}`).join("\n");
    }
    if (/\bwhat is\b|\bdefinition\b|\bdefine\b/i.test(input)) {
        if (/constitution-driven engine/i.test(input)) {
            return "A constitution-driven engine is a small system whose judgments are shaped by an explicit operating constitution instead of ad hoc improvisation.";
        }
        return `${topic[0]?.toUpperCase() ?? "It"}${topic.slice(1)} is a focused system with a clear job, explicit rules, and a small surface area.`;
    }
    if (/\brisk|risks|reasons|why\b/i.test(input)) {
        return [
            "- It slows learning by increasing the surface area too early.",
            "- It adds moving parts before the core judgment loop is working."
        ].join("\n");
    }
    if (/\b(plain html|html)\b/i.test(input) && /\breact\b/i.test(input) && /\blocal\b/i.test(input)) {
        return "Use plain HTML if this is a one-page local tool. Add React only if the interface needs richer client-side state than a simple page can hold cleanly.";
    }
    if (/\b(database|sqlite)\b/i.test(input) && /\bconfig file\b/i.test(input)) {
        return "No. A single local config file is the smaller fit. Add SQLite only when you need structured queries or concurrent writes.";
    }
    if (/\bchecklist|steps|plan|roadmap|launch\b/i.test(input)) {
        return [
            "1. Define the one outcome this version must prove.",
            "2. Cut every dependency that does not directly support that outcome.",
            "3. Run the smallest local loop, inspect it, and revise from evidence."
        ].join("\n");
    }
    if (/\bshould I\b|\bshould we\b/i.test(input)) {
        return "Yes, if the choice reduces scope and improves the quality of the next decision. If it adds drag without new evidence, skip it.";
    }
    if (/\breadme intro\b/i.test(input)) {
        return "poqo is a constitution-driven judgment engine that decides the right next move, shows its basis when needed, and stays intentionally small.";
    }
    return `Smallest useful answer: ${topic}. Start with one clear outcome, keep the scope tight, and add detail only after the first loop works.`;
}
function inferMissingVariable(analysis) {
    const input = analysis.normalizedInput;
    if (analysis.signals.priorityDecisionWithoutContext) {
        return "the feature, your product stage, and what it unlocks";
    }
    if (analysis.signals.compareWithoutCriteria || analysis.signals.choiceWithoutCriteria) {
        return "the decision rule that matters most";
    }
    if (analysis.signals.stackDecisionWithoutCriteria || /\b(stack|architecture|framework|library)\b/i.test(input)) {
        return "the main tradeoff, like speed to ship versus flexibility";
    }
    if (/\b(launch|go to market|campaign|pricing|charge|sell)\b/i.test(input)) {
        return "audience size and buying context";
    }
    if (/\b(ui|screen|design|onboarding|home screen|menu)\b/i.test(input)) {
        return "user type and the main task";
    }
    if (/\b(docs|readme|faq|copy|rewrite|summarize)\b/i.test(input)) {
        return "the source material or the target audience";
    }
    return "the audience, output, or main constraint";
}
function branchHint(analysis) {
    const input = analysis.normalizedInput;
    if (analysis.signals.priorityDecisionWithoutContext) {
        return [
            "If it drives core user value, learning, or risk reduction, it may belong first.",
            "If it is mostly polish or optional surface area, it likely comes later."
        ];
    }
    if (/\breact\b.*\bsvelte\b|\bsvelte\b.*\breact\b/i.test(input)) {
        return [
            "If speed of shipping matters most, pick the option your team already knows.",
            "If you care more about a lighter compiled UI, lean Svelte."
        ];
    }
    if (/\b(sqlite|database|json files?|file storage|files?)\b/i.test(input)) {
        return [
            "If one operator and simple local state is enough, use a file.",
            "If you need relational queries or concurrent writes, use SQLite."
        ];
    }
    if (/\b(stack|architecture|framework)\b/i.test(input)) {
        return [
            "If this is a single local demo, keep it to Node, TypeScript, and a tiny web surface.",
            "If the UI needs richer client state, add only a minimal frontend layer."
        ];
    }
    if (/\b(launch|campaign|go to market)\b/i.test(input)) {
        return [
            "If the goal is a small pilot, use direct outreach.",
            "If the goal is broad awareness, choose one channel before planning the rest."
        ];
    }
    if (/\b(pricing|charge|monthly|annual)\b/i.test(input)) {
        return [
            "If this is a low-risk pilot, monthly is easier to say yes to.",
            "If procurement wants predictability, annual is cleaner."
        ];
    }
    if (/\b(ui|screen|design|onboarding|home screen|menu)\b/i.test(input)) {
        return [
            "If the user is young or new, favor large obvious actions.",
            "If the user is frequent and expert, denser controls can be acceptable."
        ];
    }
    return [
        "If you want the smallest useful answer now, optimize for the tightest constraint first.",
        "If you want a fuller answer, anchor it to one concrete decision rule."
    ];
}
function smallestNextQuestion(analysis) {
    if (analysis.signals.priorityDecisionWithoutContext) {
        return "what feature are you deciding about?";
    }
    return `what is ${inferMissingVariable(analysis)}?`;
}
function narrowCore(analysis) {
    if (analysis.signals.materialReferencedButMissing) {
        return [
            "Part of this is answerable now, but the referenced material is missing.",
            "If you paste it, I can answer against the actual text.",
            "If not, I can still give a principle-only answer without pretending I saw the material."
        ].join("\n");
    }
    if (analysis.signals.priorityDecisionWithoutContext) {
        const [branchA, branchB] = branchHint(analysis);
        return [
            "That depends on the feature, your product stage, and what it unlocks.",
            branchA,
            branchB,
            "Smallest next question: what feature are you deciding about?"
        ].join("\n");
    }
    if (analysis.signals.vagueConcernReaction) {
        return [
            "Something seems off here, but the useful next move is to name the part that feels wrong.",
            "Keep it narrow and stay with the concern instead of arguing about it.",
            "Smallest next question: what feels off about it?"
        ].join("\n");
    }
    if (analysis.signals.contestedFramingClaim) {
        return [
            "This bundles multiple contested framing claims, so the useful next move is to align the frame before debating it.",
            "Keep the next turn on definitions or classification rules instead of immediate rebuttal.",
            "Smallest next question: what definition of left and right are you using here?"
        ].join("\n");
    }
    if (analysis.signals.coherentCritiqueBundle) {
        return [
            "This is already a coherent critique, so the useful next move is to surface what should change.",
            "Stay with the direction of change instead of re-arguing each complaint.",
            "Smallest next question: what would you want different?"
        ].join("\n");
    }
    if (analysis.signals.strongUnsupportedStance) {
        return [
            "That is a strong claim, so the useful next move is to pin down what it rests on.",
            "If you mean a specific event, decision, or outcome, name that first.",
            "Smallest next question: what are you basing that on?"
        ].join("\n");
    }
    if (analysis.signals.compareWithoutCriteria ||
        analysis.signals.stackDecisionWithoutCriteria ||
        analysis.signals.choiceWithoutCriteria) {
        const missingVariable = inferMissingVariable(analysis);
        const [branchA, branchB] = branchHint(analysis);
        return [
            `The likely answer depends on ${missingVariable}.`,
            branchA,
            branchB,
            `Smallest next question: which matters more, ${missingVariable}?`
        ].join("\n");
    }
    if (analysis.signals.scopeConflict) {
        return [
            "Two constraints are pulling against each other.",
            "Keep the hard constraint and relax the cosmetic one if you want the smallest useful answer.",
            "Smallest next question: which constraint is truly non-negotiable?"
        ].join("\n");
    }
    if (analysis.signals.broad) {
        const missingVariable = inferMissingVariable(analysis);
        const [branchA, branchB] = branchHint(analysis);
        return [
            "This is broad, so the right move is to narrow inside the answer instead of stalling.",
            branchA,
            branchB,
            `Smallest next question: ${smallestNextQuestion(analysis)}`
        ].join("\n");
    }
    const missingVariable = inferMissingVariable(analysis);
    const [branchA, branchB] = branchHint(analysis);
    return [
        `This needs one tighter variable before a single answer will be reliable: ${missingVariable}.`,
        branchA,
        branchB,
        `Smallest next question: ${smallestNextQuestion(analysis)}`
    ].join("\n");
}
function inferFromDocument(analysis) {
    const text = analysis.materials[0] ?? "the provided text";
    const afterMatch = analysis.normalizedInput.match(/after\s+(\d+)\s+days/i);
    const withinMatch = text.match(/within\s+(\d+)\s+days/i);
    const noticeMatch = text.match(/(\d+)\s+days?\s+written notice/i);
    if (afterMatch && withinMatch) {
        const askedDays = Number(afterMatch[1]);
        const allowedDays = Number(withinMatch[1]);
        return askedDays <= allowedDays
            ? `Yes. The excerpt allows refunds within ${allowedDays} days, so ${askedDays} days is still inside the allowed window.`
            : `No. The excerpt allows refunds within ${allowedDays} days, so ${askedDays} days falls outside that window.`;
    }
    if (noticeMatch && /\btermination\b/i.test(analysis.normalizedInput)) {
        return `Termination requires ${noticeMatch[1]} days of written notice.`;
    }
    return "Based on the provided text, the answer should follow the quoted material rather than guesswork.";
}
function proveCore(analysis, proof) {
    if (proof.type === "document") {
        return [
            inferFromDocument(analysis),
            `Basis: ${proof.basis.map((item) => `"${item}"`).join("; ")}`
        ].join("\n");
    }
    if (proof.type === "chat") {
        const basis = proof.basis.length > 0 ? proof.basis.join("; ") : "prior chat constraints";
        return [
            "This answer should stand on the active constraints rather than a generic best practice.",
            "Working answer: choose the option that preserves the smallest local setup and fits the stated scope.",
            `Basis: ${basis}`
        ].join("\n");
    }
    if (proof.type === "world") {
        return [
            "This depends on outside facts that can change, so the answer should be treated as grounded only after current verification.",
            "Working answer: use the current fact set, not memory or vibes, before acting on the decision.",
            `Basis: ${proof.basis.join("; ")}`
        ].join("\n");
    }
    return directCore(analysis);
}
function applyTermSubstitutions(body, runtimeGuide) {
    // Profile substitutions are presentation-only. They run after routing, proof,
    // and core response selection, and must never change move semantics.
    return (runtimeGuide.profile.termSubstitutions ?? []).reduce((current, substitution) => {
        return current.replace(new RegExp(substitution.from, "gi"), substitution.to);
    }, body);
}
function labelForMove(runtimeGuide, move) {
    // Labels are profile-facing presentation only. The chosen move is already
    // fixed before this function runs.
    return move === "DIRECT"
        ? runtimeGuide.profile.responseLabels.direct
        : move === "NARROW"
            ? runtimeGuide.profile.responseLabels.narrow
            : runtimeGuide.profile.responseLabels.prove;
}
function applyProfilePresentation(runtimeGuide, move, body) {
    // Profiles may relabel and lightly restyle the final surface text only.
    // They must not change routing, proof basis, posture, or domain lock.
    return `${labelForMove(runtimeGuide, move)}\n${applyTermSubstitutions(body, runtimeGuide)}`;
}
export function buildResponse(runtimeGuide, analysis, move, proof) {
    const constraintLine = analysis.constraints.length > 0 && move !== "PROVE"
        ? `\nConstraints I am holding: ${analysis.constraints.join("; ")}`
        : "";
    let body = "";
    if (move === "DIRECT") {
        body = directCore(analysis);
    }
    else if (move === "NARROW") {
        body = narrowCore(analysis);
    }
    else {
        body = proveCore(analysis, proof);
    }
    return applyProfilePresentation(runtimeGuide, move, `${body}${constraintLine}`);
}
export function buildPoqoResult(runtimeGuide, analysis, move, proof, routingExplanation) {
    return {
        profileId: runtimeGuide.profile.id,
        move,
        proofType: proof.type,
        routingExplanation,
        finalResponse: buildResponse(runtimeGuide, analysis, move, proof),
        analysis,
        proof
    };
}
