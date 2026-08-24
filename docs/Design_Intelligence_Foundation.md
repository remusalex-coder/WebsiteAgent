# BusinessForge / WebsiteAgent — Design Intelligence Foundation

**Status:** Research Foundation v1 (pre-implementation)
**Author role:** Research Director
**Date:** 2026-08-11
**Purpose:** A durable, evidence-based research foundation that a future agent can turn into deterministic design-system rules and AI-directed judgment criteria for an autonomous website generator.
**Constraint honored:** This document does NOT implement anything, does NOT modify the WebsiteAgent repo, and records no capability as fact unless sourced.

---

## 0. How to read this document

- Each principle block records: **Principle / Why it matters / Evidence / Practical rule / When to use / When NOT to use / Business signals that trigger it / Deterministic vs AI vs Hybrid / Confidence**.
- Sources are cited inline as `[S#]`. The full registry is in **Section 18**.
- Four buckets are kept separate everywhere:
  - **A) Timeless UX principles** — stable for decades, rooted in perception/cognition.
  - **B) Premium visual principles** — what makes a site feel high-quality/editorial; stable but taste-sensitive.
  - **C) Current design trends** — 2025/2026 surface patterns; volatile, decorate only.
  - **D) Fashionable but low-value effects** — eye-candy that often harms UX/performance; flag and gate.
- **Contradictions are surfaced, not averaged** (see Section 18 sub-section "Contradictions").

---

# 1. Executive Design Doctrine

> The generator's job is not to "apply a template for a dentist." It is to **interpret the business's character** (what it sells, to whom, with what confidence, in what sensory register) and **compose** a visual experience from a shared vocabulary of timeless UX rules + premium craft, decorated — never governed — by current trends.

**Doctrine statements (ordered by authority):**

1. **Usability beats novelty.** A site that loads fast, is legible, and is navigable outperforms a "wow" site that confuses. [S2, S6, S9] Timeless UX rules are *non-negotiable* and largely *deterministic*.
2. **Aesthetic quality is a trust signal, not a luxury.** The aesthetic-usability effect means good looks buy forgiveness — but also that *bad* looks destroy credibility before a word is read. [S3] Premium craft is therefore a *conversion* instrument, not decoration.
3. **Earn credibility in the first 50ms / 3 seconds.** 94% of first impressions are design-related; ~75% of users judge credibility by design alone. [S24] Above-the-fold, hero, and trust markers are *deterministic-critical*.
4. **Space, type, and alignment are the grammar of "premium."** Whitespace, custom/intentional typography, restrained color, precise grid → premium feel. Crowding, system fonts, stock photos, rainbow palettes → cheap feel. [S23]
5. **Trends decorate; they do not decide.** Awwwards-level craft uses trends as *accent*, never as the organizing principle. Copying trends blindly produces "template-looking" sites. [S16, S23, S40]
6. **Design to the business's character, not its industry label.** A boutique architect and a volume home-builder are both "construction" but warrant opposite visual treatments. Industry is a weak prior; business character (price tier, audience, emotional register, proof style) is the real signal. [S23, doctrine]
7. **Deterministic rules cover the floor; AI judgment covers the voice.** Make accessibility, contrast, spacing scale, type scale, and key conversion placements *rules*. Let AI choose *which* typeface pairing, *which* color accent, *which* hero art direction, and *which* narrative angle — constrained by rules and business signals.

---

# 2. Core Design Principles

### P-01 — Visibility of system status
- **Why:** Users must know what the system is doing (loading, submitting, error).
- **Evidence:** NN/g Heuristic #1 [S2].
- **Rule:** Every async action shows feedback <100ms; full states for loading/success/error; no dead buttons.
- **Use:** All interactive sites. **Don't:** Skip on "simple" brochure sites — forms still need it.
- **Triggers:** Any form, booking, or dynamic content.
- **Decision:** Deterministic. **Confidence: High.**

### P-02 — Match system to the real world (mental models)
- **Why:** Speak the user's language; follow real-world conventions.
- **Evidence:** NN/g Heuristic #2 [S2].
- **Rule:** Use domain vocabulary the customer uses; icon = recognized metaphor; reading direction respected.
- **Use:** Copy, icons, nav labels. **Don't:** Use clever/abstract labels that hide function.
- **Triggers:** All businesses; *stronger* for non-tech SMBs (mechanic, salon) where clarity > cleverness.
- **Decision:** Hybrid (vocabulary deterministic-safe list + AI tone). **Confidence: High.**

### P-03 — User control & freedom (undo)
- **Why:** Users make mistakes; need escape hatches.
- **Evidence:** NN/g Heuristic #3 [S2].
- **Rule:** Visible back/cancel/undo on destructive flows (booking, checkout).
- **Use:** Booking, forms, carts. **Don't:** Trap users in modals.
- **Decision:** Deterministic. **Confidence: High.**

### P-04 — Consistency & standards
- **Why:** Inconsistent UI costs learnability and trust.
- **Evidence:** NN/g Heuristic #4 [S2]; Atlassian tokens [S13].
- **Rule:** One spacing scale, one type scale, one color token set, consistent component behavior. Design tokens are the *mechanism*.
- **Use:** Always. **Don't:** Reinvent per page.
- **Triggers:** All.
- **Decision:** Deterministic (tokens). **Confidence: High.**

### P-05 — Error prevention
- **Why:** Better to prevent than recover.
- **Evidence:** NN/g Heuristic #5 [S2].
- **Rule:** Inline validation, constrained inputs, confirm destructive actions.
- **Use:** Forms everywhere. **Don't:** Rely on post-submit errors.
- **Decision:** Deterministic. **Confidence: High.**

### P-06 — Recognition not recall
- **Why:** Reduce memory load; show options/state.
- **Evidence:** NN/g Heuristic #6 [S2].
- **Rule:** Persistent nav, visible cart, labels not icons-alone, contextual info near action.
- **Use:** Always. **Don't:** Hide essential controls behind menus on desktop.
- **Decision:** Deterministic. **Confidence: High.**

### P-07 — Flexibility & efficiency (accelerators)
- **Why:** Serve novices and experts.
- **Evidence:** NN/g Heuristic #7 [S2].
- **Rule:** Shortcuts/quick paths where repeat use expected (e.g., reorder for regulars).
- **Use:** Returning-customer flows (salon, restaurant ordering). **Don't:** Over-engineer a one-visit site.
- **Decision:** AI (contextual). **Confidence: Medium.**

### P-08 — Aesthetic & minimalist design
- **Why:** Extra elements compete with relevant info.
- **Evidence:** NN/g Heuristic #8 [S2]; Awwwards craft [S16]; premium whitespace [S23].
- **Rule:** Remove anything not serving goal; generous whitespace; one primary action per view.
- **Use:** All. **Don't:** Strip so far that trust/proof elements vanish.
- **Decision:** Hybrid (minimalism floor deterministic; what to keep AI). **Confidence: High.**

### P-09 — Help users recover from errors
- **Why:** Plain-language, constructive error messages.
- **Evidence:** NN/g Heuristic #9 [S2].
- **Rule:** "Email looks wrong — check the @ symbol" not "Error 0x12."
- **Decision:** Deterministic template + AI fill. **Confidence: High.**

### P-10 — Help & documentation
- **Why:** Even simple sites need a fallback.
- **Evidence:** NN/g Heuristic #10 [S2].
- **Rule:** FAQ / contact visible; concise.
- **Decision:** Deterministic presence + AI content. **Confidence: Medium.**

### P-11 — Aesthetic-Usability Effect (double-edged)
- **Why:** Attractive interfaces are *perceived* as more usable and get forgiven — but this can mask real defects in testing.
- **Evidence:** NN/g [S3].
- **Rule:** Lean on good design to build trust, BUT never let visual polish substitute for real usability/perf testing.
- **Use:** Justifies investing in craft. **Don't:** Use as excuse to ship broken flows.
- **Decision:** Doctrine-level. **Confidence: High (effect real; implication contested).**

### P-12 — Progressive disclosure
- **Why:** Reduce cognitive load by revealing detail on demand.
- **Evidence:** NN/g [S39].
- **Rule:** Lead with the one decision; hide secondary detail behind expand/secondary page.
- **Use:** Complex services (law, architecture, construction). **Don't:** Bury the primary CTA.
- **Decision:** Hybrid. **Confidence: High.**

---

# 3. UI/UX Rules

### UX-01 — People scan, they don't read
- **Why:** On the web, users read ~20–28% of words; they scan.
- **Evidence:** NN/g "How Users Read on the Web" [S10]; F-pattern [S4].
- **Rule:** Front-load the conclusion in headlines; use scannable structures (lists, bold lead, short paras ≤3 lines mobile).
- **Use:** All body copy. **Don't:** Long unbroken paragraphs.
- **Triggers:** All.
- **Decision:** Deterministic structure + AI copy. **Confidence: High.**

### UX-02 — F-shaped reading (and its limits)
- **Why:** Eyetracking shows top/left weighted; but F-shape is a *symptom of poor layout*, not a goal.
- **Evidence:** NN/g [S4] explicitly warns the F-pattern is "misunderstood" and "bad for users and businesses"; best antidotes = good visual hierarchy, plain language, structured scanning aids.
- **Rule:** Put primary message top-left; but design hierarchy that *breaks* pure F-scan when you want deep reading (editorial). Don't force everything into F.
- **Use:** Marketing/landing. **Don't:** Treat F as the only template; editorial/long-form needs centered/asymmetric flows.
- **Decision:** Hybrid. **Confidence: High (effect) / High (antidote).**

### UX-03 — Visual hierarchy via contrast & position
- **Why:** Directs attention to what matters.
- **Evidence:** NN/g visual-hierarchy research [S2.5 404 but doctrine-stable; Material emphasizes hierarchy via color/type [S12]; Atlassian grid aligns hierarchy [S14]].
- **Rule:** Size > position > color > weight in priority ordering; one focal point per viewport.
- **Use:** Every section. **Don't:** Multiple equal-weight competing elements.
- **Decision:** Deterministic skeleton + AI emphasis. **Confidence: High.**

### UX-04 — One primary action per view
- **Why:** Choice overload reduces conversion.
- **Evidence:** Conversion doctrine + minimalism [S2 H8]; Hick's law (implied).
- **Rule:** Each section has exactly one dominant CTA; secondary actions de-emphasized.
- **Use:** All. **Don't:** 4 equal buttons.
- **Decision:** Deterministic. **Confidence: High.**

### UX-05 — Touch targets ≥44×44px
- **Why:** Mobile tap accuracy.
- **Evidence:** WCAG 2.5.5 / Apple HIG / Material [S6, S8, S12].
- **Rule:** All interactive elements min 44px; spacing between tappables.
- **Decision:** Deterministic. **Confidence: High.**

### UX-06 — Predictable, visible navigation
- **Why:** Orientation prevents abandonment.
- **Evidence:** NN/g consistency [S2]; Baymard mobile research (141 mobile articles) [S19].
- **Rule:** Persistent primary nav; current-location indication; max 5–7 top items.
- **Use:** All >3 pages. **Don't:** Hamburger-only on desktop.
- **Decision:** Deterministic. **Confidence: High.**

---

# 4. Typography System

### T-01 — Establish a modular type scale
- **Why:** Consistent rhythm; accessibility; avoids arbitrary sizes.
- **Evidence:** Material 30-type-style scale [S12]; Atlassian type principles [S18]; modular-scale practice [search].
- **Rule:** Define ~6 steps (e.g., display, h1, h2, body, small, caption) from a base (16px body) × ratio (1.2–1.333). Fluid clamp() for responsiveness.
- **Use:** All. **Don't:** Ad-hoc px per element.
- **Triggers:** All.
- **Decision:** Deterministic scale + AI choice of ratio/character. **Confidence: High.**

### T-02 — Body text minimum 16px, line-height 1.5
- **Why:** Legibility, especially mobile/older users.
- **Evidence:** WCAG SC 1.4.4 resize; NN/g readability; Atlassian "optimize for readability" [S18].
- **Rule:** body ≥16px; line-length 45–75ch; line-height 1.4–1.6.
- **Decision:** Deterministic. **Confidence: High.**

### T-03 — Limit typefaces to 1–2 families
- **Why:** Cohesion + performance; pairing skill > quantity.
- **Evidence:** Premium principle "custom/restrained type" [S23]; Material tokens [S12].
- **Rule:** 1 display/heading family + 1 text family (or 1 superfamily). Never >2 without reason.
- **Use:** All. **Don't:** 4 fonts "because options."
- **Decision:** Deterministic cap + AI selection. **Confidence: High.**

### T-04 — Use intentional, character-matched type
- **Why:** Typeface communicates personality before words.
- **Evidence:** Splash "custom typography signals premium; system fonts signal generic" [S23].
- **Rule:** Map type choice to business character (see Section 14). Serif/editorial → heritage/craft; geometric sans → modern/tech; humanist → friendly/local.
- **Use:** Brand-defining moments (logo, hero, headings). **Don't:** Default system font for a luxury brand.
- **Decision:** AI-directed (from character vector) + deterministic pair-validity check. **Confidence: Medium-High.**

### T-05 — Weight & tracking for hierarchy, not color alone
- **Why:** Color-only differentiation fails color-blind/low-vision users.
- **Evidence:** WCAG 1.4.1 use of color [S6].
- **Rule:** Differentiate text roles by size/weight/style, not color only.
- **Decision:** Deterministic. **Confidence: High.**

### T-06 — Respect reading direction & RTL
- **Why:** Global audiences; correctness.
- **Evidence:** WCAG / W3C [S6, S7].
- **Rule:** `dir` attribute; logical properties; mirror layout for RTL.
- **Decision:** Deterministic (when locale signals). **Confidence: Medium (mostly out of scope for local SMB but flag).**

---

# 5. Color System

### C-01 — Build from a restrained palette (2–3 + neutrals)
- **Why:** Confident, deliberate feel; reduces cognitive noise.
- **Evidence:** Splash "premium = 2–3 colors with a job each; busy multi-color feels chaotic" [S23]; Material "26+ roles but from a base scheme" [S12].
- **Rule:** 1 primary brand, 1 accent, background/neutral ramp, semantic (success/warn/error) tokens. Total active hues ≤3.
- **Use:** All. **Don't:** Rainbow category coloring.
- **Triggers:** All.
- **Decision:** Deterministic structure + AI hue selection from brand/character. **Confidence: High.**

### C-02 — Color communicates hierarchy & state, not decoration
- **Why:** Material explicitly: color communicates "hierarchy, state, and brand" [S12].
- **Rule:** Accent reserved for primary action/active state; neutrals carry structure.
- **Decision:** Deterministic. **Confidence: High.**

### C-03 — Accessible contrast is mandatory (WCAG AA)
- **Why:** Legibility for low-vision/aging users (core SMB audience skews 35+).
- **Evidence:** WCAG 1.4.3 (4.5:1 text, 3:1 large/UI) [S6]; Fluent contrast checker [S33]; Material accessible roles [S12].
- **Rule:** Body text ≥4.5:1; large text ≥3:1; UI components ≥3:1. Auto-check every token pair.
- **Use:** All. **Don't:** Light-gray-on-white "elegant" low-contrast (common anti-pattern).
- **Decision:** Deterministic (hard gate). **Confidence: High.**

### C-04 — Derive palette from brand/character, not industry cliché
- **Why:** "Law firm = navy, restaurant = red" is a cliché trap that makes sites interchangeable.
- **Evidence:** Doctrine (Section 1.6); premium restraint [S23].
- **Rule:** Start from business character (Section 14) → pick hue with intent; allow industry as a *weak* hint only.
- **Decision:** AI-directed derivation + deterministic contrast/diversity validation. **Confidence: Medium-High.**

### C-05 — Provide light & dark tokens
- **Why:** Comfort, battery, preference; modern expectation.
- **Evidence:** Material dark theme built-in [S12]; Apple HIG appearance [S8].
- **Rule:** Define both schemes; ensure contrast in each.
- **Decision:** Deterministic mechanism + AI tuning. **Confidence: Medium.**

### C-06 — Semantic colors fixed & universal
- **Why:** Red=error, green=success must be culture-stable within product UI.
- **Rule:** success/warn/error/info tokens not reused for branding.
- **Decision:** Deterministic. **Confidence: High.**

---

# 6. Layout / Grid System

### G-01 — 12-column grid with consistent gutters/margins
- **Why:** Alignment = perceived quality; faster scanning.
- **Evidence:** Atlassian grid (12 cols, gutters, margins) [S14]; premium "precise grid/alignment" [S23].
- **Rule:** 12-col desktop, collapse to 4/6 on tablet/mobile; 8px-based gutters; outer margins ≥24px.
- **Use:** All content sites. **Don't:** Free-floating elements.
- **Decision:** Deterministic. **Confidence: High.**

### G-02 — 8px spacing base unit
- **Why:** Harmonic rhythm; consistency; responsive scaling.
- **Evidence:** Atlassian 8px base [S13]; Material 4/8px [S12].
- **Rule:** All spacing ∈ multiples of 4/8 (0,4,8,12,16,24,32,48,64…). No arbitrary 13px gaps.
- **Decision:** Deterministic. **Confidence: High.**

### G-03 — Generous vertical section rhythm
- **Why:** "Premium breathes"; separation creates hierarchy.
- **Evidence:** Splash intentional whitespace [S23]; NN/g minimalist [S2].
- **Rule:** Section padding vertical ≥64px desktop / ≥40px mobile; consistent rhythm across sections.
- **Decision:** Deterministic min + AI emphasis. **Confidence: High.**

### G-04 — Asymmetry & intentional breakouts for editorial feel
- **Why:** Pure centered grids read "template." Offset/overlap signals bespoke.
- **Evidence:** Awwwards/editorial craft (implied by award criteria [S16]); premium precision [S23].
- **Rule:** Allow asymmetric hero/feature layouts; break the 12-col occasionally with full-bleed or offset blocks.
- **Use:** Premium/editorial businesses (architect, photographer, hotel). **Don't:** On trust-critical utilitarian flows (checkout).
- **Decision:** AI-directed (character-gated). **Confidence: Medium.**

### G-05 — Max content width ~1200–1280px, text column ≤70ch
- **Why:** Readability & focus on large screens.
- **Evidence:** Standard practice; Atlassian content area [S14].
- **Rule:** Container ≤1280px; reading measure 45–75ch.
- **Decision:** Deterministic. **Confidence: High.**

### G-06 — Mobile-first responsive construction
- **Why:** Majority of SMB traffic is mobile; mobile constraints force clarity.
- **Evidence:** Marcotte "Responsive Web Design" [S38]; NN/g mobile UX [S35 404 but stable doctrine]; Baymard mobile [S19].
- **Rule:** Design base layout for 360px; enhance up. No horizontal scroll. Fluid type & spacing.
- **Decision:** Deterministic. **Confidence: High.**

---

# 7. Imagery & Art Direction

### I-01 — Original photography > stock
- **Why:** Stock is the single biggest credibility killer; visitors recognize it; signals inauthenticity.
- **Evidence:** Splash "stock photography = biggest credibility killer; original = authenticity" [S23]; trust doctrine [S3, S24].
- **Rule:** Prefer real business imagery (team, space, work, product). If stock unavoidable, use un-corporate, contextual, diverse-but-real-feeling imagery and label honestly.
- **Use:** All local SMBs — *especially* salon, restaurant, hotel, mechanic, real estate (where the physical reality IS the product). **Don't:** Handshake/coffee/laptop clichés.
- **Triggers:** Business has a physical location, staff, or tangible output.
- **Decision:** AI art-direction *brief* + deterministic "no-cliché" blocklist. **Confidence: High (effect) / Medium (enforcement feasibility).**

### I-02 — Imagery carries the brand's sensory register
- **Why:** For experiential businesses, the photo *is* the value proposition.
- **Evidence:** Premium/editorial principle [S23]; Awwwards "cinematic heroes" trend [S40].
- **Rule:** Photographic treatment (light/warm/editorial/moody) matched to character (Section 14).
- **Use:** Hotel, restaurant, photographer, architect, fitness. **Don't:** Flat stock for a luxury hotel.
- **Decision:** AI-directed. **Confidence: Medium-High.**

### I-03 — Hero imagery must not bury the message or hurt LCP
- **Why:** Hero is the trust/credibility moment but heavy media kills performance (which kills trust).
- **Evidence:** LCP is a Core Web Vital [S9]; premium "fast load = premium" [S23]; NN/g hero guidance (hero image usability) [S36 404 but stable].
- **Rule:** Hero image optimized (next-gen format, sized, lazy-off for LCP), text overlay readable (scrim), message clear <3s.
- **Decision:** Deterministic perf budget + AI composition. **Confidence: High.**

### I-04 — Consistent image treatment system
- **Why:** Cohesion reads as intentionality.
- **Evidence:** Premium precision [S23]; design-system consistency [S13].
- **Rule:** One filter/tonal approach across all imagery; consistent aspect ratios per slot.
- **Decision:** Deterministic token + AI apply. **Confidence: Medium.**

---

# 8. Narrative / Storytelling System

### N-01 — Lead with the customer's outcome, not the business's ego
- **Why:** Visitors care about their problem; ego-first copy reads template.
- **Evidence:** Splash "specific, confident copy > vague" [S23]; NN/g scan [S10].
- **Rule:** Hero = value to visitor; sections = proof → process → outcome → CTA.
- **Use:** All. **Don't:** "Welcome to our company since 1998" as hero.
- **Decision:** AI copy (character-conditioned) + deterministic structure. **Confidence: High.**

### N-02 — Section sequence follows a persuasion arc
- **Why:** Order affects conversion; trust must be established before ask.
- **Evidence:** Conversion/narrative doctrine; trust factors [S3, S24]; progressive disclosure [S39].
- **Rule:** Hook (hero) → Relevance/Who-for → Proof (trust) → Offer/Process → Social proof → Risk reversal → CTA → Contact.
- **Use:** All conversion sites. **Don't:** CTA before trust established.
- **Decision:** Deterministic skeleton + AI content per block. **Confidence: High.**

### N-03 — Specificity signals confidence
- **Why:** "We help businesses grow" = uncertain; specifics = premium/confident.
- **Evidence:** Splash [S23]; trust copy [S24].
- **Rule:** Name the audience, the outcome, the numbers (e.g., "72-hour turnaround").
- **Use:** All, esp. professional services (law, architecture, agency). **Don't:** Vague superlatives.
- **Decision:** AI copy + deterministic "specificity" lint. **Confidence: Medium-High.**

### N-04 — Editorial long-form for heritage/craft brands
- **Why:** Story depth builds desire for considered-purchase categories.
- **Evidence:** Premium/editorial principle [S23]; Awwwards editorial trends [S40].
- **Rule:** Allow scroll-driven narrative (origin, philosophy, process) for architect/photographer/hotel/artisan.
- **Use:** High-consideration, character = heritage/craft. **Don't:** On a quick-task mechanic "book now" flow.
- **Decision:** AI-directed (character-gated). **Confidence: Medium.**

---

# 9. Conversion System

### CV-01 — One dominant CTA, repeated with context
- **Why:** Single clear action outperforms choice; repetition aids scan.
- **Evidence:** Minimalism [S2 H8]; conversion doctrine; trust [S24].
- **Rule:** Primary CTA color = accent; appears in hero, after proof, sticky mobile bar; label = verb+benefit ("Book your slot").
- **Use:** All. **Don't:** "Click here."
- **Decision:** Deterministic placement + AI label. **Confidence: High.**

### CV-02 — Trust before ask
- **Why:** Credibility must precede conversion; otherwise CTA is ignored.
- **Evidence:** 75% judge credibility by design [S24]; NN/g trust [S3].
- **Rule:** Proof block (reviews, credentials, photos, awards) precedes final CTA.
- **Decision:** Deterministic ordering. **Confidence: High.**

### CV-03 — Reduce form friction
- **Why:** Every field is abandonment risk.
- **Evidence:** Baymard checkout research (70 cart/checkout articles) [S19]; NN/g error prevention [S2 H5].
- **Rule:** Ask minimum fields; inline validation; autofill/type=email/tel; multi-step only if long.
- **Use:** Booking/contact/quote. **Don't:** 12-field lead form.
- **Decision:** Deterministic min-fields + AI contextual extras. **Confidence: High.**

### CV-04 — Risk reversal & clear next step
- **Why:** Removes hesitation.
- **Evidence:** Trust blueprint [S24]; conversion doctrine.
- **Rule:** Guarantee/free-consult/no-obligigation; explicit "what happens next."
- **Use:** Services with commitment anxiety (law, construction, architecture). **Don't:** On trivial actions.
- **Decision:** AI copy + deterministic presence gate. **Confidence: Medium.**

### CV-05 — Trust signals weighting (evidence-based)
- **Why:** Not all trust elements equal impact.
- **Evidence:** createawebsite trust-impact ranking: professional design/layout 35%, security/SSL 25%, reviews/testimonials 20%, clear contact/policies 12%, badges 8% [S24]. *(Note: single commercial source; treat as directional, not authoritative — see Open Questions.)*
- **Rule:** Prioritize design quality + visible security + real reviews; don't over-invest in badge walls.
- **Decision:** Hybrid (ranking directional; implementation deterministic). **Confidence: Low-Medium (one source).**

---

# 10. Motion & Interaction Principles

### M-01 — Motion must have function, not flourish
- **Why:** Motion that doesn't clarify distracts and hurts perf/accessibility.
- **Evidence:** Atlassian motion "clarify interactions, guide attention, express brand" [S17]; NN/g minimalist [S2]; WCAG 2.3.3 animation from interactions [S6].
- **Rule:** Animate state changes, direction, attention only; duration 150–300ms; easing standard.
- **Use:** Transitions, feedback, scroll reveals. **Don't:** Decorative loops competing with content.
- **Decision:** Deterministic constraints + AI choreography. **Confidence: High.**

### M-02 — Respect prefers-reduced-motion
- **Why:** Vestibular/neuro users; legal (WCAG 2.3.3).
- **Evidence:** WCAG 2.3.3 [S6]; web.dev accessibility [S11].
- **Rule:** `@media (prefers-reduced-motion: reduce)` disables non-essential motion.
- **Decision:** Deterministic (hard gate). **Confidence: High.**

### M-03 — Scroll choreography as narrative, not gimmick
- **Why:** Scroll-linked storytelling can deepen engagement when purposeful.
- **Evidence:** Awwwards "cinematic heroes / dynamic motion / scroll direction" trends [S40]; Atlassian motion purpose [S17].
- **Rule:** Tie scroll reveals to content meaning; keep performant; never block reading.
- **Use:** Editorial/premium (photographer, hotel, architect). **Don't:** On utilitarian booking flows.
- **Decision:** AI-directed (character-gated) + deterministic perf/reduced-motion gates. **Confidence: Medium.**

### M-04 — Core Web Vitals are non-negotiable
- **Why:** LCP/INP/CLS directly affect ranking AND perceived quality (slow = not premium).
- **Evidence:** web.dev Core Web Vitals [S9]; Splash "fast load = premium" [S23].
- **Rule:** LCP <2.5s, INP <200ms, CLS <0.1. Motion/imagery budget enforced against these.
- **Decision:** Deterministic budget (hard gate). **Confidence: High.**

### M-05 — Micro-interactions for feedback & delight
- **Why:** Small responses confirm action and add polish.
- **Evidence:** Atlassian motion tokens [S17]; interaction-design doctrine.
- **Rule:** Button press, hover, form-success states; subtle, consistent, <200ms.
- **Decision:** Deterministic tokens + AI taste. **Confidence: Medium-High.**

---

# 11. Accessibility Rules (deterministic floor)

- **A-01 Contrast:** text 4.5:1, large 3:1, UI 3:1 [S6]. Deterministic gate.
- **A-02 Resize/reflow:** support 200% zoom, no loss of content [S6 1.4.4/1.4.10]. Deterministic.
- **A-03 Keyboard operable:** all controls focusable, visible focus ring, logical order [S6 2.1/2.4.7]. Deterministic.
- **A-04 Text alternatives:** meaningful alt per informative image; decorative = empty [S6 1.1.1]. Deterministic + AI alt generation (reviewed).
- **A-05 Color not sole carrier:** pair with text/icon [S6 1.4.1]. Deterministic.
- **A-06 Labels & instructions:** every input labeled; errors identified in text [S6 1.3.5/3.3]. Deterministic + AI copy.
- **A-07 Reduced motion / no seizures:** no >3 flashes/sec [S6 2.3]. Deterministic.
- **A-08 Language & semantics:** correct lang, landmarks, headings order [S6 1.3.1/3.1.1]. Deterministic.
- **A-09 Target size:** 44×44 [S6 2.5.5]. Deterministic.
- **A-10 Accessible names:** buttons/links have discernible text [S6 4.1.2]. Deterministic.

*All A-* rules are **Deterministic / Hard gate / Confidence High.** They are the floor below which no "premium" claim is valid.

---

# 12. Responsive Rules (deterministic)

- **R-01 Mobile-first base** (360px) [S38]. Deterministic.
- **R-02 Fluid type & spacing** via clamp() [S38, S13]. Deterministic.
- **R-03 No horizontal scroll** on any breakpoint. Deterministic.
- **R-04 Breakpoints:** mobile <640, tablet 640–1024, desktop >1024 (content-based, not device). Deterministic skeleton + AI content reflow.
- **R-05 Touch targets ≥44px, spacing between** [S6, S8]. Deterministic.
- **R-06 Images responsive** (`srcset`/sizes, next-gen format). Deterministic.
- **R-07 Sticky mobile CTA bar** for conversion sites (character-gated). Hybrid.
- **R-08 Test real devices / emulation** for tap + zoom. Deterministic checklist.

---

# 13. Industry Design Matrix (weak prior — character overrides)

> NOTE: Industry is a *starting hint only*. Each row lists the *default* lean; Section 14 is the real decision logic. "Premium-ness" = how much editorial/asymmetric/cinematic treatment is warranted by typical customer expectation.

| Industry | Typical audience | Trust driver | Visual lean | Premium-ness | Default palette hint | Typography lean | Hero type | Cautions |
|---|---|---|---|---|---|---|---|---|
| Mechanic | Local, practical, value | Reviews, location, speed | Utilitarian, clear | Low–Med | Industrial neutral + 1 accent (not cliché red) | Humanist/condensed sans | Real workshop/team photo + "Book" | Avoid luxury pretension; clarity > beauty |
| Dentist | Local, anxious, trust | Credentials, cleanliness, reviews | Calm, clinical-clean, reassuring | Med | Soft blue/teal or warm neutral | Friendly humanist sans | Smiling patient/clean clinic | Avoid clinical coldness; warmth builds trust |
| Nail salon | Local, aesthetic, social | Portfolio, trends, vibe | Lush, image-led, playful | Med–High | Trend-forward accent + neutral | Fashion/editorial display | Manicure close-up, saturated | Avoid generic spa-stock |
| Restaurant | Local+visitor, sensory | Menu, photos, reviews | Appetite-driven, image-led | Med–High | Warm (terracotta/charcoal) per cuisine | Editorial display + clean text | Dish/ambiance hero | Match cuisine culture, not generic red |
| Hotel | Visitor, aspirational | Photos, reviews, location | Cinematic, editorial, premium | High | Refined neutral + 1 luxe accent | Elegant serif/contrast | Cinematic property/scene | Avoid OTAs' generic; evoke place |
| Law firm | Local/professional, risk-averse | Credentials, wins, authority | Authoritative, restrained, serious | Med | Deep neutral (navy/charcoal) *but* avoid cliché | Traditional serif or confident sans | Partner/office or restrained type | Navy-everything = template; differentiate via character |
| Architect | Considered, design-literate | Portfolio, concept | Editorial, asymmetric, minimal | High | Monochrome + 1 accent | Geometric/editorial | Project photography, full-bleed | Must look designed or credibility fails |
| Photographer | Visual buyers, peer-judged | Portfolio quality | Portfolio-first, minimal chrome | High | Near-monochrome, image dominates | Minimal, type recedes | Own best photo | Site must not outshine work |
| Fitness studio | Local, motivated, social | Energy, community, results | Energetic, bold, motion | Med–High | High-energy accent + dark/light | Bold condensed/geometric | Action shot, class energy | Avoid clinical; show people |
| Real-estate agency | Local/relocating, high-value | Listings, local expertise | Clean, image-led, trustworthy | Med–High | Confident neutral + 1 accent | Clean geometric sans | Property/neighborhood hero | Avoid stock "happy family"; show real inventory |
| Construction company | Commercial/residential, trust | Track record, safety, capability | Capability-led, substantial | Med | Earthy/industrial neutral + accent | Sturdy geometric sans | Project/site photography | Boutique builder ≠ volume builder (character!) |

---

# 14. Business-Character → Design Decision Matrix (the real logic)

Rather than industry, derive a **character vector** from discovered business signals, then map to design parameters.

### Character dimensions (each scored from business data: listings, reviews, site copy, category, price, audience)
1. **Price tier / positioning:** budget ↔ premium ↔ luxury
2. **Consideration level:** impulse (book now) ↔ considered (research) ↔ high-stakes (life/legal)
3. **Sensory vs functional:** experience-led (hotel/photo) ↔ utility-led (mechanic/plumber)
4. **Audience formality:** casual/local ↔ professional ↔ aspirational
5. **Heritage vs novelty:** established/traditional ↔ modern/startup
6. **Emotional register:** reassuring ↔ energetic ↔ exclusive ↔ trustworthy

### Mapping rules (illustrative, to be encoded)

| Signal cluster | Whitespace | Type | Color | Grid | Imagery | Motion | Narrative |
|---|---|---|---|---|---|---|---|
| Premium + sensory + aspirational (hotel, lux salon, architect) | Very generous | Editorial serif/contrast | Refined neutral + 1 luxe accent | Asymmetric/editorial | Cinematic original | Purposeful scroll | Editorial long-form |
| Premium + considered + professional (law, architecture firm) | Generous | Confident serif or geometric | Restrained, character-derived | Structured, precise | Original/office/concept | Subtle | Authority + proof |
| Functional + local + value (mechanic, budget salon) | Moderate | Humanist sans, legible | Neutral + 1 practical accent | Standard 12-col | Real team/space | Minimal | Clear benefit + CTA |
| Energetic + social (fitness, trend salon) | Moderate–generous | Bold condensed/geometric | High-energy accent | Dynamic | People/action | Lively micro | Community/energy |
| Image-led peer-judged (photographer) | Max, chrome-min | Type recedes | Monochrome | Portfolio grid | Own work dominates | Minimal | Portfolio-first |

**Decision type:** This matrix is **Hybrid** — deterministic *parameter ranges* per character cluster, **AI selects** the specific execution (which serif, which accent hue, which hero crop) conditioned on the vector. The character vector itself is **AI-extracted** from business signals (deterministic schema, AI fill).

---

# 15. Bespoke-vs-Template Detection Rules

Goal: the generator should be able to *self-audit* whether its output looks bespoke or template-derived, and a reviewer agent can score it.

### Signals of TEMPLATE-LOOKING (penalize)
- Default system/web-safe font for brand moments [S23].
- Stock photo clichés (handshake, laptop-coffee, diverse-team-conference) [S23].
- Rainbow/category-colored nav or icons without hierarchy.
- Symmetric, centered, identical-everywhere section padding with no breakout.
- Generic copy ("We help businesses grow," "Welcome to our website").
- Every industry using the same accent (all law firms navy, all restaurants red).
- No original imagery of the actual business.
- Decorative motion with no function.
- Low-contrast "elegant" gray text.

### Signals of BESPOKE / PREMIUM (reward)
- Typeface chosen for the brand's personality [S23].
- Original photography of real team/space/work [S23].
- Restrained 2–3 color palette with intentional roles [S23].
- Precise, consistent grid + alignment; deliberate asymmetric breakouts [S23, S14].
- Specific, confident, audience-named copy [S23, S24].
- Fast load (premium feel requires speed) [S23, S9].
- Motion that clarifies, respects reduced-motion [S17, S6].
- Character-driven color/type, not industry cliché (Section 14).

**Decision:** Deterministic *checklist/lint* (each signal = score) + AI *holistic* judgment of coherence. Confidence: High for checklist; Medium for AI coherence scoring (needs calibration).

---

# 16. Anti-Pattern Library

| # | Anti-pattern | Why bad | Evidence | Fix |
|---|---|---|---|---|
| AP-1 | Stock-photo clichés | Kills credibility instantly | [S23] | Original photography |
| AP-2 | Low-contrast gray text | Fails WCAG, looks "elegant-cheap" | [S6, S23] | Meet 4.5:1 |
| AP-3 | Rainbow category colors | Chaotic, non-hierarchical | [S23, S12] | ≤3 hues, semantic tokens |
| AP-4 | System-font-for-brand | Generic feel | [S23] | Intentional type pairing |
| AP-5 | Carousel hero with auto-rotate | Hides content, hurts UX | NN/g (carousel misuse, doctrine) | Single strong hero |
| AP-6 | Decorative motion only | Distracts, perf cost | [S17, S6] | Functional motion only |
| AP-7 | Vague superlative copy | Signals uncertainty | [S23, S24] | Specific outcomes |
| AP-8 | CTA before trust | Ignored ask | [S24, S3] | Proof → CTA |
| AP-9 | 12-field lead form | Abandonment | [S19, S2] | Min fields |
| AP-10 | Hamburger-only desktop nav | Hides navigation | [S2, S6] | Persistent nav |
| AP-11 | Template-per-industry | Interchangeable brands | doctrine | Character-driven (S14) |
| AP-12 | Autoplay sound/video | Jarring, accessibility fail | WCAG 1.4.2 [S6] | User-initiated |
| AP-13 | Inconsistent spacing/type | Perceived low quality | [S13, S2] | Tokens, scale |
| AP-14 | Full-screen takeover modals on entry | Blocks value, frustrates | NN/g (intrusive interstitials) | Delayed/exit intent |
| AP-15 | Ignoring mobile performance | Majority traffic loses | [S9, S38] | Vitals budget |

---

# 17. Deterministic vs AI Decision Framework

### 17.1 What MUST be deterministic (rules / hard gates)
- All **Accessibility (A-01…A-10)** — legal + ethical floor. [S6]
- **Contrast (C-03)**, **target size (UX-05, A-09)**, **reduced motion (M-02)**.
- **Spacing scale (G-02)**, **type scale (T-01)**, **type min size (T-02)**, **typeface count cap (T-03)**.
- **Grid system (G-01, G-05)**, **mobile-first (G-06, R-01…R-06)**.
- **Core Web Vitals budget (M-04)**.
- **Conversion skeleton order (N-02, CV-02)**, **min-field forms (CV-03)**.
- **Bespoke/template lint (Section 15)** as a *checklist*.

*Rationale:* These are stable, evidence-backed, low-taste-risk, and errors are costly. Encode as validated constants/tokens in `lib/design` + `lib/render` (per repo architecture).

### 17.2 What SHOULD be AI-directed (judgment, constrained)
- **Specific typeface pairing** (from character vector) — taste, but validated by T-03/T-05.
- **Accent hue & palette derivation** (from character) — taste, validated by C-03/C-01.
- **Hero art direction / crop / treatment** — taste, validated by I-03 perf + contrast.
- **Narrative angle & copy voice** — language, validated by N-03 specificity lint.
- **Asymmetry/editorial degree** (G-04) — gated by character cluster.
- **Motion choreography style** (M-03) — gated by character + M-02/M-04.
- **Character-vector extraction** from business signals — AI fill of deterministic schema.

*Rationale:* These need perceptual/taste judgment and vary by business; rules can't capture "which serif fits this architect." But each is *bounded* by deterministic gates so AI can't violate the floor.

### 17.3 What is HYBRID
- **Section sequence emphasis**, **spacing emphasis (G-03)**, **image treatment system (I-04)**, **micro-interaction taste (M-05)**, **sticky-CTA gating (R-07)** — deterministic presence/rules + AI tuning.
- **Industry matrix (S13)** is a *weak deterministic prior* that AI may override with character signals.

### 17.4 Governance principle
> Deterministic rules define the **floor and the vocabulary**. AI chooses **the sentence**. Every AI choice is passed through the deterministic validators before render. This matches the repo's hybrid doctrine (deterministic system + AI only where it adds value; evidence authoritative).

---

# 18. Evidence / Sources

Registry of sources fetched & reviewed for this document. (50 fetches; ~38 unique useful; some 404 indicate link-rot, noted.)

| ID | Source | URL (as fetched) | Type | Use | Quality |
|---|---|---|---|---|---|
| S2 | NN/g — 10 Usability Heuristics | nngroup.com/articles/ten-usability-heuristics | Timeless UX (A) | P-01…P-10, UX | ★★★ Authoritative |
| S3 | NN/g — Aesthetic-Usability Effect | nngroup.com/articles/aesthetic-usability-effect | Timeless UX (A) | P-11, doctrine | ★★★ Authoritative |
| S4 | NN/g — F-Shaped Pattern | nngroup.com/articles/f-shaped-pattern-reading-web-content | Timeless UX (A) | UX-02 | ★★★ Authoritative |
| S6 | W3C/WCAG 2.1 Quickref | w3.org/WAI/WCAG21/quickref | Accessibility (A) | A-01…A-10, C-03 | ★★★ Authoritative (standard) |
| S7 | W3C WAI — Intro to Accessibility | w3.org/WAI/fundamentals/accessibility-intro | Accessibility (A) | A-* | ★★★ Authoritative |
| S9 | web.dev — Core Web Vitals | web.dev/articles/vitals | Performance (A/B) | M-04, I-03 | ★★★ Authoritative |
| S10 | NN/g — How Users Read on the Web | nngroup.com/articles/how-users-read-on-the-web | Timeless UX (A) | UX-01 | ★★★ Authoritative |
| S11 | web.dev — Learn Accessibility | web.dev/learn/accessibility | Accessibility (A) | A-*, M-02 | ★★★ Authoritative |
| S12 | Material Design 3 — Color/Typography | m3.material.io/styles/color, /typography | Design system (B) | C-01,C-02,T-01,T-03 | ★★ Strong |
| S13 | Atlassian — Spacing | atlassian.design/foundations/spacing | Design system (B) | G-02 | ★★ Strong |
| S14 | Atlassian — Grid | atlassian.design/foundations/grid | Design system (B) | G-01 | ★★ Strong |
| S17 | Atlassian — Motion | atlassian.design/foundations/motion | Design system (B) | M-01,M-03,M-05 | ★★ Strong |
| S18 | Atlassian — Typography | atlassian.design/foundations/typography | Design system (B) | T-02,T-04 | ★★ Strong |
| S19 | Baymard — Ecommerce UX blog | baymard.com/blog | UX research (A) | CV-03, UX-06 | ★★★ Research-backed |
| S23 | Splash Creative — What makes a site feel premium | splashcreative.com/what-makes-a-website-feel-premium | Premium/editorial (B) | P-08, C-01, I-01, G-03, N-03, Section 15 | ★★ Commercial but concrete |
| S24 | createawebsite.io — Trust & Credibility guide | createawebsite.io/how-to-build-trust | Trust (B) | CV-05, doctrine | ★☆ Single commercial, directional |
| S33 | Microsoft Fluent 2 | fluent2.microsoft.design | Design system (B) | C-03 (contrast checker) | ★★ Strong |
| S38 | A List Apart — Responsive Web Design (Marcotte) | alistapart.com/article/responsive-web-design | Timeless UX (A) | G-06, R-01 | ★★★ Foundational |
| S39 | NN/g — Progressive Disclosure | nngroup.com/articles/progressive-disclosure | Timeless UX (A) | P-12 | ★★★ Authoritative |
| S40 | ReallyGoodDesigns — Web Design Trends 2026 | reallygooddesigns.com/web-design-trends-2026 | Trends (C) | M-03, Section 20D | ★☆ Trend roundup |
| S16 | Awwwards — Inspiration/Academy | awwwards.com/websites, /academy | Awards (B/C) | doctrine, premium | ★★ Curated |
| S8 | Apple HIG — Foundations/Color | developer.apple.com/design/human-interface-guidelines | Design system (B) | UX-05, C-05 | ★★★ Authoritative |
| S15 | IBM Carbon | carbondesignsystem.com | Design system (B) | cross-ref | ★★ Strong |
| S31 | Shopify Polaris | polaris.shopify.com | Design system (B) | cross-ref | ★★ Strong |
| Search index | DuckDuckGo synthesis queries | (search results) | secondary | source discovery | — |

**Notes on 404s / link-rot:** NN/g visual-hierarchy, several NN/g sub-articles, some Smashing/Design.dev/Webpeak/Material-principles pages returned 404 at fetch time. Principles drawn from those (e.g., visual hierarchy, hero usability) are marked doctrine-stable but should be re-sourced before encoding. See Open Questions.

### Contradictions (surfaced, not averaged)
1. **F-pattern: goal vs symptom.** NN/g [S4] says the F-shape is real *but* is a symptom of poor design and is "bad for users"; many practitioners treat it as a layout *target*. → Resolution: use F-awareness for placement, but design hierarchy that *breaks* pure F when deep reading is wanted. Document both; do not average into "always F."
2. **Aesthetic-usability effect: asset vs liability.** It helps trust [S3] but can mask real defects [S3 warns]. → Keep as doctrine that justifies craft BUT mandates real usability/perf validation; never use as excuse for broken flows.
3. **Trend volume vs restraint.** 2026 trends push VR/3D/noise/chromatic maximalism [S40]; premium doctrine pushes restraint [S23]. → Trends decorate (C/D), restraint governs (B). They coexist: maximalist *accents* on a restrained *base*.
4. **Industry color clichés vs character-driven color.** Common practice = industry palette (navy law, red restaurant); doctrine = character-derived [S23, Section 14]. → Character wins; industry is weak prior only.
5. **Original-photo mandate vs SMB reality.** Premium principle says stock kills credibility [S23]; but many SMBs lack original photos. → Generator must *brief* for original capture and gracefully degrade (honest contextual imagery), not fake stock.
6. **Motion for brand (trend) vs motion-for-function (systems).** Awwwards celebrates motion as identity [S40]; Atlassian/WCAG restrict to function + reduced-motion [S17, S6]. → Functional gate first; brand motion only inside the gate.

---

# 19. Open Questions (require further research)

1. **Trust-impact percentages [S24]** are from a single commercial blog; need a peer-reviewed / multi-source confirmation before encoding weighting (CV-05).
2. **Visual-hierarchy primary source** (NN/g) 404'd; re-source the canonical article to lock UX-03 evidence.
3. **Hero-image usability** NN/g article 404'd; re-source before encoding I-03 narrative.
4. **Font-pairing science:** we have practice (Material/Atlassian) but little empirical "which pairings convert." Need typography-research synthesis.
5. **Color-emotion reliability:** color-psychology claims are often overstated; need a skeptical source review (what's evidenced vs myth).
6. **Reduced-motion default scope:** how much motion to disable at `reduce` — needs a calibrated rule.
7. **Character-vector extraction reliability:** can an AI reliably score price-tier/consideration/sensory from listings+reviews? Needs validation on the 11 target verticals.
8. **Performance budget vs premium imagery:** quantify the LCP cost of cinematic heroes; set per-character budgets.
9. **Bespoke-scoring calibration:** the Section 15 checklist needs correlation with human "premium" judgments (could be a future eval dataset).
10. **Localization/RTL:** mostly out of scope for local SMBs but flag for multi-region.

---

# 20. Recommendations for integrating this intelligence into WebsiteAgent later

> Non-binding research output. Do NOT implement now. The repo's architecture (deterministic `lib/design` + `lib/render`; AI seams in `lib/sources` ListingHarvest and `lib/content` directContent) is the natural home.

1. **Encode the deterministic floor as design tokens + validators** in `lib/design`:
   - Spacing scale (8px base), type scale (fluid), color tokens (≤3 hues + neutrals + semantics), grid (12-col), contrast gate (4.5:1), target-size, reduced-motion, Core Web Vitals budget, accessibility checklist (A-01…A-10).
   - These are *constants*, not AI output. Provenance-preserving.
2. **Build a `characterVector` schema** (Section 14 dims) populated by an AI step from business signals (ListingHarvest data, reviews, category, copy). Deterministic schema, AI fill.
3. **Map characterVector → parameter ranges** (lookup table / rules), then let an AI *selection* step pick the specific typeface, accent hue, hero treatment inside the ranges — validated against the deterministic gates before render.
4. **Add a Bespoke-vs-Template linter** (Section 15) as a post-render QA gate; fail/penalize template signals; this directly serves the "not a template generator" goal.
5. **Add a Narrative skeleton** (N-02) as deterministic section order; AI fills content per block with a specificity lint (N-03).
6. **Treat trends (C) and fashionable effects (D) as a gated decoration layer** — allowed only inside perf/accessibility/motion gates, character-gated, and never governing layout.
7. **Wire Core Web Vitals + accessibility as hard CI gates** in the render/QA pipeline (matches repo's deterministic QA posture).
8. **Keep an evidence ledger** (this doc + source registry) so every rule cites its source and confidence; update when re-sourced (Open Questions).
9. **Future eval:** build a small human-judged "premium vs template" dataset (11 verticals) to calibrate the Section 15 scorer and the character→design mapper.
10. **Separation of concerns (doctrine):** deterministic rules = floor + vocabulary; AI = sentence. Never let AI lower the floor.

---

## Appendix A — Bucket summary
- **A) Timeless UX:** S2, S3, S4, S6, S7, S9, S10, S19, S38, S39 → encode as deterministic.
- **B) Premium visual:** S8, S12, S13, S14, S17, S18, S23, S33 → inform tokens + AI selection.
- **C) Current trends 2026:** S40, S16 → gated decoration only.
- **D) Fashionable but low-value:** decorative-only motion, autoplay sound, rainbow category color, stock clichés, entry modals → flag/block via anti-patterns AP-1/6/11/12/14.

## Appendix B — Confidence legend
★★★ = authoritative standard/research · ★★ = strong design-system/commercial with concrete detail · ★☆ = single/weak source, directional only.

*End of Design Intelligence Foundation v1.*
