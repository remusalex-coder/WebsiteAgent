# ADR 0004 — The Director's influence on V1 is one enum, and that is recorded, not hidden

**Date:** 2026-08-10
**Status:** Accepted (V1); revisit when Visual Critic exists
**Context:** measured during the first live Design Director run

## Context

The first live directive was rich. The model returned eleven fields, and most of
them were considered judgements about the business:

```json
{
  "direction": "editorial",
  "density": "balanced",
  "heroIntent":       { "preference": "editorial", "intent": "…" },
  "typographyIntent": { "preference": "serif",     "intent": "…" },
  "imageryIntent":    { "treatment":  "warm",      "intent": "…" },
  "colorStrategy": "brand-led",
  "accessibilityTarget": "AA",
  "confidence": 0.95
}
```

`applyDirective` turned all of that into exactly this:

```json
{ "direction": "editorial", "accessibilityLevel": "AA" }
```

Nine of the eleven fields were logged and discarded. `heroIntent.preference:
"editorial"` did not reach the layout planner; `typographyIntent.preference:
"serif"` did not reach the type system; `density: "balanced"` did not reach the
spacing system. The deterministic layer inferred all three itself.

## Decision

Keep it that way for V1, and say so plainly wherever the Director is described.

The single mapped field is not a limitation to apologise for — `direction`
selects the theme, which drives palette, type pairing, spacing rhythm, radius,
elevation, section variants and world. In the measured run, changing that one
enum moved **140 fields** of `WebsiteDesign`, including contrast, mood, type
ratio, measure, four colour roles, radius style, elevation style and the whole
imagery strategy. One enum is a wide lever, not a narrow one.

What is *not* acceptable is describing the Director as though the other nine
fields do something. They do not, and a reader of `directive.json` would
reasonably assume otherwise.

## Consequences

- The honest one-line description of V1 is: **the Director chooses one of eleven
  directions and a WCAG target; the deterministic system does everything else.**
- The advisory fields still earn their place. They are the model's reasoning made
  inspectable, and they are the evidence base for deciding *which* control
  surface to open next — that decision should be driven by observed defects, not
  by symmetry with the schema.
- The obvious candidate is `heroIntent.preference`, because the layout planner
  already takes a `HeroVariant` from a closed set and already overrides its own
  choice when content cannot support it. That is a small, safe widening.
- Opening a surface must not become a way for the model to supply values. The
  rule that keeps this contract safe is unchanged: **the Director chooses from
  closed sets; it never supplies a measurement.** No hex codes, no pixel values,
  no type scales, no spacing. `additionalProperties: false` on every object in
  `DIRECTIVE_SCHEMA` is what enforces it, and there are tests asserting that CSS-
  and token-shaped fields are rejected.
