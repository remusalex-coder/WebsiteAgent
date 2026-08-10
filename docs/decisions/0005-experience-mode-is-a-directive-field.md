# ADR 0005 — Generalize experience as one more Directive field, not a new pipeline layer

**Date:** 2026-08-10
**Status:** Proposed — architecture only, not implemented this session
**Context:** read-only audit comparing Bakery V2 (`a1c44af`) against the general pipeline, prompted by River Park (`77c15289`) being the first real business the Director actually directed and receiving zero experiential decisions

## Context

Two things are now proven separately:

1. The Design Director works in production (River Park) — it chooses a real
   `direction` and moves 140 fields of `WebsiteDesign` (ADR 0004).
2. The engine can build something genuinely immersive (Bakery V2) — scene
   sequencing, scroll-as-time, signature moments, a 3D→photography handoff, a
   loop-closing arc.

These are disjoint systems. `lib/experience/` is reachable only by
`scripts/build-experience.ts` against a hardcoded fixture; `DesignDirective`
has no field that can express a sequence, a moment, or an experience mode —
not by oversight, but because V1 was deliberately scoped to section/token
decisions (`directive.ts`'s own header: "not a design-token DSL").

The full capability audit is
[docs/experience-capability-audit.md](../experience-capability-audit.md).
Its conclusion: most of Bakery V2's individual principles (cinematic opening,
skeleton loading, meaningful motion, functional conversion) already exist in
some form on the general path. What's missing is the connective tissue that
turns independent good decisions into one arc — not a wholesale second
system.

## Decision

**Add experience as one more closed-enum field on `DesignDirective`, executed
by the same deterministic-adapter pattern `applyDirective` already
establishes. Do not build a new pipeline stage, a new top-level contract, or
a generalized WebGL runtime.**

Concretely, for the next milestone (not this one):

- `DesignDirective` gains one field — tentatively `experienceMode` — whose
  only non-null value at this step nominates **one existing `SectionKind`**
  as the page's signature moment. Not free text: a closed enum referencing
  section kinds that already exist, so the model cannot invent a moment the
  content doesn't support.
- The deterministic system gets two small, code-checked extensions:
  `lib/design/worlds.ts` may return a short ordered sequence of grounds
  instead of one static world (a strict generalization of what it already
  does), and `lib/design/layout.ts` may give the nominated section elevated
  pacing.
- `lib/experience/`'s WebGL/scroll-as-time/3D-object machinery is **not**
  touched and **not** generalized. It stays a separate, manually-invoked
  capability for a specific business a human decided warrants it — the same
  status it has today.

## Alternatives considered and rejected

**A distinct pipeline layer** (Business Understanding → UX Strategy →
Experience Strategy/Narrative → Creative Direction → Design Direction →
WebsiteSpec → Renderer). Rejected: this duplicates the Director's existing
job — deciding intent — behind a second AI call and a second schema, doubling
per-run cost for a decision that is a *widening* of what the Director already
does, not a new kind of decision. The architecture principle already in place
(AI decides intent; deterministic system executes) already covers this; it
needs one more question, not one more stage.

**Generalizing `lib/experience/`'s Scene/WebGL model directly.** Rejected on
three grounds: its content is hand-authored prose per scene, not generated,
so it doesn't scale to "arbitrary business" without either an AI writing
scene copy (a much larger, unproven capability) or per-business manual
authoring (defeats autonomy); most business categories have no equivalent of
"a 3D loaf" for the hero object to be; and doing this is the literal thing
both this session and the prior one were explicitly told not to do — make
River Park (or anything else) into a Bakery clone.

**Leaving the two systems permanently separate.** Rejected: Bakery V2 was
built as "a benchmark for capability," and a capability that can never reach
the product it's meant to prove out stops being evidence of anything.

## Consequences

- No new top-level contract (`ExperienceSpec` or similar) is created. The
  existing `DesignDirective` → `applyDirective` → `ComposeOptions` →
  `composeDesign` path is the one this reuses, matching ADR 0001's and ADR
  0004's architecture rather than replacing it.
- The closed-set discipline that makes the Directive safe (`additionalProperties: false`,
  no hex codes, no measurements — ADR 0004) applies unchanged to the new
  field. The model nominates a *kind* of moment; it never supplies layout,
  colour, or motion values for it.
- Full immersive (WebGL, scroll-as-time) remains explicitly out of the
  Director's reach. Nothing in this decision opens a path for the model to
  autonomously decide a business should get a Bakery-style page — that stays
  a human decision, as it was for Bakery itself, until a much larger body of
  evidence exists to justify otherwise.
- Mobile and reduced-motion behavior need no new mechanism: the new field
  lives entirely inside the existing static-HTML section renderer, which
  already handles both.
