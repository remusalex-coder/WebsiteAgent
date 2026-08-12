# BusinessForge — Experience Engine Master Architecture Plan

_Status: Architecture reconstruction & decision record. Read-only study of the
repository at branch `design-director-smoke` (HEAD `7c69800`). **No source code,
tests, or snapshots were modified. No capability was implemented.** Every claim
below about the existing system was verified against `lib/**` source, not only the
documents, and is marked `VERIFIED` (read in code) or `DOC` (asserted by a doc but
not independently confirmed in this pass). Where a document contradicts the code,
the code wins and the discrepancy is recorded under §18 (Gaps & Contradictions)._

---

## 0. Why this document exists

The founder's question, stripped to its core:

> How do we turn BusinessForge from a system that **generates websites** into a
> system that **designs and executes individual, functional, verifiable web
> experiences** for each business — such that two businesses in the same industry
> receive materially different Experiences?

"Different" is defined to exclude colour/font/photo/text swaps and template
selection. It must reach **narrative arc, information hierarchy, pacing,
composition, imagery, typography, interaction, transitions, world/color journey,
signature moments, conversion strategy, density, navigation behaviour, and
experience mode.**

This document is the contract layer the next implementation session starts from.
It does not re-prove the research; it consolidates the two bodies of evidence
(Design Intelligence + the implemented deterministic experience system + Bakery V2)
into one coherent architecture, separates generic from specialized, and records the
decisions that are already made versus the ones the repository cannot yet answer.

---

## 1. Source base (all read)

### Design Intelligence (primary research — `C:\Users\40728\bf_research\`)
- `Design_Intelligence_Foundation.md` — timeless/premium/trend/fashion buckets,
  character→design matrix, bespoke-vs-template checklist, deterministic-floor vs
  AI-judgment framework.
- `AWWWARDS_PATTERN_LIBRARY.md` — 25 teardowns, cross-site patterns P-001…P-018,
  per-pattern deterministic/AI allocation, anti-clone rules.
- `From_Business_Evidence_to_Creative_Direction.md` — Double-Diamond pipeline
  (Stages A–H), the Character Vector, the concept-deliverable, the
  differentiation rule, the critique loop.

### Architecture / system docs (`docs/`)
- `architecture.md`, `renderer.md`, `experience-system.md`,
  `experience-capability-audit.md`, `design-intelligence-review.md`,
  `experience-architecture-v2.md`, `bakery-v2-technical-reference.md`,
  `canonical-bakery-v2.md`.
- ADRs `0001`–`0007`, especially `0005` (experience mode is a directive field),
  `0006` (experience is character-driven; order is a narrative), `0007` (content
  directed by narrative role, in the evidence language).

### Code (read in full or in part; the ground truth)
- `lib/design/`: `types.ts`, `character.ts`, `experience.ts`, `script.ts`,
  `conversion.ts`, `interaction.ts`, `assets.ts`, `plan.ts`, `compose.ts`,
  `directive.ts`, `quality.ts`, `worlds.ts`, `layout.ts`.
- `lib/render/`: `sections.ts`, `variants.ts`, `css.ts`, `fonts.ts`,
  `fontManifest.ts`, `document.ts`, `site.ts`, `theme.ts`.
- `lib/content/`: `director.ts`, `quality.ts`, `language.ts`, `evidence.ts`.
- `lib/experience/`: `types.ts`, `compose.ts`, `emit.ts`, `runtime.ts`,
  `shader.ts`, `styles.ts` (Bakery V2 — reference, not product).
- `lib/qa/visual-qa.ts`.
- `test/design/benchmark.test.ts`, `experience.test.ts`, `directive.test.ts`,
  `test/experience.contrast.test.ts`.

### Bakery V2 artifact
- `output/25e648c7/experience/` exists; the engine is reproducible via
  `scripts/build-experience.ts 25e648c7` (DOC: `canonical-bakery-v2.md`; the
  output dir itself is present on disk).

---

## 2. The fundamental principle — BusinessForge is a decision pipeline, not a generator

The architecture is a **straight-line stack of layers**, each owning one question.
The model is forbidden from jumping from business facts to CSS/JS/GLSL. It names
*intent* from a closed vocabulary; deterministic code executes *validated*
behaviour.

```
Business Evidence (profile + content + assets + research)
   │  deriveCharacter()                         [deterministic, no model]
   ▼
BusinessCharacter
   │  planExperience() / planConversion() / planInteraction() / planNarrativeOrder()
   │  + buildScript() / choreographAssets()     [deterministic, no model]
   ▼
Creative Direction (Experience Architecture + ExperienceScript + ConversionStrategy
                   + InteractionStrategy + AssetChoreography)
   │  (optional) AI Design Director             [validated closed-set override ONLY]
   ▼
Design Directive
   │  composeDesign(plan, content)              [deterministic]
   ▼
WebsiteDesign  (decision document: tokens, layout, world, experienceScript, …)
   │
   ├─► Renderer (Tier 1, static HTML/CSS, no JS)        [deterministic]
   └─► (future) Runtime host (Tier 2/3, opt-in)         [deterministic + guarded JS]
   │
   ▼
Functional Experience (navigable, responsive, accessible, converting, SEO-valid)
   │
   ▼
QA  (deterministic gates + browser/runtime checks + visual loop)
```

### Responsibility of each stratum

| Stratum | Owns | May NOT do | Verified in |
|---|---|---|---|
| **Business Evidence** | the raw, proven facts (no model-invented facts; merge-policy) | invent | `architecture.md`, `lib/sources/` |
| **Business Character** | measure the business's *kind* from evidence (visualWeight, register, breadth, narrativePotential, signatureCandidate) | taste, inference | `lib/design/character.ts` VERIFIED |
| **Creative Direction** | the *arc/shape*: mode, signature moment, conversion posture, interaction ceiling, narrative order, asset choreography | pick colours, durations, hex, GLSL | `lib/design/experience.ts`, `conversion.ts`, `interaction.ts`, `script.ts`, `assets.ts` VERIFIED |
| **Design Intelligence** | the vocabulary + floor rules that bound every choice (≤3 hues, AA, type scale) | override a business's facts | `Design_Intelligence_Foundation.md` |
| **Experience Architecture** | turn character into the Experience contract (data plan) | emit pixels | `lib/design/experience.ts` + `plan.ts` VERIFIED |
| **Experience Plan** | the concrete, named plan (Beat[] with roles, emphasis, ground) | invent copy | `lib/design/script.ts` `buildScript` VERIFIED |
| **Capability Selection** | map each plan field → one validated renderer/runtime capability | invent a new capability at runtime | `lib/render/*`, (future) `lib/runtime/*` |
| **Renderer / Runtime / Specialized Host** | execute named capabilities as validated markup/CSS/JS | accept free-form instructions | `lib/render/sections.ts` VERIFIED |
| **Functional Experience** | the deployed artifact | break accessibility/functionality | `renderer.md` |
| **QA** | prove it | — | `lib/design/quality.ts`, `test/`, `lib/qa/visual-qa.ts` VERIFIED |

The single invariant: **the AI decides INTENT; BusinessForge executes INTENT through
validated capabilities.** The model never emits arbitrary CSS, JS, runtime logic,
GLSL, animation values, hex codes, or DOM. This is enforced structurally
(`additionalProperties: false`, closed enums, `applyDirective` validation) and by
documents that the renderer ignores any unrecognized field.

---

## 3. BusinessForge defined

> BusinessForge reads **Business Evidence**, measures **Business Character**,
> derives **Creative Direction**, is bounded by **Design Intelligence**, produces an
> **Experience Architecture**, materializes an **Experience Plan**, selects
> **Capabilities**, executes through a **Renderer / Runtime / Specialized Host**,
> yields a **Functional Experience**, and proves it through **QA**.

It is **not** "an AI website generator" because the output is *derived from
character and evidence through deterministic orchestration*, not sampled from a
model conditioned on an industry label. The proof (see §6 and §18) is that two
same-industry businesses with different evidence receive different narrative order,
composition, pacing, imagery treatment, interaction level, and conversion path —
**today**, deterministically, at €0, with no model call (VERIFIED by
`test/design/benchmark.test.ts`, which asserts exactly this).

---

## 4. Bakery V2 as reference implementation, not template

The audit (`experience-capability-audit.md`) and the reconstruction
(`bakery-v2-technical-reference.md`) agree on the crucial point: **Bakery V2 is a
parallel renderer** (`lib/experience/`), reachable only through
`scripts/build-experience.ts` against a hardcoded fixture. It has **zero import
edges** into `main.ts`, `lib/design/`, or `lib/render/` (VERIFIED: the only
importers are the build script and a contrast test). The general pipeline and
Bakery V2 are **disjoint systems** — this is a *contract gap, not a capability
gap*.

### Principles & capabilities to GENERALIZE (transferable, not business-specific)

| Bakery V2 mechanism | Generic principle | Status in product | Source |
|---|---|---|---|
| `Scene[]` ordered, order = meaning | scroll → continuous state / a beat sequence is a data plan | `ExperienceScript` `Beat[]` is exactly this, statically | `script.ts` VERIFIED |
| `beats` × 100svh | scene → pacing | `pacing` exists; scroll-distance realization NOT yet | `experience.ts` VERIFIED; gap |
| `clock`/`marker` continuous timeline | state vector drives rendering | runtime-only; `--p/--vis` not yet in static renderer | gap (Tier 2) |
| per-scene `ground` colour journey | world → world-journey | `worlds.ts` `assignJourney()` **already does this** | `worlds.ts` VERIFIED |
| `veil` polarity-flip wash | transition → narrative connection | `.section--moment` wash exists (CSS, scroll-timeline); full veil needs runtime | `variants.ts` VERIFIED (partial) |
| `clip-path` handoff / inset wipe | clip-path → image choreography | pure CSS primitives exist conceptually; not wired to a `transition` enum | gap |
| sticky stage / full-bleed media | sticky stage → cinematic composition | `section--bleed`, hero `full-bleed` exist | `renderer.md`, `sections.ts` VERIFIED |
| state vector → visual state | `--p`/`--vis` → runtime-to-CSS contract | not yet (no scroll-progress var) | gap |
| loop-closing `coda` | narrative return to opening | content/order decision; no engineering needed | achievable today |
| loading curtain / skeleton | perceived performance | not in general renderer | gap (low priority) |

### Explicitly NOT to generalize (business-specific creative direction / specialized implementation)
- `DoughState` (rise/bake/heat/dolly/ferment/score/spring) — bread vocabulary.
- The SDF loaf, oven spring, crust, steam, score.
- The ten-scene Tartine script and its hand-authored copy (`compose()` is
  hand-written, not derived — `bakery-v2-technical-reference.md` §2.5).
- Specific photography (the 40 Tartine frames), `'Bakery'` hard-coded schema.org,
  filename-based photo casting (`pick('chad-turns-dough')`).
- The 22:00→07:30 clock as a literal device (the *concept* of a temporal narrative
  device is generalizable as an opt-in `narrativeDevice`; the *value* is not).

### Separation the plan enforces
- **generic capability** — reachable by any business, data-driven (e.g. `transition: 'veil'`).
- **reusable pattern** — a compositional technique (e.g. image choreography, world journey).
- **business-specific creative direction** — the *values* a business earns (e.g. this bakery's arc).
- **specialized implementation** — per-category engine (e.g. `lib/experience/` bakery shader), opt-in only.

---

## 5. Awwwards Pattern Library — used as knowledge base, not template gallery

The 25 teardowns are **evidence of principles**, not templates to copy
(`AWWWARDS_PATTERN_LIBRARY.md` §4). Each pattern P-001…P-018 is decomposed into:
the problem it solves, the context it works in, the business character it is
justified by, the effect on the visitor, the capability it requires, what is
deterministic, what needs runtime, what to avoid, and how it combines.

### Mechanism: Design Intelligence as inspiration, not imitation
1. Patterns are encoded as **capability vocabulary**, not as layouts. A business
   whose character matches P-011 (Poster-Scale Moment) *earns* a `signature` beat
   with `display` behaviour — it does not inherit Nexola's lime-on-black verbatim.
2. The **calibration set** role: the generator's output for a given character
   should land in the *neighbourhood* (type-scale ratio, palette size, hero-media
   type) of the matching subset of the 25, without copying any one site
   (`AWWWARDS_PATTERN_LIBRARY.md` §6).
3. **Anti-clone rules** (`§4`) are hard constraints: no exact layout/type/colour
   clone, no default "big text on black," no stock video, no system-font laziness,
   no cargo-cult WebGL, no industry colour cliché, no verbatim typeface reuse, no
   stripped nav on local-trust businesses.

This is exactly the doctrine in `Design_Intelligence_Foundation.md` §1.5:
"trends decorate; they do not decide." The Pattern Library is the *reference* the
Design Intelligence layer reads; it never becomes a selectable template.

---

## 6. Distinctness Engine — same industry ≠ same experience

Distinctness is **not** random variation. It is forced by the chain
`evidence → BusinessCharacter → ExperienceArchitecture → ExperienceScript`, because
`roleFor()` reads **character + evidence, not category** (`script.ts:103-128`),
and `planNarrativeOrder()` sorts along a narrative spine (`script.ts:137-200`).

`test/design/benchmark.test.ts` proves this today: a rich hotel and a thin hotel
(both `industry: hotel`) produce **different** narrative arcs; the thin one is an
honest `brochure`, the rich one earns `narrative` + gallery signature. `mechanic`
and `mechanicRich` (same industry) diverge; `eventVenue` earns `narrative`.

### Three conceptual examples in ONE industry — a craft bakery

(Scenario grounded in `experience-architecture-v2.md` §5.2; here extended to the
full requested axis matrix. All three are `industry: bakery`; they diverge on
**character**, which the evidence measures.)

**A — Craft / heritage bakery** (Tartine-shaped)
- *character*: `visualWeight: image-led`, `atmosphereRange: 6`, `emotionalRegister: craft`,
  `narrativePotential: strong`, `signatureCandidate: gallery`.
- *experience mode*: `narrative`.
- *narrative arc*: `emotion → reveal → signature → process → breadth → proof → conversion → coda`.
- *composition*: full-bleed signature gallery, `editorial` hero, asymmetric breakouts.
- *pacing*: `cinematic` (open vertical space per beat).
- *imagery*: original process photography, hero + signature + sequence + contrast beats.
- *typography*: editorial serif display + grotesk body; display-split behaviour.
- *interaction*: `guided` (ceiling `immersive`, recorded, not delivered).
- *transition*: a `veil`/wash at the signature crossing (after Phase 1–2).
- *conversion*: `editorial` mode, `reserve`/`order` verb, close-led placement.
- Tier-2 reachable: hero-object + veil if a runtime host is registered for `bakery`.

**B — Neighbourhood bread-&-cake counter**
- *character*: `visualWeight: balanced`, `atmosphereRange: 2`, `emotionalRegister: warm`,
  `narrativePotential: latent`, `signatureCandidate: null` (no single hero image).
- *experience mode*: `showcase`.
- *narrative arc*: `arrival → reveal → breadth (menu/cake) → trust (reviews) → conversion (order) → context`.
- *composition*: gallery-led full-bleed imagery, `split`/`magazine` hero, predictable grid.
- *pacing*: `measured`.
- *imagery*: product photography as the subject; **no** hero object, **no** veil.
- *typography*: friendly humanist sans, restrained.
- *interaction*: `subtle`/`guided`.
- *transition*: a `wipe` at the gallery lead, no polarity flip.
- *conversion*: `balanced`, `order` verb, hero-and-close placement.

**C — Wholesale bakery supply / B2B distributor**
- *character*: `visualWeight: text-led`, `atmosphereRange: 1`, `emotionalRegister: functional`,
  `narrativePotential: none`, `signatureCandidate: null`.
- *experience mode*: `brochure`.
- *narrative arc*: `arrival → breadth (services) → context (hours/delivery) → conversion (call/quote) → coda`.
- *composition*: standard 12-col, persistent nav, phone in first screen.
- *pacing*: `compact`.
- *imagery*: intentionally reduced (text argues, not pictures).
- *typography*: legible humanist sans, no display theatrics.
- *interaction*: `static`.
- *transition*: none.
- *conversion*: `high-intent`, `call`/`quote` verb, persistent placement, immediate contact.

All three are derived from **evidence**, none from random variation. Same industry,
three Experiences differing in narrative order, composition, pacing, imagery,
interaction, and conversion — exactly the founder's test.

---

## 7. Experience Vocabulary — current reality (verified, not assumed)

The brief demands a table that does **not** fill from assumption. Each cell below
is marked against the six verification lenses: **Documented** (a doc describes it),
**Contract** (a type/models it in `lib/design` or `lib/render`), **AI can decide**
(a Director field nominates it), **Renderer** (the static renderer executes it),
**Runtime** (a client runtime would be needed), **Specialized Host** (Bakery V2
proves it), **QA** (a gate checks it).

Legend: ✅ present · 🟡 partial · ❌ absent · — N/A

| Capability | Documented | Contract (in code) | AI can decide | Renderer (static) | Runtime needed | Specialized Host (Bakery) | QA |
|---|---|---|---|---|---|---|---|
| **experience mode** (brochure/showcase/narrative/immersive) | ✅ | ✅ `ExperienceArchitecture.mode` | ✅ `experienceIntent.mode` (capped) | ✅ consumed (drives layout) | — | — | ✅ `scoreExperience` |
| **arc / narrative order** | ✅ | ✅ `ExperienceScript.arc` / `Beat[]` | ❌ (derived) | ✅ `data-role` + order | — | — | ✅ `narrativeCoherence` |
| **pacing** (compact/measured/cinematic) | ✅ | ✅ `ExperienceArchitecture.pacing` | ❌ | 🟡 density only; scroll-distance NOT | 🟡 needed for cinematic | — | ❌ (no pacing QA) |
| **world journey** (ground sequence) | ✅ | ✅ `worlds.ts assignJourney()` | ❌ | ✅ `ground()` rebinds ink | — | — | ✅ contrast per ground |
| **moment / signature** | ✅ | ✅ `signatureMoment` + `SectionDesign` role | ✅ `experienceIntent.moment` | ✅ `section--moment` + `section--signature-composition` | — | — | ✅ (build) |
| **transition** (veil/wipe/handoff) | ✅ (ADR0005) | 🟡 `momentTransition: boolean` only | 🟡 boolean only | 🟡 one CSS wash at moment | 🟡 full veil needs JS | ✅ Bakery `wash()` | ❌ product sweep |
| **density** (airy/balanced/dense) | ✅ | ✅ `VisualDensity` | ❌ (narrowed by pacing) | ✅ tokens | — | — | ✅ |
| **CTA behaviour** | ✅ | ✅ `ConversionStrategy` | ✅ `conversionMode` | ✅ placement/verb | — | — | ✅ (functional) |
| **image choreography** | ✅ | ✅ `AssetChoreography` | ❌ (derived) | 🟡 hero/signature/reduce; contrast beats NOT visually wired | 🟡 handoff needs JS | ✅ 3D→photo | ✅ rights flag |
| **typography behaviour** | ✅ | 🟡 `FontRole` + scale; no per-beat behaviour field | ❌ | 🟡 display/hero via variant; per-scene switch hard-coded in Bakery only | — | ✅ Bakery Y-styles | ✅ contrast |
| **interaction** (static→immersive) | ✅ | ✅ `InteractionStrategy.level/ceiling` | ✅ `interactionLevel` (capped) | 🟡 up to `guided` meaningfully; `immersive` dead | ✅ needed for immersive | ✅ Bakery runtime | 🟡 reduced-motion only |
| **composition** (variant/frame as unit) | ✅ | ✅ `SectionVariant`×`SectionFrame` | ❌ | ✅ `VARIANTS`+`renderFrame` (consumed) | — | ✅ 9 `SceneKind`s | ✅ `renderer-coverage` |
| **scroll progress** (`--p`/`--vis`) | ✅ (v2 doc) | ❌ | ❌ | ❌ | ✅ needed | ✅ Bakery `sample()` | ❌ |
| **veil** | ✅ | 🟡 boolean only | 🟡 boolean | 🟡 wash primitive | 🟡 JS for polarity flip | ✅ Bakery | ❌ |
| **sticky stage** | ✅ | ✅ hero/full-bleed | ❌ | ✅ | — | ✅ Bakery | ✅ |
| **scene kinds** (distinct compositions) | ✅ | ✅ 16 `SectionVariant` + 7 `HeroVariant` + 5 `SectionFrame` | ❌ | ✅ | (Tier 2 could add) | ✅ 9 `SceneKind`s | ✅ |
| **runtime** (client playhead) | ✅ | ❌ (`lib/runtime` absent) | n/a | n/a | ❌ NOT BUILT | ✅ Bakery `runtime.ts` | ❌ |
| **specialized host** (per-category WebGL) | ✅ | ❌ (no registry) | selects class only | n/a | n/a | ✅ `lib/experience/` (bakery) | 🟡 Bakery-only harness |

**Reading the table honestly:**
- **Already implemented & shipped:** experience mode, narrative arc/order, pacing
  (as density), world journey, moment/signature, density, CTA behaviour,
  composition (variant×frame), sticky stage, scene kinds, reduced-motion,
  accessibility, content directed by role, language-of-evidence.
- **Partial:** transition (boolean, one CSS wash), image choreography (roles
  computed, contrast beats not visually exploited), typography behaviour (no
  per-beat field), interaction ceiling (intent recorded, delivery capped).
- **Proposed/documented only:** `transition` enum, scroll-progress `--p/--vis`,
  generic `lib/runtime`, specialized-host registry, continuous-experience QA.

---

## 8. Contracts between layers

We **start from existing contracts** and propose only the minimal extensions the
evidence demands. No arbitrary JSON is invented where a type already exists.

### 8.1 Existing contracts (do not replace)
- `BusinessCharacter` (`lib/design/character.ts`) — measured axes.
- `ExperienceArchitecture` (`experience.ts`) — `mode`, `signatureMoment`,
  `momentTransition`, `galleryLead`, `pacing`.
- `ExperienceScript` (`script.ts`) — `Beat[]` with `role/emphasis/background/
  pacing/visualIntensity/isTransition/isSignature`, plus `arc/opening/signature/
  conversionAt/basis`.
- `ConversionStrategy`, `InteractionStrategy`, `AssetChoreography`.
- `WebsiteDesign` (`types.ts`) — the artifact carrying all of the above plus
  `layout`, `tokens`, `world`.
- `DesignDirective.experienceIntent` (ADR 0005) — `mode: 'standard'|'moment-led'`,
  `moment`, `momentIntent`, `transitionAtMoment`.

### 8.2 Proposed extensions (with justification)

**E1 — Widen `momentTransition: boolean` → `transition: 'none'|'veil'|'wipe'|'circular-handoff'`**
- *Why:* ADR 0005 collapses veil vs wipe vs handoff into one bit; the audit row
  "Whiteout/veil transition = NO" confirms the gap.
- *Problem solved:* lets two businesses with a moment differ in *how* the moment is
  marked (a bakery's veil vs a hotel's wipe).
- *Produced by:* `planExperience` (or Director override).
- *Consumed by:* renderer `variants.ts` (CSS primitives) / future runtime.
- *Validated by:* closed-enum; contrast/reduced-motion gates.

**E2 — Add `narrativeDevice: 'none'|'clock'` (opt-in) to `BusinessCharacter`**
- *Why:* G11 — no signal exists to recognize a business whose evidence supports a
  temporal/clock arc (Bakery's 22:00→07:30).
- *Problem solved:* a Director may nominate a clock HUD only when the character
  earns it; never a default.
- *Produced by:* `deriveCharacter` (evidence-gated).
- *Consumed by:* (future) runtime/renderer narrative device.
- *Validated by:* evidence gating; reduced-motion disables.

**E3 — Add `handoff` concept to `AssetChoreography`**
- *Why:* G14 — I3 (3D→photography handoff) is pure CSS but its origin is
  hard-coded in Bakery (`52% 44%`); must become derived.
- *Produced by:* `choreographAssets`.
- *Consumed by:* renderer transition primitive.
- *Validated by:* origin derived from hero-object offset or `handoffOrigin` field.

**E4 — Widen `DesignDirective.experienceIntent` to override `mode`/`ceiling` only**
- *Why:* G3 — the ADR 0005 field cannot express `narrative`/`showcase`/`brochure`
  (those are derived) and its `moment` is a `SectionKind`, not a script role. The
  Director should *override* mode/ceiling, never re-derive the whole arc.
- *Produced by:* AI Director.
- *Consumed by:* `applyDirective` → `planExperience`/`planInteraction`.
- *Validated by:* closed set; invalid value leaves deterministic floor standing
  (ADR 0004 rule).

**E5 — Register specialized hosts (future `lib/runtime/` + host registry)**
- *Why:* the contract connecting `InteractionStrategy.ceiling === 'immersive'` to
  a per-category engine does not exist.
- *Produced by:* a host registry keyed by business class + registered shader.
- *Consumed by:* a future runtime host (NOT `lib/experience/`).
- *Validated by:* the Director selects the *class*, never the GLSL; WebGL fallback
  must be designed, not a black rectangle.

> All five extensions keep `additionalProperties: false` and closed enums. None
> introduces a model-writable measurement, colour, or duration.

---

## 9. Renderer vs Runtime vs Specialized Host (three tiers)

### Tier 1 — Deterministic renderer (already exists)
`lib/render/` produces complete static HTML+CSS with **no JS**. It can already
realize: experience mode, narrative order, moment marker (`section--moment`),
signature composition, world journey, density, composition (variant×frame),
full-bleed/sticky heroes, gallery lead, CTA behaviour, accessibility, reduced
motion. **A fully functional, distinct Experience is deliverable at Tier 1 today**
(VERIFIED: `--compose` produces business-specific pages with no model, proven by
the benchmark). This is the floor that can never be violated.

### Tier 2 — Generic experience runtime (NOT yet built)
A small, **bread-free** `lib/runtime/` extracted from Bakery's `runtime.ts`:
scroll playhead (`sample()`), `--p`/`--vis` contract, boundary-band ground blend,
veil wash, line-split reveal, presence/draw-skip, FPS auto-degradation,
WebGL-context-loss fallback. It contains **no business vocabulary**. It is opt-in:
engaged only when a capability requires JS *and* `prefers-reduced-motion`/coarse
guards pass; otherwise the Tier-1 Experience renders unchanged.

### Tier 3 — Specialized immersive hosts (reference: `lib/experience/` bakery)
Per-category engines (WebGL hero object, category-specific shaders). **Opt-in and
controlled**: the Design Director selects the *business class*, never the GLSL.
`lib/experience/` is the reference implementation for class `bakery` only — it is
NOT merged into the product renderer and NOT generalized. A host is activated by
the contract in §8 E5, never by the model writing shader code.

**How the Director selects a host without generating it:** the Director emits
`interaction.ceiling: 'immersive'` + (future) a `hostClass: 'bakery'`. The runtime
registry resolves `hostClass` to the registered engine. If no host is registered,
or reduced-motion is set, the system falls back to Tier 1. The model never touches
the engine's internals.

---

## 10. Functionality — invariants that cannot be violated

An Experience is **not** an art experiment. The following hold at every tier
(structural invariants, asserted by `narrativeCoherence` + renderer + QA):

- **Navigable** — persistent header nav is the *default*; guided/immersive paths
  ADD a skip link, never remove nav unless `immersive` *and* a human gated it.
- **Responsive** — `ResponsiveSystem` fluid; mobile collapse; immersive runtimes
  reflow and replace scrubbed carousels with native swipe.
- **Accessible** — `AccessibilityPreferences` (AA/AAA, tap targets, landmarks,
  skip link, `respectReducedMotion`) mandatory on every Experience.
- **CTA-functional** — `ctaBehavior` is independent of visual mode; Bakery's
  `threshold` scene proves a cinematic page is still a shopfront.
- **Contact/conversion paths functional** — `Practical`/`contact` beat always in
  the arc; `conversionMoment` anchors the push; phone/email as `tel:`/`mailto:`
  with safe href allow-list.
- **SEO-valid** — one `<h1>`, landmarks, `lang`, JSON-LD (facts from profile, never
  from the model).
- **No invented information** — facts come from `merge.ts` policy; the model is
  never asked for certifications, testimonials, hours, prices.
- **Graceful degradation** — reduced-motion → static state; no-WebGL → designed
  fallback (Bakery proves: no-GL + no veil, static ground, still legible).
- **Reduced-motion safe** — `prefers-reduced-motion` honoured at token + runtime.
- **Performant** — Core Web Vitals budget; no web fonts fetched over network
  (faces vendored/inlined); FPS auto-degradation for any continuous rendering.

**Rule:** no `ExperienceScript` may place `conversion` off-page or delete a
`contact` beat. `buildScript` pins hero first, closing CTA last; the renderer
appends any section the plan forgot.

---

## 11. QA

Lessons taken from Bakery V2 (`canonical-bakery-v2.md`, `verify-experience.mjs`)
and the general pipeline (`lib/design/quality.ts`, `lib/qa/visual-qa.ts`).

### 11.1 What to check
| Axis | Deterministic (code) | Browser/Runtime | Visual (human/vision) |
|---|---|---|---|
| Content integrity (no invented facts) | ✅ `auditContent` (12 defect classes) | — | — |
| Business facts | ✅ evidence-index check | — | — |
| Accessibility (AA/AAA) | ✅ token contrast | ✅ keyboard 8-stop, focus ring | — |
| Contrast | ✅ `ColorSystem.contrast` | ✅ scroll-contrast sweep (Bakery) | — |
| Keyboard | — | ✅ `verify-experience.mjs` mode 4 | — |
| Responsive | ✅ fluid + breakpoints | ✅ 390px overflow check | — |
| Overflow | — | ✅ `publish-run` mechanical suite | — |
| CTA functionality | ✅ `conversionMoment` present | ✅ click → tel/mailto | — |
| Reduced motion | ✅ token `respectReducedMotion` | ✅ no-GL, time frozen (Bakery) | — |
| Runtime unavailable | — | ✅ no-WebGL designed fallback | — |
| WebGL unavailable | — | ✅ fallback path | — |
| Visual transitions | 🟡 `section--moment` wash exists | ❌ product sweep absent | ✅ visual-qa loop |
| Scroll states | ❌ (`--p` not in static) | ❌ | ✅ visual-qa |
| Signature moments | ✅ `isSignature` asserted | ✅ Bakery 220-position | ✅ |
| Performance | ✅ Vitals budget (tokens) | ✅ Bakery 1531ms/61fps | — |
| Distinctness | ✅ `genericityReport` | — | — |

### 11.2 Three QA classes, explicitly separated
- **Deterministic QA** — runs with no browser: `scoreExperience`,
  `narrativeCoherence`, `genericityReport`, `auditContent`, token contrast,
  `renderer-coverage`. These gate every build.
- **Browser/Runtime QA** — real browser: keyboard, scroll-contrast, reduced/no-WebGL,
  overflow, CTA click. Exists for Bakery (`verify-experience.mjs`); must be ported
  to the product for any Tier-2/3 capability (G15).
- **Visual QA** — `lib/qa/visual-qa.ts` captures screenshots and asks a vision
  model for layout/spacing/overflow/typography defects, patches targeted, re-checks
  to a budget. This is the *only* place a model "sees"; it never touches facts.

**Auto vs human:** structure, contrast, coherence, content-integrity, distinctness,
factual-integrity are **automatable and must be automatic**. Compositional taste,
"does it feel premium," signature-moment impact are **visual-loop / human-review**.

---

## 12. Creative Direction vs Design — where the line is drawn

| Layer | Question it answers | Output | Verified location |
|---|---|---|---|
| Business Evidence | what are the facts? | `BusinessProfile`+`WebsiteContent` | `lib/sources`, `lib/art` |
| Creative Direction | what should visiting *feel like* as a sequence? | `ExperienceArchitecture`+`ExperienceScript`+`Conversion`+`Interaction`+`Assets` | `lib/design/experience.ts`,`script.ts`,`conversion.ts`,`interaction.ts`,`assets.ts` |
| Experience Architecture | how is that derived deterministically? | the plan functions | `lib/design/plan.ts` |
| Design System | how does it *look*? | tokens, world, type scale, colour | `lib/design/{tokens,worlds,themes}.ts` |
| Layout Plan | how is each section composed? | `LayoutPlan` (variant/frame/emphasis/order) | `lib/design/layout.ts` |
| Experience Plan | what is the ordered story? | `ExperienceScript` | `lib/design/script.ts` |
| Renderer implementation | what is the markup/CSS? | `index.html`+`styles.css` | `lib/render/*` |

**Creative decision lives in:** `planExperience`/`planNarrativeOrder` (deterministic
derivation from character) and, optionally, the AI Director's validated closed-set
overrides (`mode`, `moment`, `cta` verb, `interaction` ceiling). **Technical
execution begins at** `composeDesign` → `renderSite`. The model never crosses from
the left column to the right one with free-form output.

---

## 13. Anti-patterns (what BusinessForge must NOT do)

Codified from `Design_Intelligence_Foundation.md` §16, ADR 0005/0006,
`experience-architecture-v2.md` §13, and the Awwwards anti-clone rules:

1. **Template selection based only on industry** — mode is derived from character
   (ADR 0006), never assigned by category.
2. **Colour/font swapping presented as personalization** — character-driven, not
   industry cliché (navy-law / red-restaurant forbidden).
3. **AI-generated arbitrary CSS** — model names intent from closed sets only.
4. **AI-generated arbitrary JS** — no runtime logic from the model.
5. **AI-generated GLSL** — model selects host *class*, never shader code.
6. **Copying Awwwards sites** — patterns are vocabulary, not templates.
7. **Copying Bakery V2 wholesale** — `lib/experience/` stays specialized.
8. **Making immersive behaviour default everywhere** — `immersive` is top rung,
   reachable only when evidence earns it + a runtime host exists; `brochure` is
   the correct answer for thin businesses.
9. **Sacrificing conversion for spectacle** — functionality is a structural
   invariant.
10. **Motion without narrative purpose** — a transition is earned by a real moment
    in a narrative (or a showcase craft exception), never as decoration.
11. **Adding effects merely because they exist** — every capability is opted into
    by evidence, not available-by-default.
12. **Inventing business facts** — facts from merge policy; model never asked.
13. **Using WebGL where evidence does not justify it** — Tier D is per-class,
    opt-in, with designed fallback.

---

## 14. Implementation Roadmap (dependency order, no coding now)

Status of each phase against the repo:
- **Already implemented** — experience mode, narrative arc/order, moment, world
  journey, density, CTA, composition, content-by-role, language, accessibility,
  reduced-motion, the benchmark.
- **Partially implemented** — transition (boolean), image choreography (roles, not
  visual exploitation), typography behaviour (no per-beat field), interaction
  ceiling (intent recorded, delivery capped).
- **Documented but not implemented** — `transition` enum, `--p`/`--vis`, generic
  `lib/runtime`, host registry, continuous-experience QA.
- **New implementation required** — Phases 1–5 below (Tier-2/3 delivery).

| Phase | Objective | Files / contracts affected | Dependency | Expected capability | Risks | Verification | Definition of done |
|---|---|---|---|---|---|---|---|
| **0** | Guard the name collision | comment in `lib/design/experience.ts` + `lib/experience/` | none | clarity | confusion in future agents | none | both files state distinct roles |
| **1** | Vocabulary widening (deterministic) | `experience.ts` `transition` enum; `character.ts` `narrativeDevice`; `assets.ts` `handoff`; `directive.ts` E4 | ADR 0005/0006 | distinct transition types per business | over-widening Director surface | benchmark asserts 3 bakeries diverge on `transition`/`arc`/`pacing` | types widened; tests pass |
| **2** | CSS-only connective tissue (no JS) | `variants.ts` realize `transition` as inset/directional wipe + derived-origin circular handoff; promote `worlds.ts` journey to boundary transition | Phase 1 | static renderer expresses veil/wipe/handoff | hard-coded origins (T6 leak) | `renderer-coverage` shows fields USED; snapshots hold | new fields consumed; no JS |
| **3** | Small generic runtime `lib/runtime/` (Tier 2) | new `lib/runtime/` extracted from `runtime.ts` (bread-free): `sample`, `--p/--vis`, ground band, veil, line-split, FPS degrade, context-loss fallback | Phase 2 | scroll-driven state without WebGL dependency | baking bread vocab into core | reduced→static; no-WebGL→fallback; 60fps | runtime host exists, gated |
| **4** | QA harness for continuous experiences | port `verify-experience.mjs` sweep + keyboard + motion modes into product; extend `genericityReport` to Experience axes | Phase 3 | product-grade runtime QA | harness false-negatives | 220-position sweep green; genericity covers narrative/transition/hero-treatment | G15/G16 closed |
| **5** | Specialized WebGL as opt-in domain module (Tier 3) | register `lib/experience/` (bakery) as reference host for class `bakery`; fix `'Bakery'` hard-code to read category | Phase 3 + registry E5 | one immersive host, selected by class | second shader before evidence earns it | reduced/no-WebGL fallback valid; contrast sweep green | host reachable via contract, not merged |

> Phases 1–2 are shippable now (deterministic, no runtime). Phases 3–5 are the
> remaining large build, intentionally deferred per ADR 0006/0007. **No phase
> begins coding in this document's scope.**

---

## 15. Architectural decisions

Each decision records Decision / Reason / Evidence / Alternative rejected /
Consequence. The 17 questions from the brief are answered explicitly.

**1. What is the Experience Engine?**
The deterministic derivation `BusinessCharacter → ExperienceArchitecture →
ExperienceScript` (plus Conversion/Interaction/Assets), executed by the renderer,
optionally extended by a runtime host. *Reason:* the audit proved the gap is
connective tissue, not a second system. *Evidence:* `experience-system.md`,
ADR 0006. *Rejected:* a new pipeline layer (ADR 0005). *Consequence:* AI decides
intent; code executes.

**2. What is its contract?**
`WebsiteDesign.experience` + `experienceScript` + `conversion` + `interaction` +
`assets`, all produced by `planNarrative`. *Reason:* reuse existing artifact.
*Evidence:* `types.ts:584-634`. *Rejected:* a new top-level `ExperienceSpec`
(ADR 0005). *Consequence:* no new import edges.

**3. What is generic?**
Mode, arc/order, moment, world journey, density, CTA, composition, transition
(vocabulary), image choreography, scroll-progress contract, veil/wipe primitives,
generic runtime. *Reason:* portable without domain knowledge. *Evidence:*
`experience-architecture-v2.md` §2/§3. *Consequence:* these ship to all businesses.

**4. What is specialized?**
Per-category shader/hero-object (Bakery loaf), the ten-scene Tartine script,
`DoughState`, photography casting. *Reason:* bread vocabulary is not universal.
*Evidence:* `bakery-v2-technical-reference.md` §12/§20.6. *Consequence:* opt-in,
isolated in `lib/experience/` as a reference host.

**5. How is distinctness produced?**
`evidence → BusinessCharacter → ExperienceArchitecture → ExperienceScript`, with
`roleFor()` reading character not category. *Reason:* forces divergence from
facts. *Evidence:* `script.ts:103-200`, benchmark. *Consequence:* same-industry
businesses diverge.

**6. Who decides experience mode?**
Deterministic `planExperience` primarily; the AI Director may override `mode`
(capped at `narrative`, since `immersive` has no runtime). *Reason:* ADR 0004/0005.
*Consequence:* invalid override leaves floor standing.

**7. Who decides scene sequence?**
`planNarrativeOrder` (deterministic), from character + experience. The Director
does not reorder; it may only nudge `mode`. *Reason:* order is a narrative, not a
taste dial. *Evidence:* ADR 0006. *Consequence:* order is reproducible, €0.

**8. How are moments represented?**
`ExperienceArchitecture.signatureMoment: SectionKind | null` + `Beat.isSignature`
on the script + `SectionDesign.role === 'signature'` → `section--signature-composition`
+ `momentTransition` → `section--moment` wash. *Reason:* one closed-set nomination.
*Evidence:* `types.ts:492-506`, `sections.ts:1231-1236`. *Consequence:* at most one
moment per page.

**9. How are transitions represented?**
Today: `momentTransition: boolean` → one CSS wash. Proposed: `transition` enum
(veil/wipe/circular-handoff) at a boundary, realized by renderer/runtime. *Reason:*
ADR 0005 gap G1. *Consequence:* distinct moment-marking per business.

**10. Where does the runtime live?**
Tier 1: `lib/render/` (no JS). Tier 2: future `lib/runtime/` (bread-free). Tier 3:
`lib/experience/`-style hosts (per category). *Reason:* keep general renderer
JS-free by default; isolate continuous behaviour. *Evidence:* `renderer.md`,
`bakery-v2-technical-reference.md` §0.2. *Consequence:* `lib/experience/` is NOT
the product runtime.

**11. How does runtime connect to renderer?**
A capability is *named* in the plan; the renderer/runtime maps it to one validated
implementation. `--p/--vis` (future) is the runtime→CSS contract. *Reason:* model
never writes primitives. *Evidence:* `experience-architecture-v2.md` §6.2.

**12. How are specialized hosts activated?**
By contract (E5): `interaction.ceiling === 'immersive'` + registered `hostClass`;
the Director selects the class, never the GLSL; fallback to Tier 1 on missing host
/ reduced-motion / no-WebGL. *Reason:* anti-pattern #7. *Consequence:* controlled
opt-in.

**13. How to prevent template convergence?**
Character-driven derivation + `genericityReport` (template-smell test fails on ≥2
collapsed identity axes) + bespoke-vs-template checklist. *Reason:* ADR 0006 rule
1. *Evidence:* `quality.ts:226`, benchmark. *Consequence:* divergence is enforced,
not hoped for.

**14. How to prevent AI hallucination?**
Facts from `merge.ts` policy; model never asked for certifications/testimonials/
hours; `auditContent` rejects fabricated claims (12 classes); `quoted` values must
appear verbatim in evidence. *Reason:* architecture.md "Facts a model is never
asked for." *Evidence:* ADR 0007. *Consequence:* fabricated pages rejected.

**15. How to guarantee functionality?**
Structural invariants (§10) + `narrativeCoherence` + renderer append-forgotten +
CTA-independent-of-mode. *Reason:* "Functional conversion = YES" (audit §5).
*Consequence:* an Experience is always a working website.

**16. How to guarantee QA?**
Three classes (§11.2); deterministic gates on every build; browser/runtime harness
ported for Tier 2/3 (G15); visual loop for taste. *Reason:* Bakery proved the
discipline transfers. *Consequence:* regressions caught locally.

**17. What NOT to generalize from Bakery V2?**
`DoughState`, the loaf/oven/steam/score, the Tartine script, specific photography,
`'Bakery'` hard-code, filename casting. *Reason:* bread-specific. *Evidence:*
`bakery-v2-technical-reference.md` §10/§13. *Consequence:* these stay in
`lib/experience/`.

---

## 16. Master Principle — why BusinessForge is not "just an AI website generator"

**Answer (architectural, not marketing):**

An AI website generator conditions a model on an industry label and samples a
site — output varies by prompt luck, converges on category clichés, and cannot
guarantee functionality or distinctness.

BusinessForge instead runs a **deterministic character→experience derivation** in
which:
1. **Evidence is measured, not imagined** — `deriveCharacter` reads visual weight,
   register, breadth, narrative potential, signature candidate from real assets
   and words (`character.ts` VERIFIED).
2. **The Experience is a derived data plan** — `planExperience`/`planNarrativeOrder`
   turn character into mode, arc, moment, pacing, conversion, interaction
   (`experience.ts`,`script.ts` VERIFIED).
3. **The model only names intent** from closed sets; it never emits CSS/JS/GLSL
   (ADR 0004/0005 boundary, enforced in `directive.ts`).
4. **Distinctness is structural, not decorative** — `roleFor()` reads character, so
   two same-industry businesses with different evidence produce different arcs
   (benchmark VERIFIED: rich vs thin hotel; mechanic vs mechanicRich).
5. **Functionality and QA are invariants**, not aspirations (§10, §11).
6. **Bakery V2 is a reference host, not the engine** — the engine is the generic
   deterministic layer; immersive behaviour is opt-in, gated, and fallback-safe.

The difference is provable: the repository *already* renders distinct, functional,
QA-valid Experiences for same-industry businesses at €0 with no model call. The
generator metaphor fails because there is no sampling step in the product path —
there is a measurement step, a derivation step, and an execution step, each
reviewable on the artifact (`WebsiteDesign.experienceScript` carries the whole
story).

---

## 17. What this plan does NOT claim

- It does **not** implement any phase. All code references are descriptive.
- It does **not** modify tests or snapshots.
- Where the repository cannot demonstrate a capability, the cell is marked ❌ or
  `UNKNOWN` (see §18).

---

## 18. Gaps, contradictions, and UNKNOWN findings

### 18.1 Stale documents (code has moved past them)
- **`design-intelligence-review.md` (2026-08-06) is partly obsolete.** It states
  "the layout plan is thrown away at the renderer boundary" and "hero variants are
  one composition wearing five names." **The current code consumes
  `variant`/`frame`/`emphasis`/`data-role`/`momentTransition`** (`sections.ts`
  VERIFIED) and the experience system is built and benchmarked (ADR 0006/0007,
  2026-08-11). Treat that review's "template" conclusion as the *pre-fix* state.
- **Fonts:** the review says "no web fonts" and "nine typefaces render as two."
  **Current `lib/render/fonts.ts` + `fontManifest.ts` emit `@font-face` for the
  faces a design uses, vendored locally, no network** (VERIFIED). The "binary
  typeface" finding is outdated — faces are now shipped (subject to availability of
  the vendored files, which was not separately confirmed on disk).
- The review's "two categories produce identical sites" (jewellery/retail) and
  "photography classifies as `general`" are **real, still-open gaps** (G13, ADR
  0007) and remain valid.

### 18.2 Documented-but-unbuilt (gaps)
- **G1** `transition` is a boolean, not an enum (ADR 0005 scope).
- **G2/G8** no `lib/runtime/`; `immersive` is defined but unreachable.
- **G5/G6** no scroll-progress `--p`/`--vis` in the static renderer.
- **G7** `renderer-coverage.ts` cannot see Tier-2 fields (live outside `WebsiteDesign`).
- **G9** no product FPS/context-loss fallback host.
- **G10** `interaction.ceiling: 'immersive'` is recorded but dead (no delivery).
- **G11** no `temporalArc`/`narrativeDevice` signal.
- **G12** section copy still partially generic for non-hero beats (ADR 0006 debt).
- **G13** `classifyIndustry` has no `venue` category (ADR 0007).
- **G14** no `handoff` concept in `AssetChoreography`.
- **G15** no continuous-experience QA harness in the product.
- **G16** `genericityReport` does not yet cover narrative-order/transition/hero-treatment axes.

### 18.3 Contradictions surfaced
- **Doc dates vs code:** `design-intelligence-review.md` (Aug 6) describes a
  pre-experience-system world; `experience-architecture-v2.md` (Aug 12) describes
  the built system. The latter matches the code; the former is historical.
- **`immersive` mode:** `experience.ts` declares it "defined but never selected,"
  while `interaction.ts` records `ceiling: 'immersive'` for narrative+image-rich
  businesses. These are consistent (intent vs delivery) but easy to misread as a
  contradiction — recorded here as *intent captured, delivery absent*.

### 18.4 UNKNOWN (cannot be demonstrated from the repository)
- **`UNKNOWN`** — whether the *critique loop* (`From_Business_Evidence…` §9) has any
  implementation. No code reference found; ADR 0007 leaves the AI writer explicitly
  unbuilt. Treated as proposed-only.
- **`UNKNOWN`** — whether vendored font files physically exist on disk for the
  `@font-face` rules (`fonts.ts` references `VENDORED_FACES`; the actual font
  binaries were not confirmed in this pass).
- **`UNKNOWN`** — the *real* runtime cost/perf of a generic `lib/runtime/` (Phase
  3) on low-end mobile; Bakery's 61fps is measured only for the bakery fixture.
- **`UNKNOWN`** — whether `genericityReport`'s `narrativeOrder` axis actually
  catches convergence (the field exists in the identity-axes list; no failing test
  was located that exercises it specifically).
- **`UNKNOWN`** — localization of the Character Vector for non-Western/S Romanian
  SMB context (open question in `From_Business_Evidence…` §13) — no code resolves
  it; Romanian *is* handled for register words, but the *vector semantics* are
  unvalidated cross-culturally.

---

## 19. Final deliverable checklist
- [x] All 3 Design Intelligence sources read.
- [x] All 8 architecture/experience docs read.
- [x] ADRs 0005/0006/0007 read in full; 0001–0004 skimmed for context.
- [x] Bakery V2 docs + `lib/experience/*` code read; artifact dir confirmed present.
- [x] `lib/design`, `lib/render`, `lib/content`, `lib/qa` read against docs.
- [x] Capability vocabulary table built from **verified** code state, not assumption.
- [x] Distinctness engine demonstrated with 3 same-industry scenarios.
- [x] Contracts enumerated; 5 minimal extensions proposed (E1–E5) with justification.
- [x] Three tiers defined; Director-selects-host-without-generating-it mechanism specified.
- [x] Functionality invariants listed.
- [x] QA split into deterministic / browser / visual.
- [x] 17 architectural decisions recorded with Reason/Evidence/Alternative/Consequence.
- [x] Roadmap in dependency order; already-implemented vs proposed separated.
- [x] Master Principle answered architecturally.
- [x] Gaps, stale-doc corrections, and UNKNOWN findings recorded.
- [x] No source, test, or snapshot modified.

---

_End of master plan. The next implementation session may begin at Phase 0/1 without
re-doing the research — every claim above is cited to a file in the repository._
