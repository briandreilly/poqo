# Allowed Profile Surface

Profiles are presentation-only overlays. They are not mini-constitutions and they are not operating logic.

## Allowed Fields

- `id`
  - stable profile identifier
  - allowed use: lookup, reporting, UI selection
- `title`
  - short UI label
  - allowed use: display only
- `toneHints`
  - small whitelisted tone hints for presentation style
  - allowed use: phrasing pressure, brevity, gentleness, inspectability
- `responseLabels`
  - display labels for `DIRECT`, `NARROW`, and `PROVE`
  - allowed use: final response headings only
- `termSubstitutions`
  - tightly bounded word swaps on final surface text
  - allowed use: lightweight wording changes after routing and proof are already fixed

## Hard Prohibitions

Profiles must not affect:

- routing
- move selection
- proof basis
- narrowing depth
- intervention posture
- domain lock
- constitutional law

If a field can change judgment behavior, it does not belong in the profile layer.

## Runtime Rule

Routing and proof must be decided before profile presentation is loaded or applied.

Profiles may only relabel or lightly restyle the final surface text after the move is already fixed.

## Removed As Too Risky

- `voice`
  - removed because it invited hidden reasoning behavior instead of bounded presentation
- open-ended `styleHints`
  - narrowed to whitelisted `toneHints`

## Safe Mental Model

The Constitution sets permanent law.

The Operating Spec sets routing and proof mechanics.

Profiles only change how the already-chosen move is presented.
