# BusinessForge / WebsiteAgent — Design Intelligence Research (README)

**Purpose:** This folder is the durable **research foundation** for an autonomous AI website generator. It is evidence-based, pre-implementation, and explicitly does **not** modify the WebsiteAgent repo or implement anything.

**Read order matters.** The three documents are a chain: vocabulary → reference → brain. A future agent should consume them in the order below.

---

## What to read, in what order, and when

### 1. `Design_Intelligence_Foundation.md` — READ FIRST (the vocabulary)
- **What it is:** 20-section foundation of timeless UX principles (A), premium visual principles (B), current trends (C), and low-value effects (D). Every principle records Principle / Why / Evidence / Rule / Use / Don't / Triggers / Deterministic-vs-AI / Confidence.
- **Read it when:** you are encoding the **deterministic floor** (tokens, spacing/type scales, contrast, grid, accessibility, Core Web Vitals, conversion skeleton) or deciding what must be a *rule* vs *AI judgment*.
- **Pairs with:** `lib/design` + `lib/render` in the repo (the deterministic core).

### 2. `AWWWARDS_PATTERN_LIBRARY.md` — READ SECOND (the visual reference)
- **What it is:** Evidence-based teardown of 25 real Awwwards-winning commercial sites (hero, type, color, grid, motion, etc.) → 18 reusable patterns (P-001…P-018), each with triggers, suitable/unsuitable industries, deterministic constraints, AI judgment, and template-risk. Ends with explicit **anti-clone rules** (what must NOT be copied).
- **Read it when:** you need **concrete visual patterns** to execute a direction, or you are calibrating output against "does this look bespoke, not templated?" (use the bespoke-vs-template checklist).
- **Important:** It is *evidence of principles*, not templates. Do not clone specific sites.

### 3. `From_Business_Evidence_to_Creative_Direction.md` — READ THIRD (the brain)
- **What it is:** The pipeline that turns raw business evidence into a unique creative concept, then into design. Stages A–H (evidence → perceptual targeting → character vector → creative concept → design direction → art direction → render → critique loop). Anchored in Double Diamond + Aaker's 5 brand-personality dimensions.
- **Read it when:** you are building the **orchestration / decision logic** — i.e., how WebsiteAgent *derives* a concept from `business + evidence + photos + audience + positioning` instead of assembling components. This is the core differentiator vs an "AI website builder."
- **Key structures to lift:** the Character Vector (§4), the Creative Concept deliverable (§5), the Perceptual-Target table (§3), the Competitive-Differentiation rule (§8), the Critique Loop (§9).

---

## How they fit together

```
Design_Intelligence_Foundation.md   →  the RULES (deterministic floor + premium craft)
AWWWARDS_PATTERN_LIBRARY.md         →  the PATTERNS (what good execution looks like, evidence-backed)
From_Business_Evidence_..._Direction.md →  the REASONING (how to pick the right rules/patterns for THIS business)
```

A future agent should:
1. Load **Foundation** to know the non-negotiable floor and the premium vocabulary.
2. Load **Pattern Library** to know validated execution patterns + anti-clone guardrails.
3. Load **Creative Direction** to know the pipeline that maps a business profile → concept → design, using the two above as its rule-base and pattern-base.

---

## Constraints honored by all three docs
- No implementation. No WebsiteAgent repo modification.
- No fabricated facts — every claim cites a source; 404'd/partial sources are flagged.
- Hybrid doctrine throughout: **deterministic rules define the floor and vocabulary; AI chooses the sentence**, bounded by deterministic validators.

## Open questions that still need research (see each doc's Open Questions section)
- Localized validation of Aaker dimensions (e.g., Romanian/Sibiu SMB context).
- Empirical weighting of perception levers for SMB sites.
- Character-vector extraction reliability across the 11 target verticals.
- €0-feasible competitive scan.
- Color-emotion myth vs evidence synthesis.
- Calibration dataset for the critique loop.

## Suggested next research (NOT yet done — founder's extended shortlist)
Image intelligence / art direction · Typography intelligence · Color intelligence · Conversion-without-template · "How to make AI look human-designed" · Design grammar · Website perception psychology · Creative direction from raw data · Competitive differentiation · Design evolution / iterative critique loop.
(The Creative-Direction doc already sketches most of these; they are natural follow-ups, not repetitions.)
