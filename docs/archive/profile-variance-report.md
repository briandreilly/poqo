# Profile Variance Report

## What This Pack Tests

The profile variance pack tests whether poqo keeps the same routing judgment across profiles when the underlying ask is the same.

It is meant to verify the core architectural claim:

- the engine stays the same
- the core Constitution stays the same
- profiles change presentation only

## Freeze Status

Yes. The full variance prompt set was completed before tuning against it.

This set is part of poqo's permanent benchmark spine. Future tuning should not casually edit the prompt wording or expected labels.

## What Should Stay Stable

The following should stay stable across profiles:

- move selection
- proof basis
- forward motion

## What Was Allowed To Vary

The following were allowed to vary:

- tone
- response labels
- phrasing
- lightweight presentation inside each profile

## First-Run Results

First frozen run via `npm run eval:variance`:

- total prompts: `21`
- total profile runs: `63`
- move matches: `54/63`
- proof matches: `60/63`
- forward-motion passes: `63/63`
- stalls: `0`
- over-narrow cases: `3`
- over-proof cases: `0`
- profile drift cases: `3`

## Drift Cases Found

Three first-run failures were true profile drift cases.

All three came from `kidsafe` shifting from `DIRECT` to `NARROW` on prompts that were still answer-ready:

- `cv01`
- `cv09`
- `cv20`

These were style-driven drifts caused by caution bias in the profile layer, not by a real change in scope or proof need.

## What Fixes Were Made

The fixes stayed small and preserved the current engine shape.

Changes made:

- removed the profile-level caution fallback that let `kidsafe` change a ready `DIRECT` answer into `NARROW` for stylistic caution alone
- expanded missing-source detection so prompts like "Make this sound less stiff" route to `NARROW` instead of pretending the source text exists
- expanded chat-context detection so comparisons bounded by prior constraints route to `PROVE/chat` instead of `NARROW`

## Final Results

Final rerun via `npm run eval:variance`:

- total prompts: `21`
- total profile runs: `63`
- move matches: `63/63`
- proof matches: `63/63`
- forward-motion passes: `63/63`
- stalls: `0`
- over-narrow cases: `0`
- over-proof cases: `0`
- profile drift cases: `0`

## Portable Primitive Status

Yes. In the current frozen benchmark set, poqo behaves like a portable primitive.

The profiles now change expression without changing core routing judgment on the tested prompts.

That remains valid only while profiles stay inside the allowed presentation surface described in [allowed-profile-surface.md](/Users/admin/Documents/poqo/docs/allowed-profile-surface.md).
