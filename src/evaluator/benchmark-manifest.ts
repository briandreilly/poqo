import type { BenchmarkId, BenchmarkMetadata } from "../types.js";

export const benchmarkOrder: BenchmarkId[] = ["v1", "stress", "blind", "redteam", "variance"];

export const benchmarkManifest: Record<BenchmarkId, BenchmarkMetadata> = {
  v1: {
    id: "v1",
    name: "V1 Core Routing",
    filePath: "prompts/prompt-set-v1.json",
    frozen: true,
    description: "Baseline routing benchmark for the core DIRECT, NARROW, and PROVE loop.",
    reportPath: "docs/hardening-report.md",
    profiles: ["default"]
  },
  stress: {
    id: "stress",
    name: "Stress Routing",
    filePath: "prompts/prompt-set-stress.json",
    frozen: true,
    description: "Adversarial routing cases that pressure ambiguity handling, proof restraint, and partial narrowing.",
    reportPath: "docs/hardening-report.md",
    profiles: ["default"]
  },
  blind: {
    id: "blind",
    name: "Blind Judgment",
    filePath: "prompts/prompt-set-blind.json",
    frozen: true,
    description: "Messier real-world phrasing that tests forward motion outside evaluator-shaped prompts.",
    reportPath: "docs/blind-judgment-report.md",
    profiles: ["default"]
  },
  redteam: {
    id: "redteam",
    name: "Frozen Red-Team",
    filePath: "prompts/prompt-set-redteam.json",
    frozen: true,
    description: "Harsher mixed-intent prompts that test overreach, over-proof, and benchmark discipline.",
    reportPath: "docs/redteam-benchmark-report.md",
    profiles: ["default"]
  },
  variance: {
    id: "variance",
    name: "Profile Variance",
    filePath: "prompts/prompt-set-profile-variance.json",
    frozen: true,
    description: "Cross-profile stability checks that separate presentation variation from routing drift.",
    reportPath: "docs/profile-variance-report.md",
    profiles: ["default", "founder", "kidsafe"]
  }
};
