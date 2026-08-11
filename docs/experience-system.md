# The experience system

_How BusinessForge decides what visiting a business's page feels like — the layer
above the section engine, added after the "brochure, not experience" review._

## The chain

```
Research evidence (profile + content + assets)
  → BusinessCharacter        lib/design/character.ts     (deterministic)
  → ExperienceArchitecture   lib/design/experience.ts    (mode / signature moment / gallery-lead / pacing)
  → AssetChoreography        lib/design/assets.ts        (hero / signature / sequence / contrast / rights)
  → ConversionStrategy       lib/design/conversion.ts    (posture / CTA / placement / friction)
  → InteractionStrategy      lib/design/interaction.ts   (static → subtle → guided → immersive*)
  → ExperienceScript         lib/design/script.ts        (narrative role per beat, narrative order)
  → Content Director         lib/content/director.ts     (what each beat says — see docs/content-system.md)
  → AI Director (optional)   agents/designDirectorAgent  (validated closed-set overrides)
  → composeDesign            lib/design/compose.ts       (drives existing renderer levers)
  → renderer                 lib/render/                 (deterministic, no-JS)
  → quality gates            lib/design/quality.ts       (score + template-smell)
                             lib/content/quality.ts      (fabrication + boilerplate + role fit)
```

The first six steps are derived **once**, by `planNarrative` (`lib/design/plan.ts`),
and handed to both the Content Director and `composeDesign`. Deriving them twice
would let a page read the copy the platform just wrote for it back as evidence
about the business — see ADR 0007.

Everything up to the renderer is **deterministic and runs with no model** — the
`--compose` path produces a business-specific experience on its own. The AI
Director is an *improver*, never a single point of failure: when it is present it
may override the floor, but only through decisions validated against closed sets
(`applyDirective`); when it is absent or returns an invalid value, the floor
stands. This is the architectural rule from the brief: deterministic code for
repeatability and safety, AI for judgement where useful.

## What each layer decides (all observable on `WebsiteDesign`)

- **Character** — `visualWeight`, `atmosphereRange`, `emotionalRegister`,
  `offeringBreadth`, `narrativePotential`, `signatureCandidate`. Read from real
  evidence (usable image count + orientation variety, service breadth, register
  words, rating), never from the category alone.
- **Experience** — `mode ∈ {brochure, showcase, narrative, immersive}`, the
  signature moment, gallery-lead, pacing. `immersive` is defined but never
  selected (see runtime, below).
- **Assets** — which image is the hero, which is the signature, the curated
  sequence, where framing changes for contrast, when to *reduce* imagery, which
  assets are `reference-only` because their rights are unconfirmed.
- **Conversion** — `mode ∈ {direct, balanced, editorial, high-intent}`, the CTA
  verb (`call/book/reserve/order/visit/enquire/quote`), placement, contact
  prominence, information density, trust placement, friction.
- **Interaction** — `static/subtle/guided/immersive`, capped at what the
  renderer can deliver today (`guided`), with the wanted `ceiling` recorded.

## Factual unknown vs creative freedom

Every strategy decision carries a `basis`: `evidence` (forced by what the
business has) or `creative-default` (the evidence is thin, so the system chose an
intentional, safe shape). The system never invents a *fact* to justify a richer
experience — a missing hero is a real answer, a thin business gets an honest
`brochure`. It only exercises creative freedom over *design* choices (a CTA verb,
a pacing), which is legitimate and is marked as such.

## The quality gate (template-smell)

`genericityReport` measures, across a set of businesses, how many identity-bearing
axes collapsed to a single value — same hero, same gallery structure, same CTA
placement, same typography, same narrative order, same experience mode. Two or
more collapses is a `template-smell` failure. The six-business benchmark
(`test/design/benchmark.test.ts`) asserts the set stays `diverse`.

## The experience script — narrative order (built)

The page order is no longer an industry-priority sort; it is a **narrative arc**
derived from character. `lib/design/script.ts`:

1. **`roleFor(kind, character, experience)`** assigns each section a closed-set
   `NarrativeRole` (`arrival · emotion · reveal · process · signature · space ·
   breadth · proof · trust · context · conversion · coda`). The *same* section
   kind gets a *different* role by evidence — a gallery is a `signature` for a
   business built around it, a `reveal` for one that merely leads with imagery, a
   `space` for one that only documents premises; an `about` is a `reveal` for an
   experiential business and `process` for a functional one. The nominated
   signature moment always wins.
2. **`planNarrativeOrder`** pins the hero first and the closing CTA last (the
   renderer and nav depend on it) and sorts the middle along a narrative spine
   (`ROLE_RANK`): opening → reveal → signature → space → breadth → proof/trust →
   context → conversion. A **high-intent** business moves its contact beat up to
   just after the offering (`breadth`), so a visitor who came to act is not walked
   through a discovery arc — the closing CTA still closes.
3. **`buildScript`** assembles the observable `ExperienceScript` (`Beat[]` with
   role, emphasis, ground, pacing, visual intensity, transition, signature) from
   the order and the layout the renderer will actually use, so the story reads
   straight off `WebsiteDesign.experienceScript`.

Because roles come from character, **two businesses in one industry diverge**: a
rich hotel scripts `emotion → reveal → signature → breadth → conversion`; a thin
motorway hotel scripts `arrival → breadth → conversion → context` — same
industry, different narrative, no invented facts.

### Narrative coherence (quality gate)

`narrativeCoherence(design, character)` (in `quality.ts`, and an axis of
`scoreExperience`) fails a page when: conversion is reached before enough
discovery (unless high-intent); strong signature evidence exists but no signature
is placed; a gallery-led business buries its gallery in the final third; a
high-intent business walks the visitor too far before the ask; or a narrative arc
is claimed for a business whose evidence supports none. The six-business benchmark
asserts every business passes, and that a deliberately broken one fails.

## Phase 5 — the experience runtime: audit and plan

### What Bakery V2 actually is

`lib/experience/` is a hand-authored **scene script** executed by a bakery-shaped
client runtime. Its reusable mechanism (from `lib/experience/types.ts`):

| Mechanism | Generalizable? |
|---|---|
| `Scene[]` where order carries meaning; each `SceneKind` is a distinct composition | **Yes** — as a data plan (a beat sequence), not the 9 bakery kinds |
| `beats` (viewport-heights) = pacing | **Yes** — pacing is already a first-class decision here |
| `clock` / `marker` continuous timeline | Runtime-only |
| per-scene `ground` (colour journey) | **Already built** — `worlds.ts` `assignJourney()` |
| `veil` polarity-flip transition | Partly — `.section--moment` wash exists; full veil needs runtime |
| loop-closing `coda` | **Yes** — a content/order decision, no runtime needed |
| WebGL dough shader, scroll-as-time playhead, FPS auto-degradation | **Bakery/runtime-specific** — not generalized |

### The split that matters

There are **two** things, and only one of them needs a runtime:

1. **The script (data).** An ordered sequence of *beats* — a composition intent,
   the section it binds, its ground, its pacing, whether it is the signature or a
   transition. This is **deterministically derivable today** from
   `ExperienceArchitecture` + `AssetChoreography` + content, and the current
   static renderer already realises a large part of it (order + emphasis + ground
   journey + moment + full-bleed gallery). The user's examples are exactly this
   data:

   - **event venue:** opening emotion → visual reveal → signature event moment →
     spaces → breadth → trust → conversion
   - **mechanic:** problem → expertise → process → services → proof → contact
   - **bakery:** sensory opening → product reveal → craft → products → atmosphere → visit
   - **hotel:** arrival → atmosphere → rooms → experience → surroundings → booking

   None of these is a template; each is the natural order for that *character*,
   derivable from `experienceMode` + `signatureMoment` + section kinds + assets.

2. **The runtime (behaviour).** Scroll-as-time continuity, the veil crossings,
   a hero object, FPS-guarded continuous rendering. This needs a **client runtime
   the static "opens-from-disk, no-JS" renderer deliberately does not have**, plus
   its own contrast/perf/reduced-motion QA harness. It is a genuinely separate
   build and must not be faked.

### Recommended next step (honest, staged)

Implement **the script as data first**: a deterministic `ExperienceScript`
(`Beat[]`) derived from the layers already built, replacing the industry-priority
sort in `orderSections` with a character-driven narrative order, and exposed on
`WebsiteDesign`. This makes the *sequence* business-specific (a mechanic's
problem→proof→contact vs a venue's emotion→reveal→signature→conversion) using the
existing static renderer — no runtime, no faked motion, fully testable against the
benchmark. Only after that proves out should the continuous runtime be built as an
opt-in mode for the businesses whose evidence earns `immersive` (today the system
records that ambition as `interaction.ceiling` and caps the delivery at `guided`).

**Status:** Phases 1–4, 6, 7 are implemented and tested. Phase 5's *data* half —
the `ExperienceScript` — is built (`lib/design/script.ts`). Phase 5's *runtime*
half is the remaining large build and is intentionally not started.

## What came next: the words

The order was bespoke and the prose was not. `docs/content-system.md` and ADR
0007 record the Content Director that closed that gap: narrative role now decides
what each beat *says*, not only where it sits, and the language of the copy
follows the language of the evidence. `NarrativeRole` also reaches the stylesheet
as `data-role`, so the signature beat is finally set as the page's visual peak
rather than at the same step as the section three bands above it.
