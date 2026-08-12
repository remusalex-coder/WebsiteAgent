# Experience Architecture v2 — Research & Architectural Reconstruction

_Read-only study, 2026-08-12. No source file modified, no test modified, no snapshot
regenerated, no recovery CSS created, nothing committed._

**Scope.** This document studies two bodies of evidence together and reconstructs the
BusinessForge *experience* architecture — the layer between Business Character and the
renderer that decides what visiting a business's page *feels like as a sequence of
moments*, not merely what it looks like.

**Evidence read in full:**

- Architecture: `docs/architecture.md`, `docs/renderer.md`, `docs/folder-structure.md`
- The general (product) experience system: `docs/experience-system.md`,
  `docs/experience-capability-audit.md`, `docs/canonical-bakery-v2.md`,
  `docs/decisions/0005`, `0006`, `0007`
- The general pipeline source: `lib/design/{character,experience,script,conversion,interaction,assets,types,plan,quality}.ts`
- The Bakery V2 engine: `lib/experience/{types,compose,emit,runtime,shader,styles}.ts` and
  `scripts/build-experience.ts` (reconstructed from `docs/bakery-v2-technical-reference.md`,
  byte-identical to commit `a1c44af`)
- QA: `test/experience.contrast.test.ts`, `scripts/verify-experience.mjs`, plus the
  general `renderer-coverage.ts` mechanism
- Calibration context: `docs/design-intelligence-review.md`

**The single most important fact this study confirms:** the general pipeline and Bakery V2
are *disjoint systems*. `lib/experience/` is a **parallel renderer** reachable only through
`scripts/build-experience.ts` against a hardcoded fixture; it has **zero import edges** into
`main.ts`, `lib/design/`, or `lib/render/`. The gap is therefore a **contract gap**, not a
capability gap (`bakery-v2-technical-reference.md` §19–20, `experience-capability-audit.md` §2).

---

## 1. Product definition

### 1.1 What "Experience" means in BusinessForge

An **Experience** is the *temporal and spatial shape* a visitor moves through when they
visit a business's page: the order of what they meet, the pacing of that meeting, the
world the page walks through, the moments that are built to, the transitions that mark
those moments, and the way imagery, type, and interaction behave along the way.

It is the difference between "a list of sections" and "a sequence with a shape"
(`lib/design/experience.ts:4-19`, `lib/experience/types.ts:5-14`). Two businesses in the
same industry MUST be able to receive materially different Experiences when their
character, evidence, audience, offer, atmosphere, or conversion goal differ
(ADR 0006).

An Experience is **not** a visual style. The same `direction: elegant` world can host two
entirely different Experiences (`experience-capability-audit.md:81-97`, the River Park
case: it received real *direction* but zero *experience*).

### 1.2 The five terms, precisely distinguished

| Term | Definition | Where it lives today | Evidence |
|---|---|---|---|
| **Website** | The complete, functional, deployable artifact: HTML + CSS + assets + JS where needed, covering navigation, contact, conversion, accessibility, mobile. | `lib/render/` output + a (future) runtime | `docs/renderer.md:1-17` |
| **Template** | A shape defined by *category or industry* and applied uniformly regardless of the individual business. The anti-pattern BusinessForge exists to avoid. | — (forbidden) | ADR 0006 context |
| **Design** | The *visual* decision document: direction, world, colour, type, spacing, layout variants, motion tokens. Decides **how it looks**, not what order or pacing. | `lib/design/types.ts` `WebsiteDesign` | `docs/architecture.md:60-62` |
| **Experience** | The *narrative/behavioural* shape: mode, arc/sequence, pacing, world-journey, nominated moment, transitions, imagery choreography, interaction level. Decides **what visiting feels like as a sequence**. | `lib/design/experience.ts` `ExperienceArchitecture` + `lib/design/script.ts` `ExperienceScript` | `docs/experience-system.md`, ADR 0006 |
| **Experience Architecture** | The *deterministic derivation* of the Experience from Business Character — the data-plan layer that turns evidence into the Experience contract, before any renderer. | `planExperience()` + `planNarrativeOrder()` + `planInteraction()` + `planConversion()` | `lib/design/plan.ts`, `lib/design/experience.ts:71-192` |
| **Renderer capability** | One validated, named, closed-set mechanism the renderer (or an opt-in runtime) can execute: a scene-kind composition, a ground-band transition, a veil, a moment marker, a hero-object state, a scrubbed reel. The Director *nominates*; the capability *executes*. | `lib/render/variants.ts` + (future) `lib/runtime/` | `bakery-v2-technical-reference.md` §11, ADR 0005 |

The goal is **not** "make every site immersive." The goal is "make the Experience
**appropriate and distinctive** for that business" (`experience-capability-audit.md:115-120`,
`docs/experience-system.md:43-54`). Immersive is one rung on a ladder; `brochure` is
another, and is the *correct* answer for a plumber (`lib/design/experience.ts:23-34`).

---

## 2. Complete Bakery V2 capability map

Primary evidence: `docs/bakery-v2-technical-reference.md` §11 (the 41-row motion inventory)
and §12 (generic vs bakery-specific), plus `lib/experience/types.ts` and `compose.ts`.

For each capability the columns are:

- **Generic** — portable to any business without domain knowledge.
- **Parameterizable** — driven by data the Director/render-plan can set, not by code edits.
- **Business-specific** — bakes in one business's content/identity.
- **Requires runtime/JS** — needs the client runtime (not pure static HTML/CSS).
- **Deterministic CSS/HTML** — achievable with no JS.
- **BF capability** — should become a BusinessForge capability (first-class, composable).
- **Specialized** — should remain an optional, opt-in, domain-specific module.

### 2.1 Composition (how a scene/section is laid out)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Scene-kind as a distinct composition | `emit.ts` `sceneHtml()` switch; `styles.ts` `.k-*` | 9 closed-set kinds, each a different grid/anchor | Yes | Yes (enum) | No (kinds) | No | **Yes** | **Yes** | No |
| C2 | Per-kind display-face override | `styles.ts` `#scene-oven .display` | Cormorant→Archivo 900 for one scene | Yes (as mechanism) | Yes | **Yes (hard-coded)** | No | Yes | Yes (as a `heroTreatment` field) | No |
| C3 | Composition offset (object vs type) | `shader.ts:132` `uOffset`; `DoughState.offsetX/Y` | loaf placed opposite type | Yes (as axis) | Yes | No | Yes (GL) | No | Yes (as `compositionOffset`) | bake-specific value |
| C4 | Grid `frame` envelope (aside/offset/statement) | `types.ts` `SectionFrame` | head rail vs centred vs statement | Yes | Yes | No | No | Yes | Yes (already exists) | No |

**Finding:** C1 is the single highest-value extraction. The *general* renderer already has
a closed-set variant vocabulary (`HERO_VARIANTS`, `SECTION_VARIANTS`, `SECTION_FRAMES`);
Bakery's nine `SceneKind`s are the *same idea* realized as a distinct composition per kind.
The general vocabulary is wider but flatter; Bakery proves that *composing the whole scene
as one named unit* (not variant + frame independently) is what makes sequence read as
sequence. C2 is a genuine hard-coded leak (`bakery-v2-technical-reference.md` §13.2).

### 2.2 State (continuous parameters a scene declares)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | Per-scene state vector driving a shader | `DoughState` 12 fields → 16 uniforms | `runtime.ts:190-205` lerps by name | **No** (vocabulary is bread) | Yes (per field) | **Yes** | Yes | No | Pattern only | **Yes (per category)** |
| S2 | Centre-to-centre interpolation | `runtime.ts:183-205` | smoothstep between scene centres | Yes | Yes | No | Yes | No | **Yes (core runtime)** | No |
| S3 | World/ground per scene | `Ground` 4 colours; `types.ts:21-30` | `mixRgb` over `Scene.ground` | Yes | Yes | No | Yes (band) | Partly | **Yes** (`worlds.ts` already does this) | No |

**Finding:** S3 already exists in the general pipeline as `worlds.ts` `assignJourney()`
(ADR 0005 amendment, `efb84af`). S1's *pattern* (a named state vector drives a renderer)
is generic; its *content* (rise/bake/score) is bread and must NOT be generalized
(`bakery-v2-technical-reference.md` §12.B, §13 deepest-coupling).

### 2.3 Transitions (how one beat hands to the next)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Boundary-band ground blend | `runtime.ts:213-230` | short ramp at scene edge, not centre-to-centre | Yes | Yes | No | Yes | No | **Yes** | No |
| T2 | Fade-out / band coupling | constants `FADE_OUT_END=0.86`, `GROUND_BAND_START=0.90` | copy at 0 before ground moves | Yes | Yes | No | Yes | No | **Yes** | No |
| T3 | Veil / whiteout wash | `runtime.ts:239-260` `wash()` | full-screen wash at polarity flip | Yes | Yes (colour, peak) | No | Yes | No | **Yes** | No |
| T4 | Inset wipe reveal | `styles.ts:267-273` | `clip-path` bottom-up on `.is-live` | Yes | Yes | No | No | **Yes** | **Yes** | No |
| T5 | Directional wipe | `styles.ts:420-425` | left-right wipe at daybreak | Yes | Yes | No | No | Yes | **Yes** | No |
| T6 | Circular handoff | `styles.ts:337-342` | `clip-path: circle()` driven by `--p` | Yes (concept) | Partly | **Yes (origin hard-coded 52% 44%)** | No | **Yes** | **Yes** (origin must become derived) | No |
| T7 | Ken-Burns scale | `styles.ts:274-278` | `scale(1.14)→1` | Yes | Yes | No | No | Yes | Yes | No |

**Finding:** T1–T7 are the heart of what the audit calls "connective tissue" and what the
general pipeline lacks (`experience-capability-audit.md` §3, row "Whiteout/veil transition"
= NO; "World-as-journey" = YES already). T3 and T6 are the two with known hard-coded leaks
(T6 origin, `bakery-v2-technical-reference.md` §13.3). T4–T7 are **pure CSS** and can ship
to the general renderer with no runtime (ADR 0005's `.section--moment` is the seed).

### 2.4 Pacing (how much vertical space / attention each beat gets)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | Scroll length = beats × 100svh | `emit.ts:185` | `min-height:${beats*100}svh` | Yes | Yes | No | No | **Yes** | **Yes** (`pacing` already exists) | No |
| P2 | Pacing narrows/opens density | `experience.ts:63-69` `densityForPacing` | base density ±1 step | Yes | Yes | No | No | Yes | Yes (exists) | No |
| P3 | Empty tail for anticipation | `compose.ts` `FADE_OUT_END` region | last third of a scene left bare | Yes | Yes | No | Yes | No | Yes | No |

**Finding:** P1/P2 already exist as `pacing: compact|measured|cinematic` and
`densityForPacing`. Bakery proves pacing should also carry into *scroll distance*, which the
static renderer expresses today only as section spacing — acceptable for the brochure/showcase
tiers, insufficient for a cinematic one.

### 2.5 World changes (the page's colour journey)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 | Ordered ground journey (night→day) | `compose.ts` 7 `Ground` consts; `types.ts:21-30` | sequence of grounds walked per scene | Yes | Yes | No | No | Yes | **Yes** (`worlds.ts` journey) | No |
| W2 | Polarity flip at a moment | `doors` scene; veil | ground inverts light↔dark | Yes | Yes | No | Yes | No | **Yes** (veil, T3) | No |
| W3 | Luminance-driven polarity switch | `runtime.ts:315-321` `body.dark-ground` | HUD retires above a luminance | Yes | Yes | No | Yes | No | Yes | No |

**Finding:** W1 is fully owned by the general pipeline (`worlds.ts`). Bakery's contribution
is W2/W3 — *crossing* between grounds legibly (the band mechanism, T1) and *covering* a
polarity flip (the veil, T3). Both are runtime-gated today but conceptually CSS-reachable
via a transition primitive.

### 2.6 Image choreography (how photographs are placed and revealed)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| I1 | Photograph casting by filename substring | `compose.ts:200-214` `pick()` | `chad-turns-dough` → role | No | No | **Yes** | No | — | No | **Yes** (per business, not a capability) |
| I2 | Plate crop by role | `types.ts:103-111` `Plate.crop` | portrait/landscape/square/full | Yes | Yes | No | No | Yes | **Yes** (`ImageCrop` exists) | No |
| I3 | 3D→photography handoff | `styles.ts:337-342` + `cooling` scene | synthetic dissolves into real photo | Yes (technique) | Partly | **Yes (origin)** | No | Yes | **Yes** (as a transition primitive) | No |
| I4 | Scrim over photograph | `styles.ts` `.k-plate .plate::after` | 5-stop gradient for legibility | Yes | Yes | No | No | Yes | Yes | No |
| I5 | Honest photo filtering | `compose.ts:111-114` `NOT_PHOTOGRAPHY` | drops book covers/product shots | Yes | Yes | No | No | — | **Yes** (keep exactly) | No |

**Finding:** I3 is the most transferable storytelling technique in Bakery V2
(`bakery-v2-technical-reference.md` §8) and is **pure CSS** — a `clip-path` driven by
scroll progress. The only leak is the hard-coded origin (`52% 44%`), which must become
*derived* from the hero-object's declared offset (or, for a no-object business, from a
`handoffOrigin` field). I1 is legitimate per-business authoring, not a capability.

### 2.7 Interaction (how the page responds to the visitor)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| X1 | Scroll playhead | `runtime.ts:175` `sample()` | `scrollY + vh/2` | Yes | Yes | No | Yes | No | **Yes (core runtime)** | No |
| X2 | Pointer parallax | `runtime.ts:399-405` | camera nudge from cursor | Yes | Yes | No | Yes | No | Yes (opt-in) | No |
| X3 | Magnetic buttons | `runtime.ts:464-473` `[data-magnet]` | element follows cursor delta | Yes | Yes | No | Yes | No | Yes (opt-in) | No |
| X4 | Rack track scrub | `runtime.ts:437-444` `driveReels()` | scroll scrubs a filmstrip | Yes | Yes | No | Yes | No | Yes (opt-in) | No |
| X5 | Rack card perspective | `runtime.ts:445-456` | rotateY by distance from centre | Yes | Yes | No | Yes | No | Yes (opt-in) | No |
| X6 | Line-split reveal | `runtime.ts:410-424` | staggered `translateY` on `.is-live` | Yes | Yes | No | Yes | Partly | Yes | No |
| X7 | Action hover | `styles.ts:472-478` | bg/colour/transform on hover | Yes | Yes | No | No | Yes | Yes (exists) | No |
| X8 | Mobile reel fallback | `styles.ts` reduced-motion/mobile block | native swipe strip | Yes | Yes | No | No | Yes | Yes | No |

**Finding:** X1 is the ontological difference between the two systems ("scroll changes
*state*, not just visibility", `bakery-v2-technical-reference.md` §20.1). X2–X5 are
*opt-in runtime luxuries* — safe only under an `interaction.ceiling === 'immersive'` gate
and a `prefers-reduced-motion`/`coarse` guard. X8 is the correct accessibility move (a
scroll-scrubbed carousel the user cannot control is replaced by one they can).

### 2.8 Hero / object rendering

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| H1 | Raymarched SDF loaf | `shader.ts` `sdEllipsoid`, `doughField` | fullscreen-triangle raymarch | No | No | **Yes** | Yes (WebGL2) | No | Pattern only | **Yes (per category shader)** |
| H2 | Oven spring / crust / steam / score | `shader.ts` §5–6 | bread-specific geometry+shading | No | No | **Yes** | Yes | No | No | **Yes** |
| H3 | Camera dolly / light temperature | `shader.ts:237,275-283` | `uDolly`, `uHeat` lerp | Yes (as axes) | Yes | No | Yes | No | Yes (as hero-state axes) | bake-specific values |
| H4 | Presence fade / draw-skip | `runtime.ts:336-341` | `presence>0.012` gate | Yes | Yes | No | Yes | No | **Yes** | No |

**Finding:** H1/H2 are the *spectacle* and are **unconditionally specialized** — there is no
equivalent object for a law firm (`experience-capability-audit.md` §1 row "3D/WebGL loaf"
= B/C/D, not generalizable). H3/H4 are generic *as axes* — they become a
`heroObjectState: {presence, scale, offset, ...}` contract that a *per-category* shader
consumes. The contract generalizes; the shader does not (`bakery-v2-technical-reference.md`
§20.3).

### 2.9 Typography behaviour

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| Y1 | Display line with `\|` splits | `types.ts:159` `display`; `styles.ts` | oversized multi-line | Yes | Yes | No | No | Yes | **Yes** (`display` behaviour) | No |
| Y2 | Mono log line | `styles.ts` `log li`; `LogLine` | measured facts in mono | Yes | Yes | No | No | Yes | Yes | No |
| Y3 | Per-scene font switch | `styles.ts` `#scene-oven .display` | Cormorant→Archivo 900 | Yes | Yes | **Yes (hard-coded)** | No | Yes | Yes (as `heroTreatment.typography`) | No |
| Y4 | HUD clock + marker | `runtime.ts:291` `paintHud()` | 22:00 timestamp device | Yes (concept) | Yes | No | Yes | No | Yes (opt-in "narrative device") | No |

**Finding:** Y1–Y3 are pure-CSS and belong in the general renderer's `heroTreatment` /
display-behaviour vocabulary. Y4 (a running clock as a narrative device) is a *creative
direction* choice — a closed-set option a Director may nominate for a business whose
evidence supports a temporal arc, never a default.

### 2.10 Functional conversion (the page must still *work*)

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| F1 | Persistent skip link | `emit.ts` body | always-present escape hatch | Yes | Yes | No | No | Yes | **Yes** (exists) | No |
| F2 | Threshold scene = shopfront | `compose.ts` `Practical`; `threshold` kind | hours/phone/directions composed as a storefront | Yes (as pattern) | Yes | No | No | Yes | **Yes** (`context` role) | No |
| F3 | CTA in-scene | `types.ts:170-171` `cta` | `{label, href}` per scene | Yes | Yes | No | No | Yes | **Yes** (exists) | No |
| F4 | Keyboard reachable | `verify-experience.mjs` mode 4 | 8 tab stops, 2px outline | Yes | Yes | No | No | Yes | **Yes** (exists) | No |

**Finding:** Bakery V2 *proves* an experience can be fully functional
(`experience-capability-audit.md` §5 "Functional conversion = YES"; `canonical-bakery-v2.md`
keyboard mode: 8 stops, every `solid 2px`). Functionality is a **hard requirement**, not a
casualty — see §8.

### 2.11 Accessibility, responsive, QA

| # | Capability | V2 file | Mechanism | Generic | Param | Biz-spec | Req JS | Det CSS | BF cap | Specialized |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Reduced-motion: no GL, no veil, time frozen | `runtime.ts:242,480` | `prefers-reduced-motion` | Yes | Yes | No | Yes | Partly | **Yes** (principle shared) | No |
| A2 | No-WebGL fallback (designed, not black) | `runtime.ts:124-127` | `webglcontextlost`→fallback | Yes | Yes | No | Yes | No | **Yes** (pattern) | No |
| A3 | Mobile reflow + half render scale | `runtime.ts:88,356-362` | `offsetYMobile`, `0.5` scale | Yes | Yes | No | Yes | No | Yes | No |
| A4 | Contrast-per-scene assertion | `test/experience.contrast.test.ts` | WCAG luminance, 5 tests | Yes | Yes | No | No | — | **Yes** (methodology) | No |
| A5 | 220-position scroll-contrast sweep | `scripts/verify-experience.mjs` mode 3 | computed-colour at 220 scrolls | Yes | Yes | No | No (browser) | — | **Yes** (harness shape) | No |
| A6 | FPS auto-degradation | `runtime.ts:368-382` | quality→scale→drop | Yes | Yes | No | Yes | No | Yes (for runtime) | No |
| A7 | Honest-hours degradation | `compose.ts:180-184` | one verified day + caveat | Yes | Yes | No | No | — | **Yes** (keep exactly) | No |

**Finding:** A1–A7 are the discipline the general pipeline already shares in spirit
(`tokens.motion.respectReducedMotion`, `renderer.md` accessibility section). A5's *harness
shape* is the missing piece for any continuous/runtime feature — it is the QA the audit
says is needed "only if scroll-as-time is generalized" (`experience-capability-audit.md`
§3).

---

## 3. Experience vocabulary

A vocabulary an AI Design Director can use to *describe* an experience **without generating
arbitrary CSS/JS/GLSL**. Every field below is closed-set or parameterized against validated
capabilities. Derived from the general `lib/design/*` types (which already define most of
it) + the Bakery V2 evidence of what those types *cannot yet express*.

### 3.1 Tier 1 — data plan (deterministically realizable by the existing static renderer)

| Field | Type | Source of truth | Evidence it is needed |
|---|---|---|---|
| `mode` | `brochure \| showcase \| narrative \| immersive` | `experience.ts:41` | Already exists; the rung ladder |
| `arc` / `sequence` | `NarrativeRole[]` (ordered) | `script.ts:44-56,84` | The narrative order; two same-industry firms diverge here |
| `sceneKind` / `sectionKind` | closed enum of *distinct compositions* | `HERO_VARIANTS`+`SECTION_VARIANTS`+`SECTION_FRAMES`; Bakery `SceneKind` | C1 — composition as one named unit |
| `pacing` | `compact \| measured \| cinematic` (+ scroll distance) | `experience.ts:44`; P1/P3 | Already exists; needs scroll-length realization |
| `worldJourney` | ordered `Ground[]` / `WorldId` sequence | `worlds.ts` `assignJourney` | W1 — already built |
| `moment` | one nominated `SectionKind` + `isSignature` | `experience.ts:52`; `script.ts` `signature` | The "payoff" marker; audit gap row "moment" |
| `transition` | `none \| veil \| wipe \| circular-handoff` at a boundary | ADR 0005 `transitionAtMoment`; T3–T6 | The transition primitive; audit gap row "transition" |
| `imageChoreography` | `hero \| signature \| sequence \| handoff \| contrast \| reduce` | `assets.ts` `AssetChoreography` | I2–I4 |
| `heroTreatment` | `{ variant, typography, compositionOffset }` | C2/C3, Y3, H3 | Distinct hero rendering without per-scene CSS hacks |
| `ctaBehavior` | `CtaIntent + placement + contactProminence + friction` | `conversion.ts:33-42` | Already exists |
| `typographyBehavior` | display-split / mono-log / per-scene-switch (opt-in) | Y1–Y3 | Distinct type behaviour |
| `density` | `airy \| balanced \| dense` (narrowed by pacing) | `types.ts:61`; P2 | Exists |
| `narrativeDevice` | `none \| clock` (opt-in) | Y4 | A temporal HUD, never a default |

### 3.2 Tier 2 — runtime-gated (opt-in, only under `interaction.ceiling === 'immersive'`)

| Field | Type | What it drives | Evidence |
|---|---|---|---|
| `scrollProgress` | per-section `--p` / `--vis` CSS vars | makes any CSS express scroll-driven state | X1, `bakery-v2-technical-reference.md` §20.2 (the `--p/--vis` contract) |
| `groundBand` | boundary-band blend params | legible world crossings | T1/T2, S3 |
| `veil` | `{ colour, peak }` | polarity-flip cover | T3, W2 |
| `heroObjectState` | `{ presence, scale, offsetX/Y, ... }` (per-category shape) | a real object the business's evidence supports | S1/H3/H4, audit §1 "3D hero" |
| `scrub` | track-scrub / reel params | filmstrip carousels | X4/X5 |
| `pointer` | parallax / magnetic (gated by `coarse`) | responsive-to-cursor luxuries | X2/X3 |

**Justification.** The vocabulary is *evidence-bound*: every Tier-1 field is already
produced by a deterministic `lib/design/*` function and is therefore explainable and
snapshot-testable. Every Tier-2 field corresponds to a Bakery V2 mechanism that the audit
explicitly classed as "generic pattern but runtime-specific" (§11 rows 1–5, §12.A). Nothing
in the vocabulary asks the model for a colour, a duration, or a GLSL string — those are
rendered from the selected capability, never authored by the Director (ADR 0004/0005
boundary).

The vocabulary deliberately does **not** include `DoughState` as a universal field
(`bakery-v2-technical-reference.md` §13, §20.6). `heroObjectState` is an *abstract* contract
consumed by a *per-category* shader; the Director selects the category, never the floats.

---

## 4. Experience architecture contract

### 4.1 The data flow and what each layer must carry

```
BusinessProfile + WebsiteContent + research evidence
  │
  ▼  deriveCharacter()                         [deterministic]
BusinessCharacter
  │  visualWeight, atmosphereRange, emotionalRegister, offeringBreadth,
  │  narrativePotential, signatureCandidate, multiAtmosphere, expressiveness
  │
  ▼  planExperience()                          [deterministic]
ExperienceArchitecture
  │  mode, signatureMoment, momentTransition, galleryLead, pacing
  │
  ▼  planConversion()                          [deterministic]
ConversionStrategy
  │  mode, primaryCta, ctaPlacement, contactProminence, friction, conversionMoment
  │
  ▼  planInteraction()                         [deterministic]
InteractionStrategy
  │  level (delivered), ceiling (wanted), basis
  │
  ▼  planNarrativeOrder() + buildScript()      [deterministic]
ExperienceScript  (Beat[]: role, emphasis, background, pacing, intensity,
  │                isTransition, isSignature, arc, opening, conversionAt)
  │
  ▼  (optional) AI Design Director             [validated closed-set override only]
  │  may set mode / moment / cta verb / interaction ceiling — never CSS/JS/GLSL
  │
  ▼  composeDesign(plan, content)              [deterministic]
WebsiteDesign  (personality, world, tokens, layout, imagery, experience,
  │             conversion, interaction, assets, experienceScript, notes)
  │
  ▼  renderSite(content, design)  OR  (future) renderExperience(runtime)   [deterministic]
Website (HTML+CSS [+opt-in JS runtime])  →  QA gates
```

### 4.2 Which current types are sufficient, too narrow, duplicated, confusing

| Type / module | Verdict | Why |
|---|---|---|
| `BusinessCharacter` | **Sufficient** as the character read. Missing one signal: a `temporalArc` hint (does the evidence support a clock/day-night narrative device like Bakery's 22:00→07:30?). Add only if a business class earns it. | `character.ts:64-83` |
| `ExperienceArchitecture` | **Sufficient for Tier 1.** It already names mode/signature/moment/galleryLead/pacing. It does **not** name `transition` (only `momentTransition: boolean`) — that collapses "veil" and "wipe" into one bit. Widen to a `transition` enum. | `experience.ts:46-60` |
| `ExperienceScript` / `Beat` | **Sufficient and the right shape.** `Beat` already carries role/emphasis/background/pacing/intensity/isTransition/isSignature — exactly the per-beat data the renderer needs. This is the connective tissue the audit demanded. | `script.ts:60-87` |
| `ConversionStrategy` | **Sufficient.** Closed-set CTA verb + placement + friction, with `basis`. | `conversion.ts:44-58` |
| `InteractionStrategy` | **Sufficient as intent.** `level` (delivered) vs `ceiling` (wanted) is the correct honest floor. The *delivery* of `immersive` is what does not exist yet. | `interaction.ts:31-38` |
| `AssetChoreography` | **Sufficient for Tier 1** (hero/signature/sequence/contrast/reduce/rights). Needs a `handoff` concept for I3. | `assets.ts` |
| `WebsiteDesign.experienceScript` | **Sufficient** — exposed on the artifact so a reviewer reads the story off it. | `types.ts:634` |
| `lib/design/experience.ts` | **Keep.** It is the *general* deterministic narrative layer. Correctly scoped. | header `experience.ts:1-35` |
| `lib/experience/` | **Do NOT merge.** It is the *Bakery-specific* parallel renderer engine. Confusingly named, but a *different codebase* (see §4.3). | `bakery-v2-technical-reference.md` §0.3 |
| `DesignDirective.experienceIntent` (ADR 0005) | **Too narrow.** `mode: 'standard'|'moment-led'` + one `moment` + one `transitionAtMoment`. It cannot express `narrative`/`showcase`/`brochure` (those are derived, not directed) and its `moment` is a `SectionKind`, not the `ExperienceScript` role. The Director should *override* `mode`/`ceiling`, never re-derive the whole arc. | ADR 0005 `:85-92` |
| `worlds.ts` | **Sufficient** for world-journey; do **not** extend it with moment/transition (ADR 0005 amendment: those belong to layout/renderer). | ADR 0005 `:113-127` |

### 4.3 The name collision — explicit handling

`lib/design/experience.ts` and `lib/experience/` share a word and **nothing else**
(`bakery-v2-technical-reference.md` §0.3). They must be kept apart by *convention and by
contract*, not merged:

- `lib/design/experience.ts` = **Experience Architecture** (intent, derived from character,
  Tier-1, no runtime). This is the product's experience brain.
- `lib/experience/` = one **specialized, opt-in renderer realization** — the Bakery-shaped
  runtime. It is *an implementation* of the `immersive` rung for one business class, not the
  definition of experience.

The contract that connects them (future): when `InteractionStrategy.ceiling === 'immersive'`
and the business class has a registered hero-object shader, the *general* `ExperienceScript`
is handed to a **runtime host** (a new `lib/runtime/`, not `lib/experience/`) that executes
the Tier-2 capabilities. `lib/experience/` becomes the reference implementation of *one*
such host for the bakery class.

---

## 5. Distinctness between businesses

### 5.1 The mechanism

Distinctness is **not** random variation. It is forced by the chain:

`evidence → BusinessCharacter → ExperienceArchitecture → ExperienceScript`

Because `roleFor()` reads **character + evidence**, not category (`script.ts:103-128`), the
*same* section kind gets a *different* role for two businesses, and `planNarrativeOrder()`
sorts along a narrative spine (`script.ts:137-200`). Two same-industry businesses with
different evidence produce different arcs. This is already proven by the six-business
benchmark (ADR 0006: "two hotels with different evidence producing different narratives").

### 5.2 Three hypothetical bakeries — same industry, three Experiences

All three are `industry: bakery`. They diverge on **character**, which the evidence reads.

**Bakery A — "Tartine-style craft bakery"** (the canonical V2 business)
- Evidence: 40 photographs, varied framing (hands, oven, crumb, storefront), long
  self-description about fermentation, a levain process, a named signature loaf.
- `BusinessCharacter`: `visualWeight: image-led`, `atmosphereRange: 6`,
  `emotionalRegister: craft`, `narrativePotential: strong`, `signatureCandidate: gallery`.
- `ExperienceArchitecture`: `mode: narrative`, `signatureMoment: gallery`,
  `momentTransition: true`, `galleryLead: true`, `pacing: cinematic`.
- `ExperienceScript` arc: `emotion → reveal → signature → process → breadth → proof →
  conversion → coda`.
- Tier-2 reachable: `immersive` ceiling → hero-object (a loaf), veil at the daybreak
  crossing, scroll-driven state. **A materially different, cinematic Experience.**

**Bakery B — "Neighbourhood bread-and-cake counter"**
- Evidence: 6 photos (mostly products on a shelf), short description, a `cake`/`tort`
  ordering service, no process narrative, rating 4.6 with 40 reviews.
- `BusinessCharacter`: `visualWeight: balanced`, `atmosphereRange: 2`,
  `emotionalRegister: warm`, `narrativePotential: latent`, `signatureCandidate: null`
  (no single hero image earns it).
- `ExperienceArchitecture`: `mode: showcase`, `signatureMoment: null`,
  `momentTransition: false`, `galleryLead: true`, `pacing: measured`.
- `ExperienceScript` arc: `arrival → reveal → breadth (menu/cake) → trust (reviews) →
  conversion (order) → context`.
- Tier-2: `guided` ceiling — gallery lead with full-bleed imagery and a `wipe` transition,
  **no** hero object, **no** veil. A warm, image-led but *grounded* Experience — visibly
  different from A.

**Bakery C — "Wholesale bakery supply / B2B distributor"**
- Evidence: 3 photos (a van, a warehouse, a logo), functional copy about delivery schedules
  and trade accounts, a phone, no consumer-facing story.
- `BusinessCharacter`: `visualWeight: text-led`, `atmosphereRange: 1`,
  `emotionalRegister: functional`, `narrativePotential: none`, `signatureCandidate: null`.
- `ExperienceArchitecture`: `mode: brochure`, `signatureMoment: null`,
  `momentTransition: false`, `galleryLead: false`, `pacing: compact`.
- `ExperienceScript` arc: `arrival → breadth (services) → context (hours/delivery) →
  conversion (call/quote) → coda`.
- Tier-2: `static` — minimal motion, persistent nav, phone pressed in the first screen.
  **A functional directory, correct for the evidence, materially different from both A and B.**

**Conclusion:** same industry, three Experiences differing in narrative order, scene
composition, pacing, imagery treatment, interaction level, and conversion path — *all*
derived from evidence, none from random variation. This is exactly the test in §14.

---

## 6. Capability selection

### 6.1 The three boundaries

| Boundary | Who decides | What they may NOT do |
|---|---|---|
| **AI creative direction** | `agents/designDirectorAgent.ts` (optional) | Invent CSS, JS, WebGL, GLSL, hex codes, durations, DOM. May only *nominate* closed-set intent: `mode`, `moment` (an existing `SectionKind`), `cta` verb, `interaction` ceiling, `transition` kind. | ADR 0004/0005 |
| **Deterministic capability selection** | `lib/design/*` `plan*` functions | Re-derive intent from a different philosophy. They *execute* the validated floor and apply validated overrides. | `experience-system.md:29-35` |
| **Renderer execution** | `lib/render/*` + (future) `lib/runtime/*` | Accept free-form instructions. It reads *named capabilities* and emits their validated implementation. | `docs/renderer.md:98-102` |

### 6.2 The Director chooses INTENT; the capability executes VALIDATED behaviour

The model **must not** invent renderer primitives. It chooses from the §3 vocabulary. The
renderer maps each chosen vocabulary item to **one validated implementation** (e.g.
`transition: 'veil'` → the `wash()` primitive; `heroObjectState` for class `bakery` → the
existing `shader.ts`). If a Director nominates something with no registered capability, the
system falls back to the deterministic floor (ADR 0005's backward-compatibility; ADR 0004's
"invalid value leaves the floor standing").

This is why the audit's "contract gap, not capability gap" conclusion is decisive: the fix
is to *name* the capabilities in the vocabulary and wire them to validated implementations —
never to let the model write them.

---

## 7. Deterministic vs runtime

Using Bakery V2 as the classifier:

### A. Deterministic HTML/CSS capabilities (no JS)
- Scene/section-kind composition (C1, C4), inset/directional wipe (T4, T5), Ken-Burns (T7),
  plate crop (I2), scrim (I4), hero treatment / display split / mono log (Y1–Y3), all
  functional conversion (F1–F4), accessibility CSS (A1 reduced-motion CSS half), mobile
  reflow CSS (A3 CSS half), action hover (X7), HUD retirement CSS (W3 CSS half),
  full-bleed/editorial heroes already in the renderer.
- **These ship to the general renderer now.** They are the "connective tissue" the audit
  says is missing and are achievable with zero JS.

### B. Deterministic capabilities requiring a *small generic runtime*
- Scroll playhead + `--p`/`--vis` contract (X1), centre-to-centre interpolation (S2),
  boundary-band ground blend (T1/T2), veil wash (T3), line-split reveal (X6),
  presence/draw-skip (H4), luminance polarity switch (W3), FPS auto-degradation (A6),
  no-WebGL context-loss fallback (A2).
- **These are a *small, generic* runtime** (`lib/runtime/`) with **no bread in its control
  flow** (`bakery-v2-technical-reference.md` §12.A, §20.5). It is the same 200 lines of
  `sample()`/`frame()`/`wash()` extracted from `runtime.ts`, minus the WebGL host.

### C. Specialized runtime capabilities (opt-in, business-class-gated)
- Rack track scrub (X4), rack card perspective (X5), pointer parallax (X2), magnetic buttons
  (X3), scroll-scrubbed carousels, the clock HUD (Y4).
- **Gated by `interaction.ceiling === 'immersive'`** and disabled under `coarse`/reduced.

### D. Specialized WebGL capabilities (per-category, never generalized)
- Raymarched SDF hero object (H1), oven spring / crust / steam / score (H2), and the
  bread-specific `DoughState`→uniform mapping (S1).
- **One `shader.ts` per registered business class** (bakery is the reference). The Director
  selects the *class*, never the GLSL.

### 7.1 Must "no JS" be revised?

**No — but it must be *conditional*, not absolute.** The current product guarantee ("opens
from disk, no JS") is correct for the `brochure`/`showcase`/`guided` tiers and must be
preserved: a business whose evidence does not earn `immersive` gets a zero-JS site. The
guarantee should be *revised* from "the renderer emits no JS" to "**the renderer emits no JS
unless the validated Experience explicitly selects an opt-in runtime capability, and that
runtime degrades to the static Experience under reduced-motion / no-WebGL / low-fps**."
Bakery V2 proves this is safe: reduced-motion → no GL + static state; no-WebGL → designed
fallback, not a black rectangle (`canonical-bakery-v2.md` degraded modes). Destroying the
experience to preserve a blanket "no JS" rule would be the wrong trade *only* for the
businesses that earn `immersive` — and even then the static fallback must remain QA-valid.

---

## 8. Functionality (the Experience must still be a working website)

An Experience that does not function as a business website is unacceptable
(`experience-capability-audit.md` §5 "Functional conversion = YES"). The architecture
preserves functionality by construction:

| Function | How it is preserved |
|---|---|
| **Navigation** | Persistent header nav is the *default* (`layout.showNavigation`, `types.ts:526`). Guided/immersive paths ADD a skip-link escape hatch (F1); they NEVER remove persistent nav unless `experience.mode` is explicitly `immersive` *and* a human gated it (audit §4 "Guided-path navigation = opt-in, never default"). |
| **Contact** | `Practical`/`contact` beat always present in the arc; `conversionMoment` anchors the strongest push (`conversion.ts:53`). Phone/email render as `tel:`/`mailto:` with safe href allow-list (`renderer.md:61`). |
| **Booking / forms** | Handled by `ConversionStrategy` (`book`/`reserve` verbs) + content sections; the Experience layer never strips them. A `high-intent` business pulls its contact beat forward (`script.ts:174-183`) — *more* functional, not less. |
| **Maps** | `location`/`threshold` scene composes a directions link (`mapHref`, `types.ts:189`); honest-hours degradation keeps the link even with partial data (A7). |
| **Phone / email** | First-class in `Practical`; reachable by keyboard (A4: 8 tab stops). |
| **Conversion actions** | `ctaBehavior` (§3.1) is independent of visual mode. Bakery's `threshold` scene proves a cinematic page can still be a shopfront (F2). |
| **Accessibility** | `AccessibilityPreferences` (AA/AAA, tap targets, landmarks, skip link, `respectReducedMotion: true`) is mandatory on every Experience (`types.ts:550-561`). |
| **Mobile** | `ResponsiveSystem` fluid + `mobileColumns`; immersive runtimes reflow (A3) and replace scrubbed carousels with native swipe (X8). |

**Rule:** no `ExperienceScript` may place `conversion` off-page or delete a `contact` beat.
`buildScript` pins hero first and closing CTA last (`script.ts:185-197`); the renderer
appends any section the plan forgot (`renderer.md:129`). Functionality is a *structural
invariant*, asserted by `narrativeCoherence` and the QA harness — not a styling choice.

---

## 9. Experience generation — the future pipeline

```
research (sources: site crawl, Maps/Places, Instagram, questionnaire)
  → verified business facts (no model-invented facts; merge.ts policy)
  → BusinessCharacter            deriveCharacter()        [deterministic, no model]
  → ExperienceArchitecture       planExperience()         [deterministic]
  → ConversionStrategy           planConversion()         [deterministic]
  → InteractionStrategy          planInteraction()        [deterministic]
  → ExperienceScript (arc)       planNarrativeOrder()+buildScript()  [deterministic]
  → Content Architecture         directContent()          [deterministic; role-aware words]
  → Design Direction             composeDesign()          [deterministic; tokens/variants]
  → capability composition       selectCapabilities()    [deterministic; maps vocabulary→validated impls]
  → deterministic render         renderSite()  [+ opt-in renderExperience() runtime when ceiling==immersive]
  → QA                           scoreExperience + genericityReport + narrativeCoherence
                                  + (runtime) 220-position contrast sweep + reduced/no-webgl/keyboard
  → final Experience
```

**Where AI/model calls are useful:**
- Research synthesis where a model summarizes harvested text (behind merge policy).
- The **optional** AI Design Director: validated closed-set *intent* overrides
  (`mode`, `moment`, `cta` verb, `interaction` ceiling) — an *improver*, never a
  single point of failure.
- An optional AI *writer* as an improver over the deterministic Content Director (ADR 0007
  leaves this explicitly unbuilt).

**Where AI/model calls must NOT be used:**
- Deriving Business Character (must be measurable from evidence, not inferred taste).
- Choosing CSS values, JS behaviour, WebGL/GLSL, durations, hex codes, DOM.
- Inventing facts, testimonials, hours, certifications (architecture.md "Facts a model is
  never asked for").
- Generating scene copy for an immersive script (Bakery V2's `compose()` is pure and
  hand-authored; scaling that to arbitrary businesses is the rejected alternative in ADR
  0005).

The deterministic floor produces a business-specific Experience at €0; the model only
*nudges validated intent*. This is the architecture principle from the brief, applied to
experience: **AI decides intent; deterministic system executes.**

---

## 10. Bakery V2 → BusinessForge

### KEEP (preserve almost exactly — principle or mechanism)
- `sample()`'s three-strategy interpolation + the `FADE_OUT_END`/`GROUND_BAND_START` coupling
  **and its comments** (a real measured failure). `bakery-v2-technical-reference.md` §20.7.
- `wash()`'s both-sides boundary evaluation (the snap bug fix).
- `presence > 0.012` draw gate + three-rung FPS degradation + `webglcontextlost`→designed
  fallback.
- `verify-experience.mjs` in full — esp. the 220-position sweep across both motion modes, and
  `probe-baseline.mjs` (prevents reviewing a fallback).
- Honest-hours degradation (`compose.ts:180-184`) and its test (A7).
- Curtain/loading skeleton (perceived performance).
- The `NOT_PHOTOGRAPHY` filter (I5).
- The principle "scroll changes *state*, not just visibility" (§20.1) — as a *strategy
  option*, not a default.

### GENERALIZE (become reusable BusinessForge capabilities)
- Scene-kind-as-distinct-composition → the general variant/frame vocabulary, composed as one
  named *unit* (C1).
- `--p`/`--vis` scroll-progress contract → a generic runtime host (X1, B).
- Boundary-band ground blend + fade/band coupling → `groundBand` (T1/T2, B).
- Veil primitive → `transition: 'veil'` (T3, B).
- Inset/directional wipe + Ken-Burns + circular handoff → `transition` enum, origin *derived*
  (T4–T6, A).
- 3D→photography handoff *technique* → a transition primitive with derived origin (I3).
- Rack perspective → a `scrub` capability with native-swipe fallback (X4/X5/X8, C).
- World-journey is **already generalized** via `worlds.ts` (W1) — no work, just don't
  duplicate it in `lib/experience/`.
- Contrast/keyboard/reduced/no-webgl QA *harness shapes* (A4/A5) — reusable for any runtime
  feature.

### ISOLATE (remain specialized to Bakery / an optional domain module)
- `DoughState` and its 12 bread fields — **do not** generalize (`bakery-v2-technical-reference.md`
  §13, §20.6).
- The SDF loaf, oven spring, crust, steam, score, `SCORE_N`/`SCORE_T` — `shader.ts` (H1/H2).
- The ten-scene script and its copy; the 22:00→07:30 clock; the seven named grounds as
  *bakery content* (§12.B).
- `schema.org` type hard-coded to `'Bakery'` — a latent bug; should read category like the
  general renderer (§12.B). Keep the *bakery* shader module, fix the *type* leak.
- Photography casting by literal filename (`pick('chad-turns-dough')`) — legitimate
  per-business authoring, not a capability.

---

## 11. Current repository gap

Comparing the architecture above against the implementation at `design-director-smoke`.

### Architectural gaps
- **G1 — No `transition` enum.** `ExperienceArchitecture.momentTransition` is a boolean
  (`experience.ts:54`); it cannot express `veil` vs `wipe` vs `circular-handoff`. *Evidence:*
  audit §3 "Whiteout/veil transition = NO".
- **G2 — No runtime host.** `lib/render/` emits no client JS; `immersive` is defined but
  unreachable (`experience.ts:30-34`, `interaction.ts:13-18`). The entire Tier-2 vocabulary
  has nowhere to execute. *Evidence:* audit §2 "Scroll-as-time = NO; Director = NO; Renderer
  = NO".
- **G3 — Director vocabulary too narrow.** `DesignDirective.experienceIntent` is
  `standard|moment-led` + one `moment` (`directive.ts` per ADR 0005); it cannot override
  `mode` beyond what `planExperience` derived, and `moment` is a `SectionKind` not a role.
- **G4 — Confusing name collision unguarded.** `lib/design/experience.ts` vs `lib/experience/`
  share a name with no contract linking them (§0.3). A future agent will conflate them
  (exactly as the audit warns).

### Renderer gaps
- **G5 — No moment marker realization beyond `.section--moment`.** ADR 0005 shipped one CSS
  wash; it is not yet driven by a `transition` enum or by per-boundary data.
- **G6 — No scroll-progress variable.** The static renderer has no `--p`/`--vis` mechanism,
  so even CSS-only scroll-driven behaviour (handoff, scrub) is unreachable.
- **G7 — `renderer-coverage.ts` cannot see runtime fields** (it mutates `WebsiteDesign`
  leaves; Tier-2 lives outside `WebsiteDesign`).

### Runtime gaps
- **G8 — No generic `lib/runtime/` exists.** `runtime.ts` is bakery-shaped and lives in
  `lib/experience/`, unreachable from the product.
- **G9 — No FPS/context-loss fallback host** for any future continuous feature.

### Design-intelligence gaps
- **G10 — `planInteraction` caps at `guided`** with `ceiling: immersive` recorded but dead
  (`interaction.ts:80-89`). The *intent* is captured; the *delivery* is not.
- **G11 — No `temporalArc`/`narrativeDevice` signal** in `BusinessCharacter`, so a business
  whose evidence supports a clock/day-night device (like Bakery) cannot be recognized as a
  candidate for one.

### Content gaps
- **G12 — Section copy is still partially generic** for non-hero beats (ADR 0006 debt:
  "section copy is still generic `composeBaseline` text"). The *order* is specific; some
  *words* are not yet.
- **G13 — `classifyIndustry` has no `venue` category** (ADR 0007): event venues reach
  `general` unless a service word matches. Mis-routes the experience ladder.

### Asset gaps
- **G14 — No `handoff` concept in `AssetChoreography`** for I3; the circular handoff origin
  is hard-coded in Bakery and would misalign for any other business.

### QA gaps
- **G15 — No continuous-experience QA harness** in the product (the 220-position sweep lives
  only in `scripts/verify-experience.mjs` against the Bakery fixture). Needed before any
  Tier-2 capability ships.
- **G16 — `genericityReport` does not yet cover** narrative order / transition / hero-treatment
  axes collapsing (it checks hero/gallery/CTA/type/order per ADR 0006; extend to Experience
  fields).

---

## 12. Implementation roadmap (architecture before cosmetic effects)

Dependency-ordered. **No coding in this study** — this is the plan for the next phase.

**Phase 0 — Guard the name collision (0.5 day).**
- Add a one-paragraph contract comment to both `lib/design/experience.ts` and
  `lib/experience/` stating their distinct roles (§4.3). No behaviour change.

**Phase 1 — Vocabulary widening (deterministic, no runtime).**
- Widen `ExperienceArchitecture.momentTransition: boolean` → `transition: 'none'|'veil'|'wipe'|'circular-handoff'` (G1).
- Add `narrativeDevice` to `BusinessCharacter` (opt-in, evidence-gated) (G11).
- Extend `AssetChoreography` with `handoff` (G14).
- *Test:* benchmark asserts three bakeries (§5.2) diverge on `transition`/`arc`/`pacing`.

**Phase 2 — CSS-only connective tissue in the static renderer (no JS).**
- Realize `transition` enum as CSS primitives: inset wipe, directional wipe, circular handoff
  with **derived** origin (T4–T6, G5/G6 partial).
- Promote `worlds.ts` journey to drive a *boundary* transition where `transition` is set.
- *Test:* `renderer-coverage.ts` shows the new fields are USED; snapshot tests hold.

**Phase 3 — Small generic runtime host `lib/runtime/` (Tier B).**
- Extract `sample()`/`frame()`/`wash()` from `runtime.ts` (bread-free core): scroll playhead,
  `--p`/`--vis`, ground band, veil, line-split, presence gate, FPS degrade, context-loss
  fallback (B, G8/G9).
- Gate it behind `interaction.ceiling === 'immersive'` OR an explicit `transition` that needs
  JS; otherwise the static Experience renders.
- *Test:* reduced-motion → static; no-WebGL → designed fallback; 60fps on desktop/mobile.

**Phase 4 — QA harness for continuous experiences (G15/G16).**
- Port `verify-experience.mjs`'s 220-position sweep + keyboard + both motion modes into the
  product QA, driven by `ExperienceScript` not a fixture.
- Extend `genericityReport` to Experience axes.

**Phase 5 — Specialized WebGL as opt-in domain module (Tier D).**
- Register `lib/experience/` (bakery) as the *reference* immersive host for class `bakery`,
  selected by `heroObjectState` + `interaction.ceiling === 'immersive'`. Fix `'Bakery'`
  hard-code to read category (§10 ISOLATE).
- *Do not* build a second shader until a second business class earns one and its evidence is
  verified.

**The goal this roadmap serves:** BusinessForge can generate (a) Bakery A — cinematic
narrative with hero object + veil; (b) Bakery B — warm showcase with full-bleed gallery and
a wipe, no hero object; (c) Mechanic A — functional brochure, phone-forward — **all from the
same validated capability system**, differentiated purely by Business Character and evidence.
That is the test in §14.

---

## 13. Anti-patterns (explicit)

- **Bakery hard-coding into the general renderer.** `lib/experience/` stays specialized; the
  general renderer gets only the *generic* extractions (§10, §20.6).
- **Random visual variation.** Distinctness comes from `BusinessCharacter`→`ExperienceScript`,
  never from `Math.random` or unseedable choices (ADR 0006 rule 1).
- **Generic template + cosmetic skin.** The failure mode the experience system exists to
  kill. `mode` is derived from character, not assigned by industry (ADR 0006).
- **AI-generated arbitrary CSS/JS/GLSL.** The model names *intent* from a closed set; the
  renderer executes *validated* capabilities (§6, ADR 0004/0005).
- **Forcing every business into immersive mode.** `immersive` is the top rung, reachable only
  when evidence earns it and a runtime host exists; `brochure` is the correct answer for thin
  businesses (`experience.ts:23-34`).
- **Copying `DoughState` into a universal schema.** It is bread vocabulary; an abstract
  `heroObjectState` + per-category shader is the only safe form (§3.2, §20.6).
- **Making WebGL mandatory.** WebGL is Tier D, opt-in, per-class, with a designed fallback
  (§7, §10 ISOLATE).
- **Confusing a scene model with a design system.** `lib/experience/` (scene/model runtime)
  is not `lib/design/` (design system). They answer different questions (§4.3).
- **Adding effects without an experience architecture.** A `transition` is earned by a real
  `moment` in a `narrative` (or a showcase craft exception), never as decoration
  (`experience.ts:179-182`).
- **Sacrificing business functionality for visual spectacle.** Functionality is a structural
  invariant (§8); the immersive path *adds* a skip link, never removes nav.

---

## 14. Final architectural test

**Given two businesses in the same industry with different Business Characters, can the system
produce two Experiences with different:**

| Axis | Different? | Mechanism | Confidence |
|---|---|---|---|
| **Narrative order** | YES | `roleFor()` + `planNarrativeOrder()` read character, not category (`script.ts:103-200`) | High — proven by 6-business benchmark (ADR 0006) |
| **Scene composition** | YES (Tier 1) | `mode`+`moment`+`galleryLead`+`heroTreatment` choose distinct variants/frames; bakery C1 proves composition-as-unit | High for static; Medium for immersive (runtime not built) |
| **Pacing** | YES | `pacing` (compact/measured/cinematic) + scroll-distance realization (P1/P2) | High |
| **Imagery** | YES | `AssetChoreography` (hero/signature/sequence/contrast/reduce) + `imageChoreography` | High |
| **Interaction** | YES | `InteractionStrategy` level/ceiling (static→immersive) | High for intent; Medium for delivery (runtime not built) |
| **Transitions** | YES (after Phase 1/2) | `transition` enum → CSS/veil primitives (G1, T3–T6) | High after roadmap; currently a boolean only |
| **Typography behaviour** | YES | `heroTreatment.typography` + display-split/mono-log (Y1–Y3) | Medium-High |
| **Conversion path** | YES | `ConversionStrategy` (verb/placement/friction/high-intent pull-forward) | High — independent of visual mode |

**Both remain functional and QA-valid?** YES — functionality is a structural invariant (§8);
QA gates (`scoreExperience`, `genericityReport`, `narrativeCoherence`, and the runtime sweep
in Phase 4) enforce it.

### What is still missing for a full YES
The architecture *can* answer YES for every axis **except** that the **Tier-2 delivery
mechanisms are not yet built** (G2/G8 — no `lib/runtime/`; G5/G6 — no scroll-progress
variable; G15 — no product QA harness for continuous experiences). The *contracts and
vocabulary* that would let it answer YES are present or specified here (Phases 1–2 are
deterministic and shippable now). The immersive *delivery* (Phases 3–5) is the remaining
large build and is intentionally deferred, exactly as ADR 0006/0007 prescribe.

**Verdict:** The architecture is **sufficient in intent and contract** to guarantee distinct,
functional, QA-valid Experiences for same-industry businesses differing in character. The
**implementation gap is real but bounded and dependency-ordered** — it is a contract/capability
gap (per the audit), not a conceptual one.

---

_End of study. No files modified except this document. All claims cited to
`docs/bakery-v2-technical-reference.md`, `docs/experience-capability-audit.md`,
`docs/canonical-bakery-v2.md`, `docs/experience-system.md`, ADRs 0005/0006/0007, and the
`lib/design/*` + `lib/experience/*` source files named inline._
