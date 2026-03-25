# Profile Variance Policy

Profile variance testing checks whether poqo keeps the same core routing judgment across profiles while allowing response tone and presentation shape to vary where that variance is legitimate.

This prompt set is part of poqo's permanent benchmark spine and should be treated as a frozen benchmark.

What should stay stable:

- the chosen move when the underlying ask is the same
- the proof basis when the underlying grounding need is the same
- forward motion on every profile run

What may vary:

- tone
- phrasing
- response label or presentation shape
- lightweight wording inside the fixed move

What counts as profile drift:

- one profile changes the move for a stylistic reason rather than a substantive one
- one profile changes the proof basis even though the grounding need did not change
- one profile loses forward motion because it became too cautious, too performative, or too generic

What counts as style affecting judgment incorrectly:

- kid-safe language causing unnecessary narrowing
- founder tone causing unnecessary proof framing or overconfidence
- default tone becoming vague enough to weaken the next move

Freeze rules:

- complete the full variance set before tuning against it
- do not casually edit prompt wording or expected labels once frozen
- record first-run failures before changing code
- keep first-run and final-run history inspectable in the related report

Why this matters:

- poqo claims the engine is portable and the profile layer is presentation only
- that claim is only credible if profiles shape expression without casually corrupting judgment
- variance results should stay inspectable so drift can be seen and fixed directly

Profile boundary reminder:

- profiles may affect phrasing, labels, and lightweight tone only
- profiles must not affect routing, proof basis, narrowing depth, posture choice, domain lock, or constitutional law
