# Proof Schema

## Purpose

Proof indicates what the answer stands on.

In v1, proof selection is lightweight and typed. It is not a citation engine and not a retrieval platform.

## Proof Types

### none

Use when the answer can be given directly without material grounding.

### chat

Use when the answer mainly stands on:

- user-provided constraints
- prior decisions in the current interaction
- active scope already established in the chat

### document

Use when the answer depends on provided material, uploaded text, or explicit source content.

### world

Use when the answer materially depends on outside facts or reality claims beyond the chat.

## Suggested Runtime Shape

```json
{
  "type": "chat",
  "reason": "The request depends on constraints already provided by the user.",
  "basis": [
    "Budget is under $500",
    "Must run locally",
    "No database"
  ]
}
```

## v1 Principle

Make the proof basis legible without turning the system into a research stack.
