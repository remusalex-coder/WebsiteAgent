# BusinessForge — Master Inventory

> **Note (2026-08-24, later same day):** a second, machine-readable inventory pass,
> `docs/MASTER_INVENTORY.json`, was generated later this same day after this narrative
> version, specifically to satisfy the MASTER RULE's FAZA 1 requirement for a
> machine-readable (not narrative) inventory across all 7 categories, and after T01–T10
> shipped. Where the two disagree, the `.json` file is the more recent pass. This
> narrative file remains useful for prose context and reasoning the JSON doesn't carry.

**Generated:** 2026-08-24, by direct code/test verification cross-referenced against ~27,000 lines of existing docs (top-level `BUSINESSFORGE_2.0_*.md`, `docs/`, `docs/knowledge/`, `docs/decisions/` ADRs, `docs/antigravity/`, `research/auxiliary-arsenal/`, `research/asset-stack/`).
**Method:** every claim below was checked against the actual repository (branch `design-director-smoke`, working tree as of this pass) and the test suite (**1366/1366 passing** at time of writing). Where a doc and the code disagree, **the code + tests are treated as the truth**, per instruction; the doc is noted as stale.
**Do not treat this file as static.** It replaces the need to read the ~15 sprawling planning docs listed above for "what's the current state" questions — but it is a snapshot, not a live view. Re-verify against code before relying on a status tag for anything load-bearing.

## How to read the status tags

- **USED** — reachable from a real entry point (`main.ts`, `scripts/n8n/stage.ts`, a shipped `npm run` script) and exercised by at least one non-trivial test.
- **INTEGRATED** — wired into the pipeline, has real code, may or may not have its own dedicated tests (distinguish from USED when it's structural, e.g. a registry entry, not a runnable flow).
- **TESTED** — has direct test coverage; combine with USED/INTEGRATED, doesn't stand alone.
- **PARTIALLY IMPLEMENTED** — code exists but a documented invariant/path is incomplete (e.g., declared-not-built patterns, an adapter with no live credential).
- **EVALUATED** — researched/priced/compared in `research/` but has zero lines of integration code.
- **ABANDONED** — was live or attempted, deliberately dropped (dead branch, deprecated file, explicit "reject" in a doc that code confirms was never built).
- **DUPLICATE** — two implementations of the same responsibility exist; one should absorb the other.
- **PLANNED ONLY** — described in a doc, zero code.

---

## 1. Executive summary — what actually changed since the docs were last touched

The doc corpus's own latest-dated entries are 2026-08-19 (`PROJECT_STATUS.md`'s 7th pass: 1160/1160 tests; `capability-orchestration.md`). **The code today is ahead of every doc in the repo** on several of the exact points those docs flagged as unresolved:

1. **The "two pipelines" fork is being actively closed, not just decided-on-paper.** ADR 0008 (2026-08-19) recorded the decision "classic pipeline stays canonical, Forge's reasoning gets adopted into it" but admitted every migration step except the first two was undone. As of this pass: `main.ts` **does** call `runExperienceForge` (`lib/forge/orchestrator.ts`) as an additive enhancement pass gated by `shouldAttemptEnhance`/`shouldShipEnhancedSite` (`lib/forge/decide.ts`), building into an isolated candidate directory and only shipping on a PASS verdict — exactly the "deterministic render first → Forge candidate as additive enhancement → deliver only on PASS" shape. This is real, current, and tested.
2. **The two competing "experience primitive" vocabularies are bridged.** `lib/forge/registryGate.ts` now imports `lib/design/experienceRegistry.ts` directly — Forge and the classic design pipeline read the same runtime-primitive registry. Not fully unified (see §5), but no longer two silent, disconnected schemas.
3. **Runtime primitives status has flipped from what the newest doc (`capability-orchestration.md`, 2026-08-19) says.** That doc's library register marks Lenis/Lottie/Rive/Spline **REJECTED**. Current code has a real, vendored, tested Lenis adapter (`lib/runtime/lenis.ts`, registry entry `status:'exists', integrationMode:'runtime-primitive'`) genuinely wired through `directiveRuntimePrimitiveIds` → `resolvePrimitives` → render. **Code wins**: Lenis is INTEGRATED today, not rejected. (This session also fixed two regressions in this exact code path — see `project_businessforge.md` in project memory / earlier session notes.)
4. **The Claude Code autofix risk (redteam Finding C1, ARCHITECTURE_FREEZE F-08) is already fenced, not just flagged.** `test/qa/no-agent-spawn.test.ts` is a real static import-graph-walk test proving (a) nothing under `lib/**` spawns a process, (b) no autonomous entry point can reach `patchWithClaude`, (c) the patcher is gated on an interactive TTY, not an env var a spawned process could inherit. This was the single most serious open safety finding across every audited doc; it is resolved in code today.
5. **Test count has grown from the docs' last recorded 1160 to 1366** (+206), across capability/pricing (`priceConfidence`, `unpriced-blocked`), design-director runtime-primitive plumbing, and other areas — i.e. there has been a full session of real, uncommitted work since the docs were last updated that the docs know nothing about.

**Conclusion for how to operate going forward:** the ~27,000 lines of existing planning docs are valuable *research and decision history*, but none of them is a reliable live status source any more — including the ones dated "latest." This inventory and its companion architecture doc are meant to become the thing that gets kept current instead; see §9.

---

## 2. Core pipeline — canonical, USED, TESTED

| Component | Location | Status | Notes |
|---|---|---|---|
| Discovery (Maps URL → `DiscoveryResult`) | `agents/discoveryAgent.ts` | USED / TESTED | Signed-out Maps scrape, €0. No reviews/photo-grid when signed out (proven limitation, not a bug). |
| Collector (site crawl) | `agents/collectorAgent.ts` | USED / TESTED | logo/hero/gallery/text/nav/services/emails/phones/socials. |
| Normalizer (merge → `BusinessProfile`) | `agents/normalizerAgent.ts` | USED / TESTED | |
| Business Analyst (`BusinessProfile` → `BusinessStrategy`) | `agents/businessAnalystAgent.ts` | INTEGRATED / TESTED, live-call unverified | Docs disagree with each other on whether this has ever been called with a real key (README's two internal tables contradict each other). Schema/typecheck-level verification is real; a real API round-trip is not independently confirmed by any doc. |
| Writer (`WebsiteContent`) | `agents/writerAgent.ts` | INTEGRATED / TESTED | Now routed through `lib/capability/` (cross-vendor failover), not a direct provider call — confirmed 2026-08-19 pass. |
| Design (`lib/design/`: character → experience → assets → conversion → interaction → script) | `lib/design/*.ts` | USED / TESTED | Deterministic, €0, no model call in the floor path. ADR 0006/0007 lineage. Known gap: `classifyIndustry` has no `venue` category (a real bug, not fixed as of this pass — worth checking on a next session). |
| Renderer | `lib/render/*.ts` | USED / TESTED | Pure function, deterministic (no clock/randomness, sorted JSON-LD), escapes everything, no JS emitted by default. Independently cross-validated by `docs/knowledge/SECURITY_KNOWLEDGE.md` and `WEBSITE_CAPABILITY_KNOWLEDGE.md`. |
| AI Design Director | `agents/designDirectorAgent.ts` + `lib/design/directive.ts` | USED / TESTED | 11 fields returned; only 2 (`direction`, `accessibilityLevel`) mechanically applied via `applyDirective` (ADR 0004, deliberate — "the Director chooses from closed sets, never supplies a measurement"). The rest is advisory/logged. `runtimePrimitives` field (new, this session) is the exception: shape-extracted and passed to the registry resolver, not just logged — see §5. |
| Content Director | `lib/content/{evidence,language,director,quality}.ts` | USED / TESTED | ADR 0007. Every emitted string tagged `basis: quoted\|composed\|framing`. Copy language follows evidence language (never translates facts). `auditContent` blocks on 12 defect classes. |
| Forge enhancement pass | `lib/forge/orchestrator.ts` + `lib/forge/decide.ts` | USED / TESTED | See §1.1 — now genuinely wired into `main.ts`, additive-only, ships only on PASS. |
| Capability router/orchestrator | `lib/capability/*.ts` | USED / TESTED | 37+ capabilities, real cross-vendor failover (verified live via `npm run capability-proof`, real $0 Gemini calls). This is the single most load-bearing new layer added 2026-08-19 and extended this session (Cerebras `priceConfidence`, `unpriced-blocked` gate — both fixed this session, see §8). |
| Hermes (decision layer) | `lib/workflow/hermes.ts` | USED / TESTED | Deliberately narrow: PASS→deliver, iteration≥maxIter→escalate, gate says escalate/deliver→escalate, else continue. Always called `decideOnly:true` — repair is a separate, later stage (`test/qa/p7-runjobfull.test.ts` asserts this explicitly). **This is the correct, current meaning of "Hermes" in this codebase — see §6 for the naming collision with three other uses of the same word.** |
| Preflight / gates | `lib/qa/preflight.ts`, `lib/qa/gates/{accessibility,performance,structuredData,technical}.ts` | USED / TESTED | Security + accessibility block delivery; performance is a caveat, not a blocker (deliberate, tested decision per this project's own instructions). `visualVerdict:'uncertain'` is a blocking condition, not a silent pass. |
| Visual QA / critic / jury | `lib/qa/{visual-qa,visual-critic,jury,verdict,distinctness-gate,layout-audit,visual-regression}.ts` | USED / TESTED | Real Playwright-driven capture; layout-audit tests need a matching Chromium `headless_shell` binary locally (see FAZA 1 note below — not a code bug, an environment-provisioning detail). |
| Repair | `lib/forge/repair.ts` | USED / TESTED | Constrained, not free-form — separate from the Claude-Code autofix path (§4). |
| Anti-AI-slop gate | `lib/forge/anti-ai-gate.ts`, `antiPatternSignals.ts` | USED / TESTED | Structural convergence check rewritten this era to compare against a real peer corpus, not a hardcoded baseline (fixed a real false-positive: a car-repair site was scoring "100% identical" to an unrelated bakery fixture). |
| Job state machine | `lib/workflow/{jobState,state}.ts` | INTEGRATED / TESTED, **DUPLICATE** | See §5 — two/three parallel stage vocabularies (`main.ts`'s own list, `JobStage` in `jobState.ts`, and `stage.ts`'s own) are documented as inconsistent (V2/FREEZE, 2026-08-14). Not re-verified this pass; flag for the next consolidation session rather than assumed fixed. |
| Candidates | `lib/workflow/candidates.ts` | **USED / TESTED** | Confirmed by direct import-graph check this pass: `stage.ts`, `runJob.ts`, and `resume.ts` all import `finalizeBest`/`recordCandidate` from it. Real. |
| Ledger / Resume / Runner / Projections | `lib/workflow/{ledger,resume,runner,projections}.ts` | **PARTIALLY IMPLEMENTED, confirmed DISCONNECTED** | Direct import-graph check this pass (not just citing old docs): zero non-test importers of any of these four files. `stage.ts` does have a working load/save path, but it goes through `jobState.ts`'s own `loadJob`/`saveJob` (line 440 of `stage.ts`), not through this more sophisticated content-addressed-hash `resume.ts` module. So a job *can* be re-loaded by run id today, but not via the mechanism these four files implement — that mechanism sits fully built, tested, and unused. **This is the single highest-confidence, highest-value next fix** — see §9. |
| Job state (`createJob`/`loadJob`/`saveJob`) | `lib/workflow/jobState.ts` | **USED / TESTED** | The actually-wired persistence path (both `runJob.ts` and `stage.ts` use it). `lib/workflow/state.ts` is imported by `hermes.ts` — also live, not disconnected. |
| n8n Control Surface | `n8n/businessforge-workflow.json` + `scripts/n8n/{build-workflow-json,stage,stage-server}.ts` | USED | Current, documented, active — `Order Webhook → Job Intake → Start Job → Poll Job → Summarise → Respond`, matches this project's own stated target exactly. Owns no decision logic; the loop lives in `runJobFull` host-side. |
| n8n Factory V1 | `n8n/factory-v1.json` + `scripts/n8n/build-factory-workflow.ts` | **DUPLICATE / legacy** | Older, bigger (1086 lines vs 149), different endpoint (`bf-factory` vs `bf-order`), different per-stage-call model. `n8n/README.md` itself calls it "the legacy `/stage/:name` path, used by the CLI and Factory V1" — i.e. already acknowledged internally as superseded by the Control Surface. **Recommendation: archive or delete once nothing depends on the legacy `/stage/:name` CLI path; confirm first (see §9).** |
| Bakery V2 | `lib/experience/*` (WebGL/scroll engine) | USED (as a specimen) / TESTED / **deliberately not generalized** | Confirmed by the project's own instructions as the one kept demo, for its 3D scroll-driven bread-baking sequence. Zero import edges into the general pipeline except one build script + one test — this is a design choice, not neglect. Built on raw WebGL2, explicitly **not** Three.js (contradicts one later doc claiming Three.js is used generally — that doc is about the general registry, not Bakery V2; the two never overlapped). |

---

## 3. Provider pool — AI models

All adapters live in `lib/ai/providers/`, routed through `lib/capability/`.

| Provider | Status | Notes |
|---|---|---|
| Anthropic (Claude) | INTEGRATED / TESTED | Default frontier-quality provider. No image/video/audio/embedding support — text+vision only. |
| Google Gemini | INTEGRATED / TESTED, **USED live** | The only provider ever actually called with a real credential and confirmed (2026-08-19 capability-proof run, $0 free tier). Everything else is code-complete but unexercised against a real key. Single point of failure risk flagged by one doc (Gemini is 1st-choice for reasoning, vision, and image fallback simultaneously under the €0 policy) — worth a real look before treating the free baseline as resilient. |
| OpenAI | INTEGRATED / TESTED | Vision QA critic path, `gpt-image` etc. Two real bugs found/fixed in this era: strict-schema `additionalProperties:false`, `max_completion_tokens` reasoning-reserve. |
| OpenRouter | INTEGRATED / TESTED | Anti-lock-in / free-tier failover layer. `:free` model membership is a moving target (promotional windows close) — flagged as needing a liveness probe, not confirmed done. |
| DeepSeek | INTEGRATED / TESTED | Cost floor for volume reasoning. Data residency (China) flagged as an open jurisdiction question for EU customer PII — not resolved in any doc. |
| Cerebras | INTEGRATED / TESTED | `gpt-oss-120b`. **This session's fix**: `priceConfidence` was mislabeled `'observed'` with a fabricated "verified" comment; restored to `'estimated'` (pricing genuinely unconfirmed) — this also fixed the two `unpriced-blocked` gate tests that depend on it. |
| xAI (Grok) | INTEGRATED, one capability binding | Bound 2026-08-25 (`WORK_QUEUE.json` WQ-005) to `structured_generation` only — native schema enforcement, cheaper than the already-bound Anthropic seat on both axes. Was previously "orphaned until deliberately wired"; this is that deliberate wiring, not a blanket bind — `ALL_BINDINGS.filter(b => b.provider === 'xai').length === 1`, confirmed by a dedicated test. |
| Groq | **EVALUATED, not integrated** | No adapter exists. Research docs rate it the best free-tier find of the whole review (300-1000 tok/s, generous free daily quota) — a real, low-cost candidate for a next session, not a rejected idea. |
| Mistral, Qwen, Kimi/Moonshot, Zhipu GLM, Llama/HF | EVALUATED only | No adapters; reachable via OpenRouter if ever needed. Jurisdiction (EU vs CN) is the explicit blocking decision across all of these — never resolved. |

---

## 4. Coding/implementation agents (workshop tools — never product-path)

| Tool | Status | Notes |
|---|---|---|
| **Claude Code** (the CLI this repo has been built with) | USED, workshop-only, **safety-fenced** | The one place it touches a delivered artifact: `scripts/visual-qa.ts --autofix`, spawns Claude Code with `Read,Edit,Write` inside the rendered site, gated on a real interactive TTY + human confirmation. `test/qa/no-agent-spawn.test.ts` statically proves no automated path can reach it. This was flagged as the single most serious red-team finding in the whole doc corpus (Finding C1) — **it is resolved in code, not just documented as a rule.** |
| GitHub Copilot | **ABANDONED as a code contributor** to this specific line of work; **EVALUATED only** as a general coding-agent option | Only trace in the repo: the dead branch `origin/copilot/inspect-repository-codebase`, cherry-picked once (ADR 0001) for the Design Director port, then explicitly left unmerged/superseded. Its A/B test harness (`FALLBACK_DIRECTIVES`) was deliberately excluded and its 5-business A/B results were flagged **"must not be cited as evidence about any model."** Separately, research docs discuss Copilot only in the abstract, as one of five coding agents to "collapse to one primary + one second opinion" for workshop use — never adopted, never rejected outright, just not chosen yet. |
| OpenAI Codex | EVALUATED only, workshop-only if ever adopted | Same "collapse coding agents" recommendation as Copilot; not implemented either way. |

**Recommendation:** if Copilot is meant to do real implementation work going forward (per the earlier project brief's mention that Copilot Pro is in active use), the honest current state is that it has contributed exactly one abandoned branch to the actual `WebsiteAgent` codebase. Nothing needs "absorbing" — there's nothing there to absorb. If Copilot is going to be a real "implementation worker" in the target architecture (§ architecture doc), that's a role to assign going forward, not a capability to migrate from existing code.

---

## 5. Runtime primitives / motion-experience layer

| Primitive | Status | Notes |
|---|---|---|
| Lenis (smooth scroll) | **INTEGRATED / TESTED** | Real vendored adapter (`lib/runtime/lenis.ts`, `lib/runtime/vendor/lenisSource.ts`), registry entry `status:'exists'`. **Contradicts the newest doc** (`capability-orchestration.md`, 2026-08-19) which lists it REJECTED — code is newer and wins. Disabled outright on coarse pointer (phones get native momentum scroll, never a degraded Lenis — a deliberate adapter guard, not an aspiration). |
| GSAP + ScrollTrigger | **INTEGRATED / TESTED** | Vendored (`lib/runtime/vendor/gsapSource.ts`, `gsapScrollTrigger.ts`). Docs agree this should be adopted only when a named `transition` value provably can't be expressed in CSS — confirmed as the actual gating logic in code, not just a rule of thumb. |
| Three.js (hero object) | **INTEGRATED / TESTED** | Vendored (`lib/runtime/vendor/threeSource.ts`, `threeHero.ts`), real ES-module integration (not string concatenation — flagged in docs as the one primitive requiring special build handling, confirmed present). Distinct from Bakery V2, which deliberately uses raw WebGL2 instead. |
| `directiveRuntimePrimitiveIds` (Director → registry seam) | USED / TESTED | **This session's second fix**: was duplicating registry validation that belongs solely to `resolvePrimitives` (`lib/design/experienceRegistry.ts`), which broke the defensive-cap test and violated the function's own documented contract. Fixed — extraction is now shape-only (dedup + malformed-drop + cap at 2× budget); `resolvePrimitives` alone decides real/executable/in-budget. |
| Rive, Lottie, Spline | **EVALUATED, deliberately not integrated** | Consistent REJECT across every doc that discusses them — no derivation path from business evidence (hand-authored assets, not autonomous). Not a gap; a deliberate boundary. |
| Locomotive Scroll | **ABANDONED / explicitly forbidden** | Unmaintained; Lenis is its confirmed replacement everywhere it's mentioned. |
| magnetic-cursor, scroll-reveal, text-reveal | INTEGRATED (deterministic, no external library) | `deriveRuntimePrimitives` in `lib/design/experience.ts` — priority-ordered, budget-capped (`RUNTIME_PRIMITIVE_BUDGET = 2`). Earned by architecture properties (motion intensity, narrative mode, a real transition), not by AI free choice. |
| CSS scroll-driven animations / View Transitions API | **PLANNED ONLY** | One research doc (`REGISTRY_REVIEW.md`) recommends these native-browser primitives should materially reduce reliance on GSAP/Lenis (~84% global support). Not adopted in code yet. Worth a look — it's free and may shrink the vendored-library surface. |

---

## 6. External tools / platforms — the FAZA 3 explicit checklist

### Hermes — four different things share this name; do not conflate them

1. **`lib/workflow/hermes.ts`** — the real, current, tested decision layer in this codebase (deliver/escalate/continue, decide-only). This is "Hermes" in every architecture conversation about *this* project going forward. **USED / TESTED.**
2. **"Hermes" as an internal agent-role label** in `research/auxiliary-arsenal/12_MCP_ECOSYSTEM.md` — a proposed name for a research/architect agent role (uses Firecrawl/Exa/GitHub/etc.) in a *different*, purely conceptual multi-agent design that was never built. **PLANNED ONLY**, and arguably superseded by #1 already existing under the same name with a different job.
3. **"The Nous Hermes agent"** — an *external* AI system, unrelated to this repo's code, whose own output folder (`C:\Users\40728\bf_research\`) was used once as a reference research corpus when reconciling the Experience Arsenal V2 docs (2026-08-19, 6th pass). Not a component of BusinessForge at all — a data source, used once, not integrated.
4. **Higgsfield's own product** has an agent in its own UI literally named "Hermes Agent" (`research/auxiliary-arsenal/07_VIDEO_ASSETS.md`) — a third party's internal naming, coincidental, not connected to this project.

**Recommendation:** rename #2 if it's ever built, to avoid a fifth collision; when the user or any doc says "Hermes," default to meaning #1 unless context clearly says otherwise.

### Claude / Claude Code
Covered in §3 (Anthropic API — CORE provider) and §4 (Claude Code — workshop-only, safety-fenced). No further action needed beyond what's already fenced.

### ChatGPT / OpenAI
"ChatGPT" as a brand is never used anywhere in the codebase or docs — always "OpenAI" (the API/vendor). Covered in §3. **USED / TESTED / INTEGRATED.**

### GitHub Copilot
Covered in §4. **ABANDONED** (one dead branch) as a contributor to this repo; **EVALUATED only** as a general tool.

### n8n
Covered in §2. Two workflow files exist — the Control Surface (current) and Factory V1 (legacy). **USED**, with one **DUPLICATE** to clean up.

### Dify
**Zero mentions anywhere** in the repository — not in code, not in any of the ~27,000 lines of docs read across six parallel audits, not even in the external-tool research folders that catalog dozens of far more obscure vendors. If Dify was evaluated, that evaluation happened entirely outside this repository (a chat conversation that was never written down) and has left no retrievable trace. **Status: unable to classify from repo evidence — treat as not evaluated until told otherwise.**

### Notion
**Zero code integration.** Extensively *referenced* — `PROJECT_STATUS.md`, `NEXT_SESSION.md`, and `README.md` all point to "BusinessForge HQ (Notion)" as the *canonical* status/roadmap/decision-log source, explicitly describing the in-repo docs as secondary technical reference. This means: the actual single source of truth this project has been trying to maintain has, for some period, been a Notion workspace outside this repository entirely — which is very likely a direct contributor to the "everything scattered across chats, nothing documented anywhere I can find" problem this consolidation pass was asked to fix. **Recommendation: either (a) this repo's `docs/` becomes the real source of truth going forward (this inventory + the architecture doc, kept current) and Notion is explicitly demoted to a human dashboard/mirror, or (b) if Notion must stay canonical, it needs a real sync mechanism, not two people/agents updating two places by hand.** This is a product decision, not a technical one — flagging it, not deciding it.

### Google Maps / Places
**INTEGRATED / TESTED**, real evidence source (`lib/sources/{placesApi,mapsListing,instagramProfile}.ts`). Signed-out Maps scrape is the €0 default (proven: no reviews/photos when signed out). Places API is the paid, richer path — one live call in the docs' history returned `401 UNAUTHENTICATED` (wrong API scope) and was flagged "unverified against the live API" as of 2026-08-19; not re-verified this pass. A **Google Maps MCP server** was separately evaluated and explicitly rejected as redundant — OpenStreetMap+Leaflet is the actual shipped embed feature, not Google Maps embeds.

---

## 7. Everything else evaluated but not integrated (from `research/auxiliary-arsenal/` + `research/asset-stack/`)

This is a large, well-organized, genuinely useful vendor-research corpus (~60 files) covering image/video/3D/audio generation, functional integrations (booking, payments, search, auth, CMS, CDN, analytics), MCP servers, and agent skills. **None of it has any integration code today** — every single item in this section is **EVALUATED only**. Highlights, by how close each is to being worth adopting:

- **Ready to adopt cheaply** (P0-rated, free/near-free, no license traps found): Firecrawl, Tavily, Cal.com, OpenStreetMap+Leaflet, Fuse.js, Web3Forms, Supabase Auth, Cloudflare R2, FFmpeg/Sharp, Plausible, Higgsfield MCP, Axe MCP, Playwright/Puppeteer MCP.
- **Rejected with clear, still-valid reasons** — do not re-evaluate without new evidence: Midjourney (no API), Locomotive Scroll (deprecated, superseded by Lenis which is now actually integrated), generic "AI website builder" SaaS (defeats the whole point of this project), Anima/Locofy design-to-code (black-box, defeats determinism), unsandboxed filesystem MCP, OWASP ZAP / Snyk / Perplexity / Bunny.net / Brave Search (each has a specific, documented reason, not just "seemed unnecessary").
- **Real, unresolved licensing traps flagged** (worth re-checking before ever using, even free tier): Recraft (free-tier images aren't yours), ElevenLabs and Suno (free tier is non-commercial), several local model weights (FLUX and derivatives vary by variant).
- **Everything video/3D/audio generation** (Runway, Veo, Kling, Meshy, Tripo, ElevenLabs, Suno) is deliberately gated `never`/`human` in `lib/capability/registry.ts` — evidence-gated by design, not an oversight.

---

## 8. This session's fixes (verified, not just claimed)

Confirmed today via a clean native-Windows `npm install` + `npm run typecheck` + `npm test`: **1366/1366 pass, 0 fail.**

1. `lib/capability/models.ts` — Cerebras `gpt-oss-120b` `priceConfidence` restored from a fabricated `'observed'` to the honest `'estimated'`; original comment (pricing genuinely unverified) restored.
2. `lib/design/directive.ts` — `directiveRuntimePrimitiveIds` no longer duplicates registry validation that belongs to `resolvePrimitives` alone; now shape-only extraction + dedup + defensive cap, matching its own docstring.
3. `.cowork-tmp*`, `_to_delete/`, and a stray malformed-filename artifact (`how --stat --oneline 05d717a`) — removed from the working tree; none were repo content.
4. `node_modules` reinstalled clean, natively on Windows (the platform this repo actually runs on) — the prior `esbuild` platform mismatch that broke test runs through a Linux-VM bridge is not present when running directly on the host, confirmed.

---

## 9. What should happen next (recommendation, not yet executed — see the architecture doc for the target shape)

Ranked by value ÷ risk, cheapest first:

1. **Adopt this pair of documents as the real source of truth**, and stop treating `PROJECT_STATUS.md`/`NEXT_SESSION.md`/Notion as canonical going forward — or explicitly decide Notion stays canonical and build a real sync step. Either is fine; leaving it undecided is what caused the current mess.
2. **Wire `lib/workflow/{ledger,resume,runner,projections}.ts` into `runJob.ts`/`stage.ts`, or delete them if the simpler `jobState.ts` load/save path is judged sufficient.** Confirmed by direct import-graph check this pass (not inference from old docs): these four files have zero real importers today. `stage.ts` can reload a job by id via `jobState.ts`'s own `loadJob`, but not through the content-addressed-hash resume mechanism these four files were built for — that mechanism is fully built, individually tested, and simply never called. This is the single highest-confidence finding in this whole inventory (verified live, not cited from a stale doc) and the highest-value next fix: "resume" is a named requirement in the project's own vision, and right now it's unclear whether an interrupted job actually survives cleanly.
3. **Verify the job-stage-vocabulary duplication** (`main.ts`'s own stage list vs. `JobStage` vs. `stage.ts`'s list) is still real, and if so, pick one and delete the others — this was independently confirmed by three docs (2026-08-14) and never claimed fixed since.
4. **Decide the fate of `n8n/factory-v1.json`** (legacy) — confirm nothing still depends on the `/stage/:name` CLI path, then archive or delete it, rather than carrying two n8n workflows indefinitely.
5. **Groq adapter** — cheapest, best-reviewed, currently-missing provider; a real candidate for the next provider added, ahead of anything else on the evaluated-only list.
6. **`classifyIndustry`'s missing `venue` category** — a named, specific, still-open bug (a whole business category can only reach narrative mode "by accident").

None of these were implemented in this pass — each touches live orchestration/state code and deserves its own focused session with its own test run, not a rushed change bundled into a documentation pass.
