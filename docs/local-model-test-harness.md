# Local Model Test Harness

## What This Is For

This harness is a small local interface for testing poqo with your own prompts.

In the main local interface, poqo always runs first and the configured model service is the answering layer that follows it.

The internal harness path still supports:

- `poqo-only`
- `poqo-plus-model`

## Local Model Config Setup

Use either:

- a local `.env` file in the project root
- or exported shell variables

Preferred variables:

- `MODEL_PROVIDER=openai`
- `MODEL_API_KEY=...`
- `MODEL_NAME=gpt-5.4`

Legacy local aliases are still accepted for the current OpenAI provider:

- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-5.4`

Copy `.env.example` to `.env` locally and fill in your key.

Do not commit secrets.

## How To Run

1. `cd /Users/admin/Documents/poqo`
2. edit `.env` and add your `MODEL_API_KEY`
3. `npm run demo`
4. open `http://localhost:3030`

## How The Harness Works

### poqo-only

This mode does not present poqo as the final answering brain for factual questions.

It shows:

- move
- proof type
- routing explanation
- poqo brief

The poqo brief is a compact routing strategy, not a substitute for verified world knowledge.

### poqo-plus-model

This mode runs poqo first, then sends a normalized execution input to the configured model service that includes:

- the original user prompt
- selected move
- proof type
- routing explanation
- the poqo brief
- core constitutional guidance plus profile presentation guidance

The current provider implementation is OpenAI, but poqo itself stays vendor-neutral above the model connection layer.

## Model Selection

The instance reads:

- `MODEL_PROVIDER`
- `MODEL_NAME`

If they are not set, the local defaults are:

- provider: `openai`
- model: `gpt-5.4`

## Local-Only Behavior

This harness is for local testing only.

The API key stays server-side. It is never exposed in browser code.

If `MODEL_API_KEY` is missing:

- the main interface still shows poqo routing and a helpful local error instead of crashing
- the internal `poqo-only` path still works

## Current Provider Notes

The current model connection implementation uses the OpenAI Responses API from the server side.
