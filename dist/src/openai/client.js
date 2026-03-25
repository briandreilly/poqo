const OPENAI_BASE_URL = "https://api.openai.com/v1/responses";
function extractOutputText(payload) {
    if (typeof payload.output_text === "string" && payload.output_text.trim()) {
        return payload.output_text.trim();
    }
    const text = (payload.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text" && typeof item.text === "string")
        .map((item) => item.text?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n");
    return text || "OpenAI returned no text output.";
}
function buildDomainConstraint(domainAnchor) {
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
function buildSystemText(input) {
    // The OpenAI handoff receives a distilled constitutional guide plus bounded
    // profile hints. It must never reconstruct routing or proof from profile data.
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
    const domainConstraint = buildDomainConstraint(input.domainAnchor);
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
        domainConstraint,
        directConstraint,
        "If the route is PROVE with world proof and freshness matters, be explicit about any uncertainty or verification needs."
    ].filter(Boolean).join(" ");
}
function buildUserText(input) {
    // Keep profile influence out of the user payload beyond presentation hints.
    // The answering layer should inherit the chosen move, not infer one from profile identity.
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
export function getDefaultOpenAIModel() {
    return process.env.OPENAI_MODEL ?? "gpt-5.4";
}
export function hasOpenAIKey() {
    return Boolean(process.env.OPENAI_API_KEY);
}
export async function runOpenAIHarnessPrompt(input) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set. Add it locally to use the local harness.");
    }
    const modelUsed = getDefaultOpenAIModel();
    const response = await fetch(OPENAI_BASE_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: modelUsed,
            input: [
                {
                    role: "system",
                    content: [{ type: "input_text", text: buildSystemText(input) }]
                },
                {
                    role: "user",
                    content: [{ type: "input_text", text: buildUserText(input) }]
                }
            ]
        })
    });
    const payload = (await response.json());
    if (!response.ok) {
        const message = payload.error?.message ?? `OpenAI request failed with status ${response.status}`;
        throw new Error(message);
    }
    return {
        modelUsed,
        responseText: extractOutputText(payload)
    };
}
