# EXPERIENCE SIGNATURE SYSTEM (Phase 5)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Knowledge Architect
**Date:** 2026-08-17
**Knowledge class:** K2 (craft) with K1 gates and K4 prohibitions.
**Already implemented in the repo (verified, unchanged):** `lib/forge/signature.ts` implements the chain `BUSINESS TRUTH → HUMAN INSIGHT → CREATIVE TERRITORIES (×3) → SIGNATURE SELECTION → INTERACTION & VISUAL GRAMMAR → RESTRAINT CONTRACT`, with types `CreativeTerritory`, `ExperienceSignature`, `FactualDossier` in `lib/forge/types.ts`. This document supplies the *knowledge* that chain currently lacks: how to discover a signature, how to test it, how it propagates, and how it fails.

---

## 0. Honesty note

This is doctrine and method. It contains no external factual claims requiring citation; where it references real design practice, evidence lives in `docs/AWWWARDS_PATTERN_LIBRARY.md` (25 live teardowns) and `docs/Design_Intelligence_Foundation.md` (sourced principle registry). Repository claims were verified by reading the cited files. The example signatures in the project brief (bakery = fermentation, jewellery = light) are treated here as **illustrations of a shape, never as a lookup table** — §7 states explicitly why hardcoding them would reproduce the exact failure this system exists to prevent.

---

## 1. What an Experience Signature is

**Definition.** An Experience Signature is a **single organising idea, derived from verified specifics of one business, that determines what the site does with attention** — what is shown first, what is withheld, what moves, what is silent, what the composition rhymes with, and what the site refuses to do.

It is not a theme, a mood board, a colour palette, a tagline, or an adjective. Those are *consequences*. The signature is the **decision rule** upstream of them.

**The operational test:** a signature is real if it can *settle arguments*. Given two candidate hero compositions, the signature must be able to say which one is wrong and why. An idea that cannot reject anything is decoration, not a signature.

| Not a signature | Why | Signature-shaped alternative |
|---|---|---|
| "Warm and inviting" | Adjective. Rejects nothing. | "Heat as the visible agent: every image shows a surface changed by an oven." |
| "Modern and clean" | Genre label. Describes 10 million sites. | "Nothing on screen that the product does not need — one object, one price, one action." |
| "Premium luxury feel" | Category aspiration; usually means dark + serif. | "Withhold the product until the third screen; earn the reveal." |
| "Celebrating tradition" | Unfalsifiable, and usually unsourced (see `TRUTH_AND_EVIDENCE.md` F-02, F-26). | "The same three tools appear in every photograph, unchanged since the owner's stated 2011 opening." |

**Three properties every signature must have:**

1. **Specific** — it names something true of *this* business that is not true of most competitors.
2. **Falsifiable** — one can state evidence that would refute it (§5).
3. **Generative** — it produces at least five downstream decisions across different disciplines (§6). An idea that only changes the colour palette is a palette, not a signature.

---

## 2. Where signatures come from

The brief lists eleven extraction surfaces. Each is paired here with the **questions that mine it** and the **evidence tier required** (per `TRUTH_AND_EVIDENCE.md` §3), because a signature built on unverified material is unrecoverable downstream.

| Surface | Extraction questions | Evidence needed |
|---|---|---|
| **Business** | What does the money actually come from? What would collapse if removed? What does the owner do at 6am? | T1/T2 offering + business-model evidence. Never inferred from category (F-09). |
| **History** | What is documented — not implied by the name? What changed and when? What survived? | T1 self-assertion, attributed (F-07). Absent evidence ⇒ history is *not* a signature axis. |
| **Product** | What is physically true of it — weight, temperature, fragility, lifespan, scale? What is hard about making it? | T1 product evidence, real photographs. |
| **Location** | What is verifiably around it? What does the building do to light, sound, approach? | Geodata or imagery actually consulted. Never derived from address or city name (F-25, F-26). |
| **People** | Who is named, and what is their stated role? Who does the customer meet? | T1 only. Never invent a founder or chef (F-04). |
| **Materials** | What substances recur? What do they do — reflect, absorb, age, stain, shine? | Stated materials, or materials visible in verified real photos (as *material*, not as capability claim — F-14). |
| **Process** | What are the stages? What takes time? What is irreversible? What is repeated? | Stated process. Never assumed from craft vocabulary (F-06). |
| **Audience** | What state are they in when they arrive — hungry, anxious, comparing, celebrating, in a hurry, grieving? | Behavioural evidence: review language, enquiry patterns, service type. |
| **Culture** | What vocabulary do customers actually use for this thing? | Review corpus and the business's own copy — the *language of the evidence* (ADR 0007, `lib/content/language.ts`). |
| **Brand** | What identity already exists and constrains us? | T1 assets. Absent ⇒ we author art direction, not identity. |
| **Physical environment** | What does the space do to a body — compress, open, darken, echo? | Verified interior/exterior imagery. |

**Method note — the productive question is always physical.** Abstract questions ("what is the brand essence?") return generic answers. Physical questions ("what is hot, what is cold, what is heavy, what waits, what cannot be rushed, what is thrown away") return specifics, and specifics are what make a site look designed rather than assembled.

---

## 3. The discovery procedure

Seven steps. Steps 1–3 are evidence work; 4–5 are creative; 6–7 are gates.

**Step 1 — Inventory the verified.** Assemble only VERIFIED_FACT and FACT claims, plus the real asset inventory. Explicitly list the UNKNOWNs, because they are prohibitions (R-UNK-1) and, usefully, prohibitions narrow the search space.

**Step 2 — Find the anomaly.** Compare this business's verified specifics against the ordinary case for its category. What is *unusual*? A bakery that opens at 04:00 and sells out by 10:00 has scarcity as a fact. A law firm with two named partners and 40 years has continuity as a fact. **The anomaly is the raw material of distinctiveness.** If nothing is anomalous, say so — that is a legitimate finding, and §8 covers it.

**Step 3 — Name the human moment.** What is the customer actually doing at the moment they need this business? Not a persona — a moment. "Standing in a kitchen at 7pm realising there is no bread." "Comparing three clinics after a bad diagnosis." "Deciding where 90 people will stand next June." The moment determines what the first screen owes them.

**Step 4 — Generate candidate axes (3–5, deliberately divergent).** An axis is a triad or short phrase naming a *tension or transformation*, not a topic. Good axes name something that **changes**: time→state, invisible→visible, raw→finished, private→shared, many→one. The repo already generates three radically different territories (`lib/forge/signature.ts`); this step supplies the criteria those territories should satisfy.

**Step 5 — Select.** Score each candidate against §4's rubric. Choose the highest scorer that survives §5's falsification test. Record why the others were rejected — that record is what prevents the next run from silently drifting to the safest option.

**Step 6 — Falsify.** §5. A candidate that cannot fail is discarded.

**Step 7 — Contract.** Write the signature down as: the idea, the five decisions it forces, the five things it forbids, and the evidence it rests on. The "forbids" list is what makes it enforceable — and it is the natural feed for the restraint contract and `forbiddenAssumptions` mechanisms that already exist.

---

## 4. Signature quality rubric

Score 0–2 on each; a signature needs ≥10/14 and **zero zeros on rows marked (gate)**.

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| **Specificity (gate)** | True of the whole category | True of some competitors | True of this business, traceable to a named verified fact |
| **Evidence (gate)** | Rests on assumption or a forbidden inference | Rests on FACT/INFERENCE | Rests on VERIFIED_FACT, quotable |
| **Falsifiability (gate)** | Nothing could refute it | Vaguely testable | A specific finding would refute it |
| **Generativity** | Changes only colour/type | Changes composition | Forces decisions in ≥5 disciplines incl. what to omit |
| **Prohibitive power** | Forbids nothing | Forbids a few clichés | Forbids specific attractive options |
| **User service** | Serves the idea at the user's expense | Neutral | The idea *is* how the user is served faster |
| **Non-cliché** | Is the category's stock metaphor | Adjacent to it | Would surprise a competitor |

**Row 6 is the one most often failed.** A signature that makes a hungry customer scroll through a fermentation narrative to find opening hours has inverted the priority. The strongest signatures are those where the organising idea *is* the fastest route to what the user came for.

---

## 5. The falsification test

For each candidate signature, state: **"This signature is wrong if ___."**

If the blank cannot be filled with something checkable, the signature is unfalsifiable and must be discarded.

Worked shape (hypothetical, illustrative only):

- Candidate: *scarcity — what exists today is finite and disappears.*
- Falsified if: the business's verified hours/production evidence shows continuous all-day availability, or the offering is made-to-order rather than batch.
- Consequence if falsified: the whole visual strategy of "empty shelves as a positive" collapses; do not proceed.

**Three failure signatures the test catches:**

- **Unfalsifiable** — "craftsmanship". No evidence could refute it, therefore no evidence supports it.
- **Contradicted** — an idea the evidence actively refutes (a "quiet, intimate" signature for a venue whose verified capacity is 400).
- **Borrowed** — an idea true of the category rather than the business; it will produce a site indistinguishable from its competitors and will pass a naive quality review while failing the actual purpose.

---

## 6. Propagation: how one idea becomes a site

A signature earns its name only if it reaches every discipline. This table is the propagation contract — each row is a question the signature must answer.

| Discipline | The question the signature must answer | Failure if it can't |
|---|---|---|
| **Experience architecture** | What is the order of screens, and what does each withhold? | Default section stack → template. |
| **First screen** | What is the single thing shown, and what is deliberately absent? | Generic hero (see `ANTI_AI_SLOP.md`). |
| **Composition** | Where does the eye go first, second, third — and what creates that order? | Uniform grid of equal cards. |
| **Typography** | What voice does the type speak in, and where does scale contrast fall? | Arbitrary serif+sans pairing. |
| **Colour** | What is colour *for* here — semantic, material-derived, or structural? | Decorative gradients. |
| **Art direction** | What is photographed, from what distance, in what light, and what is never shown? | Stock-style uniform treatment. |
| **Motion** | What moves, and what does its movement *mean*? | Fade-in-on-scroll everywhere. |
| **Interaction** | What single interaction embodies the idea? | Hover effects without purpose. |
| **Copy** | What register, what length, what is left unsaid? | "Premium" adjective soup. |
| **Rhythm** | Where does the page compress and where does it breathe? | Identical section heights. |
| **Omission** | What did we refuse to build, and why? | Everything included ⇒ nothing meant. |

**R-PROP-1 — Five-discipline minimum.** If the signature cannot answer at least five rows *differently from the category default*, it is not strong enough to select. Return to Step 4.

**R-PROP-2 — Omission is a deliverable.** The "what we refused" list must be recorded and reported. It is the clearest evidence that a decision was made rather than a template filled.

**R-PROP-3 — The signature outranks the trend.** Any K3 trend item may only enter if the signature invites it. Trends decorate; the signature decides — consistent with the doctrine already recorded in `docs/Design_Intelligence_Foundation.md` §1.

---

## 7. Why the brief's examples must never become a table

The brief offers: bakery → *time / fermentation / transformation*; jewellery → *light / precision / reveal*; architecture → *space / geometry / movement*; restaurant → *ritual / ingredients / sensory progression*; wedding venue → *anticipation / celebration / memory*.

These are **good illustrations of signature shape and catastrophic as defaults**, for four reasons:

1. **They are category clichés by construction.** Every bakery brief in the world reaches for fermentation. Applying it makes the site indistinguishable from every other AI-assisted bakery site — the precise failure mode the factory exists to avoid.
2. **They may be factually false for the business.** A bakery that par-bakes frozen dough has no fermentation story. Building one would violate `TRUTH_AND_EVIDENCE.md` (F-06, F-08).
3. **They collapse the anomaly step.** A lookup table means Step 2 never runs, and the anomaly — the only source of genuine distinctiveness — is never found.
4. **They defeat the existing distinctness memory.** `lib/memory/designMemory.ts` already refuses to deliver near-identical designs to the same industry within 50 km / 18 months. A category→signature table would generate exactly the collisions that memory is built to reject, converting a design problem into a systemic dead end.

**R-SIG-1 — Category may supply *questions*, never *answers*.** The industry priors in §9 are question sets and priority hints. Any use of them as an output is a defect.

**R-SIG-2 — If the discovered signature matches the category cliché, it must clear a higher bar:** it must rest on a specifically verified fact that makes the cliché *unusually* true here, and it must be executed with at least one non-obvious structural consequence. Otherwise, take the second-best axis.

---

## 8. When there is no signature

A legitimate and frequent outcome. Some businesses have thin evidence, poor assets, and no anomaly. The correct response is **not** to invent one.

**Fallback ladder:**

1. **Material-led editorial.** Use the best real photograph as the whole first screen, at scale, with one sentence. No narrative claims. Disciplined typography and generous space. This is never a failure — it is what a good studio does with thin material.
2. **Utility-led clarity.** If user intent is transactional (hours, price, book, call), make speed-to-answer the organising idea. A site that answers in 400ms with no scroll is a legitimate design position, and for many local businesses it is the *correct* one.
3. **Typographic direction only.** Where imagery is unusable, the type *is* the art direction — a route with strong precedent in the teardown evidence (several of the 25 winners in `docs/AWWWARDS_PATTERN_LIBRARY.md` use typographic heroes with no photographic hero at all).

**R-NOSIG-1 — Record the absence.** "No defensible signature; delivered material-led editorial" is a valid, honest run outcome and must be reportable. It also tells a human exactly which evidence to supply to unlock more.

---

## 9. Industry priors (Phase 11) — question sets, not templates

**How to read this section.** Each entry gives business goals, user intent, trust signals, common patterns, bad patterns, experience opportunities, functional features, content needs, and design opportunities. Per R-SIG-1 these are **priors that shape questions and set defaults for the obligation layer** — a Creative Director may override any of them with evidence, and the *signature always outranks the prior*. Capability decisions referenced here are specified with machine-evaluable triggers in `WEBSITE_CAPABILITY_KNOWLEDGE.md`.

Two cross-cutting truths that apply to every entry below:

- **Most local-business visitors arrive with a retrieval task**, not an appetite for narrative. Where retrieval intent dominates, experience ambition must be expressed in *craft* (composition, type, image treatment, restraint) rather than in *duration* (long scroll, loading sequences, gated reveals).
- **Trust signals differ from decoration.** A real photograph of the actual premises outperforms any generated visual. A named practitioner with a verifiable licence outperforms any badge.

### RESTAURANT
- **Goals:** fill covers on slow nights; reduce phone load; raise average spend.
- **User intent:** menu, price band, location, tonight's availability, is it right for this occasion.
- **Trust signals:** real photos of real dishes and the real room; current menu with prices; visible hours; a phone number that works.
- **Common patterns:** hero of a dish, menu page, gallery, reservation widget, map.
- **Bad patterns:** menu as an unreadable PDF; hours buried; autoplay video with sound; a narrative chef story ahead of the menu; "book a table" that opens a generic third-party page with no context.
- **Experience opportunities:** the menu itself as the primary composition rather than a subordinate page; time-of-day as a structural axis (lunch vs evening as two different faces of one site); a single long photograph of the room as the whole first screen.
- **Functional features:** menu (structured, not PDF), hours, location, phone, booking only if time-slotted capacity is verified.
- **Content needs:** dish names and prices exactly as sourced; the room; the practical facts.
- **Design opportunities:** typography that can carry a menu beautifully — a genuinely under-exploited surface; light logic matched to the room's real light.

### BAKERY
- **Goals:** morning footfall; pre-orders; wholesale enquiries (often the real revenue — verify, never assume, F-09).
- **User intent:** what exists today, when it opens, where it is, can I order a cake.
- **Trust signals:** photographs of the actual product; opening time; sell-out reality stated honestly.
- **Bad patterns:** fermentation poetry ahead of opening hours; stock croissant imagery; an invented heritage claim; a "our story" section resting on the business name (F-02).
- **Experience opportunities:** scarcity and time-of-day as facts, when verified; product as pure object photography at scale.
- **Functional features:** hours, location, product list, order/enquiry path if verified; wholesale contact if wholesale is real.
- **Design opportunities:** product-as-typography scale contrast; a palette derived from the actual crumb and crust rather than from a "bakery" mood.

### CONFECTIONERY / PASTRY
- **Goals:** custom orders, occasion sales, lead times.
- **User intent:** can you make what I imagine, at what price, by when.
- **Trust signals:** portfolio of real completed work; explicit lead times; price bands.
- **Bad patterns:** a gallery with no prices and no lead time — the two things every enquiry asks; generic "we make dreams" copy.
- **Experience opportunities:** the order process itself made legible (a real information design problem, rarely solved well); scale and colour as the whole visual system.
- **Functional features:** structured enquiry capturing date/size/occasion; portfolio; lead-time statement.

### HOTEL
- **Goals:** direct bookings that bypass OTA commission.
- **User intent:** rooms, price, dates, location, what the room actually looks like.
- **Trust signals:** every room type photographed honestly; unambiguous rates; exact location; cancellation terms.
- **Bad patterns:** wide-angle distorted room photos; a "book now" that loses the user's dates; luxury adjectives replacing room facts; a video hero that delays the rate.
- **Experience opportunities:** approach and arrival as a sequence (only where verified imagery supports it); the view as the organising fact when the view is real (never inferred, F-25).
- **Functional features:** availability/rates, booking, room detail, location, policies.

### WEDDING VENUE
- **Goals:** qualified enquiries and site visits.
- **User intent:** capacity, price, dates available, does it look like my day, what is included.
- **Trust signals:** verified capacity; real weddings photographed there; a clear price basis; named coordinator.
- **Bad patterns:** the entire category's cliché stack — soft-focus couples, script typefaces, "your special day", rose gold gradients; capacity omitted; price omitted, forcing an enquiry to learn a disqualifying number.
- **Experience opportunities:** the space *empty*, at scale, so the visitor can project their own event into it — the single strongest and least used move in this category; anticipation as structure (approach → threshold → room) where verified.
- **Functional features:** capacity, availability calendar, structured enquiry with date, gallery by real event, location.
- **Note:** the brief's *anticipation / celebration / memory* is precisely the axis every competitor already uses; per R-SIG-2 it must clear the higher bar or be replaced.

### CLINIC / HEALTHCARE
- **Goals:** appointments; reduce phone load; establish competence.
- **User intent:** do they treat my problem, are they qualified, when can I be seen, what does it cost, where is it.
- **Trust signals:** named practitioners with verifiable registration numbers; specific treatments; clear pricing where lawful; accessibility information.
- **Bad patterns:** stock smiling models; "compassionate care" boilerplate; hidden pricing; motion-heavy design that fights anxious, sometimes impaired users; any unverified credential (a hard `TRUTH_AND_EVIDENCE.md` violation).
- **Experience opportunities:** calm as a *measurable* property — high legibility, low motion, short paths, unambiguous language. Restraint here is not taste, it is care.
- **Obligations escalate:** accessibility, privacy, GDPR (health data is special category), and copy accuracy are all at maximum severity.

### LAW FIRM
- **Goals:** qualified enquiries in specific practice areas.
- **User intent:** do they handle exactly my matter, are they credible, what will it cost, can I speak to a human.
- **Trust signals:** named lawyers, admissions, real case types, publications, plain-language fee basis.
- **Bad patterns:** gavels, scales, columns, handshakes; "results-driven, client-focused"; practice areas listed so broadly they say nothing.
- **Experience opportunities:** clarity as luxury — an editorial, document-like design language that signals precision; the practice-area page treated as the primary artifact rather than a list item.

### ARCHITECTURE STUDIO
- **Goals:** attract the right commissions; be remembered by peers and clients.
- **User intent:** see the work, understand the thinking, judge fit.
- **Trust signals:** the projects themselves, credited, dated, located.
- **Bad patterns:** a masonry grid of undifferentiated thumbnails; manifesto text with no work behind it; heavy WebGL that delays the images that *are* the argument.
- **Experience opportunities:** the highest-legitimacy category for signature-level experience design, because the audience reads design as evidence of competence. Drawing, plan, and section are underused visual languages; project navigation can be spatial rather than listed.

### CAR SERVICE / TRADES
- **Goals:** bookings and calls, fast.
- **User intent:** do you fix my thing, how much, how soon, where, can I call now.
- **Trust signals:** specific service list, real workshop photos, real prices or price basis, phone prominence.
- **Bad patterns:** any experience design that delays the phone number; stock imagery of unrelated cars; "excellence in automotive care".
- **Experience opportunities:** speed and legibility as the entire design position. A near-instant, phone-first, brutally clear site is the correct ambitious answer here — and it is *harder* to do well than a decorative one.

### REAL ESTATE
- **Goals:** listing enquiries; seller acquisition.
- **User intent:** filter to relevant properties fast; see them honestly; contact.
- **Trust signals:** complete listing data, honest photography, verified availability, named agent.
- **Bad patterns:** stale listings; distorted wide-angle photos; hero video ahead of search; carousels that hide inventory.
- **Experience opportunities:** search and filter as the primary designed object; the property page as an editorial artifact rather than a data dump.

### ECOMMERCE
- **Goals:** revenue per session; returning customers.
- **User intent:** find, evaluate, trust, buy, know delivery and returns.
- **Trust signals:** product photography from multiple angles, real reviews, stated delivery and returns, visible total cost.
- **Bad patterns:** fake urgency and countdown timers; hidden shipping cost until checkout; decorative motion on PDPs harming INP; invented review counts (a `TRUTH_AND_EVIDENCE.md` violation).
- **Experience opportunities:** the product page as the signature surface; scale, sequence and material honesty in photography. Every effect here is under strict performance discipline (`PERFORMANCE_KNOWLEDGE.md`).

### B2B
- **Goals:** pipeline from a small number of high-value buyers.
- **User intent:** what exactly does this do, for whom, integrated with what, at what price, who else uses it.
- **Trust signals:** specific named customers, real numbers, documentation depth, security posture.
- **Bad patterns:** abstract isometric illustration; "empowering enterprises to unlock"; fabricated logo walls and statistics; a demo request as the only path to any information.
- **Experience opportunities:** documentation and product truth as the design material; showing the actual product interface rather than a metaphor for it.

### CREATIVE AGENCY / STUDIO
- **Goals:** be hired for the quality visible on the site itself.
- **User intent:** is the work good, is it relevant, who are they, can I afford them.
- **Trust signals:** the work, credited honestly.
- **Bad patterns:** experience so heavy the work cannot be seen; a self-indulgent loading sequence; case studies with no outcome.
- **Note:** the *only* category where the site being an experience is itself the proof — and therefore the category whose patterns are most often wrongly copied onto businesses that need retrieval speed. This is the single most common source of category-inappropriate ambition.

### FREELANCER
- **Goals:** enough of the right inbound work.
- **User intent:** what do they do, is the work good, are they available, what do they cost, how do I reach them.
- **Trust signals:** real named work, availability, a direct contact route.
- **Bad patterns:** imitating agency scale ("we"); a portfolio of unnamed concepts; hiding availability and price.
- **Experience opportunities:** singular voice and one memorable idea, executed exactly. Small surface, high craft — the best value-for-effort ratio in this whole list.

### FITNESS
- **Goals:** trial sign-ups and memberships; retention.
- **User intent:** class timetable, price, location, is this for someone like me.
- **Trust signals:** real members and real space photographed honestly; timetable; unambiguous pricing and cancellation terms.
- **Bad patterns:** stock athletic models; aggressive motivational copy; timetable hidden behind an app; price obscured.
- **Experience opportunities:** the timetable as the primary designed object; the real space and real people as the entire art direction. Honest bodies outperform stock bodies decisively as a trust signal.

### EDUCATION
- **Goals:** enrolment from a fit-appropriate audience.
- **User intent:** what is taught, by whom, how long, what does it cost, what do I get, is it recognised.
- **Trust signals:** named instructors with real credentials, curriculum detail, outcome evidence, accreditation.
- **Bad patterns:** stock lecture-hall imagery; unverifiable outcome statistics; curriculum reduced to bullet fragments.
- **Experience opportunities:** the curriculum as an information-design problem — sequence, dependency, and time made visible. Accessibility obligations are elevated (diverse audiences, assistive technology, low bandwidth).

---

## 10. Anti-patterns of the signature process itself

| Failure | Symptom | Counter |
|---|---|---|
| **Lookup-table signature** | The bakery got fermentation again. | R-SIG-1; §7. |
| **Adjective signature** | "Warm, premium, modern." | §1 rejection test — it settles no argument. |
| **Unsourced signature** | The idea rests on the business name or city. | `TRUTH_AND_EVIDENCE.md` F-01…F-26. |
| **Signature as decoration** | It changed the palette and nothing else. | R-PROP-1 five-discipline minimum. |
| **Signature vs user** | The idea delays the information the visitor came for. | Rubric row 6; the signature must *be* the fast path. |
| **Signature inflation** | Three ideas at once, all half-executed. | One signature. The others are recorded as rejected territories. |
| **Convergence over runs** | Every business in a category drifts to the same axis. | `lib/memory/designMemory.ts` scoped distinctness; record and check rejected axes too. |
| **Unfalsifiable survivor** | It passed review because nothing could contradict it. | §5 is a gate, not a reflection. |

---

## 11. Summary contract

A delivered signature must be expressible in this shape:

```
SIGNATURE:        <one sentence naming a tension or transformation>
RESTS ON:         <verified claim ids + verbatim snippets>
FALSIFIED IF:     <a checkable condition>
FORCES:           <≥5 decisions across ≥5 disciplines>
FORBIDS:          <≥5 specific attractive options now excluded>
SERVES USER BY:   <how it makes the visitor's real task faster or clearer>
REJECTED AXES:    <the other candidates + why>
```

If any line is empty, there is no signature — and §8's fallback ladder is the correct, honest, non-failing answer.

