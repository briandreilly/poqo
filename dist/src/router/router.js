function buildNarrowExplanation(analysis) {
    if (analysis.signals.materialReferencedButMissing) {
        return "NARROW because the referenced material is missing.";
    }
    if (analysis.signals.scopeConflict) {
        return "NARROW because two stated constraints conflict.";
    }
    if (analysis.signals.priorityDecisionWithoutContext) {
        return "NARROW because the priority decision is missing the decision frame.";
    }
    if (analysis.signals.vagueConcernReaction) {
        return "NARROW because the input signals a concern but does not yet name what feels wrong.";
    }
    if (analysis.signals.contestedFramingClaim) {
        return "NARROW because the statement combines multiple contested claims without a shared frame.";
    }
    if (analysis.signals.coherentCritiqueBundle) {
        return "NARROW because the critique is clear, but the next useful step is to surface what should change.";
    }
    if (analysis.signals.strongUnsupportedStance) {
        return "NARROW because the statement is a strong claim without enough basis to engage it well.";
    }
    if (analysis.signals.argumentLoadedStatement) {
        return "NARROW because the input is an argument-loaded statement, not a short direct-answer prompt.";
    }
    if (analysis.signals.compareWithoutCriteria ||
        analysis.signals.stackDecisionWithoutCriteria ||
        analysis.signals.choiceWithoutCriteria ||
        analysis.signals.missingKeyVariable) {
        return "NARROW because the key decision variable is missing.";
    }
    if (analysis.signals.broad) {
        return "NARROW because the request is still too broad.";
    }
    return "NARROW because the request is not answer-ready yet.";
}
function buildProveExplanation(analysis) {
    if (analysis.proofNeed.suggestedType === "document") {
        return "PROVE because the answer depends on provided text.";
    }
    if (analysis.proofNeed.suggestedType === "chat") {
        return "PROVE because the answer depends on stated constraints and supporting basis.";
    }
    if (analysis.proofNeed.suggestedType === "world") {
        return "PROVE because the answer depends on outside facts.";
    }
    return "PROVE because the answer needs visible support.";
}
function buildDirectExplanation(analysis) {
    if (analysis.signals.violenceRisk) {
        return "DIRECT because the prompt raises violence and needs a safe, de-escalating response.";
    }
    if (analysis.signals.answerableSubjectiveQuestion) {
        return "DIRECT because the question is simple and answer-ready.";
    }
    if (analysis.signals.directQuestionReady) {
        return "DIRECT because the question is short, specific, and answer-ready.";
    }
    if (analysis.signals.personallyScopedEvaluation) {
        return "DIRECT because the statement is scoped to personal experience and is complete enough to respond to.";
    }
    if (analysis.signals.nonActionableRemark) {
        return "DIRECT because the input is a non-actionable remark and is ready for a direct response.";
    }
    if (analysis.utteranceType === "greeting") {
        return "DIRECT because the input is a greeting and is ready for a response.";
    }
    if (analysis.utteranceType === "observation") {
        return "DIRECT because the input is a simple observation and is ready for a response.";
    }
    if (analysis.utteranceType === "emotional_reaction") {
        return "DIRECT because the input is a simple reaction and is ready for a response.";
    }
    if (analysis.utteranceType === "opinion_statement") {
        return "DIRECT because the input expresses a stance and is complete enough to respond to.";
    }
    if (analysis.constraints.length > 0) {
        return "DIRECT because the request is specific, constrained, and answer-ready.";
    }
    return "DIRECT because the request is specific and answer-ready.";
}
export function routeJudgment(analysis) {
    if (!analysis.readiness.ready) {
        const reason = analysis.readiness.reasons[0] ?? "The request is not ready for a single reliable answer.";
        return {
            move: "NARROW",
            reason,
            explanation: buildNarrowExplanation(analysis)
        };
    }
    if (analysis.proofNeed.required) {
        const reason = analysis.proofNeed.reasons[0] ?? "The answer needs grounding.";
        return {
            move: "PROVE",
            reason,
            explanation: buildProveExplanation(analysis)
        };
    }
    return {
        move: "DIRECT",
        reason: "The request is ready and does not need proof.",
        explanation: buildDirectExplanation(analysis)
    };
}
