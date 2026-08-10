# Experience capability audit — Bakery V2 vs. the general pipeline

_Read-only audit, 2026-08-10. No code changed, no AI/API call made. Canonical
Bakery V2 at `a1c44af` (unchanged since — verified, zero drift). River Park
(`artifacts/77c15289`) inspected, not regenerated._

## 1. What Bakery V2 actually contains

Read in full: `lib/experience/{types,compose,runtime,emit,shader,styles}.ts`.
Not a template — a hand-authored scene script for one business, executed by a
general (if bakery-shaped) runtime. Every capability below, classified:

**A** generalizable concept · **B** business-specific content · **C**
renderer-specific · **D** experience-runtime-specific · **E** infrastructure ·
**F** QA/accessibility/performance infrastructure

| Capability | What it does | Class | Generalizable? |
|---|---|---|---|
| Scene sequencing (`Scene[]`, 9 `SceneKind`s, `clock`, `marker`) | An ordered narrative script instead of a section list — order carries meaning, scene N reads because scene N-1 placed the visitor somewhere | A/D | The *concept* (ordered narrative beats) generalizes. The 9 specific kinds and their hand-tuned grid CSS do not. |
| Scroll-as-time (`sample()`: playhead = `scrollY + viewport/2`) | One continuous timeline; scroll position *is* the story's clock | D | The mechanism is runtime-specific. The *principle* — scroll can mean something other than page position — generalizes as a strategy choice, not a default. |
| Signature moments (Blade, Oven Spring, sampled at exact fraction, not scene midpoint) | Three events the whole page's pacing is built around | B (content) / A (technique) | Content is bread-specific. The technique — a business earns *one or two* moments worth building pacing around, captured at their peak — generalizes to any category with a real "before/after" or "process" moment. |
| 3D/WebGL loaf (`shader.ts`, SDF raymarch, 9 uniforms) | The one 3D object on the page; scroll drives fermentation | B/C/D | Not generalizable as code — there is no equivalent object for a law firm. Generalizable only as a *gated creative option*, and only when a business's own evidence supports one. |
| 3D → photography handoff | Synthetic render dissolves into a real photograph at the payoff moment | A (technique) | Generalizes as a storytelling technique for any business with real photography proving a claim. |
| Whiteout/veil (`Veil`, `wash()`) | A full-viewport wash covers the one moment two colour states can't legibly blend | A/D | The mechanism is runtime code; the *principle* — cover a polarity flip rather than crossfade it — is a reusable rendering primitive, usable without WebGL. |
| Loop-closing ending (`coda` returns to `levain`'s clock/ground) | The page ends where it began, not on a generic footer | A | Purely a content/pacing decision. **Nothing engineering-side is missing to do this today** in the general pipeline. |
| World-as-journey (7 `Ground`s walked in sequence: night → ignition → morning) | The page's whole-page colour decision is a *sequence*, not a single choice | A | **Correction (contract gate, same day):** the general pipeline's own `lib/design/worlds.ts` already does this — `WORLDS[id].journey` and `assignJourney()` walk every section through an ordered ground sequence with no-repeat/settling rules, committed at `efb84af`. No extension needed here; the real gap is narrower — see ADR 0005's amendment. |
| Per-scene dough state (rise/bake/heat/dolly/ferment/score/spring/offset) | Continuous physical simulation parameters for the hero object | B/D | Entirely bread-specific and runtime-specific. Would need an abstract "hero-object state machine" contract to generalize, which is very likely not worth building for categories with no equivalent object. |
| Reduced-motion / no-WebGL fallback | Feature-detects, drops to a designed static state, never a black rectangle | F/A | The general pipeline already shares the *principle* (`tokens.motion.respectReducedMotion`, CSS-only). Bakery proves the same discipline holds for a JS/WebGL layer. |
| FPS-based auto-degradation (quality → renderScale → drop GL entirely under 40fps) | Protects the frame budget rather than letting the whole page stutter | F | Fully generalizable performance-safety pattern for any future continuous-rendering feature. Not applicable to the current section renderer, which has nothing to degrade. |
| Mobile adaptation (`offsetYMobile`, half render scale, reel disabled) | Device-conditional composition, not just device-conditional CSS | F | The technique generalizes; the specific values don't. |
| Navigation model: skip-link only, no persistent header nav | Trades navigation for a single guided path | B/A | A deliberate, gated trade-off — must remain opt-in per business, never a default (see §4). |
| Loading curtain, held until first real frame | Perceived-performance skeleton | A | Fully generalizable, has nothing to do with bread. |
| `schema.org` type hardcoded to `'Bakery'` | — | B (bug) | Trivial, standalone fix — should read from category like the general renderer does. Not an architecture question; flagged for a future small commit, not this milestone. |
| Contrast-per-scene assertion (`test/experience.contrast.test.ts`) | Every ground/ink pair the scene script can produce is asserted, not eyeballed | F | Structurally identical in spirit to `lib/design/tokens.ts`'s own contrast reporting for the section system. QA methodology already transfers. |
| Browser-driven degraded-mode + keyboard + scroll-contrast checks (`verify-experience.mjs`) | Reduced-motion, no-WebGL, and continuous-scroll contrast, checked in a real browser | F | A reusable QA harness *shape* for any future continuous/animated feature — not needed for the current static-HTML general pipeline. |

## 2. The general pipeline, for comparison

Read in full: `lib/design/{directive,types.ts excerpts},patterns.ts excerpts`,
`agents/designDirectorAgent.ts`, `agents/designAgent.ts`, `main.ts` stage
wiring (from the prior session's work).

- **`WebsiteDesign`** is `personality + industry + patterns[] + world (one
  static `WorldId`) + tokens + layout`. `LayoutPlan` is `hero variant + footer
  variant + a flat sections[] with order[]` — a list, not a script. Order
  carries no narrative weight; each section is independently laid out.
- **`DesignDirective`** (the Director's entire output vocabulary) is 11
  fields, and every one of them is section/token-level: `direction`,
  `visualIntent` (logged only), `density`, `heroIntent` (hero variant, still
  advisory), `layoutIntent` (logged only), `colorStrategy`,
  `typographyIntent`, `imageryIntent`, `accessibilityTarget`, `rationale`,
  `confidence`. **There is no field, anywhere in this contract, that can
  express "sequence," "moment," "timeline," or "experience mode."** This
  isn't an oversight — `directive.ts`'s own header explicitly scopes V1 to
  "not a design-token DSL," and the schema uses `additionalProperties: false`
  specifically to keep the model inside a closed, reviewable vocabulary. The
  vocabulary is just narrower than what Bakery V2 demonstrates is possible.
- **The renderer** (`lib/render/`) assembles one document from that flat
  section list. Motion is CSS scroll-timelines only (`motion-enter-rise`,
  `motion-hover-response`), respects reduced motion at the token level, and
  needs no JavaScript to render correctly — the "opens from disk" guarantee.
  There is no concept of a continuous playhead anywhere in it.

## 3. Capability gap matrix

| Capability | Bakery V2 | General pipeline | Director | Renderer | Missing abstraction |
|---|---|---|---|---|---|
| Scene/narrative sequencing | YES | NO | NO (no field) | NO | An alternate composition mode for `LayoutPlan`, or a small extension to it |
| Scroll-as-time | YES | NO | N/A | NO | A client runtime the renderer doesn't have (and shouldn't gain wholesale) |
| Signature-moment pacing | YES (hand-authored) | NO | NO | NO | A "nominate one section as the moment" concept, closed-enum |
| 3D/WebGL hero object | YES | NO | NO | NO | Deliberately not generalized — see §5 |
| Synthetic → photographic handoff | YES | Partial (gallery ranking favours real business photos; no transition) | NO | NO | A reusable wash/reveal primitive in `variants.ts` |
| Whiteout/veil transition | YES | NO | NO | NO | Same primitive as above |
| Loop-closing narrative | YES | Possible today, never authored | NO | Already capable | Nothing — a content decision, not an engineering one |
| World-as-journey | YES (7 grounds) | **YES** — `worlds.ts`'s `journey`/`assignJourney()` already sequences grounds per-section (correction, see below) | NO | Yes (`ground()` helper rebinds ink per-ground) | None — already built. Real gap: a **moment** marker (layout-level) and a **transition** primitive (renderer-level), neither of which belongs in `worlds.ts` |
| Guided-path navigation | YES | NO (persistent nav always) | NO | Renders nav whenever `showNavigation` | A gated "experience mode" toggle, not a default |
| Reduced-motion safety | YES (JS-level) | YES (CSS-level) | N/A | YES | Nothing — principle already shared across both systems |
| Performance auto-degradation | YES | N/A (nothing continuous to degrade) | N/A | N/A | Only becomes relevant if scroll-as-time is generalized — not proposed here |
| QA for continuous experiences | YES | Partial (static contrast only) | N/A | N/A | Only needed if the above is generalized |

## 4. River Park against this matrix

River Park received a real, coherent **direction** (`elegant`, world `bone`,
13 patterns) and zero **experience** decisions. It has no nominated moment
(an event venue's obvious candidate — the room transformed, or a booking
confirmed — was never asked for), no narrative arc (structurally, an empty
room "filling" through the scroll is the same shape as Bakery's night → day
arc, and nothing prevents it except that nothing asks for it), and a single
static world used throughout rather than a sequence.

The gap between `"elegant / airy"` and a concrete experiential system is not
a depth problem — the Director's 140-field structural reach (ADR 0004) is
real — it's a **vocabulary** problem: the Director is never asked a question
whose answer could be a sequence, a moment, or an arc. It answers "what does
this look like," never "what does visiting this feel like as a sequence of
moments." That was V1's explicit, correct scope; it is also exactly where V1
now visibly ends.

## 5. Research: principles vs. implementation

Extracted as reusable ideas, not copied visual language, per the master
prompt's own instruction not to copy Crave or a specific Awwwards site:

| Principle | What it means, generically | Present in Bakery V2? | Present in the general pipeline? |
|---|---|---|---|
| Cinematic opening | The first thing a visitor sees sets a mood before it sets an agenda | Yes (`levain`, near-silent) | Partial — the hero is "cinematic" per PROJECT_STATUS, but static |
| Skeleton/loading experience | Visible intent while the page assembles, not a blank flash | Yes (`#curtain`) | No |
| Progressive disclosure | Information arrives as it becomes relevant, not all at once | Yes (scenes reveal in order) | Yes, structurally (section order), but order carries no narrative logic today |
| Scroll choreography | Scroll position drives *state*, not just visibility | Yes | No — scroll only triggers CSS entrance animation |
| Navigation escape hatch | A guided experience must still let someone jump straight to what they need | Yes — skip link to `#scene-threshold`, always present | Yes — persistent nav is the default, stronger than an escape hatch |
| Meaningful motion | Motion communicates a state change, not decoration | Yes (blade travel, oven spring) | Partial (`motion-enter-rise` is entrance-only) |
| Perceived performance | Feels fast even when it isn't instant | Yes (curtain, GPU-cheap shader, quality auto-drop) | Yes (no web fonts, no external requests — the renderer's own discipline) |
| Functional conversion | The experience must still let someone act | Yes (`threshold` scene: hours, phone, directions, always reachable) | Yes — this is the general pipeline's whole reason for existing |

The honest read: **Bakery V2 is not ahead of the general pipeline on
principles the pipeline lacks entirely** — it's ahead on *continuity*
(sequencing, scroll-as-time) and *earned spectacle* (a real 3D object, real
signature moments). Most of the individual principles above are already
present in some form on the general path; what's missing is the connective
tissue that turns independent good decisions into one arc.

## 6. Conclusion

See [docs/decisions/0005-experience-mode-is-a-directive-field.md](decisions/0005-experience-mode-is-a-directive-field.md)
for the architecture decision this audit supports.
