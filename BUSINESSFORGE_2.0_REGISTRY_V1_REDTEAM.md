# Registry v1 — Red-Team Report

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus. Design-input history, not current status.
> Current status: `docs/MASTER_INVENTORY.json` (machine-readable) and
> `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical). The registry it reviews is
> now real and tested — see `lib/design/experienceRegistry.ts` and
> `test/design/experienceRegistry.test.ts`.

_Read-only. Produced 2026-08-14. **Nothing implemented. No source file, configuration, n8n
workflow, test, or dependency modified, installed, or removed.**_

Fourth in the series. The first three built the case; this one attacks it, **including the parts I
wrote**. Two findings below correct claims I made in
[MASTER_ARCHITECTURE](BUSINESSFORGE_2.0_MASTER_ARCHITECTURE.md) and
[CAPABILITY_ARSENAL](BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md), and one of them is the most serious
finding in the whole series.

**Marks:** `[V]` verified in the repository this pass · `[W]` web-searched, approximate ·
`[?]` unknown · `[SELF]` corrects a claim in an earlier document of mine.

**"Registry v1"** here means the design recommended in
[REGISTRY_REVIEW §11](BUSINESSFORGE_2.0_REGISTRY_REVIEW.md): the capability registry (44 entries),
the provider registry (CORE/CONDITIONAL/SPECIALIST/FALLBACK), the agent pools, the routing and
fallback matrices, and the cabinet cost model.

---

## 0. Findings by severity

| # | Finding | Severity | Kind |
|---|---|---|---|
| **C1** | The core invariant is **already violated** by shipped code — a coding agent with write access edits the delivered site | **CRITICAL** | `[V]` `[SELF]` |
| **C2** | Quorum, jury and cross-vendor independence are **assumed, not established** — and the cost model *profits from* the correlation | **CRITICAL** | reasoning |
| **C3** | Nothing anywhere measures whether the system produces **better** sites. Distinctness is not quality. | **CRITICAL** | `[V]` absence |
| **C4** | Reconcept has **no best-so-far retention** — the delivered design can be worse than iteration 1, and iteration 1 is destroyed | **CRITICAL** | `[V]` |
| **H1** | Design Memory as a global repulsor **saturates at ~324–4,200 designs by construction**, and much sooner in practice | HIGH | `[V]` + arithmetic |
| **H2** | "Round 1 elimination is free" is **wrong** — generation is paid before elimination | HIGH | `[SELF]` |
| **H3** | Google is a **single point of failure for the entire €0 configuration** | HIGH | `[SELF]` |
| **H4** | The cabinet as specified is **more expensive than one multi-field call** and yields correlated outputs | HIGH | reasoning |
| **H5** | PII control sits at the **wrong layer** — by render time the data has already reached a vendor | HIGH | `[V]` |
| **H6** | Design fingerprints are **pseudonymous, not anonymous**; "no PII in Design Memory" was too glib | HIGH | `[SELF]` |
| **H7** | The platform has **no licence to redistribute** the business's own Facebook/Instagram photographs | HIGH | `[V]` + reasoning |
| **H8** | Provider redundancy is itself **correlated** — free tiers contract as one market event | HIGH | `[W]` |
| **M1–M8** | Redundant capabilities, unexercised fallbacks, unpriced cost terms, no post-delivery revision path, weirdness drift, and four others | MEDIUM | mixed |

---

## 1. CRITICAL

### C1 — The invariant is already broken, and I said twice that it held `[V]` `[SELF]`

Both prior documents state, as the single structural guarantee of the architecture:

> *"The model decides INTENT from a closed vocabulary; deterministic code executes it. No model
> ever emits CSS, JS, GLSL, markup, or a business fact."*

**That is false today.** `scripts/visual-qa.ts` does this [V:156–208]:

```
spawn(claudeBin,
  ['-p', '--allowedTools', 'Read,Edit,Write', '--max-turns', '18',
   '--model', 'sonnet', '--output-format', 'text'],
  { cwd: siteDir, … })
```

It **spawns the Claude Code CLI with Read/Edit/Write inside the rendered site directory** and lets
it edit `index.html` and `styles.css` for up to 18 turns. The constrained find/replace patcher that
the module documents so carefully — *"the patcher is deliberately dumb… it only edits CSS or HTML
the page already contains"* [V: `lib/qa/visual-qa.ts:97–149`] — **is bypassed entirely on this
path**. `applyPatches` is never called; a *synthetic* `FilePatch` is fabricated afterwards purely
for bookkeeping [V:207].

The only real control is a content hash before and after, which answers *"did anything change?"*
and not *"what changed, and was it allowed?"* [V:200–203].

**Severity assessment, stated fairly:**

- It is **gated behind `--autofix`** and lives in a script, not the pipeline [V: `patchSite: autofix ? patchWithClaude : noPatch`].
- `runJob` and the n8n loop do **not** call it — they use `visual-critic`, which judges and never edits [V].
- So it is **not on the autonomous product path today.**

**Why it is still CRITICAL:**

1. It is **one wiring away**. Registry v1 assigns `visual_defect_detection` a capability id and
   classes it CONDITIONAL — which would *legitimise* this path and make it routable.
2. The arsenal document lists "autonomous coding agents on the product path" under **REJECT**. The
   thing being rejected already exists in the repository, and the rejection was written as though
   it were hypothetical.
3. The invariant is the load-bearing claim of the entire architecture. An invariant with a known
   exception is a convention. Every downstream argument that rests on it — the security posture,
   the reproducibility guarantee, the "no invented facts" rule — inherits the exception.

**Red-team verdict:** Registry v1 must carry an explicit `modelMayWriteOutput: false` field on
every capability, enforced at the router, and `visual_defect_detection` must either be
re-implemented against the constrained patcher or classified **REJECT** rather than CONDITIONAL.
Do not classify as CONDITIONAL a capability whose only implementation violates the invariant.

---

### C2 — Independence is assumed, and the cost model is built on exploiting its absence

Registry v1 leans on three independence assumptions:

- **Quorum (M2/M3):** deterministic floor + a cheap model; escalate only on disagreement.
- **Visual Jury:** k=2 judges from different vendors, both orderings.
- **Adversarial Critic:** must differ in vendor from the Creative Director.

All three treat "different vendor" as a proxy for "independent observation". **It is not.**

**Four correlation channels, none of them addressed:**

1. **Shared input.** Every cabinet seat receives the same brief from one builder
   [V: `buildDesignBrief`]. Correlated inputs produce correlated errors. If the brief mis-frames
   the business — a wedding venue whose scraped text is all about parking — every seat is wrong in
   the same direction, and they will agree.
2. **Shared prior.** Frontier models are trained on overlapping corpora and post-trained toward
   similar aesthetics. Two vendors agreeing that a bakery should be "warm, rustic, serif" is not
   two observations; it is one cultural prior expressed twice. **Cross-vendor defeats *position*
   bias and *self-enhancement* bias. It does nothing about *shared-prior* bias**, which is exactly
   the bias that produces generic output — the thing the whole gate exists to catch.
3. **Shared derivation.** In the quorum, the "free vote" is the deterministic floor — but the
   cheap model reads a brief *derived from the same evidence the floor used*. They are not two
   witnesses; they are one witness and a paraphrase.
4. **Judge–subject kinship.** The jury judges screenshots of designs whose concepts were authored
   by models from the same ecosystem. Self-enhancement at the ecosystem level, not the model level.

**The sharpest form of the attack — the cost model profits from the flaw.** Mechanisms M2/M3 save
money *precisely when the voters agree*. If voters agree because they are correlated rather than
because they are right, then **agreement is a cost-saving signal, not a correctness signal**, and
the cheaper the cabinet gets, the less it is actually verifying. The design's efficiency and its
epistemic value move in opposite directions. That is not a tuning problem; it is a structural
one.

**What Registry v1 must add:**

- **Decorrelate by input view, not by vendor.** Give seats *different projections* of the evidence:
  one sees only the image inventory and its metadata, one only the business's own words, one only
  the listing/structured facts. Disagreement then carries information.
- **Measure agreement empirically and act on it.** Log pairwise agreement per capability. **If two
  "independent" judges agree above ~90%, one of them is free to delete** — you are paying twice for
  one opinion. This is a cheap, decisive experiment and nothing in Registry v1 schedules it.
- **Treat unanimity on a hard question as a warning, not a pass.** A closed enum where every voter
  agrees every time means the enum is not being decided; it is being read off the prior.

---

### C3 — Nothing measures whether the system produces better sites `[V]` absence

Searched: no module, test, or script compares output quality against any reference. What exists:

| Instrument | Actually measures | Does **not** measure |
|---|---|---|
| `scoreExperience` [V] | internal consistency between design and character | whether a visitor prefers it |
| `narrativeCoherence` [V] | structural rule violations | whether the story lands |
| `genericityReport` [V] | **difference across a set** | whether any of them is good |
| Visual Critic 13 axes [V] | an uncalibrated model's opinion | agreement with humans — **never run against a live key** [V] |
| `benchmark.test.ts` [V] | that two businesses **diverge** | that either result is better than the floor |

**Every one of these is a consistency or diversity instrument. None is a quality instrument.**

The consequence is severe and specific: **the entire cabinet / battle / jury apparatus could be an
expensive random-number generator that produces *different* sites, and nothing in Registry v1 would
detect it.** The distinctness gate would pass a set of six sites that are all differently bad, and
report `verdict: 'diverse'` with a rationale [V: `quality.ts:260-262`].

Worse, the two objectives can be **anti-correlated**. A gate that rewards difference rewards
weirdness at the margin. Nothing in Registry v1 bounds the distinctness pressure with a quality
floor derived from anything outside the system's own opinion of itself.

**The missing experiment — and it is cheap.** Before any registry is built:

> Take 20 already-collected businesses. Build each **twice**: once with the deterministic floor
> (`--compose`, €0, already works [V]), once with the full cabinet + battle. Strip all identifying
> marks. Show both to a panel of humans — ideally including actual small-business owners — in
> random order. Ask one question: *"Which would you rather have as your website?"*

Three possible outcomes, all valuable:

- **Cabinet wins decisively** → the apparatus is justified; build Registry v1.
- **Statistical tie** → the cabinet is theatre. The €0 floor is the product; spend the budget on
  evidence quality (OCR, Places, better photography handling) instead.
- **Floor wins** → the models are actively degrading a strong deterministic system, which is a
  finding worth more than the entire arsenal.

**Registry v1's fatal omission is not a capability. It is that it is unfalsifiable.** It should
not be built until this experiment has run, because it can be built for less money in the second
outcome and should not be built at all in the third.

---

### C4 — Reconcept can deliver a worse site than it already had, and destroys the better one `[V]`

The loop rebuilds the design and overwrites in place:

```
reconceptBuild → fs.writeFile(outputDir/'5b-design.json', design)   [V: runJob.ts:259]
runJob        → design = rebuilt.design                             [V: runJob.ts:446]
```

There is **no best-so-far retention anywhere** [V: searched `runJob.ts` — no score comparison, no
candidate archive]. Concretely:

```
iteration 1: overallScore 68  → FAIL (threshold 70)  → 5b-design.json = A
iteration 2: overallScore 55  → FAIL                 → 5b-design.json = B  (A destroyed)
iteration 3: overallScore 51  → FAIL, maxIter        → 5b-design.json = C  (B destroyed)
                                       ↓
                        ESCALATE, handing the human design C — the worst of the three,
                        with A and B unrecoverable.
```

The loop is a **random walk with no ratchet**. Three compounding problems:

1. **No monotonicity.** `perturbedDirective` rotates by array index [V:268–296]; nothing prevents
   iteration 3 from landing near iteration 1, and nothing prefers a higher score.
2. **No memory of rejected regions.** Even with the Director enabled and feedback fed back, the
   loop does not record *which axis values were already tried and failed*, so it can revisit them.
3. **Termination is by exhaustion, not convergence.** Hermes escalates on `iteration >= maxIter`
   [V: `hermes.ts:49`] — correct as a bound, but it means the *last* design is delivered to the
   human, not the *best*.

**This is the cheapest critical fix in the series:** keep every candidate under
`candidates/<iteration>/`, track the best score seen, and have Hermes escalate **with the best
candidate**, not the last. It requires no new capability and no provider. Registry v1 does not
mention it, and the battle design (§9 of the arsenal) quietly assumes it while the loop it extends
does the opposite.

---

## 2. HIGH

### H1 — Design Memory saturates by construction, and the ceiling is computable `[V]` + arithmetic

Design Memory is specified as a **repulsor**: a candidate must be at least *d* from every prior
design. The structural fingerprint (L1) is derived from `WebsiteDesign`, which is a deterministic
function of `BusinessCharacter` plus a photographic seed [V: `composeDesign`].

**Count the character space** [V: `lib/design/character.ts`]:

| Axis | Cardinality |
|---|---|
| `visualWeight` | 3 |
| `expressiveness` | 3 |
| `emotionalRegister` | 4 |
| `offeringBreadth` | 3 |
| `narrativePotential` | 3 |
| **product** | **324** |
| × `signatureCandidate` (a SectionKind or null, and itself derived) | ≤ ~13 |
| **upper bound** | **~4,200, and 324 in the structurally meaningful sense** |

So: **there are at most a few hundred structurally distinct designs the system can produce**, and
colour (the continuous part, from `brandSeedFor`) is *perceptual*, not structural — it moves L2,
not L1.

Now add the real distribution. Local SMB character vectors are **heavily clustered**: a large
share of plumbers, accountants, notaries and shops land in `text-led / measured / functional /
focused / none`. If 40–60% of businesses occupy a handful of cells, then:

- the **first** business in a cell ships;
- **every subsequent business in the same cell fails the repulsor**, because its structural
  fingerprint is identical by construction;
- the gate routes them to reconcept, which perturbs into *less appropriate* configurations to
  satisfy a distance constraint that has nothing to do with that business;
- the system degrades **monotonically as it succeeds**.

**Registry v1 has this exactly backwards.** It treats distinctness as a resource that scales; it is
a resource that *depletes*. Three consequences:

1. **Scope novelty, never globally.** Compare within `(industry × geography × time window)`. Two
   bakeries in different cities are not competitors and must never repel each other.
2. **Structural distinctness has a ceiling; content distinctness does not.** Past saturation,
   differentiation must come from copy, imagery and evidence — which are continuous and
   business-specific — not from structure, which is discrete and small. Registry v1's fingerprint
   weights (L1 0.5 / L2 0.35 / L3 0.15) push in exactly the wrong direction as the corpus grows.
   **The weights must shift toward L2/L3 over time**, or the threshold must decay with cell
   occupancy.
3. **Identical structure for identical character is correct, not a defect.** Two businesses that
   genuinely are the same *kind* of business should get the same *shape* of page and different
   *content*. A repulsor that denies this is fighting the architecture's own best property — that
   design is derived from character [V: ADR 0006].

### H2 — "Round 1 elimination is free" is wrong `[SELF]`

The arsenal document (§9.3) and Registry v1 both claim: *"Never spend a vision call on a candidate
the deterministic gates already reject. This alone bounds battle cost to survivors, not N."*

**Half true, and the half that is false is the expensive half.** Round 1 eliminates *after* the
candidate has been generated — and generating a candidate costs the whole cabinet. The saving is on
the **jury**, not on **generation**:

```
claimed:  cost ≈ survivors × (cabinet + jury)
actual:   cost ≈ N × cabinet  +  survivors × jury
```

At N=3 with 1 survivor, the real cost is **3 cabinets + 1 jury**, not 1 of each. In the asymmetric
seating model that is ~$0.045 rather than ~$0.015 — a **3× understatement** of the dominant term.

**The genuinely free elimination that Registry v1 misses:** the structural fingerprint of a
candidate can be computed **from its directive, before any model call**, because `composeDesign` is
deterministic. So the loop can enumerate perturbations, compute their L1 fingerprints, discard
those too close to memory or to each other, and **only then** convene cabinets for the survivors.
That is elimination *before* generation, and it is the optimisation the cost model was claiming to
have.

### H3 — Google is a single point of failure for the entire €0 configuration `[SELF]`

The arsenal claimed *"no provider appears as 1st in more than two fallback rows."* Under the **€0
configuration** — the one that matters before the first customer — Gemini is the first choice for
reasoning, prose, vision description, image generation (Imagen), and the embeddings fallback.

**One vendor policy change ends the free baseline.** This is not hypothetical: Google stopped
serving free Gemini CLI requests on 18 June 2026 [W].

**Mitigation Registry v1 must carry:** Groq and the OpenRouter free pool must be **exercised
paths, not documented ones**. The repository's own doctrine applies — adapters that follow a
published shape but have never made a real call must be treated as untested: *"Treat the first
live run of each as the test"* [V: `docs/architecture.md:193–206`]. A fallback that has never run
is a fallback that does not work.

### H4 — The cabinet may be one agent wearing five hats

Registry v1 routes Art, UX, Motion and Asset directors to the **same** cheap model class (Groq /
Luna / Flash-Lite) and feeds them the **same** brief. Four separate calls to one model with one
input, each returning a few enum fields.

**That is strictly worse than one call returning all four fields:** four times the request
overhead, four times the shared-prefix tokens, four times the latency, and outputs that are
correlated anyway because it is the same model reading the same brief.

The cabinet metaphor only pays for itself if the seats are **genuinely different agents** — which
requires different models *and* different input views (C2). Registry v1 gives them neither.

**Verdict: either decorrelate the seats properly, or collapse them into one `design_intent` call
and stop calling it a cabinet.** As specified it is the worst of both: cabinet cost, single-agent
diversity.

### H5 — PII control is at the wrong layer `[V]`

Registry v1 adds `pii_detection` as a CORE capability. Two problems:

1. **Detection is a filter, and filters fail open.** The architecture's own strongest pattern is
   structural, not detective: the writer's schema *has no field* for a phone number, so the model
   cannot supply one [V: `agents/writerAgent.ts:11–31`]. The equivalent control here is a **typed
   PII boundary on `BusinessProfile`** — fields that are structurally unrenderable — not a scanner
   that hopes to catch things.
2. **Placement is too late.** Scraped page text is embedded verbatim into the analyst, writer and
   director briefs [V: `designDirectorAgent.ts:479–484`]. Screening at render means the staff
   member's mobile number **already went to a model vendor**. Screening must happen at `normalize`,
   before the first model call, or it is theatre with an audit trail.

### H6 — Fingerprints are pseudonymous, not anonymous `[SELF]`

Registry v1 states Design Memory holds *"fingerprints and design decisions only — never customer
PII."* That is too glib. A record containing `{businessId, industry, character vector, narrative
order, palette, section set, verdict}` is **singling-out data**: it identifies one business's
design uniquely and links to its run. Under GDPR that is pseudonymous personal data, not anonymous
data, and it carries retention and erasure obligations.

Combined with a stated retention of "unbounded — the whole point is long memory", this is a
deletion-request problem waiting to be discovered by the first customer who asks.

**Also unresolved:** `output/` **is** gitignored [V: `.gitignore` — `output/*`, `!output/.gitkeep`],
which closes the "PII in git history" question raised earlier. But the artifact directories persist
on disk indefinitely, contain the full scrape including any PII, and are explicitly reused as
regression fixtures [V: `main.ts:240–247`]. **Nothing defines their retention.**

### H7 — No licence to redistribute the business's own social photographs `[V]` + reasoning

The collector harvests images from Facebook/Instagram/Google-hosted URLs and the system marks them
`reference-only(rights?)` [V: `designDirectorAgent.ts:345,371–374`]. Registry v1's proposed control
is a gate: such an asset may not be the hero of a paying deliverable.

**The gate is not sufficient, because the problem is not prominence — it is redistribution.**
Copying a photograph from a Facebook page into a website the platform builds and hosts is
republication by a third party. The uploader granted rights to the platform they uploaded to, not
to a scraper. This is true whether the image is the hero or a thumbnail, and it is true even when
the site is delivered to the business that took the photograph — because the platform, not the
business, performed the copying and the hosting.

**The honest control is not a rights *flag* but a rights *acquisition step*:** the business
confirms it owns and licenses the images, as an explicit input to the run. That is a **missing
capability** (`rights_confirmation`, human-in-the-loop) and it belongs in the registry as CORE, not
as a gate on an existing capability.

### H8 — Provider redundancy is itself correlated `[W]`

Registry v1's anti-lock-in argument assumes provider failures are independent. The evidence from a
single year says otherwise:

| Event | Date [W] |
|---|---|
| Alibaba free developer API tier ends | April 2026 |
| Google stops serving free Gemini CLI requests | June 2026 |
| Brave Search API free tier removed | by 2026 |
| DeepSeek off-peak discount ends (peak *surcharge* announced) | Sept 2025 / TBA |
| Sora API discontinuation scheduled | Sept 2026 |

**Five contractions in roughly twelve months, across five unrelated vendors.** These are not five
independent accidents; they are one market repricing subsidised inference. A fallback chain of
`Gemini free → Groq free → OpenRouter free` is three draws from the same correlated distribution.

**What Registry v1 must add:** at least one fallback rung that is **structurally uncorrelated with
vendor economics** — local inference (Ollama/llama.cpp for text, ONNX/transformers.js for
embeddings) — and, above all, the **deterministic floor**, which is the only rung immune to a
pricing decision. Registry v1 already has the floor. It should stop treating three free tiers as
three levels of safety.

---

## 3. MEDIUM

| # | Finding |
|---|---|
| **M1** | **Redundant capabilities in Registry v1 itself.** `content_safety` and `pii_detection` are both "screen scraped content before it ships" — merge into `evidence_screening` with two rule classes. |
| **M2** | **`evaluation_calibration` is classed CONDITIONAL but is load-bearing.** Without it the jury is unfalsifiable (C3). It is either CORE, or the jury should not gate delivery. Registry v1 is internally inconsistent here. |
| **M3** | **OpenRouter `:free` is a moving target** — models are added and pulled as promotional windows close [W]. A fallback whose membership changes weekly cannot be bound to a specific capability. It is a *pool*, not a provider, and needs a liveness probe before each use. |
| **M4** | **Cost model omits three real terms:** retries (`AI_MAX_RETRIES=3` → up to 4× on a flaky provider [V]), wall-clock (3 candidates × 2 viewports × Playwright ≈ the real bottleneck), and **human escalation time — the most expensive resource in the system, entirely unpriced.** |
| **M5** | **No post-delivery revision path.** Every state machine in the series ends at `delivery` or `human`. "The customer wants the hero photo changed" has no state, no capability, and no cost model. For a business selling websites this is not an edge case. |
| **M6** | **Distinctness pressure has no upper bound.** The gate rewards difference; nothing penalises incoherent difference beyond `narrativeCoherence`'s rule set. Needs an explicit quality floor that is not derived from the system's own opinion. |
| **M7** | **`modelForbidden` is proposed but has no enforcement point.** A flag in JSON that no code checks is documentation. Given C1, this is the field most likely to be written and least likely to be honoured. |
| **M8** | **Registry v1 has no schema-version migration story.** Fingerprints carry `fingerprintVersion`, but nothing says what happens to a memory corpus when the extraction changes — silently invalid comparisons, exactly the failure the repo already guards against for artifacts [V: `ARTIFACT_DEFAULTS`]. |

---

## 4. What survives the attack

A red team that condemns everything is useless. These parts of Registry v1 are correct and should
be built as specified:

- **`terminalFallback` mandatory on every capability.** The strongest idea in the design. Every
  chain ending in something the repo already owns is what makes the system fail to *plainer*, never
  to *nothing* [V: `composeBaseline`].
- **Licence and jurisdiction as hard filters, never rank inputs.** This is what makes the FLUX
  non-commercial open-weight trap [W] structurally unable to reach a customer.
- **Static/volatile split.** Prices and quality priors in JSON with `asOf`/`verified`; real ranking
  from telemetry the repo already collects [V].
- **`agent-registry.json` should not exist.** Agents stay TypeScript; generate the manifest.
- **Startup validator failing loudly on dangling references**, on the `MCP_SERVERS` precedent [V].
- **Hermes stays deterministic**, and its check order is preserved verbatim [V].
- **Splitting `browser` into `evidence_collection` and `qa_measurement`** — and C1 is now the
  evidence that this split is not academic.
- **Convene-on-need (M4 of the cabinet model).** Independent of the correlation critique, not
  convening a seat that has nothing to decide is simply correct.
- **Groq as a CORE cheap-seat provider** — subject to H3/H8, it must actually be exercised.

---

## 5. The order operations should now happen in

Registry v1's build order is wrong because it assumes the apparatus is worth building. The
falsifiable steps come first, and four of the five are free.

| Step | Cost | Answers |
|---|---|---|
| **1. Floor-vs-cabinet blind human A/B on 20 businesses (C3)** | €0 + panel time | *Does any of this make sites better?* **Nothing else should be built until this returns.** |
| **2. Best-so-far retention in the reconcept loop (C4)** | €0 | Stops the loop delivering its worst attempt |
| **3. Character-cell occupancy count over the existing corpus (H1)** | €0 | How many designs until the repulsor starts failing everyone |
| **4. Judge agreement measurement (C2)** | small | Whether k=2 is two opinions or one opinion twice |
| **5. Decide C1: re-implement `visual_defect_detection` against the constrained patcher, or REJECT it** | €0 | Whether the invariant is real |
| **6. Exercise Groq + OpenRouter free against live keys (H3/H8)** | €0 | Whether the fallbacks exist |
| 7. *Then* build the registry, with the v2 deltas below | — | — |

---

## 6. Registry v2 — the deltas

**Capabilities to ADD:** `rights_confirmation` (H7, human-in-the-loop, CORE) ·
`post_delivery_revision` (M5) · `best_candidate_retention` (C4 — arguably orchestrator behaviour,
but it must be somebody's named responsibility) · `judge_calibration` promoted CONDITIONAL → CORE
(M2).

**Capabilities to MERGE:** `content_safety` + `pii_detection` → `evidence_screening`, evaluated at
**normalize**, before the first model call (H5, M1).

**Capabilities to RECLASSIFY:** `visual_defect_detection` CONDITIONAL → **REJECT** until it is
re-implemented against the constrained patcher (C1).

**Fields to ADD to every capability entry:**

```jsonc
"modelMayWriteOutput": false,      // C1 — enforced at the router, not documented
"independenceClass": "shared-prior | shared-input | independent",   // C2
"noveltyScope": ["industry", "geography", "6-months"],              // H1 — never global
"piiBoundary": "pre-model | post-model | none",                     // H5
"retentionDays": 365                                                // H6
```

**Fields to ADD to the fingerprint spec:** weights that **shift from L1 toward L2/L3 as cell
occupancy rises** (H1), and a documented migration policy for `fingerprintVersion` changes (M8).

**Cost model corrections:** generation is paid before elimination (H2); add retries, wall-clock,
and a price for human escalation minutes (M4).

**One deletion:** the claim that cross-vendor judging delivers independence. Replace with
"cross-vendor defeats position and self-enhancement bias only; shared-prior bias is unaddressed and
must be measured" (C2).

---

## 7. The one-paragraph answer to "does this produce better sites?"

**Unknown, and Registry v1 as specified cannot find out.** The system has strong instruments for
*consistency* (`scoreExperience`, `narrativeCoherence`, `auditContent`) and for *difference*
(`genericityReport`, the distinctness gate), and **no instrument for quality**. Every quality claim
in the series rests on a model's uncalibrated opinion — from a critic that has, by the
repository's own record, never been run against a live key. Meanwhile the deterministic floor
already produces complete, business-specific, accessible, fast, distinct sites at €0 [V], and the
one experiment that would show whether the expensive apparatus beats it has never been run and
costs nothing but a panel's afternoon. **Run the A/B first. It is the only finding in this report
that changes what should be built rather than how.**

---

_End. Nothing implemented. The repository, the n8n workflow, and the dependency tree are exactly as
they were found._
