# 11 — AI PROVIDER MATRIX

> All serious providers. The repo ALREADY has adapters for anthropic/openai/gemini/
> openrouter/cerebras/deepseek/xai (proven add-a-vendor pattern). This matrix decides
> which to route WHERE. VERIFIED = fetched 2026-08-19; INFERRED = known.

## Provider quick matrix
| Provider | Text | Vision | Image | Video | Audio | Embed | Reason | Code | API | MCP | CLI | FREE | MED $ | PREM $ | Comm | Quality | Latency | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **OpenAI** | ✅ | ✅ | ✅gpt-image | Sora | ✅TTS | ✅ | ✅o-series | ✅ | ✅ | ❌ | ❌ | no API free | per-token/img | ent | high | low-med | VERIFIED |
| **Gemini** | ✅ | ✅ | ✅Imagen | Veo | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | free allow | per-token | ent | high | low | VERIFIED |
| **Anthropic** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | free tier | per-token | ent | high | low-med | VERIFIED (adapter exists) |
| **xAI** | ✅ | ✅(grok) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | free tier | per-token | ent | high | low | VERIFIED (adapter) |
| **DeepSeek** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅R1 | ✅ | ✅ | ❌ | ❌ | free tier | per-token | API | high | low | VERIFIED (adapter) |
| **Qwen** | ✅ | ✅ | ✅(Tongyi) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | free tier | per-token | ent | high | low | INFERRED |
| **Mistral** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | free tier | per-token | ent | med-high | low | INFERRED |
| **Kimi** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | free tier | per-token | API | high | med | INFERRED |
| **Groq** | ✅(LPU) | via models | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | **$5 free credit** | PAYG | ent | high | **ultra-low** | VERIFIED groq.com |
| **Cerebras** | ✅ | via models | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | **$5 free credit** | $10 dev | ent | high | **ultra-low** | VERIFIED cerebras.ai |
| **OpenRouter** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | **25+ free models $0, 50 req/day** | 5.5% fee | ent | var | low-med | VERIFIED openrouter.ai |

## Routing recommendations
- **Orchestration / creative direction / reasoning:** Anthropic (existing adapter) primary;
  OpenAI/Gemini alternates. DeepSeek/xAI for cost-sensitive reasoning.
- **Vision / visual description:** Gemini / OpenAI / Claude vision (existing `vision_
  description` capability). 
- **Image gen:** Gemini Imagen / OpenAI gpt-image / FLUX via fal-Replicate (NOT a chat
  provider — see 06).
- **Embeddings (semantic_index):** Gemini / OpenAI / local (runs local per registry).
- **Ultra-low-latency structured gen:** Groq or Cerebras (route fast/cheap structured
  calls here). Both offer $5 free credit (VERIFIED).
- **Model access without 12 keys:** OpenRouter (500+ models, 80+ providers, auto-routing,
  BYOK, budgets). ADOPT P0 as the unification layer.
- **Local / free:** Ollama (existing `ollama` adapter stub) for on-prem text + FLUX/SD
  image + Kokoro/Piper voice.

## Cost control
- OpenRouter free models (Llama/Mistral/Qwen free) for draft/structured passes → $0.
- Reserve paid frontier models for stages needing their quality (creative direction, QA
  judge). Rate governor EXISTS (`rate_governor` capability).

## Commercial rights
- All major providers grant output ownership to the customer under paid use (INFERRED/
  VERIFIED per ToS). Free tiers may restrict — check per provider; for client deliverables
  use paid or local.

## Candidates to ADD as adapters (P1, low effort — proven pattern)
- **Groq** (fast structured/code gen), **Cerebras** (fast reasoning), **Qwen/Kimi/Mistral**
  via OpenRouter (no separate adapter needed — already reachable through OpenRouter).
- **Recommendation:** add Groq + Cerebras direct adapters for latency-critical stages;
  reach the rest through OpenRouter. Do NOT add 12 separate SDKs.

## MCP/CLI
- None of the chat providers ship a first-party website-factory MCP; Higgsfield/Firecrawl/
  Exa/Algolia/Cloudinary/Axe do (see 12). Chat providers stay API/SDK behind the existing
  `AIProvider` contract.
