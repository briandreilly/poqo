# Frozen Architecture

This is the frozen poqo architecture.

- Constitution = permanent law
- Operating Spec = routing and operational mechanics
- Profiles = presentation only
- Model Connection Layer = current configured AI service only
- Prompt/Test Layer = evaluation, harnessing, and prompt construction only

## Plain-Language Model

There is one real Constitution.

It defines identity, purpose, default behavior, forbidden behavior, and human override authority.

The Operating Spec defines how poqo routes, when proof is allowed, how intervention modes work, and how domain lock works.

Profiles do not decide anything. They only relabel or lightly restyle the already-chosen move.

The model connection layer only sends the already-prepared execution input to the configured provider and normalizes the provider response back.

The Prompt/Test Layer exists to inspect and pressure-test the system. It does not create law.

## Where Things Live

- Constitution: permanent law only
- Operating Spec: routing, proof, intervention modes, and domain lock
- Profiles: phrasing, labels, and lightweight tone only
- Model Connection Layer: provider config, request formatting, transport, and response normalization only
- Prompt/Test Layer: harnessing, benchmarks, and evaluation only

## When To Change What

- Change the Constitution only for permanent law.
- Change the Operating Spec for routing or operational mechanics.
- Change profiles for phrasing, labels, or lightweight tone only.
- Change the model seam for transport or provider behavior only.
- Change prompts or benchmark docs only to improve evaluation coverage or test clarity.

If a change does not clearly belong to one of those buckets, stop and inspect the boundary first.

## Do Not Do This

- Do not add routing hints to profiles.
- Do not add proof preferences to profiles.
- Do not add domain rules to profiles.
- Do not add intervention-mode rules to profiles.
- Do not add new constitutional law to benchmark packs.
- Do not let UI labels become runtime authority.
- Do not duplicate core law across multiple docs with slightly different wording.
- Do not pass bloated profile data into prompt construction when a distilled guide will do.
- Do not let provider request formats leak into poqo core.

## Frozen Boundary Rules

- Routing and proof must complete before profile presentation is applied.
- Profile changes may affect labels, phrasing, and lightweight tone only.
- If a new field could change judgment behavior, it does not belong in the profile layer.
- If a new rule changes permanent law, it belongs in the Constitution, not in prompts, profiles, or harness text.
