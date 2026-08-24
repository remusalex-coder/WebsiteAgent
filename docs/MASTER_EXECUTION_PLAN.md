# BusinessForge — Master Execution Plan

Executable tasks for Claude Code, Copilot, or any future agent. Each task is self-contained and concrete — no task says "improve AI" or similar. Sequenced so each task's "Next task" chains to the next; parallel tasks are noted where order doesn't matter. Derived directly from `docs/IMPLEMENTATION_GAP.md` — read that doc's Why/Existing-code-to-reuse columns for rationale this plan doesn't repeat.

**Before starting any task:** run `npm run typecheck && npm test` and confirm 1366/1366 (or the current baseline) passes. **After finishing any task:** run the same and confirm no regression before moving to the next task.

---

### T01 — Rename and wire the stage ledger
- **Goal:** every `stage.ts` stage completion produces a real ledger entry.
- **Files:** `lib/workflow/ledger.ts` → rename to `lib/workflow/stageLedger.ts`; update its own test file's import path; `scripts/n8n/stage.ts` (add a call after each stage handler resolves).
- **Dependencies:** none.
- **Implementation:** rename the file (git mv), fix the import in its test, then in `stage.ts` add one call per stage handler completion: `await recordStageEntry(jobId, stageName, inputHash, outputRef)` (function name/signature per what `stageLedger.ts` already exports — do not redesign its API, just call it).
- **Tests:** extend `test/workflow/*` (or add `test/workflow/stageLedger-integration.test.ts`) asserting a full job run through `stage.ts` produces one ledger entry per stage with a non-empty input hash and output reference.
- **Acceptance criteria:** new integration test passes; existing `ledger.ts`/`stageLedger.ts` unit tests still pass unmodified in substance (path updated only).
- **Next task:** T02.

### T02 — Skip-unchanged-stage resume — DONE (commit `b6da711` + follow-up)
- **Goal:** re-running a job with unchanged inputs for a stage skips real work for that stage and reuses the last recorded output.
- **Resolution:** `lib/workflow/resume.ts` (`planResume`) was analyzed and **removed as a duplicate**, not wired in — a separate up-front "which stage to resume at" planner would have been a second resume system alongside the per-call skip check below, which the standing rule forbids. Instead, `runStage` itself computes this call's content-addressed input hash (`opts` + the pre-stage job snapshot) and checks it against the ledger entry T01 stamps with `outputPath: 'job.json'` via `shouldSkip`/`loadStageLedger` (`lib/workflow/hashes.ts`) — a match skips the stage's case body entirely and returns `job.json` as-is. `hermes` is excluded (real repair work, owns the loop/nextStage signal). One real gap found and fixed in the same pass: `intake`'s skip left `providers.pool` undefined, silently dropping the `research` fan-out on resume — fixed by cheaply recomputing the pool (deterministic config resolution, no model call) on an `intake` skip.
- **Files:** `scripts/n8n/stage.ts`; `lib/workflow/resume.ts` and `test/workflow/resume.test.ts` deleted.
- **Tests:** `test/workflow/stageLedgerWiring.test.ts` — fresh job never skipped, identical-call skip, changed-call rerun, intake-pool-on-skip, hermes-never-skipped, killed-and-restarted `runJobFullWith` resumes without re-running a completed stage, failed-stage recording.
- **Acceptance criteria:** met — see the test file above and `docs/IMPLEMENTATION_GAP.md` P0-2.
- **Next task:** T03.

### T03 — `main.ts` feeds `JobState`
- **Goal:** a classic CLI run is persisted and resumable like an n8n-triggered run. DONE — commit `7a79ef2`.
- **Files:** `main.ts`, `test/main.jobstate.test.ts`.
- **What shipped:** a `STAGE_TO_JOB_STAGE` best-fit map (`discovery`/`collect`/`normalize`→`evidence`, `analyze`→`character`, `write`→`content`, `direct`→`creative`, `design`→`design`, `enhance`→`build`, `deploy`→`delivery`); `step()` calls `saveJob` after every stage, run or resumed; a job is created before the first stage; a terminal write on success records `stage:'delivery'`/`decision:'deliver'`/`finalOutput`; a `catch` records a failure's message on `errors` before rethrowing.
- **Tests:** `test/main.jobstate.test.ts` — a real resumed run (`enhance`→`deploy`, no mocks) reaches delivery and is reloadable by id; a real failure (missing artifact) records the error and never fabricates delivery.
- **Next task:** T04.

### T04 — Netlify as the default deploy target — DONE (this pass)
- **Goal:** a completed job ends with a live, fetchable Netlify URL by default; the Lovable stub is no longer the selected path.
- **Resolution:** `agents/lovableAgent.ts` was already real (delegates to `lib/deploy/netlify.ts`, no stub) and already the classic `main.ts` pipeline's path. The actual gap was that the production `scripts/n8n/stage.ts` pipeline had no `deploy` stage at all. Added one, sequenced preflight → deploy → report, calling the same `deployToNetlify` — see `docs/IMPLEMENTATION_GAP.md` P0-3/T04 for the full writeup and `test/workflow/deploy.test.ts` for the tests.
- **Files:** the deploy-selection code in `stage.ts` (or wherever the deploy/report stage picks a target), `lib/deploy/netlify.ts`, `agents/lovableAgent.ts` (left in place, just not selected).
- **Dependencies:** none — can run in parallel with T01-T03.
- **Implementation:** change the deploy-stage's target selection to default to `lib/deploy/netlify.ts`; confirm it reads a Netlify API token from config/env consistent with how other provider keys are read in `lib/config.ts`.
- **Tests:** a test (or a documented manual run, since this hits a real external service) that deploys a small fixture site and asserts a reachable URL comes back with HTTP 200.
- **Acceptance criteria:** the acceptance test/manual run produces a live URL; `agents/lovableAgent.ts` is confirmed unreached in the default path by a grep or a test asserting it's never called.
- **Next task:** T05.

### T05 — Groq adapter — DONE (this pass)
- **Goal:** Groq is a second live-exercised free-tier worker, addressing the Gemini single-point-of-failure flag.
- **What shipped:** `lib/ai/providers/groq.ts` (xai.ts/deepseek.ts pattern, native strict `json_schema` for `openai/gpt-oss-120b` — OBSERVED live from Groq's own docs), registered through every touchpoint a new vendor requires (`AI_PROVIDER_NAMES`, `ADAPTERS`, `lib/config.ts`, `lib/capability/orchestrator.ts`, `lib/capability/visionInvoker.ts`, `lib/capability/models.ts`, `lib/factory/pool.ts`'s `FREE_TIER`, `lib/capability/bindings.ts`'s `reasoning`/`structured_generation`/`prose_writing`/`creative_direction`).
- **Discovery:** `scripts/probe-providers.ts` already had a `groq` probe target (base URL, `GROQ_API_KEY`, an OpenAI-compatible dialect) predating this pass, with no adapter or registry entry behind it yet — reused as-is rather than duplicated; it independently confirms the base URL/dialect this adapter also uses.
- **Tests:** `test/ai/groq-provider.test.ts` — see `docs/IMPLEMENTATION_GAP.md` P1-1/T05 for the full list (wiring, real fetch-stubbed request/response/timeout/failure, real planner fallback and budget-gating tests).
- **Acceptance criteria:** met for everything reachable without a real credential — a live `npm run capability-proof`-style run and `scripts/probe-providers.ts --only=groq` need an actual `GROQ_API_KEY`, not available to this agent; the failover test (Gemini exhausted → Groq selected) is real, exercised code, not a live run.
- **Next task:** T06.

### T06 — OpenRouter `:free` liveness probe — DONE (this pass)
- **Goal:** stale/removed `:free` model ids are caught before a job run depends on them.
- **What shipped:** `scripts/probe-openrouter-free.ts` — `freeModelIds()` reads every `:free`-suffixed OpenRouter id straight out of `MODEL_CATALOG` (catalogue-driven, not a hardcoded guess like `probe-providers.ts`'s single OpenRouter target), `probeFreeModels()` probes each one for real and reports `ok`/`failed`/`skipped` per id, writes a timestamped record to `probes/`, and prints a dead-id summary without touching `models.ts`. Added `npm run probe-openrouter-free`.
- **Files:** `scripts/probe-openrouter-free.ts`, `test/ai/probe-openrouter-free.test.ts`, `package.json`.
- **Tests:** `test/ai/probe-openrouter-free.test.ts` — see `docs/IMPLEMENTATION_GAP.md` P1-2 for the full list (catalogue-shape proof, no-credential real-code `skipped` path, empty-list short-circuit).
- **Acceptance criteria:** met for everything reachable without a real credential; a live `npm run probe-openrouter-free` run against a real `OPENROUTER_API_KEY` (none available to this agent) remains the manual/documented step, the same status this repo's other live-provider runs already carry.
- **Next task:** T07.

### T07 — Re-verify Places API credential — BLOCKED on missing credential (code-verified this pass)
- **Goal:** confirm the Evidence Intelligence live-data path actually works.
- **What was verified (no code gap found):** `lib/sources/placesApi.ts` read end to end against every item this task lists — FTID vs. place id resolution, the API key never reaching a URL (photo media resolved via `skipHttpRedirect=true` before it touches an artifact), field authority (`lib/sources/authority.ts`) and conflicting-data resolution (`lib/sources/merge.ts`'s earlier-harvest-wins, per field/item), blocked/missing-data handling (`EMPTY_HARVEST` on every failure path, never a throw, never a fabrication), and do-not-invent-facts (a stated `false` stays a stated absence; an unanswered field states nothing). All of it is real and already covered by `test/sources/placesApi.test.ts`, `test/sources/merge.test.ts`, `test/sources/provenance.test.ts`. See `docs/IMPLEMENTATION_GAP.md` P1-3 for the full writeup.
- **What's blocked:** the live call. `PLACES_API_KEY` is not set anywhere in this environment (confirmed absent from both `process.env` and the project's `.env`) — this agent has no credential to call with. The prior session's `401 UNAUTHENTICATED` was diagnosed as a wrong API scope; a future credential holder should first confirm the key's project has "Places API (New)" enabled, since this integration calls the `v1` surface (`places.googleapis.com/v1/places`), not the legacy API.
- **Files:** `lib/sources/placesApi.ts`, `lib/sources/authority.ts`, `lib/sources/merge.ts` — read, none changed.
- **Tests:** none added — nothing checkable without a credential was found unproven; the existing suite already covers every code-level claim above.
- **Acceptance criteria:** not met this pass — no credential available for the live call this task exists to make. Everything achievable without one has been done.
- **Next task:** T08.

### T08 — Static safety proof for Forge's writing modules — DONE (this pass)
- **Goal:** prove, the same way `no-agent-spawn.test.ts` proves it for the CLI autofix path, that Forge's writing modules (`builder.ts`, `repair.ts`) cannot write bytes to a customer artifact outside the fenced, gated path.
- **What shipped:** `test/qa/forge-writing-bounds.test.ts` — a source-scan static proof (same technique as `no-agent-spawn.test.ts`, adapted: `anti-ai-gate.ts` turned out to audit generated *content*, not write location, so this proof is a source-level path-shape check rather than an import-graph walk). Enumerates every `fs.writeFile`/`fs.copyFile`/`fs.mkdir`/`fs.rm`/`fs.unlink`/`fs.rename` call site across all of `lib/forge/*.ts` and checks each against a hand-verified allowlist of safe path shapes, recursing through local `const` declarations to their `path.join(...)` origin; independently proves the model's own generated-content variables never appear as a `path.join`/`path.resolve` argument in `builder.ts`/`repair.ts`; confirms `auditAntiAIGeneric` is actually wired into `orchestrator.ts` (not just defined); and guards the scanner itself against a vacuous pass. Verified as a real control by temporarily injecting an unsafe write into a scratch copy of `builder.ts` and confirming the tests fail loudly, then restoring and reconfirming green.
- **Result:** the invariant holds — no code gap found in the file-write path. A related but out-of-scope finding (Forge's generated HTML/CSS/JS has no content-safety gate for `javascript:` URLs, inline event handlers, or unauthorized external script domains, unlike the deterministic renderer's `safeHref`/`escapeText`/etc.) was filed as `docs/IMPLEMENTATION_GAP.md` P2-4, not silently patched mid-task.
- **Files:** new `test/qa/forge-writing-bounds.test.ts`; `lib/forge/anti-ai-gate.ts` and the rest of `lib/forge/*.ts` read, none changed.
- **Tests:** the 4 tests in the new file — see `docs/IMPLEMENTATION_GAP.md` P1-4 for the full list.
- **Acceptance criteria:** met — test passes proving the invariant holds; the one real gap found is documented and filed as P2-4, not this task's problem to fix.
- **Next task:** T09.

### T09 — CI pipeline — DONE (this pass, live trigger unverified)
- **Goal:** typecheck + full test suite run automatically on push/PR.
- **What shipped:** `.github/workflows/test.yml` — checkout → setup-node (version read from `package.json`'s `engines.node`) → `npm ci` → `npx playwright install-deps chromium` → `npm run typecheck` → `npm test` → `npm run build`, on every push/PR, with cancel-in-progress concurrency. No prior CI of any kind existed (confirmed: no `.github/`, no other CI config anywhere in the repo) — this is a new addition, not a duplicate. See `docs/IMPLEMENTATION_GAP.md` P1-5 for the full writeup, including why a fresh GitHub-hosted runner plus `npm ci` already satisfies "must not silently reuse Windows node_modules" and "respect the lockfile."
- **Verified locally:** the real `npm run build` (not run at all earlier in this session) completes cleanly, alongside the typecheck/test commands every other task already exercised.
- **Not done this pass:** the plan's own acceptance test (push a throwaway branch with a deliberately broken test, confirm the workflow fails, then revert) requires pushing to the real `origin` remote — every commit this session has been local-only, and that live push-and-observe step is left as a manual step, the same treatment this session has given every other live-external-system check (T04 Netlify, T05 Groq, T06 OpenRouter, T07 Places). Separately, `.github/workflows/*.yml` is a protected path the file-delivery tooling refuses to write to the user's machine (a deliberate guardrail, respected rather than routed around) — `test.yml` was delivered directly to the user and still needs to be placed at `.github/workflows/test.yml` and committed by the user or an agent authorized to write that path.
- **Files:** `.github/workflows/test.yml`.
- **Tests:** N/A (this task adds test infrastructure, not new tests) — its own correctness was checked by running every command it invokes locally.
- **Acceptance criteria:** partially met — see above.
- **Next task:** T10.

### T10 — Extend registry-grade grounding to motion intensity — DONE (this pass, different subsystem than originally scoped)
- **Goal:** the Director's motion-intensity field gets the same mechanical enforcement `runtimePrimitives` has, closing the gap where an advisory field can be silently ignored.
- **Architectural finding:** neither `motionIntensity` nor `layoutArchetype` exists as a field on `lib/design/directive.ts`'s classic Director type at all — `motionIntensity` lives only in the separate Forge pipeline's `ExperienceStrategy`, and the classic pipeline's closest analog (`DirectorPacing`) already has real mechanical consumers, not advisory-only status. Rather than inventing a duplicate `motionIntensity` field on the classic Director to satisfy the file list literally (forbidden by the standing "never invent an implementation if an existing one can be reused" rule), read what Forge's own `motion.ts` already mechanically enforces — a substantial amount, predating this session (`checkMotionCoherence`, `checkMotionLibraryUsage`) — and found the one motion-related claim genuinely still unenforced: `motion.ts`'s own mandatory instruction to include a `@media (prefers-reduced-motion: reduce)` CSS block, which nothing verified the model actually did. See `docs/IMPLEMENTATION_GAP.md` P1-6 for the full reasoning.
- **What shipped:** `checkReducedMotionSafeguard` (`lib/forge/antiPatternSignals.ts`) — flags `REDUCED_MOTION_MISSING` when the CSS declares any animated duration but no reduced-motion media query; exempt when nothing animates, mirroring `checkMotionCoherence`'s own scoping. Wired into `auditAntiAIGeneric` (`anti-ai-gate.ts`), gating delivery the same way the existing motion checks do.
- **Files:** `lib/forge/antiPatternSignals.ts`, `lib/forge/anti-ai-gate.ts`, `test/forge/antiPatternSignals.test.ts`.
- **Tests:** 5 new tests — see `docs/IMPLEMENTATION_GAP.md` P1-6 for the full list.
- **Acceptance criteria:** met for the field that actually had a real, currently-unenforced gap: a mandatory motion claim is now mechanically proven, not merely instructed — the same underlying goal `directiveRuntimePrimitiveIds()`/`resolvePrimitives()` serves for runtime primitives, adapted to how Forge is actually structured (a content-scan gate over a whole generated document, not a resolve-then-render seam over templated data).
- **Next task:** none — T01-T10 are all done (see the final integration report). Re-derive the next batch from `docs/IMPLEMENTATION_GAP.md`'s P2 section (P2-4, the newly filed Forge content-safety gate, is the natural next P1/P2-boundary item).

---

## Parallelization note

T01→T02→T03 form a chain (persistence layer, do in order). T04, T05, T06, T07, T09 have no dependencies on each other or on T01-T03 and can be done in parallel by different agents/sessions. T08 should happen before T10. This plan assumes one agent working sequentially unless the user explicitly parallelizes it.
