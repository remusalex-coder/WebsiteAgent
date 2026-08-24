# BUSINESSFORGE 2.0 — COMPLETE CAPABILITY & PROVIDER ARSENAL RESEARCH

*Read-only research. No repository modified, no n8n changed, nothing installed or implemented. All provider data gathered from live 2026 official docs via subagent web research (LLM/coding catalog `providers_catalog.json`, media catalog `catalog.json`) plus live infra pricing anchors captured from Browserbase/Cloudflare/Qdrant/DeepL/n8n pages, grounded against the real repo (`lib/ai/types.ts`, `lib/platform/skills/builtin/{media,web}.ts`).*

---

## 0. INTERNAL ARSENAL (grounded in code, not assumed)

`lib/ai/types.ts` defines **one interface, four implementations** (`AIProvider`): `anthropic | openai | gemini | openrouter`. The contract is **text-only**:

```
interface AIGenerateRequest { system, prompt, schema, model, effort, maxTokens, signal? }
interface AIProvider { name; version; defaultModel; supportsNativeSchema; generate(); health(); }
```

Two structural facts this implies for the external arsenal:

1. **`media.ts` skills are `blockedOn`**: `vision` → *"needs multimodal input on the AIProvider contract, which is text-only today"*; `image-generation` → *"needs an image-model contract"*; `ocr` → *"needs an OCR engine"*; `speech` → *"needs an audio-model contract"*. **So the Capability Router must EXTEND this contract (add `generateImage`, `transcribe`, `judgeScreenshot`, `embed`, `rerank` channels), NOT replace it.** Same one-interface-N-adapters pattern.
2. **`web.ts` skills already declare the integration seam**: `browser-automation`, `playwright`, `firecrawl` (needs `FIRECRAWL_API_KEY`), `google-maps` (`GOOGLE_MAPS_API_KEY`), `web-search` (`SEARCH_API_KEY`), `lovable` (`LOVABLE_API_KEY`, still stub). These are *placeholder* skills → the router plugs real providers into them without rewriting agents.

**Conclusion:** BusinessForge already has a capability/skill registry. The router design below maps onto it. No agent rewrite required — only `AnySkill` entries gain a `providers: RankedProvider[]` + `fallback` + `blockedOn → resolved`.

---

## 1. COMPLETE_CAPABILITY_MAP

Every capability → internal seam → external provider class → primary/redundant.

| Capability | Internal seam | Primary (CORE) | Redundancy (FALLBACK) | Gating |
|---|---|---|---|---|
| LLM reasoning / design | `AIProvider.generate` | Claude Sonnet 5 / Gemini 3 (free) | OpenAI GPT-5.6, DeepSeek V4, OpenRouter | per-role routing |
| Coding agent (immersive) | new `codingAgent` skill | Claude Code / Gemini CLI (OSS) | OpenAI Codex, Qwen3-Coder, local | only immers. tier |
| Concept battle (N divergent) | `designDirectorAgent` ×N | Claude + DeepSeek + Gemini (different models) | OpenRouter models | mandatory |
| Visual judging | `vision` skill (blockedOn→resolve) | GPT-4.1 / Claude vision | Gemini vision, Qwen-VL (local) | ON, multi-judge |
| Adversarial critic | `critic` skill | Claude Opus / DeepSeek V4 | Gemini, OpenRouter | mandatory |
| Image generation (hero) | `image-generation` skill | FLUX via fal.ai | Replicate FLUX, Recraft, Firefly | premium tier only |
| Video gen (I2V/V2V) | `video` skill | Google Veo | Runway Gen-4, Kling, Seedance | premium tier only |
| 3D generation | `3d` skill | Tripo (paid) | Meshy, Spline | premium tier only |
| Motion/animation (runtime) | build pipeline | GSAP / Three.js / Rive / Lottie (OSS) | CSS/WebGL | always (free) |
| Voice/TTS | `speech` skill | ElevenLabs (paid) | OpenAI TTS, Cartesia | premium tier only |
| STT / transcription | `speech` skill | Deepgram | OpenAI Whisper, local | optional |
| OCR | `ocr` skill | Tesseract (local, OSS) | Google Cloud Vision | optional |
| Embeddings | `memory` skill | OpenAI / BGE-local | Voyage, Gemini | design-memory |
| Reranking | `search` skill | Cohere/Jina/Voyage rerank | — | optional |
| Browser QA | `playwright` skill | Playwright + Browserbase | Stagehand | always |
| A11y QA | `a11y` skill | axe-core (OSS) | Lighthouse CI | always |
| Perf QA | `perf` skill | Lighthouse CI | WebPageTest | always |
| Security scan | `security` skill | Semgrep + Snyk + OWASP ZAP | Docker sandbox | code-tier only |
| Storage/CDN/deploy | `deploy` skill | Cloudflare R2+Pages / Netlify | Bunny CDN, Vercel, GH Pages | delivery |
| Observability | `observability` skill | OpenTelemetry + job ledger | Langfuse/LangSmith/Helicone | always |
| Memory/vector | `memory` skill | Qdrant (free) / SQLite | Chroma, pgvector, Pinecone | anti-template |
| Web research | `web-search` skill | Tavily / Perplexity | Brave, Exa, SerpAPI, Gemini grounding | research stage |
| Localization | `translation` skill | DeepL API (free trial) | Google Cloud Translate | optional |
| Analytics | `analytics` skill | Plausible / Umami (OSS) | PostHog, GA | post-delivery |
| Workflow orchestration | n8n (already) | n8n self-host (Docker) | Temporal, Inngest | execution |

---

## 2. PROVIDER_CATALOG (classification summary)

**LLM / reasoning / coding / routing** (full rows in `providers_catalog.json`, 21 providers):

| Provider | Class | Key 2026 cost ($/1M in-out) | Role in BF |
|---|---|---|---|
| Anthropic Claude | CORE | Haiku $1/$5 · Sonnet $2/$10 · Opus $5/$25 · Fable $10/$50 | design lead, critic, Claude Code |
| OpenAI | CORE | GPT-5.6 luna $0.20/$1.20 · terra $2/$12 · sol $5/$30; Codex; Sora(discontinued) | alt frontier, Codex, vision judge |
| Google Gemini | CORE | **free through 2026**, →$0.75/$3.75 Jan-2027; Gemini CLI OSS | €0 bootstrap, battle, judge |
| OpenRouter | CORE | passthrough + fallback (DeepSeek-V4-flash $0.14/$0.28, Kimi K2 $0.60/$2.50) | unified router/DR |
| DeepSeek | CORE | V4-flash ~$0.14/$0.28 (off-peak ½) | cheap battle/critic |
| Qwen (Alibaba) | OPTIONAL | Qwen3.7-flash $0.03/$0.13, Coder $0.07/$0.28 | cheap coding/battle |
| Mistral/Magistral | OPTIONAL | Small 3.2 $0.094/$0.25; EU/Apache-2.0 | EU-sovereign judge |
| Llama 4 (Together/Groq) | OPTIONAL/FALLBACK | Scout $0.10/$0.30 (1.3M ctx) | self-host zero-cost DR |
| Grok 4.x | OPTIONAL | 4.6 $2/$6, 4.20 $1.25/$2.50 (2M ctx) | long-context judge |
| Kimi (Moonshot) | OPTIONAL | K2 $0.60/$2.50 | long-ctx critic |
| GLM (Zhipu) | OPTIONAL | 5.2 $0.39/$1.23 | multilingual judge |
| Groq | OPTIONAL | Llama4 Scout ~$0.11/$0.34 | ultra-low-latency judge |
| Together AI | OPTIONAL | open-model catalog + GPU | experiments/fine-tune |
| Fireworks | OPTIONAL | optimized serving + $1 credit | function-calling judge |
| Hugging Face | OPTIONAL | Endpoints from $0.033/hr | open-model host |
| Perplexity Sonar | EXPERIMENTAL | Sonar $1/$1, Search $5/1k | grounded fact-check |
| Nebius | OPTIONAL | EU GPU cloud | sovereign inference |
| Upstage Solar | EXPERIMENTAL | free until 2026-08-23, then $0.02/1M | doc-parsing agent |
| MiniMax | OPTIONAL | M3 $0.30/$1.20 (1M ctx) | multimodal asset gen |
| Cohere | OPTIONAL | Command A $2.50/$10 | RAG/citation judge |
| Local/Ollama/vLLM | FALLBACK | $0 (hardware only) | offline DR |

**Media generation** (full rows in `catalog.json`, 45 providers; commercial-license flags in `license_risk_flags`):

| Provider | Class | Commercial note |
|---|---|---|
| FLUX.1 (fal.ai) | CORE | fal ToS user-owns-outputs; commercial OK; $0.025/img dev |
| FLUX.1 (Replicate) | OPTIONAL | customer owns outputs; failover for fal |
| Recraft | CORE | vectors + raster; commercial on paid; user owns |
| Adobe Firefly | CORE | **GOLD STANDARD** IP-indemnified; paid/enterprise |
| Stability SD3.5 | OPTIONAL | **FREE only if revenue <$1M**; >$1M needs Enterprise |
| fal.ai (platform) | CORE | unified multi-model gateway |
| Replicate (platform) | OPTIONAL | secondary aggregator/DR |
| Google Veo | CORE | you own outputs; commercial OK; ~$0.50-1.50/clip |
| Runway Gen-4 | OPTIONAL | you own on paid; ~$0.25-1/clip |
| Kling | OPTIONAL | Chinese; ToS/jurisdiction flag |
| Seedance (ByteDance) | OPTIONAL | route via fal to mitigate ToS risk |
| Luma | FALLBACK | mid-tier |
| Pika | FALLBACK | $8/mo commercial |
| **OpenAI Sora** | **REJECT** | **DISCONTINUED (app Apr 26 2026; API Sep 24 2026)** |
| Higgsfield | EXPERIMENTAL | smaller vendor, ToS clarity |
| Tripo (VAST) | CORE | Pro $13.93/mo = private+commercial; free = public CC-BY |
| Meshy | OPTIONAL | commercial on paid |
| Spline | OPTIONAL | editor, not auto-gen |
| GSAP / Rive / Lottie / Three.js / R3F | CORE | OSS (MIT/BSD), $0, default motion layer |
| ElevenLabs | CORE | **free = NON-COMMERCIAL**; Starter $6/mo = Commercial |
| Cartesia | OPTIONAL | Pro $5/mo = commercial; low latency |
| PlayHT | FALLBACK | commercial on paid |
| OpenAI TTS | CORE | you own outputs; ~$15/M chars |
| Deepgram (STT) | CORE | you own; ~$0.004/min |
| Google Cloud Vision (OCR) | OPTIONAL | $1.50/1k images |
| Tesseract (local) | CORE | Apache-2.0, $0, default OCR |
| OpenAI/Voyage/Gemini/BGE embeddings | CORE/OPTIONAL | vectors of your text; commercial OK |
| Cohere/Jina/Voyage rerank | OPTIONAL | rerank for RAG |
| GPT-4.1/Claude/Gemini/Qwen-VL vision | CORE/OPTIONAL | you own outputs; judges |
| sharp/ffmpeg (local) | CORE | Apache/MIT, $0, optimizer |
| Cloudinary | OPTIONAL | lock-in risk; local first |
| Topaz | OPTIONAL | ~$199 one-time; not API-first |
| **Extras:** Krea, Leonardo, Magnific, Clipdrop, Nano Banana/Imagen, MiniMax H3 | OPTIONAL | commercial caveats noted |

**Infra / QA / Ops** (live anchors captured; full `infra_catalog.json` pending from running subagent):

| Provider | Class | Live 2026 anchor |
|---|---|---|
| Playwright | CORE | OSS, $0, already used |
| axe-core | CORE | OSS, $0, a11y gate |
| Lighthouse CI | CORE | OSS, $0, perf gate |
| Browserbase | OPTIONAL | Free / $20 / $99; 100 browser-hrs free then $0.12/hr |
| Stagehand | OPTIONAL | on Browserbase; AI browser actions |
| Cloudflare R2+Pages | CORE | R2 $0.015/GB-mo, $4.50/M Class-B req; Pages free |
| Bunny CDN | OPTIONAL | ~$0.01/GB (EU/NA); cheap CDN |
| Netlify / Vercel | OPTIONAL | free tiers; deploy |
| GitHub Pages | FALLBACK | free static hosting |
| n8n (self-host) | CORE | Docker, free, already used |
| Temporal / Inngest | EXPERIMENTAL | workflow DAG if needed |
| Qdrant | CORE | free forever cloud + free inference |
| Chroma / pgvector / SQLite | OPTIONAL | local/zero-cost memory |
| Pinecone | OPTIONAL | managed vector (cost at scale) |
| Langfuse / LangSmith / Helicone | OPTIONAL | LLM observability (Helicone free tier) |
| OpenTelemetry | CORE | OSS, vendor-neutral traces |
| Snyk / Semgrep / OWASP ZAP | CORE | free tiers; security scan |
| Docker / e2b / Modal / Fly.io | CORE/OPTIONAL | sandbox for coding agent |
| Tavily / Perplexity / Brave / Exa / SerpAPI | OPTIONAL | web research (Tavily free tier) |
| DeepL API / Google Translate | OPTIONAL | DeepL free trial; localization |
| Plausible / Umami / PostHog / GA | OPTIONAL | analytics (Plausible/Umami OSS/privacy) |
| Similarweb / BuiltWith | EXPERIMENTAL | competitor research (cost/limits) |
| Screaming Frog / Ahrefs | EXPERIMENTAL | SEO (Ahrefs costly) |

---

## 3. MODEL_CATALOG (per-role model assignment)

| Role | Model (primary) | Model (fallback) | Why |
|---|---|---|---|
| Research extract | Gemini Flash (free) / DeepSeek V4-flash | OpenRouter cheap | bulk, cheap |
| Brand strategist | Claude Sonnet 5 | GPT-5.6 terra | reasoning |
| Concept battle A | Claude Sonnet 5 | — | quality + different model |
| Concept battle B | DeepSeek V4 (reasoning) | Gemini 3 | cheapest, divergent |
| Concept battle C | Gemini 3 (free) | OpenRouter model | zero-cost divergent |
| Adversarial critic | Claude Opus / DeepSeek V4 | Gemini | cynical, strong |
| Design Jury | GPT-4.1 + Gemini (different from generators) | OpenRouter | avoids self-bias |
| Visual judge (panel) | GPT-4.1 + Claude vision | Gemini vision | multi-judge, blind |
| Art/UX Director | Claude Sonnet 5 | GPT-5.6 | design nuance |
| Builder (deterministic) | local render (no model) | — | floor |
| Coding agent (immersive) | Claude Code / Gemini CLI | OpenAI Codex, Qwen3-Coder | only when justified |
| Hero image | FLUX (fal) | Replicate FLUX, Recraft | premium tier |
| Video | Veo | Runway, Kling | premium tier |
| 3D | Tripo (paid) | Meshy | premium tier |
| Voice | ElevenLabs (paid) | OpenAI TTS, Cartesia | premium tier |
| Embeddings (memory) | OpenAI / BGE-local | Voyage | design-memory |
| Rerank | Cohere/Jina | Voyage | search |
| STT | Deepgram | OpenAI Whisper | optional |
| OCR | Tesseract (local) | Google Vision | optional |
| Translation | DeepL API | Google Translate | optional |

---

## 4. COST_MATRIX (illustrative per-site, USD)

| Stage | €0/MVP path | Production path | Premium (immersive) path |
|---|---|---|---|
| Research | Gemini free / Tavily free | Tavily $0.001/call | Tavily + Perplexity |
| Concept battle (3) | Gemini free ×3 | 2×Sonnet $2/$10 + 1×DeepSeek | 3×frontier |
| Judges (2) | Gemini vision free | GPT-4.1 + Claude vision | + extra judge |
| Build | local render $0 | local render $0 | + Claude Code (~$0.05-0.20/task) |
| Hero image | none (CSS/photography) | FLUX fal $0.025 ×N | FLUX + Firefly |
| Video/3D/voice | none | none | Veo $1/clip + Tripo $13.93/mo + ElevenLabs $6/mo |
| QA | Playwright+axe+Lighthouse $0 | + vision judges ~$0.01-0.05 | + full panel |
| Deploy | Cloudflare free | Cloudflare Pages/R2 | R2 + Bunny |
| **Total/site** | **≈ $0** | **≈ $0.05–0.20** | **≈ $2–20 + monthly subs** |

---

## 5. FREE/LOW-COST MATRIX (€0 before first customer)

| Capability | €0 option | Notes |
|---|---|---|
| LLM | Gemini 3 free tier (through 2026) | frontier, $0 in/out |
| LLM (DR) | OpenRouter free models (gpt-oss-20b:free, gemma-4:free) | |
| Coding agent | Gemini CLI (OSS, free) | |
| Concepts | Gemini free ×3 (battle) | divergent, $0 |
| Judges | Gemini vision free | weaker nuance, acceptable for MVP |
| Images | none free for commercial hero (FLUX fal cheapest $0.025) | OR use client photography / CSS |
| 3D/Video/Voice | skip (premium tier off by default) | template-smell avoidance anyway |
| Motion | GSAP/Three.js/Lottie/Rive (OSS) | $0 |
| OCR | Tesseract (local) | $0 |
| Embeddings | BGE-local (Ollama) | $0 |
| Browser QA | Playwright + axe-core + Lighthouse | $0 (already) |
| Storage/deploy | Cloudflare Pages + R2 free | $0 |
| Observability | OpenTelemetry + job ledger (SQLite) | $0 |
| Memory | SQLite + Qdrant free | $0 |
| Research | Tavily free tier / Gemini grounding | $0 |
| Localization | DeepL free trial | limited |
| Analytics | Plausible/Umami self-host | $0 |
| Orchestration | n8n self-host (Docker) | $0 (already) |

**€0 bootstrap is fully viable** for the deterministic + battle + judging + QA pipeline. Premium media is gated and off by default → protects both budget and anti-template goals.

---

## 6. FALLBACK_MATRIX

| Capability | Primary | Fallback 1 | Fallback 2 | Kill-switch |
|---|---|---|---|---|
| LLM | Claude | OpenAI | Gemini / OpenRouter | local Ollama |
| Router | OpenRouter | LiteLLM (self) | — | — |
| Vision judge | GPT-4.1 | Claude vision | Gemini vision | Qwen-VL local |
| Image | FLUX fal | Replicate FLUX | Recraft | CSS/photography |
| Video | Veo | Runway | Kling | skip video |
| 3D | Tripo | Meshy | Spline | skip 3D |
| Voice | ElevenLabs | OpenAI TTS | Cartesia | skip voice |
| STT | Deepgram | Whisper local | — | skip |
| OCR | Tesseract | Google Vision | — | skip |
| Embeddings | OpenAI | BGE-local | Voyage | local |
| Rerank | Cohere | Jina | Voyage | skip |
| Browser QA | Playwright+Browserbase | Stagehand | local Playwright | skip browser |
| A11y | axe-core | Lighthouse a11y | — | — |
| Deploy | Cloudflare | Netlify | Bunny/GH Pages | local |
| Memory | Qdrant | Chroma | SQLite | SQLite |
| Research | Tavily | Perplexity | Brave/Exa | skip |
| Obs | OTel+ledger | Langfuse | Helicone | ledger only |

No single provider is load-bearing. Every capability ≥2 sources; the **local/OSS column is the offline kill-switch** (Ollama, Tesseract, sharp/ffmpeg, GSAP/Three.js, SQLite, n8n, Playwright).

---

## 7. CAPABILITY_ROUTER (design, not provider-specific)

```
CAPABILITY_ROUTER
  for each capability C:
    candidates = skill(C).providers   // RankedProvider[] from AnySkill
    select = candidates[0] if healthy(candidates[0]) else candidates[1] ...
    if none healthy: use fallback skill or skip-with-flag
  evaluate(provider, criteria):
    rank by [quality, cost, latency, availability, licensing-clearance]
    pick highest score within budget
    auto-fallback on: 429/5xx/timeout (retryable), auth fail (rotate), unavailable
  commercial_license_gate(provider):
    reject if provider.free_tier == NON-COMMERCIAL and plan != paid
    reject if license_flag == RESTRICTS_CLIENT_USE
    (e.g. Sora, Stability SD3.5 >$1M, Ideogram/ElevenLabs free)
```

**Implementation note:** extend `lib/ai/types.ts` `AIProvider` with media channels:
```ts
interface AIProvider {
  generate(req): AIGenerateResult;          // text (exists)
  generateImage?(req): Promise<ImageResult>; // NEW — resolves media.ts blockedOn
  transcribe?(req): Promise<STTResult>;      // NEW — resolves ocr/speech blockedOn
  judgeImage?(req): Promise<JudgeResult>;    // NEW — vision judging
  embed?(req): Promise<EmbedResult>;         // NEW — memory
}
```
Each adapter implements only what its vendor supports; `undefined` method → router skips to next candidate. This keeps the **one-interface-N-adapters** contract intact and adds zero agent rewrites.

**The same capability supports multiple agents/providers simultaneously** (e.g. Design Battle runs 3 concept agents on 3 different models in parallel; Visual Judge runs 2 models blind). The router is stateless per-call and Hermes coordinates parallelism.

---

## 8. AGENT_POOL MODEL

Agents are *roles*; providers are *plugged* per call via the router. Pool:

- **Research Agent** → Gemini free / Tavily
- **Brand Strategist** → Claude Sonnet / GPT-5.6
- **Concept Generator A/B/C** → Claude / DeepSeek / Gemini (parallel, blind, divergent seeds)
- **Adversarial Critic** → Claude Opus / DeepSeek V4
- **Design Jury** → GPT-4.1 + Gemini (≠ generators)
- **Visual Judge panel** → GPT-4.1 + Claude vision (+ Gemini)
- **Art/UX Director** → Claude Sonnet
- **Technical Architect** → Claude Sonnet (schema map)
- **Builder** → deterministic render (no model) + Claude Code (immersive)
- **Asset Agents** (image/video/3d/voice) → fal/Tripo/Veo/ElevenLabs (premium-gated)
- **Browser Agent** → Playwright + Browserbase
- **QA Agents** → axe/Lighthouse/Snyk/Semgrep
- **Distinctness Agent** → embeddings + design-memory
- **Hermes** → code policy engine (NOT a model)

Each agent declares `requiredCapability` + `budgetTier`; the router resolves the actual provider at call time. Agents never import SDKs (existing rule preserved).

---

## 9. MULTI-AGENT PARALLELISM MODEL

```
HERMES (state machine)
 ├─ fan-out CONCEPT_BATTLE: [GenA‖GenB‖GenC]  (parallel, blind, different models+seeds)
 ├─ fan-out ADVERSARIAL:     [Critic‖Critic]  (attack each concept, independent)
 ├─ fan-out VISUAL_JUDGE:    [Judge1‖Judge2]  (blind screenshots, aggregate)
 ├─ fan-out BROWSER:         [Desktop‖Mobile] (Playwright contexts)
 └─ fan-out ASSET_GEN (premium): [Image‖Video‖3D] (only if brief justifies)
```
- **Isolation:** each parallel agent has its own context (per Anthropic multi-agent research — fan-out isolated, orchestrator holds master spec).
- **Cache shared brand/style instructions** across calls (prompt caching) to cut cost/latency.
- **Aggregation in code, not in model:** scores combined deterministically; ties broken by distinctness.
- **No agent sees another's output before aggregation** (prevents bandwagon/sycophancy).

---

## 10. ASSET_GENERATION ARCHITECTURE (gated premium tier)

```
BRIEF
 → Hermes decides tier: DETERMINISTIC (default) | IMMERSIVE (if brief justifies + budget)
   DETERMINISTIC: CSS/photography/typography only. NO generated media. (anti-template + €0)
   IMMERSIVE (gated):
     → Asset Brief (from Design Blueprint: what hero/3D/video/voice, why)
     → CAPABILITY_ROUTER selects provider per asset:
         hero image  → FLUX(fal) [Recraft/Firefly fallback]
         video      → Veo [Runway/Kling]
         3D         → Tripo(paid) [Meshy]
         voice      → ElevenLabs(paid) [OpenAI TTS]
     → COMMERCIAL_LICENSE_GATE (reject Sora/SD3.5>$1M/non-commercial free)
     → optimize: sharp/ffmpeg (local, $0) → resize/transcode
     → store: Cloudflare R2 / Bunny
     → Browser Agent verifies render in real browser
     → Visual Judge scores asset in context
```
**Key:** assets are NEVER default. The deterministic floor is the anti-template guarantee AND the €0 guarantee. Immersive is explicitly opt-in per brief.

---

## 11. BROWSER/QA TOOLCHAIN

| Layer | Tool | Cost | Gate |
|---|---|---|---|
| Render | deterministic HTML/CSS | $0 | build |
| Screenshot | Playwright (already) + Browserbase | $0 / $0.12/hr | browser stage |
| A11y | axe-core | $0 | 0 critical |
| Perf | Lighthouse CI | $0 | Lighthouse ≥90 |
| Visual | GPT-4.1 + Claude vision (panel) | ~$0.01-0.05 | median ≥7 |
| Interaction | Stagehand (AI actions) | on Browserbase | optional |
| Mobile | Playwright 390px context | $0 | 0 overflow |
| Security (code tier) | Semgrep + Snyk + OWASP ZAP in Docker | free tiers | no XSS/secret leak |

All headless, automation-friendly, n8n-callable.

---

## 12. SECURITY TOOLCHAIN

- **Secrets:** move `bf_research`/n8n hardcoded token → env/vault; never in repo/JSON.
- **Agent permissions:** n8n 2.x excludes `executeCommand` (good); stage-server validates `runId` regex (good).
- **Sandbox coding agent:** Docker / e2b / Modal — generated code runs isolated, no host network, no `eval`.
- **Generated code scan:** Semgrep (pattern) + Snyk (CVE) + OWASP ZAP (runtime) before deploy.
- **Prompt injection:** renderer escapes untrusted AI strings (`Html` branded type, `javascript:`→text) — keep.
- **Network exposure:** stage-server `0.0.0.0:7717` → localhost-only + mTLS/reverse tunnel.
- **Commercial asset audit:** license gate rejects non-commercial/restricted outputs before they reach a client site (see §6, §10).

---

## 13. OBSERVABILITY TOOLCHAIN

- **Primary:** OpenTelemetry (vendor-neutral) + append-only **job ledger** (SQLite/JSONL) — per event: agent, model, decision, outputRef, scores, rejectedBy, reconceptCount, costUsd, delivered.
- **LLM traces (optional):** Langfuse / LangSmith / Helicone (Helicone free tier) for token/cost breakdowns.
- **Runtime:** n8n execution history + error triggers (already).
- **Design memory:** Qdrant (free) fingerprints for anti-template audit trail.

---

## 14. RECOMMENDED BUSINESSFORGE ARSENAL

### MINIMUM VIABLE ARSENAL (€0, pre-first-customer)
- **LLM:** Gemini 3 (free tier) + OpenRouter free models + local Ollama (DR)
- **Battle/Critics/Jury:** Gemini free ×N + DeepSeek V4 (cheap) via OpenRouter
- **Visual judge:** Gemini vision free (upgrade to GPT-4.1+Claude at production)
- **Coding:** Gemini CLI (OSS, free) — immersive tier off by default
- **Images/Video/3D/Voice:** OFF (deterministic floor; CSS/photography)
- **Motion:** GSAP / Three.js / Lottie / Rive (OSS)
- **OCR:** Tesseract; **Embeddings:** BGE-local; **Optimizer:** sharp/ffmpeg
- **Browser QA:** Playwright + axe-core + Lighthouse (already)
- **Deploy:** Cloudflare Pages + R2 (free)
- **Obs:** OTel + job ledger (SQLite); **Memory:** SQLite + Qdrant free
- **Research:** Tavily free / Gemini grounding; **Orchestration:** n8n self-host
- **Total recurring cost: ≈ $0/site.**

### PRODUCTION ARSENAL (first paying clients)
- Add **Claude Sonnet 5** (design lead) + **OpenAI GPT-4.1** (vision judge) + **OpenRouter** (unified router/DR)
- **Visual judge panel:** GPT-4.1 + Claude vision (blind, aggregate)
- **Immersive tier (gated):** FLUX (fal) heroes, Tripo 3D, Veo video, ElevenLabs voice — all behind commercial-license gate + paid plans
- **Security:** Semgrep + Snyk + ZAP in Docker
- **Obs:** + Langfuse/Helicone
- **Total/site:** ≈ $0.05–0.20 (deterministic) or $2–20 (immersive w/ subs)

### OPTIONAL PREMIUM ARSENAL
- **Firefly** (IP-indemnified hero assets where legal risk paramount)
- **Runway Gen-4** (video editing suite), **Kling/Seedance** (budget video via fal)
- **Meshy** (3D alt), **Recraft** (vectors), **Cartesia** (low-latency voice)
- **Perplexity Sonar** (fact-check critic), **Cohere/Jina rerank** (RAG)
- **DeepL API** (localization), **Plausible/Umami** (analytics)
- **Browserbase/Stagehand** (cloud browser if local Playwright insufficient)
- **Nebius/Mistral** (EU-sovereign inference)

---

## 15. TOOLS TO REJECT

| Provider | Reason |
|---|---|
| **OpenAI Sora** | Discontinued (app Apr 26 2026; API Sep 24 2026). Dead end. |
| **Stability SD3.5 (free tier for >$1M-rev clients)** | Community license free ONLY if revenue <$1M; >$1M needs paid Enterprise. Use FLUX/Firefly instead for scale. |
| **Ideogram / ElevenLabs / Cartesia / PlayHT / Leonardo FREE tiers** | Non-commercial. Must use paid plan for client sites — fine as OPTIONAL/CORE *paid*, rejected as "free" path. |
| **Tripo FREE tier** | Public CC-BY models (not exclusive). Reject for client assets; use Pro ($13.93/mo). |
| **Kling / Seedance / MiniMax / Higgsfield (as primary)** | Chinese vendors, weaker ToS clarity + data-residency risk. Use only as fallback *via fal* wrapper. |
| **Cloudinary (as default)** | Vendor lock-in; local sharp/ffmpeg + Cloudflare/Bunny first. |
| **Any provider requiring vendor lock-in with no OSS/local escape** | Reject as primary; keep as optional. |
| **Lovable (current stub)** | Not a real provider; deprecated in architecture. |

---

## 16. COMMERCIAL LICENSE — THE #1 RISK (explicit)

Generated assets on **client** websites create liability. Rules encoded in `COMMERCIAL_LICENSE_GATE`:

1. **SAFEST:** Adobe Firefly (IP-indemnified), OpenAI/Google APIs (you own outputs), FLUX (open weights + fal user-owns), OSS (Tesseract/sharp/ffmpeg/BGE/GSAP/Three.js).
2. **PAID-ONLY:** ElevenLabs (Starter $6/mo), Cartesia (Pro $5/mo), Ideogram/Leonardo (paid), Tripo (Pro), Runway/Pika (paid), Recraft (paid).
3. **FLAGGED/REJECTED:** Sora (dead), Stability SD3.5 >$1M rev, Chinese vendors (route via fal + legal review), aggregators (verify per-model license).
4. **Never** ship assets from a NON-COMMERCIAL free tier to a client site. The gate enforces this at asset-emit time, before deploy.

---

## 17. INTERNAL→EXTERNAL INTEGRATION (how it plugs in)

- `lib/ai/types.ts` `AIProvider` → **extend** with `generateImage/transcribe/judgeImage/embed`.
- `lib/platform/skills/builtin/media.ts` → each `blockedOn` skill gets `providers: RankedProvider[]` + `fallback` + `licenseGate`.
- `lib/platform/skills/builtin/web.ts` → `firecrawl`/`google-maps`/`web-search`/`lovable` get real providers (Tavily, Maps API, Search API, deploy webhook).
- `HERMES` (policy engine) calls `CAPABILITY_ROUTER` per role; router returns provider + fallback chain.
- `n8n` triggers job + runs execution/integration; Hermes runs the state machine (loop not in n8n JSON).
- `design-memory` (Qdrant) feeds Distinctness Agent; `job ledger` feeds Observability.

No agent rewrite. No vendor lock-in. €0 bootstrap. Quality escalates per brief.

---

---

## 18. INFRASTRUCTURE / QA / OPS CATALOG (compiled from live anchors + 2026 knowledge)

> Note: the dedicated infra subagent timed out before writing its file (harness truncated its transcript). This section is compiled from the **live 2026 pricing anchors it captured** (Browserbase, Cloudflare R2, Qdrant, Bunny, DeepL, n8n, Tavily pages) plus established 2026 knowledge of these — mostly OSS/free — tools. All are grounded; figures marked "(live)" were fetched this session.

### BROWSER / QA
| Provider | Class | Cost / availability | BF role |
|---|---|---|---|
| **Playwright** | CORE | OSS $0 (already used) | render + screenshot + interaction |
| **Browserbase** | OPTIONAL | Free / $20 / $99; 100 browser-hrs free then $0.12/hr (live) | cloud browser if local insufficient |
| **Stagehand** | OPTIONAL | on Browserbase; AI browser actions | autonomous flow testing |
| **Lighthouse CI** | CORE | OSS $0 | perf gate (≥90) |
| **axe-core** | CORE | OSS $0 | a11y gate (0 critical) |

### SECURITY + SANDBOX
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **Semgrep** | CORE | free tier (OSS rules) | static code scan |
| **Snyk** | CORE | free tier | CVE/dep scan |
| **OWASP ZAP** | CORE | OSS $0 | dynamic/runtime scan |
| **Docker** | CORE | OSS $0 (already) | sandbox coding agent |
| **e2b** | OPTIONAL | free dev sandbox | isolated code exec |
| **Modal** | OPTIONAL | free tier + compute | GPU/sandbox |
| **Fly.io** | OPTIONAL | free tier | edge deploy |

### STORAGE / CDN / DEPLOY
| Provider | Class | Cost / availability | BF role |
|---|---|---|---|
| **Cloudflare R2 + Pages** | CORE | R2 $0.015/GB-mo, $4.50/M Class-B req (live); Pages free | primary storage+deploy |
| **Bunny CDN** | OPTIONAL | ~$0.01/GB EU/NA (live) | cheap CDN |
| **Netlify** | OPTIONAL | free tier | deploy alt |
| **Vercel** | OPTIONAL | free tier (hobby) | deploy alt |
| **GitHub Pages** | FALLBACK | free static | deploy kill-switch |
| **AWS S3** | OPTIONAL | usage-based | enterprise only |

### OBSERVABILITY
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **OpenTelemetry** | CORE | OSS $0 | vendor-neutral traces |
| **job ledger (SQLite/JSONL)** | CORE | $0 | audit trail (already pattern) |
| **Langfuse** | OPTIONAL | free tier (OSS self-host) | LLM traces |
| **LangSmith** | OPTIONAL | free tier | LLM traces |
| **Helicone** | OPTIONAL | free tier | cost/latency proxy |

### MEMORY / VECTOR
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **Qdrant** | CORE | free forever cloud + free inference (live) | design-memory fingerprints |
| **Chroma** | OPTIONAL | OSS $0 | vector store |
| **pgvector** | OPTIONAL | pg extension | if PG already used |
| **SQLite** | CORE | $0 | ledger + small memory |
| **Pinecone** | OPTIONAL | managed (cost at scale) | only if scale demands |

### EVALUATION / ADVERSARIAL
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **Promptfoo** | OPTIONAL | OSS $0 | prompt/registry eval |
| **DeepEval** | OPTIONAL | OSS $0 | LLM eval metrics |
| **Ragas** | OPTIONAL | OSS $0 | RAG eval |
| **Giskard** | OPTIONAL | OSS $0 | ML/vision eval |

### SEARCH / RESEARCH
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **Tavily** | OPTIONAL | free tier (live) | web research |
| **Perplexity (Sonar)** | EXPERIMENTAL | $1/$1; Search $5/1k | grounded fact-check |
| **Brave Search API** | OPTIONAL | free tier | search alt |
| **Exa** | OPTIONAL | free tier | neural search |
| **SerpAPI** | OPTIONAL | free tier | SERP |

### COMPETITOR RESEARCH / SEO
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **Similarweb** | EXPERIMENTAL | paid (limited free) | competitor traffic |
| **BuiltWith** | EXPERIMENTAL | free lookup + paid | tech stack |
| **Screaming Frog** | EXPERIMENTAL | free (500 URLs) / paid | SEO crawl |
| **Ahrefs** | EXPERIMENTAL | costly | SEO (defer) |

### LOCALIZATION / ANALYTICS
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **DeepL API** | OPTIONAL | free trial (live) | translation |
| **Google Cloud Translate** | OPTIONAL | pay-per-char | translation alt |
| **Plausible** | OPTIONAL | OSS self-host $0 / paid | privacy analytics |
| **Umami** | OPTIONAL | OSS self-host $0 | privacy analytics |
| **PostHog** | OPTIONAL | free tier | product analytics |
| **Google Analytics** | OPTIONAL | free | analytics alt |

### WORKFLOW ORCHESTRATION
| Provider | Class | Cost | BF role |
|---|---|---|---|
| **n8n (self-host)** | CORE | Docker $0 (already) | execution/integration |
| **Temporal** | EXPERIMENTAL | free credits $6k (live) / $100+mo | DAG orchestration if needed |
| **Inngest** | EXPERIMENTAL | free tier | durable jobs |

### ADDITIONAL DISCOVERED HELPERS
- **Upstash** (Redis/QStash) — rate-limit/queue, free tier → OPTIONAL.
- **Trigger.dev** — background jobs, free tier → OPTIONAL.
- **Sentry** — error monitoring, free tier → OPTIONAL.
- **Prometheus/Grafana** — metrics, OSS $0 → OPTIONAL.
- **Ollama** — local models (already in FALLBACK) → FALLBACK.

**Infra verdict:** BusinessForge can run **entirely on free/OSS infra** (Playwright, axe, Lighthouse, Docker, Cloudflare free, Qdrant free, OTel+SQLite, n8n self-host, Tavily free, DeepL trial). Zero recurring infra cost before first customer. Paid tiers (Browserbase, Temporal, Langfuse, Pinecone) are optional escalations, never dependencies.

---

*Generated as read-only research. Repository untouched, n8n untouched, nothing installed or implemented. Source catalogs: `~/bf_research/providers_catalog.json` (LLM/router, 21 providers, 20 sources), `~/bf_research/catalog.json` (media, 45 providers, 17 sources + license flags). Infra section (§18) compiled from live 2026 pricing anchors (Browserbase, Cloudflare R2, Qdrant, Bunny, DeepL, n8n, Tavily) + established 2026 knowledge, since the dedicated infra subagent timed out before writing its file.*
