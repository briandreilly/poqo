# poqo One-Pager

poqo is a judgment engine.

It uses:

- one real Constitution: [constitution/core.json](/Users/admin/Documents/poqo/constitution/core.json)
- optional presentation profiles: [profiles/](/Users/admin/Documents/poqo/profiles)
- one Operating Spec: [operating-spec.md](/Users/admin/Documents/poqo/docs/operating-spec.md)
- one Prompt/Test layer: [prompts/](/Users/admin/Documents/poqo/prompts)

## Core Primitive

poqo decides one move per input:

1. `DIRECT`
2. `NARROW`
3. `PROVE`

It prefers the smallest sufficient move and keeps routing separate from presentation.

## What Changes

- the Constitution is singular and durable
- profiles change tone and lightweight presentation only
- routing, proof, and domain rules live in the Operating Spec
- prompt construction, harness behavior, and benchmarks live in the Prompt/Test layer
