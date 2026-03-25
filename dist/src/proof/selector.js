// Proof selection is profile-free by design. It operates only on interpreted
// request analysis so profiles cannot add hidden proof preferences.
function buildWorldBasis(input) {
    const basis = [];
    if (/\b(latest|current|today|version|lts)\b/i.test(input)) {
        basis.push("Current version or time-sensitive release information");
    }
    if (/\b(price|prices|budget|tablet)\b/i.test(input)) {
        basis.push("Current pricing or market availability");
    }
    if (/\b(coppa|law|legal|rules|requirements|app store|license|maintenance)\b/i.test(input)) {
        basis.push("Current policy, legal, license, or maintenance facts");
    }
    if (!basis.length) {
        basis.push("Outside facts beyond the current chat");
    }
    return basis.slice(0, 3);
}
export function selectProof(analysis) {
    const type = analysis.proofNeed.suggestedType;
    if (type === "document") {
        return {
            type,
            reason: "The answer should stand on provided text.",
            basis: analysis.materials.slice(0, 2)
        };
    }
    if (type === "chat") {
        return {
            type,
            reason: "The answer should stand on user constraints or prior chat context.",
            basis: analysis.constraints.length > 0 ? analysis.constraints.slice(0, 3) : ["Prior chat context referenced by the user"]
        };
    }
    if (type === "world") {
        return {
            type,
            reason: "The answer should stand on outside facts.",
            basis: buildWorldBasis(analysis.normalizedInput)
        };
    }
    return {
        type: "none",
        reason: "No material proof is required for the current move.",
        basis: []
    };
}
