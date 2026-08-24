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

### P0-3. Replace the deployment default: Netlify over the Lovable stub
- **Gap:** `agents/lovableAgent.ts` throws `NotImplementedError` when actually configured; `lib/deploy/netlify.ts` exists but is not confirmed as the selected runtime path.
- **Why:** this is literally the last stage between "site built" and "browser opens on a live URL" — the project's own explicit end-to-end target is unreachable without it.
- **Existing code to reuse:** `lib/deploy/netlify.ts`.
- **Files:** wherever the deploy stage selects its target (`stage.ts`'s deploy/report stage, or `main.ts` if the classic path also deploys).
- **Dependencies:** none.
- **Estimated complexity:** small — the hard part (a working Netlify integration) is reportedly already coded; this is a default-selection and confirmation change.
- **Acceptance criteria:** a full job run ends with a live, reachable Netlify URL, verified by an actual HTTP fetch in a test or a documented manual run; the Lovable path is no longer reached by default.

### P0-4. `main.ts` classic pipeline feeds `JobState`
- **Gap:** the classic CLI path never calls `createJob`/`saveJob` — a `main.ts` run is invisible to persistence, not resumable, and doesn't show up in job history.
- **Why:** required for the control-plane consolidation (Consolidation Map) and for P0-1/P0-2 to have any effect on CLI-invoked runs, not just n8n-invoked ones.
- **Existing code to reuse:** `lib/workflow/jobState.ts`.
- **Files:** `main.ts`.
- **Dependencies:** none blocking, but should land alongside P0-1/P0-2 for consistency.
- **Estimated complexity:** small.
- **Acceptance criteria:** a `main.ts` run produces a loadable `JobState` with correct stage transitions; a test proves a CLI-invoked job can be reloaded by id.

---

## P1 — needed for the first real product

### P1-1. Add a Groq adapter
- **Gap:** highest-rated free-tier find in the research corpus, zero adapter code.
- **Why:** directly addresses the "Gemini is the only vendor confirmed live" single-point-of-failure flag in the Provider Pool.
- **Existing code to reuse:** the existing adapter pattern in `lib/capability/invokers.ts`/`models.ts` (same shape as the other 6 active vendors).
- **Files:** `lib/capability/models.ts`, `lib/capability/invokers.ts`, `test/capability/models.test.ts`.
- **Dependencies:** a Groq API key.
- **Estimated complexity:** small — follows an established pattern.
- **Acceptance criteria:** Groq appears in the capability-proof live run alongside Gemini; failover from Gemini to Groq is exercised by a test.

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
