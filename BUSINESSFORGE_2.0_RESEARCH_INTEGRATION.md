# BusinessForge 2.0 — Research Integration & Current-State Architecture

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus, produced 2026-08-19 against an older branch.
> Design-input history, not current status. Current status: `docs/MASTER_INVENTORY.json`
> (machine-readable) and `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical).

_Read-only audit and integration. Produced 2026-08-19 against branch `design-director-smoke`.
**No source file, test, snapshot, n8n workflow, `.env`, or dependency was modified, installed,
or deleted in producing this document.** Nothing here is implemented. This document, and the
verification pass behind it, is the only thing written._

Sixth in the `BUSINESSFORGE_2.0_*` series — [ARCHITECTURE_V2](BUSINESSFORGE_2.0_ARCHITECTURE_V2.md) ·
[MASTER_ARCHITECTURE](BUSINESSFORGE_2.0_MASTER_ARCHITECTURE.md) ·
[CAPABILITY_ARSENAL](BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md) ·
[REGISTRY_REVIEW](BUSINESSFORGE_2.0_REGISTRY_REVIEW.md) ·
[REGISTRY_V1_REDTEAM](BUSINESSFORGE_2.0_REGISTRY_V1_REDTEAM.md) · [ARCHITECTURE_FREEZE](ARCHITECTURE_FREEZE.md).

**Why a sixth document rather than an edit to the first five.** Those five are dated 2026-08-14
and are self-consistent as a series (V1 → red-team → V2 → freeze). The codebase has moved
substantially since — a second production pipeline (`lib/forge/`), the capability orchestration
layer (`lib/capability/`), and most of the freeze's Phase 0/1 modules were built in the five days
between. Editing the five in place would destroy the record of what was decided when, which the
series itself treats as load-bearing (`ARCHITECTURE_FREEZE.md` §0: "if an implementer disagrees,
they raise it as a change request… they do not quietly build something else"). This document
does what a change-request pass does: re-verifies every claim against the repository as it stands
today, integrates the research that has arrived since (the asset-stack and auxiliary-arsenal
corpora, the `docs/knowledge/` design-intelligence base, the `docs/antigravity/` forensics
archive), and — this is the part the prior five could not do, because the thing they were
auditing did not exist yet — surfaces that **the codebase itself now contains two
architecturally incompatible answers to the series' own central invariant**, built four days
apart, never reconciled. §3 is that finding. It is the most important thing in this document.

## 0. How to read this

| Mark | Meaning |
|---|---|
| **[V]** | Verified in the repository's source this pass, by me or by a research pass I directed and checked. |
| **[A]** | Verified by a dispatched research agent this session, reported with file:line citations; not independently re-read by me. Treated as [V]-equivalent unless flagged. |
| **[D]** | Documented only — asserted by a prior repo document, not re-verified this pass. |
| **[R]** | From the research corpora (`research/asset-stack/`, `research/auxiliary-arsenal/`, `docs/knowledge/`) — external-world claims, priced/licensed at the date the research was produced (2026-08-19 for the two research/ trees; 2026-08-11 for docs/knowledge). Re-verify at the vendor before spending money.
| **[X]** | Absent — searched for and not present. |
| **[?]** | Unknown / requires a founder or legal decision. |

Status vocabulary for every capability/module below, per the brief's own terms:

| Status | Meaning |
|---|---|
| **EXISTS** | Implemented, wired into a production entry point, exercised by tests. |
| **PARTIAL** | Implemented but with a real gap — wrong entry point, missing half of the contract, or wired into only one of two production drivers. |
| **DISCONNECTED** | Fully and carefully implemented, unit-tested — and imported by nothing except its own test file. Not reachable from any command a user runs. |
| **EXTERNAL** | Available outside the repo, researched, not integrated. |
| **MISSING** | Named by the target architecture; does not exist in any form. |
| **REJECTED** | Deliberately not built, with a recorded reason (a decision, not a gap). |

**Method.** Three research agents audited, in parallel and independently: (1) `lib/forge/` +
`lib/capability/` + `lib/ai/` + `lib/cost/` + `scripts/forge/` against `PROJECT_STATUS.md`'s full
history; (2) every `lib/workflow/`, `lib/qa/`, `lib/memory/` module against `ARCHITECTURE_FREEZE.md`
§2.1/§5's N-xx/P-xx task table, including a grep for production importers of each; (3) the full
`research/asset-stack/` (18 files), `research/auxiliary-arsenal/` (15 files), `docs/knowledge/`
(13 files) and `docs/antigravity/` (7 files) corpora, indexed and flagged for MCP/skills/SEO/a11y/
perf/security content specifically. I independently read `docs/architecture.md`, `docs/experience-
architecture-v2.md`, `docs/experience-capability-audit.md`, `docs/experience-system.md`,
`docs/content-system.md`, `docs/capability-orchestration.md`, `docs/mcp.md`, `docs/skills.md`,
`docs/AWWWARDS_PATTERN_LIBRARY.md`, `docs/Design_Intelligence_Foundation.md`,
`docs/From_Business_Evidence_to_Creative_Direction.md`, `docs/EXPERIENCE_SIGNATURE_PIPELINE.md`,
all four prior `BUSINESSFORGE_2.0_*.md` documents, `ARCHITECTURE_FREEZE.md`, `ROADMAP.md`,
`NEXT_SESSION.md`, `PROJECT_STATUS.md` (head), and `lib/capability/registry.ts` in full.
**Deliberately not done:** no test run, no build, no network call, no dependency install, `.env`
never opened.

---

## 1. Executive summary

1. **The repository now contains two production-grade website-generation pipelines that
   disagree about the architecture's own central rule.** The classic pipeline
   (`main.ts` → `agents/` → `lib/design/`, `lib/content/`, `lib/render/`) enforces "the model
   decides intent from a closed vocabulary; deterministic code executes it — no model-authored
   byte reaches a customer artifact" structurally, via `additionalProperties:false` schemas and a
   renderer that accepts no free text. `lib/forge/` — built four days later by an autonomous
   coding session, reconciled into this branch, and now the more actively developed of the two —
   has a model **write the customer's HTML, CSS and JavaScript directly**, in two prompted passes,
   safety-netted by a vision critic and a static anti-slop scanner rather than by a closed
   vocabulary. Both pipelines are real, tested, and benchmarked well. Neither has been told the
   other one exists in this framing. §3.
2. **A large fraction of the `ARCHITECTURE_FREEZE.md` backlog is now built — as careful,
   individually unit-tested modules that are imported by nothing but their own test file.**
   `lib/workflow/state.ts`, `ledger.ts`, `resume.ts`, `runner.ts`; `lib/qa/verdict.ts`,
   `visual-regression.ts`, all three `lib/qa/gates/*`; `lib/memory/designMemory.ts` — eight modules,
   several thousand lines, all DISCONNECTED. §1.3.
3. **The capability/provider/router layer the freeze called for is real, and is the strongest
   piece of new architecture in the repository.** `lib/capability/` (37 capabilities, a genuine
   filter→rank→execute router, per-capability policy gates, quota, cost accounting) is wired into
   three of the classic pipeline's four model-calling agents and into all six of Forge's
   model-calling stages. This is not a proposal — it is running code with a real test suite and one
   real end-to-end proof against live evidence. §1.2, §6.
4. **The research the brief asked for already exists, in depth, and mostly does not need
   redoing.** `research/asset-stack/` (18 files) and `research/auxiliary-arsenal/` (15 files) —
   both dated 2026-08-19, both citing live vendor pricing pages — plus `docs/knowledge/` (13 files,
   2026-08-11, a design-intelligence and K1–K4 doctrine base) together already answer nearly every
   question in the brief's Part 3 (A–M). §2.
5. **A second, smaller instance of finding 1 exists inside the experience layer specifically.**
   `docs/experience-architecture-v2.md` already specifies exactly the closed-vocabulary
   "experience/behavioral design layer" the brief's Part 5 asks for, ADR-backed, derived from the
   real code. `lib/forge/experienceStrategy.ts` independently invented a second, structurally
   similar but incompatible closed vocabulary, four days later, with no cross-reference to the
   first. §5.
6. **MCP and Agent Skills have real infrastructure (`lib/platform/mcp/`, `lib/platform/skills/`)
   and zero live servers or implemented skills.** The research corpus has already scored and
   prioritized twenty-plus candidates. Nothing has been installed; no credential exists for
   any of them. §6.

---

## 2. Research corpus index — what already exists, so it is not redone here

Per the brief's own instruction (Part 2): this section indexes, it does not reproduce. Full
content lives in the cited files.

### 2.1 `research/asset-stack/` — 18 files, [R], evidence captured 2026-08-19

Router doctrine: **FREE FIRST → MEDIUM IF JUSTIFIED → PREMIUM ONLY IF JUSTIFIED**, decided per
business from evidence, never by default. Covers image/video/audio/3D/motion generation providers
with live-fetched pricing (`04_PROVIDER_MATRIX.md`, `13_LICENSE_MATRIX.md`), a 35-site real-premium-
site teardown by mechanism not brand (`11_REAL_SITE_RESEARCH.md`), a per-asset decision table
(`05_ASSET_MATRIX.md`), an explicit reject list (`15_REJECT_LIST.md`), industry→asset escalation
rules (`14_BUSINESS_TO_ASSET_RULES.md`), and a no-code implementation map mirroring
`lib/capability/`'s own shape (`16_IMPLEMENTATION_MAP.md`). **Five hard licence red flags**, verified
live: Recraft free tier, ElevenLabs free tier, and Suno free tier are all **non-commercial only** —
none may ship on a paying customer's site. `lib/capability/registry.ts`'s own `image_editing` and
`motion_media` rows already cite this corpus by path and carry the same caution.

### 2.2 `research/auxiliary-arsenal/` — 15 files, [R], evidence captured 2026-08-19

Broader than the asset stack: research/browser tooling, visual intelligence (a full study of the
OSS `screenshot-to-code`, 74k stars, verdict **STUDY the pattern, never pipe its output to
production** — it bypasses every gate this repository exists to enforce), design-token tooling,
Awwwards experience-pattern extraction, functional integrations, the AI provider matrix, and —
answering the brief's Part 3F/G directly — a scored MCP-server candidate table and an agent-skills
adoption table. §6 below reproduces the two tables that matter most; the rest is cross-referenced,
not copied.

### 2.3 `docs/knowledge/` — 13 files, [R], 2026-08-11, pre-implementation research

A four-class knowledge doctrine (**K1** invariant/non-negotiable, **K2** craft/strong-default,
**K3** trend/decoration-only, **K4** anti-knowledge/prohibitive) applied across: 48 human-design
principles with concrete numeric thresholds (`HUMAN_DESIGN_PRINCIPLES.md`); a 20-pattern anti-AI-
slop detector spec (`ANTI_AI_SLOP.md`); a 137-rule security doctrine including a dedicated
Section Q on AI-generated-code failure modes (`SECURITY_KNOWLEDGE.md`); Core-Web-Vitals-as-build-
gate performance budgets by site tier (`PERFORMANCE_KNOWLEDGE.md`); a 60-technique interaction
catalogue rated by no-JS feasibility (`INTERACTION_LIBRARY.md`); a 31-principle motion doctrine
(`MOTION_LIBRARY.md`); a truth/evidence epistemology with 33 forbidden inference patterns
(`TRUTH_AND_EVIDENCE.md`); a 29-capability engineering-domain map gated by business evidence
(`WEBSITE_CAPABILITY_KNOWLEDGE.md`); and the Experience Signature methodology
(`EXPERIENCE_SIGNATURE_SYSTEM.md`) that `lib/forge/signature.ts` is a direct implementation of.
**None of it is wired to code yet** — it is markdown research, not a queryable knowledge layer;
`BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` (in the same folder) proposes the storage/retrieval
layer that would make it one, and that proposal is itself unbuilt. **No SEO-specific content
exists anywhere in this corpus** — flagged explicitly by the research agent as a genuine absence,
not an oversight in reading.

### 2.4 `docs/antigravity/` — 7 files, [A], forensic archive of the sessions that built `lib/forge/`

Confirms the provenance central to §3: `lib/forge/` originates from **Google Antigravity
autonomous coding sessions, 2026-08-16 to 2026-08-18**, a different AI system (Gemini-based,
operating with broad file-write autonomy) than the Claude sessions that wrote the
`BUSINESSFORGE_2.0_*` series two days earlier. The archive's own README defines a four-tag
reconciliation taxonomy (`ALREADY_PRESENT` / `ANTIGRAVITY_ONLY` / `PARTIALLY_RECONCILED` /
`UNVERIFIED`) — evidence the need for reconciliation was already recognized. It records the
concrete build history: a monolithic single-pass builder hit Gemini's `MAX_TOKENS` ceiling on a
real run (`forge-6aba5270`, a documented failure, not a hypothetical), which is *why* the two-pass
HTML/CSS-JS split exists — a real, sound engineering fix to a real problem, arrived at by a route
that never asked whether a model should be writing CSS and JS at all.

---

## 3. THE FORK — Forge vs. the deterministic invariant

This is stated as a finding, not resolved as a decision. It is a founder-level architectural
choice, not an engineering one, for the reasons given at the end of this section.

### 3.1 What each side actually does, verified [A]

| | Classic pipeline | Experience Forge |
|---|---|---|
| Entry point | `main.ts`, `lib/workflow/runJob.ts`, `scripts/n8n/stage.ts` | `scripts/forge/run.ts` and siblings |
| Who writes HTML/CSS/JS | `lib/render/` — a pure deterministic function; **no model call in the entire module** [V: `lib/render/`, `docs/architecture.md`] | A model, directly, in `lib/forge/builder.ts`'s two prompted passes [A] |
| What a model may return | A validated object against a closed schema (`additionalProperties:false`); free text is capped at four one-sentence fields and never parsed into a decision [V: `agents/designDirectorAgent.ts`, ADR 0004] | Complete HTML5 (Pass 1) and complete CSS3+JS (Pass 2) as literal source text [A: `docs/EXPERIENCE_SIGNATURE_PIPELINE.md` §1.3, `lib/forge/builder.ts`] |
| Safety mechanism | Structural: an invalid or out-of-schema value cannot reach the renderer; the type system and the schema are the enforcement | Statistical/inspective: an anti-slop static scanner (`anti-ai-gate.ts`), a vision critic scoring 10 axes (`critic.ts`), and a repair loop (`repair.ts`) — all of which *judge* the model's output after the fact, none of which can prevent a category of output from being written in the first place |
| Benchmarked result | 6-business benchmark, `narrativeCoherence`/`genericityReport` gates, 1160+ tests, deterministic and reproducible | Go Sweet 85/100, River Park 89/100 vision-critic scores [D: `EXPERIENCE_SIGNATURE_PIPELINE.md` §2] — real, but scored by the same kind of uncalibrated vision judge the freeze series names as "the weakest link in the current quality story" [D: `MASTER_ARCHITECTURE.md` §5.9] |
| Shares code with the other pipeline? | — | **No.** Zero import edges into `lib/design/`, `lib/render/`, or `lib/content/` from any `lib/forge/*.ts` file [A: grep, confirmed]. The only shared modules are cross-cutting infrastructure: `lib/capability/`, `lib/ai/`, and `lib/qa/verdict.ts` |

### 3.2 Why this is not a new discovery, and why it is worse than the one already on record

`BUSINESSFORGE_2.0_REGISTRY_V1_REDTEAM.md` §C1 (2026-08-14) already found the invariant broken
once — `scripts/visual-qa.ts`'s `--autofix` path spawns a coding agent with edit access to the
rendered site. It assessed that finding as CRITICAL-but-contained, because that path is gated
behind an explicit human flag and is not on the autonomous product path: *"`runJob` and the n8n
loop do not call it — they use `visual-critic`, which judges and never edits."*

`lib/forge/builder.ts` is a materially different case, not a repeat of the same one: model-authored
CSS/JS is not an opt-in autofix edge case there — it is the **entire, undisputed, primary
mechanism** by which every Forge run produces its output. There is no deterministic path through
Forge at all. Where the redteam's C1 was "one wiring away" from legitimizing an edge case, Forge
*is* the thing C1 warned against, shipped as the main path of a second product surface, with a
working benchmark to its name.

### 3.3 Why this document does not resolve it

Both systems have real, measured value and real cost sunk into them. Resolving "which one is
BusinessForge" changes what several thousand lines of code mean, is exactly the kind of call the
freeze series reserves for a founder decision (`ARCHITECTURE_FREEZE.md` §1.3 O-1 through O-7 are
the same class of question), and cannot be settled by re-reading the code harder. What can be
stated as fact:

- They are not in conflict at runtime — a user invoking `main.ts` never reaches Forge code and
  vice versa. The conflict is only in what each one claims the architecture *is*.
- Forge's benchmark numbers are not directly comparable to the classic pipeline's, because they
  are scored by different instruments (a vision critic vs. structural/coherence gates) — this
  document does not have grounds to say one produces a better website than the other, only that
  they are built on incompatible premises.
- Whatever is decided, **§8's contradiction register and §9's decision log below capture the
  question precisely enough that resolving it does not require re-doing this audit.**

---

## 4. EXISTS / PARTIAL / EXTERNAL / MISSING — current-state matrix (2026-08-19)

Supersedes the equivalent tables in `MASTER_ARCHITECTURE.md` §3 and §6 and
`ARCHITECTURE_FREEZE.md` §2 wherever they disagree — those were correct against the 2026-08-14
tree; this is the same audit re-run five days later, [A] throughout unless marked otherwise.

### 4.1 Orchestration

| Component | Status | Evidence |
|---|---|---|
| Classic pipeline (`main.ts`, 9 stages) | **EXISTS** | [D, prior series, re-confirmed unchanged this pass] |
| Experience Forge (`lib/forge/orchestrator.ts`, 10 steps) | **EXISTS**, parallel, unmerged | §3.1 |
| `lib/workflow/hermes.ts` — control-plane rewrite (N-04) | **PARTIAL** | Old `decide()` function live in both drivers [A]; the new `Hermes` class (ceilings, `isSurvivable`) has no `transition()` method and zero importers [A] |
| One state vocabulary (N-01, `state.ts`) | **DISCONNECTED** | Full 12-state machine built, matches spec; imported only by its own test [A]. `main.ts`'s 9 stages, `JobStage`'s 16, and `stage.ts`'s 7 still coexist as the redteam found on 08-14 |
| Ledger, single writer (N-02, `ledger.ts`) | **PARTIAL/weakest of the batch** | Implements only the 3 attempt counters; no persistence, no `emit(event)` pattern, no test file at all, zero importers [A] |
| Candidate store + monotone best-so-far (N-03, `candidates.ts`) | **EXISTS, WIRED** | Imported by both `runJob.ts` and `stage.ts`; tested [A]. **The single highest-value freeze item, and it shipped.** |
| Resume routine (N-06, `resume.ts`) | **DISCONNECTED** | Matches spec; neither driver calls it — each still does its own resume logic [A] |
| Runner/concurrency (N-05, `runner.ts`) | **DISCONNECTED** | [A] |

### 4.2 Capability / provider / router layer

| Component | Status | Evidence |
|---|---|---|
| `lib/capability/` — 37-capability registry, real filter→rank→execute router | **EXISTS, WIRED** | Registered [V: `registry.ts`, read in full]; wired into `businessAnalystAgent`, `writerAgent`, `designDirectorAgent`, the classic-pipeline visual critic, and all six Forge model stages [A, D: `docs/capability-orchestration.md`] |
| `lib/ai/router.ts` (freeze's original, narrower router) | **EXISTS, WIRED** | Still live for the classic pipeline's 3-value capability vocabulary; superseded but not removed [A] |
| `lib/ai/governor.ts` — per-vendor rate governor | **EXISTS, WIRED** | Real token bucket, used by `lib/capability/orchestrator.ts` [A] |
| Cross-provider failover (freeze CP6) | **EXISTS** | `lib/capability/execute.ts` fails over across the bindings chain on any thrown step [A] |
| 7 AI vendor adapters (Anthropic/OpenAI/Gemini/OpenRouter/xAI/DeepSeek/Cerebras) | **EXISTS** (code) / **6 of 7 EXTERNAL** (no live credential) | All code-complete and wired to every touchpoint; only Gemini confirmed actually credentialed and exercised live in this deployment [A] |
| Budget leases (N-07/N-08, `lib/cost/`) | **PARTIAL** | `ledgerEntry.ts`/`lease.ts` exist and are correct in isolation; the orchestrator's own cost-line accumulation is what's actually exercised in a run, and `grantLease()` has zero importers outside its own file [A] |
| Quota ledger (daily per-model request tracking) | **EXISTS, WIRED** | `lib/capability/quota.ts`, new since the freeze docs, not previously specified — genuinely fills the gap those docs identified as the free tier's real constraint |

### 4.3 QA / gates

| Component | Status | Evidence |
|---|---|---|
| Distinctness gate (`distinctness-gate.ts`) | **EXISTS, WIRED**, not split per freeze M-04 | Live in both drivers; still one `gateJob` returning one result, `uncertain` handled as a reason string rather than a distinct blocking channel [A] |
| Lexicographic verdict combination (N-15, `verdict.ts`) | **PARTIAL** | Textbook-correct implementation; only reachable through `lib/forge/verdict.ts` and `battle.ts`, both themselves DISCONNECTED from any production driver [A] |
| Visual jury (`jury.ts`) | **EXISTS, WIRED** | ±5 margin rule as specified, live in `stage.ts` [A] |
| Layout audit (not in original freeze plan) | **EXISTS, WIRED** | 387 lines, real Playwright measurement, feeds the distinctness gate — the single largest unplanned addition, and it shipped live [A] |
| Accessibility / performance / technical gates (N-11/12/13, `qa/gates/*`) | **DISCONNECTED, all three** | Each matches its spec closely; each reachable only from its own test [A] |
| Visual regression (N-14) | **DISCONNECTED** | [A] |
| PII screening (N-19, `piiScreen.ts`) | **EXISTS, WIRED**, partial coverage | Live in `normalizerAgent.ts`, pre-model as required; covers phone/email only, not the `postal-address` kind the type already declares [A] |
| Design fingerprint / diversity gate (N-16/17) | **EXISTS, WIRED** | Both live via `stage.ts` [A] |
| Design Memory (N-18) | **DISCONNECTED** | Careful, spec-matching implementation (scoped industry∧50km∧18mo, exhaustion rule, pseudonymous retention) — unreachable [A] |

### 4.4 Experience Forge internals — a second matrix, since the classic-pipeline one above doesn't cover it

| Component | Status | Evidence |
|---|---|---|
| Factual Firewall / grounding (`grounding.ts`) | **EXISTS, WIRED** | Known bug: no deterministic-floor handler for a fully-exhausted chain — throws rather than degrading [A, D: `PROJECT_STATUS.md`] |
| Creative Territories + Signature (`signature.ts`) | **EXISTS, WIRED** | Direct implementation of `docs/knowledge/EXPERIENCE_SIGNATURE_SYSTEM.md`'s methodology |
| Asset intelligence (`assetStrategy.ts`) | **EXISTS, WIRED**, newest addition | Deterministic real/vector/non-depictive routing per asset slot; proven on a live run to correctly suppress fabricated `<img>` references [D: `PROJECT_STATUS.md`] |
| Anti-AI-slop gate + structural convergence check | **EXISTS, WIRED** | [A] |
| Design Battle (`battle.ts`) | **EXISTS**, N=2 not 3 by design | Reuses the classic pipeline's `lib/qa/verdict.ts` comparator unmodified [A] |
| Motion contract + library-loading plumbing | **EXISTS, WIRED**, one recent fix | A real gap (Pass 2 told the model to load GSAP, Pass 1 never emitted the `<script>` tag) found and fixed this session [D: `PROJECT_STATUS.md`] |

### 4.5 Experience / behavioral design layer

See §5 for the full account. Summary:

| Component | Status |
|---|---|
| Tier-1 (deterministic) experience vocabulary, classic pipeline | **EXISTS**, ~9 of 12 fields real, `transition` still a boolean not the specified enum (gap G1) |
| Tier-2 (runtime-gated) vocabulary — generic runtime host `lib/runtime/` | **MISSING** (only `scroll-progress.ts`, a narrow slice, exists) |
| Tier-3 (specialized WebGL) — `lib/experience/` "Bakery V2" | **EXISTS**, quarantined, one business only, zero import edges into the product |
| Forge's independent `experienceStrategy.ts` vocabulary | **EXISTS, WIRED** (inside Forge only) — unreconciled against Tier-1/2 above |

### 4.6 MCP and Agent Skills infrastructure

| Component | Status | Evidence |
|---|---|---|
| MCP manager, HTTP transport | **EXISTS**, never run against a live server | [D: `docs/mcp.md`, `docs/architecture.md`] |
| MCP stdio transport | **MISSING** (declared, `not_implemented`) | [D: `docs/mcp.md`] |
| Any MCP server actually registered/credentialed | **MISSING** | [V: `.env.example` has no `MCP_SERVERS` value set] |
| Skill registry/loader/manager | **EXISTS** | [D: `docs/skills.md`] |
| Any of the 38 built-in skills actually implemented | **MISSING**, all 38 | Every one still `version 0.0.0`, `not_implemented` [D, re-confirmed this pass by absence of any contrary evidence] |
| MCP/skill candidates researched and prioritized | **EXTERNAL, scored** | §6.1–6.2 |

### 4.7 Functional integrations, SEO, accessibility, performance, security

| Area | Status |
|---|---|
| Search / booking / forms / payments / auth / CMS / email / SMS / analytics / maps | **MISSING** in-repo; **EXTERNAL, fully researched and priced** — `research/auxiliary-arsenal/10_FUNCTIONAL_INTEGRATIONS.md`, `docs/knowledge/WEBSITE_CAPABILITY_KNOWLEDGE.md` (29-capability map, only 9 within the current static-no-JS delivery envelope) |
| SEO | **PARTIAL** in-repo (JSON-LD, semantic HTML, `<html lang>`, sitemap/robots absent [V: not found in `lib/render/`]); **MISSING** as a dedicated research topic — no file in either research tree or `docs/knowledge/` addresses SEO as its own subject, confirmed absent by three independent read passes |
| Accessibility | **PARTIAL** in-repo (landmark/alt/contrast checks exist; axe-core does not [D, re-confirmed: `lib/qa/gates/accessibility.ts` is DISCONNECTED per §4.3]); **EXTENSIVELY researched** (`INTERACTION_LIBRARY.md`'s AF1–AF8, `PERFORMANCE_KNOWLEDGE.md`'s LCP/CLS-as-access) |
| Performance | **PARTIAL** in-repo (byte/DOM budgets reported, not enforced); **EXTENSIVELY researched**, with numeric per-tier budgets ready to encode (`PERFORMANCE_KNOWLEDGE.md`) |
| Security | **PARTIAL** in-repo (5 shipped checks, `output_security` gate); **EXTENSIVELY researched**, 137 rules including a dedicated AI-generated-code section (`SECURITY_KNOWLEDGE.md` §Q) that maps almost one-to-one onto what a model-authored-CSS/JS path (§3) would need enforced and today does not have |

---

## 5. Experience / Behavioral Design Architecture

The brief's Part 4/5 asks for a layer, structured as intent (not "use Jitter"), sitting after
creative strategy and before rendering, **based on the existing repository architecture**. That
layer already has a specification: `docs/experience-architecture-v2.md` §3, which this document
adopts as canonical rather than re-deriving, because it is ADR-linked, cites real code at every
row, and was itself produced by exactly this kind of audit.

### 5.1 The vocabulary, as already specified [D: `experience-architecture-v2.md` §3.1–3.2]

**Tier 1 — data plan, deterministically realizable today, no runtime:**
`mode` (brochure/showcase/narrative/immersive) · `arc`/`sequence` (ordered `NarrativeRole[]`) ·
`sceneKind` (closed composition enum) · `pacing` (+scroll distance) · `worldJourney` (ordered
ground sequence) · `moment` (one nominated section + `isSignature`) · `transition`
(none/veil/wipe/circular-handoff) · `imageChoreography` · `heroTreatment` · `ctaBehavior` ·
`typographyBehavior` · `density` · `narrativeDevice` (opt-in, e.g. a clock motif).

**Tier 2 — runtime-gated, opt-in only when `interaction.ceiling === 'immersive'`:**
`scrollProgress` (`--p`/`--vis` CSS custom properties) · `groundBand` · `veil` · `heroObjectState`
(abstract, consumed by a per-category shader) · `scrub` · `pointer` (parallax/magnetic, gated on
`hover:hover` and `pointer:fine`).

This is exactly the shape the brief's own example asked for (`experience: { interaction: {...},
motion: {...}, navigation: {...}, media: {...} }`) — a closed, typed, evidence-derived contract, not
a tool name.

### 5.2 Current implementation status against that vocabulary

Tier 1 is substantially real in the classic pipeline: `lib/design/experience.ts`,
`assets.ts`, `conversion.ts`, `script.ts` implement `mode`, `arc`, `pacing`, `worldJourney`,
`moment`, `imageChoreography`, `ctaBehavior`, `density` as genuine deterministic derivations from
`BusinessCharacter`, proven to diverge across businesses in the same industry (ADR 0006, the
six-business benchmark). Two real gaps remain, both already named and both cheap:

- **G1 — `transition` is still a boolean** (`momentTransition`), not the four-value enum the
  vocabulary specifies. [D, unconfirmed as fixed this pass]
- **G13 — `classifyIndustry` has no `venue` category** [D: `content-system.md` "Known limits" —
  still current; nothing in this session's evidence contradicts it], which is why a hotel-adjacent
  accident is currently load-bearing for the platform's best output (River Park).

Tier 2 is the larger gap: **no generic runtime host exists.** `lib/runtime/scroll-progress.ts` is
one narrow, correctly-gated slice of it (page scroll progress only). The full Tier-2 vocabulary —
veil, ground-band, hero-object-state, scrub — has nowhere to execute. The one place any of it
*does* run is `lib/experience/` ("Bakery V2"), a hand-authored, deliberately quarantined,
single-business proof that a Tier-3 (specialized WebGL) host is reachable at all — correctly kept
out of the general path, per its own documentation, but also therefore not evidence that Tier 2 is
built.

### 5.3 The second fork: Forge's independent vocabulary

`lib/forge/experienceStrategy.ts` defines its own closed, validated, 17-field vocabulary — motion
intensity, navigation mode, cursor behavior, media strategy, functional modules — enforced with
the same "model proposes, code disposes" discipline the classic pipeline uses (ADR 0004's pattern,
applied independently) [A]. `lib/forge/motion.ts` separately defines four closed `MotionIntensity`
presets with duration bands and a library-adoption register.

This is a **second, structurally similar, but field-incompatible instance of exactly the
vocabulary §5.1 already specifies**, built without reference to it. Concretely: Forge's `motion`
enum and the classic pipeline's `InteractionStrategy.level` describe overlapping but non-identical
concepts; Forge's navigation/cursor/media fields have no counterpart in `ExperienceArchitecture`
at all, because the classic pipeline's static renderer has never needed them — it has no client
runtime to configure. Reconciling the two is not free (Forge's vocabulary configures a runtime that
actually exists and executes; the classic pipeline's Tier-2 vocabulary configures a runtime that
does not), but treating them as two unrelated inventions, as they are today, guarantees the next
extension to either one repeats work the other already did.

### 5.4 Recommendation (not implemented here)

Do not build a third vocabulary. When §3's fork is resolved — in either direction — the surviving
pipeline's experience vocabulary should be extended, field by field, against §5.1's table as the
reference, with the other pipeline's fields checked off as "already named" or logged as a genuine
addition. If both pipelines survive, `experienceStrategy.ts`'s fields should be mapped onto §5.1's
Tier-1/Tier-2 split explicitly, once, in one document, rather than left as two silently-diverging
schemas.

---

## 6. Capability / Provider / MCP / Skills architecture

### 6.1 MCP — scored candidates, [R]: `research/auxiliary-arsenal/12_MCP_ECOSYSTEM.md`

None of the following is installed, credentialed, or contacted. All routing shown is a research
recommendation, not a decision.

| Server | Trust | Risk | Recommended role | Priority |
|---|---|---|---|---|
| Higgsfield | vendor-official | LOW (vendor ToS) | media generation in the agent loop | P0 |
| Firecrawl | official agent skill | MED (web egress) | research | P0 |
| Playwright / Puppeteer | reference | MED (browser/network) | QA / render | P0 |
| Axe (Deque) | vendor-official | LOW | accessibility in QA | P1 |
| Exa | vendor-official | LOW | research | P1 |
| GitHub | reference | MED (token) | deploy/publish | P1 |
| PostgreSQL | reference | MED (DB) | data/CMS | P1 |
| Filesystem | reference | **HIGH if unsandboxed** | build I/O, **sandboxed only** | P1 |
| Git | reference | MED | versioning | P1 |
| Algolia, Cloudinary, Memory, Sequential Thinking, Sentry, Slack, Google Maps, Brave | mixed | mixed | function/planning/monitoring | P2 / optional |

Two explicit redundancy notes worth preserving: Google Maps MCP is redundant with the already-
adopted OSM+Leaflet free path (prefer OSM); Brave Search is redundant with Firecrawl/Exa/Tavily.
Security governance the research already states as mandatory: only an allow-listed set of servers
is reachable at all (the repo's `manager.ts` already mediates this); any filesystem-capable server
must be path-sandboxed; network-egress servers get an egress review; secrets travel via env, never
in a committed server config — `lib/config.ts`'s existing rule that a malformed `MCP_SERVERS` entry
fails the whole load rather than being silently skipped is exactly this discipline already applied
[D: `docs/mcp.md`].

### 6.2 Agent Skills — scored candidates, [R]: `research/auxiliary-arsenal/13_AGENT_SKILLS.md`

| Skill (to build internally, reusing `lib/platform/skills/`) | Trigger | Backing | Priority |
|---|---|---|---|
| `research-specialist` | evidence research | Firecrawl/Tavily/Exa + Maps | P0 |
| `media-generator` | image/video/3D request | Higgsfield (gated) | P0 |
| `visual-qa-judge` | post-render | Playwright + vision LLM | P0 (already exists in substance as the Forge critic) |
| `functional-assembler` | module request | Cal.com/Supabase/Stripe etc. | P0 (already exists in substance as `functionalModules.ts`) |
| `visual-archaeologist`, `design-token-compiler`, `a11y-scanner`, `perf-scanner`, `security-scanner`, `deploy-publisher` | various | Playwright/Style Dictionary/axe/Lighthouse/Semgrep/GitHub | P1 |
| `voice-generator` | audio request | local TTS default, ElevenLabs gated | P2 |

External skills: **ADOPT** Higgsfield's published skill and Firecrawl's agent-onboarding skill
(both real, published, vendor-maintained). **STUDY, never adopt** the `screenshot-to-code` skill
pattern — explicitly for the reason §3 exists: piping its output to production reintroduces
model-authored bytes with none of this repository's gates. **REJECT** any skill that would commit
secrets, run unsandboxed shell, pull remote code at call time, auto-publish without a human gate,
or claim to "generate the whole site" — the research corpus names this last category explicitly,
independent of and before knowing about §3's finding.

### 6.3 What the capability layer already gets right, confirmed against the research

`lib/capability/registry.ts`'s gate vocabulary (`none` / `human` / `no-model` / `never`) [V, read in
full] already implements the research's own repeated pattern: image editing and motion-media are
`human`-gated (matching the corpus's licence-trap warnings on Higgsfield/Runway/ElevenLabs free
tiers); audio and 3D generation are `never`-gated with the reasoning recorded inline, including a
live-priced candidate table **already citing this session's own research corpus by path**
(`registry.ts:229-234`, `256-268`, `279-284`, `296-300` all reference `C:\Users\40728\bf_research`
— meaning at least one prior session already began exactly this integration work for the
capabilities layer specifically. This document extends that same discipline to the rest of the
repository rather than re-deciding it).

---

## 7. Cost / economics model — status

| Element | Status |
|---|---|
| Per-capability cost estimates (routing hints, cents/M-tokens) | **EXISTS** — `lib/capability/models.ts`, explicitly labelled coarse routing estimates, not billing [D: `docs/capability-orchestration.md`] |
| Actual cost accounting from provenance | **EXISTS, WIRED** — `lib/capability/execute.ts` emits a `CostLine` per attempted step; `orchestrator.spend()`/`remainingCents()` accumulate across a run |
| Budget lease system (4 levels: job/stage/capability/request) | **PARTIAL** — `lib/cost/lease.ts` correct in isolation, zero production importers; the orchestrator's own budget-cents policy substitutes for it in practice |
| Site cost ledger (brief's Part 9 ask: "site A → 14 images → 1 video → … → total cost") | **MISSING** as a persisted artifact — the pieces exist (cost lines, per-capability provenance) but nothing currently writes a per-site cost summary to disk |
| €0-by-default policy | **EXISTS, ENFORCED** — `DEFAULT_POLICY` is `allowPaid:false, budgetCentsRemaining:0` [D: `docs/capability-orchestration.md`]; confirmed live on the one real end-to-end Forge proof run, which never selected a paid vendor |
| Research-corpus pricing for external capabilities | **EXISTS, extensive** — §2.1/§2.2, all VERIFIED/OBSERVED/UNKNOWN-marked, never fabricated |

---

## 8. Contradictions and discrepancies register

Per the brief's Part 2 instruction: preserved, not resolved.

| # | Discrepancy | Source A | Source B | Status |
|---|---|---|---|---|
| **X1** | Whether model-authored CSS/JS on the primary path is acceptable | Redteam C1 + the series' §1.3 invariant: no | `lib/forge/builder.ts`: yes, as the only path | **Unresolved — §3, founder decision** |
| **X2** | The experience/behavioral vocabulary | `docs/experience-architecture-v2.md` §3 (Tier-1/2, ADR-linked) | `lib/forge/experienceStrategy.ts` (independent 17-field schema) | **Unresolved — §5.3** |
| **X3** | Higgsfield video pricing | An earlier observation cited $15/$39 tiers | The auxiliary-arsenal corpus's own later pass calls this stale and gives Free/$19/$47/$99 as the verified figure | **Resolved within the research itself** — carried here so the correction isn't lost, not re-litigated |
| **X4** | Whether `main.ts`'s stage list is still authoritative for "the pipeline" | `ROADMAP.md` (2026-08-06) and `NEXT_SESSION.md` (2026-08-11) both still describe the classic pipeline as *the* roadmap | `PROJECT_STATUS.md` (2026-08-19) and `lib/forge/` describe a second, actively-developed surface neither onboarding doc mentions at all | **Stale documentation, not a technical conflict** — flagged in §10, not fixed here |
| **X5** | Whether `lib/workflow/hermes.ts`'s six stop conditions (per `ARCHITECTURE_V2.md` §U) are enforced | `ARCHITECTURE_V2.md` specifies them in a frozen order | The live `Hermes` class implements ceilings and survivability checks but no `transition()` method; the old `decide()` function (a different, older mechanism) is what actually runs | **Unresolved — the freeze's control-plane rewrite is half-built** |
| **X6** | Whether reconcept ever improves anything (freeze O-7) | Flagged open on 2026-08-14 | `candidates.ts` now exists and is wired, which makes this question **finally measurable** — but nothing has measured it yet | **Still open, now answerable** |

---

## 9. Decision log — open questions for the founder/user

Carried forward from `ARCHITECTURE_FREEZE.md` §1.3 (O-1…O-7, unchanged, not re-litigated here) plus
what this pass adds:

| # | Question | Why it matters | Who decides |
|---|---|---|---|
| **N-1** | Is `lib/forge/` the future primary pipeline, a permanent parallel offering, or an experiment to be either merged-under-the-invariant or retired? | Everything in §3 and §5.3 depends on this; it determines whether the next engineering session extends Forge, extends the classic pipeline, or reconciles both | Founder |
| **N-2** | If Forge continues as-is, does the repository's stated invariant (§1.3 of the architecture series) get amended, or does Forge get walled off with an explicit, documented exception? | An invariant with a silent exception is a convention, not an invariant — the redteam's own words about C1, now applying to a much larger surface | Founder |
| **N-3** | Should `ROADMAP.md` and `NEXT_SESSION.md` be retired in favor of `PROJECT_STATUS.md`, which has functioned as the actual running log since at least 2026-08-11? | A new contributor reading `ROADMAP.md` first would not learn Forge exists | Whoever owns onboarding docs — low stakes, easy to fix |
| **N-4** | Is the freeze's control-plane rewrite (Hermes/ledger/state machine) still wanted, given `candidates.ts` — arguably the highest-value single item — already shipped without it? | Determines whether the seven DISCONNECTED workflow modules get wired up or deleted | Whoever owns the workflow layer |
| **N-5** | Same question, QA gates: wire up `qa/gates/{accessibility,performance,technical}.ts` and `visual-regression.ts`, or fold their logic into the already-live `layout-audit.ts`/`distinctness-gate.ts` path instead? | Duplicated, half-wired QA surfaces are worse than one surface, chosen | Whoever owns QA |
| **N-6** (= freeze O-6, restated with new evidence) | Rights to redistribute a business's own social photographs | `lib/capability/registry.ts`'s `image_editing` row already names this as the sole blocker, with a researched, priced, ready-to-bind provider (Higgsfield) waiting on it alone | Founder + legal |

---

## 10. Implementation roadmap (updated against verified reality)

Phase numbers below are the freeze's own (`ARCHITECTURE_FREEZE.md` §4), annotated with what has
actually happened since.

| Phase | Freeze intent | Verified status, 2026-08-19 |
|---|---|---|
| **P0** | A/B floor-vs-director, best-so-far, close the C1 path | Best-so-far **shipped** (`candidates.ts`). The A/B was never run — still the single highest-leverage next step, and now more urgent, because it could also be pointed at Forge (§3) as a third arm |
| **P1** | Control plane: one state vocabulary, one ledger writer | **Half-built** — `state.ts` and `ledger.ts` exist, unwired (X5) |
| **P2** | Checkpoint/resume | **Half-built** — `resume.ts`/`hashes.ts` exist, unwired |
| **P3** | Routing, cost, concurrency | **Substantially superseded, in a good way** — `lib/capability/` does more than the freeze specified here, and is wired |
| **P4** | Quality: nine dimensions, lexicographic combination | **Partially wired** — `layout-audit.ts` and `jury.ts` live; `verdict.ts`'s lexicographic combiner exists but is reachable only through Forge |
| **P5** | Design Battle V2 | **Built twice, independently** — the classic pipeline has `diverge.ts`/`fingerprint.ts` wired via `stage.ts`; Forge has its own `battle.ts`. Neither is the other's Design Battle; see §5.3's pattern repeating |
| **P6** | Design Memory | **Built, unwired** (`designMemory.ts`) |
| **P7** | n8n: loop removed, human inbox only | Not independently re-verified this pass |
| **P8** | Media | `image_editing`/`motion_media` now have researched, priced candidate providers (§2.1, §6.3) waiting only on N-6 |

**What this session adds to the roadmap, not in the original phase numbering:**

- **P-fork** — resolve N-1/N-2 (§3) before any further Forge investment, one way or the other.
  Costs nothing to decide; costs real engineering time to keep deferring while both surfaces grow.
- **P-wire** — for each DISCONNECTED module in §4, either wire it into a production driver or
  formally retire it. A module reachable only by its own test is neither built nor not-built; it is
  a maintenance liability with test-suite cover that makes it *look* finished.
- **P-vocab** — reconcile §5.3's two experience vocabularies once P-fork is decided.

---

## 11. Top 10 highest-priority architectural changes — named, not implemented

In the order they unblock the most other work:

1. **Decide N-1/N-2** — what `lib/forge/` is, relative to the architecture's stated invariant. Blocks §3, §5.3, and half of §10.
2. **Run the Phase-0 A/B** — floor vs. director vs. (now) Forge, on the same 20 businesses, human-judged. Costs ~€1 and an afternoon; has veto power over most of the rest of this list, per the freeze's own reasoning, now extended to a third arm.
3. **Wire or retire the seven DISCONNECTED workflow/QA/memory modules** (`state.ts`, `ledger.ts`, `resume.ts`, `runner.ts`, `verdict.ts`'s reachability, `visual-regression.ts`, `qa/gates/*`, `designMemory.ts`) — each is a small, well-tested piece of work away from either mattering or being deleted.
4. **Finish `Hermes`'s `transition()` method or delete the new class** — a control-plane rewrite that is half-present is worse than the old `decide()` function it was meant to replace, because now two mechanisms exist and only one runs.
5. **Fix the `transition` boolean→enum gap (G1)** and the `venue` industry-classification gap (G13) — both small, both already named twice (once in `experience-architecture-v2.md`, once in `content-system.md`), both currently load-bearing for the platform's best output by accident rather than design.
6. **Settle N-6 (photo redistribution rights)** — it is the sole blocker on `image_editing`, which is otherwise fully researched, priced, and ready to bind (§2.1, §6.3).
7. **Build the site cost ledger artifact** (brief's Part 9 ask) — the accounting primitives all exist; nothing currently persists a per-site total.
8. **Reconcile the two Design Battle implementations** (`lib/design/diverge.ts` vs `lib/forge/battle.ts`) once N-1 is decided — building this twice, independently, is the same pattern as §5.3 at a different layer.
9. **Retire or clearly demote `ROADMAP.md`/`NEXT_SESSION.md`** in favor of `PROJECT_STATUS.md` — low cost, prevents the next session (human or agent) from onboarding into a five-day-stale picture of the repository.
10. **Adopt the P0 MCP/skill candidates one at a time, starting with Firecrawl and Playwright-MCP** (§6.1) — both are already the repo's own de facto choices for research and browser automation; formalizing them costs a credential and an allow-list entry, not new architecture.

---

## 12. Verification

- **Files created by this pass:** this document only —
  `BUSINESSFORGE_2.0_RESEARCH_INTEGRATION.md`.
- **Files modified:** none.
- **Application code touched:** none. No file under `lib/`, `agents/`, `scripts/`, `main.ts`,
  `test/`, `n8n/`, or any config file was opened for editing.
- **`.env` touched:** no — never opened, per the task's own constraint and this repository's spend-
  governance memory.
- **Credentials added:** none.
- **Production provider calls made:** none — every finding above is either static source reading or
  a report from a read-only research agent; no agent was authorized to run a script, install a
  dependency, or make a network call.
- **Existing research preserved:** all five prior `BUSINESSFORGE_2.0_*.md`/`ARCHITECTURE_FREEZE.md`
  documents, all `docs/*.md`, both `research/` trees, and `docs/knowledge/`/`docs/antigravity/` are
  unmodified and are cited above by path rather than reproduced.
- **Contradictions/gaps that remain, restated from §8/§9:** the Forge-vs-invariant fork (X1/N-1/N-2)
  is the one that matters; everything else in this document is either a wiring gap with a known fix
  or a documentation-staleness issue with no technical risk.

---

_End. Nothing implemented. The repository, its research corpora, and its dependency tree are
exactly as they were found._
