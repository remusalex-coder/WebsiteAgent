# HUMAN DESIGN PRINCIPLES (Phase 3 / 7 / 10)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director
**Date:** 2026-08-17
**Knowledge class:** K1 (invariant) + K2 (craft) + K4 (anti-knowledge), tagged per block.
**Companion documents (read first; cross-referenced, not duplicated):**
- `docs/Design_Intelligence_Foundation.md` — sourced NN/g + premium/trend/low-value registry (Section 18).
- `docs/AWWWARDS_PATTERN_LIBRARY.md` — 25 live Awwwards-winner teardowns with hard DOM/CSS evidence.
- `docs/knowledge/ANTI_AI_SLOP.md` — K4 anti-patterns (Phase 6).
- `docs/knowledge/EXPERIENCE_SIGNATURE_SYSTEM.md` — signature discovery & restraint contract (Phase 5).
- `docs/knowledge/KNOWLEDGE_TAXONOMY.md` — K1–K4 classes; `ACTIVATES_WHEN` / `SUPPRESSED_WHEN`.

## 0. Status & honesty note

This is a research artifact. It encodes **what separates AI-generated output, template output, professional-agency output, and award-winning output** (Phase 3), the discipline of **creative restraint** (Phase 7), and the **visual-psychology** basis for why compositions have impact (Phase 10). It is not executable; it feeds the worker-knowledge contract described in `KNOWLEDGE_TAXONOMY.md`.

**Verified vs synthesis.** The four-tier comparison table and every principle block tagged with Awwwards evidence are grounded in the DOM/CSS teardown facts already recorded in `docs/AWWWARDS_PATTERN_LIBRARY.md` (25 sites, 2026-08-11) and the sourced principle registry in `docs/Design_Intelligence_Foundation.md`. The visual-psychology section synthesises established perceptual-cognition principles (Gestalt laws, NN/g, formatics) that are stable and cited where possible. Where a claim is engineering calibration rather than a cited standard it is marked `[CALIBRATE]`. No new live-URL verification was performed; the underlying evidence was gathered in the companion docs.

**Style rule enforced throughout:** principles are imperative sentences, not adjectives. The forbidden adjective-shaped instruction (a generic "make it premium/luxury" directive) does not appear as any principle. Every principle takes the required concrete shape, e.g. *"Use visual contrast to create a deliberate hierarchy between X and Y."*

---

## 1. Four-Tier Comparison: AI-generated / Template / Professional Agency / Award-winning

Grounded in the 25-site teardown (`docs/AWWWARDS_PATTERN_LIBRARY.md`) for the agency and award columns; the AI-generated and template columns describe the failure median documented in `docs/knowledge/ANTI_AI_SLOP.md`.

| # | Dimension | AI-generated | Template | Professional agency | Award-winning (teardown-evidenced) |
|---|---|---|---|---|---|
| 1 | **Type scale ratio (display:body)** | ~1.5–2×, low contrast (40–56px h1) | ~2×, safe | ~3×, considered | 4–9× (117/16, 130/12, 150/26, 247/32) |
| 2 | **Palette size / active hues** | Rainbow, 6+ arbitrary | Industry cliché (navy law, red restaurant) | Restrained 2–3 + neutrals | 2–9, usually 2–4 on a neutral base; several at 0 bg colours |
| 3 | **Hierarchy asymmetry** | Flat — everything equal weight | Balanced but uniform | Deliberate primary/secondary | Asymmetric via scale; one dominant focal moment |
| 4 | **Section count & height variance** | 6–9 stacked, low variance | 6–9 canonical stack | 5–7, moderate variance | Often resolves to 1 continuous section; high variance |
| 5 | **Image sourcing & crop variety** | Stock, uniform 16:9 crop, stock radius | Stock or placeholder, uniform | Real photography, consistent grade | Real/original; varied distance; consistent light logic |
| 6 | **Motion count & purpose** | Global fade-up everywhere; particles | Minimal or theme-animations | Functional transitions, subtle | Functional or cinematic; never gratuitous; no carousels |
| 7 | **Whitespace distribution** | Even, metronomic | Generous-but-generic | Generous, purposeful | High; largest silence beside the most important thing |
| 8 | **Grid discipline vs breaks** | None / accidental | Rigid 12-col, never breaks | 12-col, occasional break | Grid discipline *under* freedom; deliberate breakouts |
| 9 | **Copy specificity density** | Generic ("passionate about quality") | Placeholder/vague | Specific, on-brand | Specific; one real sentence outperforms adjective soup |
| 10 | **Navigation convention** | Repeated CTA nag; hamburger reflex | Standard top nav, all links | Persistent nav + clear path | Minimal hero nav (logo + 1 CTA), expand on scroll |
| 11 | **What is omitted** | Nothing — everything included | Nothing | Some trimming | Conventional sections deleted; one signed omission list |
| 12 | **Evidence of constraint** | None — fills space plausibly | None — follows pattern | Brief-driven constraints | Concept-driven constraint (signature settles arguments) |
| 13 | **First-screen strategy** | Centered headline + 2 buttons over gradient | Hero image + headline + buttons | Strong hero, real photo, clear CTA | Typographic hero (no photo) OR one full-bleed image + one line |
| 14 | **Edge language (radius system)** | 8–9999px, inconsistent | One soft radius everywhere | Coherent system | Deliberate — sharp editorial common; ≤2 values |
| 15 | **Accent treatment** | Many competing accents | One theme accent | One accent, semantic | ONE hot accent, sparse, intentional (lime, yellow, red) |
| 16 | **Relationship to business reality** | Transplantable to any business | Industry-stereotyped | Derives from brief/assets | Unmistakably this business; transplant test fails |
| 17 | **What settles a design argument** | Nothing — median wins | The pattern library | The client brief | The experience signature (`EXPERIENCE_SIGNATURE_SYSTEM.md` §1) |

**Reading the table.** The decisive column is not "award-winning tricks" but **constraint**: award winners restrict palette, restrict motion, restrict sections, and let one idea reject everything else. AI output and templates both fail the *hierarchy* and *omission* rows. See `ANTI_AI_SLOP.md` §5 (transplant test, hierarchy test).

---

## 2. Principle Blocks — Phase 3 / 7 / 10

> Block schema (every block): **ID / TITLE / PRINCIPLE / WHY / WHEN TO USE / WHEN NOT TO USE / GOOD EXAMPLE / BAD EXAMPLE / IMPLEMENTATION IMPLICATION / KNOWLEDGE CLASS / SOURCE + SOURCE DATE / CONFIDENCE / TAGS / APPLICABLE WORKERS.**

### HD-001 — Concept: anchor the idea to one verified anomaly
- **PRINCIPLE:** Derive the site's single organising concept from one verified, unusual fact about the business rather than from its industry label.
- **WHY:** Category-default concepts are the most common source of interchangeable sites; an anomaly is the only raw material of distinctiveness (`EXPERIENCE_SIGNATURE_SYSTEM.md` §2–§3).
- **WHEN TO USE:** Every project, before any visual decision.
- **WHEN NOT TO USE:** When the evidence inventory shows no anomaly — then fall to material-led editorial (`EXPERIENCE_SIGNATURE_SYSTEM.md` §8), do not invent one.
- **GOOD EXAMPLE:** A bakery that opens 04:00 and sells out by 10:00 → scarcity as a factual organising idea.
- **BAD EXAMPLE:** "Bakery = fermentation" pulled from a category cliché table.
- **IMPLEMENTATION IMPLICATION:** The concept worker must read the verified dossier first and record the rejected axes.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `EXPERIENCE_SIGNATURE_SYSTEM.md` §2–§3 (2026-08-17); `KNOWLEDGE_TAXONOMY.md` D01 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** concept, signature, differentiation, business-truth
- **APPLICABLE WORKERS:** Research Worker, Business Understanding Worker, Creative Concept Worker

### HD-002 — Composition: make one subject dominate
- **PRINCIPLE:** Use visual contrast to create a deliberate hierarchy between the primary subject and everything that supports it.
- **WHY:** The absence of hierarchy — all elements equal weight — is the single strongest AI tell (`ANTI_AI_SLOP.md` §1.3, A-01/A-17).
- **WHEN TO USE:** Every section and every viewport.
- **WHEN NOT TO USE:** Never suppressed; only the *means* of contrast vary (size/position/color/weight, never color alone — `Design_Intelligence_Foundation.md` T-05).
- **GOOD EXAMPLE:** Nexola — 130px wordmark + one lime CTA, everything else recedes (`AWWWARDS_PATTERN_LIBRARY.md` #4).
- **BAD EXAMPLE:** Three equal-weight cards, three equal buttons, three equal columns.
- **IMPLEMENTATION IMPLICATION:** Enforce one focal element per viewport in the composition worker; flag competing equal weights.
- **KNOWLEDGE CLASS:** K1 (perception) + K2 (craft)
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` UX-03 (2026-08-11); `ANTI_AI_SLOP.md` A-01 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** composition, hierarchy, focal-point, contrast
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker, QA Worker

### HD-003 — Art direction: photograph real material consistently
- **PRINCIPLE:** Photograph the business's real material from a consistent distance and light logic so the art direction is recognisable as belonging to this business.
- **WHY:** Uniform stock treatment tells the visitor the images are interchangeable and therefore not real (`ANTI_AI_SLOP.md` A-18); real, consistently graded photography is the strongest trust signal (`Design_Intelligence_Foundation.md` I-01).
- **WHEN TO USE:** When verified real assets exist.
- **WHEN NOT TO USE:** When only generic stock is available — then reduce to typographic/editorial direction, do not art-direct lies (`KNOWLEDGE_TAXONOMY.md` D08 SUPPRESSED_WHEN).
- **GOOD EXAMPLE:** Hamza Tariq — 296 real images, varied distance, consistent grade (`AWWWARDS_PATTERN_LIBRARY.md` #21).
- **BAD EXAMPLE:** Smiling-handshake stock cropped to one 16:9 box at one radius with one overlay.
- **IMPLEMENTATION IMPLICATION:** Art-direction worker emits a crop/light spec per slot; one grade token across all imagery (I-04).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` I-01/I-04 (2026-08-11); `ANTI_AI_SLOP.md` A-18 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** art-direction, photography, image-treatment, authenticity
- **APPLICABLE WORKERS:** Art Direction Worker, Assets Worker, QA Worker

### HD-004 — Typography: use extreme scale contrast
- **PRINCIPLE:** Set the display face at an extreme size contrast to the body to create a deliberate scale hierarchy between the statement and the supporting text.
- **WHY:** Display:body ratios of 4–9× recur across winners and create instant editorial tension; low contrast (≤3×) travels with anonymity (`AWWWARDS_PATTERN_LIBRARY.md` §2.2; `ANTI_AI_SLOP.md` A-15).
- **WHEN TO USE:** Any brand wanting editorial/premium feel; universal lever.
- **WHEN NOT TO USE:** Dense-data/utility UIs needing uniform legibility.
- **GOOD EXAMPLE:** Mosby Files — 117px display over 16px body (~7×) (`AWWWARDS_PATTERN_LIBRARY.md` #1).
- **BAD EXAMPLE:** 44px headline over 16px body at the same weight, same color.
- **IMPLEMENTATION IMPLICATION:** Body ≥16px floor (K1); display via `clamp()` bounded by viewport; ratio chosen by AI within bounds (T-01, P-003).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.2 / P-003 (2026-08-11); `Design_Intelligence_Foundation.md` T-01 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** typography, scale-contrast, hierarchy, editorial
- **APPLICABLE WORKERS:** Typography Worker, Art Direction Worker, Frontend Worker

### HD-005 — Storytelling: earn the ask after trust
- **PRINCIPLE:** Order the scroll as a persuasion arc that presents proof before the call to action, rather than front-loading the ask.
- **WHY:** Trust must precede conversion or the CTA is ignored; a narrative scroll placed in front of a retrieval task is hostile (`Design_Intelligence_Foundation.md` N-02; `KNOWLEDGE_TAXONOMY.md` D06 SUPPRESSED_WHEN).
- **WHEN TO USE:** Businesses with a process, transformation, or history worth traversing.
- **WHEN NOT TO USE:** User intent is retrieval (hours, price, book) — then answer first, narrate never (`EXPERIENCE_SIGNATURE_SYSTEM.md` §8.2).
- **GOOD EXAMPLE:** Hook → relevance → proof → offer → risk reversal → CTA (N-02 skeleton).
- **BAD EXAMPLE:** CTA in the hero before any proof; "Welcome since 1998" as the hero.
- **IMPLEMENTATION IMPLICATION:** Experience-architecture worker derives section order from signature + visitor task, not a canonical stack.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` N-01/N-02 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** storytelling, narrative, sequence, conversion-arc
- **APPLICABLE WORKERS:** Experience Architecture Worker, Content Worker, Creative Concept Worker

### HD-006 — Visual hierarchy: one weight per viewport
- **PRINCIPLE:** Give exactly one element per viewport the highest visual weight so the eye lands on a single focal point.
- **WHY:** Multiple equal-weight competing elements dissipate attention and read as template (`Design_Intelligence_Foundation.md` UX-03; `ANTI_AI_SLOP.md` A-04).
- **WHEN TO USE:** Every viewport and section.
- **WHEN NOT TO USE:** Never; the focal point shifts per scroll position, it is not fixed.
- **GOOD EXAMPLE:** Serotoninn — one 100px wordmark as the sole hero focal point (`AWWWARDS_PATTERN_LIBRARY.md` #24).
- **BAD EXAMPLE:** Headline, subhead, two buttons, badge, and image all at similar weight.
- **IMPLEMENTATION IMPLICATION:** Compose with size > position > color > weight priority ordering (UX-03).
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` UX-03 (2026-08-11); `ANTI_AI_SLOP.md` A-04 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** visual-hierarchy, focal-point, attention, contrast
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker, QA Worker

### HD-007 — Rhythm: compress and expand with content
- **PRINCIPLE:** Vary section spacing and height deliberately so the page phrasing rises and falls with the content's importance rather than marching at one tempo.
- **WHY:** Uniform spacing is the layout equivalent of a monotone voice; deliberate variation signals a human hand (`ANTI_AI_SLOP.md` A-12/A-17).
- **WHEN TO USE:** Always, by selecting from one consistent spacing scale.
- **WHEN NOT TO USE:** Never; keep the *scale* systematic while varying the *selection* from it (G-02 8px base).
- **GOOD EXAMPLE:** Tight caption under a large image, then a huge silence before a statement.
- **BAD EXAMPLE:** Every section 96px padding, one viewport tall, identical structure.
- **IMPLEMENTATION IMPLICATION:** Flag coefficient of variation of section padding below ~0.15 `[CALIBRATE]`; require ≥1 compressed and ≥1 expanded section.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-12/A-17 (2026-08-17); `Design_Intelligence_Foundation.md` G-02/G-03 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** rhythm, spacing, pacing, variation
- **APPLICABLE WORKERS:** Experience Architecture Worker, Frontend Worker, QA Worker

### HD-008 — Restraint: remove meaning-free elements first
- **PRINCIPLE:** Remove every element that does not carry meaning before adding any element that carries only decoration.
- **WHY:** Extra elements compete with relevant information; restraint is the discipline that separates craft from clutter (`Design_Intelligence_Foundation.md` P-08; `KNOWLEDGE_TAXONOMY.md` D39).
- **WHEN TO USE:** At every add decision.
- **WHEN NOT TO USE:** Never — but removing until nothing is communicated is a different failure (see §3 and `ANTI_AI_SLOP.md` R-SLOP-5).
- **GOOD EXAMPLE:** Studio OL — paper, ink, and one red accent; nothing else (`AWWWARDS_PATTERN_LIBRARY.md` #9).
- **BAD EXAMPLE:** Adding a particle layer "to make it feel alive."
- **IMPLEMENTATION IMPLICATION:** Restraint contract consulted at every ADD edge; record what was refused (R-PROP-2).
- **KNOWLEDGE CLASS:** K2 (with K4 teeth)
- **SOURCE + SOURCE DATE:** `KNOWLEDGE_TAXONOMY.md` D39 (2026-08-17); `Design_Intelligence_Foundation.md` P-08 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** restraint, minimalism, omission, discipline
- **APPLICABLE WORKERS:** All creative workers, QA Worker

### HD-009 — Asymmetry: break the grid on purpose
- **PRINCIPLE:** Break the grid with one intentional offset or full-bleed block to signal a bespoke composition rather than a centered template.
- **WHY:** Pure centered grids read "template"; deliberate breakouts read bespoke, and asymmetry happens *within* a grid, not without one (`Design_Intelligence_Foundation.md` G-04; `AWWWARDS_PATTERN_LIBRARY.md` §2.7).
- **WHEN TO USE:** Premium/editorial character (architect, photographer, hotel, artist).
- **WHEN NOT TO USE:** Trust-critical utilitarian flows (checkout, booking) needing predictable alignment.
- **GOOD EXAMPLE:** Asymmetric editorial grid with one full-bleed project image (P-008).
- **BAD EXAMPLE:** Centered hero, centered cards, centered footer, all same width.
- **IMPLEMENTATION IMPLICATION:** Base 12-col grid; breakouts allowed only as defined variants; never breaks accessibility.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` G-04 (2026-08-11); `AWWWARDS_PATTERN_LIBRARY.md` P-008 (2026-08-11).
- **CONFIDENCE:** Medium-High
- **TAGS:** asymmetry, grid, breakout, editorial
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker, Frontend Worker

### HD-010 — Interaction: one signature act, standard elsewhere
- **PRINCIPLE:** Choose one signature interaction that embodies the concept and keep every other interaction standard, fast, and predictable.
- **WHY:** Non-standard interactions without a user purpose degrade usability while signalling effort; one purposeful act reads as intent (`ANTI_AI_SLOP.md` A-20; `KNOWLEDGE_TAXONOMY.md` D16).
- **WHEN TO USE:** When a signature survives falsification and invites an interaction.
- **WHEN NOT TO USE:** When no user purpose exists — then standard behaviour everywhere (K1 affordance floor).
- **GOOD EXAMPLE:** A "drag" cursor affordance on a genuinely draggable gallery.
- **BAD EXAMPLE:** Custom cursor that merely replaces the pointer with a circle; magnetic buttons that resist the pointer.
- **IMPLEMENTATION IMPLICATION:** Count of distinct custom-interaction mechanisms > 1 triggers a flag `[CALIBRATE]`; each must name a user purpose + pass a11y floor.
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-20 (2026-08-17); `KNOWLEDGE_TAXONOMY.md` D16 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** interaction, affordance, purpose, signature
- **APPLICABLE WORKERS:** Interaction Design Worker, Frontend Worker, QA Worker

### HD-011 — Motion: motion must mean something
- **PRINCIPLE:** Animate only state changes, direction, or attention so that every motion depicts a real change rather than announcing that motion exists.
- **WHY:** Motion that doesn't clarify distracts and hurts performance/accessibility; winners use functional or cinematic motion, never gratuitous (`Design_Intelligence_Foundation.md` M-01; `AWWWARDS_PATTERN_LIBRARY.md` §2.8).
- **WHEN TO USE:** State changes, feedback, scroll reveals tied to meaning.
- **WHEN NOT TO USE:** Decorative loops competing with content; `prefers-reduced-motion` (K1 override).
- **GOOD EXAMPLE:** Spur Intelligence — canvas visualization that reveals data on scroll (`AWWWARDS_PATTERN_LIBRARY.md` #14).
- **BAD EXAMPLE:** Every element fades and slides up 20px forever (A-13).
- **IMPLEMENTATION IMPLICATION:** 150–300ms, standard easing; ban global scroll-reveal as default; reduced-motion guard mandatory.
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` M-01/M-02 (2026-08-11); `ANTI_AI_SLOP.md` A-13 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** motion, animation, purpose, performance
- **APPLICABLE WORKERS:** Motion Design Worker, Frontend Worker, QA Worker

### HD-012 — Transitions: match the change in state
- **PRINCIPLE:** Match the duration and easing of a transition to the magnitude of the state change so small changes feel instant and large changes feel considered.
- **WHY:** A uniform 300ms on every transition flattens the difference between a hover and a page change, removing cues about what just happened (`Design_Intelligence_Foundation.md` M-01).
- **WHEN TO USE:** Every state change with a visible transition.
- **WHEN NOT TO USE:** When the change should feel instantaneous (typing, toggling a small control) — then no transition.
- **GOOD EXAMPLE:** 120ms hover feedback; 400ms route change with a spatial direction.
- **BAD EXAMPLE:** One easing/duration reused across >80% of animated elements (A-13 signal).
- **IMPLEMENTATION IMPLICATION:** Motion tokens define per-magnitude durations; per-element assignment, not global.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` M-01/M-05 (2026-08-11).
- **CONFIDENCE:** Medium-High
- **TAGS:** transitions, easing, motion, feedback
- **APPLICABLE WORKERS:** Motion Design Worker, Frontend Worker

### HD-013 — Loading: earn any delay with a reason
- **PRINCIPLE:** Eliminate loading sequences unless the wait carries information or is unavoidable, and never let a sequence stand in for content.
- **WHY:** Long loading sequences are a fail on retrieval-dominant businesses and are only conditionally acceptable for reputation-dominant ones (`ANTI_AI_SLOP.md` R-SLOP-4).
- **WHEN TO USE:** Genuine asset decode (video poster), or a branded hold that is itself the experience (rare, reputation-only).
- **WHEN NOT TO USE:** Local SMB / retrieval task — answer in <400ms, no sequence (`EXPERIENCE_SIGNATURE_SYSTEM.md` §8.2).
- **GOOD EXAMPLE:** A poster frame that paints instantly, video decodes behind it.
- **BAD EXAMPLE:** A self-indulgent 4-second animation before the site appears (agency anti-pattern, `EXPERIENCE_SIGNATURE_SYSTEM.md` §9).
- **IMPLEMENTATION IMPLICATION:** LCP < 2.5s budget (K1, M-04) gates any intro; reduced-motion shows static frame.
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` R-SLOP-4 (2026-08-17); `Design_Intelligence_Foundation.md` M-04 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** loading, performance, lcp, restraint
- **APPLICABLE WORKERS:** Frontend Worker, Performance QA Worker

### HD-014 — Navigation: minimal above the fold
- **PRINCIPLE:** Show only the wordmark and one primary action above the fold, and defer the full navigation until scroll or an inner page.
- **WHY:** Minimal hero nav lets the hero breathe and signals confidence; full nav appears when the visitor has a reason to use it (`AWWWARDS_PATTERN_LIBRARY.md` §2.9, P-009).
- **WHEN TO USE:** Brand/showcase sites with a strong single goal.
- **WHEN NOT TO USE:** Local SMB needing immediate phone/address (mechanic, dentist, restaurant) — persistent contact within 1 tap (P-009).
- **GOOD EXAMPLE:** Nexola — logo + "Start Project" only (`AWWWARDS_PATTERN_LIBRARY.md` #4).
- **BAD EXAMPLE:** Repeated "Get Started" in header, hero, every section, footer (A-11).
- **IMPLEMENTATION IMPLICATION:** Persistent contact accessible within 1 tap on mobile even when nav is minimal; ≤5–7 top items when shown.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.9/P-009 (2026-08-11); `ANTI_AI_SLOP.md` A-11 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** navigation, hero, cta, focus
- **APPLICABLE WORKERS:** Experience Architecture Worker, Frontend Worker

### HD-015 — Cursor: carry information, not decoration
- **PRINCIPLE:** Replace the native cursor only when the replacement carries information the visitor did not already have.
- **WHY:** A circle replacing the pointer is slop; a "drag" cursor on a draggable surface is a real affordance (`ANTI_AI_SLOP.md` A-20).
- **WHEN TO USE:** Genuinely draggable/scrubbable surfaces where the affordance is non-obvious.
- **WHEN NOT TO USE:** Purely aesthetic replacement; touch devices (no cursor); any hover-only affordance without a focus equivalent.
- **GOOD EXAMPLE:** Grab/grabbing cursor on a draggable gallery.
- **BAD EXAMPLE:** `cursor: none` with a custom dot that does nothing.
- **IMPLEMENTATION IMPLICATION:** `cursor: none` is a detectable slop signal unless paired with an information-carrying custom state `[CALIBRATE]`.
- **KNOWLEDGE CLASS:** K1 + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-20 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** cursor, interaction, affordance, purpose
- **APPLICABLE WORKERS:** Interaction Design Worker, Frontend Worker, QA Worker

### HD-016 — Scroll: let the visitor keep control
- **PRINCIPLE:** Keep native scrolling intact and tie any scroll-linked movement to content meaning rather than seizing the scroll position.
- **WHY:** Scroll-jacking removes the one interaction every visitor already knows; purposeful scroll choreography can deepen engagement but must never block reading (`Design_Intelligence_Foundation.md` M-03; `ANTI_AI_SLOP.md` A-20).
- **WHEN TO USE:** Editorial/premium sites where scroll reveals a real narrative.
- **WHEN NOT TO USE:** Utilitarian booking/checkout flows; always banned by default for scroll-jacking.
- **GOOD EXAMPLE:** A project image that reveals as it enters viewport, tied to the story.
- **BAD EXAMPLE:** `wheel` handler with `preventDefault` hijacking vertical scroll.
- **IMPLEMENTATION IMPLICATION:** No `preventDefault` on scroll; reveal assigned per element with purpose; performant, reduced-motion safe.
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` M-03 (2026-08-11); `ANTI_AI_SLOP.md` A-20 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** scroll, choreography, control, narrative
- **APPLICABLE WORKERS:** Interaction Design Worker, Motion Design Worker, Frontend Worker

### HD-017 — Responsive behavior: design the base for 360px
- **PRINCIPLE:** Compose the base layout for a 360px viewport and enhance upward so no breakpoint introduces horizontal scroll or loses content.
- **WHY:** Most SMB traffic is mobile; mobile constraints force clarity, and content loss on zoom is a K1 failure (`Design_Intelligence_Foundation.md` G-06/R-01–R-03; A11y A-02).
- **WHEN TO USE:** Always (deterministic floor).
- **WHEN NOT TO USE:** Never suppressed.
- **GOOD EXAMPLE:** Fluid `clamp()` type; text-nav → hamburger on mobile (observed across teardown, e.g. Revelatio, Vectr).
- **BAD EXAMPLE:** Desktop layout scaled down with horizontal scroll on mobile.
- **IMPLEMENTATION IMPLICATION:** Touch targets ≥44px (K1); `srcset`/`sizes`; test real devices/emulation (R-08).
- **KNOWLEDGE CLASS:** K1
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` G-06/R-01–R-08 (2026-08-11); `AWWWARDS_PATTERN_LIBRARY.md` §2.13 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** responsive, mobile-first, accessibility, fluid
- **APPLICABLE WORKERS:** Frontend Worker, Accessibility QA Worker

### HD-018 — Image treatment: crop for intent, grade for consistency
- **PRINCIPLE:** Vary crop, scale, and subject distance with intent while applying one consistent light and color grade across all imagery.
- **WHY:** That combination — varied composition, uniform grade — is what art direction actually means; uniform everything reads as stock (`ANTI_AI_SLOP.md` A-18; `Design_Intelligence_Foundation.md` I-04).
- **WHEN TO USE:** Whenever real photography is used.
- **WHEN NOT TO USE:** When no usable real asset exists — then typographic direction (D08 suppressed).
- **GOOD EXAMPLE:** One wide establishing shot + several tight material details + one person connected to the business, all same grade.
- **BAD EXAMPLE:** Every image same 16:9 box, same radius, same overlay, same subject distance.
- **IMPLEMENTATION IMPLICATION:** One filter/tonal token; per-slot aspect ratios vary by intent; flag all-images-share-one-ratio (A-18).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-18 (2026-08-17); `Design_Intelligence_Foundation.md` I-04 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** image-treatment, crop, grade, art-direction
- **APPLICABLE WORKERS:** Art Direction Worker, Assets Worker, QA Worker

### HD-019 — Visual metaphor: ground it in real material
- **PRINCIPLE:** Build any visual metaphor from the business's real material or process so the metaphor is verifiable rather than decorative.
- **WHY:** A metaphor with no source in the business's reality is decoration that fails the transplant test; grounded metaphor is what makes a site look designed (`EXPERIENCE_SIGNATURE_SYSTEM.md` §2 method note).
- **WHEN TO USE:** When a physical truth of the business suggests a spatial or material analogy.
- **WHEN NOT TO USE:** When the only available metaphor is the category cliché (gavels for law, scales, handshakes).
- **GOOD EXAMPLE:** Alethia — deep-green + lime derived from ecosystem science, not a generic "earth" green (`AWWWARDS_PATTERN_LIBRARY.md` #23).
- **BAD EXAMPLE:** A "leaf" motif on a law firm because it "feels natural."
- **IMPLEMENTATION IMPLICATION:** Metaphor must trace to a verified fact id; otherwise drop to literal treatment.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `EXPERIENCE_SIGNATURE_SYSTEM.md` §2 (2026-08-17); `AWWWARDS_PATTERN_LIBRARY.md` #23 (2026-08-11).
- **CONFIDENCE:** Medium-High
- **TAGS:** visual-metaphor, material, grounding, concept
- **APPLICABLE WORKERS:** Creative Concept Worker, Art Direction Worker

### HD-020 — Brand specificity: derive palette from the business
- **PRINCIPLE:** Derive the palette from the business's verified character and material rather than from its industry cliché.
- **WHY:** "Law firm = navy, restaurant = red" makes sites interchangeable; character-derived hue is the differentiator (`Design_Intelligence_Foundation.md` C-04; `ANTI_AI_SLOP.md` A-14).
- **WHEN TO USE:** Always; industry is a weak hint only.
- **WHEN NOT TO USE:** Never, but the accent hue must be character-derived, not reflexive "premium = dark + gold."
- **GOOD EXAMPLE:** A bakery's palette from flour, crust, and steel — not black and gold.
- **BAD EXAMPLE:** Thin gold serif on near-black applied to a dentist by reflex (A-14).
- **IMPLEMENTATION IMPLICATION:** Palette worker reads dossier; contrast AA is a hard gate regardless of hue (C-03).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` C-01/C-04 (2026-08-11); `ANTI_AI_SLOP.md` A-14 (2026-08-17).
- **CONFIDENCE:** Medium-High
- **TAGS:** brand-specificity, palette, color, character
- **APPLICABLE WORKERS:** Art Direction Worker, Color Worker, Creative Concept Worker

### HD-021 — Originality: choose distinctive type with rationale
- **PRINCIPLE:** Choose typefaces for the specific job each performs and document the rationale, rather than reaching for the most-recommended pairing.
- **WHY:** Playfair + Inter is the statistical centre of typographic knowledge and signals default-ness; winners use distinctive, often licensed faces and three-family systems (`ANTI_AI_SLOP.md` A-15; `AWWWARDS_PATTERN_LIBRARY.md` §2.6).
- **WHEN TO USE:** Every typographic decision.
- **WHEN NOT TO USE:** Never, but a well-drawn less-common open face beats the most-recommended one when licensing constrains.
- **GOOD EXAMPLE:** Signifier + IBM Plex Mono + Founders Grotesk, each with a role (`AWWWARDS_PATTERN_LIBRARY.md` #1).
- **BAD EXAMPLE:** Playfair Display + Inter chosen because it was suggested.
- **IMPLEMENTATION IMPLICATION:** Flag known over-used pairings; require a stated rationale tied to register/signature.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-15 (2026-08-17); `AWWWARDS_PATTERN_LIBRARY.md` §2.6/P-005 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** originality, typography, pairing, distinctiveness
- **APPLICABLE WORKERS:** Typography Worker, Art Direction Worker, Creative Concept Worker

### HD-022 — Surprise: earn novelty with a justified break
- **PRINCIPLE:** Introduce one unexpected element that the concept justifies, rather than scattering novelties that compete for attention.
- **WHY:** Surprise holds attention only when it is coherent with the idea; unmotivated novelty is the mechanism of slop (`ANTI_AI_SLOP.md` §1.4; `EXPERIENCE_SIGNATURE_SYSTEM.md` §6 propagation).
- **WHEN TO USE:** When a signature invites a non-obvious structural consequence.
- **WHEN NOT TO USE:** When novelty is added to signal effort rather than serve the idea.
- **GOOD EXAMPLE:** A single poster-scale 247px typographic moment for a poster artist (`AWWWARDS_PATTERN_LIBRARY.md` #15).
- **BAD EXAMPLE:** WebGL blob + custom cursor + particle field + gradient text, none justified.
- **IMPLEMENTATION IMPLICATION:** Any novelty must be recordable in the signature's FORCES list or it is decoration.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `EXPERIENCE_SIGNATURE_SYSTEM.md` §6 (2026-08-17); `ANTI_AI_SLOP.md` §1 (2026-08-17).
- **CONFIDENCE:** Medium-High
- **TAGS:** surprise, novelty, concept, coherence
- **APPLICABLE WORKERS:** Creative Concept Worker, Art Direction Worker, Experience Architecture Worker

### HD-023 — Emotional response: design the feeling from a real moment
- **PRINCIPLE:** Design the emotional register from the real moment the customer is in, rather than from a generic aspiration word.
- **WHY:** "Warm, premium, modern" rejects nothing and serves no one; a specific visitor state (anxious, hungry, comparing) determines what the first screen owes them (`EXPERIENCE_SIGNATURE_SYSTEM.md` §2 audience surface; §1 rejection test).
- **WHEN TO USE:** Every project, at the concept stage.
- **WHEN NOT TO USE:** Never — but the register must be derived from verified audience evidence, not assumed.
- **GOOD EXAMPLE:** Calm, low-motion, high-legibility design for an anxious clinic visitor (care as a measurable property).
- **BAD EXAMPLE:** "Timeless elegance" applied to a car-service site that needs phone-first speed.
- **IMPLEMENTATION IMPLICATION:** Audience worker mines review language / enquiry patterns for the real state; register traces to that evidence.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `EXPERIENCE_SIGNATURE_SYSTEM.md` §2/§9 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** emotional-response, audience, register, purpose
- **APPLICABLE WORKERS:** Business Understanding Worker, Creative Concept Worker, Art Direction Worker

### HD-024 — Restraint: the single-object answer
- **PRINCIPLE:** Present one real object, one price, or one action as the whole first screen when that single fact is what the visitor came for.
- **WHY:** The best answer is often one photograph, one sentence, one interaction, much negative space, one subtle transition — not a full experience (`KNOWLEDGE_TAXONOMY.md` D39; `EXPERIENCE_SIGNATURE_SYSTEM.md` §8).
- **WHEN TO USE:** Retrieval-dominant businesses (menu, price, timetable, phone).
- **WHEN NOT TO USE:** When the business's value is a considered narrative the visitor wants to traverse.
- **GOOD EXAMPLE:** A bakery: one photograph of the real product at scale + opening time as designed content, no buttons.
- **BAD EXAMPLE:** A hero with headline + subhead + 2 buttons + badge over a gradient.
- **IMPLEMENTATION IMPLICATION:** First-screen worker may withhold conventional sections when the signature earns it (A-01 "withhold entirely").
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-01 (2026-08-17); `EXPERIENCE_SIGNATURE_SYSTEM.md` §8 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** restraint, first-screen, retrieval, simplicity
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker

### HD-025 — Edge language: at most two radii, by role
- **PRINCIPLE:** Choose at most two border-radius values, each assigned by element role, rather than rounding every element by reflex.
- **WHY:** Inconsistency (8/12/16/9999px chosen arbitrarily) is the tell; sharp editorial edges are common among winners (`ANTI_AI_SLOP.md` A-09; `AWWWARDS_PATTERN_LIBRARY.md` §2.9/§3).
- **WHEN TO USE:** Always; 0 is a legitimate, often superior choice.
- **WHEN NOT TO USE:** Never — but a single consistent soft radius is fine where touch-friendliness is the actual intent.
- **GOOD EXAMPLE:** Sharp-edged editorial layout; photographs never rounded.
- **BAD EXAMPLE:** Both 9999px pills and small-radius cards in the same page (two competing edge languages).
- **IMPLEMENTATION IMPLICATION:** Flag > 2 distinct non-zero radius values `[CALIBRATE]`; radius on `img`/`video` requires a stated reason.
- **KNOWLEDGE CLASS:** K2 + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-09 (2026-08-17); `AWWWARDS_PATTERN_LIBRARY.md` §3 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** edge-language, radius, consistency, craft
- **APPLICABLE WORKERS:** Art Direction Worker, Frontend Worker, QA Worker

### HD-026 — Accent: one hot accent, used sparingly
- **PRINCIPLE:** Reserve a single vivid accent for the primary action and active state, and let it appear only where it must draw the eye.
- **WHY:** One hot accent is the signature across winners (lime, yellow, red, orange); sparse, intentional use guides the eye and avoids chaos (`AWWWARDS_PATTERN_LIBRARY.md` §2.5; `Design_Intelligence_Foundation.md` C-02).
- **WHEN TO USE:** Always; strongest for premium/trust.
- **WHEN NOT TO USE:** Never, but the accent hue must be character-derived, not industry cliché.
- **GOOD EXAMPLE:** Studio OL — one red accent repeated as a brand mark (logo, CTA, link) (`AWWWARDS_PATTERN_LIBRARY.md` #9).
- **BAD EXAMPLE:** A different accent on every card and every link.
- **IMPLEMENTATION IMPLICATION:** ≤3 active hues; accent contrast AA; accent used ≥3 touchpoints for recognizability (P-006).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.5/P-006 (2026-08-11); `Design_Intelligence_Foundation.md` C-02 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** accent, color, restraint, focus
- **APPLICABLE WORKERS:** Color Worker, Art Direction Worker

### HD-027 — Whitespace: deploy silence as emphasis
- **PRINCIPLE:** Place the largest empty space next to the most important element so negative space directs attention rather than merely filling the page.
- **WHY:** Whitespace is high across winners and functions as emphasis; uniform whitespace is merely empty (`AWWWARDS_PATTERN_LIBRARY.md` §2.10; `Design_Intelligence_Foundation.md` G-03).
- **WHEN TO USE:** Always, with deliberate placement.
- **WHEN NOT TO USE:** Never, but space must be earned by adjacency to meaning, not scattered evenly.
- **GOOD EXAMPLE:** A single statement surrounded by a deliberate large silence.
- **BAD EXAMPLE:** Equal margins everywhere so nothing is emphasized.
- **IMPLEMENTATION IMPLICATION:** Compose whitespace per focal point; largest silence adjacent to the primary subject (HD-002).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.10 (2026-08-11); `Design_Intelligence_Foundation.md` G-03 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** whitespace, negative-space, emphasis, rhythm
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker

### HD-028 — First screen: type as hero when no photo
- **PRINCIPLE:** Use an oversized typographic hero with no photographic image when no real photograph can carry the first screen.
- **WHY:** 11/25 winners use a typographic hero; it is the fastest LCP and a pure craft signal; several sites resolve to one continuous section (`AWWWARDS_PATTERN_LIBRARY.md` §2.1; `EXPERIENCE_SIGNATURE_SYSTEM.md` §8.3).
- **WHEN TO USE:** Strong verbal identity; no usable real imagery.
- **WHEN NOT TO USE:** Businesses that must show the real thing/people (restaurant, mechanic) — then one real photo.
- **GOOD EXAMPLE:** Mosby Files — 117px "AMERICAN MODERNISM" on near-black, no photo (`AWWWARDS_PATTERN_LIBRARY.md` #1).
- **BAD EXAMPLE:** Generic centered headline over a stock image.
- **IMPLEMENTATION IMPLICATION:** Type-led minimal sites keep a simple top bar on mobile; type scale ratio via clamp().
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.1/P-001 (2026-08-11); `EXPERIENCE_SIGNATURE_SYSTEM.md` §8.3 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** first-screen, typographic-hero, lcp, restraint
- **APPLICABLE WORKERS:** Experience Architecture Worker, Typography Worker, Frontend Worker

### HD-029 — Copy: specifics over adjectives
- **PRINCIPLE:** Write every sentence from a verified specific — a number, name, place, material, time, or price — rather than from generic aspiration adjectives.
- **WHY:** Generic copy is interchangeable between a dental clinic and a car wash; specificity is unfalsifiable-proof and unmistakably this business (`ANTI_AI_SLOP.md` A-08; `Design_Intelligence_Foundation.md` N-03).
- **WHEN TO USE:** All copy, always.
- **WHEN NOT TO USE:** Never.
- **GOOD EXAMPLE:** "We open at 6:20 and the rye is usually gone by nine."
- **BAD EXAMPLE:** "We are passionate about quality" / "Your journey starts here."
- **IMPLEMENTATION IMPLICATION:** Enforce specificity-density floor (~30% sentences with a proper noun/number/unit) `[CALIBRATE]`; ban a curated adjective corpus (A-08/A-16).
- **KNOWLEDGE CLASS:** K1 (truthfulness) + K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-08/A-16 (2026-08-17); `Design_Intelligence_Foundation.md` N-03 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** copy, specificity, evidence, content
- **APPLICABLE WORKERS:** Content Worker, Business Understanding Worker, QA Worker

### HD-030 — Structure: derive order from the signature
- **PRINCIPLE:** Derive section order from the signature and the visitor's real task, and delete at least one conventional section rather than stacking the canonical hero→features→about→testimonials→stats→CTA→footer.
- **WHY:** The canonical stack is the median of every template; a visitor who has seen five recognises the sixth and infers no thinking occurred (`ANTI_AI_SLOP.md` A-05; `EXPERIENCE_SIGNATURE_SYSTEM.md` §6).
- **WHEN TO USE:** Always; order by user need (a hungry visitor gets the menu first).
- **WHEN NOT TO USE:** Never — but a conventional order may genuinely serve the task for some retrieval sites (R-SLOP-4 conditional).
- **GOOD EXAMPLE:** Several winners resolve to ONE continuous section, not seven stacked (`AWWWARDS_PATTERN_LIBRARY.md` §2, #4/#6).
- **BAD EXAMPLE:** All of {features, about, testimonials, stats, cta} present in canonical order.
- **IMPLEMENTATION IMPLICATION:** Require ≥1 deleted and ≥1 out-of-order section, both justified; flag canonical-sequence match ≥70% `[CALIBRATE]`.
- **KNOWLEDGE CLASS:** K2 + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-05/R-SLOP-4 (2026-08-17); `AWWWARDS_PATTERN_LIBRARY.md` §2 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** structure, section-order, signature, restraint
- **APPLICABLE WORKERS:** Experience Architecture Worker, Creative Concept Worker, QA Worker

---

## 3. Restraint (Phase 7) — a positive discipline, not a style

Restraint is the discipline of **removing what does not carry meaning**, not the style of removing everything. It is encoded as `D39 RESTRAINT` in `KNOWLEDGE_TAXONOMY.md` (K2 with K4 teeth) and as the restraint contract in `EXPERIENCE_SIGNATURE_SYSTEM.md` §11. The inverse failure — stripping until nothing is communicated — is its own recognisable slop and is recorded as `R-SLOP-5` in `ANTI_AI_SLOP.md`.

### Decision rules

**WHEN TO ADD**
- Only when the addition carries meaning the page does not yet have.
- Only when it serves the signature or the visitor's verified task.
- Consult `D39` at every ADD edge; record the justification.
- Adding is the exception; the default is to compose with what already exists.

**WHEN TO REMOVE**
- Remove any element that competes with, rather than supports, the primary subject (HD-002).
- Remove conventional sections the business cannot fill with real, verified content (testimonials without real reviews; stats always, unless verified — `ANTI_AI_SLOP.md` A-07).
- Remove decorative effects that depict nothing (particles, gradients, glass — A-02/A-03/A-10).
- Removing is recorded as a deliverable: the "what we refused" list is evidence a decision was made (R-PROP-2).

**WHEN TO SIMPLIFY**
- Collapse a set of equal cards into one item shown large with the rest as compact text.
- Replace a row of clones with an editorial list that has real internal hierarchy (A-04).
- Merge two sections that repeat one job.
- Use a table when content is comparative data — tables are honest and underrated.

### The single-answer case (the right kind of minimal)
The strongest restraint is sometimes the *whole* answer: **one photograph, one sentence, one interaction, much negative space, one subtle transition.** This is correct when the visitor's task is retrieval (a menu, a price, a timetable, a phone number) and the business has thin assets or a single fact that matters. It is not a failure — it is what a good studio does with thin material (`EXPERIENCE_SIGNATURE_SYSTEM.md` §8). It earns its restraint through *specificity and placement*, not through absence.

### The inverse failure (the wrong kind of minimal)
Stripping a page until it communicates nothing — "no gradients, no motion, no images, grey Helvetica" — is **not** restraint. It is a different, equally recognisable slop: it removes meaning along with decoration and produces a page that fails the hierarchy test (`ANTI_AI_SLOP.md` R-SLOP-5). Restraint removes the *meaning-free*, never the *meaningful*. A page with one real photograph, one confident sentence, and precise alignment is restrained; a page with nothing on it is empty.

### Operational check
Before delivery, apply both tests from `ANTI_AI_SLOP.md` §5: (1) **Transplant test** — could this page serve a different business by swapping logo and text? If yes, it is generic. (2) **Hierarchy test** — is the single most important thing visually the most important? If everything is equal weight, no decision was made.

## 4. Visual Psychology (Phase 10) — why compositions have impact

This section explains *why* the principles in §2 work, in terms of human perception and cognition. The framing is deliberate: these are descriptions of **how perception actually works**, offered so the system can compose with it — not techniques for bypassing a visitor's judgement. Understanding perception is not the same as manipulating users. A composition earns attention by being legible, ordered, and meaningful; it does not earn it by exploiting a weakness.

### Hierarchy
The eye is drawn first to whatever is largest, then to whatever is highest-contrast against its surroundings, then to what is uniquely coloured or weighted. Size > position > color > weight is the effective priority order (`Design_Intelligence_Foundation.md` UX-03). A composition with no hierarchy asks the eye to choose and the visitor chooses to leave. Hierarchy is therefore not ornament — it is the page telling the visitor where to look first.

### Contrast
Contrast is the mechanism of separation: two things that differ in lightness, size, or weight are perceived as distinct; two things that do not are perceived as one undifferentiated mass. Contrast creates *figure and ground*. It is also a K1 floor — low-contrast "elegant" light-grey-on-white is an accessibility failure, not a style (`Design_Intelligence_Foundation.md` C-03).

### Scale
Extreme scale contrast (display many times the body) creates instant tension and editorial confidence because the ratio itself reads as a decision. The brain reads a 7× jump as *intent*, a 1.5× jump as *coincidence*. Winners exploit this; templates flatten it (`AWWWARDS_PATTERN_LIBRARY.md` §2.2).

### Proximity
Elements placed close together are perceived as belonging to one group (Gestalt law of proximity). Proximity does the work a border or a background does — group what belongs together tightly, and the relationship is understood without a rule line. This is why tight grouping beats boxes.

### Repetition
Repeated elements are perceived as a system (Gestalt law of similarity). A consistent type scale, spacing scale, and component behaviour reads as *intentionality*; inconsistency reads as *assembly*. Repetition is the cheapest signal of craft, and its absence is the cheapest signal of slop.

### Rhythm
The eye expects and enjoys phrasing — compression and expansion over time/space — the way the ear expects phrasing in speech. Uniform spacing is monotonous and registers as machine-made; deliberate variation registers as a human hand (HD-007; `ANTI_AI_SLOP.md` A-12).

### Whitespace
Empty space is not "nothing" to the perception system — it is a figure-shaping force. Generous, deliberately placed whitespace increases the perceived importance of what remains and reduces cognitive load by isolating the focal element from noise (HD-027).

### Color
Color carries meaning faster than text: warm advances, cool recedes, a single saturated hue against neutrals becomes a beacon. But color is the *weakest* hierarchy tool (it fails color-blind users and low-light contexts), so it must reinforce, never substitute for, size and weight (`Design_Intelligence_Foundation.md` T-05, C-02).

### Movement
The visual system is wired to detect motion — it is evolutionarily prior to detail vision. This is why decorative motion steals attention from content (HD-011; `ANTI_AI_SLOP.md` A-10) and why *purposeful* motion (a state changing, a reveal tied to meaning) is so effective: it directs the ancient attention system toward something that matters.

### Anticipation
A well-composed page sets up what comes next — a cue at the end of one section that primes the start of the next. Anticipation reduces the surprise-cost of scrolling and is the psychological basis of good scroll choreography (HD-016).

### Novelty
The brain allocates more attention to the unexpected (the odd-one-out). One justified novelty holds attention; many competing novelties cancel each other and register as noise (HD-022). Novelty must be coherent with the concept to be perceived as *interesting* rather than *broken*.

### Recognition
Familiar patterns (a wordmark top-left, a CTA that looks clickable) are processed with near-zero effort. Breaking recognition costs attention; it is justified only when the break serves the signature. Novelty navigation must pass the UX floor before it is allowed to be novel (`KNOWLEDGE_TAXONOMY.md` D20/D21).

### Focus
Attention is a single spotlight, not a floodlight. A composition that demands focus on one thing at a time is legible; one that demands simultaneous focus on five equal things is unreadable. This is the perceptual root of "one primary action per view" (`Design_Intelligence_Foundation.md` UX-04).

### Cognitive load
Every element the eye must parse is a tax on working memory. Minimalism is not aesthetic — it is load management (HD-008; `Design_Intelligence_Foundation.md` P-08). The goal is the lowest load consistent with communicating what matters, which is exactly why restraint (§3) and hierarchy (§2) are perceptual necessities, not tastes.

---

### HD-031 — Surfaces: prefer flat, palette-driven color
- **PRINCIPLE:** Use flat surfaces with a strict 2–4 color palette, each color assigned a defined role, rather than reaching for gradients to fill space.
- **WHY:** Gradients are the cheapest way to fake "designed"; winners cluster at 2–9 palette entries, often 2–4, several at 0 background colors (one flat surface) (`ANTI_AI_SLOP.md` A-02; `AWWWARDS_PATTERN_LIBRARY.md` §2.3).
- **WHEN TO USE:** Always; depth, when wanted, comes from real light or one subtle tonal shift.
- **WHEN NOT TO USE:** When a gradient genuinely depicts something (light falling, a material) and is justified.
- **GOOD EXAMPLE:** Flat off-white base + ink + one accent, each with a job.
- **BAD EXAMPLE:** Gradient background + gradient text + gradient border + gradient button.
- **IMPLEMENTATION IMPLICATION:** Flag > 3 gradient occurrences `[CALIBRATE]`; any gradient must name its depicted source.
- **KNOWLEDGE CLASS:** K2 + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-02 (2026-08-17); `AWWWARDS_PATTERN_LIBRARY.md` §2.3 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** surfaces, gradient, palette, restraint
- **APPLICABLE WORKERS:** Art Direction Worker, Color Worker, QA Worker

### HD-032 — Layering: separate with tone, not blur
- **PRINCIPLE:** Separate overlapping layers with a different flat surface tone, a hairline rule, or real spacing rather than with backdrop blur over nothing.
- **WHY:** Glassmorphism with no layer behind it is slop and frequently destroys contrast; honest tools convey separation (`ANTI_AI_SLOP.md` A-03).
- **WHEN TO USE:** Only where a real spatial reason exists (sticky bar over moving content, modal above a scene).
- **WHEN NOT TO USE:** On a card sitting on a flat background — there is nothing to see through.
- **GOOD EXAMPLE:** A hairline rule and a tonal shift between a sticky bar and content.
- **BAD EXAMPLE:** `backdrop-filter: blur()` on a translucent card over a solid color.
- **IMPLEMENTATION IMPLICATION:** `backdrop-filter` over a solid ancestor background is a near-perfect unmotivated-glass detector `[CALIBRATE]`.
- **KNOWLEDGE CLASS:** K1 + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-03 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** layering, glassmorphism, contrast, hierarchy
- **APPLICABLE WORKERS:** Art Direction Worker, Frontend Worker, QA Worker

### HD-033 — Trust: named specifics beat badge walls
- **PRINCIPLE:** Convey credibility through named, verifiable specifics — a licence number, a named practitioner, a real client — rather than through badge pills.
- **WHY:** Real credibility comes from named specifics; badges without verifiable content are a literal marker of machine authorship (`ANTI_AI_SLOP.md` A-06; `Design_Intelligence_Foundation.md` CV-05).
- **WHEN TO USE:** Always; prioritize design quality + visible security + real reviews.
- **WHEN NOT TO USE:** Never — but a verified, decision-relevant fact may be written as a sentence with a source.
- **GOOD EXAMPLE:** A named practitioner with a verifiable registration number.
- **BAD EXAMPLE:** "✨ Trusted by 500+ teams" pill.
- **IMPLEMENTATION IMPLICATION:** Permit a badge only when it encodes a verified fact that cannot be better expressed as text; ban decorative badge iconography.
- **KNOWLEDGE CLASS:** K1 (truth) + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-06 (2026-08-17); `Design_Intelligence_Foundation.md` CV-05 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** trust, badges, specifics, credibility
- **APPLICABLE WORKERS:** Content Worker, Business Understanding Worker, QA Worker

### HD-034 — Statistics: prohibit unverified numbers
- **PRINCIPLE:** Exclude any statistic that is not a verified fact, and replace it with one real, sourced number or a specific named detail.
- **WHY:** Invented "500+ Happy Clients / 98% Satisfaction" is a truth violation and a legal/reputational injury; it is trivially detectable (`ANTI_AI_SLOP.md` A-07; `TRUTH_AND_EVIDENCE.md` F-15).
- **WHEN TO USE:** Only when a number traces to a claim id in the evidence dossier.
- **WHEN NOT TO USE:** Always, absent verification — the stats section does not exist.
- **GOOD EXAMPLE:** One real, dated project quoted with attribution.
- **BAD EXAMPLE:** A four-column counter row of round, pleasing, unverifiable numbers.
- **IMPLEMENTATION IMPLICATION:** This should be a **blocking gate**, reusing the forbidden-assumption machinery in `lib/forge/anti-ai-gate.ts`.
- **KNOWLEDGE CLASS:** K1 (truth) + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-07 (2026-08-17); `TRUTH_AND_EVIDENCE.md` F-15 (referenced).
- **CONFIDENCE:** High
- **TAGS:** statistics, truth, verification, gate
- **APPLICABLE WORKERS:** Content Worker, QA Worker, Grounding Worker

### HD-035 — Psychology: order by size then contrast
- **PRINCIPLE:** Establish visual hierarchy by making the primary element largest and highest-contrast against its ground, so perception naturally lands there first.
- **WHY:** Size and contrast are the two strongest, most universal attention cues and work regardless of color vision (`Design_Intelligence_Foundation.md` UX-03).
- **WHEN TO USE:** Every composition.
- **WHEN NOT TO USE:** Never.
- **GOOD EXAMPLE:** A 130px wordmark on near-black with one lime CTA.
- **BAD EXAMPLE:** Equal-size, equal-contrast elements competing for the eye.
- **IMPLEMENTATION IMPLICATION:** Priority order size > position > color > weight; one focal point per viewport (HD-006).
- **KNOWLEDGE CLASS:** K1 (perception)
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` UX-03 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** visual-psychology, hierarchy, contrast, attention
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker

### HD-036 — Psychology: use contrast to separate figure from ground
- **PRINCIPLE:** Create sufficient lightness and weight contrast between a subject and its background so the subject reads as figure rather than blending into the ground.
- **WHY:** Without contrast the eye cannot separate figure from ground, and the message dissolves into noise (§4 Contrast).
- **WHEN TO USE:** Every text/element over any surface.
- **WHEN NOT TO USE:** Never — but contrast must be real, not merely "elegant" low-contrast.
- **GOOD EXAMPLE:** Ink text on a light paper base at ≥4.5:1.
- **BAD EXAMPLE:** Light-grey text on white "for elegance" (K1 failure).
- **IMPLEMENTATION IMPLICATION:** Contrast AA is a hard gate: body ≥4.5:1, large ≥3:1, UI ≥3:1 (C-03).
- **KNOWLEDGE CLASS:** K1
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` C-03 (2026-08-11); WCAG 1.4.3.
- **CONFIDENCE:** High
- **TAGS:** visual-psychology, contrast, figure-ground, accessibility
- **APPLICABLE WORKERS:** Art Direction Worker, Accessibility QA Worker

### HD-037 — Psychology: exploit scale contrast for tension
- **PRINCIPLE:** Set the display size at a large multiple of the body size to create editorial tension that the brain reads as a deliberate decision.
- **WHY:** A large ratio reads as intent; a small ratio reads as coincidence (§4 Scale; `AWWWARDS_PATTERN_LIBRARY.md` §2.2).
- **WHEN TO USE:** Editorial/premium contexts and any brand wanting impact.
- **WHEN NOT TO USE:** Dense-data UIs needing uniform legibility.
- **GOOD EXAMPLE:** 117px over 16px (~7×).
- **BAD EXAMPLE:** 44px over 16px at the same weight.
- **IMPLEMENTATION IMPLICATION:** Body ≥16px floor; display via clamp() bounded; ratio chosen within bounds (HD-004).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.2 (2026-08-11); `Design_Intelligence_Foundation.md` T-01 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** visual-psychology, scale, tension, typography
- **APPLICABLE WORKERS:** Typography Worker, Art Direction Worker

### HD-038 — Psychology: group by proximity, not by boxes
- **PRINCIPLE:** Place related elements close together so proximity alone signals their relationship, rather than enclosing everything in bordered boxes.
- **WHY:** Proximity is a Gestalt grouping cue that communicates relationship without decoration; boxes add load (§4 Proximity; `Design_Intelligence_Foundation.md` P-08).
- **WHEN TO USE:** Any set of related items.
- **WHEN NOT TO USE:** When items are genuinely distinct and must be kept separate.
- **GOOD EXAMPLE:** A label, value, and unit tightly grouped with no surrounding box.
- **BAD EXAMPLE:** Every related item wrapped in its own bordered card.
- **IMPLEMENTATION IMPLICATION:** Prefer spacing/grouping over borders; borders reserved for true separation.
- **KNOWLEDGE CLASS:** K1 (perception) + K2
- **SOURCE + SOURCE DATE:** Gestalt (proximity); `Design_Intelligence_Foundation.md` P-08 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** visual-psychology, proximity, grouping, whitespace
- **APPLICABLE WORKERS:** Experience Architecture Worker, Art Direction Worker

### HD-039 — Psychology: repeat to signal system
- **PRINCIPLE:** Repeat the same type scale, spacing scale, and component behaviour across the site so consistency reads as intentionality rather than assembly.
- **WHY:** Repetition is perceived as a system (Gestalt similarity); inconsistency reads as assembly and is the cheapest slop signal (§4 Repetition; `Design_Intelligence_Foundation.md` P-04).
- **WHEN TO USE:** Always; one scale, one system.
- **WHEN NOT TO USE:** Never — but repetition coexists with deliberate breakouts (HD-009).
- **GOOD EXAMPLE:** One spacing scale (8px base) used everywhere, with varied selection (HD-007).
- **BAD EXAMPLE:** A different margin value chosen per section with no system.
- **IMPLEMENTATION IMPLICATION:** Design tokens enforce one scale; flag values not drawn from the scale (chaos) and flag zero variance (metronome).
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` P-04/G-02 (2026-08-11); `ANTI_AI_SLOP.md` A-12 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** visual-psychology, repetition, consistency, system
- **APPLICABLE WORKERS:** Design System Worker, Frontend Worker, QA Worker

### HD-040 — Psychology: phrase the page with rhythm
- **PRINCIPLE:** Vary compression and expansion across the page so its phrasing rises and falls, mirroring how the eye expects rhythm in any sequence.
- **WHY:** Uniform spacing is monotonous and registers as machine-made; deliberate variation registers as a human hand (§4 Rhythm; `ANTI_AI_SLOP.md` A-12).
- **WHEN TO USE:** Always, by selecting from one consistent spacing scale.
- **WHEN NOT TO USE:** Never.
- **GOOD EXAMPLE:** A tight caption under a large image, then a large silence before a statement.
- **BAD EXAMPLE:** Every section one viewport tall with identical padding.
- **IMPLEMENTATION IMPLICATION:** Coefficient of variation of section padding below ~0.15 is a defect `[CALIBRATE]`; require ≥1 compressed and ≥1 expanded section.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-12 (2026-08-17); `Design_Intelligence_Foundation.md` G-03 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** visual-psychology, rhythm, pacing, variation
- **APPLICABLE WORKERS:** Experience Architecture Worker, Frontend Worker, QA Worker

### HD-041 — Constraint: fight the median with explicit limits
- **PRINCIPLE:** Impose explicit constraints — a real photograph that exists, a fixed character count, a banned hue — so the output is forced away from the statistical centre of training data.
- **WHY:** A model asked for "a beautiful website" produces the training median (dark hero, gradient, glass card, 3-col grid); constraints are the only reliable antidote (`ANTI_AI_SLOP.md` §1).
- **WHEN TO USE:** At every creative decision; constraints come from the verified dossier.
- **WHEN NOT TO USE:** Never — absence of constraint is the generative cause of slop.
- **GOOD EXAMPLE:** "Only the 27 real images we have; no others may appear."
- **BAD EXAMPLE:** An unconstrained "make it look good" brief.
- **IMPLEMENTATION IMPLICATION:** The dossier's UNKNOWNs are prohibitions (R-UNK-1); prohibitions narrow the search space productively.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` §1 (2026-08-17); `EXPERIENCE_SIGNATURE_SYSTEM.md` §3 Step 1 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** constraint, differentiation, slop-mechanism, focus
- **APPLICABLE WORKERS:** Creative Concept Worker, All creative workers

### HD-042 — Omission: record what was refused
- **PRINCIPLE:** Record the list of conventional elements deliberately omitted, because omission is a deliverable that proves a decision was made.
- **WHY:** "Everything included" means nothing was meant; the refused list is the clearest evidence of design intent (`EXPERIENCE_SIGNATURE_SYSTEM.md` R-PROP-2; `ANTI_AI_SLOP.md` A-05).
- **WHEN TO USE:** Always, at delivery.
- **WHEN NOT TO USE:** Never.
- **GOOD EXAMPLE:** "No testimonials (no real ones); no stats (unverified); no badge."
- **BAD EXAMPLE:** Every canonical section present, none justified.
- **IMPLEMENTATION IMPLICATION:** The signature contract's FORBIDS list is the natural feed (§11); report it to the human.
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `EXPERIENCE_SIGNATURE_SYSTEM.md` R-PROP-2/§11 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** omission, restraint, intent, deliverable
- **APPLICABLE WORKERS:** Creative Concept Worker, Experience Architecture Worker, QA Worker

### HD-043 — Signature vs trend: the idea decides
- **PRINCIPLE:** Let the experience signature decide what appears, and admit any current trend only when the signature explicitly invites it.
- **WHY:** Trends decorate; the signature decides. Copying trends blindly produces template-looking sites (`Design_Intelligence_Foundation.md` doctrine 5; `EXPERIENCE_SIGNATURE_SYSTEM.md` R-PROP-3).
- **WHEN TO USE:** Always; K3 items are optional decoration, never organizing principle.
- **WHEN NOT TO USE:** A project may ship with zero K3 and still be excellent (`KNOWLEDGE_TAXONOMY.md` class doctrine).
- **GOOD EXAMPLE:** A 2026 idiom used only because the signature's FORCES list permits it.
- **BAD EXAMPLE:** A trend applied because it is current, overriding the concept.
- **IMPLEMENTATION IMPLICATION:** A K3 item entering without signature invitation is a defect.
- **KNOWLEDGE CLASS:** K2 + K3
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` §1 doctrine 5 (2026-08-11); `EXPERIENCE_SIGNATURE_SYSTEM.md` R-PROP-3 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** signature, trend, k3, decoration
- **APPLICABLE WORKERS:** Creative Concept Worker, Experience Architecture Worker

### HD-044 — Demonstration: show, do not claim
- **PRINCIPLE:** Demonstrate quality with a real photograph or a verified fact rather than asserting it with a premium adjective.
- **WHY:** "Bespoke", "artisanal", "handcrafted" are claims, often unverified, that read as insisting on a quality rather than demonstrating it; the plainest fact stated once outperforms (`ANTI_AI_SLOP.md` A-16).
- **WHEN TO USE:** Always; replace every superlative with evidence.
- **WHEN NOT TO USE:** Never.
- **GOOD EXAMPLE:** A photograph of the real workshop beats "artisanal."
- **BAD EXAMPLE:** "Meticulously handcrafted with passion."
- **IMPLEMENTATION IMPLICATION:** Quality claims require a verified claim id; otherwise delete (overlaps `TRUTH_AND_EVIDENCE.md`).
- **KNOWLEDGE CLASS:** K1 (truth) + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` A-16 (2026-08-17); `TRUTH_AND_EVIDENCE.md` (referenced).
- **CONFIDENCE:** High
- **TAGS:** demonstration, claims, evidence, adjectives
- **APPLICABLE WORKERS:** Content Worker, Art Direction Worker, QA Worker

### HD-045 — Differentiation: survive the transplant test
- **PRINCIPLE:** Ensure the page could not serve a different business by swapping the logo and the text, so distinctiveness is verified rather than assumed.
- **WHY:** The transplant test catches most generic output; a page that passes it for any competitor is interchangeable (`ANTI_AI_SLOP.md` §5; `EXPERIENCE_SIGNATURE_SYSTEM.md` §1).
- **WHEN TO USE:** At delivery, on every page.
- **WHEN NOT TO USE:** Never.
- **GOOD EXAMPLE:** A first screen containing one thing that could only belong to this business (real price, real product name, owner's sentence).
- **BAD EXAMPLE:** A centred headline + 2 buttons over a gradient, logo-swappable.
- **IMPLEMENTATION IMPLICATION:** Combine with the hierarchy test; both must pass or the page fails regardless of Lighthouse score.
- **KNOWLEDGE CLASS:** K2 + K4
- **SOURCE + SOURCE DATE:** `ANTI_AI_SLOP.md` §5 (2026-08-17); `EXPERIENCE_SIGNATURE_SYSTEM.md` §1 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** differentiation, transplant-test, distinctiveness, generic
- **APPLICABLE WORKERS:** QA Worker, Creative Concept Worker

### HD-046 — Grid: discipline under freedom
- **PRINCIPLE:** Keep a consistent underlying grid and break it only with intent, so freedom sits on a foundation of order rather than on chaos.
- **WHY:** Winners show grid discipline *under* freedom — asymmetry happens within a grid, not without one (`AWWWARDS_PATTERN_LIBRARY.md` §2.7; `Design_Intelligence_Foundation.md` G-04).
- **WHEN TO USE:** Always; 12-col base is the default.
- **WHEN NOT TO USE:** Never — but breakouts are allowed only as defined variants.
- **GOOD EXAMPLE:** 12-col grid with one full-bleed offset block.
- **BAD EXAMPLE:** Free-floating elements with no grid at all.
- **IMPLEMENTATION IMPLICATION:** Base grid deterministic; breakouts AI-directed and accessibility-safe (HD-009).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `AWWWARDS_PATTERN_LIBRARY.md` §2.7 (2026-08-11); `Design_Intelligence_Foundation.md` G-04 (2026-08-11).
- **CONFIDENCE:** High
- **TAGS:** grid, discipline, asymmetry, structure
- **APPLICABLE WORKERS:** Experience Architecture Worker, Frontend Worker

### HD-047 — Primary action: one dominant action per view
- **PRINCIPLE:** Give each viewport exactly one dominant action and reduce all secondary actions to text links, so attention is not divided.
- **WHY:** Choice overload reduces conversion; repetition of the same button destroys its authority (§4 Focus; `ANTI_AI_SLOP.md` A-11; `Design_Intelligence_Foundation.md` UX-04).
- **WHEN TO USE:** All conversion and content views.
- **WHEN NOT TO USE:** Never — but a real phone call may be the "CTA" for local businesses (then the header holds the number, not a competing button).
- **GOOD EXAMPLE:** One lime CTA after the strongest proof, secondary actions as links.
- **BAD EXAMPLE:** Identical "Get Started" in header, hero, every section, footer.
- **IMPLEMENTATION IMPLICATION:** Flag > 2 identical primary-button texts `[CALIBRATE]`; ratio primary:secondary above 1:1 is a defect.
- **KNOWLEDGE CLASS:** K1 + K2
- **SOURCE + SOURCE DATE:** `Design_Intelligence_Foundation.md` UX-04/CV-01 (2026-08-11); `ANTI_AI_SLOP.md` A-11 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** primary-action, cta, focus, conversion
- **APPLICABLE WORKERS:** Experience Architecture Worker, Conversion Worker, QA Worker

### HD-048 — Settling: the signature resolves arguments
- **PRINCIPLE:** Use the experience signature as the criterion that rejects candidate compositions, so design arguments are settled by the concept rather than by taste.
- **WHY:** An idea that cannot reject anything is decoration; a real signature settles arguments and is the operational test of validity (`EXPERIENCE_SIGNATURE_SYSTEM.md` §1; §7).
- **WHEN TO USE:** At every fork between candidate compositions.
- **WHEN NOT TO USE:** When no defensible signature exists — then disciplined editorial clarity settles it (§8).
- **GOOD EXAMPLE:** "This hero contradicts the signature's FORBIDS list; reject it."
- **BAD EXAMPLE:** "I think the gradient version looks nicer."
- **IMPLEMENTATION IMPLICATION:** The signature's FORCES/FORBIDS list is the recorded reasoning that overrides detection signals (R-SLOP-2).
- **KNOWLEDGE CLASS:** K2
- **SOURCE + SOURCE DATE:** `EXPERIENCE_SIGNATURE_SYSTEM.md` §1/§7/R-SLOP-2 (2026-08-17).
- **CONFIDENCE:** High
- **TAGS:** signature, decision, justification, concept
- **APPLICABLE WORKERS:** Creative Concept Worker, Experience Architecture Worker, QA Worker

---

## 5. Cross-reference index (do not duplicate; link, don't copy)

- **Sourced UX/premium/trend registry (P-01…, buckets, Section 18 sources):** `docs/Design_Intelligence_Foundation.md`.
- **25-site DOM/CSS teardown evidence (h1 100–150px, palettes 2–9, typographic heroes, one continuous section):** `docs/AWWWARDS_PATTERN_LIBRARY.md`.
- **K4 anti-patterns (generic hero, gradients, glass, cards, sections, badges, stats, copy, radius, particles, animation, dark-luxury, serif+sans, premium language, rhythm, stock, 3D, cursor — A-01…A-20; R-SLOP-1…5):** `docs/knowledge/ANTI_AI_SLOP.md`.
- **Signature discovery, propagation, restraint contract, fallback ladder, industry priors (§1–§11):** `docs/knowledge/EXPERIENCE_SIGNATURE_SYSTEM.md`.
- **K1–K4 classes, ACTIVATES_WHEN / SUPPRESSED_WHEN, domain map (D01–D40):** `docs/knowledge/KNOWLEDGE_TAXONOMY.md`.
- **Truth & evidence obligations (F-01…F-26), capability triggers, performance budget:** referenced; see `TRUTH_AND_EVIDENCE.md` and `WEBSITE_CAPABILITY_KNOWLEDGE.md` / `PERFORMANCE_KNOWLEDGE.md`.

### Honesty recap
- **Verified:** the four-tier table and all Awwwards-grounded blocks rest on the 25-site teardown (2026-08-11) and the sourced principle registry. Calibration thresholds marked `[CALIBRATE]` are engineering judgement, not cited standards.
- **Synthesis:** the visual-psychology section (§4) synthesises stable Gestalt / NN/g / WCAG principles; it is framed as understanding perception, never as user manipulation.
- **Not implemented:** this document changes no code and no other file, per the task constraint.

### Block count
48 principle blocks (HD-001 … HD-048), spanning all 23 required axes: concept, composition, art direction, typography, storytelling, visual hierarchy, rhythm, restraint, asymmetry, interaction, motion, transitions, loading, navigation, cursor, scroll, responsive behavior, image treatment, visual metaphor, brand specificity, originality, surprise, emotional response.
