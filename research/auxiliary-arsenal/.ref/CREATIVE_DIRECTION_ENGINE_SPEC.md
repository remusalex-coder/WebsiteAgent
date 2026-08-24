# Creative Direction Engine — Specification

**Status:** Research / Specification v1 (pre-implementation)
**Author role:** Creative Strategy Director
**Date:** 2026-08-12
**Purpose:** Define how an autonomous BusinessForge system transforms raw business evidence into a *unique* creative direction, and how that direction flows into a rendered site — without ever becoming an industry template.
**Constraint honored:** This document does NOT implement anything, does NOT modify the WebsiteAgent repo, does NOT modify the two source research documents, and records no capability as fact unless it is already stated in those documents or in the live repo code I inspected for grounding.

---

## 0. Provenance, sourcing, and honesty note

This spec is a **synthesis** of two research foundations plus a grounding pass over the live WebsiteAgent repository:

- **[DIF]** `Design_Intelligence_Foundation.md` (Research Director, 2026-08-11) — timeless UX, premium craft, color/type/grid/imagery/narrative/conversion/motion rules, an Industry Design Matrix, a Business-Character → Design matrix, bespoke/template detection, and a deterministic-vs-AI framework.
- **[APL]** `AWWWARDS_PATTERN_LIBRARY.md` (Research Director, 2026-08-11) — DOM/CSS teardown of 25 Awwwards-winning commercial sites, 18 abstracted reusable patterns (P-001…P-018), anti-clone rules, and a per-pattern deterministic/AI allocation.
- **[REPO]** Live `WebsiteAgent` source (`docs/architecture.md`, `docs/experience-system.md`, `lib/design/character.ts`, `lib/design/types.ts`, `lib/design/quality.ts`, `agents/designDirectorAgent.ts`) — inspected read-only to ground Section 22 (mapping) in the *actual* architecture rather than inventing one.

**Three classes of statement appear throughout:**

1. **[Sourced — DIF/APL]** — a claim that reproduces a conclusion already in the research. Every such claim is tagged.
2. **[Repo — grounded]** — a claim about what the existing code already does (so Section 22 maps to reality, not a wish-list).
3. **[Synthesis]** — an inference, extension, or operational rule I draw from the above. Synthesis is flagged at the point it is introduced and is kept separate from sourced conclusions.

**Every factual claim in a `Sourced`/`Repo` class traces to a named document or file.** Where the research itself flags a claim as low-confidence or contested (e.g., trust-impact percentages, color-emotion reliability), this spec inherits that uncertainty and does not upgrade it.

**This document does not invent research findings.** It organizes, reconciles, and operationalizes the two foundations plus the repo's existing concepts into one engine specification.

---

# 1. EXECUTIVE MODEL

## 1.1 The problem, restated

The failure mode the research identifies is:

> `industry → template`

[Sourced — DIF §1.6, §13, §14; APL §4 rule 6] A hotel, a law firm, a nail salon each get the *category cliché* (navy-law, red-restaurant, spa-stock) instead of a direction derived from *what the specific business actually is*. The research already names the alternative: **design to the business's character, not its industry label** [DIF §1.6].

The engine must therefore implement the chain:

```
RAW BUSINESS EVIDENCE
  → BUSINESS CHARACTER          (what the business IS, measured from evidence)
  → CREATIVE BRIEF              (internal design brief, before any pixels)
  → CREATIVE CONCEPT            (the one visual idea)
  → VISUAL DIRECTION            (color / type / layout / image treatment)
  → EXPERIENCE ARCHITECTURE     (mode, signature moment, pacing, narrative order)
  → NARRATIVE ARCHITECTURE      (section sequence + beats + peaks + proof + trust)
  → ART DIRECTION               (hero, image sequence, visual rhythm, peaks)
  → CONVERSION                  (CTA, trust-before-ask, friction, rhythm)
  → DESIGN TOKENS               (typography, color, spacing, motion as closed tokens)
  → RENDERED EXPERIENCE         (deterministic, no-JS, provenance-preserving)
```

[Synthesized from DIF §1, §13–§14, §20; APL §3 patterns; REPO docs/experience-system.md]

## 1.2 Explain every transformation

Each step below; the full operational detail lives in the matching later section.

**Raw Business Evidence → Business Character.** Evidence (listings, reviews, services, price signals, category, photos, description, owner pages) is reduced to a **character vector** — a small set of axes scored from the evidence, never from the category alone. [Sourced — DIF §14; REPO `lib/design/character.ts` measures exactly this: `visualWeight`, `atmosphereRange`, `expressiveness`, `emotionalRegister`, `offeringBreadth`, `narrativePotential`, `signatureCandidate`.]

**Business Character → Creative Brief.** The vector is *translated* into a written internal brief: essence, audience, positioning, emotional + trust objectives, desired perception, creative character, visual weight, narrative ambition, imagery potential, conversion priority, differentiation, constraints, anti-patterns. [Synthesis — this brief stage is the missing artifact between "character" and "design" in the repo; the repo jumps from character to `WebsiteDesign` via `planNarrative`. Making the brief explicit (§5) gives the AI Director and a human reviewer a reviewable artifact.]

**Creative Brief → Creative Concept.** From the brief, a single central **visual concept** is chosen — e.g., *precision as visual rhythm*, *human care through intimate photography*, *craftsmanship through material detail*. The concept is not a slogan; it is the organizing principle that the visual direction, narrative, and art direction all serve. [Synthesis built on DIF §8 N-01/N-04 (specificity, editorial depth), APL P-003/P-011 (a dominant idea carried through scale/structure).]

**Creative Concept → Visual Direction.** Concept + character select the *direction*: color system, typography personality, layout language, spacing personality, grid behavior, image treatment. [Sourced — DIF §4 T-04 (type matches character), C-04 (palette from character not cliché), I-02/I-04 (imagery carries sensory register, consistent treatment); APL P-004/P-005/P-014.]

**Visual Direction → Experience Architecture.** Visual intent becomes an **experience mode** (`brochure | showcase | narrative | immersive` [Repo `experience.ts`]) plus signature moment, gallery-lead, and pacing. [Repo docs/experience-system.md.]

**Experience Architecture → Narrative Architecture.** The page becomes a **narrative arc** — an ordered sequence of *beats* with `NarrativeRole` (arrival · emotion · reveal · process · signature · space · breadth · proof · trust · context · conversion · coda) [Repo `lib/design/script.ts`]. Order is character-driven, not industry-priority. [Sourced — REPO experience-system.md §"The experience script"; DIF N-02 persuasion arc.]

**Narrative Architecture → Art Direction.** Each beat gets a layout variant, a **section frame** (stacked/aside/centered/offset/statement — the envelope that was the missing axis against template sameness [Repo `types.ts`]), emphasis, background, full-bleed, and a single `momentTransition` (the visual peak). [Repo `types.ts`, `quality.ts`.]

**Art Direction → Conversion.** Conversion is *woven* into the arc: trust-before-ask ordering, one dominant CTA repeated with context, friction reduction, risk reversal where commitment is high. [Sourced — DIF CV-01/CV-02/CV-04; APL P-009/P-010.]

**Conversion → Design Tokens.** All decisions collapse into **design tokens** — a closed-set, byte-comparable `WebsiteDesign` (typography, color ramps, spacing, radius, motion, layout) that the renderer consumes. [Sourced — REPO `lib/design/types.ts`, `docs/experience-system.md` (composeDesign → renderer).]

**Design Tokens → Rendered Experience.** `renderSite` is a pure, deterministic, no-JS function. No model, no I/O. [Sourced — REPO architecture.md, renderer.md.]

## 1.3 The governing equation

> **Deterministic rules define the floor and the vocabulary. AI chooses the sentence. Every AI choice is passed through the deterministic validators before render.** [Sourced — DIF §17.4 — quoted verbatim; this is the engine's constitutional rule.]

---

# 2. BUSINESS SIGNAL MODEL

## 2.1 Which raw signals matter, and what each tells the system

Each signal below is drawn from the evidence the system can actually read (listings, reviews, category, services, description, photos, owner pages) [DIF §13–§14; REPO `character.ts` reads exactly these]. For every signal I state: *what it tells the system*, *reliability*, *design decisions it can influence*, and *what it must NOT determine by itself*.

| Signal | What it tells the system | Reliability | Design decisions it can influence | What it must NOT determine alone |
|---|---|---|---|---|
| **industry / category** | The weak prior: typical audience, trust driver, default visual lean [DIF §13] | Medium as a *hint*, Low as a *template* | Starting palette/type *suggestion*; which patterns are even candidates | The final palette, type, hero, or layout. Category is a prior, not a template [DIF §1.6, §14; APL §4 rule 6] |
| **services (count + descriptions)** | Offering breadth; the words reveal emotional register (craft vs warm vs romantic vs functional) [Repo `character.ts` ROMANTIC/WARM/CRAFT word lists] | Medium-High (words are real evidence) | OfferingBreadth axis; narrative scope; category-color eligibility (P-007) | Whether the business "deserves" a premium look — a single-trade can be premium |
| **price positioning** | Budget ↔ premium ↔ luxury tier [DIF §14 dim 1] | Low-Medium (often inferred, rarely explicit) | Whitespace generosity, type refinement, accent restraint, material feel | Hue choice — luxury is not "gold"; derived from character |
| **audience** | Formality, language, trust expectations [DIF §13, P-02] | Medium | Tone of copy, formality axis, nav density | The whole visual language — locals and tourists can share one business |
| **location / place** | Local vs visitor vs relocating; cultural duality [APL P-016; DIF §13] | Medium-High | Cultural/language type, place-evoking imagery, warm vs cool ground | Color cliché (e.g., "coastal = blue") |
| **heritage / years in business** | Established ↔ novel; whether editorial long-form is warranted [DIF N-04] | Low-Medium | Editorial depth, serif vs geometric lean, restraint vs energy | That old = traditional-templated; a new business can be heritage-feeling |
| **expertise / credentials** | Authority; trust weighting [DIF CV-05, doctrine §3] | Medium-High | Authority signals placement, proof block weight | Coldness — credentials can be warm |
| **trust requirements** | How much proof must precede the ask [DIF CV-02; APL P-009] | Medium | Trust-before-ask ordering, review prominence | Whether to show personality |
| **emotional register** | functional / warm / romantic / craft [Repo `character.ts`] | Medium (word-count based, margin-gated) | Mood (temperature/energy), imagery treatment, copy voice | The literal category (two dentists differ) |
| **sensory vs functional offering** | experience-led (hotel/photo) vs utility-led (mechanic) [DIF §14 dim 3] | Medium-High | Visual weight, hero strategy, motion intensity | That functional = ugly; functional can be crafted |
| **consideration level** | impulse ↔ considered ↔ high-stakes [DIF §14 dim 2] | Medium | Narrative length, progressive disclosure, risk reversal | Layout density |
| **urgency / booking need** | Whether a sticky CTA and fast ask are warranted [DIF CV-01, R-07] | Medium | CTA placement, sticky bar, conversion mode | Tone |
| **visual assets (count + quality + orientation)** | How much the argument rests on photography; atmosphere range [Repo `character.ts` usableImages/orientationsOf] | High (measured, not inferred) | VisualWeight, gallery-lead, hero strategy, reduce-imagery fallback | Aesthetic taste — assets inform structure, not style alone |
| **photography quality** | Whether original photography can carry the brand or must degrade honestly [DIF I-01; APL P-012] | High (real files) | treatment, crop, sequence | That poor quality = no site; degrade honestly [DIF §18 contradiction 5] |
| **brand maturity** | nascent vs established; how much identity to assert [Synthesis from DIF §13] | Low-Medium | Name/wordmark treatment, confidence of type | Restraint level everywhere |
| **differentiation** | What makes this business unlike its neighbors [DIF doctrine §6, N-03] | Low-Medium (often must be inferred from reviews) | Signature concept, narrative angle | A gimmick — differentiation is earned from evidence |
| **competitive environment** | Whether a visual convention is owned by competitors (avoid cliché) [Synthesis] | Low (rarely explicit) | Where to *break* the convention | The whole direction |
| **personality / voice** | casual ↔ formal; playful ↔ serious [DIF §14 dim 5–6] | Medium | Mood, motion energy, copy playfulness | Hue |
| **formality** | casual/local ↔ professional ↔ aspirational [DIF §14 dim 4] | Medium | Type character, spacing discipline | Template gravity |
| **innovation** | traditional ↔ innovative [DIF §14 dim 5] | Low-Medium | Asymmetry degree, generative-canvas eligibility (P-015), motion | That innovation = WebGL everywhere [APL §4 rule 5] |
| **luxury** | affordable ↔ premium ↔ luxury [DIF §14 dim 1] | Low-Medium | Restraint, monochrome eligibility (P-014), accent sparseness | Gold/black cliché |
| **accessibility requirements** | Audience skews 35+ [DIF C-03 rationale]; RTL/locale [DIF T-06] | High (legal/ethical floor) | Contrast, target size, reduced motion, lang/dir | Nothing — overrides taste |
| **differentiation opportunity / signature moment** | The one thing worth building the page around [Repo `signatureCandidate`] | High (evidence-ranked) | Signature beat, visual peak, hero | Equal treatment of all sections |

## 2.2 The cardinal rule of this model

> **INDUSTRY IS A PRIOR, NOT A TEMPLATE.**

It is established as a *weak deterministic prior* that AI may override with character signals. [Sourced — DIF §17.3 ("Industry matrix is a weak deterministic prior that AI may override"); APL §4 rule 6 ("do not apply industry color clichés … Character > industry").]

Operational consequence: the engine stores the category as `IndustryClassification { id, basis, matchedOn, rationale }` [Repo `types.ts`] and uses `basis` (`listing | inferred | fallback`) to know how much weight to give it. A `fallback` classification (no evidence) must never trigger a strong visual commitment — it yields a `creative-default` (an intentional, safe shape) rather than a category cliché. [Sourced — REPO experience-system.md "Factual unknown vs creative freedom": `basis: evidence | creative-default`; the system never invents a *fact* to justify a richer experience.]

---

# 3. CHARACTER VECTOR

## 3.1 Reuse the repo's axes (do not reinvent)

The repo's `BusinessCharacter` already defines a measured, evidence-backed vector. [Repo `character.ts`] This spec adopts it and layers the research's *intent* axes on top. The merged vector:

| Axis (this spec) | Source / evidence signals | Scoring logic | Confidence | Design consequences |
|---|---|---|---|---|
| **visualWeight**: text-led / balanced / image-led | usable image count + `imageReliance` (essential/supporting/incidental) [Repo `character.ts`] | `≥5 & essential → image-led`; `≥2 → balanced`; else `text-led` | High (measured) | Drives gallery-lead, hero strategy, whether to *reduce* imagery [Repo quality.ts `businessSpecificity`] |
| **atmosphereRange** (1–6) | `floor(imageCount/2) + orientationBonus` [Repo] | integer count of "visual movements" sustainable | High | Pacing length, number of beats, image sequence depth |
| **multiAtmosphere** (bool) | `imageCount≥4 & ≥2 orientations` [Repo] | bool | High | Whether asymmetric/breakout sequences are justified |
| **expressiveness**: restrained / measured / expressive | `ground` (clean/warm/atmospheric) [Repo ctx] | mapping from industry ground prior | Medium | Type energy, motion level, color temperature |
| **emotionalRegister**: functional / warm / romantic / craft | word-hit counts over description+services+attributes+owner pages [Repo `character.ts`] | margin-gated majority (craft≥2 & ≥others → craft; etc.) | Medium (word-based, margin-gated — see Open Q7) | Mood, imagery treatment, copy voice, hero warmth |
| **offeringBreadth**: single / focused / broad | service count [Repo] | `<2 single; 2–3 focused; ≥4 broad` | High | Nav density, category-color eligibility (P-007), progressive disclosure |
| **narrativePotential**: none / latent / strong | combination of the above + signatureCandidate [Repo] | image-led & multi & non-functional & signature → strong; else latent/none | Medium-High | Experience mode (brochure vs narrative), editorial depth |
| **signatureCandidate**: SectionKind \| null | evidence-ranked preference (gallery if image-led+rating; testimonials if rating≥4.5; menu if non-functional; about if description≥180) [Repo] | ranked, not category-default | High | The visual peak / signature beat |
| **priceTier** (synthesis of DIF §14 dim 1) | price words, category priors, review context | budget/premium/luxury soft score | Low-Medium | Whitespace generosity, restraint, accent sparseness |
| **considerationLevel** (synthesis of DIF §14 dim 2) | service complexity, category, audience | impulse/considered/high-stakes | Medium | Narrative length, risk reversal, progressive disclosure |
| **audienceFormality** (synthesis of DIF §14 dim 4) | audience signals, copy register | casual/professional/aspirational | Medium | Type character, spacing discipline, nav density |
| **sensoryFunctional** (synthesis of DIF §14 dim 3) | imageReliance + offering nature | sensory/utility | Medium-High | Hero strategy, motion intensity, imagery density |

### Why these axes and not the prompt's literal list

The prompt suggested axes like "functional ↔ emotional", "utilitarian ↔ sensory", "quiet ↔ expressive", "minimal ↔ expressive". The research and the repo already resolve most of these into orthogonal, *measurable* axes:

- "functional ↔ emotional" → captured by `emotionalRegister` (functional/craft/warm/romantic) [Repo].
- "utilitarian ↔ sensory" → captured by `sensoryFunctional` + `visualWeight` [DIF dim 3].
- "quiet ↔ expressive" / "minimal ↔ expressive" → captured by `expressiveness` + `atmosphereRange` [Repo].
- "approachable ↔ authoritative", "traditional ↔ innovative", "established ↔ emerging", "affordable ↔ premium", "local ↔ aspirational", "clinical ↔ human" → these are *creative-character outcomes* (§4), not raw axes; they are derived by combining the measured axes above with copy register. Inventing them as separate measurable axes would double-count what `emotionalRegister` + `priceTier` + `audienceFormality` already measure.

[Synthesis — reconciles the prompt's suggested axes with the research's actual measurable dimensions; avoids a redundant, un-scored vector.]

## 3.2 Scoring + confidence discipline

- **Measured axes** (visualWeight, atmosphereRange, multiAtmosphere, offeringBreadth, signatureCandidate) = **High** confidence; deterministic functions of evidence. [Repo `character.ts` is pure, no model.]
- **Word-inferred axes** (emotionalRegister) = **Medium**; the repo explicitly margin-gates (a single hit does not decide) and counts hits [Repo `countHits`].
- **Soft axes** (priceTier, considerationLevel, audienceFormality) = **Low-Medium**; flagged in Open Questions (Q7) as needing validation.
- **Every axis records `evidence[]` and `rationale`** so a downstream reviewer can see *why* a score was given. [Repo `BusinessCharacter.evidence/rationale`; DIF §17 governance.]

---

# 4. CREATIVE CHARACTER

## 4.1 What "creative character" is

Creative character is the **named personality** the business should project — the synthesis of the character vector into a recognizable *voice*. It is the bridge between "what the business is" (vector) and "what the design says" (direction).

Crucially: **no industry-specific presets.** A mechanic is not "mechanic-style"; it is whichever character its evidence earns. [Sourced — DIF §1.6; APL P-001 "unsuitable: mechanic… need to show the real thing"; repo `character.ts` comment: "the design system must not know what a 'mechanic' is".]

The research gives explicit license for same-industry divergence:

- A mechanic can become **technical-precise**, **craft-authentic**, or **premium-performance** depending on evidence [per the task brief, grounded in DIF §13 mechanic row: "Avoid luxury pretension; clarity > beauty" vs a premium garage with precision/diagnostics language → craft/technical].
- A dentist can become **clinical-premium**, **warm-family**, or **editorial-specialist** [DIF §13 dentist row: "Avoid clinical coldness; warmth builds trust" — i.e., warmth is an option, not a mandate].
- A nail salon can become **quiet-luxury**, **playful-sensory**, or **minimal-editorial** [DIF §13 nail salon row: "Med–High premium-ness; playful" vs a refined studio → quiet-luxury].

## 4.2 A reusable creative-character vocabulary (synthesis)

These are *personality labels*, not templates. Each is a possible output of the vector→character mapping; the mapping is evidence-conditioned, never category-conditioned.

| Creative character | Triggering vector signature | Visual lean | Motion |
|---|---|---|---|
| **clinical-premium** | high trust-req, sensory, premium, non-warm | restrained neutral + 1 cool accent, precise grid, confident serif/sans | subtle, clarify-only |
| **warm-family** | warm register, local, low–med consideration | warm paper base, humanist sans, rounded radius | gentle micro |
| **editorial-specialist** | romantic/strong narrative, considered, broad | editorial serif + grotesk, asymmetric, long-form | slow reveals |
| **craft-authentic** | craft register, functional-but-proud, image-led workshop | paper/ink, single accent, material-detail imagery | minimal, tactile |
| **technical-precise** | craft + precision language, functional, premium | geometric/mono, tight grid, controlled contrast | controlled micro-motion |
| **quiet-luxury** | premium/luxury, low expressiveness, refined | near-monochrome, one hot accent, max whitespace | restrained transitions |
| **bold-contemporary** | energetic, expressive, aspirational | dark or vivid base, bold condensed, high-energy accent | expressive, lively |
| **playful-sensory** | warm/romantic + energetic + social | saturated accent on neutral, fashion/editorial display | playful micro |
| **heritage-authoritative** | established, professional, high-stakes | traditional serif or confident sans, deep neutral, restrained | subtle |
| **minimal-editorial** | image-led, low expressiveness, peer-judged | type recedes, image dominates, monochrome | minimal |

[Synthesis — built directly on DIF §13 matrix, §14 clusters, and APL P-004/P-005/P-006/P-014. The labels are *character outcomes*; the triggers are vector signatures, satisfying "no industry presets."]

## 4.3 Mechanism (hybrid)

Creative character is **Hybrid** [Sourced — DIF §17.3 lists "character-vector extraction" as AI fill of a deterministic schema; REPO `character.ts` measures deterministically, but the label *selection* from the vector benefits from AI judgment]. Concretely:

- The **vector** is deterministic (measured from evidence).
- The **character label** is AI-selected from the closed vocabulary above, conditioned on the vector, then validated: it must be consistent with `emotionalRegister`, `priceTier`, `visualWeight`, and `offeringBreadth`. A `craft` register cannot yield `warm-family`; a `text-led` business cannot yield `minimal-editorial` (no imagery to lead with) — these contradictions are caught by `quality.ts businessSpecificity` [Repo].

---

# 5. CREATIVE BRIEF GENERATION

## 5.1 Purpose

The creative brief is the **internal artifact produced before any design decision**. It makes the AI Director's intent reviewable and gives the deterministic validators a target. [Synthesis — fills the gap between repo `character.ts` and `composeDesign`; the repo's AI Director builds "a concise, fact-grounded design brief" internally (designDirectorAgent.ts) but this spec promotes it to a first-class, persisted artifact.]

## 5.2 Brief schema

| Field | Content | Source of truth |
|---|---|---|
| **business essence** | One sentence: what the business unequivocally is | profile (evidence) |
| **audience** | Who, in what formality/consideration | signal model §2.1 |
| **positioning** | The claimed stance vs competitors (evidence-backed only) | reviews/differentiation |
| **emotional objective** | What the visitor should *feel* | emotionalRegister + creative character |
| **trust objective** | What must be established before the ask | trust requirements + CV-02 |
| **desired perception** | The 2–3 adjectives the site must project | creative character |
| **creative character** | The label from §4.2 | vector → character (hybrid) |
| **visual weight** | text-led / balanced / image-led | measured |
| **narrative ambition** | none / latent / strong → brochure/showcase/narrative | narrativePotential |
| **imagery potential** | original-count, orientation variety, treatment | assets (measured) |
| **conversion priority** | direct / balanced / editorial / high-intent | consideration + urgency |
| **differentiation opportunity** | The signature moment / angle | signatureCandidate + differentiation |
| **constraints** | accessibility floor, performance budget, asset gaps | A-* rules, M-04, asset gaps |
| **anti-patterns to avoid** | The specific clichés this business must NOT fall into (e.g., "navy-law", "spa-stock", "system-font-for-brand") | §15 / DIF §16 AP-* |

Every field carries `evidence` and `rationale` (repo convention). Fields lacking evidence are marked `creative-default`, not fabricated. [Repo experience-system.md]

## 5.3 Concrete example (synthesis)

**Business:** "Precision Auto" — independent garage, 14 years, Google description says "diagnostics, tuning, certified technicians, performance restoration," 6 original workshop photos (3 landscape, 2 portrait, 1 detail), rating 4.8, services: diagnostics, tuning, brake repair, restoration.

- **essence:** A certified performance-restoration garage for drivers who care how their car drives.
- **audience:** Local car enthusiasts + everyday drivers; practical, value-conscious but quality-seeking.
- **positioning:** Specialist diagnostics most chains can't do; restoration craft.
- **emotional objective:** Confidence in skill; quiet pride in precision.
- **trust objective:** Certifications + 4.8 + original workshop proof before booking.
- **desired perception:** technical, precise, trustworthy, a little proud.
- **creative character:** `technical-precise` (craft register + premium + functional → not warm-family).
- **visual weight:** image-led (6 usable, multi-orientation).
- **narrative ambition:** strong (image-led + multi + non-functional + signature gallery).
- **imagery potential:** strong — original workshop/material-detail photos; treatment = natural/mono-leaning.
- **conversion priority:** high-intent (booking a service) but trust-gated.
- **differentiation:** restoration craft = signature moment.
- **constraints:** AA contrast, 44px targets, LCP <2.5s, real photos only (no stock).
- **anti-patterns:** no "industrial red" cliché; no system-font-for-brand; no stock handshake.

---

# 6. CREATIVE CONCEPT

## 6.1 Definition

The creative concept is **the one visual idea the entire site is built around**. It answers: *"What is the visual idea of this website?"* It is not a tagline; it is an organizing principle that the color, type, layout, narrative, and motion all serve. [Synthesis grounded in DIF N-01 (lead with outcome, specifics signal confidence), N-04 (editorial depth for heritage/craft), APL P-003 (extreme type-scale as a *principle* not a look), P-011 (one poster-scale moment).]

## 6.2 Concept catalog (illustrative, character-conditioned — not exhaustive)

| Concept | What it does visually | Trigger |
|---|---|---|
| **precision as visual rhythm** | Tight modular grid, mono/geometric type, controlled contrast, measured motion | technical-precise, craft-authentic |
| **human care through intimate photography** | Close-up portraits, warm treatment, generous air, gentle motion | warm-family, clinical-premium (warm variant) |
| **craftsmanship through material detail** | Macro crops, paper/ink, single accent, slow reveals | craft-authentic, heritage-authoritative |
| **architectural clarity** | Asymmetric editorial grid, whitespace, confident type | heritage-authoritative, minimal-editorial |
| **quiet luxury** | Near-monochrome, one hot accent, max whitespace, restrained transitions | quiet-luxury |
| **energetic transformation** | Bold condensed, high-energy accent, action imagery, lively motion | bold-contemporary, playful-sensory (fitness) |
| **editorial expertise** | Serif+grotesk, long-form, asymmetric, slow reveals | editorial-specialist |
| **playful sensory appetite** | Saturated accent, fashion display, lush imagery | playful-sensory (salon/restaurant) |
| **appetite as atmosphere** | Cinematic food/space, warm ground, editorial display | restaurant (cuisine-conditioned) |
| **place as identity** | Cinematic property/scene, refined neutral, cultural type | hotel, real-estate (visitor) |

[Synthesis — each concept is a *visual thesis*; the repo realizes concepts through `experience.mode` + `signatureMoment` + `world` ground journey (experience-system.md Phase 5).]

## 6.3 Rule

The concept must **influence the entire site** — hero, type scale, color restraint, image treatment, section rhythm, motion. If a concept only changes the hero headline, it is a slogan, not a concept, and fails the brief. [Synthesis + DIF N-03 (specificity) and APL P-011 (one unforgettable focal point carried through).]

---

# 7. VISUAL DIRECTION ENGINE

## 7.1 Inputs and outputs

**Input:** creative character (§4) + creative concept (§6) + brief constraints (§5).
**Output:** a coordinated set of direction decisions — color, typography, layout, spacing personality, grid behavior, image treatment, hero treatment, section rhythm, contrast strategy, visual peak, CTA treatment, navigation treatment, footer treatment.

## 7.2 Direction decisions and their deterministic floor

| Decision | AI selects (within bounds) | Deterministic floor [source] |
|---|---|---|
| color direction | accent hue, base temperature, ramp seed | ≤3 active hues [DIF C-01], accent=action [C-02], AA contrast [C-03], character>cliché [C-04] |
| typography direction | families, pairing, weight, ratio | ≤2 families [T-03], body≥16px [T-02], scale ratio bound [T-01], weight≠color-only [T-05] |
| layout direction | variant per section, frame, asymmetry degree | 12-col base [G-01], 8px spacing [G-02], max-width 1280 [G-05] |
| spacing personality | airy/balanced/dense | section min 64px desktop/40px mobile [G-03] |
| grid behavior | breakout placement | base 12-col; breakouts only as defined variants [G-04, APL P-008] |
| image treatment | treatment, crop, sequence | consistent treatment [I-04], no stock cliché [I-01], LCP budget [I-03] |
| hero treatment | which of §11 strategies | perf budget [I-03], contrast scrim, reduced-motion fallback |
| section rhythm | emphasis, backgrounds, full-bleed | one focal point per viewport [UX-03], consistent rhythm [G-03] |
| contrast strategy | soft/medium/high | AA mandatory [C-03, A-01] |
| visual peak | which beat is the signature | exactly one `momentTransition` [Repo types.ts] |
| CTA treatment | verb, placement, stickiness | one dominant CTA repeated [CV-01], trust-before-ask [CV-02] |
| navigation treatment | minimal vs full vs segmented | ≤7 top items [UX-06], persistent contact ≤1 tap mobile [APL P-009], no hamburger-only desktop [AP-10] |
| footer treatment | minimal/corporate/rich | token-consistent [P-04] |

## 7.3 Coherence rule

All thirteen decisions are emitted as **one `WebsiteDesign`** (closed tokens) so they cannot drift. [Repo `types.ts`: "the same content rendered under two designs differs in every visual respect and in none of its claims" — coherence is structural, not hoped-for.] The `VisualPersonality` block records `direction`, `mood`, `density`, `contrast`, `rationale`, `evidence` so the *why* travels with the *what*. [Repo `types.ts` `VisualPersonality`.]

---

# 8. TYPOGRAPHY ENGINE

## 8.1 The chain

`character → typography personality → font category → pairing → weight → scale → spacing → hierarchy` [Sourced — DIF §4 T-01…T-05].

## 8.2 Typography personality from character

| Creative character | Typography personality | Font category |
|---|---|---|
| heritage-authoritative / editorial-specialist | confident serif or editorial serif + grotesk | serif display + humanist/geometric body [DIF T-04; APL P-005] |
| clinical-premium / technical-precise | geometric or mono-accented, precise | geometric sans + mono [APL P-005, P-013] |
| quiet-luxury / minimal-editorial | type recedes, refined | light-weight serif or grotesk, large measure |
| warm-family / playful-sensory | humanist, friendly | humanist sans + optional fashion display [DIF §13] |
| bold-contemporary | bold condensed/geometric | condensed display + geometric body |
| craft-authentic | character-matched, often serif or sturdy grotesk | serif/geometric per evidence |

## 8.3 Deterministic safeguards (must be encoded as gates)

- **Never >2 families** [T-03]. Multi-family allowed only as role-mapped system (display + text + optional mono) [APL P-005, P-013].
- **Body ≥16px, line-height 1.4–1.6, measure 45–75ch** [T-02, G-05].
- **Modular scale**, fluid `clamp()`, ratio bounded (1.125 subtle → 1.5+ dramatic) [T-01; APL P-003]. Note: Awwwards data shows display:body ratios of 4×–9× are normal *for the display step only* — body stays ≥16px [APL §2 pattern 2, §3 P-003].
- **Hierarchy via size/weight/style, not color alone** [T-05, A-05] — protects color-blind users.
- **No system-font-for-brand** except as a *deliberate concept* (Vectr=Roboto, 21 Hrs=Arial work *because* conceptual) [APL §2 pattern 6, §4 rule 4, DIF AP-4].
- **Specific pairing is AI** (taste), validated by T-03/T-05. Choose *equivalently character-matched* faces, never the same Awwwards faces verbatim (Signifier/Thunder/Neue Montreal) [APL §4 rule 7].

## 8.4 Anti-generic-SaaS safeguard

The engine must detect and penalize "generic SaaS typography" — i.e., the Inter/System-UI default with no character match, used because it is easy. The `businessSpecificity` gate already fails a page whose decisions contradict character [Repo `quality.ts`]; pairing must additionally be linted against "is this face chosen for *this* business's personality or because it is the default?" [Synthesis + DIF T-04 "system fonts signal generic"].

---

# 9. COLOR ENGINE

## 9.1 The chain

`character + audience + positioning + imagery → palette` [Sourced — DIF C-04 "derive palette from brand/character, not industry cliché"; C-01 "2–3 colors with a job each"; APL P-004].

## 9.2 Palette structure (deterministic skeleton)

- **base** (canvas/surface — light, warm-paper, or near-black) [APL §2 pattern 4: dark OR warm-paper OR off-white, rarely pure white].
- **surface / text** ramp (neutral).
- **brand / accent** (≤1 hot accent, used sparingly) [APL §2 pattern 5: "one hot accent is the signature"].
- **semantic** (success/warn/error — fixed, never reused for branding) [DIF C-06].
- **contrast** measured and asserted (text 4.5:1, large 3:1, UI 3:1) [C-03, A-01].
- **photographic compatibility** — the base must not fight the imagery; treatment (warm/cool/mono/muted/natural) is chosen to harmonize [I-02, I-04].

## 9.3 Character overrides cliché (explicit)

| Cliché to reject | Character-driven alternative |
|---|---|
| law = navy | heritage-authoritative law → deep charcoal + warm accent; or editorial-specialist → black/yellow (cf. 3e Étage) [APL §4 rule 6, P-001 unsuitable note] |
| dentist = blue | clinical-premium → soft teal OR warm neutral; warm-family → warm paper + humanist [DIF §13 dentist] |
| restaurant = red | appetite-as-atmosphere → terracotta/charcoal per *cuisine*, not generic red [DIF §13 restaurant; APL §4 rule 6] |
| hotel = gold/black | place-as-identity → refined neutral + 1 luxe accent derived from the property's own palette [DIF §13 hotel] |

The accent hue is **AI-selected from the character vector**, then validated against C-01 (≤3 hues) and C-03 (contrast). [Sourced — DIF §17.2; APL §5 P-004.]

## 9.4 Light/dark tokens

Provide both light and dark schemes with contrast in each [C-05]. The repo already emits `SemanticColors` with both light grounds and an `inverted` family built to clear contrast on dark bands [Repo `types.ts` `onInvertedMuted/onInvertedAccent` — explicitly added because three service cards on a dark band measured 1.13:1]. This is a concrete example of character/evidence-driven token engineering already in the repo.

---

# 10. IMAGE / ART-DIRECTION ENGINE

## 10.1 Choices the engine makes

hero image · supporting images · gallery · crop · focal point · aspect ratio · image density · full-bleed usage · close-up vs contextual · image sequencing · **when NOT to use an image** [Sourced — DIF §7 I-01…I-04; APL P-012; REPO `assets.ts` (AssetChoreography)].

## 10.2 Rules

- **Original photography > stock.** Stock is the single biggest credibility killer [I-01, AP-1]. If stock is unavoidable, use un-corporate, contextual, real-feeling imagery and *label honestly* — never handshake/laptop-coffee/diverse-conference clichés [I-01, APL §4 rule 3 (no stock video either)].
- **Imagery carries the sensory register** [I-02]; treatment harmonized across all imagery [I-04].
- **Hero must not bury the message or hurt LCP** [I-03]: optimized next-gen format, sized, lazy-off for LCP, scrim for overlay text, message clear <3s.
- **Consistent treatment system** — one filter/tonal approach, consistent aspect ratios per slot [I-04, APL P-012 deterministic].
- **Image density scales with `visualWeight`/`atmosphereRange`** [Repo `character.ts`]. Image-saturation correlates with portfolio/showcase type (Hamza 296 imgs, Serotoninn 295) but service/agency sites use *fewer, larger, art-directed* images [APL §2 pattern 11].

## 10.3 Honest degradation (never fabricate)

When image quality is poor or absent:

- **No usable imagery → `text-led`, reduce imagery, `fallback` ∈ {pattern, gradient, solid, omit}** [Repo `ImageStrategy.fallback`; quality.ts rewards `reduceImagery` as "deliberate restraint"].
- **Poor but real → keep real, apply consistent treatment, crop to strength, do not upscale into a hero** [Synthesis from DIF §18 contradiction 5: "brief for original capture and gracefully degrade, not fake stock"].
- **Reference-only assets** (rights unconfirmed) are marked and never published [Repo `assets.ts` `reference-only`].
- **Never fabricate photography.** A missing hero is a *real answer*; a thin business gets an honest brochure [Repo experience-system.md "Factual unknown vs creative freedom"].

---

# 11. HERO ENGINE

## 11.1 Generalized hero strategies

[Awwwards evidence: 11/25 typographic heroes, 9 video, 4 canvas/WebGL, 1+ photo — no single dominant type (APL §2 pattern 1). Therefore the hero must NOT always look the same.]

| Strategy | Visual | Triggering signals | Deterministic floor |
|---|---|---|---|
| **photographic** | Real business photo, message overlay | image-led, sensory, has hero asset | scrim + LCP + AA [I-03] |
| **typographic** | Giant statement on neutral base; type *is* the hero | strong verbal identity, name/positioning is the product | body≥16, 1 focal line, contrast [APL P-001] |
| **editorial** | Headline + supporting context, asymmetric | editorial-specialist, considered | grid + rhythm [G-04] |
| **statement-led** | One oversized line / poster moment | brand with a hero artifact/name | clamp() no overflow, contrast [APL P-011] |
| **product/service-led** | The offering itself framed | functional, image-led offering | scrim, LCP |
| **cinematic** | Full-bleed muted video/canvas | sensory, has original footage, aspirational | LCP, reduced-motion fallback, no autoplay sound [APL P-002, P-015] |
| **split composition** | Text + image side-by-side | balanced weight, needs both message and proof | 44px targets, rhythm |
| **immersive** | Continuous media/scene | recorded as `ceiling`, capped at `guided` today [Repo experience-system.md] | reduced-motion, perf budget |

## 11.2 Trigger discipline

- Local-trust businesses (mechanic, dentist, restaurant) need **persistent contact**, so a minimal hero nav (logo+1 CTA) is *unsuitable* for them [APL P-009 unsuitable].
- Utilitarian/local-trust businesses: clarity > spectacle → **photographic or split**, not cinematic [APL P-002 unsuitable].
- Experiential/aspirational with original footage: **cinematic** allowed, gated by perf + reduced-motion [APL P-002].

---

# 12. NARRATIVE ENGINE

## 12.1 The chain

`creative concept → section sequence → narrative beats → visual peaks → proof → trust → conversion` [Sourced — DIF N-02 persuasion arc (Hook → Relevance → Proof → Offer → Social proof → Risk reversal → CTA → Contact); REPO `script.ts` `ROLE_RANK` narrative spine.]

## 12.2 How narrative pacing changes

The repo already varies order by character via `planNarrativeOrder` [experience-system.md]:

- **High-intent** business → contact beat moves up to just after the offering (`breadth`); closing CTA still closes. A plumber *should* put the phone up front.
- **Rich/experiential** → `emotion → reveal → signature → breadth → conversion`.
- **Thin** → `arrival → breadth → conversion → context`.
- **Same industry diverges**: rich hotel vs thin motorway hotel get different narratives from the *same* category [Repo experience-system.md example].

Pacing is also modulated by:

- **consideration level** (impulse = short arc; high-stakes = long, proof-heavy) [DIF §14 dim 2].
- **emotional intensity** (romantic/craft = slower reveals; functional = direct) [Repo emotionalRegister].
- **business character** (editorial-specialist = long-form; technical-precise = structured) [§4.2].
- **imagery strength** (`atmosphereRange` sets beat count) [Repo character.ts].
- **complexity of offering** (`offeringBreadth` → progressive disclosure for broad) [DIF P-12].

## 12.3 Roles, not kinds

The same section *kind* gets a *different narrative role* by evidence: a gallery is `signature` for a business built around it, `reveal` for one that merely leads with imagery, `space` for one that only documents premises [Repo `roleFor`]. This is the mechanism that keeps "two businesses in one industry" from sharing a narrative.

## 12.4 Coherence gate

`narrativeCoherence` fails a page when: conversion before enough discovery (unless high-intent); strong signature evidence but no signature placed; gallery-led buries gallery in final third; high-intent walks too far before ask; narrative claimed on thin evidence [Repo `quality.ts`]. These are exactly the art-director catches the spec must encode.

---

# 13. VISUAL RHYTHM ENGINE

## 13.1 The problem it solves

The repo's own `types.ts` documents the loudest template signal: *"eleven variants all rendered as heading-above-content-full-width, so a page of six sections was six identical silhouettes… no amount of variety inside the blocks fixes it."* The missing axis was **`SectionFrame`** (stacked/aside/centered/offset/statement) — the envelope around each section. [Repo `types.ts` — quoted.]

## 13.2 What the engine controls

section height · whitespace · density · type scale · image scale · contrast · full-bleed sections · asymmetric sections · visual peaks · quiet sections [Sourced — DIF G-03, UX-03, APL P-003/P-008/P-011].

## 13.3 Operational rules

- **Vary the frame per beat**, not just the variant. A page should not be six `stacked` sections.
- **Exactly one `momentTransition`** (the visual peak) per page [Repo `types.ts`].
- **Emphasis gradient**: lead → primary → secondary → quiet, so the eye has a spine [Repo `Emphasis`].
- **Full-bleed and asymmetric breakouts** only on premium/editorial characters, never on trust-critical utilitarian flows [DIF G-04; APL P-008].
- **Quiet sections** between peaks (rest) — whitespace is high across award sites [APL §2 pattern 10].
- **One focal point per viewport** [UX-03].

---

# 14. CONVERSION ENGINE

## 14.1 Integration without funnel-ification

Conversion is woven into the narrative arc, not bolted on as a generic sales funnel. [Sourced — DIF CV-01…CV-04; APL P-009/P-010.]

| Element | Rule | Source |
|---|---|---|
| primary CTA | one dominant, color=accent, repeated with context (hero, after proof, sticky mobile bar) | CV-01 |
| CTA hierarchy | label = verb+benefit ("Book your slot"), never "Click here" | CV-01 |
| trust before ask | proof block (reviews, credentials, photos, awards) precedes final CTA | CV-02, N-02 |
| contact friction | minimum fields, inline validation, autofill, multi-step only if long | CV-03, AP-9 |
| urgency / risk reversal | guarantee/free-consult/"what happens next" for commitment-anxious (law, construction, architecture) | CV-04 |
| conversion placement | character-driven (`ctaPlacement`); high-intent moves ask up | REPO conversion.mode; experience-system.md |
| CTA language | audience-named, specific [N-03] | DIF N-03 |
| conversion rhythm | trust beat → risk reversal → ask → contact, repeated per arc | N-02 |

The repo already encodes `ConversionStrategy { mode, ctaVerb, placement, contactProminence, density, trustPlacement, friction }` and `businessSpecificity` rejects a `functional` business set to `editorial` conversion mode [Repo `types.ts`, `quality.ts`].

---

# 15. MOTION / INTERACTION ENGINE

## 15.1 Derive motion from character + concept

[Motion examples grounded in DIF M-01…M-05 and APL §2 pattern 8 "motion is functional or cinematic, never gratuitous."]

| Character | Motion character |
|---|---|
| precision / technical | controlled micro-motion (clarify-only) |
| luxury / quiet | restrained transitions |
| playful / energetic | expressive, lively micro |
| editorial / heritage | slow reveals |
| functional / warm-family | gentle micro |

## 15.2 Three classes, explicitly separated

- **Functional motion** — state changes, direction, attention, feedback. Duration 150–300ms, standard easing [M-01, M-05]. Always allowed within budget.
- **Decorative motion** — purely aesthetic loops. **Forbidden** unless it clarifies or is a character-conditioned brand expression inside the gate [M-01, AP-6].
- **Cinematic motion** — scroll-linked storytelling, generative canvas. Allowed only when: original asset available, perf budget holds, reduced-motion fallback exists [M-03, APL P-002/P-015].

## 15.3 Hard gates

- **`prefers-reduced-motion` disables non-essential motion** [M-02, A-07] — always true token [Repo `MotionSystem.respectReducedMotion: true`].
- **Core Web Vitals budget** (LCP<2.5s, INP<200ms, CLS<0.1) enforced against motion/imagery [M-04].
- **No autoplay sound** [AP-12]; no >3 flashes/sec [A-07].
- The repo caps `interaction.level` at what the static renderer delivers today (`guided`), recording the wanted `ceiling` (e.g., `immersive`) for later — honest staging, no faked runtime [Repo experience-system.md].

---

# 16. RESPONSIVE ENGINE

## 16.1 The concept survives mobile — it is not just stacked

[Sourced — DIF G-06/R-01…R-08 (mobile-first, fluid, no horizontal scroll, 44px targets, responsive images, sticky CTA); APL P-009 (persistent contact ≤1 tap mobile).]

What may change between desktop and mobile (decision, not accident):

| Axis | May change on mobile | Rule |
|---|---|---|
| composition | hero reflows (typographic scales down via clamp; split → stacked) | type-led scales, never overflows [APL P-011 clamp] |
| crop | hero crop can tighten to portrait/square for small viewport | `heroCrop` per breakpoint [Repo `ImageStrategy`] |
| typography | fluid scale via clamp; display step shrinks but stays dominant | T-01 fluid, body≥16 [T-02] |
| spacing | fluid spacing; section min 40px mobile | G-03, R-02 |
| section order | high-intent ask may move up; otherwise narrative spine preserved | experience-system.md |
| navigation | text nav → hamburger on mobile, BUT persistent contact ≤1 tap (sticky bar/footer) [APL P-009] | no hamburger-only desktop [AP-10] |
| image strategy | `srcset`/sizes, fewer full-bleeds if perf demands | R-06, M-04 |
| visual emphasis | moment peak preserved; secondary peaks may compress | one focal point per viewport [UX-03] |

The repo's `VisualPersonality.density` and fluid tokens already drive this; mobile is an *enhancement* of the 360px base, not a separate design [DIF G-06, R-01].

---

# 17. BESPOKE / TEMPLATE DEFENSE

## 17.1 Detect template signals (penalize)

[Sourced — DIF §15 (template-looking signals), §16 AP-*; APL §4 anti-clone rules.]

- default system/web-safe font for brand moments [AP-4]
- stock-photo clichés (handshake, laptop-coffee, diverse-team) [AP-1, I-01]
- rainbow/category-colored nav without hierarchy [AP-3]
- symmetric, centered, identical-everywhere padding with no breakout [DIF §15]
- generic copy ("We help businesses grow," "Welcome to our website") [AP-7, N-03]
- every business in an industry using the same accent (all law navy, all restaurant red) [DIF §15]
- no original imagery of the actual business [I-01]
- decorative motion with no function [AP-6]
- low-contrast "elegant" gray text [AP-2]
- **excessive identical cards** (the repo's `SectionFrame` fix targets exactly this)
- **repeated hero structure / section sequence / CTA placement / typography / palette / spacing rhythm / gallery treatment / visual peaks** across a set

## 17.2 Reward bespoke signals

typeface chosen for personality [T-04]; original photography [I-01]; restrained 2–3 palette with roles [C-01]; precise grid + deliberate breakouts [G-04]; specific audience-named copy [N-03]; fast load [M-04]; motion that clarifies + respects reduced-motion [M-01/M-02]; character-driven color/type [§9/§8].

## 17.3 BESPOKE SCORE and TEMPLATE SMELL SCORE

[Synthesis formalized from DIF §15 + REPO `quality.ts` `genericityReport`/`scoreExperience`, which already implement both numerically.]

- **BESPOKE SCORE** = `scoreExperience(design, content, character).overall` (0–100) over axes: explainability (0.20), businessSpecificity (0.25), narrative (0.15), coherence (0.15), conversionClarity (0.10), assetIntent (0.07), accessibility (0.08) [Repo `quality.ts`]. High score = the design is explainable from *this* business's evidence and tracks its character.
- **TEMPLATE SMELL SCORE** = `genericityReport(entries)` across a set. Axes: `experienceMode, hero, galleryStructure, ctaPlacement, typography, narrativeOrder, conversionMode, interaction, world`. An axis "collapses" when every business shares its value. **≥2 identity-axis collapses (`experienceMode, hero, galleryStructure, ctaPlacement, typography, narrativeOrder`) → `template-smell`** [Repo `quality.ts` verbatim threshold].

### How they are used as post-render QA

1. Render the site → run `scoreExperience` → any flag (e.g., "A design decision contradicts the business character") is a revision trigger.
2. Render a *benchmark set* of ≥6 businesses (the repo's `test/design/benchmark.test.ts` already asserts the set stays `diverse`) → run `genericityReport` → if `template-smell`, the character→design mapper is too weak and must be revised (e.g., widen the creative-character vocabulary or tighten the cliché blocklist).
3. Both scores are **deterministic checklists + AI holistic coherence** [DIF §15 decision type]; the AI half (does it *feel* coherent?) is Medium-confidence and needs calibration (Open Q9).

---

# 18. DETERMINISTIC VS AI

For every major decision, the classification and *why*. [Sourced — DIF §17.1–17.4; APL §5; REPO architecture.md "deterministic code for repeatability and safety, AI for judgement where useful."]

| Decision | Class | Why |
|---|---|---|
| WCAG contrast (4.5:1 text, 3:1 large/UI) | **A. Deterministic** | Legal/ethical floor, stable, low taste-risk [DIF §17.1, A-01] |
| Target size ≥44px | **A** | Accessibility floor [UX-05, A-09] |
| Reduced motion | **A** | Legal + vestibular [M-02, A-07] |
| Spacing scale (8px base) | **A** | Harmonic rhythm, consistency [G-02] |
| Type scale (fluid modular) | **A** | Consistency, accessibility [T-01] |
| Type min size (16px) | **A** | Legibility [T-02] |
| Typeface count cap (≤2) | **A** | Cohesion + performance [T-03] |
| Grid (12-col, 1280 max) | **A** | Alignment = quality [G-01, G-05] |
| Mobile-first, no h-scroll | **A** | Majority traffic [G-06, R-01…R-06] |
| Core Web Vitals budget | **A** | Ranking + perceived quality [M-04] |
| Conversion skeleton order (trust→ask) | **A** | Persuasion evidence [N-02, CV-02] |
| Min-field forms | **A** | Abandonment evidence [CV-03] |
| Bespoke/template lint | **A** (checklist) | Self-audit floor [DIF §15, §17.1] |
| Industry as weak prior | **A** (prior) + override by AI | Category is a hint, not a law [DIF §17.3] |
| **Specific font pairing** | **B. AI** | Taste; validated by T-03/T-05 [DIF §17.2] |
| **Accent hue / palette derivation** | **B. AI** | Taste; validated by C-03/C-01 [DIF §17.2] |
| **Hero art direction / crop / treatment** | **B. AI** | Taste; validated by I-03 + contrast [DIF §17.2] |
| **Narrative angle & copy voice** | **B. AI** | Language; validated by N-03 lint [DIF §17.2] |
| **Asymmetry / editorial degree** | **B. AI** (gated) | Character-gated [DIF §17.2, G-04] |
| **Motion choreography style** | **B. AI** (gated) | Character + M-02/M-04 [DIF §17.2] |
| **Business character label** | **C. Hybrid** | Vector deterministic; label AI-selected, validated [DIF §17.3, §4.3] |
| **Section sequence emphasis** | **C. Hybrid** | Deterministic presence + AI tuning [DIF §17.3] |
| **Spacing emphasis** | **C. Hybrid** | Deterministic min + AI emphasis [G-03] |
| **Image treatment system** | **C. Hybrid** | Deterministic token + AI apply [I-04] |
| **Micro-interaction taste** | **C. Hybrid** | Deterministic tokens + AI taste [M-05] |
| **Sticky-CTA gating** | **C. Hybrid** | Deterministic rule + AI context [R-07] |
| **Hero strategy selection** | **C. Hybrid** | Triggers deterministic; choice AI within bounds [§11] |
| **Motion intensity** | **C. Hybrid** | Character sets ceiling; AI choreographs [§15] |

**Governance (quoted from DIF §17.4):** *"Deterministic rules define the floor and the vocabulary. AI chooses the sentence. Every AI choice is passed through the deterministic validators before render."*

---

# 19. FAILURE MODES (honest degradation)

[Each grounded in DIF contradictions §18 and REPO experience-system.md "Factual unknown vs creative freedom."]

| Failure mode | Engine behavior (degrade honestly, never fabricate) |
|---|---|
| **No images exist** | `visualWeight=text-led`; `reduceImagery=true`; `ImageStrategy.fallback ∈ {pattern,gradient,solid,omit}`; honest brochure [Repo character.ts, quality.ts] |
| **Poor images exist** | Use real, apply consistent treatment, crop to strength, do not upscale into hero; never swap in stock [DIF §18 contradiction 5] |
| **Conflicting business signals** | Weighted by evidence reliability; `rationale` records the conflict; prefer measured axes (images, services) over soft axes (price) [§3.2] |
| **Business information is sparse** | `basis=creative-default`; intentional safe shape; no invented facts; thin → honest brochure [Repo experience-system.md] |
| **Generic positioning** | Use differentiation-from-reviews if available; else minimal-editorial; flag "no differentiation evidence" in brief [§5] |
| **Too many services** | `offeringBreadth=broad` → progressive disclosure, category-color eligibility (P-007, ≤6 hues), content-rich nav (P-017) [DIF P-12, APL P-007] |
| **No obvious signature moment** | `signatureCandidate=null`; `narrativePotential=none/latent`; no forced peak; `businessSpecificity` forbids inventing one [Repo quality.ts] |
| **Audience unclear** | Default to local/casual-safe; `basis=creative-default`; flag in brief [§5] |
| **Competitor sites dominate a visual convention** | If the convention = cliché (navy law), deliberately break it via character; if convention = genuine best-practice (persistent contact), keep it [§9.3, APL §4] |

The system **never invents a fact** to justify a richer experience. A missing hero is a real answer [Repo experience-system.md].

---

# 20. COMPLETE DECISION PIPELINE

```
INPUT (listings, reviews, category, services, description, photos, owner pages)
  ↓
[1] EVIDENCE VALIDATION        deterministic — schema, provenance, asset rights (reference-only)
  ↓
[2] CHARACTER EXTRACTION       deterministic — deriveCharacter → BusinessCharacter vector [Repo character.ts]
  ↓
[3] CONFIDENCE / BASIS         deterministic — per-axis confidence; evidence vs creative-default [Repo]
  ↓
[4] CREATIVE CHARACTER         HYBRID — AI label from §4.2 vocabulary, validated vs vector [§4.3]
  ↓
[5] CREATIVE BRIEF             HYBRID/AI — §5 schema; persisted, reviewable artifact [§5]  (← NEW, explicit)
  ↓
[6] CREATIVE CONCEPT           HYBRID/AI — §6 single visual idea, influences whole site [§6]
  ↓
[7] VISUAL DIRECTION           HYBRID — color/type/layout/spacing/grid/image from concept+character [§7]
  ↓
[8] EXPERIENCE ARCHITECTURE   deterministic — mode/signature/pacing/gallery-lead [Repo experience.ts]
  ↓
[9] NARRATIVE (script)         deterministic — roleFor + planNarrativeOrder → Beat[] [Repo script.ts]
  ↓
[10] ART DIRECTION             HYBRID — per-beat variant/frame/emphasis/bg/full-bleed/moment [Repo types.ts]
  ↓
[11] CONVERSION                deterministic skeleton + AI tuning — mode/CTA/placement/friction [Repo conversion.ts]
  ↓
[12] RESPONSIVE ADAPTATION     deterministic — fluid tokens; mobile enhances 360px base [§16]
  ↓
[13] DESIGN TOKENS             deterministic — closed-set WebsiteDesign (typography/color/spacing/motion/layout) [Repo types.ts]
  ↓
[14] RENDER                    deterministic, no-JS, pure function [Repo renderSite]
  ↓
[15] VISUAL QA                 deterministic — scoreExperience (BESPOKE SCORE) [Repo quality.ts]
  ↓
[16] BESPOKE / TEMPLATE EVAL   deterministic — genericityReport over benchmark set (TEMPLATE SMELL SCORE) [Repo quality.ts]
  ↓
[17] REVISION                  if flags or template-smell → revisit [4]–[13]; never lower the floor [DIF §17.4]
```

The repo already implements [1]–[4], [8]–[14], [15]–[16] deterministically; [5] (explicit brief) and the concept→direction tightening ([6]–[7]) are the primarily **new** artifacts this spec adds on top of the existing `designDirectorAgent` (which currently folds brief+concept into one `DesignDirective`). [Repo-grounded — designDirectorAgent.ts builds "a concise, fact-grounded design brief" then a `DesignDirective`; this spec proposes persisting the brief and concept as distinct, reviewable stages.]

---

# 21. FULL EXAMPLES

Each example shows the SAME INDUSTRY can diverge when evidence changes. All examples are **synthesis** built strictly from the signal model (§2), character vector (§3), and research conclusions; none invent facts beyond the stated hypothetical evidence.

---

## A. Mechanic — three divergent directions

### A1. "Precision Auto" (performance-restoration garage)
- **Raw evidence:** independent garage, 14 yrs, description "diagnostics, tuning, certified technicians, performance restoration," 6 original workshop photos (mixed orientation), rating 4.8, services: diagnostics/tuning/brake/restoration.
- **character vector:** visualWeight=image-led; atmosphereRange=4; emotionalRegister=**craft**; offeringBreadth=focused; narrativePotential=strong; signatureCandidate=gallery.
- **creative character:** `technical-precise`.
- **creative brief:** see §5.3.
- **concept:** *precision as visual rhythm*.
- **hero:** photographic — a macro of a calibrated instrument / engine detail, message overlay scrim. (Not cinematic — clarity > spectacle [APL P-002 unsuitable].)
- **typography:** geometric sans + mono accent; ratio ~1.25; tight, controlled.
- **colors:** near-black/ink base + 1 cool technical accent (e.g., electric blue-leaning, *not* industrial red cliché); AA.
- **imagery:** original workshop/material-detail; treatment=natural/mono-leaning; sequence builds diagnostics→restoration.
- **narrative:** problem → expertise → process → services → proof (4.8 + photos) → contact (high-intent, trust-gated).
- **CTA:** "Book diagnostics" / sticky mobile bar; risk reversal "no-obligation inspection."
- **motion:** controlled micro-motion only.
- **expected visual personality:** precise, confident, a little proud — unmistakably a specialist, not a generic "auto repair" template.

### A2. "Mike's Reliable Repairs" (neighborhood generalist)
- **Raw evidence:** 1-man shop, 3 photos (1 blurry), description "honest, fast, fair-price car repairs," rating 4.6, services: brakes, oil, tires.
- **character vector:** visualWeight=text-led; atmosphereRange=2; emotionalRegister=**craft** (but thin); offeringBreadth=focused; narrativePotential=none.
- **creative character:** `craft-authentic` (warm craft, not premium).
- **concept:** *trust through plain honesty* (no imagery-led concept possible).
- **hero:** typographic/statement — name + "honest repairs since 2012"; `fallback=gradient` for hero (no hero photo).
- **typography:** sturdy humanist sans; ratio 1.2; readable.
- **colors:** warm paper base + 1 practical accent (not red); AA.
- **imagery:** reduceImagery=true; use the 3 real photos in a small gallery, never upscaled to hero.
- **narrative:** arrival → breadth (services) → proof (rating) → conversion (call).
- **CTA:** "Call Mike" / phone prominent (local-trust persistent contact).
- **motion:** minimal.
- **expected visual personality:** honest, local, human — different from A1 despite same industry.

### A3. "Apex Performance Lab" (premium tuning house)
- **Raw evidence:** high-end tuning, 20 yrs, "bespoke engine builds, motorsport heritage," 12 pristine photos (studio-lit), rating 4.9, services: custom builds/track prep/dyno.
- **character vector:** visualWeight=image-led; atmosphereRange=6; emotionalRegister=craft+romantic; offeringBreadth=focused; narrativePotential=strong.
- **creative character:** `premium-performance` (synthesis of technical-precise + quiet-luxury).
- **concept:** *craftsmanship through material detail* (macro studio shots as art).
- **hero:** cinematic — slow push-in on a built engine (original footage), reduced-motion fallback frame.
- **typography:** refined serif display + grotesk; ratio 1.333+ dramatic.
- **colors:** near-monochrome dark + 1 hot luxe accent.
- **imagery:** studio-lit originals; treatment=mono; gallery-led signature.
- **narrative:** emotion → reveal → signature (build) → breadth → proof → conversion.
- **CTA:** "Commission a build."
- **motion:** restrained transitions + slow reveals.
- **expected visual personality:** aspirational, museum-grade — same industry, third distinct direction.

---

## B. Dentist — three divergent directions

### B1. "Lumina Dental Studio" (design-forward cosmetic)
- **Raw evidence:** cosmetic-focused, "smile design, aesthetic dentistry," 8 bright clinic + smile photos, rating 4.9, services: veneers/whitening/aligners.
- **character vector:** image-led; atmosphereRange=4; emotionalRegister=**warm** (aesthetic); offeringBreadth=focused; narrativePotential=strong.
- **creative character:** `editorial-specialist` (or `playful-sensory` variant).
- **concept:** *human care through intimate photography* (smile close-ups).
- **hero:** photographic — intimate smile/face, warm scrim.
- **typography:** editorial display + clean text; ratio 1.25.
- **colors:** warm neutral base + 1 soft accent (NOT clinical blue cliché); AA.
- **imagery:** original smiles; treatment=warm; gallery-led.
- **narrative:** emotion → reveal (smile gallery) → signature → proof → conversion.
- **CTA:** "Book a consult."
- **motion:** gentle micro.

### B2. "Heritage Family Dental" (multi-gen practice)
- **Raw evidence:** 30 yrs, "gentle care for the whole family," 4 photos (waiting room, team), rating 4.7, services: checkups/kids/cleaning.
- **character vector:** balanced; atmosphereRange=2; emotionalRegister=**warm**; offeringBreadth=broad; narrativePotential=latent.
- **creative character:** `warm-family`.
- **concept:** *reassurance through familiarity*.
- **hero:** split — warm team photo + "care for every age" message.
- **typography:** humanist sans, friendly; ratio 1.2.
- **colors:** warm paper + humanist accent.
- **imagery:** real team/space; treatment=warm.
- **narrative:** arrival → relevance (families) → proof → risk reversal ("gentle, judgement-free") → conversion.
- **CTA:** "Book your visit" / family-segmented paths (P-010).
- **motion:** gentle.

### B3. "Precision Oral Surgery" (specialist, high-stakes)
- **Raw evidence:** oral surgery, "implantology, sedation, surgical expertise," 5 clinical + 2 facility photos, rating 4.8, services: implants/extractions/sedation.
- **character vector:** balanced; atmosphereRange=3; emotionalRegister=**functional/craft**; offeringBreadth=focused; consideration=high-stakes.
- **creative character:** `clinical-premium`.
- **concept:** *clinical-premium through calm precision*.
- **hero:** typographic/editorial — confident statement + small facility photo; NOT cold [DIF §13 dentist "avoid clinical coldness"].
- **typography:** confident geometric sans + optional mono; ratio 1.25.
- **colors:** soft teal OR warm neutral + 1 cool accent (rejects blue cliché via character) [§9.3].
- **imagery:** facility/clinical, treatment=cool/clean.
- **narrative:** relevance → proof (credentials/4.8) → process (sedation explained) → risk reversal ("consult first") → conversion.
- **CTA:** "Request a consultation."
- **motion:** subtle, clarify-only.

---

## C. Nail salon — three divergent directions

### C1. "Lacquer & Co." (trend-forward, social)
- **Raw evidence:** "nail art, trends, extensions," 20 colorful manicure photos, rating 4.9, services: art/gel/extensions.
- **character vector:** image-led (high count); atmosphereRange=6; emotionalRegister=**romantic/warm**; offeringBreadth=focused; narrativePotential=strong.
- **creative character:** `playful-sensory`.
- **concept:** *playful sensory appetite* (color as energy).
- **hero:** photographic — saturated manicure close-up, full-bleed.
- **typography:** fashion/editorial display + clean text.
- **colors:** trend-forward accent on neutral; NOT generic spa-stock [DIF §13 nail salon caution].
- **imagery:** lush originals; treatment=saturated; gallery-led.
- **narrative:** emotion → reveal (gallery) → signature → proof → conversion.
- **CTA:** "Book your set."
- **motion:** playful micro.

### C2. "Atelier Nail" (refined, minimal)
- **Raw evidence:** "minimalist nail art, Japanese technique, calm space," 10 muted photos, rating 4.8, services: manicure/pedicure/art.
- **character vector:** image-led; atmosphereRange=5; emotionalRegister=**craft/romantic**; offeringBreadth=focused; narrativePotential=strong.
- **creative character:** `quiet-luxury`.
- **concept:** *quiet luxury through restraint*.
- **hero:** editorial — one refined image + restrained type; max whitespace.
- **typography:** light serif or grotesk, large measure.
- **colors:** near-monochrome + 1 hot accent.
- **imagery:** muted originals; treatment=mono/muted.
- **narrative:** emotion → reveal → signature → proof → conversion.
- **CTA:** "Reserve."
- **motion:** restrained transitions.

### C3. "The Nail Bar" (neighborhood, efficient)
- **Raw evidence:** "walk-in nails, gels, kids," 3 photos, rating 4.5, services: manicure/pedicure/gel/kids.
- **character vector:** text-led (thin); atmosphereRange=2; emotionalRegister=warm; offeringBreadth=broad; narrativePotential=none.
- **creative character:** `minimal-editorial` (broad, local).
- **concept:** *clarity for a quick visit*.
- **hero:** typographic — name + "walk-ins welcome."
- **typography:** humanist sans; ratio 1.2.
- **colors:** warm neutral + 1 accent.
- **imagery:** reduceImagery; 3 real photos small.
- **narrative:** arrival → breadth (services) → conversion (book/call).
- **CTA:** "Book now" / phone.
- **motion:** minimal.

---

## D. Restaurant — cuisine-conditioned divergence

### D1. "Osteria Nera" (Italian, intimate, fine)
- **Raw evidence:** "handmade pasta, intimate dining," 14 photos (food + candlelit room), rating 4.9, menu: pasta/secondi/wine.
- **character vector:** image-led; atmosphereRange=6; emotionalRegister=romantic; offeringBreadth=focused; narrativePotential=strong.
- **creative character:** `editorial-specialist` (or quiet-luxury dining).
- **concept:** *appetite as atmosphere* (cuisine-culture-conditioned, NOT generic red).
- **hero:** cinematic — slow pan of plated pasta + room; reduced-motion fallback.
- **typography:** editorial serif + clean text.
- **colors:** warm charcoal/terracotta per *Italian* culture [DIF §13 restaurant "match cuisine culture"]; NOT generic red.
- **imagery:** original food/space; treatment=warm.
- **narrative:** emotion → reveal (menu) → signature (dish) → proof → conversion (reserve).
- **CTA:** "Reserve a table."
- **motion:** slow reveals.

### D2. "Green Bowl" (healthy fast-casual)
- **Raw evidence:** "fresh bowls, quick lunch," 6 bright photos, rating 4.7, services: bowls/smoothies/coffee.
- **character vector:** image-led; atmosphereRange=3; emotionalRegister=warm; offeringBreadth=broad; consideration=impulse.
- **creative character:** `friendly` / `playful-sensory` (fresh variant).
- **concept:** *fresh energy, fast*.
- **hero:** photographic — vibrant bowl, bright, direct.
- **typography:** humanist sans, friendly, bold.
- **colors:** fresh green/neutral (cuisine-conditioned), 1 accent.
- **imagery:** original food; treatment=natural/bright.
- **narrative:** arrival → breadth (menu) → conversion (order/takeout) [high-intent impulse].
- **CTA:** "Order ahead."
- **motion:** lively micro.

### D3. "The Brass Tap" (gastropub, local)
- **Raw evidence:** "craft beer, burgers, sports," 5 photos (bar, food), rating 4.6, services: food/drinks/events.
- **character vector:** balanced; atmosphereRange=3; emotionalRegister=warm; offeringBreadth=broad; narrativePotential=latent.
- **creative character:** `bold-contemporary` (pub variant) or `friendly`.
- **concept:** *communal energy*.
- **hero:** split — bar photo + "burgers & beer."
- **typography:** bold condensed + geometric.
- **colors:** warm charcoal + amber accent (NOT red cliché).
- **imagery:** original bar/food.
- **narrative:** arrival → breadth → events (badge count P-018) → conversion.
- **CTA:** "Book a table / See events."
- **motion:** expressive micro.

---

## E. Law firm — authority without navy cliché

### E1. "Hartwell & Voss" (boutique litigation, design-literate)
- **Raw evidence:** "commercial litigation, sharp strategy," 6 office/partner photos, rating 4.9, services: dispute/commercial/IP.
- **character vector:** balanced; atmosphereRange=3; emotionalRegister=functional/craft; offeringBreadth=focused; consideration=high-stakes.
- **creative character:** `editorial-specialist` (legal variant).
- **concept:** *editorial expertise* (cf. 3e Étage black/yellow, not navy).
- **hero:** typographic/editorial — confident statement on near-black + 1 hot accent (e.g., yellow), NOT navy-everything [APL §4 rule 6, P-001].
- **typography:** confident serif or grotesk + mono; ratio 1.333.
- **colors:** deep charcoal + 1 hot accent (character-derived, rejects navy cliché) [§9.3].
- **imagery:** partner/office originals; treatment=mono/cool.
- **narrative:** relevance → proof (wins/4.9) → process → risk reversal ("free case review") → conversion.
- **CTA:** "Request a consultation."
- **motion:** subtle.

### E2. "Community Legal Aid" (family/immigration, warm)
- **Raw evidence:** "family law, immigration, affordable," 4 team photos, rating 4.7, services: family/immigration/wills.
- **character vector:** balanced; atmosphereRange=2; emotionalRegister=warm; offeringBreadth=broad; consideration=high-stakes but anxious.
- **creative character:** `warm-family` (legal variant).
- **concept:** *reassurance through humanity*.
- **hero:** split — warm team photo + "help with life's legal moments."
- **typography:** humanist sans, approachable.
- **colors:** warm neutral + humanist accent (NOT navy, NOT cold).
- **imagery:** real team; treatment=warm.
- **narrative:** relevance → proof → process (plain-language) → risk reversal → conversion.
- **CTA:** "Book a free chat."
- **motion:** gentle.

### E3. "Sterling Corporate Counsel" (big-firm, traditional)
- **Raw evidence:** "M&A, regulatory, 40 yrs," 8 formal photos, rating 4.8, services: M&A/tax/regulatory.
- **character vector:** image-led (moderate); atmosphereRange=4; emotionalRegister=functional; offeringBreadth=broad; consideration=high-stakes.
- **creative character:** `heritage-authoritative`.
- **concept:** *architectural clarity* (authority through structure).
- **hero:** editorial — confident type + restrained office image; asymmetric.
- **typography:** traditional serif or confident sans; ratio 1.25.
- **colors:** deep neutral (charcoal, NOT navy-cliché) + 1 restrained accent.
- **imagery:** office/concept; treatment=clean.
- **narrative:** relevance → proof (track record) → breadth → risk reversal → conversion.
- **CTA:** "Speak to a partner."
- **motion:** subtle.

**All five industries demonstrate: same category, divergent creative directions driven by evidence — the core requirement.**

---

# 22. WEBSITEAGENT MAPPING

[This section is grounded in the live repo, inspected read-only. It maps the spec to *existing* concepts and identifies gaps. No implementation is performed.]

## 22.1 Where the engine sits today

The repo's `docs/experience-system.md` already defines a chain almost identical to this spec:

```
Research evidence → BusinessCharacter → ExperienceArchitecture → AssetChoreography
→ ConversionStrategy → InteractionStrategy → ExperienceScript → Content Director
→ AI Director (optional) → composeDesign → renderer → quality gates
```

This spec's pipeline (§20) maps onto it as:

| This spec stage | Existing repo concept | Status |
|---|---|---|
| Evidence validation | `lib/sources` (ListingHarvest), `merge.ts`, provenance | **Exists** [architecture.md] |
| Character extraction | `lib/design/character.ts` `deriveCharacter` → `BusinessCharacter` | **Exists, mature** |
| Confidence / basis | `BusinessCharacter.evidence/rationale`; `basis: evidence\|creative-default` | **Exists** [experience-system.md] |
| Creative character | `VisualPersonality.direction` (11-value closed set) + `mood` | **Partial** — label is chosen, but the §4.2 *vocabulary reasoning* is implicit in `designDirectorAgent` |
| Creative brief | (folded into `designDirectorAgent` internal brief) | **Gap** — not a persisted, reviewable artifact (§5 proposes promoting it) |
| Creative concept | `experience.mode` + `signatureMoment` + `world` ground journey | **Partial** — concept is realized via mode/signature but not named as a distinct "concept" stage |
| Visual direction | `VisualPersonality` + `ColorSystem` + `TypographySystem` + `ImageStrategy` | **Exists** |
| Experience architecture | `lib/design/experience.ts` (mode/signature/galleryLead/pacing) | **Exists** |
| Narrative (script) | `lib/design/script.ts` (`roleFor`, `planNarrativeOrder`, `buildScript`) | **Exists, tested** |
| Art direction | `lib/design/types.ts` `SectionDesign` (variant/frame/emphasis/bg/fullBleed/momentTransition) | **Exists** |
| Conversion | `lib/design/conversion.ts` `ConversionStrategy` | **Exists** |
| Responsive | fluid tokens in `types.ts`; `R-01…R-08` | **Exists** |
| Design tokens | `WebsiteDesign` (closed tokens) | **Exists** |
| Render | `lib/render/renderSite` (pure, no-JS) | **Exists, tested** |
| Visual QA (Bespoke) | `lib/design/quality.ts` `scoreExperience` | **Exists** |
| Template-smell | `lib/design/quality.ts` `genericityReport` | **Exists, benchmarked** |
| AI Director | `agents/designDirectorAgent.ts` → `DesignDirective` → `applyDirective` | **Exists (optional improver)** |

## 22.2 Concepts that already support the spec

- **BusinessProfile / BusinessCharacter** — the measured vector (§3). Mature and deterministic.
- **ExperienceArchitecture / ExperienceScript** — mode, signature, narrative order (§8, §12). Mature.
- **AssetChoreography** — hero/signature/sequence/contrast/rights (§10). Exists (`assets.ts`).
- **ConversionStrategy** — mode/verb/placement/friction (§14). Exists.
- **Content Director** — what each beat *says*, role-driven, evidence-language (§12). Exists (`lib/content/director.ts`).
- **Design Director (AI)** — optional improver via validated closed-set `DesignDirective` (§18 class B/C). Exists.

## 22.3 Concepts / contracts that need extension

1. **Persist the Creative Brief as a first-class artifact** (§5). Today the brief lives inside `designDirectorAgent` and is not separately reviewable/persisted. Add a `CreativeBrief` type emitted between character and directive.
2. **Name the Creative Concept explicitly** (§6). Today concept = `mode` + `signatureMoment` + `world`. Add a `creativeConcept` field (the visual thesis string) to `VisualPersonality` or `ExperienceArchitecture` so QA can assert "concept influences whole site."
3. **Widen the creative-character vocabulary reasoning** (§4.2). `DesignDirection` is an 11-value closed set (`minimal/luxury/corporate/elegant/modern/editorial/creative/playful/bold/premium/friendly` [Repo `types.ts`]); the §4.2 *character labels* (technical-precise, quiet-luxury, etc.) are a useful intermediate vocabulary the Director could emit to justify the `DesignDirection` choice. Optional.
4. **Assert concept-coherence in QA** (§6.3, §17). `scoreExperience` today checks explainability + businessSpecificity + narrative + coherence + conversion + asset + accessibility. Add a lightweight "concept carried through" axis (does the hero/type/color all serve the named concept?).
5. **Benchmark must include the 11 target verticals** (mechanic…real-estate) — the repo's `test/design/benchmark.test.ts` already asserts `diverse` across a set; extend the set to cover the target verticals so `genericityReport` catches cross-vertical collapse [Open Q9, DIF §20 rec 9].

## 22.4 Where the Creative Direction Engine should sit

It **is** the `lib/design` layer + the optional `agents/designDirectorAgent`, exactly as the repo already structures it. [architecture.md: "`lib/design/` is deterministic and model-free… The AI Design Director is an optional improver that may override this floor only through validated closed-set decisions."] No new top-level subsystem is required — this spec refines and names the stages the repo already has. The only structural additions are the **persisted Creative Brief** and the **named Creative Concept** (§22.3 items 1–2), which slot into the existing `planNarrative` → `composeDesign` flow without disturbing the agent/platform boundary.

---

# 23. IMPLEMENTATION PRIORITY

Ranked by *smallest change → largest visual improvement* (the repo already implements the deterministic floor, so most leverage is in the AI-selection tightness and the two new artifacts). [Synthesis prioritized per DIF §20 recs + repo maturity.]

| Priority | Work | Why it pays | Effort |
|---|---|---|---|
| **P0** | Persist `CreativeBrief` artifact (§5, §22.3.1) | Makes AI intent reviewable; catches template drift early; small schema add | Low |
| **P0** | Name `creativeConcept` in the design contract (§6, §22.3.2) | Enables concept-coherence QA; one field | Low |
| **P0** | Tighten cliché blocklist in color/type selection (§9.3, §8.4) | Directly defeats "law=navy" collapse; reuses existing validators | Low |
| **P1** | Extend benchmark to 11 target verticals (§22.3.5) | `genericityReport` becomes a real cross-vertical defense | Low-Med |
| **P1** | Add "concept carried through" axis to `scoreExperience` (§17.3) | Detects slogan-not-concept failure | Med |
| **P1** | Strengthen creative-character→direction justification (§4.3) | Reduces generic-SaaS typography; uses existing `businessSpecificity` | Med |
| **P2** | Character-vector soft-axis validation (price/consideration/formality) on 11 verticals (Open Q7) | Improves label accuracy | Med |
| **P2** | Responsive emphasis preservation (§16) — ensure moment peak survives mobile | Mobile is majority traffic | Med |
| **P2** | Honest-degradation copy/labels for `fallback` modes (§10.3, §19) | Avoids fake-stock temptation | Low |
| **P3** | Per-character motion choreography library (§15.2) | Brand motion inside gate | Med-High |
| **P3** | Continuous-runtime "immersive" mode (Phase 5 runtime, REPO) | Only after script-as-data proves out; large, separate build | High |
| **P3** | Cross-vertical human-judged "premium vs template" eval dataset (DIF §20 rec 9) | Calibrates `genericityReport` + `scoreExperience` AI half | Med |

---

# 24. OPEN QUESTIONS

[Inherited and extended from DIF §19; each requires real-world validation before encoding as hard rule.]

1. **Trust-impact weighting** [S24] is a single commercial source — confirm multi-source before encoding CV-05 weighting.
2. **Visual-hierarchy primary source** (NN/g) 404'd — re-source before locking UX-03 evidence.
3. **Hero-image usability** NN/g article 404'd — re-source before encoding I-03 narrative.
4. **Font-pairing science** — little empirical "which pairings convert"; need typography-research synthesis.
5. **Color-emotion reliability** — color-psychology claims often overstated; skeptical source review needed.
6. **Reduced-motion default scope** — how much motion to disable at `reduce`; calibrate.
7. **Character-vector extraction reliability** — can AI reliably score price-tier/consideration/sensory from listings+reviews? Validate on the 11 target verticals (this spec's §3 soft axes).
8. **Performance budget vs premium imagery** — quantify LCP cost of cinematic heroes; set per-character budgets.
9. **Bespoke-scoring calibration** — `scoreExperience`/`genericityReport` AI half needs correlation with human "premium" judgments; build the 11-vertical eval dataset.
10. **Localization/RTL** — mostly out of scope for local SMBs; flag for multi-region.
11. **Concept-coherence metric** (new, from §6.3/§17.3) — how to deterministically assert "the concept influences the whole site" without a taste oracle; candidate: require hero type-scale, accent placement, and signature beat to each reference the concept string.

---

# 25. FINAL CREATIVE DIRECTOR DOCTRINE

*What BusinessForge must never forget when creating a website.*

1. **Industry is a prior, never a template.** A hotel and a bar are not "atmospheric" by category; read the business. [DIF §1.6]
2. **Design to the business's character, not its label.** Two dentists, two mechanics, two law firms can — and must — look different. [DIF §1.6, §13]
3. **Character is measured from evidence, never invented.** Images, services, words, ratings — not the category — decide the vector. [Repo character.ts]
4. **The concept is a visual thesis, not a slogan.** If only the headline changed, you didn't have a concept. [§6]
5. **Palette comes from character, not cliché.** No navy law, no red restaurant, no blue dentist — unless that business's evidence earns it. [DIF C-04, APL §4 rule 6]
6. **Typeface is personality before words.** Choose for the business, never the default. System fonts only as a deliberate concept. [DIF T-04, APL §4 rule 4]
7. **Original photography is the credibility.** Stock is the fastest way to look inauthentic. When none exists, say so honestly. [DIF I-01]
8. **Never fabricate a fact to look sophisticated.** A missing hero is a real answer; a thin business gets an honest brochure. [Repo experience-system.md]
9. **Trust before the ask.** Proof precedes the CTA, or the CTA is ignored. [DIF CV-02, N-02]
10. **One focal point per viewport; one dominant CTA per view.** Choice overload kills conversion. [UX-03, UX-04, CV-01]
11. **Break the grid on purpose, never by accident.** Asymmetry signals bespoke; identical-centered sections signal template. [DIF G-04, Repo types.ts SectionFrame]
12. **Motion must clarify or express within the gate.** Decorative motion with no function is a defect. Respect reduced-motion, always. [DIF M-01/M-02, APL §2 pattern 8]
13. **The deterministic floor is non-negotiable.** Contrast, targets, reduced-motion, vitals, spacing, type scale — these are the floor; AI writes the sentence above them, never below. [DIF §17.4]
14. **Premium is restraint, not excess.** Whitespace, 2–3 colors with jobs, one hot accent, consistent treatment. [DIF C-01, APL §2 patterns 3–5]
15. **Degrade honestly.** Poor images → treat and crop; no images → reduce; never swap in stock to fake richness. [DIF §18 contradiction 5, §19]
16. **The page must survive mobile as a concept, not as a stacked clone.** Composition, crop, emphasis, and order may adapt — the idea must not. [§16]
17. **Self-audit for template-smell.** If every business shares a hero, a palette, a sequence, or a type — the engine failed. [DIF §15, Repo genericityReport]
18. **Explain every decision.** Each choice carries its evidence and rationale; a design nobody can argue with is a design nobody can review. [Repo types.ts, DIF §17]
19. **Speed is premium.** A slow site is not a premium site, no matter how it looks. [DIF M-04, I-03]
20. **The goal is not a beautiful template. It is a website only this business could be.** [Synthesis — the doctrine's closing principle.]

---

## FINAL REPORT

**Documents read (3):**
- `C:\Users\40728\bf_research\Design_Intelligence_Foundation.md` (685 lines, full) — [DIF]
- `C:\Users\40728\bf_research\AWWWARDS_PATTERN_LIBRARY.md` (617 lines, full) — [APL]
- Live `WebsiteAgent` repo (read-only grounding): `docs/architecture.md`, `docs/experience-system.md`, `lib/design/character.ts`, `lib/design/types.ts`, `lib/design/quality.ts`, `agents/designDirectorAgent.ts` — [REPO]

**Major synthesis decisions:**
1. Adopted the repo's *measured* `BusinessCharacter` axes as the character vector (§3) rather than the prompt's looser suggested axes, reconciling them into orthogonal, scorable dimensions.
2. Introduced the **Creative Brief** (§5) and **Creative Concept** (§6) as explicit, persisted, reviewable stages — the gap between the repo's `character.ts` and `composeDesign`.
3. Reframed the prompt's "creative character examples" as a *vocabulary of character outcomes* derived from vector signatures, explicitly with **no industry presets** (§4).
4. Formalized **BESPOKE SCORE** = `scoreExperience` and **TEMPLATE SMELL SCORE** = `genericityReport` (§17), both already implemented in the repo — making the spec's QA section repo-grounded rather than aspirational.
5. Mapped the entire spec onto the existing `lib/design` + `designDirectorAgent` architecture (§22), confirming no new top-level subsystem is needed.

**Number of rules created:**
- 20 doctrine rules (§25)
- 13 visual-direction decisions with floors (§7.2)
- 9 hero strategies (§11.1)
- 5 failure-mode degradations (§19)
- 9 prioritized implementation items (§23)
- 11 open questions (§24)
- Plus per-section operational rules throughout.

**Concepts created (synthesis, not in source docs):**
- Creative Brief schema (§5) — proposed new persisted artifact
- Creative Concept as a named, QA-assertable stage (§6)
- Creative-character vocabulary (§4.2) — intermediate labels justifying `DesignDirection`
- Bespoke/Concept-coherence QA axis (§17.3, Open Q11)

**Deterministic / AI / Hybrid split (summary):**
- **Deterministic (hard floor):** contrast, target size, reduced-motion, spacing/type scales, grid, mobile-first, CWV budget, conversion skeleton, min-field forms, bespoke/template lint, industry-as-weak-prior.
- **AI (bounded):** specific font pairing, accent hue, hero art direction, narrative angle/copy voice, asymmetry degree, motion choreography style.
- **Hybrid:** business character label, section sequence emphasis, spacing emphasis, image treatment system, micro-interaction taste, sticky-CTA gating, hero strategy selection, motion intensity.
- Full table in §18 (27 decisions classified with rationale).

**Unresolved questions (top 3 to validate first):**
1. Can the soft character axes (price/consideration/formality) be reliably extracted? (Open Q7)
2. Does `genericityReport` correlate with human "premium" judgment on the 11 verticals? (Open Q9)
3. What is the deterministic proxy for "concept carried through the whole site"? (Open Q11)

**Output file path:**
`C:\Users\40728\bf_research\CREATIVE_DIRECTION_ENGINE_SPEC.md`

**Constraints honored:** No WebsiteAgent repo modification; no modification of either source document; no application code written; no dependencies installed; no commit performed. This is research/specification only.
