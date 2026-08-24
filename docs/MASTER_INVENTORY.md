# BusinessForge — Master Inventory (Unified)

**Status:** source of truth, superseding `docs/BUSINESSFORGE_MASTER_INVENTORY.md` (previous pass) as the canonical inventory. That file's findings are folded in here, not repeated at length; read it only for narrative context on how a finding was reached. This file is what future sessions (Claude, Copilot, or anyone) should read first.

**Method:** every row is either (a) verified this session or the prior session by direct repo inspection (import-graph grep, file existence, test run), tagged **[VERIFIED]**, or (b) carried from the doc corpus without a fresh code check, tagged **[FROM DOCS]** — treat (b) as lower-confidence until someone checks it. Repo state: branch `design-director-smoke`, HEAD `05d717a`, **1366/1366 tests passing** (confirmed prior session, native Windows run).

Columns: Name | Category | Purpose | Claimed status | Evidence | Location | Dependencies | Duplicate/overlap | Decision | Target location | Confidence

---

## 1. Control Plane

| Name | Purpose | Claimed status | Evidence | Location | Dependencies | Duplicate | Decision | Target | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| "Control Plane" (unified) | Sole owner of state/transitions/budget/retries/delivery/escalation | PLANNED (`ARCHITECTURE_FREEZE.md` F-02, `V2` §D) | `[FROM DOCS]` — no `CONTROL_PLANE_AUDIT.md` exists in the repo; the V2 doc itself says so | N/A | Hermes, JobLedger, capability router | N/A | **DOES NOT EXIST — build it, don't hunt for it** | New: thin coordinating layer over Hermes + job state, not a rewrite of Hermes | High (absence is well-confirmed) |
| De facto control plane today | Split across 3 places | REAL, fragmented | `[VERIFIED]` this session: `main.ts` (classic CLI runner), `scripts/n8n/stage.ts` (job/n8n runner), `lib/workflow/hermes.ts` (decision only) each own a slice | see rows below | — | **YES — 2 parallel runners** | **MERGE**: make `main.ts`'s classic path call into the same job-state/persistence `stage.ts` uses, or explicitly retire it as "quick/local mode, no resume" | `scripts/n8n/stage.ts`'s job model becomes canonical | High |

## 2. Orchestration

| Name | Purpose | Status | Evidence | Location | Dependencies | Duplicate | Decision | Target | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| Classic pipeline runner | discovery→collect→normalize→analyze→write→direct→design→render→enhance | **REAL / USED / TESTED** | `[VERIFIED]`: `main.ts:190` `STAGES` array, all 9 stages have real implementations, capability-routed | `main.ts` | agents/*, lib/design, lib/render, lib/forge (enhance) | Overlaps with `stage.ts`'s runner (different vocabulary, same underlying work) | **KEEP as the direct/CLI entry point**, but see Job State Machine row — must feed the same persistence | stays `main.ts`, gains job persistence | High |
| n8n-triggered job runner | create→intake→router→research→synthesize→source→analyze→write→build→direct→diverge→jury→assets→browser→layout→critic→gate→hermes→repair→preflight→report→experience-forge | **REAL / USED / TESTED** | `[VERIFIED]`: `scripts/n8n/stage.ts:102` `STAGES`, 22 stages, each with a real handler; persists `job.stage` using `JobStage` values from `jobState.ts` (`stage.ts:455,488,571...` confirmed writing `stage: 'created'/'research'/'evidence'/'character'/'content'/'creative'/'diverge'/'build'/'browser'/'visual-critic'/'distinctness-gate'/'hermes'`) | `scripts/n8n/stage.ts` | agents/*, lib/*, jobState.ts | Same as above | **KEEP as the canonical orchestrator** — this is the one that persists state, resumes by id, and is what n8n calls | canonical orchestrator | High |
| Capability orchestrator | Routes a capability request to a provider | **REAL / USED / TESTED** | `[VERIFIED]` prior session: `lib/capability/orchestrator.ts`, live cross-vendor failover proof (`npm run capability-proof`) | `lib/capability/orchestrator.ts` | `lib/capability/{plan,bindings,execute,invokers}.ts` | None found | **KEEP** — this is the one piece of "unify providers" that's already done right | unchanged | High |

## 3. Job State Machine

| Name | Purpose | Status | Evidence | Location | Duplicate | Decision | Target | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| `JobStage` (persisted) | The stage a job is actually recorded at | **REAL / USED / TESTED** | `[VERIFIED]` this session: 17-value union type, actively written by `stage.ts` via `saveJob` | `lib/workflow/jobState.ts:23-40` | Conceptually overlaps `main.ts`'s own 9-stage list and `stage.ts`'s own 22-value `STAGES` (different purpose: routing granularity, not persisted identity) | **KEEP as the one persisted vocabulary.** `stage.ts`'s `STAGES` const is fine to keep too — it's an internal dispatch table, finer-grained than `JobStage`, not a second persistence model. `main.ts`'s 9-stage list needs to either write into `JobStage` too, or be explicitly documented as never persisting job state. | `lib/workflow/jobState.ts` stays canonical for "what stage is this job at" | High |
| `lib/workflow/state.ts` | State helper consumed by Hermes | **REAL / USED** | `[VERIFIED]` this session: only importer is `lib/workflow/hermes.ts` — genuinely wired, not orphaned | `lib/workflow/state.ts` | None | **KEEP** | unchanged | High |

## 4. Ledger

| Name | Purpose | Status | Evidence | Location | Duplicate | Decision | Target | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| `lib/workflow/ledger.ts` | Append-only record of stage inputs/outputs/hashes | **SCAFFOLD — built, tested alone, zero real importers** | `[VERIFIED]` this session: import-graph grep found no non-test importer anywhere in the tree | `lib/workflow/ledger.ts` | Conceptually duplicates the ad-hoc history `jobState.ts`'s `JobState` object already carries as fields (`research`, `evidence`, `character`, etc. — a flat snapshot, not an append-only log) | **WIRE IT IN or DELETE IT.** Given the project's own stated requirement ("job → recorded stages → inputs hash → outputs → candidates → decision", "dacă inputurile nu s-au schimbat, etapa poate fi skipped") — this is a named product requirement, not a nice-to-have. Recommendation: **wire it in** (P0, see Implementation Gap). | Called from `stage.ts` after each stage handler | High |
| `lib/cost/ledgerEntry.ts` | Cost/spend record type | **REAL / USED** | `[VERIFIED]`: imported by `lib/cost/report.ts` | `lib/cost/ledgerEntry.ts` | **NOT the same thing as `lib/workflow/ledger.ts`** — different concern (money vs. stage provenance), naming collision only | **KEEP both, rename one to avoid confusion** — suggest `lib/workflow/ledger.ts` → `lib/workflow/stageLedger.ts` when it's wired in | see above | Medium (naming call, not a technical one) |

## 5. Resume

| Name | Purpose | Status | Evidence | Location | Duplicate | Decision | Target | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| ~~`lib/workflow/resume.ts`~~ | Content-addressed stage hashing; skip unchanged stages, rerun changed ones | **REMOVED (T02, commit `b6da711`/follow-up)** | `[VERIFIED]`: analyzed, found to duplicate the per-call skip check now in `runStage`, deleted along with its test after confirming zero other importers | — | Was a duplicate of the mechanism below | **REMOVED as a duplicate — do not recreate.** The skip-unchanged-stage goal is delivered directly inside `scripts/n8n/stage.ts`'s `runStage`: a per-call content-addressed hash check against `hashes.ts`'s `shouldSkip`/`loadStageLedger`, gated at the single dispatch point. See `docs/CONSOLIDATION_MAP.md`. | n/a | High |
| `loadJob`/`saveJob` (in `jobState.ts`) | Load/save a job snapshot by id | **REAL / USED** | `[VERIFIED]`: `stage.ts:440` calls `loadJob`, calls `saveJob` after every stage | `lib/workflow/jobState.ts` | None — the skip check reads the pre-stage job snapshot but persistence itself has one owner | **KEEP as the persistence primitive** | unchanged | High |
| `lib/workflow/runner.ts` | Generic stage-runner abstraction | **SCAFFOLD — zero real importers** | `[VERIFIED]` this session | `lib/workflow/runner.ts` | Possibly redundant with `stage.ts`'s own hand-written stage loop — needs a read before deciding wire-vs-delete | **DEFER** — read both once resume.ts/ledger.ts are wired, decide then whether `runner.ts` is worth adopting or should be deleted as a superseded draft | TBD | Medium |
| `lib/workflow/projections.ts` | Derived views of job state (e.g. dashboard reads) | **SCAFFOLD — zero real importers** | `[VERIFIED]` this session | `lib/workflow/projections.ts` | None found | **DEFER** — low priority, no product requirement currently names a dashboard | TBD | Medium |

## 6. Provider Pool

See `docs/PROVIDER_POOL_FINAL.md` for the full breakdown. Summary: `lib/capability/*` is the real, tested provider pool. **KEEP, extend** (add Groq — see Implementation Gap).

## 7. AI Providers

| Provider | Status | Evidence | Decision | Confidence |
|---|---|---|---|---|
| Anthropic (Claude) | REAL / INTEGRATED / TESTED | `[VERIFIED]` prior session | KEEP — frontier-quality worker | High |
| Google Gemini | REAL / INTEGRATED / TESTED / **only one ever live-called** | `[VERIFIED]` prior session (capability-proof run) | KEEP — €0 default; treat as a single point of failure until a second free-tier path (Groq) is actually exercised, not just coded | High |
| OpenAI | REAL / INTEGRATED / TESTED | `[VERIFIED]` prior session | KEEP — vision QA critic path | High |
| OpenRouter | REAL / INTEGRATED / TESTED | `[VERIFIED]` prior session | KEEP — anti-lock-in layer; `:free` membership needs a liveness probe (unbuilt) | High |
| DeepSeek | REAL / INTEGRATED / TESTED | `[VERIFIED]` prior session | KEEP — cost floor; jurisdiction (CN data residency) is an open policy question, not a code gap | High |
| Cerebras | REAL / INTEGRATED / TESTED, `priceConfidence:'estimated'` (fixed this session) | `[VERIFIED]` | KEEP — gated correctly behind `unpriced-blocked` unless explicitly allowed | High |
| xAI (Grok) | REAL adapter, **zero capability bindings by design** | `[VERIFIED]` prior session, explicit test asserts this | KEEP as-is — do not wire without a measured reason (matches research docs' own verdict: "no property BusinessForge needs that three other vendors lack") | High |
| Groq | **EVALUATED ONLY — no adapter exists** | `[FROM DOCS]` — research rates it the best free-tier find in the whole corpus | **ADD (P1)** — see Implementation Gap | Medium (pricing/limits may have moved since research was written) |
| Mistral, Qwen, Kimi, GLM, Llama/HF | EVALUATED ONLY | `[FROM DOCS]` | **DEFER** — reachable via OpenRouter already if ever needed; jurisdiction question blocks all CN-origin ones equally | Medium |

## 8. Hermes

| Name | Purpose | Status | Evidence | Decision | Confidence |
|---|---|---|---|---|---|
| `lib/workflow/hermes.ts` | Decide deliver/escalate/continue from gate verdict + iteration count, always `decideOnly:true` | **REAL / USED / TESTED** | `[VERIFIED]` prior session: `test/qa/p7-runjobfull.test.ts` asserts `decideOnly:true` explicitly | **KEEP — this is the one and only "Hermes" for this codebase going forward.** | High |
| "Hermes as Control Plane" | A ground-up rewrite giving Hermes ownership of all state/budget/retries | PLANNED ONLY (`ARCHITECTURE_FREEZE.md` F-02) | `[FROM DOCS]` | **REJECT the rewrite framing.** Extend the current narrow Hermes with a thin coordination layer instead (see Control Plane, row 1) — a full rewrite risks losing the clean `decideOnly` separation that's currently correct and tested. | Medium — this is a judgment call, not a fact |
| "Hermes" the internal agent-role label (research/architect) | Proposed name for a research agent in an unbuilt multi-agent design | PLANNED ONLY | `[FROM DOCS]` | **REJECT the name** — already collides with #1. If that role gets built, call it something else (e.g. `ResearchAgent`). | High |
| "The Nous Hermes agent" / Higgsfield's "Hermes Agent" | External, unrelated third-party references | N/A — not this project | `[FROM DOCS]` | **NOT THIS PROJECT'S CONCERN** — noted only to prevent future confusion | High |

## 9. Forge

| Name | Purpose | Status | Evidence | Decision | Confidence |
|---|---|---|---|---|---|
| Forge enhancement pass | Additive candidate build, ships only on PASS | **REAL / USED / TESTED** | `[VERIFIED]` prior session: `main.ts` calls `runExperienceForge`, gated by `shouldAttemptEnhance`/`shouldShipEnhancedSite` | **KEEP — this is the "deterministic render first, Forge as additive enhancement" shape the project's own vision names, already built.** | High |
| Forge's writing modules (`builder.ts`, `repair.ts`) | Model-authored HTML/CSS generation | REAL, but the one place a model comes closest to writing bytes directly | `[FROM DOCS]`, ADR 0008 | **KEEP, but audit against the "no model emits code directly" invariant** (same class of concern as the Claude Code autofix path, though the current gating via `anti-ai-gate.ts`/registry constraints is a real, different mechanism — not the same finding, don't conflate) | Medium — worth a dedicated read next session, not urgent |
| Forge's reasoning modules (`research.ts`, `grounding.ts`, `signature.ts`, `assetStrategy.ts`, `motion.ts`) | Deterministic-adjacent reasoning feeding the classic renderer | REAL / capability-routed | `[FROM DOCS]`, confirmed wired via capability router prior session | **KEEP** | High |

## 10. Design Director / Experience Intelligence

See `docs/EXPERIENCE_INTELLIGENCE_FINAL.md` for the full treatment. Summary: `agents/designDirectorAgent.ts` + `lib/design/directive.ts` is **REAL / USED / TESTED**; `runtimePrimitives` field (this session's fix target) is the one Director field that reaches the registry mechanically rather than staying advisory. **KEEP, extend the mechanically-applied field set gradually** — do not extend all 11 fields at once (ADR 0004's reasoning for staying narrow is still sound: closed-set choices, never raw measurements).

## 11. Evidence Intelligence

| Name | Location | Status | Decision |
|---|---|---|---|
| Discovery/Collector/Normalizer (Maps, site crawl, merge) | `agents/{discovery,collector,normalizer}Agent.ts` | REAL/USED/TESTED `[VERIFIED]` prior session | KEEP |
| `lib/sources/*.ts` (Places API, Maps listing, Instagram) | `lib/sources/` | REAL/INTEGRATED/TESTED, Places API live call unverified since a 401 in 2026-08-19 | KEEP; re-verify the Places API credential/scope before relying on it |

## 12. Provenance

| Name | Location | Status | Decision |
|---|---|---|---|
| `basis: quoted\|composed\|framing` tagging | `lib/content/evidence.ts` | REAL/USED/TESTED | KEEP — this is the working, simpler implementation of the doctrine `docs/knowledge/TRUTH_AND_EVIDENCE.md` describes in more elaborate (unbuilt) form |
| `groundTestimonials`/`verifiedFacts`/`trustSignals` | `lib/content/*.ts` | REAL/USED/TESTED | KEEP |

## 13. Candidate Generation

| Name | Location | Status | Decision |
|---|---|---|---|
| Forge candidate build (isolated dir, PASS-gated) | `lib/forge/orchestrator.ts` | REAL/USED/TESTED | KEEP |
| Design Battle / divergence (`diverge.ts`, `fingerprint.ts`) | `lib/design/{diverge,fingerprint}.ts` | REAL — wired into `stage.ts`'s `diverge` stage | KEEP |

## 14. Candidate Selection

| Name | Location | Status | Decision |
|---|---|---|---|
| `lib/workflow/candidates.ts` (`finalizeBest`/`recordCandidate`) | `lib/workflow/candidates.ts` | **REAL/USED/TESTED** `[VERIFIED]`: imported by `stage.ts`, `runJob.ts` (`resume.ts` removed as a duplicate, T02 — see `docs/CONSOLIDATION_MAP.md`) | KEEP — this is real, contrary to the general skepticism the docs cast on the workflow/ directory as a whole |
| `verdict.ts` lexicographic combination | `lib/qa/verdict.ts` | REAL/USED/TESTED | KEEP — blocking dims first, then quality, then distinctness; never a weighted sum |

## 15. Capability Registry

`lib/capability/registry.ts` — **REAL/USED/TESTED**, 37+ capabilities, gate policy (deterministic/model/human/never). **KEEP.**

## 16. Runtime Primitive Registry

`lib/design/experienceRegistry.ts` — **REAL/USED/TESTED.** Lenis, GSAP+ScrollTrigger, Three.js all `status:'exists', integrationMode:'runtime-primitive'`, real vendored adapters (`lib/runtime/`). `lib/forge/registryGate.ts` now imports this same registry — Forge and classic design pipeline share it. **KEEP as the one canonical registry** — this is already the "one registry, no provider-specific hardcoding" shape the project wants; nothing to consolidate here, just extend carefully (CSS scroll-driven animations / View Transitions API are evaluated-only and worth adding — free, native, would reduce reliance on vendored GSAP/Lenis for simple cases).

## 17. Asset Pipeline

| Name | Location | Status | Decision |
|---|---|---|---|
| Asset strategy (real-vs-generated routing) | `lib/forge/assetStrategy.ts` | REAL/USED — wired into `blueprint.ts`/`builder.ts` | KEEP |
| Image/video/3D/audio generation providers | none integrated | **EVALUATED ONLY**, all gated `never`/`human` in capability registry by design | **KEEP the gate.** Do not integrate a generation provider until a real business case demands it — this matches the project's own cost discipline. |

## 18. Browser / Rendering

| Name | Location | Status | Decision |
|---|---|---|---|
| Playwright capture | `lib/forge/browser.ts`, `lib/qa/layout-audit.ts` | REAL/USED/TESTED | KEEP — foundational, unquestioned across every doc |
| `lib/render/*` deterministic renderer | `lib/render/` | REAL/USED/TESTED | KEEP — pure function, escapes everything, no JS by default |

## 19. QA

`lib/qa/{visual-qa,visual-critic,jury,verdict,distinctness-gate,layout-audit,visual-regression,preflight}.ts` — **REAL/USED/TESTED.** KEEP all; this is one of the most mature subsystems in the repo.

## 20. Security

`lib/qa/gates/technical.ts`, escaping/safe-URL logic in `lib/render/`, `test/qa/no-agent-spawn.test.ts` (statically fences the Claude Code autofix path) — **REAL/USED/TESTED.** KEEP.

## 21. Accessibility

`lib/qa/gates/accessibility.ts` — **REAL, wired into preflight** `[FROM DOCS, MASTER_ARSENAL.md, not re-verified this pass]`. Blocking, per this project's own instructions. KEEP; worth a quick re-verify next session since one earlier doc found it disconnected before another later doc claimed it fixed.

## 22. Performance

`lib/qa/gates/performance.ts` — **REAL, wired, non-blocking (caveat only)** — deliberate, tested decision per this project's own instructions. KEEP as-is.

## 23. Functional testing

`test/` (146 suites, 1366 tests) — **REAL, comprehensive.** No CI pipeline confirmed wired (no `.github/workflows` inspected this pass) — worth checking; if absent, add one (P1, cheap, high value for a project this size).

## 24. Knowledge / Research

`docs/knowledge/*` (13 files, self-described "inert, do not implement"), `research/auxiliary-arsenal/`, `research/asset-stack/` — **RESEARCH ONLY**, extremely well-organized and useful as reference, zero lines of integration code. **KEEP as reference material.** Do not "implement" these wholesale — they were written to be selectively drawn on, not executed as a checklist. `docs/knowledge/KNOWLEDGE_INDEX.md` is the right entry point if a future session needs to pull a specific rule set (e.g. security, performance budgets).

## 25. External tools (general)

See §27-29 below and `docs/BUSINESSFORGE_MASTER_INVENTORY.md` §7 for the long tail (Firecrawl, Tavily, Cal.com, Stripe, Supabase, etc. — ~60 items, all EVALUATED ONLY, none integrated). No change to that assessment this pass.

## 26. n8n

| Name | Status | Decision |
|---|---|---|
| `n8n/businessforge-workflow.json` (Control Surface, `bf-order`) | **REAL/USED** | KEEP — canonical |
| `n8n/factory-v1.json` (Factory V1, `bf-factory`) | **REAL but DUPLICATE/legacy** | **REMOVE** once confirmed nothing depends on the `/stage/:name` CLI path it backs (P2 — confirm first, don't delete blind) |

## 27. Dify

**Zero mentions anywhere in the repository or the ~27,000 lines of docs read.** **Status: NOT EVALUATED IN THIS REPO** — cannot be classified further from available evidence. If it's meant to play a role, that decision needs to be made fresh, not inferred from anything here.

## 28. Notion

**Zero code integration.** Referenced across `PROJECT_STATUS.md`/`NEXT_SESSION.md`/`README.md` as the *intended* canonical status source ("BusinessForge HQ"). **Decision: DEMOTE.** Going forward, `docs/MASTER_INVENTORY.md` + `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (this document set) are the technical source of truth. Notion, if kept at all, is a human-facing status mirror, updated from these docs, never authored independently of them. This is stated as a decision per the instruction not to leave it open — reverse it explicitly if that's wrong, don't let it drift back into ambiguity.

## 29. MCP / agent integrations

`lib/platform/mcp/{httpConnector,manager,stdioConnector}.ts` — **SCAFFOLD.** HTTP transport implemented but never run against a live server; stdio transport declared, not implemented. `lib/platform/skills/*` — 38 built-in skills, all placeholders (`version 0.0.0`, `execute()` returns `not_implemented`). **DEFER** — real, well-structured scaffolding, but nothing here is load-bearing for the P0 goal (a real site out the other end). Don't invest further until the core pipeline gaps (Implementation Gap doc) are closed.

## 30. Deployment / publishing

`agents/lovableAgent.ts` — **STUB**, `NotImplementedError` when a key is actually configured. `lib/deploy/netlify.ts` exists. **This is the one stage standing between "site built" and "browser opens on a live URL," which is the project's own explicit end-to-end vision.** **Decision: REPLACE Lovable with the Netlify path** (already-coded, standard, no proprietary dependency) as the default deploy target — see Implementation Gap, P0.

## 31. Existing demo/specimen sites

| Name | Status | Decision |
|---|---|---|
| Bakery V2 (`lib/experience/`) | **REAL/TESTED, deliberately quarantined** | **KEEP exactly as-is — a specimen, never a template.** Zero import edges into the general pipeline except one build script + one test; raw WebGL2, not Three.js; do not generalize its bread-specific vocabulary. This boundary is already correctly enforced in code, not just in docs. |
| Other benchmark runs (Go Sweet Sibiu, River Park Drăgășani, Ridgeway Motors, Paradise Dental Care) | Output artifacts under `output/`/`benchmark*/`, not demos in the repo sense | **KEEP as regression reference material if still present; do not treat as templates either** | — |

---

## Cross-cutting note on confidence

Rows marked `[VERIFIED]` were checked by direct grep/import-graph inspection this session or the prior one — trust these. Rows marked `[FROM DOCS]` were not re-checked this pass; they carry whatever confidence the source doc earned (most of the doc corpus is unusually rigorous about citing evidence, but it is still not the same as a fresh check). When in doubt, re-verify before making an irreversible decision on a `[FROM DOCS]` row.
