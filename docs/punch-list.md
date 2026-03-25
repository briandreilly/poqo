# Punch List

This is poqo's canonical next-phase operating checklist.

## Recommended Reading Order

1. `README.md`
2. `docs/poqo-one-pager.md`
3. `docs/constitution-spec.md`
4. `docs/operating-spec.md`
5. `docs/benchmark-index.md`
6. `docs/benchmark-spine-report.md`
7. `docs/punch-list.md`

## 1. Core Stability

- [ ] P1 / now: Freeze the core move definitions so `DIRECT`, `NARROW`, and `PROVE` do not drift in meaning across docs, evaluator labels, or future patches.
- [ ] P1 / now: Freeze the "smallest sufficient move" rule as a core operating rule and treat changes to that rule as benchmark-affecting.
- [ ] P1 / now: Freeze the split between core-constitution behavior and operating-spec behavior so style does not quietly absorb routing logic.
- [ ] P1 / now: Freeze the proof model as `none`, `chat`, `document`, and `world` unless a benchmark-backed reason exists to change it.
- [ ] P1 / now: Confirm the current engine shape remains canonical: core constitution loader and profile loader, interpreter, router, proof selector, response builder, evaluator, demo.

## 2. Benchmark Spine Protection

- [ ] P1 / now: Verify every benchmark pack stays listed in `docs/benchmark-index.md` and in `src/evaluator/benchmark-manifest.ts`.
- [ ] P1 / now: Verify frozen status stays explicit for `v1`, `stress`, `blind`, `redteam`, and `variance`.
- [ ] P1 / now: Verify first-run failures remain documented in historical reports instead of being edited away.
- [ ] P1 / now: Keep the benchmark manifest canonical and avoid duplicating metadata in multiple code paths.
- [ ] P1 / watch: Verify evaluator output stays readable by benchmark section and does not collapse into one undifferentiated summary.

## 3. Evaluator Integrity

- [ ] P1 / now: Confirm prompt labels still match the routing behavior they claim to test before making any routing changes.
- [ ] P1 / now: Confirm forward-motion scoring still catches generic stalls and still rewards practical narrowing.
- [ ] P1 / now: Confirm profile drift detection stays sound and remains easy to inspect by reading the evaluator code.
- [ ] P1 / now: Keep `npm run eval:all` readable enough that each benchmark can be judged independently.
- [ ] P2 / later: Define one small rule for adding future benchmark packs: freeze first, record failures, then add to the manifest and index.

## 4. Constitution Discipline

- [ ] P1 / now: Ensure profiles continue to affect style and response shape without corrupting routing judgment.
- [ ] P1 / now: Rerun the variance benchmark after any routing, interpreter, proof-selection, or response-behavior change.
- [ ] P1 / now: Treat core-constitution or profile edits that can influence ambiguity, proof, or tone-pressure handling as re-benchmarking events.
- [ ] P2 / watch: Keep profile drift visible in reports rather than assuming a stylistic change is harmless.
- [ ] P2 / watch: Resist adding profile-specific exceptions unless a benchmark-backed reason shows they are necessary.

## 5. Router And Interpreter Tightening

- [ ] P2 / now: Review recurring edge cases from blind, redteam, and variance history before making new heuristic changes.
- [ ] P2 / now: Identify false proof triggers, especially world-proof triggers caused by casual wording rather than real outside-fact dependence.
- [ ] P2 / now: Identify false narrowing triggers, especially missing-variable assumptions that should have stayed direct or prove-ready.
- [ ] P2 / later: Tighten implied constraints and hidden decision-variable handling only with small local fixes.
- [ ] P2 / watch: Keep router and interpreter fixes narrow enough that the benchmark history remains interpretable.

## 6. Response Quality Tightening

- [ ] P2 / now: Audit `NARROW` responses to make sure they create forward motion instead of asking generic clarification questions.
- [ ] P2 / now: Audit `DIRECT` responses for avoidable overconfidence, especially on emotionally loaded but answer-ready asks.
- [ ] P2 / now: Audit `PROVE` responses for proof overkill and keep the proof basis as small as possible.
- [ ] P2 / watch: Tighten routing explanations so they stay short, specific, and tied to readiness, ambiguity, or proof need.
- [ ] P2 / watch: Keep responses practical and compact rather than letting polish drift into verbosity.

## 7. Documentation Lock

- [ ] P2 / now: Treat `README.md`, `docs/poqo-one-pager.md`, `docs/constitution-spec.md`, and `docs/operating-spec.md` as core docs.
- [ ] P2 / now: Treat benchmark docs, benchmark reports, and the benchmark spine docs as the benchmark record.
- [ ] P2 / now: Treat hardening, blind, redteam, and variance reports as historical reports that should stay inspectable.
- [ ] P2 / later: Clean duplication only when it improves clarity; do not rewrite docs into a documentation project.
- [ ] P3 / watch: Keep the recommended reading order short and stable for future contributors.

## 8. Controlled Real-World Testing

- [ ] P3 / later: Define a small real-world prompt intake process with a narrow scope and a lightweight review loop.
- [ ] P3 / later: Keep real prompts separate from frozen benchmarks so field data does not silently become evaluator data.
- [ ] P3 / later: Record failures from real prompts before tuning against them.
- [ ] P3 / later: Avoid tuning to every isolated prompt unless it reveals a repeated benchmark-relevant weakness.
- [ ] P3 / later: Create a controlled real-input test pack only after enough repeated patterns justify it.

## 9. Change Control

- [ ] P1 / now: Define routing, interpreter, proof, and response-shaping edits as full benchmark rerun triggers.
- [ ] P1 / now: Define profile edits and profile-adjacent behavior changes as mandatory variance rerun triggers.
- [ ] P2 / now: Treat benchmark-pack edits, evaluator-scoring edits, and manifest changes as benchmark-affecting edits that require explicit recording.
- [ ] P2 / later: Keep a short note in the related report whenever a benchmark-impacting change is made.
- [ ] P2 / watch: Keep the process light but real; the goal is traceability, not ceremony.

## 10. Product Readiness Boundary

- [ ] P1 / now: Define one safe first use case as local judgment support for bounded builder/operator prompts.
- [ ] P1 / now: Define what poqo is ready for now: controlled local use, benchmark-backed routing evaluation, and profile-variance inspection.
- [ ] P1 / now: Define what is still too early: live fact workflows, broad external product claims, and unbounded real-world routing without intake discipline.
- [ ] P1 / now: Explicitly defer memory, retrieval, agent systems, feature sprawl, and product-surface expansion.
- [ ] P1 / watch: Preserve poqo as a primitive rather than letting stabilization work turn into sideways product growth.
