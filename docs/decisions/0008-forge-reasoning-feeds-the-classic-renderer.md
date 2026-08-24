# 0008 — Forge's reasoning feeds the classic renderer; neither pipeline is deleted

_Status: accepted, 2026-08-19. Records the resolution in
[BUSINESSFORGE_2.0_DECISION_GATE.md](../../BUSINESSFORGE_2.0_DECISION_GATE.md) §3/§4, which
itself follows from the contradiction register in the same document (§1.A/§1.B) and the audit in
[BUSINESSFORGE_2.0_RESEARCH_INTEGRATION.md](../../BUSINESSFORGE_2.0_RESEARCH_INTEGRATION.md) §3._

## Context

Two complete website-generation pipelines exist in this repository as of 2026-08-19:

1. **The classic pipeline** (`main.ts` → `agents/` → `lib/design/` + `lib/content/` +
   `lib/render/`). Deterministic and model-free from `composeDesign` down. A model, where used,
   selects from a closed, validated vocabulary (`additionalProperties:false` schemas); it never
   emits CSS, JS, or markup. This is the architecture's stated invariant (see ADR 0004) and it is
   enforced structurally, not by convention.
2. **Experience Forge** (`lib/forge/`, reachable via `scripts/forge/run.ts` and as the
   `experience-forge` stage inside `scripts/n8n/stage.ts`). Built 2026-08-16 to 2026-08-18 by an
   autonomous Antigravity (Gemini) coding session, reconciled into this branch afterward. Its
   `builder.ts` has a model write the site's HTML5 in one pass and its CSS3/JS in a second pass,
   directly — the classic invariant's exact violation, as the pipeline's only path, not an edge
   case.

Neither pipeline is a mistake. The classic pipeline's safety is real and load-bearing (1160+
tests, six-business benchmark, four prior ADRs). Forge's creative reach is also real and
measured (Go Sweet 85/100, River Park 89/100 on its own 10-axis vision critic) — and it produced
that reach specifically through reasoning stages (`research.ts`'s evidence harvesting,
`grounding.ts`'s fact/inference/interpretation separation, `signature.ts`'s three-territory
divergence with a falsification test, `assetStrategy.ts`'s evidence-driven asset routing) that the
classic pipeline's own Creative Director was always meant to do and never did as completely.

`BUSINESSFORGE_2.0_DECISION_GATE.md` audited both pipelines' actual call graphs (not their
documentation) and found: they share no design/render code (zero import edges between
`lib/forge/*` and `lib/design/`/`lib/render/`/`lib/content/`); Forge's reasoning modules have no
dependency on `builder.ts`'s free generation; and the classic pipeline's capability router
(`lib/capability/`) is a stronger, more complete implementation of what both pipelines need than
anything Forge built independently.

## Decision

**The classic pipeline (`main.ts`/`lib/design`/`lib/content`/`lib/render`, extended) is the
canonical production pipeline.**

**Role of the classic pipeline:** unchanged in its structural invariant — a model decides intent
from a closed vocabulary; deterministic code executes it. Extended, additively, to consume
Forge's reasoning stages as the Creative Direction / Experience Signature / Asset Strategy layers
(§Adopted, below), and to grow the runtime capability (`lib/runtime/`, Tier 2) needed to cover
what Forge's builder currently free-hands, so that extension does not come at a cost to visual
ambition.

**Role of Experience Forge:** its reasoning modules — `research.ts`, `grounding.ts`,
`signature.ts`, `assetStrategy.ts`, `motion.ts`'s closed vocabulary, `functionalModules.ts` — are
promoted into the canonical pipeline. Its writing modules — `builder.ts` (free HTML/CSS/JS
generation) and `repair.ts` (model-driven code rewrite from critic findings) — are **not deleted
today**, but are retired from the canonical path once the Tier-2 runtime capability built to
replace their reach is sufficient not to regress output quality. Until then, `lib/forge/`'s
current path may keep running as an explicitly labelled experimental surface, following the same
honesty discipline the platform already applies to skill placeholders (say what it is, never hide
the exception).

### Adopted from Forge

| Forge module | Adopted as | Status at time of this ADR |
|---|---|---|
| `lib/forge/research.ts` | Evidence-harvesting improvement over `lib/sources/` alone | Not yet wired into the classic pipeline (tracked, not started) |
| `lib/forge/grounding.ts` | The tri-state epistemic model (`VERIFIED_FACT`/`INFERENCE`/`CREATIVE_INTERPRETATION`) for Business Understanding | Not yet wired (tracked, not started) |
| `lib/forge/signature.ts` | Creative Territories + falsification test, as the canonical Creative Director's divergence mechanism | Not yet wired (tracked, not started) |
| `lib/forge/assetStrategy.ts` | The canonical Asset Strategy decision function | Not yet wired (tracked, not started) |
| `lib/forge/motion.ts`'s vocabulary | Mapped onto the canonical Experience Contract's `motionIntensity` field | Additive type only, not yet consumed by a renderer |
| `lib/forge/functionalModules.ts` | The canonical functional-module contract | Not yet wired (tracked, not started) |

### Deprecated (not deleted) from Forge

| Forge module | Why | Retirement condition |
|---|---|---|
| `lib/forge/builder.ts` | Writes customer-facing HTML/CSS/JS directly — the invariant violation | Retires once `lib/runtime/`'s Tier-2 capability covers its current reach without a measured quality regression |
| `lib/forge/repair.ts` | Rewrites generated code via a second model call from critic findings | Retires in the same change as `builder.ts` — a critic finding becomes a `reconcept`-style signal into the token/capability layer instead |

## No model-authored arbitrary customer-facing bytes in the canonical renderer

Restated because it is the one rule every other part of this decision serves: in the canonical
pipeline, a model may only ever return a validated object against a closed schema. The renderer
(`lib/render/` and the Tier-2 runtime it will grow) accepts no free-form code from any model call,
under any capability id, at any point in the chain. Where a desired effect has no registered
capability yet, that is a backlog item — never a reason to let a model emit it directly.

## Role of Experience Signature

The selected Creative Territory's metaphor/central-mechanism/moment becomes a validated **override**
on the classic pipeline's deterministic Experience Architecture (`lib/design/experience.ts` +
`script.ts`) — the same relationship ADR 0004 already defined for the Design Director's closed-set
fields, extended to cover the additional intent Forge's `signature.ts` and `experienceStrategy.ts`
name and the classic vocabulary did not yet have a field for.

## Role of Asset Strategy

`lib/forge/assetStrategy.ts`'s per-slot real/vector/non-depictive/edited decision function becomes
the canonical asset-decision layer feeding `lib/design/assets.ts`'s `AssetChoreography`. It is pure
and deterministic (no network call of its own); the capability requests it may produce
(`image_editing`, `motion_media`) remain gated exactly as `lib/capability/registry.ts` already
specifies (`gate:'human'`), unchanged by this decision.

## Role of the Capability Registry

`lib/capability/registry.ts` remains the sole capability vocabulary. No parallel registry, router,
or provider table is created by this decision or by anything it authorizes downstream. Confirmed
in the audit behind this ADR: every stage in the canonical fourteen-stage chain (Research through
Deployment) already has a corresponding, correctly-gated capability id — the integration work this
decision authorizes is consumption, not vocabulary.

## Role of the Tier-2 runtime

`lib/runtime/` (currently only `scroll-progress.ts`, a narrow, correctly-gated slice) is the
mechanism that lets the deterministic renderer match Forge's visual ambition without the
invariant violation. It grows one named, registered capability at a time — never a general
JavaScript-authoring surface. This is the long pole of this decision and is deliberately started
on the smallest possible scope first (see the implementation record below).

## QA/preflight position

Unaffected in principle by this decision, and partially completed independently
(`lib/qa/preflight.ts`, wired into `scripts/n8n/stage.ts`'s `runJobFullWith` as of this same
implementation pass): a production preflight gate runs after the QA loop concludes and before a
job is reported, using the already-built `qa/gates/{technical,accessibility}.ts` — a blocking
finding downgrades a pending `deliver` decision to `escalate`, using Hermes's existing action
vocabulary. Performance remains a caveat, never a blocking reason, per its own prior design intent
(Freeze N-13).

## Migration strategy

Incremental, module by module, each independently valuable and independently testable:

1. Record this decision (this document).
2. Wire the already-built, already-tested QA gates that had no production caller (done, this
   pass — see `lib/qa/preflight.ts`).
3. Adopt `grounding.ts`'s epistemic model into the classic pipeline's evidence/analysis stages.
4. Encode the reconciled Experience Contract as additive fields on `lib/design/types.ts`.
5. Wire the Experience Signature as a validated override, following ADR 0004's pattern.
6. Wire the Asset Strategy function into `AssetChoreography`.
7. Extend the existing provider/cost governance (`lib/capability/`) rather than replacing it —
   smallest correct foundation first where full integration is out of scope for one pass.
8. Build the first slice of `lib/runtime/`, scoped to one Tier-2 capability.
9. Connect that slice to the renderer's existing opt-in mechanism
   (`RenderOptions.runtime`).
10. Only once 8/9 cover `builder.ts`'s current reach without a measured regression: retire
    `builder.ts`/`repair.ts` from the canonical path.

**This document does not rewrite history.** Steps not yet completed at the time this ADR was
written are marked "not yet wired" or "tracked, not started" above, honestly, rather than implied
complete. The implementation session that produced this ADR completed steps 1 and 2 in full and
made bounded, additive progress on steps 3–9, recorded in `PROJECT_STATUS.md` and in the session's
own final report rather than claimed here in advance of the code.

## Consequences

- A future session extending either pipeline's experience/asset/capability logic has one place to
  extend it, not two.
- `lib/forge/builder.ts` and `repair.ts` remain reachable (the `experience-forge` stage in
  `scripts/n8n/stage.ts` is untouched by this decision) for as long as steps 8–10 above are
  incomplete, so no existing capability is lost during the migration.
- The eight `ARCHITECTURE_FREEZE.md` modules already built but unwired (see
  `BUSINESSFORGE_2.0_DECISION_GATE.md` §1.D) are addressed independently of this decision; this
  ADR does not block or gate them.
