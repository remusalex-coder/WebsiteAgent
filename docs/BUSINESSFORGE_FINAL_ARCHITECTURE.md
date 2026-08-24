# BusinessForge — Final Architecture

This supersedes `docs/BUSINESSFORGE_MASTER_ARCHITECTURE.md` as the canonical architecture document. It reflects `docs/MASTER_INVENTORY.md`, `docs/REALITY_MAP.md`, and `docs/CONSOLIDATION_MAP.md` — no new concepts are introduced here that those documents didn't already decide.

## 1. The pipeline

```
INPUT (business URL / evidence)
   ↓
EVIDENCE           (Discovery/Collector/Normalizer agents, lib/sources/*)
   ↓
KNOWLEDGE          (docs/knowledge/* — reference only, not a runtime stage)
   ↓
EXPERIENCE         (Design Director, lib/design/directive.ts, experienceRegistry.ts)
   ↓
CAPABILITIES       (lib/capability/registry.ts — what's allowed, gated)
   ↓
PROVIDERS          (lib/capability/orchestrator.ts — who executes it)
   ↓
ORCHESTRATION      (scripts/n8n/stage.ts — canonical job runner)
   ↓
BUILD              (lib/render/*, lib/forge/* additive enhancement)
   ↓
BROWSER            (Playwright capture, lib/forge/browser.ts, lib/qa/layout-audit.ts)
   ↓
QA                 (lib/qa/{jury,verdict,distinctness-gate,visual-regression,preflight}.ts)
   ↓
HERMES             (lib/workflow/hermes.ts — decideOnly:true)
   ↓
REPAIR / DELIVER / ESCALATE
```

"KNOWLEDGE" is listed because the brief names it as a stage, but it is intentionally **not** a runtime call — `docs/knowledge/*` is self-described "inert, do not implement" reference material that informs how the Director and QA gates were *written*, not something the pipeline queries at request time. Treating it as a runtime stage would be inventing a system that doesn't exist and shouldn't.

## 2. Per-boundary contract

### INPUT → EVIDENCE
- **Input:** a business URL, or business evidence supplied directly (name, address, category — whatever the caller has).
- **Output:** a normalized evidence bundle — verified facts, reviews, trade/town signal, opening hours, ownership credentials, each tagged with its source.
- **Owner:** `agents/{discovery,collector,normalizer}Agent.ts`.
- **Persistence:** written into `JobState.evidence` via `jobState.ts`.
- **Failure behavior:** a source that fails (e.g. Places API 401) degrades that source's contribution to null/absent, never to an invented substitute — evidence-first means "we don't know" is always a valid, expected output.
- **Retry:** per-source retry inside the collector agents; job-level retry is Hermes's concern (see below), not this stage's.
- **Security boundary:** no raw external content is trusted verbatim into rendered HTML without passing through the escaping/evidence-tagging layer downstream.

### EVIDENCE → EXPERIENCE
- **Input:** the evidence bundle + derived Business Character.
- **Output:** a `DesignDirective` — closed-set choices (layout archetype, motion intensity, 3D usage, interaction pattern, imagery treatment, typography/narrative pairing, requested runtime primitives).
- **Owner:** `agents/designDirectorAgent.ts` + `lib/design/directive.ts`.
- **Persistence:** `JobState.creativeDirection` / `experienceIntent` / `experiencePlan`.
- **Failure behavior:** malformed or unresolvable directive fields are dropped, not fatal — `directiveRuntimePrimitiveIds()` drops malformed ids defensively; the pipeline degrades toward the deterministic floor rather than failing the job.
- **Retry:** re-run via the `diverge` stage generating alternate candidate directives, not a blind retry of the same call.
- **Security boundary:** the Director never outputs raw markup/CSS — closed-set choices only (see `docs/EXPERIENCE_INTELLIGENCE_FINAL.md` §3), which is itself a security property as much as a design one: nothing here can inject arbitrary render instructions.

### EXPERIENCE → CAPABILITIES → PROVIDERS
- **Input:** a capability request (e.g. "generate hero copy," "critique this screenshot").
- **Output:** an executed result plus which provider/model actually served it.
- **Owner:** `lib/capability/registry.ts` (what's allowed, gate policy: deterministic/model/human/never) and `lib/capability/orchestrator.ts` (routing, ranking, cross-vendor failover).
- **Persistence:** cost/spend recorded via `lib/cost/ledgerEntry.ts`; capability results flow into the job state fields they were requested for.
- **Failure behavior:** cross-vendor failover on a provider error; a capability gated `unpriced-blocked` (unverified pricing) is excluded from planning entirely rather than silently used.
- **Retry:** built into the orchestrator's failover logic — this is the one boundary where "retry" mostly means "try the next ranked provider," not "retry the same one."
- **Security boundary:** `priceConfidence`/gate-policy enforcement happens here, before any spend; no model call bypasses the registry.

### ORCHESTRATION (canonical: `scripts/n8n/stage.ts`)
- **Input:** a job id (new or existing) and a stage to advance to.
- **Output:** updated `JobState`, persisted.
- **Owner:** `scripts/n8n/stage.ts`, called either by n8n's Control Surface workflow or, after the Consolidation Map's `main.ts` merge task lands, by the classic CLI path too.
- **Persistence:** `loadJob`/`saveJob` in `jobState.ts` after every stage; once wired (P0, see Implementation Gap), also an append-only entry in the stage ledger and a content hash resume can check against.
- **Failure behavior:** a stage failure leaves the last successfully saved `JobState` intact — a job is always resumable from its last good stage, never left corrupted.
- **Retry:** resume-by-id (reload last state and re-run) plus skip-unchanged-stage resume — DONE (T02, commit `b6da711`/follow-up): a per-call content-addressed hash check inside `runStage` itself against the stage ledger, not a separate planner (`resume.ts` was analyzed and removed as a duplicate).
- **Security boundary:** n8n stays a control surface only — it must not carry orchestration or business logic (Consolidation Map constraint); all of that lives in `stage.ts` and beneath it.

### BUILD
- **Input:** `DesignDirective` + evidence-derived content + resolved capability outputs.
- **Output:** a deterministically rendered site (the floor) plus, when Forge attempts enhancement, an isolated candidate build.
- **Owner:** `lib/render/*` (deterministic floor, pure function, escapes everything, no JS by default) and `lib/forge/orchestrator.ts` (additive candidate, isolated directory).
- **Persistence:** rendered output under the job's output directory; Forge candidate under `.../forge/site-candidate`.
- **Failure behavior:** Forge failure or a non-PASS verdict means the deterministic floor ships unmodified — enhancement is additive-only, never a required step.
- **Retry:** Forge repair modules (`repair.ts`) operate on the candidate, gated by the same anti-ai-gate constraints as the builder.
- **Security boundary:** the deterministic renderer is the trust floor precisely because it's a pure function with no model in the loop; Forge's writing modules are the one place closest to a model writing bytes, fenced by `anti-ai-gate.ts` (flagged for a dedicated audit, P1).

### BROWSER
- **Input:** a rendered site (floor or candidate).
- **Output:** screenshots, layout measurements, rendered-DOM facts.
- **Owner:** `lib/forge/browser.ts` (Playwright capture), `lib/qa/layout-audit.ts`.
- **Persistence:** artifacts under the job's output/benchmark directories.
- **Failure behavior:** a browser capture failure blocks QA from proceeding for that candidate — QA cannot pass on a site it couldn't actually render and inspect.
- **Retry:** capture retried with backoff at the Playwright layer; not a job-level retry.
- **Security boundary:** headless capture only, no live network egress beyond what the rendered site itself needs (fonts, assets already resolved at build time).

### QA
- **Input:** rendered + captured site (floor and/or candidate).
- **Output:** a verdict — blocking dimensions first (security, accessibility-blocking rules, technical gates), then quality, then distinctness — lexicographically combined, never averaged.
- **Owner:** `lib/qa/{jury,verdict,distinctness-gate,layout-audit,visual-regression,preflight,gates/*}.ts`.
- **Persistence:** verdict recorded on the candidate; feeds `lib/workflow/candidates.ts`'s `finalizeBest`/`recordCandidate`.
- **Failure behavior:** any blocking-dimension failure is terminal for that candidate regardless of how well it scores elsewhere.
- **Retry:** a failed candidate can trigger another Forge attempt or Director divergence, up to the job's `maxIter`.
- **Security boundary:** `lib/qa/gates/technical.ts` + `no-agent-spawn.test.ts`'s static proof are the enforcement points for "no model writes bytes directly to a customer artifact outside the fenced paths."

### HERMES
- **Input:** the QA verdict + iteration count for the job.
- **Output:** exactly one of deliver / escalate / continue(repair).
- **Owner:** `lib/workflow/hermes.ts`, `decideOnly:true` — it never repairs, it only decides.
- **Persistence:** decision recorded on `JobState`.
- **Failure behavior:** iteration count exceeding `maxIter` forces escalate, never an infinite repair loop.
- **Retry:** N/A — Hermes is the thing that decides whether a retry happens, not a retryable step itself.
- **Security boundary:** the `decideOnly` separation is itself the boundary — decision authority and repair authority are architecturally split so a compromised or wrong repair attempt can never also be the thing that decided to trust its own output.

### REPAIR / DELIVER / ESCALATE
- **Repair:** routed back into BUILD (Forge repair modules) for another attempt, bounded by `maxIter`.
- **Deliver:** routed to deployment — Netlify path (`lib/deploy/netlify.ts`), per Consolidation Map's decision to replace the Lovable stub as the default.
- **Escalate:** surfaced to a human, with the full evidence/QA/candidate trail attached (this is what the ledger wiring — P0 — is for: an escalation without a full stage-by-stage trail is not debuggable).

## 3. Redundant concepts eliminated by this document set

- **Three "competing" job-stage trackers** — resolved as one persisted identity (`JobStage`) with one dispatch-granularity table beneath it (`stage.ts` STAGES); `main.ts`'s STAGES is the one that needs to feed the persisted identity, not a fourth concept to reconcile.
- **"Hermes as Control Plane" rewrite** — rejected; a thin new control-plane module coordinates without touching Hermes's tested decision-only boundary.
- **Ledger vs. cost ledger naming collision** — resolved as two different concerns that happen to share a word; one gets renamed on wiring, not merged (they were never the same thing).
- **Notion as source of truth** — demoted; this document set is the technical source of truth going forward.
- **"Awwwards style" as a hardcoded aesthetic** — replaced by the closed-set, evidence-driven decision mechanism in `docs/EXPERIENCE_INTELLIGENCE_FINAL.md`; there is no single style to eliminate a duplicate of, because there was never supposed to be only one.

## 4. What this document does not claim

It does not claim the P0/P1 gaps below are closed — see `docs/IMPLEMENTATION_GAP.md`. It does not claim every `[FROM DOCS]` row in the Master Inventory has been independently re-verified this session — accessibility gate wiring and the Places API credential are the two flagged as needing a quick re-check. It does not introduce a Control Plane implementation — only the module boundary it should occupy once built.
