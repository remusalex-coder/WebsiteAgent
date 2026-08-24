# BUSINESSFORGE 2.0 — CONTROL-PLANE AUDIT (atac la planul de control)

*Read-only research. Repo/netouched, n8n untouched, no implementation. Every claim below is grounded in the actual control-plane code: `scripts/n8n/stage-server.ts`, `scripts/n8n/stage.ts`, `lib/workflow/hermes.ts`, `lib/workflow/runJob.ts`, `lib/workflow/jobState.ts`, `lib/qa/visual-critic.ts`, `lib/qa/distinctness-gate.ts`, `lib/ai/factory.ts`, `lib/ai/protocol.ts`, `lib/config.ts`, `n8n/businessforge-workflow.json`.*

---

## 0. TL;DR VERDICT

The control plane is **well-built for a single sequential run on one machine, and dangerously under-built for autonomous production.** The retry/transport layer is genuinely good (honest retryable classification, jittered backoff, atomic state writes, path-traversal guard). But:

- **Authority is fragmented across 3 places** (n8n graph, `stage.ts`, `hermes.ts`) and there are **two diverging copies of the same state machine** (`runJob.ts` `for(;;)` vs n8n JSON).
- **No concurrency control beyond one in-process promise chain** → same-runId races, no intra-run parallelism (the "battle" cannot run in parallel), no cross-run throttling.
- **Zero rate limiting. Zero budget leases. Zero LLM failover.** One vendor SPOF, unbounded cost if `maxIter` is cranked.
- **Deterministic QA passes a generic site when vision is off** (default) — the pixel-level check is bypassed, and cross-site template detection is off because `peers.json` is empty.
- **Security: a plaintext shared token is committed into the n8n JSON**, the n8n webhook has no auth, the stage server is LAN-exposed (`0.0.0.0`), and there is **no PII handling** for scraped business data at rest or for screenshots egressing to a third-party vision endpoint.
- **No real checkpoint/resume**: `job.json` is write-only persistence; a crash restarts from Build. No dead-letter, no human ping on escalation.

This is a *research prototype's* control plane wearing a *production* costume. Below, the evidence and the redesign.

---

## A. AUTHORITY: n8n vs HERMES

**What the code actually says:**
- n8n (`businessforge-workflow.json`) is the **top-level orchestrator**: `Webhook → Create Job → Build → Browser → Visual Critic → Distinctness Gate → Hermes Decision → Reconcept? (IF) → (loop to Build) | Report`.
- Hermes (`hermes.ts`) is **not a control engine**. It is a single pure function `decide({gate, job}) → {action, nextStage, iteration, rationale}`. It holds *no state*, runs *no loop*, and *cannot* re-sequence stages.
- The real transition logic is split:
  1. **n8n JSON** — the loop *topology* (which node feeds which).
  2. **`stage.ts`** — *which* stage executes + sets the `loop` boolean the IF node reads.
  3. **`hermes.ts`** — the *decision* (deliver / escalate / continue).

**Attack:** Authority is implicit and distributed. n8n "thinks" it owns the loop (it does the branching), but it only understands a `loop: true/false` boolean — it is blind to `iteration`, `route`, or `rationale`. All judgment is in code; n8n is a dumb sequence executor wearing an orchestrator's clothes. Worse: **there are two implementations of the same machine** — `runJob.ts` (`for(;;)` + `decide`) for direct runs, and n8n+`stage-server` for "production". They must be kept in sync by hand. They already disagree on `maxIter` semantics (runJob default 3; n8n passes it as a query param, validated 1..20).

**Recommendation (architecture, no code):** Make Hermes the *single* authority — a real state machine (explicit `State × Event → next State` table) that emits the next stage; n8n becomes a *dumb executor* that calls `GET /stage/next?runId=` and runs whatever stage Hermes names, until Hermes says `TERMINATE`. One machine, one source of truth, both execution paths share it.

---

## B. STATE MACHINE

**Evidence:** n8n has exactly **one** conditional branch (`Reconcept?` IF on `$json.loop`). There is no state registry, no transition table, no explicit states beyond the `JobStage` enum in `jobState.ts` (which is just a label written to disk, not a control construct).

**Attack:** It is a *linear pipeline with a single back-edge*, not a state machine. You cannot express:
- "if critic failed twice, skip to escalate"
- "if build succeeded but browser failed, re-run only browser (resume), not the whole build"
- "parallelize the 3 battle concepts, then join"

All of that is impossible without restructuring n8n by hand. The `JobStage` enum is decorative — nothing routes on it.

**Recommendation:** Model the lifecycle as an explicit FSM: `CREATED → BUILD → BROWSER → CRITIC → GATE → (PASS→DELIVER | FAIL→{CREATIVE|EXPERIENCE|BUILDER|DIRECTOR}→REBUILD) → … → DELIVER|ESCALATE`. Hermes owns the transition function. Enables resume, partial re-runs, and parallel fan-out.

---

## C. CONCURRENCY

**Evidence (`stage-server.ts`):**
```ts
let queue: Promise<unknown> = Promise.resolve();
function serialise<T>(work) { const next = queue.then(work, work); queue = next.catch(()=>undefined); return next; }
```
Every `/stage/*` call is chained through **one module-level promise**. Reason stated in code: stages mutate shared `job.json`, so overlapping writes would corrupt.

**Attacks:**
1. **Per-process only.** The `queue` lives in one Node process. A second stage-server instance, or two n8n webhook hits for the *same* `runId`, bypass it entirely → interleaved `job.json` writes → corruption. There is **no job-level lock** (no flock, no Redis lock, no DB row lock).
2. **No intra-run parallelism.** `runJob.ts` loops `for(;;)` *sequentially*: build → browser → critic → gate → hermes → rebuild. The "Design Battle" (3 divergent concepts) **cannot run in parallel** — there is no fan-out. Each iteration rebuilds ONE design.
3. **No cross-run throttling.** 100 webhook calls = 100 simultaneous `composeStandalone` + 100 Playwright launches + 100 vision calls, all hammering the single `AI_PROVIDER`. No semaphore.
4. **Playwright is serial**: one browser, desktop page then mobile page, sequentially (`captureScreenshots`).

**Recommendation:** (a) Job-level distributed lock keyed on `runId` (Redis/DB) so even multi-instance is safe. (b) Real fan-out: battle concepts run as parallel agents, aggregated in code. (c) A global concurrency semaphore + per-vendor RPM limiter in front of the provider layer.

---

## D. RATE LIMITS

**Evidence (`config.ts`, `factory.ts`, `protocol.ts`):** Config exposes `requestTimeoutMs` (300 000), `maxRetries` (3), `retryBaseDelayMs` (1 000). **There is no `rateLimit`, no RPM cap, no concurrency limiter, no token/min budget anywhere.**

`protocol.ts` classifies `429`/`5xx`/`transport` as `retryable: true` and `4xx`/auth/refusal as `false` — *good*. `factory.withRetry` does exponential backoff with **full jitter** — *good*. But:
- It **ignores `Retry-After` headers** — jitters `1s → 2s → 4s` regardless of what the vendor asks.
- 3 retries max → ~7s of backoff then gives up.

**Attack:** No client-side rate limiting means BusinessForge *causes* 429s under load instead of preventing them, then relies on retry. At scale (many parallel runs) this is a thundering herd.

**Recommendation:** Add a token-bucket / sliding-window limiter per vendor (respect `Retry-After`), and a global concurrency semaphore, in the provider layer — before the retry wrapper.

---

## E. BUDGET LEASES

**Evidence:** **None.** No cost budget, no token ceiling, no per-run spend cap, no "lease" that expires. `config.ts` has `maxTokens` *per call* but nothing aggregate. The loop is bounded only by `maxIter` (default 3, n8n-validated 1..20).

**Attack:** Each reconcept = full `composeStandalone` + Playwright screenshot + **13-axis vision critic call** (expensive). With `maxIter=20` from the n8n query param, a single stuck job does **21 builds + 21 vision calls** with zero spend ceiling. There is no way to say "stop this run after $2". For an autonomous system this is a financial SPOF.

**Recommendation:** Per-run budget lease (token count + USD ceiling) tracked in `job.json`; Hermes checks remaining budget *before* each rebuild and escalates when exhausted. Default maxIter should be 2–3, not 1..20.

---

## F. RETRIES / FALLBACKS

**Retries — good:** `withRetry` is honest and well-built (see D).

**Fallbacks — absent:**
1. **No LLM failover.** `factory.createDefault()` picks ONE provider from `AI_PROVIDER`. If it's down after retries, the stage throws → n8n gets 500 → run fails. OpenRouter is "many models" but still *one configured vendor*; no automatic vendor switch (Anthropic→OpenAI→Gemini).
2. **No stage-level fallback in n8n.** The HTTP Request nodes have `timeout: 900000` but **no `onError`, no `retryOnFail`, no `continueOnFail`**. Any 500 = the whole execution dies; no recovery, no re-queue.
3. **Vision-off → silent pass.** `visual-critic.ts` degrades to `genericVerdict:'uncertain'` (safe floor — *good intent*). But `distinctness-gate.ts` does:
   ```ts
   if (reasons.length === 0) return { verdict: 'PASS', ... }
   ```
   `reasons` is only populated if critic says `generic`, OR `experience.overall < 70`, OR cross-site `template-smell`. With **vision OFF (default)** and deterministic scores ≥70, `reasons.length === 0` → **PASS with zero pixel inspection.** The visual critic is a no-op in the default config.

**Attack:** The entire *distinctiveness* guarantee collapses to "did the deterministic scorer like the JSON" when vision is off — which is the shipping default. A technically-correct-but-generic site **passes all QA.**

**Recommendation:** (a) Multi-vendor failover in the factory (try list, not single). (b) n8n error handling: retry-with-backoff node + dead-letter on permanent failure. (c) Gate must treat `uncertain` vision as **FAIL-or-defer**, never as a free pass — either require vision ON for delivery, or downgrade the verdict to "needs-human" when the pixel judge is absent.

---

## G. TERMINATION

**Evidence (`hermes.ts` order of checks):**
1. `gate.verdict === 'PASS'` → deliver.
2. `job.iteration >= job.maxIter` → escalate.
3. `gate.route ∈ {escalate, deliver}` → escalate.
4. else → continue (iteration+1).

**Good:** The loop is **bounded by `maxIter`** — no infinite loop in code. `runJob.ts` also breaks the reconcept loop if `reconceptBuild` throws (escalate + return).

**Attacks:**
- **n8n trusts the `loop` boolean blindly.** The `Reconcept?` IF node only reads `$json.loop`. If Hermes ever returned `loop:true` without the iteration having incremented (a save bug), n8n would loop forever — n8n has no independent iteration guard. The safety lives only in `hermes.ts`'s arithmetic, which n8n does not re-check.
- **`maxIter` 1..20 is too loose** (see E) — combined with no budget, a misconfigured run can burn 20 iterations.
- **Escalation is a dead end.** When Hermes says `escalate` (human), the n8n workflow ends at the `human` stage and **nothing pings a human.** No notification, no ticket, no queue. The job silently waits forever.

**Recommendation:** n8n should enforce its *own* iteration ceiling (read `iteration`/`maxIter` from the stage result, not just `loop`). Escalation must trigger a notification (email/Slack/webhook). Termination conditions centralized in Hermes's FSM.

---

## H. CHECKPOINT / RESUME

**Evidence:** `job.json` is written after every stage via **atomic temp+rename** (`jobState.ts saveJob`) — *good, no half-written state*. `loadJob` reads it.

**But:** There is **no resume path.**
- n8n webhook always starts at `Create Job → Build` (full rebuild). `runJob.ts` always `createJob` fresh.
- `stage.ts` `create` case does `saveJob({stage:'created'})` but never *restores* prior artifacts to continue mid-run.
- Stages are **not idempotent** — replaying one (e.g. n8n auto-retry) re-runs it from scratch.
- `composeStandalone` re-renders the entire site each loop rather than resuming from the failed stage.

**Attack:** A crash at iteration 2 of 3 means **restart from zero** — you pay for builds 1 and 2 again, and lose the partial design. For an autonomous system that may run unattended for minutes, this is both wasteful and fragile. `job.json` is *persistence*, not *resume*.

**Recommendation:** Promote `job.json` to a real resume cursor: each stage is idempotent and checks "do I already have valid output for this stage at this iteration?"; on restart, Hermes reads `job.json` and resumes from the first incomplete stage. Add an execution idempotency key per `(runId, stage, iteration)`.

---

## I. DETERMINISTIC QA

**Evidence (`distinctness-gate.ts`):** Combines `scoreExperience` (threshold 70) + `narrativeCoherence` + `genericityReport(peers)` + `visualCritic.genericVerdict`.

**What works:** The deterministic scorers are real and structural (explainability, business specificity, coherence). The *intent* to catch template-smell is present.

**What's broken (the core gap):**
1. **Pixel check bypassed by default.** Vision is opt-in (`VISION_*` env). Off → `uncertain` → `reasons.length===0` → **PASS**. So the *only* layer that can see "does this look like a template with the name swapped in" is disabled in shipping config.
2. **Cross-site detection off.** `genericityReport` runs *only* if `peerDesigns.length > 0`. `peers.json` is almost always empty → the system cannot detect that it's generating the *same* site for different clients.
3. **Threshold 70 is on the deterministic score, not on distinctiveness.** A site can score 72 structurally and still be a brochure.

**Attack:** The deterministic gate can certify a generic, template-smelling, visually-banal site as "distinct" — exactly the failure mode the whole system exists to prevent. The anti-template guarantee is **not enforced** by default; it is *available* but off.

**Recommendation:** (a) Require vision ON (or route to human) for any `deliver`. (b) Seed `peers.json` automatically from the design-memory corpus so cross-site repulsion is always active. (c) Add a hard distinctness floor independent of the structural score (reference-distance / embedding repulsion) that fails even a "perfect" deterministic site if it's too close to a peer.

---

## J. SECURITY

**Evidence — multiple real issues:**
1. **Plaintext shared token committed to n8n JSON** (`businessforge-workflow.json`, every HTTP node): `x-bf-token: 8ab99ef780a48746d362a42e5ba2f0594152e266d012a80c`. A secret in a workflow file under version control. No rotation, no env indirection.
2. **n8n Webhook Trigger has no auth** — anyone who can reach n8n can trigger runs.
3. **Stage server binds `0.0.0.0:7717`** (LAN-exposed) because Docker reaches the host via `host.docker.internal`. Guarded only by the static token. On a shared LAN, any host can call `/stage/build?runId=...`. (`runId` regex `/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/` *does* prevent path traversal — credit where due.)
4. **No rate limiting on `/stage/*` or `/health`** — a LAN actor can spam builds.
5. **`serialise` is the only write-guard** — see C.1 (bypassed by multi-instance / same-runId double-trigger).

**What's good:** n8n 2.x excludes `executeCommand` by default (no shell from workflow); `runId` path-traversal guard; agents never import providers (vendor choice out of stages); atomic state writes.

**Recommendation:** Move the token to an n8n credential / env var (rotate the leaked one). Add webhook auth (header/JWT). Bind stage-server to `127.0.0.1` and have n8n reach it via a secure tunnel or same-network proxy with mTLS; or front it with a short-lived token + per-run ephemeral token. Add request rate limiting. Treat the leaked token as burned.

---

## K. PII

**Evidence:**
- `3-profile.json` holds business identity (name, category, description) scraped from Maps/Places. `shots/` holds **rendered-site screenshots** which typically include the business's **address, phone, opening hours, owner names** (scraped content).
- All persist in `output/<runId>/` with **no encryption at rest, no redaction, no retention policy, no access control** beyond filesystem perms.
- **Screenshot egress:** `visual-critic.ts` base64-encodes `desktop.png` + `mobile.png` and POSTs them to `VISION_BASE_URL` (any OpenAI-compatible endpoint). If that's a third-party/cloud vision provider, the client's **rendered site with its PII leaves the machine** — with no DPA, no redaction, no consent record.
- No PII scan before egress; no masking of addresses/phones in screenshots sent for critique.

**Attack:** For a system that will process *real client businesses*, this is a compliance landmine (GDPR — the user is in Romania/EU). Scraped PII sits unencrypted, and is shipped to a vision model with no safeguards.

**Recommendation:** (a) Classify `output/<runId>/` as PII-bearing; encrypt at rest or restrict perms; define retention + deletion. (b) Before screenshot egress, redact detectable PII (address/phone/email) in the image, or run the critic on a *local* vision model (Qwen-VL via Ollama) so PII never leaves the box. (c) DPA with any external vision provider; log egress.

---

## L. FAILURE RECOVERY

**Evidence:**
- Provider failure → retry 3× → throw → stage 500 → **n8n execution fails with no error handler** (nodes have no `onError`).
- Vision failure → safe `uncertain` (good), but then passes (see F.3).
- Reconcept build throws → `runJob.ts` escalates + returns; in n8n path the throw → 500 → execution dies.
- Escalation → workflow ends, **no human notified** (see G).
- Crash mid-run → **restart from Build**, no resume (see H).
- Stage-server is a **single Node process** holding the `queue`; crash kills all in-flight runs, no HA, no clustering.

**Attack:** There is no dead-letter queue, no retry-with-backoff at the workflow level, no human-in-the-loop on escalation, no resume, and a single-process SPOF. For "autonomous, zero manual steps" this means: when anything non-trivial goes wrong, the run either dies silently or waits forever for a human who is never paged.

**Recommendation:** (a) n8n error workflow (`settings.errorWorkflow`) catching failures → DLQ + alert. (b) Hermes escalation → notification + ticket. (c) Resume-from-checkpoint (H). (d) Stage-server: make stateless + horizontally scalable (state in `job.json`/DB; lock in Redis), or run as a supervised/replicated service.

---

## M. RECOMMENDED CONTROL-PLANE (target architecture — no code)

```
┌─────────────────────────────────────────────────────────────┐
│ n8n  = DUMB EXECUTOR  (no branching logic, no auth-less trig) │
│   trigger → call Hermes.next(runId) → run named stage → loop  │
└─────────────────────────────────────────────────────────────┘
            │ polls the authority
            ▼
┌─────────────────────────────────────────────────────────────┐
│ HERMES  = SINGLE STATE MACHINE  (FSM: State × Event → State)  │
│   - owns ALL transitions (build/browser/critic/gate/rebuild/   │
│     deliver/escalate)                                         │
│   - enforces: iteration ceiling, BUDGET LEASE, PII policy,     │
│     resume cursor, human-ping on escalate                     │
│   - reads job.json (resume) + design-memory (peers)           │
└─────────────────────────────────────────────────────────────┘
            │ dispatches stages (with job-level distributed lock)
            ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE LAYER (idempotent, resumable, parallel-capable)         │
│   battle: 3 concepts FAN-OUT in parallel → aggregate          │
│   critic/gate: REQUIRE vision ON (or route human)             │
│   cross-site: peers.json auto-seeded from design-memory       │
└─────────────────────────────────────────────────────────────┘
            │ provider calls go through
            ▼
┌─────────────────────────────────────────────────────────────┐
│ PROVIDER LAYER (upgrade factory.ts)                           │
│   - multi-vendor FAILOVER (try-list, not single)              │
│   - per-vendor RPM limiter + global semaphore (respect        │
│     Retry-After)                                              │
│   - per-run BUDGET LEASE (tokens + USD) checked by Hermes     │
│   - local vision (Qwen-VL/Ollama) option → PII stays in box  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ PERSISTENCE = job.json (resume cursor) + design-memory (Qdrant)│
│   encrypted at rest (PII), retention policy, egress logged     │
└─────────────────────────────────────────────────────────────┘
```

**Must-fix before "autonomous, zero-manual" can be claimed:**
1. Hermes as the single FSM authority (kill the dual n8n/`runJob.ts` machine).
2. Job-level distributed lock + intra-run fan-out (parallel battle).
3. Per-vendor rate limiter + global semaphore + `Retry-After`.
4. Multi-vendor failover in the factory.
5. Per-run budget lease; cap `maxIter` at 2–3.
6. Gate: `uncertain` vision ⇒ fail/defer, never pass; auto-seed peers.
7. Real resume-from-checkpoint (idempotent stages + cursor).
8. Rotate the leaked token; n8n webhook auth; bind stage-server to localhost + tunnel; rate-limit it.
9. PII: encrypt at rest, redact/keep-local for screenshots, DPA + egress log.
10. n8n error workflow → DLQ + human alert on escalation; stage-server HA/stateless.

---

*Read-only. No repository or n8n modification. Findings grounded in the cited source files.*
