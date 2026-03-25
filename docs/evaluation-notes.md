# Evaluation Notes

## Goal

Evaluate whether poqo chooses the correct move for a prompt.

The primary metric in v1 is routing accuracy, not prose quality.

## Evaluation Unit

Each prompt entry should include:

- `id`
- `prompt`
- `expectedMove`
- `expectedProof`
- `why`
- `notes`

## Prompt Coverage

The prompt set should cover:

- clearly answerable prompts
- ambiguous but narrowable prompts
- proof-sensitive prompts
- multi-part prompts
- constraint-heavy prompts
- scope conflict prompts

## Scoring

Base scoring:

- move match
- proof match

Helpful secondary observations:

- whether the routing explanation is coherent
- whether the response stays compact
- whether narrowing is used as part of the answer rather than as a stall

## Success Criteria

Success in v1 means:

- the system makes the right next move often enough to be useful
- failures are inspectable
- profiles noticeably affect the response shape without changing engine structure
