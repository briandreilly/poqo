# Benchmark Index

Poqo's benchmark spine is the frozen set of prompt packs used to judge routing quality, proof discipline, forward motion, and profile stability.

## Spine

| Benchmark | File Path | Purpose | Frozen | What It Tests | Failure Means | Latest Known Result | Related Report |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1 Core Routing | `prompts/prompt-set-v1.json` | Baseline routing benchmark. | Yes | Core DIRECT, NARROW, and PROVE decisions. | Move mismatch, proof mismatch, or lost forward motion. | `36/36` move, `36/36` proof, `36/36` forward motion. | `docs/hardening-report.md` |
| Stress Routing | `prompts/prompt-set-stress.json` | Pressure-test weak routing edges. | Yes | Trick ambiguity, proof overkill, hidden variables, and partial narrowing. | Move mismatch, proof mismatch, or wasted narrowing/proof. | `24/24` move, `24/24` proof, `24/24` forward motion. | `docs/hardening-report.md` |
| Blind Judgment | `prompts/prompt-set-blind.json` | Test realism outside evaluator-shaped prompts. | Yes | Messier user phrasing, softer ambiguity, and forward motion quality. | Move mismatch, proof mismatch, stalls, over-narrowing, or over-proving. | `147/147` move, `147/147` proof, `147/147` forward motion. | `docs/blind-judgment-report.md` |
| Frozen Red-Team | `prompts/prompt-set-redteam.json` | Test harsher, less sympathetic prompts with frozen-benchmark discipline. | Yes | Mixed intent, hidden constraints, proof bait, and realism under pressure. | Move mismatch, proof mismatch, overreach, or benchmark drift. | `25/25` move, `25/25` proof, `25/25` forward motion. | `docs/redteam-benchmark-report.md` |
| Profile Variance | `prompts/prompt-set-profile-variance.json` | Test routing stability across profiles. | Yes | Stable moves, stable proof basis, forward motion, and profile drift. | Move mismatch, proof mismatch, lost forward motion, or profile drift. | `63/63` move, `63/63` proof, `63/63` forward motion, `0` drift. | `docs/profile-variance-report.md` |

## Canonical Metadata

The canonical benchmark metadata lives in `src/evaluator/benchmark-manifest.ts`.

That manifest is the small inspectable source for:

- benchmark id
- benchmark name
- prompt-set path
- frozen status
- short description
- profiles involved
- related report path
