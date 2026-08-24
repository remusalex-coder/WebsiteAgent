# BusinessForge — Implementation Gap

Strictly prioritized. P0 = blocks the factory end-to-end. P1 = needed for a real first product. P2 = quality/scaling. P3 = future.

---

## P0 — blocking

### P0-1. Wire the stage ledger into `stage.ts` — DONE (commit `c86330a`)
- **Correction:** `lib/workflow/ledger.ts` turned out, on inspection, to be a different, already-correctly-scoped module (the retry/rebuild/reconcept counters Hermes's ceiling checks read, per `ARCHITECTURE_FREEZE.md` §F-04) — not the input/output content-addressing this row originally meant. The actual persistence gap was in `lib/workflow/hashes.ts` (`AddressedStage`/`shouldSkip`, tested alone, never persisted). Fixed there instead: added `StageLedger`/`recordStage`/`loadStageLedger` (atomic write, in-process lock, same pattern as `candidates.ts`'s index file) to `hashes.ts`, and wired `recordStage` into `runStage`'s single dispatch point — every real stage completion or failure gets one merged ledger entry, without touching any of the 22 case bodies.
- **Acceptance:** met — see `test/workflow/hashes.test.ts` and `test/workflow/stageLedgerWiring.test.ts`.

### P0-2. Skip-unchanged-stage resume — DONE (commit `b6da711` + follow-up), `resume.ts` REMOVED as a duplicate
- **Correction:** `lib/workflow/resume.ts`'s `planResume` was analyzed and **not** wired in — it would have been a second, parallel resume system alongside the one below, which the standing rule explicitly forbids. Removed (`lib/workflow/resume.ts`, `test/workflow/resume.test.ts`); confirmed zero other importers before deletion.
- **What was actually built:** `runStage` computes this call's content-addressed input (`opts` + the pre-stage job snapshot) and checks it against the ledger entry P0-1 now stamps with `outputPath: 'job.json'`; a match skips the entire 22-case switch and returns `job.json` as-is. `hermes` is excluded (real repair work + owns the loop/nextStage signal). A fresh `runJobFullWith` invocation still always starts at `create` — there is no separate "which stage to resume at" planner; each stage decides for itself, so a killed-and-restarted run cheaply replays the whole sequence and every already-done stage no-ops.
- **One real gap found and fixed in the same pass:** `intake`'s result carries `providers.pool`, which `runJobFullWith` reads to drive the `research` fan-out — a naive skip left this `undefined`, silently dropping the entire research phase on resume. Fixed by recomputing `pool` (cheap, deterministic config resolution, no model call) on an `intake` skip specifically.
- **Acceptance:** met — see `test/workflow/stageLedgerWiring.test.ts` (fresh job, identical-call skip, changed-call rerun, intake-pool-on-skip, hermes-never-skipped, killed-and-restarted `runJobFullWith`, failed-stage recording).

### P0-3 / T04. Real deployment — DONE (commit pending, this pass)
- **Correction:** `agents/lovableAgent.ts` does **not** throw `NotImplementedError` — on inspection it already delegates entirely to `lib/deploy/netlify.ts`'s real Netlify "Drop" integration (zips `site/`, creates/reuses a site, uploads, polls, returns a live URL or a recoverable `skipped`/`failed` status). That was true before this pass and is unchanged; the actual gap was elsewhere. `main.ts`'s classic pipeline already reached it via `lovableAgent`. The **production** pipeline (`scripts/n8n/stage.ts`'s `runStage`/`runJobFullWith` — the "factory" loop T01–T03 all target) had no `deploy` stage at all: it had `preflight` and `report` but nothing in between that actually published anywhere, so a "delivered" job's `finalOutput` was only ever the local `site/` path `hermes`'s deliver branch set. "Browser opens on a live URL" was unreachable from that pipeline regardless of how a run went.
- **What was built:** a new `deploy` `StageName`, sequenced between `preflight` and `report` (never publish something the gate just blocked; the report should reflect the real outcome). Its case body calls the *same* `lib/deploy/netlify.ts` `deployToNetlify` `main.ts` already uses — no second deploy implementation. Skipped (no network call) when `job.decision !== 'deliver'`. A missing `NETLIFY_DEPLOY_TOKEN` is `status: 'skipped'`, never `failed` (the token's own established contract), and leaves `finalOutput` as the local site path. A real `status: 'failed'` downgrades the job to `decision: 'escalate'` and preserves the last-known-good local `finalOutput` — a deploy failure can never surface as a false DELIVERED status. A successful deploy overwrites `finalOutput` with the live URL. The result is always recorded to `qa/deployment.json` and surfaced in the `report` stage's summary. Being an ordinary stage at the single `runStage` dispatch point, it inherits T01's ledger recording and T02's skip-on-resume for free — a resumed job with an unchanged decision does not re-deploy.
- **Acceptance:** met for the reachable boundary — see `test/workflow/deploy.test.ts` (skip-on-non-deliver with zero network calls; skip-status with an explicitly forced-empty token, real code path, `finalOutput` preserved; resume-skip via T02 on a second identical call; the `report` stage surfacing the recorded status; a pre-T04 run with no deployment file reporting `null`, not a guess). The `status: 'live'`/`status: 'failed'` branches require a real Netlify account and network access; they are covered by `deployToNetlify`'s own never-throws contract (it catches its own network/API errors, tested implicitly by every call in this suite exercising the try/catch structure with the skip branch) rather than a live-network unit test, per the standing "no real credentials in tests" rule. A documented manual run with a real `NETLIFY_DEPLOY_TOKEN` is the way to verify the live path end to end; not run in this pass since no such credential is available to this agent (see the Final Report's remaining-work note).

### P0-4. `main.ts` classic pipeline feeds `JobState` — DONE (commit `7a79ef2`)
- **What was built:** `main.ts`'s generic `step()` helper (its own resume/persist mechanism, unchanged) now also calls `saveJob` after every stage — whether that stage actually ran or was loaded back from a resumed run's artifacts — via a `STAGE_TO_JOB_STAGE` best-fit map from this pipeline's nine stage names onto `jobState.ts`'s `JobStage`. A job is created (`saveJob` with no prior job on disk) before the first stage, identified by the Maps URL (the one thing known before `normalize` produces a business name). A successful run's terminal write records `stage: 'delivery'`, `decision: 'deliver'`, and `finalOutput` (the live URL, or the local `site/index.html` when no deploy target is configured). A failed run's `catch` records the error message onto the job's `errors` array before rethrowing — so a `main.ts` failure is visible on `JobState`, not only in the log file, and never silently leaves the job at `decision: 'running'` while claiming success.
- **No duplicate created:** no second job-state shape, no parallel persistence file — same `lib/workflow/jobState.ts` module `scripts/n8n/stage.ts` uses.
- **Acceptance:** met — see `test/main.jobstate.test.ts` (a resumed real run reaches `delivery`/`deliver` with a `finalOutput` and is reloadable by id; a run that fails partway records the error and never fabricates delivery). Both tests exercise real code — `enhance` really renders, `deploy` really calls `deployToNetlify` with an explicitly-forced-empty token, no mocks.

---

## P1 — needed for the first real product

### P1-1 / T05. Add a Groq adapter — DONE (this pass)
- **What was built:** `lib/ai/providers/groq.ts`, following the exact three-step extension `lib/ai/providers/index.ts` documents (adapter file, `AI_PROVIDER_NAMES`, one line in `ADAPTERS`) and the xai.ts/deepseek.ts template. Registered end to end: `lib/config.ts` (`DEFAULT_MODELS.groq`, `GROQ_API_KEY`/`GROQ_BASE_URL`), `lib/capability/orchestrator.ts` (credential map), `lib/capability/visionInvoker.ts` (explicit not-implemented case, text-only), `lib/capability/models.ts` (catalog entry), `lib/factory/pool.ts` (`DEFAULT_MODELS.groq`, added to `FREE_TIER`), `lib/capability/bindings.ts` (added to `reasoning`, `structured_generation`, `prose_writing`, `creative_direction` — ranked as a second free option right after Gemini, or after the native-schema pair for `structured_generation`).
- **Evidence, not assumption:** fetched live (2026-08-24) — `console.groq.com/docs/overview` (OpenAI-compatible base URL `api.groq.com/openai/v1`), `console.groq.com/docs/rate-limits` (OBSERVED real free tier: GPT-OSS models get 30 req/min, 1,000 req/day, 200,000 tokens/day on the no-cost Developer plan — the actual reason this addresses the single-point-of-failure flag), `console.groq.com/docs/structured-outputs` (OBSERVED native strict `json_schema` support, but only for `openai/gpt-oss-20b` and `openai/gpt-oss-120b` specifically — `defaultModel` is pinned to the 120b id for exactly this reason). Pricing is **not** from a primary source — `groq.com/pricing` is client-rendered and returned no rate table on a live fetch, the same gap this catalogue already documents for Cerebras — so the catalog's cost figures are a third-party-aggregated routing estimate only, correctly marked `priceConfidence: 'estimated'`, per the standing rule against promoting an unverified placeholder to a verified price.
- **Tests:** `test/ai/groq-provider.test.ts` — wiring (registration, catalog, default model, real free allowance); real fetch-stubbed behavioural tests (request shape including strict `json_schema`, response normalization, a 5xx→retryable error, a 4xx→non-retryable error, a timeout); and two real planner tests — Gemini's allowance exhausted fails over to Groq rather than straight to a paid vendor (the literal "failover from Gemini to Groq" acceptance criterion), and Groq's own exhausted allowance is `unpriced-blocked` exactly like Cerebras's until `allowUnverifiedPricingFor` names it. `test/capability/models.test.ts`'s "Cerebras is the one estimated entry" test was updated to include Groq (a real, evidence-grounded change — Groq's pricing has the same unverified-primary-source gap, not a hidden bug).
- **Not done in this pass:** a live call against a real `GROQ_API_KEY` (none available to this agent) — per this repository's own doctrine, an adapter's first real call is its test; that remains a manual/documented step, same status xai.ts/deepseek.ts already carry.

### P1-2. OpenRouter `:free` tier liveness probe
- **Gap:** free-tier membership on OpenRouter is coded but not probed for actual availability before use.
- **Why:** a `:free` model id can silently stop being free or stop existing; without a probe, the anti-lock-in layer can fail invisibly.
- **Files:** `lib/capability/orchestrator.ts` or a new `scripts/probe-openrouter-free.ts` alongside the existing `scripts/probe-*.ts` pattern.
- **Dependencies:** none.
- **Estimated complexity:** small.
- **Acceptance criteria:** a scheduled or pre-run probe confirms `:free` model availability; a stale/removed free model is caught before a job run depends on it.

### P1-3. Re-verify the Places API credential/scope
- **Gap:** a 401 was reported 2026-08-19 against the live Places API call, not re-verified since.
- **Why:** Evidence Intelligence's live-data path is unconfirmed; every downstream design/content decision depends on evidence being real.
- **Files:** `lib/sources/*` (Places integration).
- **Dependencies:** access to the actual API credential.
- **Estimated complexity:** trivial (one live call) to small (if the credential/scope is actually wrong and needs reissuing).
- **Acceptance criteria:** one successful live Places API call against a real business, logged, with the credential/scope documented for future reference.

### P1-4. Safety audit of Forge's writing modules (`builder.ts`, `repair.ts`)
- **Gap:** this is the closest point in the codebase to a model writing bytes directly to a customer artifact; it's gated by `anti-ai-gate.ts` but has never received the same static-proof treatment `no-agent-spawn.test.ts` gave the CLI autofix path.
- **Why:** the "no model emits code directly" invariant is a named security principle; one enforcement mechanism (the CLI path) is proven, the other (Forge) is only informally trusted.
- **Existing code to reuse:** `test/qa/no-agent-spawn.test.ts` as the pattern to follow (import-graph static analysis).
- **Files:** new `test/qa/forge-writing-bounds.test.ts` (or similar), `lib/forge/anti-ai-gate.ts`.
- **Dependencies:** none.
- **Estimated complexity:** medium — requires understanding exactly what invariant `anti-ai-gate.ts` currently enforces before a static test can prove it holds.
- **Acceptance criteria:** a new static test proves Forge's writing modules cannot bypass the anti-ai-gate constraints from any reachable code path; either it passes immediately (confirming existing safety) or it finds a real gap to fix.

### P1-5. Confirm CI pipeline exists, add one if not
- **Gap:** no `.github/workflows` inspected this pass; unconfirmed whether tests run automatically on push/PR.
- **Why:** cheap, high-value for a project this size and this test-count; prevents regressions from ever reaching `main` unnoticed.
- **Files:** `.github/workflows/test.yml` (new, if absent).
- **Dependencies:** none.
- **Estimated complexity:** small.
- **Acceptance criteria:** a push to the repo triggers `npm run typecheck` and `npm test`; a failing test blocks merge.

### P1-6. Extend mechanical registry grounding to one more Director field
- **Gap:** only `runtimePrimitives` has registry-grade enforcement; layout archetype and motion intensity remain advisory-only.
- **Why:** an advisory field can be silently ignored by the renderer with no test catching it — the same gap `runtimePrimitives` had before this session's fix.
- **Existing code to reuse:** `lib/design/experienceRegistry.ts`'s `resolvePrimitives` pattern as the template.
- **Files:** `lib/design/directive.ts`, `lib/design/experienceRegistry.ts` (or a new sibling registry for layout archetypes specifically).
- **Dependencies:** P1-4 should probably land first (same risk class, safety before extension).
- **Estimated complexity:** medium.
- **Acceptance criteria:** one additional Director field (recommend: motion intensity, lowest structural risk) has a registry-equivalent resolution step and a `directorRuntimeSeam.test.ts`-style test proving the seam.

---

## P2 — quality/scaling

### P2-1. Remove `n8n/factory-v1.json` after confirming no dependents
- **Gap:** legacy `/stage/:name` path, superseded by `businessforge-workflow.json`.
- **Files:** grep for `bf-factory`/`/stage/:name` callers first; delete `n8n/factory-v1.json` and `scripts/n8n/build-factory-workflow.ts` if none found.
- **Estimated complexity:** trivial once confirmed.
- **Acceptance criteria:** grep confirms zero external callers; file removed; n8n README updated to drop the reference.

### P2-2. Add CSS scroll-driven animations / View Transitions API to the runtime primitive registry
- **Gap:** evaluated only; would reduce reliance on vendored Lenis/GSAP for simple cases.
- **Files:** `lib/design/experienceRegistry.ts`, new `lib/runtime/scrollDriven.ts` adapter.
- **Estimated complexity:** medium.
- **Acceptance criteria:** at least one new registry entry with `status:'exists'`, a real adapter, and a test proving it resolves like the existing primitives.

### P2-3. Read `lib/workflow/runner.ts` against `stage.ts`'s hand-written loop and decide wire-in vs. delete
- **Gap:** deferred in the Consolidation Map pending this exact comparison.
- **Files:** `lib/workflow/runner.ts`, `scripts/n8n/stage.ts`.
- **Estimated complexity:** small (a read + a decision), then whatever the decision requires.
- **Acceptance criteria:** a written decision (in an ADR or an update to `docs/CONSOLIDATION_MAP.md`) with the reasoning, followed by either wiring or deletion — never left ambiguous a second time.

---

## P3 — future

### P3-1. Re-evaluate Dify if a concrete business reason ever appears
No action until a real use case is named — do not integrate speculatively.

### P3-2. Notion mirror
A read-only, generated-from-docs human dashboard, if the user wants one — never an independent source of truth again.

### P3-3. MCP transport completion / skills scaffold
`lib/platform/mcp/*` stdio transport, `lib/platform/skills/*` real implementations — well-structured scaffolding, not load-bearing for the P0 goal. Revisit only after P0/P1 close.
