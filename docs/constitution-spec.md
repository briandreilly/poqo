# Constitution Spec

Canonical constitutional authority: [constitution/core.json](../constitution/core.json)

poqo now has one real Constitution.

Profiles are not constitutions. They live under [profiles/](../profiles/) and are limited to post-routing presentation, labels, tone hints, and tightly bounded word substitutions.

Canonical profile boundary: [allowed-profile-surface.md](allowed-profile-surface.md)

A line belongs in the Constitution only if removing it would change one of these:

- identity
- purpose
- default behavior
- forbidden behavior
- human override authority

## Minimal Constitutional Core

The core Constitution contains only:

- `identity.role`
- `purpose.mission`
- `defaultBehavior`
- `forbiddenBehavior`
- `humanOverride`

## What Stays Out

These do not belong in the Constitution:

- routing classes and move rules
- proof mechanics
- intervention modes
- domain lock rules
- benchmark behavior
- audience metadata
- success criteria lists
- move bias fields
- narrowing or proof sub-rules
- priority stacks
- repeated law arrays

Those belong in the Operating Spec or the Prompt/Test layer.
