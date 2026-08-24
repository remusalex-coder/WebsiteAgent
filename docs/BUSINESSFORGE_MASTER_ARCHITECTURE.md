# BusinessForge — Master Architecture

> **Note (2026-08-24):** written against branch `design-director-smoke` at 1366/1366
> tests; T01–T10 have since shipped (deploy stage, Groq adapter, OpenRouter free
> liveness probe, CI pipeline, stage-ledger persistence, motion-intensity reduced-motion
> gate) at 1406/1406 tests. Treat the architectural shape described here as still
> accurate; treat specific "not yet built" gaps as needing a fresh check against
> `docs/MASTER_INVENTORY.json` and `docs/IMPLEMENTATION_GAP.md`, which reflect the
> current state.

**Companion to `docs/BUSINESSFORGE_MASTER_INVENTORY.md`.** That document says what exists and its verification status; this one says how the pieces fit together — today, and where the gaps in §9 of the inventory point next. Written from direct code verification (branch `design-director-smoke`, 1366/1366 tests passing), not from the aspirational V2 architecture proposals in the top-level `BUSINESSFORGE_2.0_*.md` files, which remain useful *design input* for the open decisions called out below but are not re-stated here as if already built.

## 1. The job, end to end

```
 business URL / info
        |
        v
 [1] Discovery            agents/discoveryAgent.ts        Maps scrape, signed-out, €0
        |
        v
 [2] Collector             agents/collectorAgent.ts        site crawl: text, images, contacts
        |
        v
 [3] Normalizer            agents/normalizerAgent.ts       merge -> BusinessProfile
        |
        v
 [4] Business Analyst      agents/businessAnalystAgent.ts  -> BusinessStrategy   (capability-routed)
        |
        v
 [5] Writer                agents/writerAgent.ts           -> WebsiteContent     (capability-routed)
        |
        v
 [5a] AI Design Director    agents/designDirectorAgent.ts   optional, DIRECTOR_ENABLED flag
        |                    -> DesignDirective (11 fields; 2 mechanically applied,
        |                       runtimePrimitives shape-extracted + registry-checked,
        |                       the rest advisory/logged)
        v
 [5b] Design (deterministic) lib/design/*.ts   character -> experience -> assets ->
        |                                       conversion -> interaction -> script
        v
 [5c] Content Director      lib/content/*.ts    evidence-grounded prose, basis-tagged,
        |                                       language follows evidence language
        v
 [6] Render                 lib/render/*.ts     pure, deterministic, escaped HTML/CSS,
        |                                       no JS unless a runtime primitive earned it
        v
 [6b] Forge enhancement     lib/forge/orchestrator.ts   ADDITIVE ONLY. Builds into an
        |    (optional)      lib/forge/decide.ts         isolated candidate dir. Ships only
        |                                                 if shouldShipEnhancedSite(verdict)==PASS.
        |                                                 Render's own output is always the floor.
        v
 [7] Browser capture        lib/forge/browser.ts, lib/qa/layout-audit.ts   Playwright, real render
        v
 [8] Visual QA / jury       lib/qa/{visual-qa,visual-critic,jury,verdict,distinctness-gate}.ts
        v
 [9] Repair (constrained)   lib/forge/repair.ts             NOT the Claude-Code autofix path (see §5)
        |  <----------------loops back to [7], bounded by maxIter---------------|
        v
 [10] Preflight gate        lib/qa/preflight.ts + lib/qa/gates/*.ts
        |                    security + accessibility BLOCK; performance is a caveat, not a blocker
        v
 [11] Hermes decision       lib/workflow/hermes.ts          decideOnly:true, always
        |                    PASS -> deliver | iteration>=maxIter -> escalate |
        |                    gate says escalate/deliver -> escalate | else -> continue (loop to [7])
        v
 [12] Deliver / Escalate     DELIVERED | ESCALATED | ABORTED   (terminal states)
```

Everything from [1]-[6] runs €0 by default (deterministic or free-tier AI). [6b]-[9] is where real model spend can happen, gated by the capability router's budget policy (`lib/capability/plan.ts`) — including the `unpriced-blocked` gate this session's fix restored, which stops an unverified-price candidate (Cerebras) from spending real money unless explicitly allowed.

## 2. Orchestrator / control-plane split (what's real today)

There is **not yet** a single "Control Plane" object of the kind `ARCHITECTURE_FREEZE.md`/`BUSINESSFORGE_2.0_ARCHITECTURE_V2.md` describe (sole owner of state, transitions, budget, retries, delivery, escalation). What exists today is narrower and more honest about its own scope:

- **`lib/workflow/hermes.ts`** decides deliver/escalate/continue from the gate's verdict and the iteration count. It does not own budget, does not own retries directly, and does not itself drive the loop — it's a pure decision function, called at the end of each iteration.
- **`n8n` (`n8n/businessforge-workflow.json`)** is the outermost driver: accepts an order, starts the job (`POST /job`), polls it (`GET /job`), reports the outcome. It owns no decision logic of its own — the loop that used to live in an n8n `IF` node now lives entirely host-side in `runJobFull` (`scripts/n8n/stage.ts`). If n8n is down, `scripts/run-job.ts` runs the identical loop directly — same code path, different trigger.
- **`lib/capability/*`** is the provider/model router: filters by credential/budget/licence/jurisdiction, ranks, selects, executes, fails over cross-vendor. This is a genuinely separate concern from Hermes's deliver/escalate/continue decision — the router picks *which model* answers a given capability request; Hermes decides *what happens to the job* once a stage's output is in hand. Keep this split; multiple docs agree conflating "model routing" and "job control" was a real design smell in earlier proposals.

**Open question, not resolved in code**: whether `lib/workflow/{jobState,state}.ts`'s stage vocabulary is the one `runJob.ts`/`stage.ts` actually use, or whether the three-vocabulary duplication multiple 2026-08-14 docs found is still present. This needs a direct check (inventory §9.3) before any further control-plane work — building a real Control Plane on top of a stage vocabulary that doesn't match reality would just add a fourth vocabulary.

## 3. Provider abstraction

```
 capability request (e.g. "structured_generation", "vision", "creative_direction")
        |
        v
 lib/capability/registry.ts    -- what capabilities exist, their gate policy
        |                          (deterministic / model / human / never)
        v
 lib/capability/plan.ts        -- filter candidates: credential present? licence ok?
        |                          jurisdiction ok? budget ok? price verified or
        |                          allowUnverifiedPricing(For) set? (this session's fix)
        v
 lib/capability/bindings.ts    -- rank survivors: free-before-paid, cheapest-first,
        |                          deterministic floor always sorts last (never wins
        |                          on price against a real model, but always available)
        v
 lib/capability/execute.ts /   -- call the winning provider; on failure, fail over to
    invokers.ts                   the next-ranked candidate, cross-vendor
        v
 lib/ai/providers/*.ts         -- Anthropic, OpenAI, Gemini, OpenRouter, DeepSeek,
                                   Cerebras, xAI adapters (xAI has zero bindings by
                                   design — present but unreachable until wired)
```

This is real, tested, and — per the inventory — the one piece of "unify the providers behind one abstraction" that's already fully built, not aspirational. Extending it (Groq, per inventory §9.5) means: add an adapter under `lib/ai/providers/`, add a `ModelRecord` to `lib/capability/models.ts` with an honest `priceConfidence`, add bindings. No router redesign needed.

**Claude, GPT, Copilot as "providers" in the sense the project's vision describes** (Hermes = research/decision, Claude = coding/reasoning, GPT = reasoning/content, Copilot = implementation) is a framing that applies to the *workshop* (how the codebase itself gets built) more than to the *product runtime* (what `lib/capability/` calls to build a customer's site). Conflating the two was flagged as a repeated point of confusion across the docs (`CAPABILITY_ARSENAL.md` draws this line explicitly: "a coding agent is not a capability the product calls"). Keep that line. Claude Code, Copilot, and any future coding agent belong in the workshop/tooling column, never as a `lib/capability/` provider — the one exception (`patchWithClaude`) is deliberately fenced out of the autonomous path (§5).

## 4. Evidence, provenance, and the "never invent" boundary

Every fact that reaches a delivered site is expected to carry a source:

```
 Maps/Places/website scrape/social profile
        |
        v
 lib/sources/*.ts        -- collectedSources.ts tags each fact with its origin;
        |                    authority.ts ranks source trust
        v
 BusinessProfile / evidence bundle
        |
        v
 lib/content/evidence.ts  -- every string later emitted is tagged
        |                     basis: quoted | composed | framing
        v
 groundTestimonials / verifiedFacts / trustSignals (lib/content/*)
        -- discards model-invented quotes, keeps real ones with real attribution;
           never promotes a credential/amenity the listing marked absent;
           never states something the listing explicitly says the business lacks
```

This is enforced, not aspirational — it's covered by real tests (`groundTestimonials`, `verifiedFacts`, `trustSignals` all have dedicated, passing test suites). The `TRUTH_AND_EVIDENCE.md` knowledge-base doc's six-state epistemic model (VERIFIED_FACT/FACT/INFERENCE/ASSUMPTION/CREATIVE_INTERPRETATION/UNKNOWN) is doctrine, not wired code — but the actual `basis` tagging in `lib/content/` implements a working, simpler version of the same idea. Treat the knowledge-base doc as the fuller reference if this ever needs extending, not as something already implemented.

## 5. QA / repair / delivery gate

```
 rendered site (classic, and Forge candidate if attempted)
        |
        v
 Playwright capture (lib/forge/browser.ts) -- real browser, real screenshots
        |
        v
 Mechanical checks: layout-audit (overlap/overflow), structured-data gate,
        accessibility gate, security gate (escaping, safe URLs/images, no injection)
        |
        v
 Visual QA / jury (vision-model critique, >=2 vendors where budget allows)
        |
        v
 Anti-AI-slop gate -- structural convergence vs. real peer corpus (not hardcoded)
        |
        v
 verdict.ts -- lexicographic combination: blocking dims must ALL pass first,
        |       then maximize quality, then break ties on distinctness.
        |       Never a weighted sum. `uncertain` visual verdict is BLOCKING,
        |       not a silent pass-through.
        v
    PASS? --------- no --------> repair.ts (constrained find/replace,
        |                          NOT free-form) --> loop to Playwright capture,
        |                          bounded by maxIter
       yes
        |
        v
 Hermes decideOnly --> deliver / escalate
```

**The one path that touches delivered bytes outside this deterministic loop** is `scripts/visual-qa.ts --autofix`, which spawns Claude Code with file-write access — but only behind a real interactive terminal and human confirmation, and `test/qa/no-agent-spawn.test.ts` statically proves no automated caller can reach it. This is intentionally a *human* workshop tool for fixing an already-delivered-or-escalated run by hand, never part of the autonomous loop above. Keep it that way; do not let a future refactor accidentally give it an automated entry point (the test exists specifically to catch that).

## 6. Persistence, state, resume

**Documented target** (from `ARCHITECTURE_FREEZE.md`, not yet confirmed built): a single job ledger — append-only, content-addressed stage hashes, one resume routine shared by both the CLI driver and the n8n driver, so an interrupted job resumes from its last completed stage instead of restarting.

**What's confirmed in code today, by direct import-graph check this pass** (not by citing old docs): `lib/workflow/candidates.ts` is real and wired (`stage.ts`, `runJob.ts`, `resume.ts` all import it). `lib/workflow/{ledger,resume,runner,projections}.ts` are fully built, individually tested, and have **zero non-test importers** — confirmed disconnected today, not just historically. A job can be reloaded by id via `jobState.ts`'s own `loadJob`/`saveJob` (used in `stage.ts`), which is a simpler mechanism than the content-addressed-hash resume path `resume.ts` implements. So "does a job survive an interruption" depends on which mechanism matters for correctness — worth a direct test (kill a run mid-job, restart, check it doesn't redo completed stages) before trusting either path. See inventory §9.2 — this is now the single highest-confidence, highest-value next fix in the whole inventory.

## 7. Failure handling

- **Transient provider failure** → capability router fails over cross-vendor (tested, real).
- **Budget exhausted / price unverified** → `plan.ts` drops the candidate with a named reason (`over-budget`, `paid-disabled`, `unpriced-blocked`) rather than silently picking something else or erroring — the deterministic floor is always the guaranteed fallback (`kind: 'deterministic'`, sorts last on price but is always selectable).
- **QA finds a blocking defect** → repair loop, bounded by `maxIter`.
- **Iteration ceiling reached without a PASS** → Hermes escalates, carrying the *best* candidate seen (candidate/ledger system's job — re-verify per §6, since one 2026-08-14 doc found the reconcept path could overwrite a better result with a worse one; not re-checked this pass).
- **Vision/critic outage** → documented as non-fatal in test coverage (`bounded revision loop` tests reference this); preflight still runs exactly once at the end regardless.
- **Hermes already escalated** → preflight does not silently promote it back to deliver (tested).

## 8. Deployment

`lib/deploy/netlify.ts` exists; `agents/lovableAgent.ts` is a stub referenced in `main.ts`'s deploy stage with no QA gate in front of it in the automated path — per the inventory docs, this was the one stage that never worked end-to-end (`NotImplementedError` when a key is actually set). **Not re-verified this pass.** If "browser opens automatically, you see the result" (the project's own stated end-to-end product vision) is the target, this is the stage standing between current code and that vision — worth checking directly before assuming Netlify or Lovable is the answer.

## 9. What this architecture deliberately does not claim

- It does not claim a unified "Control Plane" object exists — it doesn't, yet (§2).
- It does not claim job resume is proven working — it's unverified this pass (§6).
- It does not claim the three-stage-vocabulary duplication is fixed — unverified this pass (§2).
- It does not claim Notion vs. this repo's `docs/` as source-of-truth is resolved — that's a product decision for the project owner (inventory §6, Notion section).
- It does not claim deployment is solved (§8).

Each of these is a real, scoped, checkable next step — not a rewrite. See `docs/BUSINESSFORGE_MASTER_INVENTORY.md` §9 for the ranked list.
