# poqo

poqo is a judgment engine with one real Constitution and a separate operating layer.

👉 See a full example: [Homework Judgment Demo](docs/demo-homework-judgment.md)

Its job is not to be a general chatbot or a giant agent system. Its job is to make the right next move for an input:

- `DIRECT` = respond now
- `NARROW` = respond by shrinking the missing variable
- `PROVE` = respond by showing what the answer stands on

The engine stays small and stable.
The Constitution stays singular and durable.
Profiles change presentation only.

poqo is organized into:

- one real Constitution at [constitution/core.json](/Users/admin/Documents/poqo/constitution/core.json)
- tiny presentation profiles in [profiles/](/Users/admin/Documents/poqo/profiles)
- one Operating Spec in [docs/operating-spec.md](/Users/admin/Documents/poqo/docs/operating-spec.md)
- one small model connection layer under [src/model/](/Users/admin/Documents/poqo/src/model) for the current configured AI service
- one Prompt/Test layer in [prompts/](/Users/admin/Documents/poqo/prompts)

Quick map:

- law lives in [constitution/core.json](/Users/admin/Documents/poqo/constitution/core.json)
- routing and proof rules live in [docs/operating-spec.md](/Users/admin/Documents/poqo/docs/operating-spec.md)
- presentation lives in [profiles/](/Users/admin/Documents/poqo/profiles)
- model transport lives in [src/model/](/Users/admin/Documents/poqo/src/model)

When to change what:

- change the Constitution only for permanent law
- change the Operating Spec for routing or operational mechanics
- change profiles for phrasing, labels, or lightweight tone only
- change the model seam for transport or provider behavior only

Success means poqo makes the right next move without bloating the engine or letting presentation logic corrupt routing.
