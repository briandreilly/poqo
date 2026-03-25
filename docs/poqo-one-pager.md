# poqo One-Pager

poqo is a judgment engine.

It uses:

- one real Constitution: [constitution/core.json](../constitution/core.json)
- optional presentation profiles: [profiles/](../profiles/)
- one Operating Spec: [operating-spec.md](operating-spec.md)
- one Prompt/Test layer: [prompts/](../prompts/)

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
