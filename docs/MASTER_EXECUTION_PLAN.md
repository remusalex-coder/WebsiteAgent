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

### T06 — OpenRouter `:free` liveness probe
- **Goal:** stale/removed `:free` model ids are caught before a job run depends on them.
- **Files:** new `scripts/probe-openrouter-free.ts` (mirror `scripts/probe-providers.ts`).
- **Dependencies:** none.
- **Implementation:** a script that calls each `:free`-tier model id currently in `models.ts` with a trivial prompt and reports which are live vs. dead/renamed.
- **Tests:** the script itself is the artifact; add a lightweight test asserting the script's shape (exports a checkable function) rather than hitting the live network in CI.
- **Acceptance criteria:** running the script against the real OpenRouter API produces a pass/fail per free model id; a dead id is documented for removal from `models.ts` in a follow-up (not this task, to avoid silently changing the catalogue as a side effect).
- **Next task:** T07.

### T07 — Re-verify Places API credential
- **Goal:** confirm the Evidence Intelligence live-data path actually works.
- **Files:** `lib/sources/*` (Places integration).
- **Dependencies:** none — do this early if a credential is available, since every other Evidence-dependent task benefits from confirming this works.
- **Implementation:** make one live call against a real, known business; if it 401s, check the credential/scope configuration against Places API's current requirements (the API surface may have changed since the integration was written).
- **Tests:** a manual/documented run, logged in this task's completion notes; if a code fix is needed, add/update a test accordingly.
- **Acceptance criteria:** one successful live call, documented; or, if broken, a follow-up task is filed with the specific root cause (do not leave this open-ended).
- **Next task:** T08.

### T08 — Static safety proof for Forge's writing modules
- **Goal:** prove, the same way `no-agent-spawn.test.ts` proves it for the CLI autofix path, that Forge's writing modules (`builder.ts`, `repair.ts`) cannot write bytes to a customer artifact outside the fenced, gated path.
- **Files:** new `test/qa/forge-writing-bounds.test.ts`, read (don't modify unless a real gap is found) `lib/forge/anti-ai-gate.ts`.
- **Dependencies:** none — high value, should not be delayed past P1.
- **Implementation:** import-graph-walk analysis (same technique as `no-agent-spawn.test.ts`) proving every reachable path from a job entry point into `builder.ts`/`repair.ts` passes through `anti-ai-gate.ts`'s constraints before any write.
- **Tests:** the new test itself; if it finds a real gap, that becomes a new P0 task, not silently patched mid-task.
- **Acceptance criteria:** test passes proving the invariant holds, OR a documented, filed gap if it doesn't (either outcome is a valid completion of this task — the goal is proof, not a predetermined result).
- **Next task:** T09.

### T09 — CI pipeline
- **Goal:** typecheck + full test suite run automatically on push/PR.
- **Files:** new `.github/workflows/test.yml`.
- **Dependencies:** none — can run any time, cheap.
- **Implementation:** standard Node.js GitHub Actions workflow: checkout, setup-node, `npm ci`, `npm run typecheck`, `npm test`.
- **Tests:** N/A (this task adds test infrastructure, not new tests).
- **Acceptance criteria:** a push to a branch triggers the workflow and it reports pass/fail correctly (verify with a deliberately broken test on a throwaway branch, then revert).
- **Next task:** T10.

### T10 — Extend registry-grade grounding to motion intensity
- **Goal:** the Director's motion-intensity field gets the same mechanical enforcement `runtimePrimitives` has, closing the gap where an advisory field can be silently ignored.
- **Files:** `lib/design/directive.ts`, `lib/design/experienceRegistry.ts` (or a new sibling module if motion intensity needs its own resolution shape).
- **Dependencies:** T08 (same risk class — prove safety before extending mechanical surface area).
- **Implementation:** mirror the `directiveRuntimePrimitiveIds()` → `resolvePrimitives()` two-stage seam: a shape-extraction function for the Director's requested motion intensity, and a registry-side resolution function that's the sole authority on whether that intensity is actually achievable given the resolved runtime primitives.
- **Tests:** new `test/design/motionIntensitySeam.test.ts` mirroring `directorRuntimeSeam.test.ts`'s structure.
- **Acceptance criteria:** new test passes; motion intensity requests that exceed what the resolved primitives can support are downgraded, not silently claimed.
- **Next task:** none — this is the last currently-planned task; re-derive the next batch from `docs/IMPLEMENTATION_GAP.md`'s P2 section once T01-T10 are done.

---

## Parallelization note

T01→T02→T03 form a chain (persistence layer, do in order). T04, T05, T06, T07, T09 have no dependencies on each other or on T01-T03 and can be done in parallel by different agents/sessions. T08 should happen before T10. This plan assumes one agent working sequentially unless the user explicitly parallelizes it.
