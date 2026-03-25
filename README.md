# poqo

poqo is a judgment engine with one real Constitution and a separate operating layer.

👉 See a full example: [Homework Judgment Demo](docs/demo-homework-judgment.md)

## Quick Start

1. Clone the repo and `cd <your-clone>`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add `MODEL_API_KEY` if you want to use the model-backed demo.
4. Run `npm run typecheck`, `npm run arch:check`, and `npm run eval:all`.
5. Run `npm run demo` and open `http://localhost:3030`.

If port `3030` is already in use, run `PORT=3031 npm run demo` instead.

Its job is not to be a general chatbot or a giant agent system. Its job is to make the right next move for an input:

- `DIRECT` = respond now
- `NARROW` = respond by shrinking the missing variable
- `PROVE` = respond by showing what the answer stands on

The engine stays small and stable.
The Constitution stays singular and durable.
Profiles change presentation only.

poqo is organized into:

- one real Constitution at [constitution/core.json](constitution/core.json)
- tiny presentation profiles in [profiles/](profiles/)
- one Operating Spec in [docs/operating-spec.md](docs/operating-spec.md)
- one small model connection layer under [src/model/](src/model/) for the current configured AI service
- one Prompt/Test layer in [prompts/](prompts/)

Quick map:

- law lives in [constitution/core.json](constitution/core.json)
- routing and proof rules live in [docs/operating-spec.md](docs/operating-spec.md)
- presentation lives in [profiles/](profiles/)
- model transport lives in [src/model/](src/model/)

When to change what:

- change the Constitution only for permanent law
- change the Operating Spec for routing or operational mechanics
- change profiles for phrasing, labels, or lightweight tone only
- change the model seam for transport or provider behavior only

Success means poqo makes the right next move without bloating the engine or letting presentation logic corrupt routing.
