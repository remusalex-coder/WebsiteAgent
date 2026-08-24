# TRUTH & EVIDENCE — Epistemic Rules for BusinessForge (Phase 12)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Knowledge Architect
**Date:** 2026-08-17
**Knowledge class:** K1 (invariant). Violations are build failures, not stylistic notes.
**Enforcement seams already in the repo (verified by reading, unchanged):** `lib/content/evidence.ts`, `lib/forge/grounding.ts`, `lib/forge/anti-ai-gate.ts` (`forbiddenAssumptions` → `FACTUAL_HALLUCINATION_DETECTED`), `lib/forge/types.ts` (`FactualDossier`, `verifiedFacts`, `realPhotoAssets`).

---

## 0. Honesty note

This document is **doctrine and schema**, derived from the repository's existing evidence architecture plus general epistemic practice. It makes no factual claims about the external world requiring citation. Repository claims were verified by reading the files listed above. Nothing here is implemented; the "enforcement point" column indicates *where a rule would belong*, not where it currently runs.

---

## 1. The prime directive

> **BusinessForge must prefer `UNKNOWN` over invention, always, without exception, even when the invention would be harmless, plausible, flattering, or convenient.**

The reason is structural, not moral. A generated website is delivered to a business owner who **knows the truth about their own business**. One invented fact — a founding year, a family story, a "wood-fired oven" that does not exist — destroys credibility in the entire artifact, including the 200 things that were correct. Invention is not a small error with small cost; it is a **total-loss** error.

Corollary: an *absence* is cheap. A site that does not mention when the bakery was founded is unremarkable. A site that says 1954 when it was 2019 is unusable.

---

## 2. The six epistemic states

Every proposition the system holds is in exactly one state. The state is a first-class field, never inferred at use time.

| State | Definition | Required evidence | May appear in delivered copy? | May drive art direction? |
|---|---|---|---|---|
| **VERIFIED_FACT** | Asserted by ≥1 Tier-1/Tier-2 source, retrieved and quotable, with no contradicting source of equal or higher tier. | Source URL + retrieval timestamp + verbatim snippet + locator. | Yes, as assertion. | Yes. |
| **FACT** | Asserted by an acceptable source, retrieved, but not corroborated and not from the highest tier. | Source URL + timestamp + snippet. | Yes, but hedged or attributed where materially risky. | Yes, with a fallback if withdrawn. |
| **INFERENCE** | Derived by explicit, stated reasoning from ≥1 FACT. Truth-preserving only if the premises hold. | Premise claim IDs + the inference rule used. | Only if the inference is deductively safe *and* non-material. | Yes — this is the normal fuel for concept work. |
| **ASSUMPTION** | Believed for convenience; no evidence. | Nothing — that is the point. | **Never.** | Only as a *hypothesis to be tested*, never as a premise for a factual statement. |
| **CREATIVE_INTERPRETATION** | A deliberate artistic reading of verified material. Not truth-apt. | The verified material it interprets + a note that it is interpretive. | Yes, in registers a reader parses as voice (headline, poetic caption), never in a factual slot (hours, prices, credentials, history). | Yes — this is where signature comes from. |
| **UNKNOWN** | Actively established as not known. | The queries attempted and their failure. | Yes, as absence or as an explicit "call to confirm". | Yes — as a constraint that *forbids* certain directions. |

**Two rules that carry most of the weight:**

- **R-STATE-1 — No silent promotion.** A claim never changes state as a side effect of being used, summarised, translated, or passed between agents. Promotion requires new evidence. Summarisation is the classic leak: an INFERENCE described in a downstream prompt without its qualifier arrives as a FACT.
- **R-STATE-2 — Slot typing.** Every output slot declares the minimum state it accepts. Factual slots (address, hours, prices, credentials, certifications, awards, founding date, staff names, capacity, materials, provenance) accept **VERIFIED_FACT only**. Voice slots accept CREATIVE_INTERPRETATION. A CREATIVE_INTERPRETATION placed in a factual slot is a hallucination regardless of how it was labelled upstream.

---

## 3. Source hierarchy

Tier determines authority in conflicts and the evidence burden for promotion.

| Tier | Sources | Trust for | Known failure modes |
|---|---|---|---|
| **T1 — Owned & authoritative** | The business's own website, its own booking/menu/PDF documents, official registries (company register, professional licensing bodies), verified Google Business Profile fields written by the owner. | Identity, offering, hours, prices, contact, credentials. | Stale (hours, prices, closed locations). Owner marketing copy is not fact — see §5. |
| **T2 — Platform-structured** | Google Places/Maps structured fields, Apple/Bing equivalents, OSM, official social profile metadata. | Location, category, coordinates, phone, opening hours, photo existence. | Category taxonomies are coarse and misleading; user-submitted edits; hours frequently wrong. |
| **T3 — Reputable third party** | Established directories, press with a named outlet, industry associations, tourism boards. | Existence, reputation signals, occasionally history. | Copy-paste chains: ten sites repeating one error is **not** corroboration (see R-CONF-3). |
| **T4 — Social & user-generated** | Instagram/Facebook posts by the business, reviews, user photos. | Visual material, recency of activity, atmosphere, what customers actually name. | Reviews are perception, not fact. Post captions are marketing. Photos may be reposted, filtered, or of another location. |
| **T5 — Aggregators & scrapers** | Content-farm listings, scraped clones, auto-generated business pages. | Almost nothing. Use only to locate T1–T3. | Fabricated details; abandoned data. |
| **T6 — Model prior** | The language model's own knowledge or intuition. | **Nothing.** | Not a source. May generate hypotheses to verify; may never license a claim. |

**R-SRC-1 — T6 is not a source.** Any claim whose only support is model knowledge is `ASSUMPTION`, no matter how confident the wording.
**R-SRC-2 — Photographs are evidence of pixels, not of facts.** A photo showing an oven supports "an oven appears in a photo associated with this business", not "the business bakes in a wood-fired oven".
**R-SRC-3 — Retrieval is mandatory.** A source that was not actually fetched cannot support a claim. A URL that was constructed rather than followed is not a citation.

---

## 4. Confidence

Confidence is **not** a vibe score. It is computed from four independent axes and reported as the minimum-justifiable band.

| Axis | Signal |
|---|---|
| **Authority** | Highest tier supporting the claim. |
| **Corroboration** | Number of *independent* sources (see R-CONF-3). |
| **Specificity** | Does the source state the claim, or does the claim require interpretation of the source? |
| **Freshness** | Age of the retrieval vs the claim's volatility class. |

**Volatility classes and staleness limits:**

| Class | Examples | Stale after |
|---|---|---|
| Volatile | Hours, prices, menu, availability, staff, promotions | 30 days |
| Semi-stable | Services offered, capacity, payment methods, photos | 6 months |
| Stable | Address, category, founding year, credentials, ownership | 24 months |
| Structural | Business existence, legal name | 24 months (but verify existence every run) |

**Bands:** `HIGH` (T1/T2 + specific + fresh), `MEDIUM` (single acceptable source, specific, fresh, or corroborated but lower tier), `LOW` (interpretation required, or stale, or T3/T4 only), `NONE` (→ becomes `ASSUMPTION` or `UNKNOWN`).

- **R-CONF-1 — Confidence never rises through restatement.** Repetition inside the pipeline is not corroboration.
- **R-CONF-2 — Confidence caps by tier.** T4-only evidence caps at `LOW`. T5-only caps at `NONE`.
- **R-CONF-3 — Independence test.** Two sources are independent only if neither plausibly copied the other. Identical phrasing, identical error, or a shared upstream feed ⇒ count as one. Ten directories echoing one wrong founding year is one source, not ten.
- **R-CONF-4 — Material claims need HIGH.** Anything a customer could act on and be harmed by (hours, price, address, medical/legal credentials, allergen information, booking capacity) requires `VERIFIED_FACT` at `HIGH`, else it is omitted.

---

## 5. Evidence requirements by claim class

The burden scales with the cost of being wrong.

| Claim class | Minimum state | Minimum confidence | Extra requirement |
|---|---|---|---|
| Identity (legal/trading name) | VERIFIED_FACT | HIGH | T1 or T2 exact string. |
| Location / address | VERIFIED_FACT | HIGH | T1 or T2; never derived from the business name. |
| Contact (phone, email) | VERIFIED_FACT | HIGH | Must appear verbatim in source. Never reformatted into a different number. |
| Opening hours | VERIFIED_FACT | HIGH | Fresh ≤30d; if conflicting, present the T1 value and omit the rest. |
| Prices | VERIFIED_FACT | HIGH | Fresh ≤30d, with currency exactly as sourced. If any doubt: omit, do not approximate. |
| Offering / menu items | VERIFIED_FACT | MEDIUM+ | Individual item names must be sourced; **the set must not be completed by imagination**. |
| Credentials, licences, certifications | VERIFIED_FACT | HIGH | T1 or registry only. Never from review text or marketing copy. |
| Awards | VERIFIED_FACT | HIGH | The awarding body or T3 press. A claim on the business's own site is a claim *that they claim it* — attribute, do not assert. |
| History / founding date | VERIFIED_FACT | HIGH | See F-07: copy saying "since 1954" evidences the copy, not the year — though T1 self-assertion may be attributed ("the bakery says it has baked here since 1954"). |
| Staff / people | VERIFIED_FACT | HIGH | Named individuals require T1. Never invent a founder, chef, or doctor. |
| Materials / process | FACT+ | MEDIUM+ | Must be stated, not deduced from a photo or a category. |
| Capacity / size | VERIFIED_FACT | HIGH | Wedding venues and clinics especially: a wrong capacity is a commercial injury. |
| Atmosphere / character | CREATIVE_INTERPRETATION | n/a | Allowed in voice slots, grounded in real material, never phrased as a measurable fact. |
| Superlatives ("the best", "the oldest", "the only") | VERIFIED_FACT | HIGH | Effectively never satisfiable. Default: forbidden. |
| Statistics ("500+ happy clients", "98% satisfaction") | VERIFIED_FACT | HIGH | Default: forbidden. Fabricated statistics are a signature AI-slop tell; see `ANTI_AI_SLOP.md`. |

---

## 6. Forbidden inference patterns

The core of this document. Each is a reasoning move that *feels* valid and is not. `F-xx` IDs are stable so a gate can reference them.

**Name & language**

- **F-01 Toponym → geography.** "River Park Events" ⇒ near a river / has a park. **No.** Names are marketing, inherited, aspirational, or arbitrary. Also: "Bella Vista" ⇒ a view; "Hilltop" ⇒ elevation; "Central" ⇒ city centre; "Lake" ⇒ water.
- **F-02 Name → history.** "Old Mill Bakery" ⇒ housed in a former mill, or old. **No.**
- **F-03 Name → family ownership.** "Rossi & Sons" ⇒ family business, multiple generations. **No.**
- **F-04 Name → founder.** "Maria's Kitchen" ⇒ a person named Maria exists or founded it. **No.**
- **F-05 Foreign-language name → origin/authenticity.** An Italian name ⇒ Italian owners, Italian recipes, imported ingredients. **No.**
- **F-06 Name → specialisation.** "Artisan Bread Co." ⇒ sourdough, hand-shaped, long fermentation. **No.**
- **F-07 Copy "since YYYY" → founding date.** Establishes that the copy says so. Attribute it; do not assert it as verified history, and never compute an anniversary from it.

**Category & taxonomy**

- **F-08 Category → menu/services.** Category "bakery" ⇒ croissants, sourdough, cakes, coffee. **No.** Enumerate only sourced items.
- **F-09 Category → business model.** "Bakery" ⇒ walk-in retail. It may be wholesale-only, B2B, or delivery-only. This error mis-specifies the *entire site brief*, not just a sentence.
- **F-10 Category → audience.** "Fitness" ⇒ young urban clientele. **No.**
- **F-11 Category → price tier.** Nothing about a category fixes positioning. Price tier requires sourced prices.
- **F-12 Category → ritual/process narrative.** "Restaurant" ⇒ a tasting-menu ritual worth a narrative scroll. **No** — most restaurants need hours, menu, location, and a phone number.
- **F-13 Google category → self-description.** Platform taxonomies are coarse. A specialist clinic filed as "Doctor" is not therefore a general practice.

**Photographs & media**

- **F-14 Photo content → capability.** A pizza oven in a photo ⇒ wood-fired pizza is served. **No** (R-SRC-2).
- **F-15 Photo → ownership/location.** A photo on the profile ⇒ taken at this location, of this business, owned by them. **No** — reposts and stock are routine. Licensing is separately unverified.
- **F-16 Photo count/quality → business quality.** **No.**
- **F-17 Photo → season/recency.** A summer terrace photo ⇒ a terrace currently operates. **No.**
- **F-18 Interior style in photo → design direction of the brand.** A photo's decor is evidence of decor, and legitimate *material* for art direction — but it does not establish a brand system, palette, or typography.

**Reviews & social**

- **F-19 Review adjective → fact.** "Best croissants in town" ⇒ croissants are excellent, or even that croissants are sold. Reviews evidence *perception*, and only that customers used that word.
- **F-20 Review volume → popularity/scale.** **No.**
- **F-21 Review mention → offering.** A reviewer mentioning a dish is weak evidence the dish is current; menus change. Never price from a review.
- **F-22 Post frequency → business health.** **No.**
- **F-23 Follower count → authority.** **No.**
- **F-24 Hashtag → positioning.** `#luxury` in a caption ⇒ a luxury brand. **No.**

**Location & environment**

- **F-25 Address → environment.** A street name, postcode, or district ⇒ views, footfall, neighbourhood character, adjacency to landmarks. **No.** Geographic claims require geodata or imagery actually consulted.
- **F-26 City → culture.** A city name ⇒ regional traditions, materials, or a design idiom. **No.** This is one of the most seductive slop routes: it produces plausible, generic, and unfounded "local character".
- **F-27 Country → language of the audience.** Verify the language of the business's own copy; `lib/content/language.ts` already treats evidence language as authoritative (ADR 0007).
- **F-28 Rural/urban guess from coordinates alone → lifestyle claims.** **No.**

**Business operations**

- **F-29 Website has a form → they accept online enquiries as a real channel.** The form may be unmonitored. Do not promise a response time.
- **F-30 No online booking → they want online booking.** This is a *hypothesis for the brief*, an ASSUMPTION, not a need.
- **F-31 Competitor has feature X → this business needs X.** Comparative design is not evidence of requirement.
- **F-32 Multiple locations in a listing → a chain with shared standards.** **No.**
- **F-33 Absence of evidence → absence of the thing.** Symmetrical error. Not finding a wheelchair ramp does not license "not accessible". Absence ⇒ `UNKNOWN`, never a negative claim.

---

## 7. Claim validation procedure

For each candidate claim:

1. **Locate** — was a real source fetched? If not → `ASSUMPTION`. Stop.
2. **Quote** — extract a verbatim snippet plus locator (URL, DOM path or page/section). No snippet ⇒ no claim.
3. **Match** — does the snippet *state* the claim, or must it be interpreted? Interpretation ⇒ downgrade to `INFERENCE` and record the rule used.
4. **Screen against F-xx** — if the reasoning matches any forbidden pattern, the claim is rejected outright, not downgraded. Rejection is recorded so downstream stages cannot rediscover it.
5. **Tier & corroborate** — assign tier; seek a second independent source for material claims; apply R-CONF-3.
6. **Date** — record retrieval time; apply the volatility limit.
7. **Assign state + confidence**; write the claim record.
8. **Slot-check** — confirm the intended output slot accepts that state (R-STATE-2).

---

## 8. Conflict resolution

When two retrieved sources disagree, resolve **in this order**, stopping at the first decisive step:

1. **Tier** — higher tier wins (T1 > T2 > T3 > T4 > T5).
2. **Specificity** — the source that states the exact claim beats one requiring interpretation.
3. **Recency** — for volatile claims, newer wins; for stable claims, recency is weak and may indicate a scraped error.
4. **Independence-weighted corroboration** — count only genuinely independent sources.
5. **Internal consistency** — the value consistent with other verified facts wins (e.g. hours consistent with the business's own booking page).

**R-CONFLICT-1 — Never average, never merge.** Two prices do not become a mid-price. Two addresses do not become a "general area". Two founding years do not become "around 1960".
**R-CONFLICT-2 — Unresolved material conflict ⇒ `UNKNOWN`.** Omit the claim and record the conflict.
**R-CONFLICT-3 — Conflicts are reported, not hidden.** The run record must show what disagreed. This is what lets a human close the gap in seconds.

---

## 9. UNKNOWN handling

`UNKNOWN` is a **design input**, not an error state. Three legitimate responses, in order of preference:

1. **Restructure** — build the composition so the unknown is not needed. A site with no verified history simply is not a heritage narrative; it becomes a present-tense, material-led one. This is the *good* path and should be the default.
2. **Ask** — surface it as a pre-delivery question for the owner ("Confirm founding year to enable the history section"). Cheap, honest, converts an unknown into T1 evidence.
3. **Declare** — where a user would expect the information and its absence is conspicuous, say so plainly ("Call to confirm today's availability").

**Never permitted:** placeholder fiction (`Lorem`-grade invented history), hedged invention ("perhaps founded in the 1950s"), or generic filler that reads as specific ("a tradition passed down through generations").

**R-UNK-1 — Unknowns propagate as constraints.** An unknown founding date must reach the Creative Director as an explicit prohibition on heritage-based signatures — mirroring the existing `forbiddenAssumptions` mechanism in `lib/forge/types.ts`, which the anti-AI gate already scans generated HTML against.
**R-UNK-2 — Coverage is reportable.** Every run should be able to state how much of the site rests on VERIFIED_FACT vs INFERENCE vs CREATIVE_INTERPRETATION. A site that is 80% interpretation may still be good — but that must be a *known* fact about the artifact.

---

## 10. Claim record schema (documentation only — not an implementation)

Fields a claim record must carry for the rules above to be checkable:

| Field | Purpose |
|---|---|
| `id` | Stable claim identifier for referencing in inferences and rejections. |
| `subject` / `predicate` / `value` | The proposition, structured so it can be compared, not just displayed. |
| `claimClass` | One of the classes in §5; selects the evidence burden. |
| `state` | One of the six states in §2. |
| `confidence` | Band + the four axis values that produced it. |
| `volatilityClass` | Selects the staleness limit. |
| `sources[]` | Each with tier, URL, retrievedAt, verbatim snippet, locator, and independence group. |
| `derivedFrom[]` | Premise claim IDs (INFERENCE only) + the inference rule applied. |
| `screenedAgainst[]` | Which F-xx patterns were checked. |
| `rejections[]` | F-xx violations found, so a later stage cannot resurrect the claim. |
| `conflicts[]` | Competing values, their sources, and the resolution step that decided. |
| `allowedSlots[]` | Where this claim may legally appear. |
| `attribution` | Whether it must be attributed rather than asserted (e.g. self-claimed awards). |
| `language` | Source language of the snippet, for evidence-language content (ADR 0007). |

---

## 11. Failure modes to watch for in an autonomous run

| Failure | Mechanism | Counter |
|---|---|---|
| **Laundering** | A claim loses its qualifier while being summarised into a downstream prompt. | R-STATE-1; pass claim IDs, not prose. |
| **Plausibility capture** | The model prefers the coherent story over the sourced one. | F-01…F-33; reject rather than downgrade. |
| **Corroboration illusion** | Scraped echoes counted as independent sources. | R-CONF-3 independence groups. |
| **Category priors leaking in as facts** | Industry defaults presented as this business's specifics. | F-08…F-13; industry knowledge is a *prior for questions*, never an answer. |
| **Creative slot creep** | Interpretive copy drifts into factual slots (a poetic line asserting a process). | R-STATE-2 slot typing. |
| **Negative invention** | Absence turned into a negative claim. | F-33. |
| **Stale confidence** | Verified once, reused forever. | Volatility classes; re-verify per run. |

---

## 12. The one-sentence test

Before any sentence ships, it must survive:

> **"If the owner read this aloud, could they point at the source?"**

If not, it is `UNKNOWN`, and the composition must be built so that nothing depends on it.

