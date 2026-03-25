# poqo Blind Judgment Report

## What The Blind Set Tests

The blind set tests whether poqo still makes the right next move when prompts sound like real users instead of evaluators. The target is not trick detection. The target is judgment under everyday messiness: vague phrasing, casual tension, partial context, and decision pressure.

## How It Differs From v1 And Stress

Compared with `v1`:

- the prompts sound less tidy and less evaluator-shaped
- the ambiguity is more natural and less explicitly signposted
- more prompts sit near the edge between `DIRECT` and `NARROW`

Compared with `stress`:

- the prompts are less adversarial in wording
- the failure modes are product-realistic rather than obviously synthetic
- more prompts test whether poqo creates forward motion under uncertainty

## Measured Results

blind set:

- total prompts: 25
- move matches: 25/25
- proof matches: 25/25
- forward-motion passes: 25/25
- stalls: 0
- over-narrow cases: 0
- over-proof cases: 0
- move accuracy: 100.0%
- proof accuracy: 100.0%

combined with existing sets:

- total prompts: 85
- move matches: 85/85
- proof matches: 85/85
- forward-motion passes: 85/85
- stalls: 0
- over-narrow cases: 0
- over-proof cases: 0
- move accuracy: 100.0%
- proof accuracy: 100.0%

## Patterns In Failures

No blind-set failures remain in the current pass.

During hardening, the blind prompts exposed three realism-driven weaknesses:

- chat-anchored proof requests that used softer phrasing like "locked in" were initially under-detected
- polish-versus-time tension in casual wording was initially treated as answer-ready instead of a hidden conflict
- React-vs-Svelte local-tool phrasing initially looked more answer-ready than it really was

These were fixed by tightening chat-context detection, adding a narrow scope-conflict pattern for polish versus week-level effort, and making local React-vs-Svelte phrasing still count as a missing decision-rule case.

## Examples Of Good Forward Motion

- a `NARROW` response that gives branch answers before asking the smallest next question
- a `PROVE` response that clearly anchors the answer to prior chat constraints instead of escalating to world proof
- a `DIRECT` response that reduces the choice to the smallest practical next move

## Examples Of Stalls Or Over-Narrowing

No current stall or over-narrow cases were flagged by the blind evaluation.

The blind scoring would count the following as regressions:

- generic clarification without any partial answer
- asking for more detail when the prompt already supports a practical recommendation
- invoking proof framing when the answer is a local tradeoff that can be answered directly

## Next Recommended Hardening Steps

- add a few blind prompts where users contradict themselves softly rather than explicitly
- add a small snapshot test layer for blind routing explanations so they stay sharp over time
- add a couple of blind prompts where the right move is `DIRECT` but the response still needs a stronger concrete recommendation than today's template provides
