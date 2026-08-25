# BusinessForge — Consolidation Map

Decisions below are derived from `docs/MASTER_INVENTORY.md` + `docs/REALITY_MAP.md`, not re-audited from scratch. Every row is a final call — no options are left open for the user to pick between, per standing instruction. "Target" is the file/module path the component should live at once consolidation work happens (see `docs/IMPLEMENTATION_GAP.md` / `docs/MASTER_EXECUTION_PLAN.md` for the tasks that get it there).

## Control plane

**Control Plane (unified) → BUILD (thin), do not rewrite Hermes.**
A real control plane does not exist. The three pieces that split its job today — `main.ts`, `scripts/n8n/stage.ts`, `lib/workflow/hermes.ts` — each do their own slice correctly. The right move is a thin coordinating module that (a) always creates/loads a `JobState` via `jobState.ts`, (b) drives stage execution through `stage.ts`'s handlers regardless of whether the caller was n8n or the CLI, (c) leaves decision authority with `hermes.ts` unchanged. Target: new `lib/workflow/controlPlane.ts`, thin — a dispatcher, not a rewrite.

**`main.ts` classic pipeline → MERGE into the job-state model.**
Its 9 stages stay as the direct/local invocation path (useful for fast iteration without n8n), but it must call `createJob`/`saveJob` like `stage.ts` does, so a `main.ts` run is resumable and shows up in job history instead of being invisible to persistence. Target: `main.ts` gains calls into `lib/workflow/jobState.ts`, no stage logic changes.

## Orchestration

**`scripts/n8n/stage.ts` → KEEP as canonical orchestrator.** It already persists correctly and is what n8n calls. No structural change; it becomes the thing the new thin control plane wraps.

**`lib/capability/orchestrator.ts` → KEEP unchanged.** Already the correct shape for provider routing — nothing here needs consolidation.

## Job state machine / Ledger / Resume

**`jobState.ts` (`JobStage`, `loadJob`/`saveJob`) → KEEP as the single persisted identity.**

**`lib/workflow/ledger.ts` → WIRE IN, do not rewrite.** Call `ledger.ts` from inside `stage.ts`'s per-stage handler wrapper (append an entry after each stage completes) — this is a named product requirement (input-hash → output → candidates → decision trail), and the code to do it already exists and is tested in isolation. Target: `stage.ts` imports and calls it; `lib/workflow/ledger.ts` stays where it is. Rename to `lib/workflow/stageLedger.ts` in the same change, since `lib/cost/ledgerEntry.ts` is an unrelated concept and the shared word invites confusion.

**`lib/workflow/resume.ts` → REMOVED as a duplicate (T02, commit `b6da711`/follow-up).** The skip-unchanged-stage goal this module was built for is now delivered directly inside `runStage` itself: a per-call content-addressed hash check against `hashes.ts`'s `shouldSkip`/`loadStageLedger` (the same primitive `resume.ts` depended on), gated at the single dispatch point rather than a separate up-front "which stage do I resume at" plan. Keeping `resume.ts` alongside that would have been exactly the second, parallel resume system this document set was written to prevent — analyzed and removed rather than wired in, per the standing "no two resume systems" rule. `hermes` is excluded from the skip check (its case body does real repair work and owns the loop/nextStage signal); every other stage is skip-eligible. See `test/workflow/stageLedgerWiring.test.ts` for the resume/skip/restart proofs.

**`lib/workflow/runner.ts` → DEFER, read-before-decide.** Possibly a superseded draft of `stage.ts`'s own hand-written loop. Do not adopt or delete until someone reads both side by side after ledger/resume are wired — deciding now, before that comparison, would be guessing. This is the one item in this document intentionally left as DEFER rather than a hard call, because the deciding evidence (a side-by-side read) hasn't been gathered, and inventing a preference without it would be the "optimize for documentation, not for BusinessForge" mistake the brief explicitly warns against.

**`lib/workflow/projections.ts` → DEFER.** No product requirement currently names a dashboard; revisit only if one is added.

## Providers

**`lib/capability/*` → KEEP, EXTEND.** Correct architecture already. Add a Groq adapter (see Implementation Gap P1). Do not add a generic "AI provider" abstraction layer on top — the existing one already is that layer.

**Anthropic, Gemini, OpenAI, OpenRouter, DeepSeek, Cerebras → KEEP, unchanged roles.**

**xAI (Grok) → BOUND 2026-08-25 (`WORK_QUEUE.json` WQ-005), narrowly.** Revisits this entry's own prior verdict, deliberately: the exclusive-property test above ("no property exclusive to Grok") never examined xai against one specific already-bound vendor on one specific capability. `structured_generation` needed a re-check because xai's native `json_schema, strict: true` enforcement is cheaper on both input and output than the already-bound Anthropic seat (200/600 vs 276/1380 cents-per-million) and stronger (native vs Anthropic's instructed-mode schema). Bound at order 3 in that one capability only — the same fallback-depth reasoning already used for Cerebras and Groq's second `reasoning` seat elsewhere in `lib/capability/bindings.ts`, not a blanket "wire it everywhere." Gated behind the same paid-policy check every commercial vendor sits behind.

**Groq → ADD.** See Implementation Gap.

**Mistral / Qwen / Kimi / GLM / Llama-HF → REJECT dedicated adapters.** Reachable via OpenRouter already; a jurisdiction question (CN-origin) blocks the CN-origin ones from ever being a default regardless of adapter effort.

## Hermes

**`lib/workflow/hermes.ts` → KEEP exactly as scoped.** `decideOnly:true` stays true. This is the "Hermes is an authority/function of BusinessForge" the brief demands — it already is one; the risk is the "Control Plane rewrite" proposal in the old docs, which would have turned it into an external-agent-shaped thing again. That proposal is formally rejected below.

**"Hermes as Control Plane" (full rewrite) → REJECT.** Would collapse the tested `decideOnly` boundary between deciding and repairing. The thin control plane above achieves the coordination goal without this risk.

**"Hermes" research/architect agent-role name → REJECT the name.** Collides with the real Hermes. Any future research-agent role must use a different name (e.g. `ResearchAgent`).

## Forge

**Forge orchestrator + `decide.ts` gate → KEEP.** Already the "deterministic floor, additive candidate, ship only on PASS" shape the vision names.

**Forge writing modules (`builder.ts`, `repair.ts`) → KEEP, add a dedicated safety audit.** Not blocked on this — `anti-ai-gate.ts` and registry constraints already fence it — but it deserves the same static-proof treatment `no-agent-spawn.test.ts` gave the CLI autofix path (P1, see Implementation Gap), since it's the closest point in the codebase to a model writing bytes directly.

**Forge reasoning modules → KEEP unchanged.**

## Design / Experience Intelligence

**`agents/designDirectorAgent.ts` + `lib/design/directive.ts` + `lib/design/experienceRegistry.ts` → KEEP as the one Experience Intelligence system.** See `docs/EXPERIENCE_INTELLIGENCE_FINAL.md` for the decision logic itself. No structural consolidation needed here — this session's fix (removing duplicate registry validation from `directive.ts`) already resolved the one real seam defect.

**`lib/forge/registryGate.ts` → KEEP.** Confirms Forge shares the one registry; nothing to merge, this already is the merge.

**CSS scroll-driven animations / View Transitions API → ADD (P2).** Reduces vendored-JS dependency for simple cases; evaluated only today.

## Evidence / Provenance

**Discovery/Collector/Normalizer, `lib/sources/*`, `basis:`-tagging, `groundTestimonials`/`verifiedFacts`/`trustSignals` → KEEP, unchanged.** Re-verify the Places API credential (P1, cheap) — not a design change, an operational check.

## Candidates / QA / Security / Accessibility / Performance

**All of `lib/qa/*`, `lib/workflow/candidates.ts`, `lib/render/*`, `lib/forge/browser.ts` → KEEP, unchanged.** This is the most mature part of the repo; consolidation work should not touch it beyond the accessibility re-verify already flagged in Reality Map.

## External tools

**n8n `businessforge-workflow.json` → KEEP as the control surface.** It must stay a thin caller of the job-level API (create job / advance stage / read status) and must not grow orchestration or business logic of its own — that stays in `stage.ts` and the agents/lib layers underneath it. This is a constraint on future n8n changes, not a code change today.

**n8n `factory-v1.json` → REMOVE**, once a grep confirms nothing external still calls `bf-factory`/`/stage/:name` (P2 — confirm-then-delete, not delete-blind).

**Dify → REJECT for now.** Zero mentions in repo or docs; no justification exists to integrate it. If a future business reason appears, it needs a fresh evaluation, not a default yes because it was once on a research list.

**Notion → DEMOTE (already stated as a decision in the Master Inventory), confirmed here.** Not a status source of truth going forward. If the user wants a human-facing dashboard, it can be a read-only mirror generated from these docs — never authored independently, since that's exactly the "documented nowhere reliable" problem this whole document set exists to fix.

**GitHub Copilot → REJECT (abandoned branch stays abandoned).** No action.

**MCP transports, skills scaffold (`lib/platform/mcp/*`, `lib/platform/skills/*`) → DEFER.** Real, well-structured, not load-bearing for the P0 goal. Do not invest further until the pipeline gaps below are closed — this is explicitly not the place extra effort should go next.

**Deployment (`agents/lovableAgent.ts` vs `lib/deploy/netlify.ts`) → DONE (T04, this pass).** `agents/lovableAgent.ts` was already real — no stub, no `NotImplementedError` — and already delegated to `lib/deploy/netlify.ts`; that was true before T04 and is what `main.ts`'s classic pipeline used. The real gap was that the production `scripts/n8n/stage.ts` pipeline had no `deploy` stage at all — `preflight` and `report` existed with nothing publishing in between, so a "delivered" job there never left a local `site/` path. T04 added a `deploy` stage (preflight → deploy → report) calling the same `deployToNetlify`, so both pipelines now reach the one real deploy implementation — no second one was created. See `docs/IMPLEMENTATION_GAP.md` P0-3/T04.

## Specimens

**Bakery V2 → KEEP exactly as-is, unchanged boundary.** No consolidation action — it is already correctly quarantined in code, not just in docs.
