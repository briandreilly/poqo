# poqo Hardening Report

## What Was Added

- a formal v1 acceptance document at `docs/v1-acceptance.md`
- a 24-prompt adversarial stress set at `prompts/prompt-set-stress.json`
- evaluator support for `v1`, `stress`, and `all` modes

## What Changed

Routing changes:

- tightened explanation lines so they name the concrete reason for `DIRECT`, `NARROW`, or `PROVE`
- added stronger detection for missing decision variables in choice and stack questions
- preserved chat-proof routing for prompts that explicitly anchor the answer to prior chat context

Response changes:

- strengthened `NARROW` so it gives a partial answer when possible
- added branch-style narrowing for comparisons, stacks, pricing, launch, UI, and storage tradeoffs
- kept narrowing focused on the smallest useful next question instead of generic clarification

## Results

v1 set:

- total prompts: 36
- move matches: 36/36
- proof matches: 36/36
- move accuracy: 100.0%
- proof accuracy: 100.0%

stress set:

- total prompts: 24
- move matches: 24/24
- proof matches: 24/24
- move accuracy: 100.0%
- proof accuracy: 100.0%

combined:

- total prompts: 60
- move matches: 60/60
- proof matches: 60/60
- move accuracy: 100.0%
- proof accuracy: 100.0%

## Notable Failures

- No current evaluator failures remain.
- During hardening, one stress prompt initially routed a chat-anchored stack question to `NARROW`; this was fixed by preventing chat-anchored stack questions from being treated as missing-variable stack questions.

## Recommended Next Steps

- add a small response-quality review pass for `NARROW` outputs so acceptance covers not just move correctness but branch usefulness
- add a few stress prompts around multi-part prompts where one subpart is answerable and the other should narrow
- add lightweight snapshot tests for routing explanations so they stay specific as heuristics evolve
