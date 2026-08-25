# BusinessForge — Reality Map

Status vocabulary used below (per instruction, not deduced from doc claims): **REAL/IMPLEMENTED** (code exists, is imported by a live path, has passing tests), **PARTIAL** (code exists and is imported, but a documented capability is missing or a branch is stubbed), **TEST-ONLY** (only test files reference it — never reached from a real entry point), **SCAFFOLD** (code exists, compiles, has its own tests, but zero non-test importers anywhere in the tree), **PLANNED** (named in docs, no code), **RESEARCH ONLY** (deliberately not for implementation), **DUPLICATE** (two implementations of the same responsibility), **DEPRECATED** (superseded, still present), **REJECTED** (evaluated and explicitly not adopted).

This map derives its statuses from `docs/MASTER_INVENTORY.md`'s evidence column — it does not re-run the audit, per instruction. It exists because the inventory mixes purpose/dependencies/target with status; this document isolates status alone so it reads at a glance.

## Entry points (both REAL, this is not a stub-vs-real split)

| System | Status | Why |
|---|---|---|
| `main.ts` classic CLI pipeline | **REAL/IMPLEMENTED** | 9 stages, all real handlers, capability-routed, Forge-gated enhance step. Gap: does not write `JobStage`/persist — see Job State Machine. |
| `scripts/n8n/stage.ts` job runner | **REAL/IMPLEMENTED** | 22-stage dispatcher, persists `JobStage` after every stage, resumable by job id via `loadJob`. This is the more complete of the two. |

## Control plane

| System | Status | Why |
|---|---|---|
| Unified "Control Plane" | **PLANNED** | Named in `ARCHITECTURE_FREEZE.md`/V2 docs, zero code. |
| De facto control plane (3-way split: `main.ts` / `stage.ts` / `hermes.ts`) | **REAL/IMPLEMENTED, fragmented** | Each piece works; nothing unifies them. Not a DUPLICATE — they don't do the same job, they do adjacent jobs with no shared owner. |

## Job state / persistence

| System | Status | Why |
|---|---|---|
| `jobState.ts` (`JobStage` type, `loadJob`/`saveJob`) | **REAL/IMPLEMENTED** | Written after every `stage.ts` stage; the one real persisted job model. |
| `lib/workflow/ledger.ts` | **SCAFFOLD** | Compiles, has its own test, zero non-test importers. |
| ~~`lib/workflow/resume.ts`~~ | **REMOVED (T02)** | Analyzed as a duplicate of the per-call skip check now built directly into `stage.ts`'s `runStage`; deleted with its test. See `docs/CONSOLIDATION_MAP.md`. |
| `lib/workflow/runner.ts` | **SCAFFOLD** | Zero non-test importers; may be a superseded draft of `stage.ts`'s own loop — needs a read before a final call, see Consolidation Map. |
| `lib/workflow/projections.ts` | **SCAFFOLD** | Zero non-test importers, no dashboard consumer exists. |
| `lib/workflow/candidates.ts` | **REAL/IMPLEMENTED** | Imported by `stage.ts`, `runJob.ts`. |
| `lib/workflow/state.ts` | **REAL/IMPLEMENTED** | Sole importer is `hermes.ts`, genuinely wired. |
| Job-stage vocabulary (3 enumerations: `main.ts` STAGES, `stage.ts` STAGES, `jobState.ts` JobStage) | **not DUPLICATE, correctly layered** | `JobStage` is the persisted identity; `stage.ts`'s STAGES is dispatch granularity beneath it; `main.ts`'s STAGES is a separate, non-persisting pipeline. The real defect is `main.ts` never touching `JobStage`, not three competing trackers of one thing. |

## Providers / capability

| System | Status | Why |
|---|---|---|
| `lib/capability/{orchestrator,plan,bindings,execute,invokers,models,registry,budget}.ts` | **REAL/IMPLEMENTED** | Live cross-vendor failover proven (`npm run capability-proof`), 37+ capabilities, gate policy enforced, `unpriced-blocked` gating correct after this session's Cerebras fix. |
| Anthropic, Gemini, OpenAI, OpenRouter, DeepSeek, Cerebras adapters | **REAL/IMPLEMENTED** | All capability-bound and exercised by tests; Gemini is the only one confirmed *live*-called in a proof run — the rest are real but not independently re-verified against a live endpoint this pass. |
| xAI (Grok) adapter | **REAL, one capability binding (`structured_generation`)** | Bound 2026-08-25 (`WORK_QUEUE.json` WQ-005) — narrow and deliberate, not the "zero bindings by design" state this row previously recorded; that prior decision used an exclusive-property test that never checked xai against the already-bound Anthropic seat on this one capability. |
| Groq | **PLANNED** | Rated highest free-tier find in research; no adapter code. |
| Mistral, Qwen, Kimi, GLM, Llama/HF | **RESEARCH ONLY** | Reachable via OpenRouter if ever needed; no dedicated adapter, none planned. |

## Hermes

| System | Status | Why |
|---|---|---|
| `lib/workflow/hermes.ts` | **REAL/IMPLEMENTED** | `decideOnly:true` asserted by test; deliver/escalate/continue decision only, no repair authority. |
| "Hermes as Control Plane" (rewrite proposal) | **REJECTED** | Would destroy the tested `decideOnly` separation for no demonstrated gain; see Consolidation Map. |
| "Hermes" the research/architect agent-role name | **REJECTED (name collision)** | Unbuilt; if built, must use a different name. |
| Nous Hermes / Higgsfield "Hermes Agent" | **N/A — not this project** | External references only, noted to prevent future confusion. |

## Forge

| System | Status | Why |
|---|---|---|
| Forge orchestrator, decide.ts gate | **REAL/IMPLEMENTED** | Wired into `main.ts`; ships candidate only on PASS verdict. |
| Forge writing modules (`builder.ts`, `repair.ts`) | **REAL/IMPLEMENTED**, flagged for a dedicated safety re-read | Closest point in the codebase to a model writing bytes directly; gated by `anti-ai-gate.ts`, not yet independently audited against the "no model emits code directly" invariant the way `no-agent-spawn.test.ts` audits the CLI autofix path. |
| Forge reasoning modules (research/grounding/signature/motion) | **REAL/IMPLEMENTED** | Capability-routed, deterministic-adjacent. |

## Design / Experience

| System | Status | Why |
|---|---|---|
| `agents/designDirectorAgent.ts` + `lib/design/directive.ts` | **REAL/IMPLEMENTED** | This session's fix (`directiveRuntimePrimitiveIds` no longer duplicates registry validation) confirmed the shape-extraction/registry-resolution seam is intentional and tested (`directorRuntimeSeam.test.ts`). |
| `lib/design/experienceRegistry.ts` | **REAL/IMPLEMENTED** | Single canonical runtime-primitive registry; Lenis/GSAP-ScrollTrigger/Three.js all `status:'exists'` with real vendored adapters — not evaluated-only as an older doc claimed. |
| `lib/forge/registryGate.ts` | **REAL/IMPLEMENTED** | Confirms Forge and the classic design pipeline now share one registry — a real reconciliation, not a remaining duplication. |
| CSS scroll-driven animations / View Transitions API | **RESEARCH ONLY** | Evaluated, not integrated; candidate to reduce reliance on vendored JS for simple cases. |

## Evidence / Provenance

| System | Status | Why |
|---|---|---|
| Discovery/Collector/Normalizer agents | **REAL/IMPLEMENTED** | |
| `lib/sources/*` (Places, Maps, Instagram) | **REAL/IMPLEMENTED, one caveat** | A 2026-08-19 401 on the Places API credential was reported and not re-verified since — PARTIAL until re-checked, treat the live-credential path as unconfirmed rather than assuming REAL. |
| `basis: quoted\|composed\|framing` tagging, `groundTestimonials`, `verifiedFacts`, `trustSignals` | **REAL/IMPLEMENTED** | |

## Candidates / QA / Security / Accessibility / Performance

| System | Status | Why |
|---|---|---|
| Forge candidate build, design divergence (`diverge.ts`/`fingerprint.ts`) | **REAL/IMPLEMENTED** | |
| `lib/qa/{visual-qa,jury,verdict,distinctness-gate,layout-audit,visual-regression,preflight}.ts` | **REAL/IMPLEMENTED** | One of the most mature subsystems in the repo. |
| `test/qa/no-agent-spawn.test.ts` | **REAL/IMPLEMENTED** | Statically proves no autonomous path reaches the Claude Code autofix patcher; resolves what older docs flagged as a critical open risk. |
| `lib/qa/gates/accessibility.ts` | **REAL, wired into preflight — not independently re-verified this pass** | One earlier doc found it disconnected, a later doc claimed it fixed; carried as-is, flagged for a quick re-check rather than asserted with full confidence. |
| `lib/qa/gates/performance.ts` | **REAL/IMPLEMENTED, deliberately non-blocking** | Tested decision, not a gap. |

## Asset pipeline

| System | Status | Why |
|---|---|---|
| `lib/forge/assetStrategy.ts` (real-vs-generated routing) | **REAL/IMPLEMENTED** | |
| Image/video/3D/audio generation providers | **REJECTED (deliberately)** | Gated `never`/`human` in the capability registry by design; not a gap, a cost-discipline decision. |

## Browser / Render

| System | Status | Why |
|---|---|---|
| Playwright capture (`lib/forge/browser.ts`, `lib/qa/layout-audit.ts`) | **REAL/IMPLEMENTED** | |
| `lib/render/*` deterministic renderer | **REAL/IMPLEMENTED** | Pure function, escapes everything, no JS by default. |

## Functional testing / CI

| System | Status | Why |
|---|---|---|
| `test/` (146 suites, 1366/1366 as of this session's native Windows run) | **REAL/IMPLEMENTED** | |
| CI pipeline | **not confirmed — treat as PLANNED/ABSENT** | No `.github/workflows` inspected this pass; if absent, cheap and high-value to add. |

## Knowledge / Research corpus

| System | Status | Why |
|---|---|---|
| `docs/knowledge/*`, `research/auxiliary-arsenal/`, `research/asset-stack/` | **RESEARCH ONLY** | Self-described "inert, do not implement"; extremely well organized, zero integration code, and should stay that way — not a gap. |

## External tools / integrations

| System | Status | Why |
|---|---|---|
| n8n `businessforge-workflow.json` (Control Surface, `bf-order`) | **REAL/IMPLEMENTED** | Canonical per README. |
| n8n `factory-v1.json` (Factory V1, `bf-factory`) | **DUPLICATE / DEPRECATED** | Superseded; README itself calls its `/stage/:name` path legacy. |
| Dify | **PLANNED (unevaluated)** | Zero mentions anywhere in repo or docs corpus; not classifiable further without a fresh decision. |
| Notion | **DEPRECATED as source of truth (by this document set's decision)** | Zero code integration; docs named it intended-canonical, but this inventory formally demotes it — see Consolidation Map. |
| GitHub Copilot | **REJECTED / ABANDONED** | One abandoned branch, `[FROM DOCS]`, not independently re-verified this pass. |
| MCP transports (`lib/platform/mcp/*`), skills scaffold (`lib/platform/skills/*`) | **SCAFFOLD** | HTTP transport implemented but never run against a live server; stdio declared only; 38 skills all `execute()` → `not_implemented`. |
| `agents/lovableAgent.ts` (deployment) | **SCAFFOLD (stub)** | Throws `NotImplementedError` when a key is actually configured. |
| `lib/deploy/netlify.ts` | **REAL, present but not confirmed wired as the default path** | PARTIAL — code exists, needs confirmation it's actually selected over the Lovable stub at runtime. |

## Specimens

| System | Status | Why |
|---|---|---|
| Bakery V2 (`lib/experience/`) | **REAL/IMPLEMENTED, deliberately quarantined** | Correctly isolated in code (one build script + one test import it), not just in docs — never generalize it into a template. |
