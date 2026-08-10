# ADR 0005 — Generalize experience as one more Directive field, not a new pipeline layer

**Date:** 2026-08-10 · **Amended:** 2026-08-10, same day, after a contract gate
**Status:** Accepted — architecture only, not implemented
**Context:** read-only audit comparing Bakery V2 (`a1c44af`) against the general pipeline, prompted by River Park (`77c15289`) being the first real business the Director actually directed and receiving zero experiential decisions

> **Amendment note.** The original version of this ADR proposed extending
> `lib/design/worlds.ts` to return a sequence of grounds instead of one
> static world. That was based on a factual error, found by re-reading
> `worlds.ts` in full during the contract gate that follows: **it already
> does this.** `WORLDS[id].journey` and `assignJourney()` already walk every
> section through an ordered ground sequence with no-repeat and settling
> rules — committed at `efb84af`, the same session that first proposed this
> ADR. The core decision below (one more nested field on `DesignDirective`,
> not a new layer) is confirmed sound and unchanged. The concrete shape is
> corrected: not a `worlds.ts` change, but two smaller, genuinely-missing
> pieces — a **moment** (layout-level) and a **transition** (renderer-level).

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

- `DesignDirective` gains one optional, **nested** field — `experienceIntent`
  — mirroring the existing `heroIntent`/`typographyIntent`/`imageryIntent`
  shape (a closed-enum preference plus a one-sentence rationale), not a bare
  top-level field and not a separate contract:

  ```ts
  interface ExperienceIntent {
    readonly mode: 'standard' | 'moment-led';
    readonly moment: SectionKind | null;   // required iff mode === 'moment-led'
    readonly momentIntent: string | null;  // one sentence: why this section
    readonly transitionAtMoment: boolean;  // a wash marks entry to it, or not
  }
  ```

  `moment` is restricted to `SectionKind` values the business's own content
  actually contains — cross-checked against the same brief
  `buildDesignBrief` already shows the model — so it cannot nominate a
  section that doesn't exist.

- The deterministic system gets two small, genuinely-missing additions —
  **not** a `worlds.ts` change, since sequencing already exists there:
  - **Moment** (`lib/design/layout.ts`): the nominated section receives
    elevated `emphasis`/imagery treatment, using enums that already exist.
  - **Transition** (`lib/render/variants.ts`): one new, reusable CSS-only
    wash primitive, applied only at the boundary into the moment section
    when `transitionAtMoment` is set.
  `worlds.ts` itself is untouched — its journey/sequence mechanism already
  does what a page-wide ground progression needs.
- `lib/experience/`'s WebGL/scroll-as-time/3D-object machinery is **not**
  touched and **not** generalized. It stays a separate, manually-invoked
  capability for a specific business a human decided warrants it — the same
  status it has today.

### The World / Section / Sequence / Moment / Transition boundary

- **World** — the whole-page decision (typefaces, ground vocabulary, journey
  shape). Already correct; unchanged.
- **Section** — one piece of verified content. Already correct; unchanged.
- **Sequence** — the ordered walk of grounds across sections
  (`assignJourney`). Already correct; unchanged.
- **Moment** — one section marked for elevated pacing relative to its
  neighbors. New; belongs to `layout.ts`, not `worlds.ts`.
- **Transition** — a wash at one chosen boundary, not every boundary. New;
  belongs to the renderer, not `worlds.ts`.

Putting Moment or Transition inside `worlds.ts` would be the "second
experience engine inside worlds.ts" this gate was explicitly asked to guard
against — both are layout- and renderer-level concerns, not whole-page ones.

### AI boundary

**May decide:** `mode`, which existing `SectionKind` is the moment, one
sentence of rationale, whether a transition marks its entry — plus
everything already in scope unchanged (direction, density, hero preference,
color strategy, typography class, imagery treatment, accessibility target,
which can only be raised, never lowered).

**Must not decide:** CSS, JS, raw WebGL, security-sensitive behavior,
accessibility bypasses, animation duration/easing/effects, DOM. No field
exists or will exist for any of these — the same boundary ADR 0004 already
drew ("chooses from closed sets, never supplies a measurement"), applied to
one more decision, not a new philosophy.

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
- Backward compatible by construction: `experienceIntent` absent →
  `ComposeOptions.momentSection` undefined → `layout.ts`/`variants.ts`
  produce byte-identical output to today, for every historical directive and
  every future run with `DIRECTOR_ENABLED=false`. One `ARTIFACT_DEFAULTS`
  entry in `main.ts`, matching the precedent already set for
  `direct: { directive: null, provenance: null }`.
- Test strategy: adapter unit tests for the new field (valid/invalid/absent,
  mirroring the existing directive-adapter tests) → a `--compose`
  deterministic test for a business with a moment set, no model call → one
  smoke-test-style real Director call proving *both* directions — a
  business where `moment-led` is the obvious answer, and one where
  `standard` is — since observing only the "yes" case wouldn't prove the
  boundary holds in both directions.
