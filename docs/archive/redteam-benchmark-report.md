# Red-Team Benchmark Report

## What This Set Tests

The red-team set tests whether poqo still makes the right next move when prompts are harsher, sloppier, less cooperative, and less evaluator-shaped than the main benchmark sets.

It is meant to pressure:

- soft chat-context references that should stay chat-bound
- casual wording that hides a real decision variable
- prompts that bait proof overkill
- prompts that bait generic narrowing
- prompts that sound emotionally urgent but still need judgment discipline

## How It Differs From Blind

The blind set uses realistic product language but is still relatively neutral in tone.

The red-team set is harsher. It includes more mixed intent, more casual sloppiness, more hidden constraints, and more prompts that try to push poqo into an overconfident DIRECT or an unnecessary PROVE move.

## Freeze Status

Yes. The full red-team prompt set was drafted before tuning against it.

The workflow for this pass was:

1. inspect existing prompt sets and evaluator
2. draft the full red-team set
3. freeze it in the prompt file and policy doc
4. run the first benchmark pass
5. record failures
6. make targeted code fixes
7. rerun and record final results

## First-Run Results

First frozen run via `npm run eval:redteam`:

- total prompts: `25`
- move matches: `22/25`
- proof matches: `21/25`
- forward-motion passes: `25/25`
- stalls: `0`
- over-narrow cases: `0`
- over-proof cases: `1`

First-run failures:

- `r03`: expected `PROVE/chat`, got `PROVE/world`
- `r19`: expected `PROVE/chat`, got `DIRECT/none`
- `r23`: expected `PROVE/chat`, got `NARROW/none`
- `r25`: expected `DIRECT/none`, got `PROVE/world`

## Weakness Categories Exposed

The first run exposed four benchmark-relevant weaknesses:

- chat-context detection was too brittle for softer phrases like "we already agreed" and "we've already nailed down"
- comparison prompts explicitly bounded by prior constraints were still being treated as missing criteria
- world-proof detection was too eager because bare uses of "version" were treated as time-sensitive fact requests
- one framework-choice prompt still read as answer-ready when it actually needed a small narrowing move

## Changes Made After The First Run

The fixes stayed narrow and preserved the current engine shape.

Changes made:

- expanded chat-context phrase detection in the input interpreter
- let chat-bounded comparison prompts stay prove-ready instead of being forced into NARROW
- tightened world-fact detection so "version" only counts when paired with current/latest/LTS context
- tightened casual recommendation-vs-choice detection for framework comparisons

An intermediate rerun after the first interpreter fix improved the benchmark to `24/25` move matches and `25/25` proof matches, with one remaining failure on `r13`.

## Final Results After Fixes

Final rerun via `npm run eval:redteam`:

- total prompts: `25`
- move matches: `25/25`
- proof matches: `25/25`
- forward-motion passes: `25/25`
- stalls: `0`
- over-narrow cases: `0`
- over-proof cases: `0`

No red-team failures remain in the current frozen set.

## Next Benchmark Risks Still Not Covered

The current red-team pack still does not cover every realistic failure mode.

Next useful benchmark risks:

- prompts that casually mix document proof and chat proof in the same sentence
- prompts with misleading quoted text that should not be treated as authoritative document input
- prompts where the user asks for a decision but also sneaks in a rewrite request
- prompts that imply world facts indirectly without naming them cleanly
- prompts where partial narrowing should produce a stronger direct recommendation before the next question
