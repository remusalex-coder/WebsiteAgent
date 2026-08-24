# ANTI-AI-SLOP LIBRARY (Phase 6)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Knowledge Architect
**Date:** 2026-08-17
**Knowledge class:** K4 (anti-knowledge) — prohibitive. Items here are things that *look like* quality and are not.
**Related existing code (verified, unchanged):** `lib/forge/anti-ai-gate.ts` already audits forbidden-assumption keywords, repetitive card grids, unmotivated decorative effects rejected by the Restraint Contract, and structural cloning of previous builds. `lib/qa/distinctness-gate.ts`, `lib/qa/visual-critic.ts`, `lib/design/fingerprint.ts` and `lib/memory/designMemory.ts` are the other relevant seams. This document supplies the **detectable signals** those gates would need in order to stop being advisory.

---

## 0. Honesty note

This is a doctrine and detection-design document. The anti-patterns are drawn from the project brief, from the visual evidence already gathered in `docs/AWWWARDS_PATTERN_LIBRARY.md` (25 live teardowns of award-winning sites — used here as a *contrast set*: what those sites do **not** do is as informative as what they do), and from the principle registry in `docs/Design_Intelligence_Foundation.md`. Where a threshold number is proposed (e.g. "more than 3 border-radius values"), it is **engineering judgement offered as a starting calibration, not a cited standard** — marked `[CALIBRATE]`. Claims about repository files were verified by reading them.

---

## 1. Why AI-generated sites look the way they do

Understanding the *mechanism* matters more than the list, because the list will change while the mechanism persists.

Four generative causes:

1. **Mode collapse toward the training median.** A model asked for "a beautiful website" produces the statistical centre of its training data. The centre of 2020–2025 web design is: dark hero, gradient, glass card, rounded corners, three-column feature grid, badge, testimonial, CTA. Producing this is not a failure of effort — it is the *expected* output, and it must be actively fought.
2. **Absence of constraint.** Human designers work against real constraints: this photograph exists and that one does not; this text is 340 characters; the client hates green. Absent constraints, a model fills space with plausible content, and plausible content is generic content.
3. **Uniform confidence.** A model has no reason to make one section more important than another, so all sections receive equal weight, equal padding, equal treatment. **The absence of hierarchy is the single strongest tell.** Human design is asymmetric because human attention is asymmetric.
4. **Decoration as a substitute for meaning.** With nothing specific to say, the system reaches for effects that signal effort — particles, gradients, animation, 3D. Effects then become the content, and the site reads as *about being a website* rather than about the business.

**The doctrine that follows:** slop is not fixed by adding more taste. It is fixed by **adding constraints, forcing hierarchy, grounding in real material, and requiring justification for every effect.**

---

## 2. Detection model: how a gate could measure this

Each anti-pattern below carries a `DETECTABLE SIGNAL` — something measurable from the generated HTML/CSS/DOM or from a rendered screenshot. Three classes of signal:

| Signal class | Measured from | Examples |
|---|---|---|
| **S-STATIC** | Parsed HTML/CSS, no rendering | Count of distinct `border-radius` values; gradient count; badge-element count; CTA repetition; section-count; copy phrase-list matches. |
| **S-LAYOUT** | Computed layout / geometry | Section-height variance; scale ratio between largest and smallest type; whitespace ratio; grid uniformity; column-count repetition. |
| **S-VISION** | Rendered screenshot | Palette extraction; focal-point detection; contrast distribution; stock-photo treatment uniformity. Note: `lib/qa/visual-critic.ts` exists but is a **no-op unless VISION_\* is configured** — so S-VISION signals must not be relied on as the only defence for anything important. |

**Design rule for the gate:** prefer S-STATIC and S-LAYOUT signals. They are deterministic, offline-capable, cheap, and cannot silently pass when a vision service is unavailable. A gate whose failure mode is "pass" is not a gate.

**Second design rule:** every signal below is a **smell, not a verdict**. Rounded corners are not a crime; *eleven different unmotivated radius values with no system* is. Therefore signals should be scored and accumulated, with a threshold on the total, and any single signal overridable by a recorded justification from the signature contract (`EXPERIENCE_SIGNATURE_SYSTEM.md` §11 `FORCES`/`FORBIDS`).

---

## 3. The library

Format per item: **WHY IT FEELS AI-GENERATED / HOW TO AVOID IT / WHAT TO DO INSTEAD / DETECTABLE SIGNAL**.

---

### A-01 — Generic hero

**Why it feels AI-generated.** A centred headline of 6–10 words, a one-line subhead, two buttons ("Get Started" / "Learn More"), over a gradient or a lightly darkened stock image. It is the training median made visible. It communicates nothing specific and could be transplanted onto any business in any industry without editing.

**How to avoid it.** Forbid the composition, not just the words. Require the first screen to be derived from the signature contract, and require it to contain at least one thing that could only belong to this business — a real photograph of the real premises, a real price, a real product name, a real sentence spoken by the owner. Notably, in the 25-site teardown, the dominant first-screen strategy is **typographic**, not "headline over photo": several winners have no `h1` in the conventional sense, and hero type runs 100–150px where a generic template runs 40–56px.

**What to do instead.** Pick one of: (a) *one* real photograph at full bleed with a single short line and no buttons; (b) type as the hero at extreme scale (7× the body size is documented in the teardown set) with no image at all; (c) the useful fact as the hero — the menu, the price, the timetable, the phone number, presented as designed content rather than as a subordinate section; (d) withhold entirely: an empty threshold screen, when the signature earns it.

**Detectable signal.** `S-STATIC`: first-section text length between 20–120 chars **and** ≥2 anchor/button elements **and** background is a gradient or single stock image **and** headline matches a generic-phrase list. `S-LAYOUT`: the first section's largest type size is <3× the body size `[CALIBRATE]` — a low scale ratio is the strongest single indicator of a template hero.

---

### A-02 — Excessive gradients

**Why.** Gradients are the cheapest way to make a flat surface look "designed", so a generative system reaches for them constantly: gradient backgrounds, gradient text, gradient borders, gradient buttons, gradient overlays on top of gradient sections. The result reads as a *style with no source* — the colours come from nowhere in the business's reality.

**How to avoid.** Require every colour to have a provenance: derived from a real photograph, from an existing brand asset, or assigned a semantic job. A gradient must be justified as depicting something (light falling, depth, a material) rather than as filling space. The teardown evidence is instructive: award-winning sites cluster at **2–9 palette entries**, frequently 2–4, with several at 0 detected background colours (i.e. one flat surface).

**What to do instead.** Flat surfaces with a strict palette of 2–4 colours, each with a defined role (surface, ink, accent, signal). Where depth is wanted, use *real* light from real photography, or a single subtle tonal shift, not a hue rotation. If a gradient is used at all, use exactly one, and let it be the site's deliberate signature.

**Detectable signal.** `S-STATIC`: count of `linear-gradient|radial-gradient|conic-gradient` occurrences > 3 `[CALIBRATE]`; gradient applied to text (`background-clip: text`) present; distinct hue count in gradient stops > 3.

---

### A-03 — Meaningless glassmorphism

**Why.** `backdrop-filter: blur()` on a translucent card is a 2021 trend idiom that signals "modern" with zero informational content. Applied without a light source or a layering logic, it produces cards that appear to float above nothing. It also frequently *destroys contrast*, converting a stylistic choice into an accessibility failure.

**How to avoid.** Permit blur only where there is a real spatial reason: a genuinely overlapping layer, a sticky bar over moving content, a modal above a scene. Never on a card sitting on a flat background — there is nothing to see through.

**What to do instead.** Establish layer separation with the cheap, honest tools: a different flat surface tone, a hairline rule, actual spacing, or a shadow with a consistent light direction across the whole page. If nothing is behind the element, nothing should show through it.

**Detectable signal.** `S-STATIC`: `backdrop-filter` present where the ancestor background is a solid colour (nothing to blur) — a near-perfect detector for unmotivated glass; also `rgba()` surface fills with alpha 0.05–0.3 combined with blur. `S-VISION`: text contrast on those surfaces below WCAG 4.5:1 (this is a K1 failure regardless of taste).

---

### A-04 — Generic cards

**Why.** The card grid is the model's default answer to "present multiple things": a 3-column row of identical rounded rectangles, each with an icon, a bold 2–4 word title, and two lines of body copy. It makes every item look equally important — which is another way of saying that nothing is important. It is also the single most recognisable AI-site shape, and `lib/forge/anti-ai-gate.ts` already flags repetitive card grids.

**How to avoid.** Ban uniform repetition as a *default*. If a set of things is genuinely a set (menu items, room types, class times), design the set as an object with internal hierarchy — not as a row of clones. Ask which item matters most and give it more space, or a photograph, or the first position with a size that says so.

**What to do instead.** An editorial list with real hierarchy and generous space; a table when the content is comparative data (tables are honest and underrated); one item shown large with the rest as compact text; an asymmetric layout where item size reflects real importance.

**Detectable signal.** `S-STATIC`: ≥3 sibling elements with identical class signatures, identical child structure, and text lengths within ±20% of each other. `S-LAYOUT`: ≥3 sibling boxes with identical computed width and height, in a repeating 3- or 4-column pattern, appearing in ≥2 separate sections `[CALIBRATE]`.

---

### A-05 — Predictable sections

**Why.** The canonical stack: Hero → Features (3 cards) → About → Testimonials → Stats → CTA → Footer. Every AI site has it because it is the median of every template. A visitor who has seen five of these recognises the sixth instantly, and correctly infers that no thinking occurred.

**How to avoid.** Derive section order from the signature and from the visitor's actual task, not from a canonical stack. Require that at least one conventional section be **deleted** and at least one be **out of conventional order**, both justified. The teardown set is striking here: several award-winning sites resolve to **one continuous section**, not seven stacked ones.

**What to do instead.** Order by user need (a hungry visitor gets the menu first). Merge sections that repeat a job. Delete testimonials if there are no real ones. Delete stats always unless verified. Consider a single continuous composition rather than a stack of blocks.

**Detectable signal.** `S-STATIC`: section-heading sequence matches a known canonical order at ≥70% similarity `[CALIBRATE]`; presence of all of {features, about, testimonials, stats, cta} in one page. `S-LAYOUT`: section-count in the 6–9 range with low height variance (see A-17).

---

### A-06 — Unnecessary badges

**Why.** Small pill-shaped labels above headlines ("✨ New", "Trusted by 500+ teams", "AI-Powered") are a SaaS-landing-page idiom that a model applies indiscriminately, including to bakeries. They usually carry no verifiable information, and the sparkle emoji has become a literal marker of machine authorship.

**How to avoid.** Permit a badge only when it encodes a verified, decision-relevant fact that cannot be better expressed as ordinary text. Ban decorative iconography in badges entirely. Any numeric badge is subject to the statistics prohibition (A-07).

**What to do instead.** If the fact matters, write it as a sentence with a source. If it does not matter, delete it. Real credibility comes from named specifics — a licence number, a named practitioner, a real client name — not from a pill.

**Detectable signal.** `S-STATIC`: small inline elements with `border-radius: 9999px|full` and text under ~30 chars positioned immediately before an `h1`/`h2`; presence of ✨🚀🎉 in markup; badge text matching an unverified-claim pattern (`\d+\+`, "trusted by", "powered by").

---

### A-07 — Fake statistics

**Why.** "500+ Happy Clients", "98% Satisfaction", "10 Years Experience", "24/7 Support" — a four-column counter row is the model's reflex for building trust, and the numbers are almost always invented. This is not merely a style problem: it is a **truth violation** and, for a real business, potentially a legal and reputational injury. It is also trivially detectable by anyone who knows the business.

**How to avoid.** Hard prohibition. Statistics require `VERIFIED_FACT` at `HIGH` confidence per `TRUTH_AND_EVIDENCE.md` §5. Absent that, the section does not exist. Round, suspiciously pleasing numbers with a `+` are the classic fabrication shape.

**What to do instead.** Use one real, sourced number if one exists, stated plainly with its provenance. Otherwise substitute *specificity* for *quantity*: a named client, a dated project, a real review quoted verbatim with attribution, a real credential.

**Detectable signal.** `S-STATIC`: ≥3 sibling elements each containing a number with `+`/`%` plus a short label; any number not traceable to a claim id in the evidence dossier. **This should be a blocking gate, not a warning** — it is the cheapest high-value check in the whole library, and it reuses the existing forbidden-assumption machinery in `lib/forge/anti-ai-gate.ts`.

---

### A-08 — Generic copy

**Why.** "Welcome to our website." "We are passionate about quality." "Your journey starts here." "Excellence in everything we do." "Let's build something amazing together." These sentences are grammatically perfect, semantically empty, and interchangeable between a dental clinic and a car wash. They are what a model writes when it has no facts.

**How to avoid.** Require every sentence to contain at least one specific: a number, a name, a place, a material, a time, a process step, a price. Maintain a rejection phrase-list and fail on match. Enforce evidence-language authorship (already an architectural decision in this repo — ADR 0007, `lib/content/language.ts`).

**What to do instead.** Write from the dossier. "We open at 6:20 and the rye is usually gone by nine" outperforms every sentence in the paragraph above, and it is *unfalsifiable-proof*: it is either true or it is not, and if it is true it is unmistakably this business.

**Detectable signal.** `S-STATIC`: match against a curated generic-phrase corpus; **specificity density** — proportion of sentences containing a proper noun, number, or unit below ~30% `[CALIBRATE]`; adjective-to-noun ratio above a threshold; presence of "passionate", "seamless", "elevate", "unlock", "journey", "cutting-edge", "state-of-the-art", "tailored to your needs", "we believe".

---

### A-09 — Excessive rounded corners

**Why.** A model rounds everything, because rounding reads as "friendly and modern" and carries no risk. The result is a page with no edges anywhere, no structural firmness, and — critically — **no system**: 8px here, 12px there, 16px on the card, 24px on the image, `9999px` on the button, chosen arbitrarily. Inconsistency, not roundness, is the tell.

**How to avoid.** Require a radius *system*: at most two values, both justified, applied by element role. Permit 0 as a legitimate and frequently superior choice. Note that in the teardown set, sharp-edged editorial layouts are common among winners; heavy uniform rounding correlates with template output rather than award output.

**What to do instead.** Choose an edge language deliberately. Sharp edges for editorial, architectural, legal, institutional registers. One consistent soft radius where touch-friendliness or informality is the actual intent. Never round photographs by reflex — a rounded photo corner is almost always a decision nobody made.

**Detectable signal.** `S-STATIC`: count of distinct non-zero `border-radius` values > 2 `[CALIBRATE]`; radius applied to `img`/`video` elements without a stated reason; presence of both `9999px` pills and small-radius cards in the same page (two competing edge languages).

---

### A-10 — Decorative particles without purpose

**Why.** Floating dots, drifting blobs, animated mesh gradients, star fields, orbiting rings. These exist purely to make a static page appear alive. They consume main-thread and GPU budget, they distract from content, they harm `prefers-reduced-motion` users, and they are the visual equivalent of a screensaver. A visitor's eye is drawn to movement, so decorative motion actively *steals* attention from the message.

**How to avoid.** Require every animated element to answer: what does this movement *mean*? Movement that depicts nothing is deleted. `lib/forge/anti-ai-gate.ts` already treats unmotivated decorative effects as a Restraint Contract violation — this item defines what to measure.

**What to do instead.** Let motion belong to real things: a photograph that reveals as it enters, a state that changes, a queue that advances, an actual process depicted. If the page needs life, use *content* — a real image, a real number that changed today — rather than abstract particles.

**Detectable signal.** `S-STATIC`: presence of a canvas or absolutely-positioned animated element with no text content and no accessible name, running an infinite animation (`animation-iteration-count: infinite`); count of `@keyframes` with infinite loops > 1 `[CALIBRATE]`; particle-library imports. Additional `S-STATIC` K1 check: any infinite animation without a `prefers-reduced-motion` guard is a hard failure, not a smell.

---

### A-11 — Repeated CTAs

**Why.** The same "Get Started" button placed in the header, the hero, after every section, and in the footer. It comes from conversion-optimisation folklore misapplied, and it produces a page that nags. Repetition also *destroys* the CTA's authority: if a button appears eight times, none of the eight is a moment.

**How to avoid.** One primary action per page, appearing where the visitor has just been given the reason to take it. Secondary actions are text links, not buttons. Where a business's real conversion is a phone call (very common for local businesses), the "CTA" is a phone number in the header, and a form is *not* an improvement — it adds a step.

**What to do instead.** Earn one moment. Place the action after the strongest evidence, styled so it is unmistakably the single most prominent interactive element on the page. Let the header hold contact information rather than a competing button.

**Detectable signal.** `S-STATIC`: count of buttons/anchors sharing identical text (normalised) > 2 `[CALIBRATE]`; count of elements with the primary-button class > 3; ratio of primary to secondary actions above 1:1.

---

### A-12 — Predictable spacing

**Why.** Every section gets the same vertical padding, so the page has a metronomic rhythm with no phrasing. Human-designed pages compress and expand: a tight caption under a large image, then a huge silence before a statement, then dense practical information. Uniform spacing is the layout equivalent of a monotone voice.

**How to avoid.** Require deliberate rhythm variation: at least one section with markedly compressed spacing and at least one with markedly expanded spacing, chosen because of what the content is doing. Keep the *scale* consistent (one spacing scale is a K1-adjacent discipline, already implemented via `lib/design/tokens.ts`) while varying the *selection* from that scale.

**What to do instead.** Group tightly what belongs together (proximity does the work of a border), and open generous space where you want a pause. Use whitespace as emphasis: the largest silence should sit next to the most important thing.

**Detectable signal.** `S-LAYOUT`: coefficient of variation of section vertical padding below ~0.15 `[CALIBRATE]` (too regular); also the inverse failure — spacing values not drawn from a single scale (chaos rather than rhythm). Both are defects; they are distinguished by whether values are *systematic*.

---

### A-13 — Meaningless animation

**Why.** Every element fades and slides up 20px as it enters the viewport, in the same direction, with the same duration, forever. It is applied globally because it is a one-line setting, and it makes the page feel like a slideshow of identical arrivals. It also delays content, harms perceived performance, and can trigger layout instability.

**How to avoid.** Ban global scroll-reveal as a default. Animation must be assigned per element with a stated purpose (`MOTION_LIBRARY.md` supplies the principles). If everything animates, nothing is emphasised.

**What to do instead.** Animate at most a small number of moments, each doing a job: revealing a single hero image, transitioning between states, providing feedback on an action, or depicting a real process. Everything else appears instantly — instant is not a failure, it is a *feature*, and it is what a fast, confident site feels like.

**Detectable signal.** `S-STATIC`: proportion of sections carrying an identical entrance-animation class above ~60% `[CALIBRATE]`; a single animation duration/easing pair reused across >80% of animated elements; identical transform direction on all reveals.

---

### A-14 — Overuse of dark luxury

**Why.** Near-black background, thin light serif, gold or amber accent, wide letter-spacing on an uppercase label. This is the model's universal answer to "premium", applied to bakeries, dentists, gyms and law firms alike. It is not wrong in itself — it is wrong as a *reflex*, and it fails specifically because it makes every "premium" business look like the same premium business.

**How to avoid.** Require the register to be derived from the business's verified material and audience, not from the word "premium" in the brief. Light, bright, high-contrast, or even loud can all be premium. If dark is chosen, it must be because the real photography, the real space, or the real product demands it — and dark must then survive the K1 contrast floor, which thin gold-on-black frequently does not.

**What to do instead.** Derive the palette from the actual material (`lib/art/palette.ts` exists for this). A bakery's real palette is flour, crust, and steel — not black and gold. Achieve "premium" through space, alignment precision, restraint in colour count, and typographic quality, which is what the teardown evidence actually shows.

**Detectable signal.** `S-VISION`/`S-STATIC`: background luminance below ~0.1 **and** accent hue in the gold/amber range **and** a thin-weight serif display face **and** letter-spaced uppercase labels — the conjunction is the tell, not any single element. Cross-check against `lib/memory/designMemory.ts`: if the same dark-luxury fingerprint recurs across an industry scope, it is a systemic convergence failure.

---

### A-15 — Generic serif + sans combination

**Why.** Playfair Display + Inter. Or Cormorant + Montserrat. The pairing appears because it is the most-recommended pairing on the internet, so it is the statistical centre of the model's typographic knowledge. It is competent and completely anonymous — and because it is *everywhere*, it actively signals default-ness.

**How to avoid.** Require a typographic decision with a stated rationale connected to the register and the signature. Note the teardown evidence: winners use distinctive, often licensed or unusual faces (Signifier, Founders Grotesk, PolySans, Neue Montreal, Editorial New, PP Fraktion Mono, Thunder), and frequently build **three-family systems** including a mono — a structure that reads as considered rather than defaulted.

**What to do instead.** Choose faces for what they *do*: a face with real character for display, a workhorse for text, optionally a mono or a condensed face as a third voice with a specific job (labels, data, captions). Consider a single-family system used across an extreme size range — one of the most reliable routes to a designed feel with the fewest moving parts. Where licensing constrains choice, prefer a well-drawn less-common open face over the most-recommended one.

**Detectable signal.** `S-STATIC`: font-family stack matches a known over-used-pairing list; total families = 2 with exactly one serif display + one geometric/neo-grotesque sans; type scale ratio between display and body below 3× (see A-01) — anonymity and low scale contrast usually travel together.

---

### A-16 — Excessive "premium" language

**Why.** "Bespoke", "curated", "artisanal", "handcrafted", "timeless elegance", "unparalleled", "meticulously", "indulge". A model uses these because the brief said premium and these words are premium-adjacent. They are also *claims* — often unverified ones — and they read as a business insisting on a quality rather than demonstrating it.

**How to avoid.** Maintain a prohibition list and enforce it in content QA (`lib/content/quality.ts` is the natural seam). More fundamentally: quality claims must be replaced by quality *evidence*. Note the overlap with `TRUTH_AND_EVIDENCE.md` — superlatives are effectively never satisfiable and are prohibited by default.

**What to do instead.** Show the thing. "Shaped by hand at 5am" (if verified) beats "handcrafted with passion". A photograph of the real workshop beats "artisanal". The most premium-feeling copy is usually the plainest: a fact, stated once, with confidence, and nothing after it.

**Detectable signal.** `S-STATIC`: count of matches against a premium-adjective corpus per 100 words above ~2 `[CALIBRATE]`; any superlative claim ("the best", "the finest", "the only") without a verified claim id.

---

### A-17 — Identical section rhythms

**Why.** Distinct from A-12 (spacing): here every section has the same *structure* — heading, subheading, content, all left-aligned or all centred, all full-width, all approximately one viewport tall. The page becomes a stack of interchangeable slabs. This is the structural fingerprint of generated layout, and it is exactly what `lib/design/fingerprint.ts` and `lib/qa/distinctness-gate.ts` are positioned to catch.

**How to avoid.** Require structural variation as an explicit design decision: alternate full-bleed with narrow measure, break the grid at least once with intent, vary alignment where the content justifies it, and vary section height substantially. Require at least one section that is *not* a heading-plus-content block.

**What to do instead.** Let content shape structure. A single sentence deserves a screen of its own. A menu deserves a dense, tabular, unglamorous treatment. A photograph deserves full bleed and no heading at all. Sections should differ because their jobs differ.

**Detectable signal.** `S-LAYOUT`: variance of section heights below a threshold; ≥70% of sections sharing the same internal element sequence (`h2 → p → div`) `[CALIBRATE]`; all sections sharing the same content width and alignment; count of sections within ±10% of viewport height above 4.

---

### A-18 — Stock-style photography treatment

**Why.** Every image cropped to the same 16:9 or 4:3 box, same size, same corner radius, same slight overlay, same subject distance — often smiling people in a context unrelated to the business. Uniform treatment tells the visitor these images are *interchangeable*, which tells them the images are not real. This is compounded by an evidential problem: stock imagery presents a fiction as the business's reality, which `TRUTH_AND_EVIDENCE.md` (F-15) treats as a violation.

**How to avoid.** Use only verified real assets (`realPhotoAssets` already exists in `lib/forge/types.ts`). Where real photography is poor, **crop and treat rather than replace** — a tight crop of a real detail is honest and often stronger than a wide shot of a mediocre room. Where there is nothing usable, drop to a typographic direction (`EXPERIENCE_SIGNATURE_SYSTEM.md` §8) rather than importing fiction.

**What to do instead.** Vary crop, scale, and distance with intent: one wide establishing image, several tight material details, one image of a person actually connected to the business. Apply a *consistent grade* (the same light and colour logic) while varying *composition* — that combination is what art direction actually means.

**Detectable signal.** `S-STATIC`: all images sharing one aspect ratio and one radius; images sourced from known stock domains; image count high with identical container dimensions. `S-VISION`: near-uniform saturation/exposure histograms across all images with no variation in subject distance.

---

### A-19 — Unnecessary 3D

**Why.** A WebGL scene, a rotating abstract object, or a floating isometric illustration on a site that sells bread. It costs hundreds of kilobytes to megabytes, delays LCP, occupies the GPU, breaks on low-end devices, and depicts nothing. It is the most expensive way to say nothing, and it is often chosen precisely *because* it looks like effort.

**How to avoid.** Require that 3D pass three tests: (1) it conveys something no photograph or CSS could convey; (2) it is central to the signature, not adjacent to it; (3) it survives the cost rules in `PERFORMANCE_KNOWLEDGE.md`. A configurator for a real configurable product passes. An orbiting abstract blob does not.

**What to do instead.** For most businesses: a real photograph. Where dimensionality genuinely matters (architecture, property, a physical product with variants), consider photographic sequences, a floor plan, or an interactive image sequence — dramatically cheaper and often clearer. Where 3D is justified, budget it and provide a static first-paint fallback.

**Detectable signal.** `S-STATIC`: presence of three.js/babylon/r3f imports or a WebGL context; total 3D asset bytes over budget; a WebGL canvas in the first viewport on a site whose category is retrieval-dominant (see §4).

---

### A-20 — Interaction without purpose

**Why.** Custom cursors that make nothing easier, magnetic buttons that resist the pointer, hover effects that distort images for no reason, scroll-jacking that removes the visitor's control, horizontal scroll on a page that has no spatial logic. Each of these appears in genuinely great sites — which is why a model reproduces them without the surrounding justification. Removed from purpose, they degrade usability while signalling effort.

**How to avoid.** Require every non-standard interaction to name the user purpose it serves and pass the K1 accessibility floor (keyboard operable, focus visible, reduced-motion respected, no removal of native affordances). Scroll-jacking in particular should be prohibited by default: it breaks the one interaction every visitor already knows.

**What to do instead.** One signature interaction, maximum, chosen because it embodies the signature — and standard, fast, predictable behaviour everywhere else. Custom cursors are legitimate when they *carry information* (a "drag" affordance on a draggable gallery); they are slop when they merely replace the pointer with a circle.

**Detectable signal.** `S-STATIC`: `cursor: none` present; `wheel`/`scroll` handlers with `preventDefault`; hover-only affordances with no focus equivalent; interactive elements below the minimum target size; any custom interaction without a `prefers-reduced-motion` branch. Count of distinct custom interaction mechanisms > 1 `[CALIBRATE]`.

---

## 4. Cross-cutting rules

**R-SLOP-1 — Slop is measured in aggregate.** No single item above condemns a page. A scored total across all 20 signals, with a threshold, is the correct shape. A page scoring high on eight items is generic even if every individual choice is defensible.

**R-SLOP-2 — Justification overrides detection.** Any signal may be waived by an explicit entry in the signature contract's `FORCES` list (`EXPERIENCE_SIGNATURE_SYSTEM.md` §11). A dark-luxury palette derived from a verified jewellery workshop's real material is a decision; the same palette applied to a bakery by reflex is slop. **The difference is recorded reasoning, and reasoning is checkable.**

**R-SLOP-3 — The gate must fail closed.** `lib/qa/visual-critic.ts` currently returns `uncertain` with no reasons when `VISION_*` is unset, and `lib/qa/distinctness-gate.ts` treats zero reasons as a pass — so a run without vision credentials ships without visual QA. Any slop gate built from this document must therefore rest primarily on S-STATIC/S-LAYOUT signals, which work offline and deterministically. **A gate that passes when its evidence source is missing is not a gate.**

**R-SLOP-4 — Category-conditional severity.** The same pattern has different costs by business type:

| Pattern class | Retrieval-dominant business (bakery, car service, clinic) | Reputation-dominant business (agency, architect, artist) |
|---|---|---|
| Generic hero (A-01) | Fail | Fail |
| Fake statistics (A-07) | Fail (blocking) | Fail (blocking) |
| Generic copy (A-08) | Fail | Fail |
| Unnecessary 3D (A-19) | Fail | Conditional — may be the signature |
| Decorative particles (A-10) | Fail | Conditional |
| Custom cursor (A-20) | Fail | Conditional |
| Long loading sequence | Fail | Conditional |
| Dark luxury (A-14) | Conditional on material evidence | Conditional on material evidence |
| Predictable sections (A-05) | Warn — a conventional order may genuinely serve the task | Fail |

The asymmetry matters: **ambition on a retrieval-dominant site must be spent on craft, not on duration or spectacle.**

**R-SLOP-5 — The inverse failure exists.** Stripping a page until it communicates nothing is not restraint, and "no gradients, no motion, no images, grey Helvetica" is its own recognisable slop. `HUMAN_DESIGN_PRINCIPLES.md` covers restraint as a positive discipline: remove what does not carry meaning, not everything that carries decoration.

---

## 5. The two questions that catch most of it

Before delivery, two checks that subsume much of the list:

1. **Transplant test.** Could this page be used for a different business in a different industry by swapping the logo and the text? If yes, it is generic — regardless of how good it looks.
2. **Hierarchy test.** Name the single most important thing on the page. Is it visually the most important thing? If everything is equally weighted, no design decision was made.

A page that fails either test fails, even with a perfect Lighthouse score and a beautiful palette.

