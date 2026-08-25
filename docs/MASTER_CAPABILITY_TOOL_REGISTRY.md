# MASTER CAPABILITY & TOOL REGISTRY

**Generated:** 2026-08-25 · **Companion file:** `docs/MASTER_CAPABILITY_TOOL_REGISTRY.json` (machine-readable)
**Audience:** any agent — Claude, ChatGPT, Copilot, or a human — that later works in this repository and needs to know what workforce already exists before building something new.

This document does not invent an inventory. Every capability-routing fact below was extracted **programmatically** from `lib/capability/registry.ts` and `lib/capability/bindings.ts` at build time — not hand-transcribed from prose — so it reflects the real, running chain the planner actually produces today, not what a document once claimed. Everything else (providers, runtime libraries, external tools, orchestration systems) is grounded in file paths read this session, cross-checked against six parallel research passes over the fourteen priority sources the task named, plus three external web searches. Every entry carries a status from the closed vocabulary `REAL_IMPLEMENTED | PARTIALLY_IMPLEMENTED | DOCUMENTED_ONLY | RESEARCHED | PLANNED | REJECTED | DEPRECATED | UNKNOWN`, and every external dependency carries a decision from `KEEP | INTEGRATE | FORK | REPLACE | SELF-HOST | BUILD_NATIVE | REJECT`.

Nothing below was deleted from prior documentation. This is a new synthesis layered on top of `docs/MASTER_INVENTORY.json` and the `BUSINESSFORGE_2.0_*` corpus, not a replacement for them.

---

## 1. The single biggest finding: the machine contract already exists

The task's FAZA 8 asks for a `resolveCapability("...")`-shaped seam so code can later ask for `image-generation`, `research`, `motion`, `3d`, `browser`, `qa`, and get back an executor. **That seam is already built, in production, today**: `lib/capability/orchestrator.ts`'s `createCapabilityOrchestrator().plan(capabilityId, overrides)`. Its own header comment states the exact call shape:

```ts
const plan = orchestrator.plan('craft_judging', { excludeProviders: ['gemini'] });
```

It returns a `CapabilityPlan`: an ordered `chain` of concrete, executable steps (best executor first, fallbacks after), an `excluded` ledger explaining every candidate that was dropped and why, a cost estimate, and a `plannable` flag. `lib/capability/execute.ts`'s `executeCapability` walks that chain, retrying the next step on failure. This already satisfies every bullet the task listed under "the router should choose": best executor, fallback if unavailable, another executor on rate/cost limits, a reviewer capability for verification (judgement capabilities are just another `CapabilityId`), and a repair path (Hermes's `decide()` plus the QA gate chain sit on top of the same seam).

The closed vocabulary behind it is `CapabilityId` — 37 string literals in `lib/capability/types.ts`, covering language, evidence, vision/media, semantic, measurement, and delivery/operations, which is exactly the category breadth the task asked for.

**What is genuinely missing** is not a machine contract — it's that the *classic* pipeline (the canonical one, per ADR 0008) still calls a separate, simpler router (`lib/ai/router.ts`'s `routeCapability`) instead of this one. See §4.

**Recommendation for every future agent touching capability routing:** extend `lib/capability/orchestrator.ts`'s `plan()`/`execute()` pair. Do not write a third parallel implementation.

---

## 2. AI providers (external AI)

Eight provider adapters are real, in-repo TypeScript files under `lib/ai/providers/`, matching `lib/ai/types.ts`'s `AI_PROVIDER_NAMES` exactly. Only `@anthropic-ai/sdk` is an actual npm dependency (`package.json`, confirmed by direct read); every other provider talks over raw `fetch`.

| Provider | Status | Bound to N capability slots | Test coverage | Notes |
|---|---|---|---|---|
| **gemini** | REAL_IMPLEMENTED | 12 (most-bound) | **17 tests, added 2026-08-25** (was none) | #1 executor for `reasoning` and `structured_generation`; licence class `free-tier-unverified` (O-3: commercial terms not settled) |
| **openai** | REAL_IMPLEMENTED | 10 | helper-level only | native schema enforcement, vision, embeddings |
| **anthropic** | REAL_IMPLEMENTED | 5 | **13 tests, added 2026-08-25** (wiring/ranking/error-mapping; streaming path deliberately left uncovered, see §7) | the repo's only real AI SDK dependency; #1 for `prose_writing`/`creative_direction` |
| **groq** | REAL_IMPLEMENTED | 4 | **real, fetch-stubbed behavioural test** | added 2026-08-24 specifically to remove Gemini as a single point of failure |
| **cerebras** | PARTIALLY_IMPLEMENTED | 4 | wiring-level test | deliberately ranked last among paid candidates — reachability fallback, not quality fallback |
| **openrouter** | REAL_IMPLEMENTED | 3 | probe test only | free open-weight seat, mainly used for `enum_direction` |
| **deepseek** | REAL_IMPLEMENTED | 3 | wiring-level test | cheapest paid seat in the catalogue; Design Battle's divergent third territory |
| **xai** | PARTIALLY_IMPLEMENTED | **0** | adapter-level test only | fully wired adapter, mechanically confirmed bound to **zero** of 37 capabilities |

The `xai` finding is mechanical, not an inference: a script imported `SERVICE_BINDINGS` directly and counted zero `provider === 'xai'` entries across all 41 model bindings in the table.

---

## 3. Capability routing matrix (code-grounded)

All 37 capabilities, their tier, gate, and real executor chain are in the JSON's `routing_matrix` array — extracted by importing `lib/capability/registry.ts` and `lib/capability/bindings.ts` directly rather than reading prose. A representative sample:

| Capability | Tier | Executor | Fallback chain | Deterministic floor | Terminal? |
|---|---|---|---|---|---|
| `reasoning` | core | gemini.frontier | groq → openai → openrouter → deepseek → cerebras | compose-baseline | yes |
| `structured_generation` | core | gemini.workhorse | openai → groq → anthropic → openrouter → deepseek → cerebras | reject-directive | yes |
| `creative_direction` | core | anthropic.frontier | openai → gemini → deepseek → groq → cerebras | derive-character | yes |
| `evidence_collection` | core | playwright-collector | firecrawl | — | **no terminal (fails loudly, by design)** |
| `craft_judging` | core | gemini.vision | openai.vision → anthropic.vision | uncertain (blocks delivery, F-07) | yes |
| `distinctness_judging` | core | fingerprint-l1l2 (deterministic-first!) | openai.vision → gemini.vision | fingerprint-terminal | yes |
| `audio_speech` | **rejected** | — | — | omit (F-18) | yes |
| `three_d_generation` | **rejected** | — | — | procedural-webgl | yes |

Two capabilities (`evidence_collection`, `pii_detection`, and a handful of the "measurement" group) have **no deterministic terminal** — the descriptor deliberately fails loudly rather than degrading, which is a documented safety property, not a gap.

`craft_judging` and `distinctness_judging` declare the same three vendors in *opposite* order on purpose, so a cross-vendor exclusion between the pair usually costs nothing — this is real, working design, confirmed in `bindings.ts`'s own header comment.

---

## 4. The one real duplication: two capability routers

- **`lib/capability/plan.ts`'s `planCapability`** (cost-aware: free-before-paid → cheaper-first → availability → latency → declared order) drives the **Forge reasoning modules** (`research.ts`, `grounding.ts`, `signature.ts`, `assetStrategy.ts`, `motion.ts`, `functionalModules.ts`), which ADR 0008 adopts into the canonical pipeline.
- **`lib/ai/router.ts`'s `routeCapability`** (availability/latency only, no cost dimension) drives the **classic pipeline** itself (`scripts/n8n/stage.ts` via `lib/factory/capabilities.ts`), which ADR 0008 names as canonical.

This is a genuine architectural split, not accidental duplication — but the two systems have never been reconciled into one. This registry does **not** merge them (that would be exactly the unjustified architecture change the standing rule prohibits) — it documents the split and recommends that any future unification treat `planCapability`/`orchestrator.plan` as the target shape, since it strictly dominates `routeCapability` on ranking dimensions.

A second, smaller duplication: **three job-stage vocabularies** (`main.ts`'s `STAGES`, `jobState.ts`'s `JobStage`, `stage.ts`'s own `STAGES` array) still coexist in production, despite `lib/workflow/state.ts` being purpose-built to unify them — it has zero production importers. Documented, not force-adopted.

---

## 5. Runtime primitives and libraries

`lib/design/experienceRegistry.ts` gates 14 executable primitives (scroll-reveal, text-reveal, magnetic-cursor, gsap-scrolltrigger, lenis-smooth-scroll, three-js-hero-object, horizontal-scroll, bento-card-tilt, cursor-reactive-webgl, marquee, image-hover-reveal, animated-counter, sticky-text-pin, menu-overlay) behind `RUNTIME_PRIMITIVE_BUDGET=2` — only two may activate per build, evidence-selected. Two more (pinned-cinematic-hero, world-crossing) are bundled **unconditionally**, outside that budget gate — flagged as a real gap, not a designed exception. Three are researched-not-integrated (screenshot-to-code-pattern, awwwards-teardown-corpus, higgsfield-media). One (midjourney-image-gen) is explicitly marked unsafe.

GSAP, Lenis, and Three.js are **not npm dependencies** — they are vendored as embedded source under `lib/runtime/vendor/`. GSAP's own vendored file header states it is "NOT MIT/OSI open source, despite being commonly described that way"; a web search this session (2026-08-25) corroborates via Webflow's own blog, GSAP's official licensing page, and CSS-Tricks that GSAP is nonetheless free including commercial use under its "Standard No Charge License," since Webflow's 2025 acquisition. Lenis and Three.js are genuinely MIT.

Playwright (`^1.49.1`) is the one other real npm dependency, driving evidence collection, screenshot capture, layout audit, and visual regression.

---

## 6. External tools — decisions

| Tool | Status | Decision | Why |
|---|---|---|---|
| GitHub Copilot | documented-only | KEEP | dev-tool, not a runtime capability |
| Claude / Cowork | real (as operator) | KEEP | operates this repo, not bound at runtime |
| Antigravity | documented-only | INTEGRATE | named patterns worth mapping to live code (gap G-ANTIGRAVITY-01) |
| n8n | REAL_IMPLEMENTED (code); live-instance status UNKNOWN | KEEP | generates real, importable n8n workflow JSON against a real n8n instance's API/CLI; `n8n/README.md`'s operational runbook (Docker container, node-typeVersion verification, activation curl) evidences it was built and run against a real n8n deployment, not just named after one (WQ-015, 2026-08-25) |
| Dify | REJECTED (confirmed, whole-word re-verified) | REJECT | zero real references repo-wide; a plain `dify` search false-positives on "Modify"/"identify"/"codify" — whole-word search + 4 independent prior audits agree (WQ-015, 2026-08-25) |
| Notion | unknown (no repo evidence) | REJECT | docs/knowledge/ already serves this role locally |
| MCP servers (generic) | planned | INTEGRATE | seam already exists in the type system, zero bindings populated yet |
| Higgsfield | researched | INTEGRATE | blocked on legal N-6, pricing discrepancy unresolved (gap) |
| Recraft | researched | REJECT | free tier is non-commercial-use only |
| ElevenLabs | researched | REJECT | free tier non-commercial; `audio_speech` already capability-rejected (F-18) |
| Suno | researched | REJECT | free tier non-commercial; no bound capability for music exists yet |
| OWASP ZAP | researched | REJECT | wrong tool for a static-HTML deployment target |
| Lovable | partially implemented | REJECT | `agents/lovableAgent.ts`'s `run()` throws `NotImplementedError`, confirmed by code |
| Devin / autonomous SWE agents | documented-only | REJECT | workshop tooling, not a runtime capability fit |
| Netlify | real | KEEP | real adapter (`lib/deploy/netlify.ts`), bound to `hosting` |
| Cloudflare Pages | documented-only | INTEGRATE | no adapter yet; recommended as a second hosting binding for redundancy |

---

## 7. The ten most important gaps (ranked)

1. **G-AI-01** (low, downgraded 2026-08-25) — RESOLVED to the honest limit of what's testable without SDK-internals risk. `gemini`: `test/ai/gemini-provider.test.ts` (17 tests, full behavioural coverage, mirrors `groq-provider.test.ts`). `anthropic`: `test/ai/anthropic-provider.test.ts` (13 tests — wiring, planner ranking, and real error-mapping via `health()`'s non-streaming request, exercising the SDK's own error classes). One narrow sub-gap remains by design: anthropic's `generate()` SSE-stream path was deliberately left uncovered rather than faked with a hand-reconstructed internal event format — see that file's header. Full suite (1436 tests) passes natively with no regressions.
2. **G-N6-LEGAL** (high, legal not technical) — rights to redistribute a business's own social-media photographs remain unresolved; blocks `image_editing`/`motion_media` from moving past their conservative defaults.
3. **G-XAI-01** (medium) — `xai` is fully wired and tested but bound to zero capabilities; the adapter cost was paid, the capability value was never realized.
4. **G-STAGE-01** (medium) — three job-stage vocabularies still coexist; the unification module built to fix this has zero adopters.
5. **G-RUNNER-01** (RESOLVED 2026-08-25) — `diverge`'s K=3 candidate battle now builds in parallel through `runPool`/`SerializedWriter`, with a shadow-directory isolation pattern so concurrent builds cannot interleave writes to the shared run root. New regression tests prove the underlying race was real and is now gone; verified natively (Windows, including `fs.symlink`) with 0 regressions.
6. **G-BATTLE-01** (medium) — `lib/forge/battle.ts`'s multi-candidate Design Battle is fully implemented but unreachable from the production entrypoint.
7. **G-MCP-01** (low-medium) — MCP is a fully-designed `ServiceKind` with zero populated bindings; a real seam sitting idle.
8. **G-ANTIGRAVITY-01** (low) — Antigravity's eight named patterns are not yet mapped one-to-one against live code.
9. **G-HIGGSFIELD-01** (low) — a pricing discrepancy between two internal research documents was not reconciled.
10. **G-HOSTING-01** (low) — Cloudflare Pages' current free-tier limits were not extracted to routing-ready numbers this pass (web search returned title/URL results only).

---

## 8. What must be done for BusinessForge to delegate work autonomously between executors

The routing mechanism (§1) is not the blocker — it already exists and is production-grade. The real blockers, in priority order, are: (a) closing the test-coverage gap on the two highest-traffic providers (G-AI-01), so failover decisions are based on evidence rather than an untested assumption; (b) reconciling the two-router split (§4) so a future capability addition has one obvious place to go, not two; (c) wiring the classic pipeline's stages to the richer `orchestrator.plan()` seam instead of the simpler `routeCapability`, once (b) is resolved — not before, since doing it first would be exactly the kind of large, unjustified architectural change the standing rule prohibits.

---

## 9. Verification

`npm run typecheck` and `npm test` were run after this registry was written, in both the cloud sandbox and natively on the Windows checkout, with the results recorded in the stage report delivered alongside this document. No production code was changed to produce this registry — it is a read-and-synthesize task, per the task's own FAZA 7 scope, plus the mechanical extraction script described in §"Methodology" of the JSON file (not committed — a one-off analysis tool, not a repository artifact).
