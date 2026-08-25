# BusinessForge — Master Autonomous Execution Mandate

**Status:** standing charter, given by the project owner on 2026-08-25. Not a single-task prompt — governs every future session that works on this repository until superseded or withdrawn by the owner.

**Where the working state lives:** `docs/WORK_QUEUE.json` is the persistent, dynamic task queue (schema and current tasks inside it). `docs/MASTER_CAPABILITY_TOOL_REGISTRY.json`/`.md` is the capability/provider/tool inventory. `docs/MASTER_INVENTORY.json` is the broader architecture/finding ledger. Read all three before starting work in any new session under this mandate.

---

## 1. Master objective

BusinessForge must become a self-contained autonomous website production system: business input in, a genuinely individualized, professional, functional, Awwwards-quality-where-appropriate website out — grounded in real evidence, accessible, secure, performant, SEO-sound, conversion-oriented, deployed, and usable by a real paying client. The system must eventually be able to repeat this with minimal human coordination.

## 2. Master rule

The executing agent makes the engineering decisions — architecture, implementation strategy, priorities, task decomposition, worker/provider selection, research scope, what to integrate or replace, testing strategy, execution order, parallelization, recovery. Do not repeatedly ask the user to choose between technical options. Ask only when genuinely unavoidable: a real financial purchase, an irreversible external action, credentials only the user can provide, legal ownership/authorization, or a business decision that cannot be inferred. Everything else continues autonomously.

## 3. Interpret intent, not literal examples

User descriptions are intent signals, not implementation specs. Evaluate any named tool, model, or framework on its merits rather than integrating or rejecting it reflexively.

## 4. Continuous execution

There is no artificial stopping point after one task, phase, or milestone. After every meaningful completion, ask "what does this result make possible or necessary next?" and continue. In THIS environment, "continuous" is implemented as: real work within a session, a persistent work queue recomputed after every completion, and a scheduled task (via the project's proper scheduled-task tooling, never an in-process/local cron) that resumes work in a fresh session on a regular cadence — because a single session cannot literally run forever. A fresh session under this mandate must read the current queue/registry/inventory state before acting; it has no memory of prior sessions except what is persisted in the repository.

## 5. Dynamic work queue

`docs/WORK_QUEUE.json` holds it: id, description, priority, dependencies, status, assigned worker, attempts, inputs, outputs, artifacts, validation state, failure state, provenance, timestamps, cost where known. New work discovered during execution (a defect found, a gap surfaced, a provider limit hit) becomes a new queue entry rather than being silently dropped or left only in a chat transcript.

## 6. Parallel execution

Independent tasks run concurrently; dependent tasks wait. Bounded concurrency — never overwhelm APIs, the filesystem, or shared state. Protect shared state with real locking (see `lib/workflow/runner.ts`'s `SerializedWriter`, and the diverge-stage shadow-directory isolation pattern added 2026-08-25 as a worked example of doing this correctly rather than naively).

## 7-9. Worker ecosystem, provider routing, AI-to-AI delegation

Treat models, agents, MCP tools, libraries, and deterministic code as capabilities the system routes work to — not as separate projects. No single AI provider may be a mandatory single point of failure. `lib/capability/orchestrator.ts`'s `plan()`/`execute()` is the existing, already-built machine contract for this (confirmed 2026-08-25 — do not build a second one; see `MASTER_CAPABILITY_TOOL_REGISTRY.md` §1 and §4 for the still-open reconciliation with the classic pipeline's simpler `lib/ai/router.ts`).

## 10. External tools

Evaluate each candidate on usefulness, maturity, license, cost, security, maintenance, lock-in, and replacement difficulty — recorded as a KEEP/INTEGRATE/FORK/REPLACE/SELF-HOST/BUILD_NATIVE/REJECT decision in the capability registry, not assumed.

## 11-13. Design/motion/3D capability system, quality loop, Awwwards-level quality

A generated site must pass evidence grounding, content quality, visual quality, distinctiveness, UX, accessibility, security, responsiveness, performance, SEO, functionality, motion coherence, asset quality, structured data, and deployment integrity — a passing unit-test suite alone is not sufficient. "Awwwards-level" means the design emerges from business evidence and character, not decorative template application; different businesses must produce materially different experiences.

## 14. Forge/generation safety

Generated code is untrusted output. Maintain safeguards against unsafe writes, path traversal, code execution, malicious HTML, credential leakage, prompt injection. Never weaken an existing safety mechanism to make a test pass. A newly discovered safety gap becomes a queue entry: mitigate, add a regression test, document, continue.

## 15-16. State/ledger/resume, observability

The execution engine must survive interruptions and recover intelligently (see `lib/workflow/hashes.ts`'s `StageLedger` for the real, adopted resumability mechanism — not `lib/workflow/state.ts`/`ledger.ts`, which were built for this but never adopted; reconciling that is `WORK_QUEUE.json`'s `WQ-006`). A human-readable control surface (queue, current job/stage, workers, QA, deploy status) should eventually be part of BusinessForge itself (`WQ-014`).

## 17. n8n/Dify/Hermes/other orchestrators

Inspect what's real before assuming; do not automatically preserve or remove. `WQ-015` tracks clarifying what `scripts/n8n/*.ts`'s naming actually denotes.

## 18. Documentation/memory

Nothing important may exist only inside a chat. This file, `WORK_QUEUE.json`, `MASTER_CAPABILITY_TOOL_REGISTRY.{json,md}`, and `MASTER_INVENTORY.json` are the persistent record. Update them whenever architecture, capabilities, providers, or execution behavior materially changes.

## 19. GitHub

Keep the repository coherent and reproducible. No secrets committed (verify `.gitignore` covers every `.env.*`). No blind `git add -A` — stage explicit file lists. Every meaningful implementation unit gets its own clear commit.

## 20. Research loop

Research is part of execution, not a phase that ends. When a capability gap is found: search, evaluate, compare, test, integrate if justified, document, verify, continue — choose the best option rather than stopping at "here are some options," except where genuine human authorization is required.

## 21. Self-improvement

After milestones, ask what's still manual, single-provider-dependent, duplicated, untested, or requires user intervention — convert answers into queue entries.

## 22. Testing

Never claim completion without verification. Distinguish clearly: code verified, locally tested, integration tested, credential-tested, live-tested, production-tested. The established pattern in this repository: typecheck + full suite in the cloud sandbox, then the same natively on the connected Windows checkout, before committing — do not skip the native pass, since sandbox-only failures (Playwright-dependent tests) are a known, distinct category from real regressions.

## 23. Security of the autonomous system itself

Autonomy means decision-making within defined safety boundaries, not unrestricted execution. Capability boundaries, task scopes, filesystem boundaries, audit trail (git history + `WORK_QUEUE.json` provenance), rollback (git).

## 24. Cost control

Prefer free tiers, open-source, local/deterministic execution, existing resources. Use paid infrastructure when it materially advances the project. Record cost implications of major provider decisions in the capability registry. Do not spend money to avoid engineering work — most of the queue is deterministic engineering, not model spend.

## 25. Completion criteria

Not complete at "tests pass" or "the pipeline runs in a test environment." Complete only at a demonstrated end-to-end run — business input through evidence, strategy, design, content, assets, build, interaction, QA, repair, deploy — with autonomous orchestration and provider fallback, without the user manually moving information between AI tools.

## 26-27. Execution directive and reporting

Inspect real repository/git/queue state before acting. Implement real code, test it, document decisions, commit coherent changes, recompute the queue, continue. Do not produce long conversational progress reports after every small operation — keep the state in the repository; report only what materially changed, what was verified, genuine blockers, and current product-level status. Do not ask what to do next.

---

*Given verbatim by the project owner on 2026-08-25; this file is a persisted, lightly-reformatted copy for repository-resident reference. The owner's original message is the authoritative source if the two ever diverge.*
