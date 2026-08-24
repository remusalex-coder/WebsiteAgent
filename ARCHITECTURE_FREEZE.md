# BusinessForge — Architecture Freeze & Implementation Backlog

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` / `ARCHITECTURE_FREEZE.md` design corpus. Several proposals
> here (notably F-02/F-03) were later reversed during real implementation. Treat as
> design-input history, not current status. Current status: `docs/MASTER_INVENTORY.json`
> (machine-readable) and `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical).

_Produced 2026-08-14. **Nothing implemented. No source file, configuration, n8n workflow, test,
snapshot, or dependency modified, installed, or removed.** This document is a plan._

Freezes [BUSINESSFORGE_2.0_ARCHITECTURE_V2.md](BUSINESSFORGE_2.0_ARCHITECTURE_V2.md) against the
repository as it stands on branch `design-district-smoke` (21 modified tracked files predating this
work, 5 architecture documents untracked).

**Marks:** `[V]` verified in code this pass · `[?]` open.

---

## 0. What "freeze" means here

**Frozen** = decided. Do not re-open in an implementation session. If an implementer disagrees,
they raise it as a change request against this document; they do not quietly build something else.

**Not frozen** = deliberately open, listed in §1.3, to be settled by evidence (mostly Phase 0) or
by a founder decision.

**The freeze does not authorise implementation.** It defines what implementation would consist of,
in what order, with what acceptance criteria.

---

## 1. FROZEN DECISIONS REGISTER

### 1.1 Architectural decisions — frozen

| # | Decision | Consequence in code |
|---|---|---|
| **F-01** | The deterministic floor is the system; models are a bounded escalation above it | `composeBaseline` + `composeDesign` + `renderSite` stay the primary path `[V]` |
| **F-02** | Hermes is the control plane: sole owner of state, transitions, budget, retries, delivery, escalation | 20 `saveJob` call sites `[V]` collapse to event emissions; only Hermes writes the ledger |
| **F-03** | One state vocabulary. The three that exist today are replaced | `main.ts` STAGES (9), `JobStage` (16), `scripts/n8n/stage.ts` STAGES (7) `[V]` → one 12-state machine |
| **F-04** | Three counters — `retry`, `rebuild`, `reconcept` — never one `iteration` | new field set on the ledger; `hermes.decide` reads all three |
| **F-05** | Best-so-far is derived, monotone, and impossible to violate | candidates immutable; `best` computed, never assigned |
| **F-06** | Quality and distinctness are separate dimensions combined **lexicographically** | gate returns two verdicts; no weighted sum anywhere |
| **F-07** | `visualVerdict: 'uncertain'` blocks delivery | `gateJob` currently returns PASS with zero visual evidence `[V]` — that path closes |
| **F-08** | No model-authored byte reaches a customer artifact | `patchWithClaude` leaves the autonomous plane `[V: scripts/visual-qa.ts:156-208]` |
| **F-09** | Divergence is filtered **before** generation, using fingerprints computed from the directive | `composeDesign` is deterministic, so this is free |
| **F-10** | Judges: k=1 default; k=2 only on margin; independence engineered by **input view**, not vendor | |
| **F-11** | Design Memory is scoped (industry ∧ geo ∧ 18 months), decaying, three-layer, with an exhaustion rule | never a global structural repulsor |
| **F-12** | Capability Router ≠ Agent Pool. Router = substitution; Pool = concurrency | separate modules, separate config |
| **F-13** | Cross-provider failover exists | today `withRetry` retries the same provider instance `[V]` |
| **F-14** | `lib/config.ts` is the only `process.env` reader, including `VISION_*` | three scripts violate this today `[V]` |
| **F-15** | n8n owns trigger, human inbox, visualisation. Nothing else | the loop leaves the workflow JSON |
| **F-16** | No `agent-registry.json`. Agents stay TypeScript | a manifest may be generated |
| **F-17** | Artifact **names** at run root are a public interface | `3-profile.json`, `5-content.json`, `5b-design.json` keep their names and semantics — 10+ readers across `scripts/` depend on them `[V]` |
| **F-18** | Sandboxing, video/3D generation, TTS, autonomous coding agents on the product path: not built | — |

### 1.2 Frozen numeric defaults

| Parameter | Value | Changeable by |
|---|---|---|
| `K` candidates | 3 (min 1, max 5) | operator config |
| `M` divergence perturbations | 10 | constant |
| `retryCeiling` | 2 | operator |
| `rebuildCeiling` | 2 | operator |
| `reconceptCeiling` | 2 | operator |
| quality floor | 70 `[V: PASS_THRESHOLD]` | **frozen until Phase 0 recalibrates it** |
| jury margin (triggers k=2) | ±5 points | tuning |
| memory scope | industry ∧ ≤50 km ∧ ≤18 months | tuning |
| job budget, standard tier | €0.20 | operator |

### 1.3 Explicitly NOT frozen — open questions

| # | Open | Settled by |
|---|---|---|
| **O-1** | Whether the model-augmented path beats the deterministic floor at all | **Phase 0 A/B** — has veto power over P4–P8 |
| **O-2** | Data jurisdiction: may customer evidence reach CN-hosted providers? | founder decision |
| **O-3** | Free-tier commercial-use terms (Gemini free, OpenRouter `:free`, open weights) | legal check |
| **O-4** | Places API review storage/display licence | legal check |
| **O-5** | Vendored font licences — the platform redistributes binaries in every delivered site `[V]` | legal check |
| **O-6** | Rights to redistribute the business's own Facebook/Instagram photographs | founder + legal |
| **O-7** | Whether reconcept ever improves anything (best-so-far curve) | measurable after P0-2 |

---

## 2. COMPONENT INVENTORY

### 2.1 CREATE — new modules

| ID | Path | Purpose | Phase |
|---|---|---|---|
| N-01 | `lib/workflow/state.ts` | the one state vocabulary + legal transitions | P1 |
| N-02 | `lib/workflow/ledger.ts` | job ledger; **sole** writer of state/decision/budget | P1 |
| N-03 | `lib/workflow/candidates.ts` | immutable candidate store + monotone `best` | **P0** |
| N-04 | `lib/workflow/hermes.ts` *(rewrite of the existing file)* | control plane: admission, transitions, stop conditions | P1 |
| N-05 | `lib/workflow/runner.ts` | concurrency, scheduling, candidate isolation | P3 |
| N-06 | `lib/workflow/resume.ts` | one resume routine for both drivers | P2 |
| N-07 | `lib/cost/lease.ts` | budget leases at 4 levels | P3 |
| N-08 | `lib/cost/ledgerEntry.ts` | cost accounting from provenance | P3 |
| N-09 | `lib/ai/router.ts` | Capability Router: filter → rank → select → failover | P3 |
| N-10 | `lib/ai/governor.ts` | per-vendor, org-scoped rate governor | P3 |
| N-11 | `lib/qa/gates/technical.ts` | functional + security gate (promoted from `publish-run.ts`) | P4 |
| N-12 | `lib/qa/gates/accessibility.ts` | axe-core + keyboard + rendered contrast | P4 |
| N-13 | `lib/qa/gates/performance.ts` | budgets that fail | P4 |
| N-14 | `lib/qa/visual-regression.ts` | odiff/pixelmatch candidate diffing | P4 |
| N-15 | `lib/qa/verdict.ts` | lexicographic combination of the nine dimensions | P4 |
| N-16 | `lib/design/fingerprint.ts` | L1/L2/L3 fingerprint; **L1 computable from a directive** | P5 |
| N-17 | `lib/design/diverge.ts` | M perturbations + diversity gate, pre-generation | P5 |
| N-18 | `lib/memory/designMemory.ts` | scoped, decaying, exhaustion rule | P6 |
| N-19 | `lib/sources/piiScreen.ts` | PII screening at normalize, pre-model | P4 |
| N-20 | `scripts/ab-floor-vs-director.ts` | Phase 0 A/B harness | **P0** |
| N-21 | `lib/browser/capture.ts` | the one screenshot implementation | P4 |

### 2.2 MODIFY — existing files

| ID | Path | Change | Phase | Risk |
|---|---|---|---|---|
| M-01 | `lib/workflow/runJob.ts` | 10 `saveJob` calls `[V]` → events; stop `createJob` on entry (CP8); use candidate store; fix the missing `decision` on reconcept failure `[V:453-463]` | P0/P1/P2 | **high — the loop** |
| M-02 | `scripts/n8n/stage.ts` | 8 `saveJob` calls `[V]` → events; share the resume routine | P1/P2 | high |
| M-03 | `lib/workflow/jobState.ts` | becomes storage only; `saveJob` no longer exported to callers | P1 | medium |
| M-04 | `lib/qa/distinctness-gate.ts` | split verdicts; `uncertain` blocks; route becomes advisory | P4 | medium |
| M-05 | `lib/ai/factory.ts` | expose provider iteration for failover; keep `withRetry` | P3 | medium |
| M-06 | `lib/config.ts` | add `vision` + `budget` + `router` config blocks | P3 | low |
| M-07 | `scripts/visual-qa.ts` | `patchWithClaude` gated behind an explicit human-only flag; unreachable from `lib/` | **P0** | low |
| M-08 | `main.ts` | `composeStandalone` writes to a candidate dir; run-root names preserved as pointers (F-17) | P2 | **high — 10+ readers** |
| M-09 | `lib/design/compose.ts` | **additive only**: expose the directive→fingerprint path | P5 | medium |
| M-10 | `n8n/businessforge-workflow.json` + `scripts/n8n/build-workflow-json.ts` | loop removed; trigger + inbox only | P7 | low |
| M-11 | `agents/normalizerAgent.ts` | call PII screen before the profile is written | P4 | medium |
| M-12 | `package.json` | new scripts (`ab`, `gates`, `resume`); new devDeps for axe/odiff | P0/P4 | low |

### 2.3 DELETE / RETIRE

| ID | What | Why |
|---|---|---|
| D-01 | `patchWithClaude` from any autonomous path `[V: scripts/visual-qa.ts]` | F-08 |
| D-02 | The `Reconcept?` IF-loop in the n8n workflow `[V]` | F-15 |
| D-03 | `JobStage`'s 16 values, `stage.ts`'s 7 | F-03 |
| D-04 | `iteration` as a single counter | F-04 |
| D-05 | `gateJob`'s `route` **as a decision** (kept as advisory diagnosis) | F-02 |

### 2.4 FREEZE — do not touch (§8 expands)

`lib/design/**` (except M-09, additive) · `lib/content/**` · `lib/render/**` · `lib/art/**` ·
`lib/sources/merge.ts`, `authority.ts` · `agents/writerAgent.ts` grounding · `test/__snapshots__/**`.

---

## 3. DEPENDENCIES

```
P0-3 (C1 guard) ──┐
P0-4 (provider probe) ─┐        all four P0 tasks are independent of each other
P0-1 (A/B harness) ────┤
P0-2 (candidates) ─────┴──► N-03 is a dependency of M-01, P2-3, P5-*

        ┌──────────────── P0 complete (A/B verdict recorded) ────────────────┐
        │                                                                     │
        ▼                                                                     │
P1-1 (N-01 state) ──► P1-2 (N-02 ledger + N-04 Hermes) ──► P1-3 (counters)   │
        │                        │                                            │
        │                        ▼                                            │
        │              P2-1 (no re-create) ──► P2-2 (hashes) ──► P2-4 (resume)│
        │                        │                    │                       │
        │                        ▼                    ▼                       │
        └────────────► P2-3 (immutable candidates, needs N-03)                │
                                 │                                            │
                                 ▼                                            │
        P3-6 (config) ──► P3-1 (router) ──► P3-2 (failover)                  │
                    P3-3 (governor) ──┤                                       │
                    P3-4 (leases) ────┴──► P3-5 (runner concurrency)          │
                                 │                                            │
                                 ▼                                            │
                    ┌──── P4 (quality) ◄─────────────── gated by A/B ─────────┘
                    │      P4-1 uncertain-blocks   (needs M-04)
                    │      P4-2 lexicographic      (needs N-15)
                    │      P4-3 axe · P4-4 perf · P4-5 functional/security  ← mutually independent
                    │      P4-6 visual regression · P4-7 PII
                    ▼
              P5 (battle: needs router + leases + candidates + fingerprint)
                    ▼
              P6 (memory: needs fingerprint + delivered corpus)
                    ▼
              P7 (n8n) ── independent of P5/P6, may run any time after P1
                    ▼
              P8 (media) — optional, gated
```

**Three hard sequencing rules:**

1. **P0-2 before any reconcept work.** Until the candidate store exists, every reconcept destroys
   a possibly-better result `[V]`.
2. **P1 before P2 before P3.** Resume on three state vocabularies is meaningless; concurrency
   without resume turns a crash into K wasted candidates.
3. **P0-1 before P4–P8.** The A/B decides whether they are built at all.

---

## 4. IMPLEMENTATION ORDER

| Wave | Phase | Gate to enter | Gate to exit |
|---|---|---|---|
| **W0** | P0 | none — start here | A/B verdict recorded; candidate store live; C1 path closed |
| **W1** | P1 | W0 exit | one state vocabulary; only Hermes writes the ledger |
| **W2** | P2 | W1 exit | a killed job resumes without re-running a completed stage |
| **W3** | P3 | W2 exit | a provider outage fails over; a job cannot exceed its budget |
| **W4** | P4 | W3 exit **AND** A/B ≥45% | all nine dimensions gate; `uncertain` blocks |
| **W5** | P5 | W4 exit **AND** A/B ≥65% | K candidates diverge pre-spend; jury conditional |
| **W6** | P6 | W5 exit | memory scoped; exhaustion handled |
| **W7** | P7 | W1 exit (may run in parallel from W2 onward) | n8n holds no decision |
| **W8** | P8 | W6 exit; optional forever | — |

---

## 5. TASK BACKLOG

Priority: **MUST** (freeze is not satisfied without it) · **SHOULD** (freeze intent, deferrable
one wave) · **OPTIONAL** (build only on evidence).

### PHASE 0 — Validation & free damage control

#### P0-1 · A/B: deterministic floor vs model-augmented path · **MUST**

**Resolves the circularity in V2 §I:** the A/B cannot wait for a cabinet that does not exist. Arm B
is the **existing** director-enabled path — `DIRECTOR_ENABLED=true` + `composeDesign(…, directive)`
`[V: main.ts stage 5a, agents/designAgent.ts]`. If a single frontier director cannot beat the
floor, a five-seat cabinet will not either. This is testable today with **zero new production
code**.

- **Files:** N-20 `scripts/ab-floor-vs-director.ts` (new); M-12 `package.json` (`"ab"` script).
- **Touches production code:** none.
- **Acceptance:**
  - Builds 20 existing runs twice — arm A `--compose`, arm B director-enabled — into
    `ab/<runId>/{a,b}/`.
  - Output is order-randomised per run, provenance stripped, identically hosted.
  - Emits `ab/manifest.json` mapping randomised label → arm, **not readable by a judge**.
  - Emits a scoring sheet; records ≥7 human verdicts including ≥3 small-business owners.
  - Produces `ab/result.json`: win rate + binomial CI + per-industry breakdown.
- **Tests:** unit test that the manifest is not derivable from the served artifacts (no arm
  identifier in HTML, CSS, filenames, or file order).
- **Decision rule (frozen):** ≥65% → build P4–P8 · 45–65% → ship the floor, redirect budget to
  evidence quality · <45% → stop; investigate model-induced degradation.
- **Parallel-safe:** yes, fully isolated.

#### P0-2 · Candidate store + monotone best-so-far · **MUST**

- **Files:** N-03 `lib/workflow/candidates.ts` (new); M-01 `lib/workflow/runJob.ts`.
- **Design:** `candidates/<candidateId>/` write-once; append-only index; `best` **derived** by the
  lexicographic function in V2 §K, never assigned.
- **Acceptance:**
  - `reconceptBuild` no longer overwrites `5b-design.json` `[V:259]`; it writes a new candidate dir.
  - Run-root `5b-design.json` becomes a **copy of `best`**, refreshed only on promotion (preserves
    F-17 and every existing reader `[V: 10+ readers]`).
  - Escalation and delivery both carry `best`.
- **Tests:**
  - **Property test:** for any permutation of promotion attempts, `quality(best)` is non-decreasing
    and the delivered candidate equals `argmax`.
  - Regression: a 3-iteration run where scores are 68 → 55 → 51 escalates carrying the **68**.
  - Existing `test/qa/visual-qa.test.ts` and the snapshot suite must remain green.
- **Parallel-safe:** yes.

#### P0-3 · Close the C1 path · **MUST**

- **Files:** M-07 `scripts/visual-qa.ts`.
- **Acceptance:**
  - `patchWithClaude` requires an explicit interactive opt-in that no automated caller can set
    (not an env var that a stage server could inherit).
  - No module under `lib/**` imports it, transitively.
  - The run banner states plainly that autofix edits delivered bytes with a model.
- **Tests:** static test asserting (a) `lib/**` contains no `child_process` spawn of an external
  agent, (b) no import path from `lib/workflow/**` or `scripts/n8n/**` reaches `patchWithClaude`.
- **Parallel-safe:** yes.

#### P0-4 · Fix the reconcept-failure decision contradiction · **MUST**

`[V: runJob.ts:453-463]` — the comment says *"escalate rather than spin"*; the patch writes no
`decision`, so the job returns `decision: 'running'` while terminated.

- **Files:** M-01.
- **Acceptance:** a reconcept build failure terminates with `decision: 'escalate'` and a failure
  record naming the cause.
- **Tests:** unit — force `reconceptBuild` to throw; assert the returned job is terminal.
- **Parallel-safe:** yes (3-line change, but it touches M-01 — sequence with P0-2 or accept a
  trivial merge).

#### P0-5 · Live-probe the fallback providers · **SHOULD**

- **Files:** new `scripts/probe-providers.ts`.
- **Acceptance:** one real call to Gemini free, Groq free, and an OpenRouter `:free` model;
  records model id served, latency, and observed rate-limit headers into `probes/`.
- **Why:** the repo's own doctrine — an adapter that has never made a live call is untested `[V:
  docs/architecture.md]`. A fallback never exercised is not a fallback.
- **Parallel-safe:** yes.

---

### PHASE 1 — Control plane

| ID | Task | Pri | Files | Acceptance | Tests |
|---|---|---|---|---|---|
| **P1-1** | One state vocabulary + legal transition table | MUST | N-01 | 12 states; `JobStage`, `main.ts` STAGES, `stage.ts` STAGES all map onto it; an illegal transition throws | table-driven test over every (from,to) pair; illegal pairs rejected |
| **P1-2** | Ledger with a single writer | MUST | N-02, M-03, M-01, M-02 | `saveJob` is no longer exported to callers; the 20 call sites `[V]` become `emit(event)`; only Hermes mutates state/decision/budget | test asserting no module outside `ledger.ts` imports the mutating API |
| **P1-3** | Hermes rewrite: admission + stop conditions | MUST | N-04 | six stop conditions (V2 §U) evaluated in frozen order; `decision` written exactly once, at a terminal state | table test: one case per stop condition; assert order-dependence (a PASS at max iterations still delivers) |
| **P1-4** | Three counters | MUST | N-02, N-04 | `retry`/`rebuild`/`reconcept` independent with separate ceilings; a 503 no longer consumes reconcept budget | unit: transient failure increments only `retry` |
| **P1-5** | Gate route → advisory diagnosis | SHOULD | M-04 | `gateJob` returns a diagnosis; Hermes owns the routing table | existing gate tests updated; `scripts/smoke-gate.ts` still passes both branches `[V]` |

---

### PHASE 2 — State, checkpoint, resume

| ID | Task | Pri | Files | Acceptance | Tests |
|---|---|---|---|---|---|
| **P2-1** | Ledger is never re-created (CP8) | MUST | M-01 | `runJob` loads the ledger or fails; `createJob` runs only on a genuinely new job. Today `createJob` + `saveJob` resets `iteration` to 0 on every entry `[V:313-314]` | regression: start a job, kill it at iteration 2, re-enter — assert `reconcept === 2`, not 0 |
| **P2-2** | Content-addressed stage outputs | MUST | N-02, M-01, M-08 | each stage records `inputHash`/`outputHash`; a stage whose inputs are unchanged is skipped and its output reused | test: re-run a completed job — zero model calls, zero browser launches |
| **P2-3** | Immutable candidate directories | MUST | N-03, M-08 | candidate dirs are write-once; run-root artifact names preserved as pointers to `best` (F-17) | test: every one of the 10+ existing readers `[V]` still resolves |
| **P2-4** | One resume routine, both drivers | MUST | N-06, M-01, M-02 | `run-job` and the n8n stage path call the same routine and produce identical ledgers for the same interruption | integration: same run resumed via both paths → byte-identical ledger |

---

### PHASE 3 — Routing, cost, concurrency

| ID | Task | Pri | Files | Acceptance | Tests |
|---|---|---|---|---|---|
| **P3-1** | `VISION_*` into config (F-14) | MUST | M-06, M-02, `scripts/run-job.ts`, `scripts/visual-qa.ts` | no `process.env` read outside `lib/config.ts`; vision becomes a stage config beside analyst/writer/director | static test: grep for `process.env` outside `config.ts` returns only the allowed line |
| **P3-2** | Capability Router | MUST | N-09 | filter(licence·jurisdiction·credential·lease·rate·`modelMayWriteOutput`) then rank on **observed** telemetry `[V: lib/platform/telemetry.ts]` | unit per filter; a licence-incompatible provider is unreachable, not merely low-ranked |
| **P3-3** | Cross-provider failover (CP6) | MUST | N-09, M-05 | non-retryable failure on vendor A moves to vendor B, then to the terminal deterministic fallback | integration with a stubbed failing provider; assert the run still produces a site |
| **P3-4** | Rate governor (CP4) | MUST | N-10 | per-vendor token bucket scoped to **organisation** (Groq and Gemini both meter per org, so extra keys buy nothing) | unit: K=3 concurrent requests against a 2-RPM bucket queue rather than 429 |
| **P3-5** | Budget leases (CP5) | MUST | N-07, N-08, N-04 | no capability call without a lease; consumed budget survives a crash; exhaustion escalates | unit: a worker without a lease is refused; integration: budget cap reached → `ESCALATE(budget)` |
| **P3-6** | Runner concurrency | SHOULD | N-05 | K candidates build in parallel, bounded by CPU for browser work and by the governor for model work | integration: 3 candidates, assert no interleaved ledger writes |

---

### PHASE 4 — Quality *(gated: A/B ≥45%)*

| ID | Task | Pri | Files | Acceptance | Tests |
|---|---|---|---|---|---|
| **P4-1** | `uncertain` blocks delivery (CP7) | MUST | M-04 | with vision disabled, a design scoring ≥70 with no peers **no longer returns PASS** `[V — it does today]`; it routes to `ESCALATE(no-visual-evidence)` | regression reproducing today's false PASS, asserting it now blocks |
| **P4-2** | Lexicographic verdict combination | MUST | N-15 | blocking dimensions first; then max quality; then distinctness as tie-break; no weighted sum exists in the codebase | property test: a higher-distinctness/lower-quality candidate never wins |
| **P4-3** | Accessibility gate (axe-core) | MUST | N-12, M-12 | axe injected into the existing Chromium; keyboard 8-stop sweep; contrast measured **on the rendered page against the world-repainted ground** | fixture site with a known violation fails; the current snapshot sites pass or their debt is recorded |
| **P4-4** | Functional + security gate promotion | MUST | N-11 | the checks in `scripts/publish-run.ts:254-302` `[V]` become blocking gates; the three collected-but-unasserted fields (`dataUrls`, `iframes`, `formsWithoutAction`) are asserted | port existing checks with tests; add a CSP assertion |
| **P4-5** | Performance budgets | SHOULD | N-13 | page weight, largest image, DOM ceiling, LCP/CLS proxies; over-budget is a *caveat*, not a hard fail | budget fixture above and below threshold |
| **P4-6** | Visual regression | SHOULD | N-14, M-12 | pixel diff between candidates and between reconcept iterations; proves a rebuild actually differs rather than trusting the perturbation | test: identical renders → diff 0; perturbed → diff > threshold |
| **P4-7** | PII screening at normalize (CP10) | MUST | N-19, M-11 | screening runs **before the first model call**, not at render; a typed PII boundary marks fields structurally unrenderable | fixture profile containing a personal mobile → field is boundaried and never reaches a brief |
| **P4-8** | One capture implementation | SHOULD | N-21, M-01, `scripts/publish-run.ts`, `creative-review.ts`, `shoot*.mjs` | the four duplicated screenshot implementations `[V]` collapse to one, preserving the lazy-load/full-height technique verbatim | golden-image test: capture of a known page is byte-stable |

---

### PHASE 5 — Design Battle V2 *(gated: A/B ≥65%)*

| ID | Task | Pri | Acceptance | Tests |
|---|---|---|---|---|
| **P5-1** | L1 fingerprint computable **from a directive** (N-16) | MUST | fingerprint derivable without building or calling a model | equality test: fingerprint(directive) == fingerprint(built design) for 20 fixtures |
| **P5-2** | Divergence + diversity gate pre-spend (N-17) | MUST | M=10 perturbations enumerated and filtered with **zero model calls** | test: assert model-call count is 0 through the diversity gate |
| **P5-3** | K candidates with independent input views | MUST | each concept agent receives a different projection of the evidence | test: the three briefs differ in content, not only in ordering |
| **P5-4** | Conditional jury | SHOULD | k=1 unless the deterministic spread < margin | test: wide spread → 0 vision calls |
| **P5-5** | Frontier escalation triggers | OPTIONAL | fires only on A/B/C; every escalation records its cause | test: no cause → no escalation |
| **P5-6** | Adversarial critique | OPTIONAL | winner only, within margin, one objection, one revision | — |

---

### PHASE 6 — Design Memory

| ID | Task | Pri | Acceptance |
|---|---|---|---|
| **P6-1** | Scoped memory (N-18) | MUST | comparison only within industry ∧ ≤50 km ∧ ≤18 months; never global |
| **P6-2** | Three layers + exhaustion rule | MUST | weights shift L1→L2/L3 with occupancy; an exhausted scope stops requiring structural distinctness and logs it |
| **P6-3** | Retention + erasure | SHOULD | records pseudonymous, 36-month retention, erasable by `businessId` |

### PHASE 7 — n8n

| ID | Task | Pri | Acceptance |
|---|---|---|---|
| **P7-1** | Loop out of n8n (M-10) | MUST | workflow reduced to trigger → `POST /job` → poll/webhook; the `Reconcept?` IF node deleted `[V]`; the stage server exposes job-level endpoints only |
| **P7-2** | Human approval inbox | SHOULD | `ESCALATED` produces a brief with screenshots, verdicts, rejected concepts, and `best` |

### PHASE 8 — Media *(optional forever)*

| ID | Task | Pri |
|---|---|---|
| **P8-1** | Image editing of the business's own photographs | OPTIONAL |
| **P8-2** | Vector marks | OPTIONAL |
| **P8-3** | Everything else (video, 3D, TTS, motion libraries) | **not built** — V2 §V |

---

## 6. WHAT MUST NOT BE TOUCHED

**Rationale for each. A change here is a change request, not an implementation detail.**

| Frozen | Why |
|---|---|
| `test/__snapshots__/**` (7 files `[V]`) | Snapshots *are* the definition of correct output. Regenerating them to make a change pass converts a regression into a new baseline silently. |
| `lib/design/**` — 20 modules | Deterministic, benchmarked, ADR-backed (0004–0007). **Exception: M-09, additive only** (expose the directive→fingerprint path). No behaviour change. |
| `lib/content/**` | ADR 0007. The three copy bases and the evidence-language rule are enforced by tests. |
| `lib/render/**` — incl. `variants.ts` (3,692 lines) | The output contract. Any change moves every snapshot. |
| `lib/art/**` | Colour seed and photo curation feed the design layer deterministically. |
| `lib/sources/merge.ts`, `authority.ts` | Per-field merge policy. Simplifying it loses facts silently. |
| `agents/writerAgent.ts` fact-grounding (`groundTestimonials`, `groundingWarnings`) | The structural no-invention rule. The most valuable code in the repository. |
| `main.ts` stage order, `ARTIFACT_KEYS`, `ARTIFACT_DEFAULTS` | The persistence format; old runs are resumed and used as fixtures. Additive defaults only, empty values only. |
| Run-root artifact **names** (`1-discovery`…`6-deployment`) | 10+ readers across `scripts/` `[V]`. Candidates get new paths; these names stay and point at `best`. |
| `lib/render/html.ts` branded `Html` type | Escaping is structural, not conventional. |
| Playwright capture technique (strip lazy → decode → grow viewport, never `fullPage`) | Hard-won; documented incident. May be *moved* (P4-8), never altered. |
| `.gitignore`'s `output/*` rule | Keeps scraped PII out of git history `[V]`. |
| n8n node `typeVersion` pins | Stale pins fail *silently* — documented incident with Set v3 `[V]`. |

---

## 7. PARALLELISATION

### 7.1 Can run simultaneously — different agents, no shared files

| Group | Tasks | Shared files | Notes |
|---|---|---|---|
| **G0** (wave 0) | P0-1, P0-3, P0-5 | none | 3 agents. P0-2 and P0-4 both touch `runJob.ts` — see §7.2 |
| **G1** (wave 4) | P4-3, P4-5, P4-6 | none — each a new module + one wiring point | 3 agents |
| **G2** (wave 3) | P3-4 (governor), P3-5 (leases) | none | 2 agents; both plug into P3-2 afterwards |
| **G3** (any time after W1) | P7-1, P7-2 | `n8n/**`, `scripts/n8n/**` only | 1 agent, isolated from `lib/**` |
| **G4** (wave 4) | P4-7 (PII) | `normalizerAgent.ts` + new module | independent of the gate work |
| **G5** (wave 6) | P6-1, P6-2 | one new module | 1–2 agents |
| **G6** (documentation) | ADRs for F-01…F-18 | `docs/decisions/**` | any time |

### 7.2 Must be strictly sequential

| Sequence | Reason |
|---|---|
| **P0-2 → P0-4** | Both edit `lib/workflow/runJob.ts`. Small file, high blast radius; serialise rather than merge. |
| **P1-1 → P1-2 → P1-3 → P1-4** | The state vocabulary must exist before the ledger enforces it, before Hermes reads it, before counters split. Each step rewrites the same two files. |
| **P1 → P2** | Resume across three state vocabularies is meaningless. |
| **P2-1 → P2-2 → P2-4** | Hashing presupposes a ledger that is not reset; a shared resume routine presupposes hashing. |
| **P2 → P3-6** | Concurrency before resume turns one crash into K wasted candidates. |
| **P3-2 → P3-3** | Failover is a property of the router; it cannot precede it. |
| **P3 → P5** | The battle needs the router, the governor, and leases, or K=3 becomes an unbounded spend. |
| **P5-1 → P5-2** | The diversity gate is meaningless without a fingerprint computable pre-build. |
| **P5 → P6** | Memory needs a corpus of candidates and fingerprints. |
| **P0-1 → P4/P5/P6** | The A/B decides whether these exist. |

### 7.3 Agent isolation rules for parallel work

1. **One agent per file.** Never two agents editing `runJob.ts`, `main.ts`, or `stage.ts`.
2. **New modules preferred over edits** — most tasks above are structured as "new file plus one
   wiring line" precisely to enable parallelism.
3. **Snapshot suite is the shared tripwire.** Any agent whose change moves a snapshot stops and
   reports; it does not regenerate.
4. **Each agent runs `npm test` and `npm run typecheck` before handing back.** Scripts additionally
   need `npm run typecheck:scripts` — `scripts/**` is **not** in the default typecheck config `[V]`.

---

## 8. ACCEPTANCE — FREEZE EXIT CRITERIA

The freeze is satisfied when all of the following hold. Anything unchecked keeps the freeze open.

| # | Criterion | Verified by |
|---|---|---|
| 1 | A/B result recorded with ≥7 human verdicts and a decision applied | `ab/result.json` + a written decision |
| 2 | A 3-iteration declining run escalates carrying the **best** candidate | regression test |
| 3 | No model-authored byte can reach a delivered artifact on any autonomous path | static test |
| 4 | Exactly one state vocabulary in the codebase | grep: no `JobStage`, no second `STAGES` |
| 5 | Exactly one writer of job state | static test on imports |
| 6 | A killed job resumes with zero re-run completed stages, zero model calls | integration test |
| 7 | A provider outage produces a delivered site via failover or the floor | integration test with a stubbed failure |
| 8 | A job cannot exceed its budget | integration test |
| 9 | Vision disabled ⇒ no delivery without human acceptance | regression test |
| 10 | All nine quality dimensions produce verdicts; blocking ones block | gate test suite |
| 11 | K=3 divergence performs **zero** model calls before the diversity gate | call-count test |
| 12 | Snapshot suite green and unmodified | `npm test` + `git diff --stat test/__snapshots__` empty |
| 13 | `npm run typecheck` **and** `npm run typecheck:scripts` clean | CI |
| 14 | Every frozen decision F-01…F-18 has a corresponding ADR under `docs/decisions/` | review |

---

## 9. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **A/B returns 45–65%** — the cabinet does not pay for itself | **medium-high** | P4–P8 mostly cancelled | This is a *success* of the process, not a failure. W0 is designed so the answer is cheap; the budget redirects to evidence quality (OCR, Places, photo handling). |
| Ledger rewrite (P1-2) destabilises the working loop | medium | high | 20 call sites `[V]` change in one wave; keep the old path behind a flag for one wave; both must produce identical ledgers on the same run. |
| Artifact-name change breaks 10+ script readers | medium | medium | F-17 forbids renaming. Candidates get new paths; run-root names become pointers. |
| Snapshot drift from the a11y or capture work | medium | medium | §7.3 rule 3: an agent that moves a snapshot stops and reports. |
| Parallel agents collide on `runJob.ts` | high if unmanaged | medium | §7.2 makes every task touching it sequential. |
| Open legal questions (O-2…O-6) block delivery late | medium | **high** | Resolve O-5 (font licences) and O-6 (photo rights) **during W0** — they are legal work, not engineering, and can run in parallel with everything. |

---

## 10. THE SHORTEST HONEST SUMMARY

**Five tasks in Wave 0, four of them free, one of them decides the fate of the other five phases:**

1. **P0-1** — run the A/B. Floor vs the director path that already exists. ~€1, one afternoon.
2. **P0-2** — candidate store and monotone best-so-far. Stops a worse reconcept from destroying a
   better result, which is happening today.
3. **P0-3** — close the coding-agent path to delivered bytes.
4. **P0-4** — a failed reconcept must not return `decision: 'running'`.
5. **P0-5** — make one live call to each fallback provider, so the fallbacks are real.

Everything after that is contingent, ordered, and — if the A/B disappoints — largely unnecessary.
**That is the point of the freeze: it makes the expensive half of the architecture refutable before
it is built.**

---

_End. Nothing implemented. The repository, the n8n workflow, and the dependency tree are exactly as
they were found._
