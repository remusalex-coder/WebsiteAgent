# From Business Evidence to Creative Direction
### How a senior art director transforms raw business information into a unique website concept

**Status:** Research artifact v1 (pre-implementation). **Do NOT implement. Do NOT modify WebsiteAgent.**
**Author role:** Research Director
**Date:** 2026-08-11
**Companion docs:** `Design_Intelligence_Foundation.md` (principles) · `AWWWARDS_PATTERN_LIBRARY.md` (visual evidence)
**Why this doc exists:** The previous two documents give BusinessForge a *vocabulary* (timeless + premium principles) and a *reference set* (25 Awwwards teardowns). Neither answers the real question: **given raw business evidence, how do you arrive at a concept?** This document is the missing middle — the art-direction reasoning layer. It is the difference between an "AI website builder" (assembles components) and a *creative-direction system* (derives a concept, then executes it).

---

## 0. The problem statement (from the founder)

> BusinessForge must receive `business + evidence + photos + audience + positioning` and produce `creative concept → design direction → narrative → art direction → website`.
> Not 100 templates. A system that *derives* a unique direction from evidence.

Raw input example (realistic):
`dentist, 15 years experience, premium, online bookings, 6 services, 20 photos`
Must become a *direction*, not a layout:
`editorial / clinical-premium / trust-first / restrained motion / photography-led`

This document specifies **how that transformation should work** — the stages, the decision logic, what is deterministic vs AI, and what evidence actually supports each step. It does not implement it.

---

## 1. Methodology anchor: the Double Diamond as the pipeline shape

The industry-standard model for exactly this kind of "diverge → converge" thinking is the **Double Diamond** (Design Council; taught at IxDF/Interaction Design Foundation) [S1, S2]:

- **Diamond 1 — Discover + Define:** understand the business/audience/context; *diverge* on research, *converge* on a clear problem/framing.
- **Diamond 2 — Develop + Deliver:** *diverge* on concepts, *converge* on the executed solution.

**Implication for BusinessForge:** the system must have **two divergence-convergence stages**, not one. Most "AI builders" collapse this into a single generate step and therefore produce generic output. The first diamond produces the *creative brief*; the second produces the *design*.

> Deterministic scaffolding (the diamond stages, the required inputs, the required outputs of each stage) is enforceable. The *content* inside each divergence (what concepts to consider) is AI-directed.

---

## 2. The Creative-Direction Pipeline (proposed architecture)

```
RAW EVIDENCE
  (business facts, listings, reviews, photos, audience, positioning, competitors)
        │
  [STAGE A — EVIDENCE NORMALIZATION]  ← DETERMINISTIC
  structured BusinessProfile schema (typed fields; missing-field flags)
        │
  [STAGE B — PERCEPTUAL TARGETING]    ← AI (deterministic guardrails)
  map evidence → desired perceptions (premium? trustworthy? modern? friendly? expert? luxurious? local? innovative?)
        │
  [STAGE C — CHARACTER VECTOR]         ← AI (deterministic schema)
  compress into a small set of continuous/ordinal dimensions (see §4)
        │
  [STAGE D — CREATIVE CONCEPT]         ← AI (the "diamond-2 diverge")
  concept = positioning statement + personality + metaphor + tone (NOT a layout)
        │
  [STAGE E — DESIGN DIRECTION]         ← AI + deterministic token system
  concept → type personality, palette strategy, grid strategy, motion strategy, imagery strategy
        │
  [STAGE F — ART DIRECTION / NARRATIVE]← AI + deterministic rules
  photo role assignment (hero/supporting/full-bleed), sequencing, section rhythm, copy voice
        │
  [STAGE G — RENDER]                   ← DETERMINISTIC (lib/design + lib/render)
  tokens + validated rules → static, accessible, fast HTML/CSS
        │
  [STAGE H — CRITIQUE LOOP]            ← AI critic + deterministic QA gates
  screenshot → critique → modify → re-render (see §9)
```

**Key principle:** Stages A, G, H-contracts are deterministic. Stages B–F are AI-directed but *bounded* by deterministic schemas and validators (from the two prior docs). This matches the repo's hybrid doctrine.

---

## 3. Stage B — Perceptual Targeting (the "what should this feel like" map)

BusinessForge's goal is to evoke specific **perceptions**. These are the 9 the founder named, each with the visual levers that produce it (synthesized from Aaker brand-personality [S3], NN/g trust [S4], premium-craft research [S5], and the Awwwards teardown [S6]):

| Desired perception | Primary visual levers (evidence-backed) | Anti-signals |
|---|---|---|
| **premium** | generous whitespace, intentional type, restrained 2–3 color, precise grid, original photography, fast load [S5] | crowding, system fonts, stock clichés, rainbow palette, slow load |
| **trustworthy** | clear identity, up-front disclosure, current content, professional layout [S4]; visible reviews/credentials; security indicators | vagueness, broken/outdated info, stock handshake photos |
| **modern** | contemporary type (geometric/neo-grotesk), generous space, subtle motion, current but not trend-chasing | dated gradients, bevels, tiny stock |
| **expensive / luxurious** | abundance of whitespace, fine/editorial type, smooth textures, monochrome or near-monochrome, restrained motion [S3 Sophistication] | busy patterns, loud color, cheap stock |
| **friendly / local** | warm neutrals, humanist/sans type, real local photography, conversational copy, rounded shapes [S3 Sincerity] | cold corporate blue, stock "diverse team" |
| **expert / competent** | polished, high-impact type, blue/white trust cues, accessibility, innovation signals [S3 Competence] | amateur layout, errors |
| **innovative** | unconventional type/shapes, generative/canvas moments (gated), bold contrast [S3 Excitement] | generic template structure |
| **local** | place-specific imagery, local language/culture cues, neighborhood references | generic "global" stock |
| **editorial** | serif/contrast type, asymmetric grid, long-form rhythm, art-directed photography [S6] | centered everything, card stacks |

**Critical nuance (contradiction surfaced):** "trustworthy" and "premium" can pull in *opposite* directions. A luxury brand wants restraint; a local family dentist wants warmth + clarity, not cold luxury. The Character Vector (§4) resolves the conflict — you don't maximize all 9, you pick the 2–3 that match the business and let the rest be neutral.

---

## 4. Stage C — The Character Vector (the compression that makes it deterministic-friendly)

Rather than free-form "vibes," compress evidence into a **small, typed vector** that AI fills and deterministic rules consume. Proposed dimensions (each 0–1 or ordinal), grounded in the perceptual map and the Awwwards teardown:

1. **priceTier**: budget ↔ premium ↔ luxury
2. **consideration**: impulse (book now) ↔ considered ↔ high-stakes (life/legal)
3. **sensoryFunctional**: experience-led ↔ utility-led
4. **audienceFormality**: casual/local ↔ professional ↔ aspirational
5. **heritageNovelty**: traditional/heritage ↔ modern/startup
6. **emotionalRegister**: reassuring ↔ energetic ↔ exclusive ↔ trustworthy
7. **visualOutputVolume**: low (abstract service) ↔ high (photography-rich)
8. **competitiveCrowding**: how differentiated the local field is (from competitor scan, §8)
9. **culturalDuality**: single-locale ↔ multi-language/culture

This is the same vector proposed in `Design_Intelligence_Foundation.md §14`, now given a *pipeline role*: it is the **interface between AI judgment (Stages B/C) and deterministic execution (Stages E/G)**. Every downstream design decision reads from this vector.

> Deterministic: the schema, the ranges, and the *validation* (values in range, no contradictions e.g. luxury + budget). AI: the *values*, inferred from evidence.

---

## 5. Stage D — Creative Concept (the part "AI builders" skip)

A concept is a **short verbal framing**, not a layout. Senior art directors produce this before opening Figma [S7: "the strongest visual concepts don't start in Figma; they start with the right questions"]. Proposed concept deliverable:

```
CONCEPT = {
  positioning:   one sentence the visitor should believe
  personality:   1–2 Aaker dimensions (Sincerity/Excitement/Competence/Sophistication/Ruggedness) [S3]
  metaphor:      the single image/idea the design riffs on (e.g., "a calm clinic, not a factory")
  tone:          voice adjectives (e.g., "confident, warm, precise")
  differentiator: what we will NOT do that competitors do (see §8)
}
```

**Worked seed (not final):** for the Sibiu dentist →
`positioning: "15 years of calm, precise dental care you can trust."`
`personality: Competence + Sincerity`
`metaphor: "a quiet, sunlit consultation room — not a clinical conveyor belt"`
`tone: reassuring, expert, local`
`differentiator: no stock 'diverse team' photo, no blue-everything, no card-grid services`

This is the *concept*. Only now does design begin. **This is the core differentiator vs template generators**: they start at layout; we start at concept.

---

## 6. Stage E — Design Direction (concept → visual system)

Translate the concept + character vector into the four visual systems. Each maps from the prior docs' rules:

- **Type personality** (`typography intelligence`): from personality dimension + audienceFormality + heritageNovelty.
  - Competence/Sincerity + local → humanist sans (friendly, readable) [S3].
  - Sophistication + luxury → editorial serif/contrast [S3, S6].
  - Excitement + innovative → unconventional display [S3].
  - Then: `font category → weight → scale → spacing` per `AWWWARDS_PATTERN_LIBRARY P-003/P-005`.
- **Palette strategy** (`color intelligence`): from emotionalRegister + audience + imagery.
  - Trust/Competence → blue/white *but avoid cliché navy-overload* [S4]; derive a specific hue.
  - Sophistication → monochrome + 1 accent.
  - Separate myth from evidence: "red = energy" is a *weak/overstated* claim [see Open Questions]; use it only when the character vector supports excitement, not by default.
  - Deterministic: ≤3 active hues, AA contrast, accent = action [Foundation C-01/C-03].
- **Grid strategy**: from sensoryFunctional + premium.
  - Editorial/premium → 12-col + asymmetric breakouts (P-008).
  - Utility → standard 12-col, predictable (P-009 variant).
- **Motion strategy**: from consideration + premium.
  - High-stakes/trust → restrained (P-014, reduced-motion).
  - Sensory/innovative → purposeful motion (P-002/P-015, gated by perf).

**Contradiction handled:** "modern" tempts trend-chasing (Awwwards 2026 VR/3D [S6]) while "trustworthy/premium" demands restraint. Resolution: trends decorate a restrained base (Foundation doctrine); motion is gated, never governing.

---

## 7. Stage F — Art Direction & Narrative (the photo/sequence intelligence)

This is the founder's #5 concern and the highest-value differentiator. From the business's photo set + concept:

**Photo role assignment** (AI, deterministic guardrails):
- **Hero**: the single most "character-defining" image — for a dentist, that's a real, calm, well-lit photo of the *space or a real patient moment*, never a stock handshake [S5, Foundation I-01]. Deterministic rule: hero must be original; if none available, honest contextual image + brief flag.
- **Supporting**: secondary services/team/space photos, art-directed crops.
- **Full-bleed**: only for sensory/premium characters (hotel, restaurant, photographer) [S6 P-002/P-012].
- **Whitespace-over-image**: when the concept is restraint/editorial, prefer whitespace to more photos [S5, S6 P-014].

**Crop / aspect / focal point** (AI): match character — tight editorial crops for sophistication, wider environmental for local/sincerity. Deterministic: all images responsive + alt-text + lazy [Foundation A-04, R-06].

**Sequencing / section rhythm** (AI + deterministic skeleton): trust-first ordering (Foundation N-02/CV-02) — proof before ask. Rhythm varies by character: editorial = long-form peaks [S6 P-011]; utility = clear benefit→CTA [S6 P-009].

**Narrative voice** (AI): from tone adjectives; specificity lint (Foundation N-03) — "15 years, 6 services, online booking" → concrete copy, not "we care about your smile."

---

## 8. Stage — Competitive Differentiation (the "Sibiu dentist" weapon)

The founder's #9: scan competitors, then *avoid* the cluster. This is enforceable as a **differentiation rule**:

```
COMPETITIVE_SCAN(business, locale) → cluster profile:
  common_base, common_accent, common_imagery, common_layout, common_copy
DIFFERENTIATION = invert or displace the cluster on ≥2 axes:
  - if cluster = white+blue+stock+cards  →  choose warm-neutral base + character-derived accent + original photo + editorial rhythm
```

Evidence basis: premium = differentiation + intentionality [S5]; Awwwards winners differentiate via character, not industry [Foundation S13/§14]. This directly defeats the "template-looking" failure mode.

> Deterministic: the scan produces a structured cluster; the *inversion choice* is AI but must differ from cluster on ≥2 documented axes (validator).

---

## 9. Stage H — Design Evolution / Critique Loop (the founder's #10, "most interesting")

Real art direction is iterative: **generate → look → critique → modify → look → critique → modify** [S7, S8 frog "design the future we want"]. To make this automatic:

- **Render** deterministic (Stage G).
- **Capture** screenshot (already proven feasible in the Awwwards teardown — 74 shots captured).
- **Critique** via an AI critic prompted with: (a) the concept, (b) the perceptual targets, (c) the bespoke-vs-template checklist [Foundation §15], (d) the accessibility/perf gates [Foundation §11/§10-M04].
- **Modify** by re-deriving the affected design tokens / art-direction assignments; re-render.
- **Converge** when critiques are satisfied or a max-iteration budget is hit.

**Crucial:** the critic must check *coherence with the concept*, not just "does it look like Awwwards." A site can be beautiful and off-brief. The concept (Stage D) is the fixed star; the loop orbits it.

Deterministic gates inside the loop: no regression on WCAG AA, Core Web Vitals, reduced-motion, bespoke-checklist score. AI: the critique judgments + the modifications.

> Note: the vision/image-analysis service was unavailable during this research; the loop's "look" step currently relies on DOM/CSS extraction + screenshots. A working vision critic (when available) strengthens it but is not required — the bespoke-checklist (Foundation §15) is text/DOM-checkable today.

---

## 10. What is deterministic vs AI (consolidated for this pipeline)

| Stage | Deterministic | AI-directed |
|---|---|---|
| A Evidence normalization | schema, types, missing-field flags | (none — pure structure) |
| B Perceptual targeting | the 9-perception lever table (guardrails) | which 2–3 perceptions fit |
| C Character vector | schema + ranges + contradiction check | the values |
| D Creative concept | required deliverable shape | positioning/personality/metaphor/tone |
| E Design direction | token system, ≤3 hues, AA, grid base, motion gates | type personality, palette hue, grid variant, motion style |
| F Art direction | original-photo rule, responsive/alt/lazy, trust-first order, bespoke lint | photo roles, crops, sequencing, copy voice |
| G Render | ALL of it (static, accessible, fast) | (none) |
| H Critique loop | gates (WCAG/Vitals/reduced-motion/checklist) | critique + modifications |

This is the same deterministic-floor / AI-sentence doctrine, now instantiated as a *pipeline*.

---

## 11. Worked end-to-end example (the Sibiu dentist)

**Raw:** `dentist, Sibiu, 15 yrs experience, premium, online bookings, 6 services, 20 photos`

**A — Profile:** industry=dentist, locale=Sibiu, tenure=15y, positioning=premium, booking=online, services=6, photos=20 (original available).

**B — Perceptions:** trustworthy (must), expert (must), friendly/local (Sibiu), premium (claimed) → NOT luxurious, NOT energetic.

**C — Vector:** priceTier=premium, consideration=high-stakes(trust), sensoryFunctional=utility→but care is intimate, audienceFormality=professional+local, heritageNovelty=established(15y), emotionalRegister=reassuring+trustworthy, visualOutputVolume=high(20 photos), competitiveCrowding=high (Sibiu dentists likely cluster), culturalDuality=single (RO).

**D — Concept:** positioning "15 years of calm, precise dental care you can trust." personality=Competence+Sincerity. metaphor="a quiet, sunlit consultation room." tone=reassuring, expert, local. differentiator="no stock 'diverse team', no blue-everything, no service card-grid."

**E — Direction:** type=humanist serif for headings (trust+editorial) + clean grotesk body; palette=warm off-white base + character-derived muted teal/sage accent (NOT clinical blue), ≤3 hues, AA; grid=12-col with calm asymmetric breakouts; motion=restrained (fade/reveal only, reduced-motion safe).

**F — Art direction:** hero=best original photo of the *real clinic space*, calmly lit; supporting=6 service photos art-directed (not icons-in-cards); full-bleed only for one signature space photo; sequence=hero → reassurance/who-for → original-photo proof → services (editorial, not cards) → reviews/credentials → online-booking CTA → contact; copy=specific ("15 years," "online booking," real Sibiu references).

**G — Render:** static, AA, fast, responsive.

**H — Critique:** does it read trustworthy+local+premium and *not* like the Sibiu cluster? If cluster=blue+stock+cards, we pass (warm-neutral + original + editorial). Converge.

---

## 12. Evidence / Sources

| ID | Source | Type | Use |
|---|---|---|---|
| S1 | Design Council / Double Diamond (via IxDF) | Methodology | §1 pipeline shape |
| S2 | IxDF — Design Thinking / Double Diamond | Methodology | §1, §9 |
| S3 | Aaker 5 Brand-Personality Dimensions (Miel Café synthesis of Aaker 1997) | Perception→visual map | §3, §5, §6 — **core anchor** |
| S4 | NN/g — Trustworthiness / Brand UX | Trust levers | §3, §6 |
| S5 | Splash/CreateAWebsite — premium & trust craft | Premium signals | §3, §7 |
| S6 | AWWWARDS_PATTERN_LIBRARY.md (25 teardowns) | Visual evidence | §3, §6, §7 |
| S7 | Smashing — "From Kickoff To First Concept" (brand strategy→visual direction) | Pre-concept practice | §5, §9 |
| S8 | frog — creative direction / "New Lines of Luxury" | Senior AD practice | §9 |

*Note: several methodology URLs 404'd at fetch time (Design Council, AIGA, some NN/g, some Smashing) — link-rot is high for these. Principles cited are stable and cross-confirmed by the surviving sources (IxDF for Double Diamond; Miel Café for Aaker; Smashing index for pre-concept). Re-source before encoding (Open Questions).*

---

## 13. Open Questions (require further research)

1. **Aaker dimensions are Western/1997** — do they transfer to Romanian/Sibiu SMB context? Need a localized validation or a culture-aware extension.
2. **Perception levers need empirical weighting** — which visual change moves "trust" most? Currently practice-based, not A/B-proven for SMB sites.
3. **Character-vector reliability** — can an AI stably score priceTier/consideration from listings+reviews? Needs eval on the 11 verticals.
4. **Competitor scan feasibility at ~€0** — what free/€0 sources give enough competitive signal (listings, cached screenshots)? Must honor "no paid APIs" constraint.
5. **Critique-loop critic prompt** — needs calibration so it judges *concept coherence*, not just aesthetics. Propose building a small human-judged brief→site dataset.
6. **Color-emotion myths** — "red=energy," "blue=trust" are overstated [Foundation Open Questions]; need a skeptical synthesis before encoding color rules.
7. **Vision critic dependency** — loop works with DOM/screenshot today; a vision model strengthens it but must not be required (resilience).
8. **Concept drift** — how to keep the concept fixed while the loop iterates (avoid "drifting" into a different brief).

---

## 14. Recommendations for WebsiteAgent later (non-binding)

1. **Implement the pipeline (Stages A–H), not a generator.** The two-diamond shape is the architectural key.
2. **Encode Stage A, G, H-contracts as deterministic** in `lib/design` + `lib/render`; this matches the repo's deterministic core.
3. **Make the Character Vector (§4) the central data structure** — every downstream rule reads it. This is the realization of Foundation §14.
4. **Use Aaker's 5 dimensions (S3) as the perception→visual bridge** in Stage E; it is the most evidence-backed mapping we found.
5. **Add the Competitive-Differentiation rule (§8)** as a first-class stage — it is BusinessForge's defensible moat vs template builders.
6. **Wire the Critique Loop (§9)** using screenshots + the bespoke-vs-template checklist (Foundation §15) + deterministic gates; start without a vision model.
7. **Keep concept (Stage D) as the fixed star** the loop orbits — prevents beautiful-but-off-brief output.
8. **Validate against the 11 target verticals** with real business profiles before trusting Stage B/C automation.

---

*End of `From_Business_Evidence_to_Creative_Direction.md` — research only, no implementation, repo not modified.*
