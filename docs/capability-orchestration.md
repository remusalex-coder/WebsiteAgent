# Capability orchestration

_Added 2026-08-19._

`lib/capability/` is the layer Hermes calls to decide **which provider, which
model, which tool, which skill, which agent, in what order, with what
fallback** — the question the freeze's Capability Router (`lib/ai/router.ts`)
and Agent Pool (`lib/factory/pool.ts`) each answered for one slice of the
problem, and that nothing spanned end to end.

## Why this exists

Before this layer, "capability" meant three different things in three places:
`RouterCapability` (three values, provider-only), `FactoryCapability` (five
values, LLM-pool-only), and the skill layer's eight *categories*, which were
never capabilities at all. None of the three could answer "what can this
deployment do right now, and what would it cost" across a model, a skill, an
MCP server and an in-repo tool in one call. `lib/capability/` is that answer,
built on top of the router and the pool rather than replacing either — every
prior capability id and its tests are untouched.

## The pieces

```
types.ts        the vocabulary: CapabilityId, ServiceBinding, ModelRecord
registry.ts      one row per capability — tier, terminal, F-08 flag, gate
bindings.ts      what can serve each capability, in declared preference order
models.ts        the model catalogue: classes resolved to ids, cost estimates
quota.ts         the daily per-model request ledger (the free tier's real limit)
plan.ts          capability in, ordered chain out — filter, then rank
execute.ts       walks a plan: governs, meters, records, fails over
invokers.ts       the standard model invoker `execute` plugs into
agents.ts        the seat roster: who consumes what, k, cross-vendor pairs
experience.ts    the runtime ladder (none→css→js→webgl) and the library register
orchestrator.ts  the stateful object: credentials, quota, governor, spend
index.ts         the only import path agents and stages should use
```

## Reading a plan

```ts
const plan = platform.capabilities.plan('craft_judging', { excludeProviders: ['gemini'] });
// plan.chain:    [{ binding: openai.vision, model: {...}, estimatedCents: 0, free: true }, ...]
// plan.excluded: [{ service: 'anthropic.vision', reason: 'no-credential', detail: '...' }]
// plan.hasTerminal: true   — ends at "uncertain", which blocks delivery (F-07)
```

Filters are hard — a filtered candidate is gone, not ranked last. Two filters
are safety properties, not preferences, and nothing can outrank them:

- **F-08** (`modelMayWriteOutput: false`) removes every model from a
  capability whose output must never be model-authored — evidence collection,
  creative direction, the design memory. A judgement (a verdict, a critique, a
  description) is not a write, so the visual jury and the director's own
  capability *are* modelled; see `isJudgement` in `plan.ts` for the one place
  that distinction is made.
- **Quota exhaustion** removes a model whose free allowance is spent today,
  rather than ranking it behind a paid one — a model that will return 429 is
  not a slow option, it is not an option.

Ranking, once filtering is done: free before paid, cheaper before dearer,
more-available before less (observed), faster before slower (observed),
then the repository's declared preference.

## Running a plan

```ts
const result = await platform.capabilities.run(
  'prose_writing',
  createModelInvoker({ system, prompt, schema, maxTokens }, config.ai, logger),
);
```

`run` plans, then walks the chain: acquires a rate-governor token, charges the
quota ledger *before* the call (so a crash mid-call cannot un-spend it), invokes,
records telemetry, and on a thrown step fails over to the next member — ending,
for a capability that declares one, at the deterministic terminal. Cost lines
accumulate on the orchestrator, so `platform.capabilities.spend()` and
`.remainingCents()` reflect everything spent so far in the run, and a later
`plan()` call in the same run sees the shrunken budget.

## The board

```bash
npm run capability-board            # human-readable
npm run capability-board -- --json  # for a run's own artifacts
```

Plans every capability at once. Contacts nothing — no provider constructed, no
network touched — so it is safe to run on every deploy and to persist
alongside a job's artifacts as the honest record of what that run could
actually do.

## Cost model

Every price in `models.ts` is a **routing estimate in euro cents per million
tokens**, not a quoted rate — coarse on purpose, so the planner can order
candidates by plausible cost without pretending to bill from them. The cost
*ledger* (`lib/cost/`) is the actual accounting, built from provider
provenance after a call returns. Nothing here replaces it; this decides who to
ask first.

The platform's default policy is `allowPaid: false`, `budgetCentsRemaining: 0`
(see `DEFAULT_POLICY` in `plan.ts`) — the same €0 baseline every other part of
this repository holds. Widening it is a `capabilityPolicy` passed to
`createPlatform`, which shows up in the plan's exclusion ledger either way: a
paid model appears as `paid-disabled` when the policy forbids it and as a real
chain member when it does not.

## Gates that no budget clears

`registry.ts`'s `gate` field is a policy stop, not a ranking penalty:

- `no-model` — evidence collection, PII detection, every QA measurement.
  Fails loudly rather than degrading to a guess, because a measurement that
  degrades is worse than no measurement at all.
- `human` — hosting, image editing, motion generation. `autonomouslyPlannable`
  refuses these on an autonomous run; they become plannable the moment a
  caller passes `policy: { autonomous: false }`, which only a human-attended
  path does.
- `never` — 3D generation, audio. Declared and rejected, so "why doesn't
  BusinessForge do X" has an answer with a reason attached, not silence.

## The runtime ladder (`experience.ts`)

`decideRuntimeTier` climbs `none → css → js → webgl` on evidence alone —
photograph count, offering count, whether the business tells a story, whether
it is looked at or read about — never on industry, a flag, or a tier the
operator paid for. The library register records what was adopted (native CSS,
the repository's own runtime and shader modules, GSAP, Three.js — each with
its minimum tier and its weight) and what was rejected (Lenis, Lottie, Rive,
Spline), with the reason kept next to the rejection rather than only in a
conversation.

## The agent roster (`agents.ts`)

One seat per named responsibility, checked against reality by
`test/capability/agents.test.ts`: an `implemented` or `deterministic` seat
must name a module that exists on disk; a `planned` seat must name none, so
the roster cannot claim more than the repository has built. `k > 1` appears on
exactly three seats — the market researcher (corroborative), the visual jury
(gating), and the planned Creative Director's design battle (comparative) —
and every other seat runs one at a time, because parallelism is not free and
running several agents to feel thorough is not a reason.

## What is genuinely new here versus what already existed

**Already existed, unchanged:** `lib/ai/router.ts` (provider filter → rank →
select → failover), `lib/ai/governor.ts` (per-vendor rate bucket),
`lib/factory/pool.ts` and `capabilities.ts` (role-based LLM pools),
`lib/cost/lease.ts` and `ledgerEntry.ts` (budget leases, cost accounting from
provenance), the skill and MCP managers. This layer calls into all of them; it
duplicates none of them.

**New:** the cross-cutting capability vocabulary, the model catalogue with
per-class cost and free-allowance data, the daily quota ledger (the constraint
that actually binds a free-tier deployment, which nothing previously tracked
across a restart), the planner that ranks across kinds and on cost rather than
only across providers on latency, the executor that wires governance/quota/
telemetry/cost around any capability call, the agent seat roster, and the
creative runtime ladder with its library adopt/reject register.
