# BusinessForge — Provider Pool (Final)

Principle stated in the brief, enforced here: BusinessForge must not depend conceptually on one AI. Hermes is a decision *function* of BusinessForge (`lib/workflow/hermes.ts`, `decideOnly:true`) — never an external chatbot BusinessForge calls into for authority. Every model below is a **worker** the capability router can pick, rank, or fail over from; none of them is "the brain."

Four axes, kept separate per instruction:

- **MODEL** — the specific model id/version.
- **PROVIDER** — who serves it (API vendor).
- **CAPABILITY** — what capability slot(s) in `lib/capability/registry.ts` it can fill (text-reasoning, structured-output, vision-critique, code-adjacent generation, etc.).
- **ROLE** — what job BusinessForge actually gives it (workhorse writer, vision QA critic, cost-floor fallback, anti-lock-in alternate).

## Active pool

| Provider | Model(s) | Capability | Role | Cost status | Reliability | Implementation | Keep/Remove | Fallback position |
|---|---|---|---|---|---|---|---|---|
| Anthropic | Claude (current family) | text-reasoning, structured-output, code-adjacent generation | Frontier-quality worker — highest-stakes reasoning steps (evidence synthesis, design direction) | Paid, `priceConfidence: observed` | REAL/INTEGRATED/TESTED | `lib/capability/models.ts` + `invokers.ts` | **KEEP** | Primary for high-stakes steps; not the sole path for any capability |
| Google | Gemini | text-reasoning, structured-output, vision | Default free-tier worker | Free tier, `priceConfidence: observed` | REAL/INTEGRATED/TESTED, **only vendor confirmed live-called in a proof run** | same | **KEEP** | First-choice default; flagged as a single point of failure until a second free-tier path is actually exercised live, not just coded |
| OpenAI | GPT (current vision-capable model) | vision-critique, structured-output | Vision QA critic path | Paid | REAL/INTEGRATED/TESTED | same | **KEEP** | Used specifically where vision judgment is required |
| OpenRouter | multiple, incl. `:free` tier models | text-reasoning (routing layer) | Anti-lock-in layer — one integration point reaching many vendors | Mixed (some free) | REAL/INTEGRATED/TESTED | same | **KEEP** | `:free` membership needs a liveness probe — not built yet (P1) |
| DeepSeek | DeepSeek (current model) | text-reasoning | Cost floor | Paid, low cost | REAL/INTEGRATED/TESTED | same | **KEEP** | Jurisdiction (CN data residency) is an open policy question, not a code gap — do not treat as blocking, but do not silently promote to default either |
| Cerebras | `gpt-oss-120b` | text-reasoning (fast inference) | Speed-optimized worker, currently unpriced-confident | Unknown/unverified pricing — `priceConfidence: 'estimated'` (fixed this session; this is intentionally the one entry in the catalogue marked this way) | REAL/INTEGRATED/TESTED | same | **KEEP** | Gated correctly behind `unpriced-blocked` unless `allowUnverifiedPricingFor` explicitly names it — do not relax this gate without a real published price |
| xAI | Grok | text-reasoning (adapter exists) | **None assigned — zero capability bindings, by design** | N/A | REAL adapter, explicitly zero bindings (test-asserted) | same | **KEEP the adapter, KEEP it unbound** | Do not wire without a measured reason; research corpus and current test both agree no property BusinessForge needs is exclusive to Grok among the four other active vendors |

## Evaluated, not adopted

| Provider | Model(s) | Status | Decision | Why |
|---|---|---|---|---|
| Groq | LPU-hosted open models | EVALUATED ONLY — no adapter | **ADD (P1)** | Research corpus rates it the best free-tier find in the whole evaluation; a second live-exercised free path directly addresses the Gemini single-point-of-failure flag above |
| Mistral, Qwen, Kimi, GLM, Llama/HF-hosted models | various | EVALUATED ONLY | **REJECT dedicated adapters** | Already reachable through OpenRouter if ever genuinely needed; building direct adapters duplicates that anti-lock-in layer for no new capability. CN-origin ones share DeepSeek's jurisdiction question — that question should be settled once, not per-vendor |

## Non-negotiable invariants (already enforced in code, restated here so they aren't relitigated)

- No model writes raw bytes directly to a customer-facing artifact outside the fenced Forge writing modules and the interactive-only, statically-proven-unreachable CLI autofix path (`test/qa/no-agent-spawn.test.ts`).
- `priceConfidence: 'estimated'` capabilities are excluded from planning (`unpriced-blocked`) unless explicitly allowed per-run, never globally.
- Hermes's `decideOnly:true` boundary is not crossed by any provider — no model call inside `hermes.ts` is permitted to also repair; repair is a distinct capability call issued by the orchestrator after Hermes decides.

## What this document deliberately does not do

It does not pick a single "primary model" for BusinessForge as a brand identity. The whole point of the capability router (`lib/capability/orchestrator.ts`) is that the answer to "which model wrote this business's website" is allowed to vary per capability, per run, and per failover event — that is the anti-lock-in property the brief asks for, and collapsing it back down to one privileged vendor here would undo it.
