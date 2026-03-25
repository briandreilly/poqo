# Benchmark Spine Report

## What Benchmark Spine Means

In poqo, benchmark spine means the small permanent set of frozen benchmark packs that anchor routing credibility over time.

The spine is the benchmark layer that future tuning must pass without casual label drift or silent prompt edits.

## Frozen Sets

The current frozen spine is:

- `v1`
- `stress`
- `blind`
- `redteam`
- `variance`

## Why Frozen History Matters

Frozen history matters because poqo claims judgment quality, not just prompt fit.

If failures are silently edited away, the benchmark stops proving anything. First-run misses and final reruns need to stay inspectable side by side.

## Covered Benchmark Types

The current spine covers:

- baseline routing correctness
- stress ambiguity and proof restraint
- blind real-world phrasing
- red-team realism under harsher prompts
- profile variance and drift control

## Risks Still Not Covered

The current spine still does not cover every risk.

Important uncovered areas:

- prompts that mix chat proof and document proof in one request
- prompts that imply world facts without naming them clearly
- prompts where rewrite requests and routing decisions are blended together
- prompts where partial narrowing should start with a stronger concrete recommendation
- prompts where profiles might vary safely in response shape but still hide weak forward motion

## Latest Headline Results

Latest known benchmark headline results:

- `v1`: `36/36` move, `36/36` proof, `36/36` forward motion
- `stress`: `24/24` move, `24/24` proof, `24/24` forward motion
- `blind`: `147/147` move, `147/147` proof, `147/147` forward motion
- `redteam`: `25/25` move, `25/25` proof, `25/25` forward motion
- `variance`: `63/63` move, `63/63` proof, `63/63` forward motion, `0` profile drift

## Before Adding A New Benchmark Pack

Before adding a new benchmark pack:

1. Draft the full set before tuning against it.
2. Freeze the wording and expected labels.
3. Run the first pass and record failures honestly.
4. Fix code only after the failures are recorded.
5. Rerun and keep both first-run and final-run history inspectable.
6. Add the new pack to the canonical manifest and benchmark index only after it has a report and a stable purpose.
