# poqo v1 Acceptance

## Must Do

poqo v1 must:

- load the core constitution and keep the engine shape stable across profiles
- interpret an input into readiness, ambiguity, constraints, and proof need
- choose exactly one move for every input: `DIRECT`, `NARROW`, or `PROVE`
- return a compact final response, chosen move, proof type, and routing explanation
- treat narrowing as part of the answer when the ask is not answer-ready
- choose the smallest sufficient move instead of the most elaborate move
- support local evaluation against labeled prompt sets

## Does Not Do

poqo v1 does not:

- fetch live world facts automatically
- train models
- maintain long-term memory
- run multi-agent orchestration
- add plugins, auth, billing, or deployment systems
- turn proof selection into a research stack

## Routing Success

Routing counts as successful when:

- `DIRECT` is chosen for requests that are specific, answer-ready, and do not materially depend on grounding
- `NARROW` is chosen for requests with a missing key variable, conflicting constraints, absent source material, or overly broad scope
- `PROVE` is chosen when the answer materially stands on provided text, prior stated constraints, or outside facts
- the routing explanation names the actual reason for the move in one short line

## Routing Failure

Routing counts as failure when:

- poqo answers directly when the key decision variable is still missing
- poqo narrows when the request was already specific enough to answer
- poqo proves when no meaningful basis is needed
- poqo skips proof when the answer clearly stands on document, chat, or world basis
- the explanation is generic enough that a reviewer cannot tell why the move was chosen

## Acceptable Proof Selection

Proof selection is acceptable when:

- `none` is used for self-contained asks that do not require grounding
- `chat` is used when the answer stands on active constraints, prior decisions, or scope already stated in the conversation
- `document` is used when the answer stands on provided text or quoted source material
- `world` is used when the answer depends on outside facts, current rules, or time-sensitive claims
- the selected proof type is the smallest one that actually supports the answer

## Overreach

Overreach means poqo:

- expands the scope beyond the user ask
- adds proof when the answer can stand without it
- answers ungrounded factual claims as if they were settled
- asks for more context when a narrower partial answer was already possible
- turns a simple request into a larger system recommendation than needed

## Unnecessary Narrowing

Narrowing is unnecessary when:

- the request already contains the needed constraints
- poqo could answer directly with a compact recommendation
- the missing information does not materially change the next move
- poqo asks a generic clarifying question instead of narrowing inside the answer

## Proof Overkill

Proof is overkill when:

- poqo chooses `PROVE` for principle-level advice that does not rely on a source
- poqo uses `world` proof when `chat` proof is enough
- poqo surfaces basis text that does not change the recommendation
- poqo adds visible proof to obvious local tradeoffs that can be answered directly

## Smallest Sufficient Move

In practice, the smallest sufficient move means:

- use `DIRECT` when one compact answer is enough
- use `NARROW` when one missing variable changes the recommendation, and answer as much as possible before asking for that variable
- use `PROVE` only when the answer needs visible support to be credible
- prefer one sharp explanation line over a long rationale
- prefer one concrete next step over a broad clarification request
