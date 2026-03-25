import { evaluateAllPromptSets, evaluatePromptSet } from "./evaluator.js";
function formatPercent(value) {
    return String((value * 100).toFixed(1)) + "%";
}
function failureReasons(result) {
    const reasons = [];
    if (!result.moveMatch) {
        reasons.push("move mismatch");
    }
    if (!result.proofMatch) {
        reasons.push("proof mismatch");
    }
    if (!result.quality.forwardMotion) {
        reasons.push("no forward motion");
    }
    if (result.quality.stalled) {
        reasons.push("stalled");
    }
    if (result.quality.overNarrowed) {
        reasons.push("over-narrowed");
    }
    if (result.quality.overProved) {
        reasons.push("over-proved");
    }
    if (result.profileDrift) {
        reasons.push("profile drift");
    }
    return reasons;
}
function printReport(report) {
    const failures = report.results.filter((result) => failureReasons(result).length > 0);
    console.log("benchmark: " + report.benchmarkName + " (" + report.benchmarkId + ")");
    console.log("source: " + report.benchmarkFilePath);
    console.log("frozen: " + (report.frozen ? "yes" : "no"));
    console.log("total prompts: " + report.summary.promptTotal);
    console.log("total runs: " + report.summary.totalRuns);
    console.log("move matches: " + report.summary.moveMatches + "/" + report.summary.totalRuns);
    console.log("proof matches: " + report.summary.proofMatches + "/" + report.summary.totalRuns);
    console.log("forward-motion passes: " + report.summary.forwardMotionPasses + "/" + report.summary.totalRuns);
    console.log("stalls: " + report.summary.stalls);
    console.log("over-narrow cases: " + report.summary.overNarrowCases);
    console.log("over-proof cases: " + report.summary.overProofCases);
    console.log("profile drift cases: " + report.summary.profileDriftCases);
    console.log("move accuracy: " + formatPercent(report.summary.moveAccuracy));
    console.log("proof accuracy: " + formatPercent(report.summary.proofAccuracy));
    if (failures.length === 0) {
        console.log("all prompt labels matched");
        return;
    }
    console.log("");
    console.log("failures");
    for (const failure of failures) {
        const promptLabel = failure.profileId
            ? failure.promptCase.id + "/" + failure.profileId
            : failure.promptCase.id;
        console.log("- " +
            promptLabel +
            ": " +
            failureReasons(failure).join(", ") +
            " | expected " +
            failure.promptCase.expectedMove +
            "/" +
            failure.promptCase.expectedProof +
            ", got " +
            failure.actualMove +
            "/" +
            failure.actualProof);
        console.log("  why: " + failure.promptCase.why);
        console.log("  notes: " + failure.promptCase.notes);
        console.log("  route: " + failure.routingExplanation);
        if (failure.driftReason) {
            console.log("  drift: " + failure.driftReason);
        }
        console.log("  quality: " + failure.quality.notes.join(" "));
    }
}
async function main() {
    const mode = (process.argv[2] ?? "v1");
    if (mode === "all") {
        const combined = await evaluateAllPromptSets();
        for (const report of combined.reports) {
            printReport(report);
            console.log("");
        }
        console.log("combined");
        console.log("total prompts: " + combined.summary.promptTotal);
        console.log("total runs: " + combined.summary.totalRuns);
        console.log("move matches: " + combined.summary.moveMatches + "/" + combined.summary.totalRuns);
        console.log("proof matches: " + combined.summary.proofMatches + "/" + combined.summary.totalRuns);
        console.log("forward-motion passes: " + combined.summary.forwardMotionPasses + "/" + combined.summary.totalRuns);
        console.log("stalls: " + combined.summary.stalls);
        console.log("over-narrow cases: " + combined.summary.overNarrowCases);
        console.log("over-proof cases: " + combined.summary.overProofCases);
        console.log("profile drift cases: " + combined.summary.profileDriftCases);
        console.log("move accuracy: " + formatPercent(combined.summary.moveAccuracy));
        console.log("proof accuracy: " + formatPercent(combined.summary.proofAccuracy));
        return;
    }
    const label = mode === "stress"
        ? "stress"
        : mode === "blind"
            ? "blind"
            : mode === "redteam"
                ? "redteam"
                : mode === "variance"
                    ? "variance"
                    : "v1";
    const report = await evaluatePromptSet(label);
    printReport(report);
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
