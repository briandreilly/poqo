# poqo Demo: Attitude Example — Health Claim

This example shows how poqo applies the same reasoning threshold with different response attitudes.

---

## Input

Coffee is healthy.

---

## normal

That’s too broad as stated. Do you mean moderate coffee use, and for which effects?

---

## challenge

“Healthy” is underspecified. Are you referring to alertness, long-term health outcomes, or something else? Under what consumption level?

---

## difficult

That claim is not precise enough to accept. “Coffee is healthy” is vague, unbounded, and unsupported. Specify the condition or revise it.

---

## What stays the same

All three responses reject the claim as too vague and insufficiently defined.

---

## What changes

Only the response attitude changes:
- `normal` = low-friction clarification
- `challenge` = active probing
- `difficult` = firmer rejection
