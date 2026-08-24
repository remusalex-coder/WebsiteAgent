# AWWARDS RESEARCH — Library of Decisions (Phase 4)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify WebsiteAgent.** This document converts mechanisms observed in Awwwards-winning work into a *queryable library of decisions* a worker can consult at design-decision time.
**Author role:** Research Director
**Date:** 2026-08-17
**Companion doc (evidence base):** `docs/AWWWARDS_PATTERN_LIBRARY.md` — the live DOM/CSS teardown of 25 real Awwwards-winning commercial sites (sites #1–#25, patterns P-001–P-018). Every SOURCE FACT below is anchored there.
**Companion doc (classification):** `docs/knowledge/KNOWLEDGE_TAXONOMY.md` — the K1–K4 knowledge-class system used in the `Knowledge class` field.

---

## 0. Honesty note & provenance

- **SOURCE FACT** = a claim directly supported by the 25-site teardown in `docs/AWWWARDS_PATTERN_LIBRARY.md` (extracted DOM/CSS: fonts, type sizes, palettes, hero-media type, nav style, section counts).
- **RESEARCH SYNTHESIS** = a pattern generalized from those facts by me, this session, following the taxonomy's activation logic.
- **YOUR INFERENCE** = a judgment about transfer/risk for an untested business type, not directly evidenced by the 25.
- The teardown itself was built with **vision unavailable**; its facts are DOM/CSS-derived and reproducible, not screenshots. I inherit that constraint: **no site, award, font, or layout is invented here.** Where a dimension (loader, sound, cursor, 3D) was *not* probed in the 25, the relevant patterns are labeled RESEARCH SYNTHESIS / YOUR INFERENCE and explicitly state the teardown lacks evidence.
- This is **Phase 4** (decision library). It does not add code or assets. It re-encodes P-001–P-018 and extends them with patterns covering the full interaction surface a worker must decide on.

## Knowledge-class legend (from KNOWLEDGE_TAXONOMY.md §2)
- **K1 — Invariant:** accessibility/cognition law, protocol, spec. Gate; violation = build failure.
- **K2 — Craft:** how skilled studios compose/pace/type-set/restrain. Strong default; overridable with recorded reason.
- **K3 — Trend:** current 2025/2026 surface idiom. Decoration only; absence is never a defect.
- **K4 — Anti-knowledge:** looks like quality, is not. Prohibitive slop signal.

---

## 1. Pattern library (decision entries)

Format per entry: **Pattern / Purpose / Psychological effect / When to use / When not to use / Technical approach / Risk / Business types / Knowledge class / Evidence.**

### P-001 — Oversized Typographic Hero (no photo)
- **Pattern:** One giant headline (80–150px) on a neutral base; the words are the visual. (Reuse of library P-001.)
- **Purpose:** Maximum brand-statement impact; fastest LCP; pure craft signal.
- **Psychological effect:** Confidence and authority through restraint; the eye has one thing to read and remembers it.
- **When to use:** Verbal identity is the product (studios, artists, manifestos, luxury/positioning brands).
- **When not to use:** Businesses that must show the real thing/people (mechanic, dentist, restaurant, salon).
- **Technical approach:** `clamp()` display sizing; single focal line; AA contrast; body ≥16px; min body 16px floor.
- **Risk:** "Big text on black" cliché (K4 if undifferentiated). Differentiate via type choice + accent.
- **Business types:** architect, photographer, law (positioning), hotel (brand), artist.
- **Knowledge class:** K2 (craft) with K1 legibility floor (min size, contrast).
- **Evidence (SOURCE FACT):** library P-001; #1 Mosby Files (117px uppercase, #191919), #4 Nexola (130px), #16 Van Morrison (150px uppercase), #24 Serotoninn (100px uppercase).

### P-002 — Cinematic Video/Canvas Hero
- **Pattern:** Full-bleed muted video or generative canvas behind/around a wordmark. (Reuse of library P-002.)
- **Purpose:** Immersive, premium, conveys motion/energy of the business.
- **Psychological effect:** Presence and atmosphere; signals "something is happening here."
- **When to use:** Sensory/experience businesses with real footage or generative capability.
- **When not to use:** Utilitarian/local-trust contexts (mechanic, dentist, law) where clarity > spectacle.
- **Technical approach:** Poster frame + lazy/optimized load; `prefers-reduced-motion` static fallback; contrast scrim for text; **no autoplay sound** (K1 spec).
- **Risk:** HIGH template risk if stock video reused (K4). Must be original footage.
- **Business types:** hotel, restaurant, photographer, fitness, artist, architect (process).
- **Knowledge class:** K2 + K1 gates (reduced-motion, LCP, no-autoplay-sound, scrim contrast).
- **Evidence (SOURCE FACT):** library P-002; #4 Nexola (full-bleed video, #0F0F0F + lime #B3FF00), #5 Studio Modular (video + multi-hue), #16 Van Morrison (video + orange #F79E4C), #15 Meinhard Taxer (video bg), #24 Serotoninn (video).

### P-003 — Extreme Type-Scale Contrast
- **Pattern:** Display 4–9× body; tight body (12–16px), giant headings. (Reuse of library P-003.)
- **Purpose:** Instant hierarchy and editorial tension.
- **Psychological effect:** Drama and editorial sophistication; the jump itself reads as "designed."
- **When to use:** Any brand wanting a premium/editorial feel.
- **When not to use:** Dense-data/utility UIs needing uniform legibility (internal tools).
- **Technical approach:** `clamp()` display cap by viewport; body ≥16px floor; bounded ratio.
- **Risk:** LOW — it is a principle, not a look.
- **Business types:** all (universal premium lever).
- **Knowledge class:** K2 with K1 min-size floor.
- **Evidence (SOURCE FACT):** library P-003; ratios in teardown: #1 117/16, #4 130/12, #16 150/26, #24 100/25, #14 85/14.

### P-004 — Restrained Neutral Base + One Hot Accent
- **Pattern:** Off-white or near-black base; a single vivid accent used sparingly. (Reuse of library P-004.)
- **Purpose:** Confidence; guides the eye; avoids chaos; timeless.
- **Psychological effect:** Calm authority; the one accent becomes memorable by scarcity.
- **When to use:** Any business; strongest for premium/trust.
- **When not to use:** None (universal) — but accent hue must be character-derived, not industry cliché.
- **Technical approach:** ≤3 active hues; accent reserved for primary action/active state; AA contrast.
- **Risk:** MEDIUM — "dark + one accent" is itself a trend (K3); vary base temperature + accent placement.
- **Business types:** all.
- **Knowledge class:** K2 + K1 contrast.
- **Evidence (SOURCE FACT):** library P-004; #4 Nexola (lime), #11 3e Étage (yellow #FFEE00), #9 Studio OL (red #FF0000), #16 Van Morrison (orange), #20 Dragonfly (tri-accent), #22 Crxtian (pink #EE83A7), #23 Alethia (lime #C6F19D).

### P-005 — Editorial Multi-Family Type System
- **Pattern:** 2–3 families with distinct roles (display serif + grotesk + mono). (Reuse of library P-005.)
- **Purpose:** Each family carries semantic weight; richer than one-font sites.
- **Psychological effect:** Layered voice; serif=heritage, mono=technical, grotesk=modern.
- **When to use:** Content/brand-rich sites wanting depth.
- **When not to use:** Micro-sites, quick-task flows.
- **Technical approach:** ≤3 families; each mapped to a role (display/body/mono); consistent weights.
- **Risk:** LOW if pairings are character-matched.
- **Business types:** architect, law, hotel, artist, agency.
- **Knowledge class:** K2.
- **Evidence (SOURCE FACT):** library P-005; #1 Mosby Files (Signifier+IBM Plex Mono+Founders Grotesk), #13 Normal Is Boring (Juana+Editorial New), #20 Dragonfly (FK Roman+NON Natural Mono+Times New Roman), #16 Van Morrison (Inria Serif+Oswald).

### P-006 — Signature Single-Accent Monochrome
- **Pattern:** Near-monochrome (paper/ink or dark) with ONE accent repeated as a brand mark. (Reuse of library P-006.)
- **Purpose:** Memorable; disciplined; premium restraint.
- **Psychological effect:** Brand recognition through repetition of one signal.
- **When to use:** Brands wanting a recognizable mark.
- **When not to use:** Businesses needing category color coding (multi-service with distinct offerings).
- **Technical approach:** Accent contrast AA; used ≥3 touchpoints (logo, CTA, link).
- **Risk:** MEDIUM.
- **Business types:** photographer, architect, boutique studio, law.
- **Knowledge class:** K2.
- **Evidence (SOURCE FACT):** library P-006; #9 Studio OL (single red #FF0000), #22 Crxtian (pink), #23 Alethia (lime), #6 Paysages (2-tone warm off-white).

### P-007 — Color-Coded Category System
- **Pattern:** Each service/category gets its own hue within a controlled set. (Reuse of library P-007.)
- **Purpose:** Communicates structure; scannable; ownable system.
- **Psychological effect:** Reduced cognitive load via consistent color-semantics.
- **When to use:** Businesses with 3–6 distinct offerings.
- **When not to use:** Single-offering businesses.
- **Technical approach:** Hues meet contrast on base; ≤6; semantic consistency.
- **Risk:** MEDIUM (can become "rainbow nav").
- **Business types:** agency, real-estate (listing types), fitness (classes), dentist (services), law (practice areas).
- **Knowledge class:** K2 + K1 contrast.
- **Evidence (SOURCE FACT):** library P-007; #5 Studio Modular (8-color category system), #23 Alethia (greens), #2 Revelatio (deep teal #003532 mono).

### P-008 — Asymmetric Editorial Grid with Breakouts
- **Pattern:** Content aligned to grid but with deliberate full-bleed/offset blocks breaking column rhythm. (Reuse of library P-008.)
- **Purpose:** Bespoke feel; avoids template symmetry.
- **Psychological effect:** Deliberate tension; "this was composed, not generated."
- **When to use:** Premium/editorial character.
- **When not to use:** Utilitarian booking/checkout flows (need predictable alignment).
- **Technical approach:** Base 12-col grid; breakouts only as defined variants; never breaks accessibility.
- **Risk:** MEDIUM.
- **Business types:** architect, photographer, hotel, artist.
- **Knowledge class:** K2.
- **Evidence (SOURCE FACT):** library P-008; grid discipline in teardown: #7 Alkares (12-col), #11 3e Étage (12-col), #12 Obscura (12-col), #20 Dragonfly (16-col), #23 Alethia (16-col).

### P-009 — Minimal Hero Nav (Logo + 1 CTA)
- **Pattern:** Above the fold shows only wordmark + single primary action; full nav deferred. (Reuse of library P-009.)
- **Purpose:** Focus; confidence; lets hero breathe.
- **Psychological effect:** One clear next step; reduced choice anxiety.
- **When to use:** Brand/showcase sites with a strong single goal.
- **When not to use:** Local SMB needing immediate phone/address (mechanic, dentist, restaurant) — those need persistent contact (K1 accessibility: contact within 1 tap on mobile).
- **Technical approach:** Persistent contact accessible ≤1 tap on mobile (sticky bar or footer-reachable).
- **Risk:** LOW (but K1 contact-accessibility rule is mandatory for local-trust).
- **Business types:** photographer, artist, hotel, architect, boutique.
- **Knowledge class:** K2 + K1 (persistent contact accessibility).
- **Evidence (SOURCE FACT):** library P-009; #4 Nexola (logo + "Start Project" only), #11 3e Étage (3 links), #15 Taxer (minimal name + categories).

### P-010 — Segmented Audience Paths
- **Pattern:** Hero offers 2+ distinct entry points by audience. (Reuse of library P-010.)
- **Purpose:** Speaks directly; reduces bounce for multi-audience.
- **Psychological effect:** "This is for me" recognition; lowers friction per segment.
- **When to use:** Businesses serving 2+ distinct audiences.
- **When not to use:** Single-audience businesses.
- **Technical approach:** Each path has its own clear CTA + destination.
- **Risk:** LOW.
- **Business types:** real-estate (buyers/sellers), law (individuals/business), agency (clients/talent), fitness (classes/membership).
- **Knowledge class:** K2.
- **Evidence (SOURCE FACT):** library P-010; #2 Revelatio ("entrepreneuses / responsables communication"), #3 Vectr ("Apply / Request Crews" dual CTA).
### P-011 — Poster-Scale Typographic Moment
- **Pattern:** One element at absurd scale (e.g., 247px). (Reuse of library P-011.)
- **Purpose:** Unforgettable focal point; art-directed.
- **Psychological effect:** Awe/shock; the scale itself is the message.
- **When to use:** Brands with a hero artifact/name/statement.
- **When not to use:** Trust-first utilitarian.
- **Technical approach:** `clamp()` so it never overflows mobile; maintain contrast.
- **Risk:** MEDIUM — can hurt mobile if not clamped.
- **Business types:** artist, photographer, architect, hotel (property name).
- **Knowledge class:** K2 + K1 (clamp, contrast).
- **Evidence (SOURCE FACT):** library P-011; #15 Meinhard Taxer (247px h2 poster), #16 Van Morrison (150px repeated name).

### P-012 — Imagery-Saturated Showcase
- **Pattern:** Very high image count, large art-directed photos. (Reuse of library P-012.)
- **Purpose:** The work *is* the proof; visual density signals productivity/portfolio.
- **Psychological effect:** "They do a lot of this" — credibility through volume + quality.
- **When to use:** Businesses whose output is visual.
- **When not to use:** Abstract/services with no visual output (some law, tax).
- **Technical approach:** Original-photo rule (no stock cliché); lazy-load; alt text (K1); consistent treatment.
- **Risk:** HIGH if stock (K4) — must be original.
- **Business types:** photographer, restaurant (food), hotel (rooms), real-estate, architect, fitness (results), nail salon, dentist (smiles).
- **Knowledge class:** K2 + K1 (alt text) + K4 (stock = slop).
- **Evidence (SOURCE FACT):** library P-012; #21 Hamza Tariq (296 imgs), #24 Serotoninn (295 imgs), #19 21 Hrs (166 imgs), #16 Van Morrison (56 imgs).

### P-013 — Tokenized Type System (Body/Mono/Heading)
- **Pattern:** CSS/design tokens name roles (fontBody/Mono/Heading). (Reuse of library P-013.)
- **Purpose:** Scalable, consistent, systematic cohesion — the mechanism behind premium.
- **Psychological effect:** None direct; this is infrastructure that makes every other pattern coherent.
- **When to use:** Any site (it is the floor, not a style).
- **When not to use:** None.
- **Technical approach:** REQUIRED tokens for type, color, space, radius.
- **Risk:** NONE (infrastructure).
- **Business types:** all.
- **Knowledge class:** K1 + K2 (system-level invariant + craft).
- **Evidence (SOURCE FACT):** library P-013; #14 Spur (fontBody/Mono/Heading tokens), #23 Alethia (Geist token stack).

### P-014 — Quiet Monochrome Understatement
- **Pattern:** 1–2 near-tones, tiny type, huge whitespace. (Reuse of library P-014.)
- **Purpose:** Restraint reads as confidence/luxury; lets content lead.
- **Psychological effect:** Calm, considered, high-end; absence of noise = signal of control.
- **When to use:** Heritage/craft/premium character.
- **When not to use:** Energetic/youth needing vibrancy (fitness, trend salon).
- **Technical approach:** Contrast AA even at low-contrast pairs; type min 16px.
- **Risk:** MEDIUM.
- **Business types:** architect, hotel, photographer, law, luxury salon.
- **Knowledge class:** K2.
- **Evidence (SOURCE FACT):** library P-014; #6 Paysages (sand/olive #E7E9D2, h2 12px, p 13px), #9 Studio OL (paper + single red), #1 Mosby (dark editorial).

### P-015 — Generative/Interactive Canvas Hero
- **Pattern:** WebGL/canvas reacting to pointer or data. (Reuse of library P-015.)
- **Purpose:** Tech-forward, ownable, "design-engineering" signal.
- **Psychological effect:** Novelty + competence; "they build, not just decorate."
- **When to use:** Tech/brand with engineering capability; data products.
- **When not to use:** Local SMBs without engineering capacity; performance-constrained.
- **Technical approach:** Reduced-motion + no-JS fallback (static frame); perf budget; accessible alt text.
- **Risk:** HIGH (becomes gimmick) — gate strictly.
- **Business types:** agency, tech product, Web3, architect (parametric).
- **Knowledge class:** K2 + K1 fallback + K4 (gimmick if purposeless).
- **Evidence (SOURCE FACT):** library P-015; #3 Vectr (canvas/WebGL blue, pointer-reactive), #14 Spur (canvas/WebGL map viz), #20 Dragonfly (canvas/WebGL tri-accent).

### P-016 — Cultural/Language Duality
- **Pattern:** JP/EN or multilingual toggle with culturally-distinct type. (Reuse of library P-016.)
- **Purpose:** Authenticity for dual-audience brands.
- **Psychological effect:** Respect/inclusion; "this brand is for both of us."
- **When to use:** Businesses serving 2 language/culture audiences.
- **When not to use:** Single-locale SMB.
- **Technical approach:** RTL/LTR support; `lang` attribute; per-culture type stack.
- **Risk:** LOW.
- **Business types:** hotel (tourists), real-estate (expats), import/export, restaurants.
- **Knowledge class:** K2 + K1 (lang attr, RTL/LTR).
- **Evidence (SOURCE FACT):** library P-016; #17 Izanami (JP/EN toggle, Helvetica Neue+Playfair+Cinzel+Shippori Mincho), #8 Fort Vega (language switch).

### P-017 — Content-Rich Product Nav (SaaS-style)
- **Pattern:** Top nav with Pricing/Login/Trial/Demo + many sections. (Reuse of library P-017.)
- **Purpose:** Supports consideration journeys; many entry points.
- **Psychological effect:** Comprehensiveness; "this product covers my needs."
- **When to use:** Businesses with deep content/offers.
- **When not to use:** One-page brand sites.
- **Technical approach:** Nav ≤7 top items; current-location indicator (K1 UX).
- **Risk:** LOW.
- **Business types:** agency (services), real-estate (listings), law (practice areas), fitness (plans).
- **Knowledge class:** K2 + K1 (navigability/UX floor).
- **Evidence (SOURCE FACT):** library P-017; #14 Spur (Pricing/Login/Free Trial/Get A Demo, 14 sections), #20 Dragonfly (7-item uppercase nav).

### P-018 — Event/Inventory Badge Counts
- **Pattern:** Nav shows live counts. (Reuse of library P-018.)
- **Purpose:** Signals activity/freshness; social proof.
- **Psychological effect:** "Things are happening" — urgency without false scarcity.
- **When to use:** Businesses with countable live inventory/events.
- **When not to use:** Static service businesses.
- **Technical approach:** Counts accurate & updated (K1 truthfulness); not fake scarcity.
- **Risk:** LOW.
- **Business types:** restaurant (specials), hotel (rooms), real-estate (listings), events, fitness (classes).
- **Knowledge class:** K2 + K1 (truthfulness — false counts are a defect).
- **Evidence (SOURCE FACT):** library P-018; #25 No Art ("Events [6]" badge), #22 Crxtian (availability indicator).

### P-019 — Pre-Entry Loading Sequence (Loader)
- **Pattern:** A branded intro/loader (counter, progress, reveal) before first content.
- **Purpose:** Sets tone; masks asset load; ritualizes entry.
- **Psychological effect:** Anticipation; frames the site as an "experience."
- **When to use:** Immersive brand/showcase sites where the wait is part of the art.
- **When not to use:** Conversion-critical local business, content/SEO sites, slow-network contexts (delays LCP = K1 performance defect).
- **Technical approach:** Cap loader to <1.5s; never block first paint of critical content; offer skip; respect reduced-motion.
- **Risk:** HIGH — easily becomes K4 friction; suppress on any site where speed is the product.
- **Business types:** artist, studio, Web3 brand, immersive product.
- **Knowledge class:** K3 (trend decoration) + K1 (LCP gate) + K4 if it blocks content.
- **Evidence:** RESEARCH SYNTHESIS / YOUR INFERENCE. The 25-site teardown did **not** probe loader behavior, so this is generalized Awwwards knowledge, not teardown fact. Treat as K3 candidate, not a documented pattern from the evidence base.

### P-020 — Opening Reveal Transition
- **Pattern:** First paint animates in — curtain wipe, scale/blur reveal, mask, or type unmask.
- **Purpose:** Signals craft; creates a deliberate "now we begin" beat.
- **Psychological effect:** Delight; framed entrance feels intentional and premium.
- **When to use:** Brand/showcase and editorial sites with a strong opening statement.
- **When not to use:** Utility/local-trust sites where instant content beats ceremony.
- **Technical approach:** CSS transform/opacity reveal; `prefers-reduced-motion` instant fallback; keep <800ms; no content hidden from AT.
- **Risk:** MEDIUM — K3 if overused; K4 if it delays readable content.
- **Business types:** studio, artist, hotel, architect, fashion.
- **Knowledge class:** K3 + K2 (craft timing) + K1 (reduced-motion, AT-visible).
- **Evidence:** RESEARCH SYNTHESIS. Teardown captured hero *composition* (type sizes, media) but not the entrance animation; inferred from the typographic-hero and video-hero prevalence (#1, #4, #16). Not a direct teardown fact.

### P-021 — Scroll-Triggered Choreography
- **Pattern:** Sections animate/assemble as they enter the viewport (pin, parallax, stagger, reveal-on-scroll).
- **Purpose:** Paces the narrative; rewards scrolling; builds momentum.
- **Psychological effect:** Agency/control; "the site responds to me."
- **When to use:** Story-driven or showcase sites with a clear sequence.
- **When not to use:** Retrieval-intent sites (user wants hours/book now) — narrative scroll is hostile (D06 SUPPRESSED_WHEN).
- **Technical approach:** IntersectionObserver; `prefers-reduced-motion` shows all content statically; throttle; never hide content from AT.
- **Risk:** MEDIUM — K4 if motion is pure announcement; gate on reduced-motion (K1).
- **Business types:** artist, hotel (experience), architect (process), agency, product with story.
- **Knowledge class:** K2 + K1 (reduced-motion override is non-negotiable).
- **Evidence:** RESEARCH SYNTHESIS from teardown structure — multi-section sites (#3 Vectr 6 sections, #14 Spur 14, #16 Van Morrison 7, #24 Serotoninn 7) imply scroll pacing; the *animation* itself is inference, not probed.

### P-022 — Section-to-Section Visual Transitions
- **Pattern:** Distinct visual "rooms" with hard or soft cuts between sections (color shifts, full-bleed swaps, morphing backgrounds).
- **Purpose:** Marks progression; prevents monotony; creates rhythm.
- **Psychological effect:** Journey feeling; each section feels like a new chapter.
- **When to use:** Content-rich sites with 4+ thematically distinct sections.
- **When not to use:** Single-topic micro-sites.
- **Technical approach:** Transition via CSS background/transform; maintain contrast across the cut; reduced-motion = crossfade or none.
- **Risk:** MEDIUM — K3 surface idiom.
- **Business types:** agency, hotel, product (multi-feature), artist.
- **Knowledge class:** K2 + K3.
- **Evidence:** RESEARCH SYNTHESIS. Teardown records palette/section counts (#14 Spur 14 sections, #20 Dragonfly 16-col, multi-hue) implying sectional variation; transition mechanics inferred.
### P-023 — Custom Cursor Interaction
- **Pattern:** Replaces the system cursor with a bespoke element that grows/labels/reacts on hover.
- **Purpose:** Heightens craft perception; adds a signature tactile layer.
- **Psychological effect:** Playfulness + premium "designed down to the pixel" feeling.
- **When to use:** Immersive brand/portfolio sites where delight is the product.
- **When not to use:** Any site needing fast task completion, accessibility-first, or touch-primary (cursor is meaningless on touch).
- **Technical approach:** `cursor: none` + JS follower; **always keep a real focus/keyboard path** (K1 affordance); never hide pointer from AT; disable on touch/reduced-motion.
- **Risk:** HIGH — K4 gimmick if purposeless; K1 defect if it breaks affordance.
- **Business types:** studio, artist, Web3 brand, fashion, photographer.
- **Knowledge class:** K3 + K1 (affordance/a11y floor) + K4 (purposeless = slop).
- **Evidence:** RESEARCH SYNTHESIS. The teardown's only pointer evidence is "WebGL pointer-reactive" for #3 Vectr — a *scene* reaction, not a custom cursor. A bespoke cursor is inferred general Awwwards idiom, not a teardown fact.

### P-024 — Hover-Reactive Elements
- **Pattern:** Links/images/cards respond to hover with scale, color shift, image swap, or reveal.
- **Purpose:** Confirms interactivity; adds life without committing to full motion.
- **Psychological effect:** Responsiveness reward; "this is alive."
- **When to use:** Almost any site with interactive elements.
- **When not to use:** Where hover state cannot be mirrored by focus (then it's a K1 a11y defect).
- **Technical approach:** CSS `:hover` + `:focus-visible` parity; transitions <300ms; respect reduced-motion.
- **Risk:** LOW — universal craft lever.
- **Business types:** all.
- **Knowledge class:** K2 + K1 (focus-visible parity).
- **Evidence:** RESEARCH SYNTHESIS from teardown interaction notes — #3 Vectr "WebGL pointer-reactive," #14 Spur interactive viz, #20 Dragonfly full nav all imply hover/state reactivity; specific hover mechanics inferred.

### P-025 — WebGL Real-Time Scene
- **Pattern:** A live 3D/GL scene as hero or ambient layer (not pre-rendered video).
- **Purpose:** Unmistakable "we engineer" signal; impossible-in-CSS visuals.
- **Psychological effect:** Cutting-edge competence; immersive depth.
- **When to use:** Brands with real engineering capability and a performance budget.
- **When not to use:** Conversion-critical first paint, content sites where LCP is everything, low-power/slow-network (D18/D19 SUPPRESSED_WHEN).
- **Technical approach:** Three.js/raw GL; static/no-JS fallback frame; reduced-motion fallback; strict perf budget (see PERFORMANCE_KNOWLEDGE.md).
- **Risk:** HIGH — K4 if cargo-culted; only 4/25 used WebGL (minority signal).
- **Business types:** agency, tech product, Web3, architect (parametric), data product.
- **Knowledge class:** K3 + K2 + K1 fallback; cost-gated by D33.
- **Evidence (SOURCE FACT):** library P-015; #3 Vectr, #14 Spur, #20 Dragonfly use canvas/WebGL; teardown notes 4/25 WebGL/canvas — a *minority* signal, so this is a capability marker, not a default.

### P-026 — Canvas 2D Generative Field
- **Pattern:** Procedural 2D canvas (particles, noise, generative art) as ambient or hero layer.
- **Purpose:** Ownable, lightweight-ish motion; brand-expression via algorithm.
- **Psychological effect:** Living, non-repeating texture; crafted uniqueness.
- **When to use:** Brands wanting a signature generated look without full 3D cost.
- **When not to use:** Same gating as P-025; skip if a static image conveys the same.
- **Technical approach:** `requestAnimationFrame` with cap; pause when offscreen; reduced-motion = static render; accessible alt.
- **Risk:** MEDIUM-HIGH — K4 if decorative-only.
- **Business types:** agency, studio, tech brand, artist.
- **Knowledge class:** K3 + K2 + K1 fallback.
- **Evidence (SOURCE FACT):** library P-015; #3 Vectr (generative canvas, blue), #14 Spur (canvas viz), #20 Dragonfly (canvas) — canvas confirmed in teardown; the *2D generative field* framing is RESEARCH SYNTHESIS of those.

### P-027 — 2D Animation (SVG/CSS Motion Graphics)
- **Pattern:** Vector/CSS-driven motion (morphing SVG, animated illustrations, line-draw, looping CSS).
- **Purpose:** Narrative/explainer motion without WebGL weight.
- **Psychological effect:** Clarity + charm; explains process visually.
- **When to use:** Explainers, process-showcase, brand marks that benefit from motion.
- **When not to use:** Where a static diagram is clearer; on reduced-motion (K1).
- **Technical approach:** SVG `<animate>`/CSS; `prefers-reduced-motion` static; keep loops subtle; respect K1 contrast.
- **Risk:** LOW-MEDIUM.
- **Business types:** agency, product (how-it-works), architect (process), fitness.
- **Knowledge class:** K2 + K1 (reduced-motion).
- **Evidence:** RESEARCH SYNTHESIS. Teardown records motion type per site (video vs canvas vs type/static) but not 2D-vector animation specifically; inferred as the lightweight sibling of P-025/P-026.

### P-028 — 3D Spatial / Parallax Depth
- **Pattern:** Layered parallax or faux-3D depth on scroll (objects at different depths, tilt).
- **Purpose:** Tangible depth; makes flat layouts feel physical.
- **Psychological effect:** Immersion; "I can almost reach it."
- **When to use:** Product/portfolio where spatial show-off helps (architecture, real estate, product).
- **When not to use:** Dense text/utility content; reduced-motion users (K1); perf-constrained.
- **Technical approach:** CSS `transform: translateZ` / scroll-linked layers; cap depth; reduced-motion = flat; test on low-end.
- **Risk:** MEDIUM — K3 idiom; K1 perf/reduced-motion gates.
- **Business types:** real-estate, architect, hotel (rooms), product, photographer.
- **Knowledge class:** K3 + K2 + K1 (perf, reduced-motion).
- **Evidence:** RESEARCH SYNTHESIS. Teardown shows imagery-saturated, section-rich sites (#21 Hamza 296 imgs, #24 Serotoninn 295) where depth treatment is plausible, but parallax/3D was not probed — inferred, not fact.

### P-029 — Ambient Sound / Audio
- **Pattern:** Background music or ambient audio tied to the experience.
- **Purpose:** Atmosphere; emotional scoring.
- **Psychological effect:** Mood-setting — but easily intrusive.
- **When to use:** Rarely. Only artist/music/immersive brand where audio IS the content, and only on explicit user opt-in.
- **When not to use:** Essentially all local/business sites. Autoplay audio is a K1 spec violation (browsers block it) and a K4 slop signal.
- **Technical approach:** Never autoplay with sound; user-controlled toggle; respects mute by default; K1: autoplay-audio-blocked per spec.
- **Risk:** VERY HIGH — almost always a defect; K4.
- **Business types:** musician, audio brand, immersive art piece (opt-in only).
- **Knowledge class:** K4 (prohibitive) + K1 (no-autoplay spec).
- **Evidence:** RESEARCH SYNTHESIS / YOUR INFERENCE. Teardown records "no autoplay sound" as a *rule* for video heroes (P-002) — i.e., the evidence base treats audio as something to suppress, not use. No teardown site used ambient sound.

### P-030 — Scroll Storytelling Narrative
- **Pattern:** The page is a guided story (chapter beats, reveals, build-ups) mapped to scroll position.
- **Purpose:** Persuasion through sequence; memorable brand arc.
- **Psychological effect:** Engagement via narrative tension and payoff.
- **When to use:** Business with a real process/transformation/history worth traversing.
- **When not to use:** Retrieval-intent users (D06 SUPPRESSED_WHEN: "where/when/how much/book" — a story before opening hours is hostile).
- **Technical approach:** Scroll-linked state with reduced-motion static fallback; all content reachable without scrolling JS.
- **Risk:** MEDIUM — K2 craft; suppress when intent is retrieval.
- **Business types:** artist, hotel (experience), craft/manufacturing, architect (process), non-profit.
- **Knowledge class:** K2 + K1 (D06 suppression rule).
- **Evidence:** RESEARCH SYNTHESIS from teardown storytelling notes — #1 Mosby (manifesto), #10 Cinética (capability-led), #2 Revelatio (audience-segmented narrative) show narrative structure; scroll-mapping inferred.

### P-031 — Interactive Objects / Playable Elements
- **Pattern:** Elements the user can manipulate (drag, rotate, open, scrub) as a signature interaction.
- **Purpose:** Memorable engagement; demonstrates the product tangibly.
- **Psychological effect:** Play → recall; "I did something here."
- **When to use:** Product/portfolio where hands-on exploration adds value.
- **When not to use:** Where the interaction has no user purpose (D16 SUPPRESSED_WHEN: "interaction without purpose" is an anti-pattern).
- **Technical approach:** Pointer + keyboard parity (K1); reduced-motion alternative; never gate essential content behind play.
- **Risk:** MEDIUM — K4 if purposeless.
- **Business types:** product (configurators), architect (plans), Web3, artist (toys), real-estate.
- **Knowledge class:** K3 + K2 + K4 (gimmick if purposeless) + K1 (a11y parity).
- **Evidence:** RESEARCH SYNTHESIS. Teardown's pointer-reactive WebGL (#3 Vectr) and interactive viz (#14 Spur) imply manipulable objects; explicit "playable" elements not probed.

### P-032 — Unexpected / Anti-Conventional Transitions
- **Pattern:** Deliberately odd transitions (glitch, invert, scramble, non-euclidean page changes) that break expectation.
- **Purpose:** Memorability; signals a non-template, rebellious brand.
- **Psychological effect:** Surprise/delight; "this brand is different."
- **When to use:** Bold brands (studio, artist, music, fashion) where differentiation IS the strategy.
- **When not to use:** Trust/local/conversion-critical; surprise hurts comprehension there.
- **Technical approach:** Confined to non-essential moments; reduced-motion = conventional cut; keep <600ms; never disorient AT users.
- **Risk:** HIGH — K3 trend; K4 if it impairs comprehension.
- **Business types:** studio, artist, music label, fashion, Web3.
- **Knowledge class:** K3 + K2 + K4 (comprehension risk).
- **Evidence:** RESEARCH SYNTHESIS. Teardown notes "bespoke feel / not a template" across many sites (#1, #4, #20) and unconventional nav (#25 No Art text nav, #6 Paysages no nav) implying anti-conventional instincts; specific transition tricks inferred.

### P-033 — Responsive Adaptation Strategy
- **Pattern:** Deliberate mobile reflow — type-led scales down, nav → hamburger, layout simplifies, hero media persists.
- **Purpose:** Preserves the concept on small screens without clutter.
- **Psychological effect:** "This works everywhere" trust; no broken mobile.
- **When to use:** Always (K1 baseline).
- **When not to use:** Never suppressed — responsive is a gate, not a choice.
- **Technical approach:** Fluid `clamp()` type; breakpoint reflow; nav collapses to hamburger where text nav exists (teardown: #2, #3, #5, #11, #14, #13, #24 mobNav=True); test ≤360px.
- **Risk:** LOW — but a K1 failure if ignored.
- **Business types:** all.
- **Knowledge class:** K1 (invariant baseline) + K2 (craft of graceful reflow).
- **Evidence (SOURCE FACT):** library Section 2 #13; mobile-collapse confirmed for #2 Revelatio, #3 Vectr, #5 Studio Modular, #11 3e Étage, #14 Spur, #13 Normal Is Boring, #24 Serotoninn (mobNav=True); type-led sites keep simple top bar.

### P-034 — Micro-Interactions / State Feedback
- **Pattern:** Tiny state responses — button press, form focus, toggle, loading dot, success check.
- **Purpose:** Confirms system status; makes the UI feel responsive and alive.
- **Psychological effect:** Trust via feedback; "the system heard me."
- **When to use:** Always (K1 UX: status visibility, error recovery).
- **When not to use:** Never — but avoid gratuitous bounce/celebration on serious contexts.
- **Technical approach:** CSS transitions <200ms; visible focus ring; `aria-live` for status (K1); reduced-motion respected.
- **Risk:** LOW — universal K1/K2 floor.
- **Business types:** all.
- **Knowledge class:** K1 (status visibility) + K2 (craft timing).
- **Evidence:** RESEARCH SYNTHESIS from teardown interaction layer — live badge counts (#25 No Art, #22 Crxtian, P-018) and pointer-reactive scenes (#3, #14, #20) imply a feedback-rich interaction model; micro-interaction specifics inferred as the K1 floor.

## 2. Patterns ILLEGAL for a conversion-critical local business site

**Provenance:** SOURCE FACT (teardown composition) + YOUR INFERENCE (transfer to local-SMB context). The teardown's 25 winners are overwhelmingly agencies, studios, brands, artists, and musicians — i.e., **businesses whose website IS the product** (reputation/portfolio artifacts). Their patterns optimize for *being remembered*, not for *booking/ordering now*. A bakery, mechanic, dentist, salon, restaurant, or car service has the opposite job: the site must convert a task (find hours, book, call, order). Applying showcase patterns there is a defect, not a style.

| Pattern | Why illegal/forbidden for conversion-critical local SMB | Class |
|---|---|---|
| P-019 Pre-entry loader | Delays the phone number / booking button = lost conversion; K1 LCP defect | K3→K4 |
| P-001 Oversized typographic hero (solo) | Type-only hero hides the real thing (food, people, shop); trust-first local users need proof + contact above fold | K2 (suppress) |
| P-009 Minimal hero nav (logo+1 CTA) | Local trust needs **persistent contact** (phone/address/hours) ≤1 tap (K1). Stripping nav = K1 a11y defect | K2+K1 |
| P-029 Ambient sound | Autoplay audio blocked by spec (K1) and hostile to task users; K4 | K4+K1 |
| P-015 / P-025 / P-026 Generative/WebGL/Canvas hero | Engineering cost + LCP risk on conversion-critical first paint; only 4/25 used it (minority signal) | K3→K4 |
| P-030 Scroll storytelling | Retrieval-intent users (D06 SUPPRESSED_WHEN) — a story before opening hours is hostile | K2 (suppress) |
| P-023 Custom cursor | Breaks affordance on K1 floor; meaningless on touch; friction for task users | K3+K4 |
| P-032 Unexpected transitions | Surprise impairs comprehension where clarity = conversion | K3+K4 |
| P-014 Quiet monochrome (extreme) | Tiny type + near-invisible contrast can fail K1 AA on a site that must be *read fast* by everyone | K2 (conditional) |

**Allowed / always-on for local SMB:** P-003 (type-scale contrast), P-004 (neutral+accent), P-007 (category colors), P-010 (audience paths), P-012 (imagery — original photos), P-013 (tokens), P-017 (clear nav), P-018 (live counts, if real), P-024 (hover), P-033 (responsive), P-034 (micro-interactions). These carry K1 floors and serve conversion.

## 3. What MUST NOT be cloned vs. what is generalizable

**Provenance:** RESEARCH SYNTHESIS (distilled from library §4 anti-clone rules) + YOUR INFERENCE.

### 3a. DO NOT CLONE (specific, non-generalizable)
- **Specific typefaces as "Awwwards fonts":** Signifier, Thunder, Neue Montreal, PolySans, Geist, FK Roman, Tausend Soft, PP Fraktion Mono — these were chosen *per brand*. Cloning them verbatim on an unrelated business is templating (library §4 #7).
- **Exact layouts/color recipes:** Nexola's lime-on-black (#B3FF00/#0F0F0F), Studio OL's single red (#FF0000), 3e Étage's black/yellow — reuse the *principle* (one hot accent on neutral), never the exact hex + composition.
- **Signature effects of named studios:** Van Morrison's 150px repeated name, Taxer's 247px poster h2, Serotoninn's ultra-condensed Thunder + mono, No Art's event-badge nav — these are identity marks, not mechanisms.
- **Stock video for cinematic heroes (P-002):** Original footage or none (library §4 #3).
- **System fonts as lazy default:** Vectr (Roboto) and 21 Hrs (Arial) work *because* they are deliberate concepts; copying system-font-as-default reads cheap (library §4 #4).
- **"Big text on black" as the default:** The most common Awwwards cliché (library §4 #2). Character must decide dark vs light vs warm-paper.
- **Industry color clichés (navy law, red restaurant):** Contradicted by the data; character > industry (library §4 #6).

### 3b. GENERALIZABLE MECHANISMS (the transferable engine)
- Extreme type-scale contrast as a *principle* (P-003) — ratio, not specific sizes.
- One hot accent on a neutral base (P-004) — mechanism, hue is free.
- Restrained palette discipline (≤3 active hues) (P-004/P-006).
- Tokenized design system (P-013) — infrastructure, universal.
- Asymmetric grid *within* a base grid (P-008) — structure, not pixels.
- Segmented audience paths (P-010) — IA pattern, business-data driven.
- Original-photo imagery discipline (P-012) — rule, not subjects.
- Live, truthful counts (P-018) — pattern, values are business-specific.
- Responsive reflow + reduced-motion fallbacks (P-033/P-034) — K1 floors.

## 4. Decision matrix — pattern class → business type

**Provenance:** RESEARCH SYNTHESIS + YOUR INFERENCE. Legend: **ALLOW** = safe default · **COND** = conditional (gate on asset/perf/intent) · **FORBID** = defect for this type.

| Pattern | Local SMB (bakery/mechanic/dentist) | Studio/Agency/Brand (site=product) | Artist/Musician/Web3 | SaaS/Product (deep content) |
|---|---|---|---|---|
| P-001 Typographic hero | FORBID (needs real proof) | ALLOW | ALLOW | COND |
| P-002 Video/canvas hero | COND (original footage only) | ALLOW | ALLOW | COND |
| P-003 Type-scale contrast | ALLOW | ALLOW | ALLOW | ALLOW |
| P-004 Neutral+accent | ALLOW | ALLOW | ALLOW | ALLOW |
| P-005 Multi-family type | COND | ALLOW | ALLOW | ALLOW |
| P-006 Signature mono | ALLOW | ALLOW | ALLOW | COND |
| P-007 Category colors | ALLOW | ALLOW | COND | ALLOW |
| P-008 Asymmetric grid | COND | ALLOW | ALLOW | COND |
| P-009 Minimal hero nav | FORBID (needs persistent contact) | ALLOW | ALLOW | COND |
| P-010 Audience paths | ALLOW | ALLOW | COND | ALLOW |
| P-011 Poster moment | COND (clamp) | ALLOW | ALLOW | COND |
| P-012 Imagery showcase | ALLOW (original photos) | ALLOW | ALLOW | COND |
| P-013 Token system | ALLOW (required) | ALLOW (required) | ALLOW (required) | ALLOW (required) |
| P-014 Quiet monochrome | COND (K1 AA) | ALLOW | ALLOW | COND |
| P-015 Generative canvas | FORBID (LCP/eng) | COND (eng capability) | COND | COND |
| P-016 Cultural duality | COND (2 audiences) | COND | COND | COND |
| P-017 Product nav | COND | ALLOW | COND | ALLOW |
| P-018 Live badge counts | COND (real counts) | COND | ALLOW | ALLOW |
| P-019 Loader | FORBID | COND | COND | FORBID |
| P-020 Opening reveal | COND | ALLOW | ALLOW | COND |
| P-021 Scroll choreography | COND (no retrieval block) | ALLOW | ALLOW | COND |
| P-022 Section transitions | ALLOW | ALLOW | ALLOW | ALLOW |
| P-023 Custom cursor | FORBID | COND | COND | FORBID |
| P-024 Hover-reactive | ALLOW | ALLOW | ALLOW | ALLOW |
| P-025 WebGL scene | FORBID | COND | COND | COND |
| P-026 Canvas 2D field | FORBID | COND | COND | COND |
| P-027 2D animation | ALLOW | ALLOW | ALLOW | ALLOW |
| P-028 3D/parallax | COND | COND | COND | COND |
| P-029 Ambient sound | FORBID | FORBID | COND (opt-in) | FORBID |
| P-030 Scroll storytelling | FORBID (retrieval) | ALLOW | ALLOW | COND |
| P-031 Interactive objects | COND (purpose) | COND | COND | ALLOW |
| P-032 Unexpected transitions | FORBID | COND | COND | FORBID |
| P-033 Responsive adapt | ALLOW (required) | ALLOW (required) | ALLOW (required) | ALLOW (required) |
| P-034 Micro-interactions | ALLOW (required) | ALLOW (required) | ALLOW (required) | ALLOW (required) |

**Reading rule (YOUR INFERENCE):** A pattern marked COND must clear its gate from §1 (asset availability, performance budget, reduced-motion, audience count, or retrieval vs consideration intent) before use. The taxonomy's `SUPPRESSED_WHEN` field remains the load-bearing authority: when a business's real conversion happens off-site or the user intent is retrieval, the showcase patterns are *suppressed even if executed well*.

---

*End of AWWARDS_RESEARCH.md — Phase 4 decision library. Research only, no implementation, repo not modified. Evidence base: `docs/AWWWARDS_PATTERN_LIBRARY.md` (25-site teardown, P-001–P-018). Classification: `docs/knowledge/KNOWLEDGE_TAXONOMY.md` (K1–K4). No site, award, font, or layout was invented; patterns lacking direct teardown evidence are explicitly labeled RESEARCH SYNTHESIS / YOUR INFERENCE.*
