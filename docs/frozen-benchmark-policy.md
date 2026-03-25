# Frozen Benchmark Policy

A frozen benchmark is a prompt set that is written in full before tuning against it and then treated as stable.

Rules:

- complete the full prompt set before making code changes to improve against it
- once frozen, do not casually edit prompt wording or expected labels
- run the benchmark first, record the failures, then change code, then rerun
- keep benchmark history inspectable so first-run and final-run results can both be reviewed
- if a prompt or label truly needs correction, record why it changed instead of silently updating it

Why this matters for poqo:

- it reduces self-alignment between the implementation and the evaluator
- it makes routing credibility more believable
- it keeps improvement work honest and inspectable over time
