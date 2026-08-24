# BusinessForge — Architecture V2

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus. Design-input history, not current status.
> Current status: `docs/MASTER_INVENTORY.json` (machine-readable) and
> `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical).

_Design proposal. Produced 2026-08-14. **Nothing implemented. No source file, configuration, n8n
workflow, test, or dependency modified, installed, or removed.**_

**On the inputs.** Documents 1, 3, 4 and the repository audit are present and were used.
Document 2 is present under the name `BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md`.
**`CONTROL_PLANE_AUDIT.md` does not exist in this repository** — I searched. Rather than invent
its contents, I verified each of its ten named findings directly against the code this pass. All
ten confirm; two are worse than the names suggest. Every one is cited `[V]` below.

**Marks:** `[V]` verified in code this pass · `[SELF]` corrects an earlier document of mine ·
`[?]` unresolved.

---

## A. EXECUTIVE VERDICT

**V2 is not a multi-agent system with a deterministic fallback. It is a deterministic system with
a bounded, budgeted, evidence-triggered escalation ladder.**

That inversion is the whole proposal. Every mechanism below exists to answer one of two questions:
*is escalation justified here?* and *what is the cheapest way to find out?* Nothing exists because
it is architecturally elegant.

Five commitments:

1. **One control plane.** Hermes stops being a decision function and becomes the authority that
   owns state, transitions, budget, retries, and delivery. Today authority is split across at
   least four files with three different state vocabularies `[V]`.
2. **One state machine, one ledger, one writer per fact.** The repository currently has **three
   incompatible stage vocabularies** — `main.ts` (9), `jobState.ts` (16), `scripts/n8n/stage.ts`
   (7) `[V]` — and two drivers that behave differently on resume `[V]`.
3. **A small cabinet, not a five-seat one.** Divergence is generated deterministically and
   **filtered before any model call**, because `composeDesign` is deterministic and a candidate's
   structural fingerprint is computable from its directive alone. Model spend begins after
   elimination, not before `[SELF: this corrects the "Round 1 is free" claim]`.
4. **Quality and distinctness are different dimensions with different owners, different
   thresholds, and different failure routes** — combined **lexicographically**, never as a
   weighted sum. Distinctness may never be permitted to buy down quality.
5. **Phase 0 can cancel Phases 4–8.** The floor-vs-cabinet A/B runs first. If the deterministic
   floor ties or wins, most of this architecture is not built, and V2 is shaped so that outcome
   costs almost nothing to act on.

**What V2 deletes from V1:** the five-seat cabinet, the always-on k=2 jury, the global structural
repulsor, `agent-registry.json`, and the assumption that different vendors give independent
opinions.

---

## B. DECISIONS FROM RED TEAM AND CONTROL-PLANE FINDINGS

### B.1 Red-team C1–C4

| # | Finding | Decision | What V2 does |
|---|---|---|---|
| **C1** | Coding-agent autofix bypass — `scripts/visual-qa.ts` spawns Claude Code with `Read,Edit,Write` in the site dir for 18 turns, bypassing the constrained patcher `[V:156-208]` | **REJECT the path, BUILD the guard** | `visual_defect_repair` is removed from the autonomous plane entirely. It survives only as a **workshop** tool a human invokes on a run that has already been delivered or escalated. A `modelMayWriteOutput` flag is added to every capability and **enforced at the router**, not documented. A model-written byte may never reach a customer artifact. |
| **C2** | Correlated judges — cross-vendor defeats position and self-enhancement bias, not shared-prior bias | **MODIFY** | Independence is (a) **measured** — pairwise agreement logged per capability, and a pair agreeing >90% is collapsed to one paid judge; (b) **engineered by input view**, not by vendor — the deterministic score, the vision judge, and the fingerprint see *different projections* of the artifact; (c) **k is dynamic**: 1 judge by default, 2 only when the verdict lands within a margin of the threshold. |
| **C3** | No quality benchmark — nothing measures whether output is *better*, only *consistent* and *different* | **BUILD, and gate everything on it** | §I defines the A/B. It is **Phase 0** and it has veto power over Phases 4–8. |
| **C4** | No best-so-far — reconcept overwrites `5b-design.json`; a worse iteration replaces a better one and destroys it `[V: runJob.ts:259,446]` | **BUILD immediately (free)** | §K: immutable per-candidate directories, an append-only candidate ledger, and a monotone promotion rule. Delivery and escalation always carry the best candidate, never the last. |

### B.2 Control-plane findings — verified independently

| # | Finding | Verified? | Decision |
|---|---|---|---|
| **CP1** | Authority fragmentation | **Yes, worse than named** `[V]` — config authority is documented as `lib/config.ts` alone, but `VISION_*` is read via `process.env` in three scripts; loop control exists in `runJob.ts`, `scripts/n8n/stage.ts`, and the n8n workflow JSON simultaneously | **BUILD** — §C assigns exactly one owner per fact |
| **CP2** | Two state machines | **Three** `[V]` — `main.ts` STAGES (9), `JobStage` (16), `stage.ts` STAGES (7) | **BUILD** — §E, one vocabulary |
| **CP3** | No concurrency | **Yes** `[V]` — the stage server serialises everything through one promise chain; `runJob` is strictly sequential; no parallelism exists anywhere | **BUILD** — §F/§G, with concurrency owned by the Runner, not Hermes |
| **CP4** | No rate limits | **Yes** `[V]` — grep for RPM/rateLimit/semaphore/concurrencyLimit across `lib`, `scripts`, `main.ts` returns **nothing** | **BUILD** — §L, a per-vendor governor |
| **CP5** | No budget leases | **Yes** `[V]` — no ledger of any kind | **BUILD** — §M |
| **CP6** | No model failover | **Yes** `[V]` — the factory exposes only `createDefault()` and `create(name)`; `withRetry` retries **the same provider instance**. A provider outage fails the stage; it does not fail over | **BUILD** — §L |
| **CP7** | QA vision bypass | **Yes, and it is a PASS-path defect** `[V]` — `gateJob` pushes a failure reason only when `critic.genericVerdict === 'generic'`. With vision disabled the verdict is `'uncertain'`, **no reason is pushed**, and a design scoring ≥70 with no peer set returns **PASS with zero visual evidence** | **BUILD** — §I: `uncertain` becomes a *blocking* condition for delivery, not a neutral one |
| **CP8** | False checkpoint/resume | **Yes** `[V]` — `runJob` opens with `createJob(...)` then `saveJob(outputDir, job)`, and because `saveJob` spreads the patch **over** the existing record, every field including `iteration: 0` is overwritten. **`runJob` cannot resume; it silently restarts the loop.** The n8n path *does* load the existing job — so the two drivers behave differently on the same run | **BUILD** — §P |
| **CP9** | Security | Partially strong `[V]` — see §O | **KEEP + MODIFY** |
| **CP10** | PII | **Yes** `[V]` — scraped text enters model briefs verbatim; no screening at any layer | **BUILD** — §O, screening at `normalize`, before the first model call |
| **CP11** | Failure recovery | **Yes, with a code/comment contradiction** `[V:453-463]` — the reconcept catch block logs *"escalate rather than spin"* but the patch it writes contains **no `decision` field**, so the job returns with `decision: 'running'` while being finished | **BUILD** — §N |

---

## C. SINGLE SOURCE OF TRUTH

**The rule: exactly one component may write each fact. Everyone else reads.** Violations of this
rule are the root cause of CP1, CP2 and CP8.

| Fact | Sole owner | Everyone else |
|---|---|---|
| **Job state & transitions** | **Hermes** | reads; proposes nothing |
| **Stage results (artifacts)** | the **stage that produced it**, write-once | read-only thereafter |
| **Budget & leases** | **Hermes** (issuer) | requests a lease; cannot self-authorise |
| **Model / provider selection** | **Capability Router** | agents name a capability, never a vendor |
| **Retries (transient)** | **Capability Router** (within a call) | — |
| **Retries (stage-level)** | **Hermes** | — |
| **Concurrency & scheduling** | **Runner** (the orchestrator process) | Hermes sets *admission*, Runner sets *when* |
| **Quality verdict** | **Quality Gate** | produces a verdict, never a decision |
| **Distinctness verdict** | **Distinctness Gate** | produces a verdict, never a decision |
| **Best-so-far pointer** | **Candidate Ledger**, monotone writes only | nobody may write it directly |
| **Delivery** | **Hermes** | — |
| **Escalation** | **Hermes** | — |
| **Configuration** | `lib/config.ts` **only** — including `VISION_*`, which today bypasses it `[V]` | — |

Two derived rules that resolve CP1 and CP7:

- **A gate never decides.** It returns a verdict plus evidence. Hermes converts verdicts into
  transitions. Today `gateJob` computes a `route`, which is a decision wearing a verdict's name
  `[V]`; in V2 the route becomes an *advisory diagnosis* and Hermes owns the routing table.
- **A verdict of "cannot vouch" is not a pass.** `uncertain` blocks delivery.

---

## D. HERMES

### What Hermes **is**

A **deterministic control plane**: a pure state machine over the job ledger that owns admission,
transitions, budget, and termination. It is the only component that may change what state a job is
in.

### What Hermes **is not**

- **Not an agent.** It has no prompt, no schema, no model, and never will. A component that
  decides whether to spend more money on model calls must not itself be a model call.
- **Not a scorer.** It never re-computes a score. Gates score; Hermes decides `[V: today's rule, keep it]`.
- **Not a router.** It never names a provider or a model.
- **Not a scheduler.** It grants admission (*may this run?*); the Runner decides concurrency
  (*how many at once, and when*).
- **Not a workflow engine.** n8n triggers and visualises; it does not decide (§Q).

### What Hermes decides

Admission of a stage · issuance and revocation of budget leases · every state transition · the six
stop conditions (§U) · which candidate is delivered (always the ledger's best, never the last) ·
when a human is called and with what brief.

### What Hermes does not decide

Which model · which provider · how many workers · what a score means · what the copy says · what
the design looks like.

### State Hermes owns

```
JobLedger {
  jobId, brief, createdAt
  state: State                       // §E, the ONE vocabulary
  attempt: { retry, rebuild, reconcept }   // three counters, not one
  budget:  { granted, consumed, leases[] }
  candidates: CandidateRef[]         // append-only
  best: CandidateRef | null          // monotone (§K)
  verdicts: { quality, distinctness, technical }[]   // history, not just latest
  failures: FailureRecord[]
  decision: Decision | null          // set exactly once, at termination
  terminatedAt: string | null
}
```

### Events Hermes receives

`StageCompleted{stage, artifactHash, cost, durationMs}` ·
`StageFailed{stage, errorClass, retryable}` ·
`VerdictProduced{gate, verdict, score, evidence}` ·
`LeaseConsumed{leaseId, actual}` ·
`CandidateBuilt{candidateId, fingerprint, scores}` ·
`HumanResponded{decision, note}` ·
`ProcessResumed{jobId}`

### Commands Hermes emits

`AdmitStage{stage, leaseId, budgetCap}` ·
`RevokeLease{leaseId}` ·
`Transition{from, to, reason}` ·
`PromoteCandidate{candidateId}` (via the ledger's monotone rule only) ·
`Deliver{candidateId}` ·
`Escalate{brief, candidateId}` ·
`Abort{reason}`

---

## E. STATE MACHINE V2

**One vocabulary replacing three.** Twelve states. `main.ts`'s nine stages become *stage
identifiers inside* `EVIDENCE`/`UNDERSTANDING`/`BUILD` — they are pipeline steps, not job states,
and conflating the two is CP2.

| # | State | Owner | Input | Output | Validator | Retry | On failure | Next | Cost policy | Terminates when |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `CREATED` | Hermes | brief | ledger | brief non-empty, budget granted | — | `ABORTED` | `EVIDENCE` | €0 | budget granted |
| 2 | `EVIDENCE` | Runner | brief/URL | profile | structural key check `[V: ARTIFACT_KEYS]` + evidence-sufficiency score | 2× transient | thin → `ESCALATED(thin-evidence)` | `UNDERSTANDING` | €0 (browser only) | profile written |
| 3 | `UNDERSTANDING` | Runner | profile | strategy + content | schema + grounding check `[V: groundingWarnings]` | 3× via router | → deterministic floor (`composeBaseline`) `[V]` | `PLAN` | ≤ 2 model calls, cheap tier first | content written |
| 4 | `PLAN` | Runner | profile+content | NarrativePlan | coherence `[V: narrativeCoherence]` | — (deterministic) | `ABORTED` (a bug, not a failure) | `DIVERGE` | **€0** | plan derived once `[V]` |
| 5 | `DIVERGE` | Runner | plan + memory | K directive candidates + **fingerprints, pre-generation** | diversity gate (§H) | — | K=1 → proceed | `CANDIDATE_BUILD` | **€0 — deterministic perturbation** | K survivors chosen |
| 6 | `CANDIDATE_BUILD` | Runner | directive_i | candidate_i (site + design) | render warnings, asset resolution `[V]` | 1× | mark candidate failed; others continue | `VERIFY` | cheap tier; frontier only on §H triggers | all candidates built or failed |
| 7 | `VERIFY` | Runner | candidate_i | technical verdict | **deterministic only**: functional, a11y, perf, security, responsive | 1× | candidate disqualified | `JUDGE` | **€0** | every candidate verified |
| 8 | `JUDGE` | Runner | verified candidates | quality + distinctness verdicts | §I thresholds; `uncertain` blocks | 1× per judge | `uncertain` → treat as blocking, not neutral | `DECIDE` | k=1 default, k=2 on margin | verdicts recorded |
| 9 | `DECIDE` | **Hermes** | verdicts + ledger + budget | one of six stop conditions (§U) | — | — | — | see §U | €0 | a stop condition fires |
| 10 | `DELIVERED` | Hermes | best candidate | published site + provenance | delivery checks re-run on the **exact** artifact | — | → `ESCALATED` | terminal | €0 | published |
| 11 | `ESCALATED` | Hermes | best candidate + brief | human brief | brief non-empty, candidate attached | — | — | terminal (or resumes on `HumanResponded`) | €0 | human responds or job closed |
| 12 | `ABORTED` | Hermes | reason | failure record | — | — | — | terminal | €0 | budget exhausted / unrecoverable |

**Reconcept is a transition, not a state** — `DECIDE → DIVERGE` with `reconcept += 1`. This is what
makes best-so-far natural: each pass through `DIVERGE` appends candidates and never mutates
earlier ones.

**Three counters, not one.** `retry` (same inputs, transient), `rebuild` (same concept,
re-execute), `reconcept` (new concept) have different costs and different ceilings. Today there is
one `iteration` `[V]`, which is why a provider 503 and a bad creative concept consume the same
budget.

---

## F. EXECUTION MODEL

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ n8n  — trigger · human inbox · visualisation · scheduled batch                │  §Q
│        (owns NO decision, NO sequencing, NO retry)                            │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ POST /job {brief}
┌───────────────────────────────▼──────────────────────────────────────────────┐
│ BusinessForge (the process)                                                   │
│                                                                               │
│  ┌────────────────────┐        ┌──────────────────────────────────────────┐  │
│  │ HERMES             │◄──────►│ JOB LEDGER (single writer: Hermes)       │  │
│  │ control plane      │ events │ state · attempts · budget · candidates   │  │
│  │ admission·budget·  │        │ verdicts · best · failures               │  │
│  │ transitions·stop   │        └──────────────────────────────────────────┘  │
│  └─────────┬──────────┘                                                       │
│            │ AdmitStage(lease)                                                │
│  ┌─────────▼──────────────────────────────────────────────────────────────┐  │
│  │ RUNNER — concurrency, scheduling, stage execution                       │  │
│  │  owns: worker counts, backpressure, candidate isolation                 │  │
│  └───┬─────────────────┬──────────────────┬──────────────────┬────────────┘  │
│      │                 │                  │                  │               │
│  ┌───▼──────┐   ┌──────▼───────┐   ┌──────▼──────┐   ┌───────▼───────────┐   │
│  │ AGENTS   │   │ BROWSER POOL │   │ QA (det.)   │   │ GATES             │   │
│  │ typed,   │   │ Playwright   │   │ func·a11y·  │   │ quality ·         │   │
│  │ isolated │   │ N contexts   │   │ perf·sec    │   │ distinctness      │   │
│  └───┬──────┘   └──────────────┘   └─────────────┘   └───────────────────┘   │
│      │ requests a CAPABILITY, never a vendor                                  │
│  ┌───▼──────────────────────────────────────────────────────────────────┐    │
│  │ CAPABILITY ROUTER — filter(licence·jurisdiction·credential·lease)    │    │
│  │                     rank(observed availability·latency·cost·quality) │    │
│  │                     retry · CROSS-PROVIDER FAILOVER (new) · governor  │    │
│  └───┬──────────────────────────────────────────────────────────────────┘    │
│  ┌───▼──────────────────────────────────────────────────────────────────┐    │
│  │ PROVIDER POOL — ranked implementations per capability                 │    │
│  └───┬──────────────────────────────────────────────────────────────────┘    │
│  ┌───▼──────────────────────────────────────────────────────────────────┐    │
│  │ TERMINAL DETERMINISTIC FALLBACK — always in-repo, always €0           │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Router ≠ Agent Pool, restated as required:** the Router solves **substitution** (this vendor is
down, expensive, or unlicensed → use another). The Agent Pool solves **concurrency** (many jobs of
one role at once). Different failure semantics, different sizing inputs, different configuration.

---

## G. AGENT MODEL

### Agent types

| Type | Deterministic? | Writes | Model tier |
|---|---|---|---|
| `EvidenceAgent` (discovery, collect, normalize) | yes | profile | none `[V]` |
| `StrategyAgent` (analyst) | no | strategy | cheap → medium |
| `WriterAgent` | no | content | medium → frontier |
| `ConceptAgent` (was: Creative Director) | no | directive concept fields | cheap → frontier on escalation |
| `PlanAgent` (experience, conversion, interaction, assets, layout) | **yes** | plan | **none** `[V — this is already deterministic and stays so]` |
| `BuildAgent` | yes | site | none |
| `JudgeAgent` | no | verdict only | cheap vision |
| `ArchitectAgent` (feasibility) | **yes** | capability plan | **none** |

### Contract

```
Agent<I, O> {
  name
  requires: CapabilityId[]        // validated at startup; dangling → hard fail [V: MCP_SERVERS precedent]
  run(input: I, ctx: AgentContext): Promise<O>
}
```

Unchanged from today's `Agent<I,O>` `[V: lib/types.ts]`, plus `requires`. **No `agent-registry.json`
— agents are TypeScript; generate a manifest if a dashboard needs one.**

### Isolation

- One candidate = one directory, `candidates/<id>/`, **write-once**.
- An agent may read the job's artifacts and write **only its own** output path.
- No agent writes `job.json`. Only Hermes does. (Today four call sites write it `[V]`.)

### Permissions

| Permission | Who |
|---|---|
| write customer-facing bytes | **deterministic renderer only** — `modelMayWriteOutput: false` globally (C1) |
| spawn a process | **nobody on the autonomous plane** (C1) |
| read credentials | the Router, never an agent |
| network | the Router (models) and the Browser pool (pages) |

### Parallelism and max concurrency

| Pool | Default k | Max | Bound by |
|---|---|---|---|
| Evidence | 1 | 1 | one browser session per job `[V]` |
| Concept (candidates) | **K=3** | 5 | vendor RPM ÷ jobs in flight |
| Build | K (one per candidate) | 5 | CPU |
| Browser | 2 (desktop+mobile) × K | 6 | **CPU — saturates before model quota** |
| QA deterministic | 4 in parallel | 4 | free |
| Judge | **1**, 2 on margin | 2 | see §H |
| Architect / Plan | 1 | 1 | deterministic, free |

### Do we need multiple agents of the same type?

**Only three justifications, and "thoroughness" is not one:**

1. **Divergence** — K concept agents produce K *different* candidates. This is the one place where
   parallelism *is* the product.
2. **Gating judgment under uncertainty** — a second judge, only when the first lands within the
   margin.
3. **Throughput across jobs** — many jobs, one role.

**Never** run two agents of one type on one deterministic task, and never run a second judge on a
verdict that is not close. Today's proposal to run four cabinet seats on the same model with the
same brief is one agent answering four questions in four calls — strictly worse than one call with
four fields.

---

## H. DESIGN BATTLE V2

**Premise rejected: five frontier agents are not required, and generating candidates before
filtering them is the expensive mistake.**

```
   PLAN (deterministic, €0)
     │
     ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 1. CHEAP DIVERGENCE — €0, NO MODEL                                  │
 │    enumerate M deterministic directive perturbations (M ≈ 8–12)     │
 │    compute each one's STRUCTURAL FINGERPRINT FROM THE DIRECTIVE     │
 │    (composeDesign is deterministic — no build, no model needed)     │
 └───────────────┬─────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 2. DIVERSITY GATE — €0, BEFORE ANY SPEND                            │
 │    drop candidates too close to Design Memory (scoped, §J)          │
 │    drop candidates too close to each other                          │
 │    drop candidates violating narrativeCoherence [V]                 │
 │    → K survivors, K = min(3, budget ÷ candidate_cost)               │
 └───────────────┬─────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 3. INDEPENDENT GENERATION — K × ONE cheap model call                │
 │    one ConceptAgent per candidate, authoring ONLY the concept       │
 │    fields; every other decision stays deterministic                 │
 │    INDEPENDENCE BY INPUT VIEW: candidate A sees the image           │
 │    inventory, B the business's own words, C the structured facts    │
 └───────────────┬─────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 4. BUILD + VERIFY — €0 (deterministic render + deterministic QA)    │
 │    a candidate failing technical verification is disqualified here, │
 │    before any judge is paid                                         │
 └───────────────┬─────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 5. JURY — k=1 BY DEFAULT                                            │
 │    judge_1 = deterministic quality score (€0, always)               │
 │    judge_2 = ONE vision call, only if the deterministic spread      │
 │              between top candidates < margin (they are too close    │
 │              to separate for free)                                  │
 │    judge_3 = a second vendor, ONLY on a tie after judge_2           │
 └───────────────┬─────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 6. FRONTIER ESCALATION — conditional, never scheduled               │
 │    trigger A: every candidate fails the quality floor               │
 │    trigger B: the jury cannot separate the top two after judge_3    │
 │    trigger C: the job is flagged high-value by the operator         │
 │    action: ONE frontier ConceptAgent, given the failure reasons     │
 │            and the rejected concepts, producing candidate K+1       │
 └───────────────┬─────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 7. ADVERSARIAL CRITIQUE — winner only, and only when the winner     │
 │    is within margin of the quality floor. One objection, mapped to  │
 │    a closed-set change, one revision, then stop.                    │
 └─────────────────────────────────────────────────────────────────────┘
```

**Cost, honestly accounted** (correcting `[SELF]` the "elimination is free" error — here it
genuinely is free, because elimination precedes generation):

| Step | Cost |
|---|---|
| 1 Divergence (M≈10) | **€0** |
| 2 Diversity gate | **€0** |
| 3 Generation, K=3 cheap concept calls | ~€0.006 |
| 4 Build + verify | **€0** |
| 5 Jury, common case (deterministic separates them) | **€0** |
| 5 Jury, close case (+1 vision) | ~€0.01 |
| 6 Frontier escalation (~20% of jobs) | ~€0.115 × 0.2 = ~€0.023 |
| 7 Adversarial (~15% of jobs) | ~€0.02 × 0.15 = ~€0.003 |
| **Expected total** | **~€0.03–0.05 per delivered site** |

Against V1's five-seat design at ~€0.58 and the naive design at ~€1.73. **The saving comes from
ordering, not from cheaper models.**

---

## I. QUALITY SYSTEM

### Nine dimensions, three classes, and a rule about how they combine

| Dimension | Class | Measured by | Threshold | Failure route |
|---|---|---|---|---|
| **TECHNICAL** | deterministic, blocking | page loads, no console errors, no failed requests, links resolve, images decode `[V]` | **hard pass/fail** | `REBUILD` |
| **ACCESSIBILITY** | deterministic, blocking | axe-core + keyboard sweep + rendered-page contrast on the world-repainted ground | **hard pass/fail** | `REBUILD` |
| **PERFORMANCE** | deterministic, budgeted | page weight, LCP/CLS proxies, DOM ceiling, frame time when runtime is on | budget, degradable | `REBUILD` or deliver-with-caveat |
| **SECURITY** | deterministic, blocking | no inline handlers, no `javascript:`, no mixed content, `noopener`, no third-party scripts `[V]` | **hard pass/fail** | `REBUILD` |
| **RESPONSIVENESS** | deterministic, blocking | 390/768/1440, zero horizontal overflow `[V]` | **hard pass/fail** | `REBUILD` |
| **UX** | deterministic, blocking | nav proven **by clicking it**, primary CTA resolves, contact reachable `[V]` | **hard pass/fail** | `REBUILD` |
| **BRAND FIT** | deterministic | design decisions consistent with `BusinessCharacter` `[V: scoreExperience businessSpecificity]` | score | `RECONCEPT` |
| **QUALITY** | mixed | deterministic craft score + (conditionally) one vision judge | score ≥ floor | `RECONCEPT` |
| **DISTINCTNESS** | mixed | fingerprint distance to scoped memory (§J) | score ≥ floor | `RECONCEPT` **only if the cell is not exhausted** |

### The combination rule — lexicographic, never weighted

```
1. All BLOCKING dimensions must pass.        (no trade-off exists)
2. Among survivors, maximise QUALITY.
3. Break ties on DISTINCTNESS.
4. DISTINCTNESS may never select a candidate whose QUALITY is below floor.
```

A weighted sum would let a strange candidate buy its way past a good one. That is the mechanism by
which "reward difference" becomes "reward weirdness", and the lexicographic rule removes it
structurally.

### Fixing CP7 — `uncertain` blocks

Today a design scoring ≥70 with vision disabled and no peer set returns **PASS with no visual
evidence at all** `[V]`. In V2:

```
quality.visualVerdict ∈ {distinct, generic, uncertain}
  distinct  → contributes to the score
  generic   → blocking failure
  uncertain → BLOCKS DELIVERY, routes to ESCALATE(no-visual-evidence)
```

Rationale: "we could not look at it" is not "it is fine". The €0 configuration therefore
**delivers only when the deterministic dimensions all pass AND a human accepted the
no-visual-evidence escalation** — which is the honest posture for a system with no vision budget.

### Proving BusinessForge beats the deterministic floor — the A/B (C3)

**This is Phase 0 and it has veto power.**

| Element | Specification |
|---|---|
| **Subjects** | 20 businesses already collected (`3-profile.json` exists), spanning ≥5 industries and both thin and rich evidence |
| **Arm A** | `--compose` — the deterministic floor, €0, already works `[V]` |
| **Arm B** | full V2 pipeline: divergence → K=3 → jury → best-so-far |
| **Blinding** | identical hosting, stripped provenance, randomised left/right, no branding |
| **Judges** | ≥7 humans, including ≥3 actual small-business owners. **Not a model.** A model judge cannot validate a model judge. |
| **Question** | *"Which of these would you rather have as your business's website?"* Forced choice, plus a one-line reason |
| **Secondary** | the same panel scores each on 3 axes (trust, clarity, would-I-call) |
| **Primary metric** | Arm B win rate, with a binomial CI |
| **Decision rule** | **B ≥ 65%** → build Phases 4–8 · **45–65%** → the cabinet is not paying for itself; ship the floor, spend the budget on evidence quality (OCR, Places, photo handling) instead · **B < 45%** → models are degrading a strong deterministic system; stop and investigate |
| **Cost** | ~€1 of model spend and one afternoon of human attention |
| **Side benefit** | the 20 human verdicts become the **calibration set** for the vision judge — the missing dataset that makes an automated judge trustworthy |

---

## J. DESIGN MEMORY

**The saturation problem, restated:** the structural fingerprint is a deterministic function of
`BusinessCharacter`, whose space is `3 × 3 × 4 × 3 × 3 = 324` cells `[V: character.ts]`. Local SMB
characters cluster heavily. A **global** structural repulsor therefore starts rejecting legitimate
designs after a few hundred sites — and much sooner within a popular cell.

### V2 memory: four scoping axes, three similarity layers, one exhaustion rule

**Scope — never global.** A candidate is compared only against records matching:

```
scope = industry ∧ geography(≤50km) ∧ recency(≤18 months)
```

Two bakeries in different cities never repel each other. This alone raises the effective ceiling by
orders of magnitude, because occupancy is per-cell-per-place-per-window rather than per-cell.

**Temporal decay.** `weight(age) = exp(-age_months / 12)`. A design from two years ago barely
repels. Rationale: the competitive harm of similarity decays with time and with the likelihood that
anyone ever sees both.

**Three similarity layers, with weights that shift as a cell fills:**

| Layer | Content | Cardinality | Weight when cell is empty | Weight when cell is full |
|---|---|---|---|---|
| **L1 structural** | the 9 axes `[V: genericityReport]` + pacing, transition, density | **discrete, small, saturating** | 0.50 | **0.15** |
| **L2 continuous** | palette (OKLCH), type-scale ratio, whitespace ratio, image-area ratio, largest-element scale | continuous, non-saturating | 0.35 | 0.40 |
| **L3 content** | embedding of concept + headline set + narrative arc | continuous, business-specific, effectively unbounded | 0.15 | **0.45** |

**The exhaustion rule — the honest part.** When a scope's occupancy exceeds the structural
capacity of that character cell:

```
if occupancy(scope) > structuralCapacity(cell):
    mark scope EXHAUSTED
    stop requiring structural distinctness       # it is arithmetically impossible
    require L2 + L3 distinctness only
    log it — an exhausted scope is a product signal, not an error
```

**Two businesses that genuinely are the same kind of business should receive the same *shape* of
page and different *content*.** That is the architecture's own doctrine — design is derived from
character `[V: ADR 0006]` — and a repulsor that denies it is fighting the system's best property.

**Privacy.** A record `{businessId, character, fingerprint, verdict, scope}` is **pseudonymous
personal data**, not anonymous `[SELF: V1 said "no PII", which was too glib]`. It therefore carries
a retention period (36 months), an erasure path keyed by `businessId`, and no free-text business
content.

---

## K. BEST-SO-FAR

**Requirement: it must be structurally impossible for a weaker reconcept to replace a stronger
result.** Not "the code checks" — impossible.

### Three mechanisms

**1. Immutability.** Every candidate is written once to `candidates/<candidateId>/` and never
modified. Reconcept **appends** a new candidate; it never overwrites. This alone fixes C4, where
`reconceptBuild` writes over `5b-design.json` `[V:259]`.

**2. An append-only ledger with a monotone promotion function.** The `best` pointer is not a field
anyone writes; it is *derived*:

```
best = argmax over candidates where ALL blocking dimensions pass, of:
         (quality_score, distinctness_score, -cost, -candidateIndex)      # lexicographic

promote(new):
    if new is not blocking-clean:      reject
    if quality(new) >  quality(best):  best = new
    if quality(new) == quality(best) and distinctness(new) > distinctness(best): best = new
    otherwise:                          best unchanged        # the ONLY outcome for a worse candidate
```

The function is monotone by construction: `quality(best)` never decreases across a job's life.

**3. Delivery and escalation both read `best`, never `latest`.** Hermes's `Deliver` and `Escalate`
commands take a `candidateId` which comes from the ledger. There is no code path that can hand a
human the last attempt. Today's escalation hands over exactly that `[V]`.

**Test that must exist before this is believed:** a property test asserting that for any sequence
of candidate promotions in any order, `quality(best)` is non-decreasing, and that the delivered
candidate equals `argmax` of the set.

---

## L. PROVIDER ROUTING

```
capability → filter → rank → select → execute → (fail) → next candidate → … → terminal fallback
```

**Filters (hard, in order — a filtered provider is *unreachable*, not merely disfavoured):**

1. credential present
2. **licence class** compatible with the job (commercial required for a paying job)
3. **jurisdiction** constraint satisfied
4. **capability declares `modelMayWriteOutput: false`** and this provider would write output → drop (C1)
5. lease covers the estimated cost
6. **rate-limit headroom** available for this vendor right now (CP4)
7. vendor not excluded by a cross-vendor constraint (e.g. concept ≠ adversarial)

**Ranking (soft, from *observed* telemetry, not from JSON):**

```
score = wA·availability(observed 24h)
      + wR·reliability(success rate, observed)
      + wL·latencyScore(p95, observed)
      + wC·costScore(from provenance, observed)
      + wQ·qualityPrior(static seed, decays as observations accumulate)
```

Weights are **per-capability**: prose is quality-dominant; enum selection is cost-dominant;
judging is availability-dominant.

**Cross-provider failover (CP6 — does not exist today).** Today `withRetry` retries the *same*
provider instance `[V]`. V2:

```
attempt provider_1 → retryable failure → retry provider_1 (jittered, existing) [V]
                   → exhausted or non-retryable → provider_2 (different vendor)
                   → … → terminal deterministic fallback
```

**Rate governor (CP4 — does not exist today).** A per-vendor token bucket, **scoped to the
organisation**, because Groq and Gemini both meter at organisation/project level — extra API keys
buy nothing. The governor is what makes multi-vendor a *throughput* strategy and not only a
redundancy one.

---

## M. COST CONTROL

### Four lease levels

| Level | Granted by | Ceiling | Exceeded → |
|---|---|---|---|
| **Per job** | operator/tier | e.g. €0.20 standard, €1.50 premium | `ABORT` or `ESCALATE(budget)` |
| **Per stage** | Hermes at `AdmitStage` | share of remaining job budget | stage fails → deterministic fallback |
| **Per agent invocation** | Runner from the stage lease | one call's estimate × 1.5 | call refused; floor used |
| **Per provider per day** | Router | operator-set | provider filtered out |

**No lease, no call.** A worker cannot self-authorise. This is the mechanism that turns cost from
an invoice into a failure mode.

### Escalation ladder — cheap → medium → frontier

| Tier | Used for | Escalate when |
|---|---|---|
| **€0 deterministic** | plan, layout, colour, order, content direction, all QA `[V]` | never escalates — it is the floor |
| **cheap** (Groq free / Flash-Lite / Luna) | enum selection, concept drafting, vision judging | default entry point |
| **medium** (Gemini Pro / GPT Terra / Sonnet) | writer prose; concept when cheap failed | cheap output failed a validator, or judges disagree |
| **frontier** (Opus / Sol) | concept on trigger A/B/C (§H); writer for premium jobs | **all cheap candidates failed the quality floor**, or the jury cannot separate the top two, or operator flagged high-value |

**Rule: escalation requires a recorded justification** — an ID of the failed validator, the tied
verdict, or the operator flag. An escalation with no cause is a bug, and the ledger makes it
visible.

---

## N. FAILURE RECOVERY

| Failure | Detection | Response | Ledger effect | Terminal? |
|---|---|---|---|---|
| **Provider down** | health probe / transport error | cross-provider failover (§L) | `FailureRecord`, no state change | no |
| **429** | status | jittered retry `[V]`, then next vendor; governor lowers that vendor's headroom | — | no |
| **Timeout** | wall clock `[V: 300s cfg]` | one retry at a lower effort, then next vendor, then floor | — | no |
| **Invalid output** | schema + semantic validator `[V: assertDirectiveShape]` | 1 retry with the validator's message appended; then **discard the directive and keep the deterministic floor** `[V: ADR 0004 rule]` | — | no |
| **Browser failure** | Playwright throws / blank capture | 1 retry with a fresh context; then candidate disqualified — **never delivered unverified** | candidate marked failed | no |
| **Vision failure** | provider error | verdict `uncertain` → **blocks delivery** (CP7 fix), routes to `ESCALATE(no-visual-evidence)` | verdict recorded | no |
| **Build failure** | render throws / write fails | `REBUILD` (≤2), then candidate disqualified | candidate failed | no |
| **Agent conflict** (two candidates claim the same asset/id) | ledger uniqueness check | candidate isolation makes this impossible by construction; if detected, `ABORT` — it is a bug | failure record | yes |
| **Jury tie** | verdict spread < ε after judge_3 | frontier escalation trigger B (§H); if budget refuses → deliver `best` by lexicographic tie-break (§K) | — | no |
| **Reconcept regression** | new candidate scores below `best` | **nothing is lost** — `best` is unchanged by construction (§K); `reconcept` counter increments | candidate appended | no |
| **Process crash** | absent heartbeat | resume from ledger (§P); completed stages are **not** re-run | `ProcessResumed` | no |
| **Machine restart** | same | same | same | no |

**One repository bug this table fixes:** today the reconcept catch block logs *"escalate rather
than spin"* but writes no `decision`, so the job returns with `decision: 'running'` while being
finished `[V:453-463]`. In V2, only Hermes writes `decision`, and it writes it exactly once, at a
terminal state.

---

## O. SECURITY / PII

| Area | V2 position |
|---|---|
| **Secrets** | `lib/config.ts` is the **only** `process.env` reader — including `VISION_*`, which bypasses it today `[V]`. Names, never values, in any log or artifact `[V: keep]`. Secret sweep over artifacts before delivery (the Places-key class of incident `[V]`). |
| **Filesystem** | `runId` **rejected**, not sanitised `[V: keep]`. Candidates write only within their own directory. No agent writes outside its declared path. |
| **Browser** | separate contexts per candidate; no shared cookie jar; no credential ever entered into a page. |
| **Generated code** | **none reaches a customer.** `modelMayWriteOutput: false` globally, enforced at the router. The C1 path leaves the autonomous plane. |
| **Prompt injection** | scraped text is **data, never instruction** — stated explicitly in every system prompt, and structurally contained by closed schemas with `additionalProperties: false` `[V]`. Detection is secondary; the schema is the control. |
| **PII** | screened at **`normalize`, before the first model call** — not at render, by which time the data has already reached a vendor (CP10). A typed `PIIBoundary` on `BusinessProfile` marks fields structurally unrenderable, following the writer-schema precedent `[V]`. |
| **Screenshots** | may contain PII visible on the page; treated as customer data, retained with the run, never sent to a provider that has not passed the licence/jurisdiction filter. |
| **External providers** | licence and jurisdiction are hard filters (§L). A provider that has not passed them cannot receive customer data, cheapness notwithstanding. |
| **Retention** | run artifacts 90 days (they contain full scrapes); Design Memory records 36 months, pseudonymous, erasable by `businessId`; ledgers 24 months. `output/` **is** gitignored `[V]` — confirmed, so scraped PII is not in git history. |
| **Permissions** | least privilege per agent (§G). Nothing on the autonomous plane may spawn a process. |

---

## P. CHECKPOINT / RESUME

**Today's resume is false** `[V]`: `runJob` opens with `createJob(...)` and immediately writes it
over the existing record, resetting `iteration` to 0. The n8n path *does* load the existing job —
so the two drivers disagree about the same run. That is CP2 and CP8 in one defect.

### V2 resume

1. **The ledger is never re-created.** `resume(jobId)` loads it or fails. A missing ledger is an
   error, not an invitation to start over.
2. **Stage outputs are content-addressed.** Each records `inputHash` (hash of its declared inputs)
   and `outputHash`. On resume, a stage whose `inputHash` matches the current inputs is **skipped
   and its output reused** — no rebuild, no re-scrape, no re-spend.
3. **Candidates are immutable** (§K), so resume never loses work and never re-judges a candidate
   that already has a verdict.
4. **Leases are re-validated, not re-issued.** Consumed budget stays consumed across a crash;
   otherwise a crash loop is a spend loop.
5. **In-flight work is idempotent or abandoned.** A stage interrupted mid-flight is re-run from its
   inputs (it produced no committed output). A committed output is never re-produced.
6. **One driver semantics.** `run-job` and the n8n path call the *same* resume routine. There is
   one behaviour, not two.

---

## Q. n8n

**Stays in n8n**

- webhook / schedule **trigger**
- **human approval inbox** — the destination for `ESCALATED`, where a person sees the brief,
  screenshots, and candidates and answers
- **visualisation** of job progress for a human watching
- **batch fan-out** across many jobs (many `POST /job`, not many stages)
- notifications

**Leaves n8n**

- the reconcept loop (the IF node routing back to Build `[V]`)
- stage sequencing
- retries
- any decision
- `maxIter` and every other policy value
- anything that reads or writes `job.json`

**Interface: one call.** n8n posts a brief and polls or receives a webhook. It never learns what a
stage is. Today it drives seven stages over HTTP and owns the loop branch `[V]` — that is the brain
living in a workflow tool, and it is exactly what condition 11 forbids.

**The in-process driver stays the reference implementation**, as it is today `[V: "If n8n is down,
scripts/run-job.ts runs the same loop"]` — with the difference that in V2 it is genuinely the same
loop, not a second one.

---

## R. OBSERVABILITY

One append-only record per state transition and per capability call:

```
{
  jobId, candidateId?, seq, ts,
  state{from,to}, reason,
  agent?, capability?, provider?, model?,
  inputHash, outputHash,                    // reproducibility + resume + cache
  cost{estimated, actual, leaseId},
  latency{queuedMs, execMs},
  decision?, gate?{name, verdict, score, evidence[]},
  attempt{retry, rebuild, reconcept},
  best{candidateId, quality, distinctness}, // after every promotion attempt
  providerFailure?{class, vendor, retryable, failedOverTo},
  terminalReason?                            // set once, at termination
}
```

Derived views that must exist because they answer the questions the series raised:

- **cost per delivered site**, by tier and by stage
- **escalation rate and cause distribution** — if frontier escalation fires on 80% of jobs, the
  cheap tier is mis-specified
- **judge agreement rate per pair** — the C2 experiment, running continuously; a pair above 90%
  loses a member
- **best-so-far improvement curve** — does reconcept ever actually improve anything? If the curve
  is flat, reconcept is theatre and should be cut to `maxReconcept = 0`
- **scope occupancy and exhaustion events** (§J)
- **provider failover events** — a fallback never exercised is a fallback that does not work

---

## S. IMPLEMENTATION ORDER

I have modified the proposed phases in three ways, each for a stated reason.

| Phase | Contents | Why here | Cost |
|---|---|---|---|
| **0 — Validation & free damage control** | (a) the floor-vs-cabinet **A/B** (§I); (b) **best-so-far** (§K); (c) **stop the C1 path** — remove `visual_defect_repair` from the autonomous plane; (d) exercise Groq + OpenRouter free against live keys | **Change:** best-so-far and the C1 fix move *into* Phase 0. Both are free, and both prevent ongoing damage while the A/B runs. There is no argument for deferring a fix that costs nothing and stops a worse result replacing a better one. | ~€1 + an afternoon |
| **1 — Control plane** | Hermes as authority; one state vocabulary (§E); one writer per fact (§C); `decision` written once; the reconcept-failure contradiction fixed | Everything downstream needs one authority. Doing routing or quality first means building on three state machines. | €0 |
| **2 — State, checkpoint, resume** | content-addressed stage outputs; real resume; immutable candidates; one driver semantics (§P) | Resume must exist before parallelism, or a crash mid-battle wastes K candidates. | €0 |
| **3 — Routing, cost, concurrency** | Capability Router; cross-provider failover; rate governor; budget leases; Runner concurrency (§L, §M) | Must precede the battle: the battle is what makes concurrency and spend real. | €0 to build |
| **4 — Quality system** | nine dimensions; lexicographic combination; `uncertain` blocks (CP7); axe-core, Lighthouse budgets, security assertions; judge calibration against the Phase-0 human set | **Gated by Phase 0.** If the A/B says tie-or-worse, this phase ships the deterministic dimensions only and stops. | €0 |
| **5 — Design Battle V2** | cheap divergence, pre-generation fingerprinting, diversity gate, conditional jury, conditional frontier escalation (§H) | **Gated by Phase 0.** | ~€0.03/site |
| **6 — Design Memory** | scoped, decaying, three-layer, exhaustion rule (§J) | After the battle, because memory only matters once multiple candidates and multiple sites exist. | €0 |
| **7 — Production n8n** | trigger + human inbox + visualisation only; loop removed (§Q) | Last, because n8n should be wired to a system that is already correct. | €0 |
| **8 — Advanced media / 3D / motion** | **Change: mostly deleted.** Native CSS scroll-driven animations and View Transitions cover most of it at zero cost and zero dependency. What remains: image *editing* of the business's own photographs, and vector marks. | Everything else in this phase failed the value test (§V). | conditional |

---

## T. FINAL ARCHITECTURE

```
                    BRIEF ──► n8n (trigger only) ──► POST /job
                                                        │
╔═══════════════════════════════════════════════════════▼══════════════════════════════════╗
║ BUSINESSFORGE                                                                             ║
║                                                                                           ║
║   ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║   │ HERMES — control plane (deterministic, no model)                                  │   ║
║   │ owns: state · transitions · budget leases · retries · delivery · escalation       │   ║
║   │ ┌──────────────────────────────────────────────────────────────────────────────┐ │   ║
║   │ │ JOB LEDGER (single writer)  state · attempts{retry,rebuild,reconcept} ·       │ │   ║
║   │ │ budget · candidates[] append-only · best (monotone) · verdicts · failures     │ │   ║
║   │ └──────────────────────────────────────────────────────────────────────────────┘ │   ║
║   └──────────┬───────────────────────────────────────────────────────────────────────┘   ║
║              │ AdmitStage(lease)                    ▲ events                              ║
║   ┌──────────▼───────────────────────────────────────┴──────────────────────────────┐    ║
║   │ RUNNER — concurrency · scheduling · candidate isolation                          │    ║
║   └──┬────────────────────────────────────────────────────────────────────────────┬─┘    ║
║      │                                                                            │      ║
║  ┌───▼────────────────────────────────────────────────────────────────┐   ┌───────▼───┐  ║
║  │ PIPELINE                                                            │   │ GATES     │  ║
║  │                                                                      │   │           │  ║
║  │  EVIDENCE ──► UNDERSTANDING ──► PLAN(det, €0) ──► DIVERGE(det, €0)   │   │ technical │  ║
║  │   browser        ≤2 cheap          derived once      M perturbations  │   │ a11y      │  ║
║  │   no model       model calls       [V]               + fingerprints   │   │ perf      │  ║
║  │                                                      BEFORE spend     │   │ security  │  ║
║  │                                          │                            │   │ responsive│  ║
║  │                                          ▼ diversity gate (€0)        │   │ ux        │  ║
║  │                                     K survivors (K≤3)                 │   │ ─────────  │  ║
║  │                                          │                            │   │ QUALITY   │  ║
║  │   CANDIDATE_BUILD ──► VERIFY(det, €0) ──► JUDGE                       │◄──┤ DISTINCT- │  ║
║  │   K × 1 cheap call    disqualify here    k=1 default                  │   │ NESS      │  ║
║  │   independent input   before paying      k=2 on margin                │   │ (separate │  ║
║  │   views (C2)          a judge            frontier on trigger          │   │  dims,    │  ║
║  │                                                                       │   │  lexico-  │  ║
║  └───────────────────────────────┬───────────────────────────────────────┘   │  graphic) │  ║
║                                  │ verdicts                                  └───────────┘  ║
║   ┌──────────────────────────────▼───────────────────────────────────────────────────┐    ║
║   │ HERMES · DECIDE ──► DELIVER │ RETRY │ REBUILD │ RECONCEPT │ ESCALATE │ ABORT      │    ║
║   │            always carries BEST, never LATEST                                      │    ║
║   └──────────────────────────────┬───────────────────────────────────────────────────┘    ║
║                                  │ RECONCEPT loops to DIVERGE (appends, never overwrites)  ║
║   ┌──────────────────────────────▼───────────────────────────────────────────────────┐    ║
║   │ CAPABILITY ROUTER   filter(licence·jurisdiction·credential·lease·rate·modelMayWrite)│  ║
║   │                     rank(observed availability·reliability·latency·cost·quality)   │  ║
║   │                     retry → CROSS-PROVIDER FAILOVER → terminal fallback            │  ║
║   └──────────────────────────────┬───────────────────────────────────────────────────┘    ║
║   ┌──────────────────────────────▼───────────────────────────────────────────────────┐    ║
║   │ PROVIDER POOL  cheap(Groq·Flash-Lite·Luna) → medium(Pro·Terra·Sonnet) → frontier  │    ║
║   └──────────────────────────────┬───────────────────────────────────────────────────┘    ║
║   ┌──────────────────────────────▼───────────────────────────────────────────────────┐    ║
║   │ TERMINAL DETERMINISTIC FALLBACK — composeBaseline: a complete site, always, €0 [V]│    ║
║   └──────────────────────────────────────────────────────────────────────────────────┘    ║
║                                                                                           ║
║   DESIGN MEMORY (scoped: industry ∧ geo ∧ 18mo · decaying · L1/L2/L3 · exhaustion rule)   ║
║   OBSERVABILITY (append-only: state · agent · model · hashes · cost · latency · verdicts) ║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝
                                  │                              │
                        ESCALATED ▼                     DELIVERED ▼
                     n8n human inbox                  static host (CF Pages)
```

---

## U. STOP CONDITIONS

Evaluated in this order. **Order is the design** — reordering changes behaviour.

```
ABORT      budget.remaining < minimumViableStage
        OR unrecoverable invariant violation (agent conflict, corrupt ledger)
        OR operator cancellation
        → terminal. No delivery. Ledger records the reason.

ESCALATE   evidence insufficient (thin profile — no amount of design fixes it) [V: keep]
        OR blocking dimension fails after rebuild ceiling
        OR quality.visualVerdict == 'uncertain'        (CP7: cannot vouch ≠ pass)
        OR reconcept ceiling reached without a blocking-clean candidate
        OR jury tie survives frontier escalation and budget refuses more
        OR a rights/PII/legal gate refuses
        → terminal-pending-human. ALWAYS carries `best`, plus screenshots,
          verdicts, rejected concepts, and the reason. Never the last attempt.

DELIVER    best != null
        AND all blocking dimensions pass on the EXACT delivered artifact (re-verified)
        AND quality >= floor
        AND (distinctness >= floor OR scope EXHAUSTED)     (§J)
        → terminal. Publish `best`.

RETRY      last failure was transient (429, 5xx, timeout, transport)
        AND retry < retryCeiling (default 2)
        AND lease permits
        → same stage, same inputs, possibly a different provider (§L). Cost: one call.

REBUILD    a blocking TECHNICAL dimension failed (build, render, browser, a11y,
           security, responsive, ux)
        AND rebuild < rebuildCeiling (default 2)
        → same concept, re-execute the build. NO new model spend on concept.
          This is the cheapest corrective loop and today it does not exist —
          today a build defect and a taste defect both trigger a full reconcept [V].

RECONCEPT  quality or brand-fit or distinctness below floor
        AND reconcept < reconceptCeiling (default 2)
        AND lease permits a new candidate set
        → DIVERGE, appending candidates. `best` is preserved by construction (§K).
```

**Three ceilings, not one** — `retry`, `rebuild`, `reconcept` — because a provider hiccup, a build
defect and a weak concept have different costs and different correct responses. Today one
`iteration` counter conflates all three `[V]`, which is why a 503 can consume the same budget as a
failed creative direction.

---

## V. WHAT WE SHOULD NOT BUILD

| Not building | Why |
|---|---|
| **A five-seat cabinet** | Four seats routed to one model with one brief is one agent answering four questions in four calls — worse than one call with four fields, and correlated anyway (C2). |
| **An always-on k=2 jury** | Two judges are only two opinions when they disagree. Measure agreement; pay for the second only when the first cannot separate the candidates. |
| **A global structural repulsor** | Arithmetically saturating (§J). It would begin rejecting correct designs after a few hundred sites and degrade the system as it succeeds. |
| **`agent-registry.json`** | Agents are behaviour. JSON holding prompts is untestable and unversioned; JSON pointing at code is redundant. Generate a manifest if a dashboard needs one. |
| **Autonomous coding agents anywhere near output** | C1. The invariant is the architecture's load-bearing claim; an invariant with a known exception is a convention. |
| **Sandboxing on the product path** | It exists to run untrusted code. Nothing on the autonomous plane emits code. Needing a sandbox would mean the invariant broke — fix the invariant. |
| **Video, 3D generation, TTS** | No consumer in the pipeline, no footage to work from, and a Core Web Vitals cost on a page whose visitor wants a phone number. |
| **A hosted vector database** | `sqlite-vec` plus a local ONNX embedding handles thousands of fingerprints in-process, with no service, no jurisdiction question, and no bill. |
| **A motion library, by default** | CSS scroll-driven animations run on the compositor thread with ~84% global support, and View Transitions are cross-browser. Add GSAP only when a named `transition` value provably cannot be expressed natively. |
| **Adaptive cost optimisation** | Making output quality a function of system load is unexplainable to a customer. The escalation ladder is deterministic and legible; keep it that way. |
| **External observability SaaS** | The repo already emits structured NDJSON and per-capability telemetry. Self-host or use what exists. |
| **A second specialised WebGL host** | One quarantined reference host is a proof. A second is a product decision no business has yet earned. |
| **More parallelism than the constraint allows** | The browser pool saturates before the model pool on a developer machine. Parallelism beyond that is queueing with extra steps. |

---

## Closing principle

**The measure of V2 is not how much it can do. It is how cheaply it can find out whether doing
more helps.**

Phase 0 answers that question for ~€1 and one afternoon. Every phase after it is contingent on the
answer, and the architecture is deliberately shaped so that a disappointing result is inexpensive
to act on: the deterministic floor is not a fallback bolted underneath the system — **it is the
system**, and everything above it is an escalation that must justify itself.

---

_End. Nothing implemented. The repository, the n8n workflow, and the dependency tree are exactly as
they were found._
