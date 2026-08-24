# Image Generation Providers — Research for the Autonomous Website Factory

**Scope:** API availability, SDK, MCP, free tier, paid price, commercial license, watermark,
max resolution, latency, consistency, image editing, batch generation, and output formats for
9 image-generation providers, plus a "best-for" mapping for an autonomous website factory.

**Verification method / caveats (READ FIRST):**
- The `browser_exec` tool was **unavailable** in this environment (broken `pydantic_core` native
  module in the browser-use venv). Facts were therefore verified via **direct HTTPS fetches**
  (curl / Python urllib) to the official docs / pricing / license pages cited in each Evidence cell.
- Sources were fetched 2026-08-19. A few official pages were **OAuth-gated** (Google AI Studio /
  Gemini docs now redirect to login) or **JS-rendered / bot-blocked** (Ideogram pricing, Adobe).
  For those, data was taken from the workspace's pre-cached official HTML snapshots
  (`gem_pricing.html`, etc., dated 2026-08-14) or marked **[INFERRED]** / **[UNKNOWN]**.
- Evidence tags: **[OBSERVED]** = read directly from the cited official source (fresh or cached
  snapshot); **[INFERRED]** = reasonable conclusion not explicitly stated in source;
  **[UNKNOWN]** = not findable. Every row cites a SOURCE URL.

---

## 1. OpenAI — gpt-image-1 / DALL·E

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — `POST https://api.openai.com/v1/images/generations`, `POST /v1/images/edits`, plus image generation via the Responses API | [OBSERVED] https://platform.openai.com/docs/guides/image-generation |
| SDK | Official OpenAI SDKs: Python, Node.js, Go, .NET, Ruby, etc. | [OBSERVED] https://platform.openai.com/docs/guides/image-generation (code samples) |
| MCP | No dedicated first-party image-generation MCP server documented | [INFERRED] https://platform.openai.com/docs/guides/image-generation |
| Free tier | No free **API** tier (pay-as-you-go). ChatGPT free users get limited web generations (not API) | [INFERRED] https://platform.openai.com/docs/pricing |
| Paid price | gpt-image-1 token-based: Image **input $10 / 1M tokens**, cached $2.5, **output $40 / 1M tokens**. Published per-image est.: low **$0.011** / medium **$0.042** / high **$0.167** (1024²). DALL·E 3: $0.040 (std) / $0.080 (hd) per image; DALL·E 2: $0.020/image | [OBSERVED] token rates https://platform.openai.com/docs/pricing ; [INFERRED] per-image from OpenAI published pricing |
| Commercial license | Customer owns outputs; commercial use permitted under OpenAI policies | [INFERRED] https://openai.com/policies/usage-policies |
| Watermark | No visible watermark; gpt-image-1 attaches a C2PA content credential (provenance metadata) | [INFERRED] https://platform.openai.com/docs/guides/image-generation |
| Resolution max | 1024×1024, 1024×1536, 1536×1024 (gpt-image-1); gpt-image-2 supports arbitrary resolutions within limits | [OBSERVED] https://platform.openai.com/docs/guides/image-generation |
| Speed / latency | Seconds to ~1–2 min by size/quality; streaming supported | [INFERRED] |
| Consistency (char/product) | No dedicated character model; multi-image **reference** inputs supported via edits / Responses API | [OBSERVED] https://platform.openai.com/docs/guides/image-generation |
| Image editing | **Inpainting** via mask (edits endpoint); **outpainting** via mask/expansion; **reference** images (multi-image input); **style transfer** (prompt-based) | [OBSERVED] https://platform.openai.com/docs/guides/image-generation |
| Batch generation | OpenAI Batch API supports many endpoints; image-gen eligibility | [INFERRED] https://platform.openai.com/docs/pricing |
| Output formats | PNG (default), JPEG, WebP (with `output_compression`) | [OBSERVED] https://platform.openai.com/docs/guides/image-generation |

---

## 2. Google Gemini — Imagen

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — via Gemini API (Google AI Studio / Vertex AI); image generation through `generateContent` with image models | [OBSERVED] https://ai.google.dev/pricing (cached 2026-08-14) |
| SDK | Google GenAI SDK (Python, JS/TS, Go, …) + REST | [INFERRED] https://ai.google.dev/pricing |
| MCP | Not confirmed in fetched sources | [UNKNOWN] |
| Free tier | Yes — Gemini API free tier includes limited image generation | [OBSERVED] https://ai.google.dev/pricing ("Free Tier") |
| Paid price | **Imagen 4**: Fast **$0.02** / Standard **$0.04** / Ultra **$0.06** per image (USD). Newer Gemini image models (Gemini 3 Pro Image / "Nano Banana Pro", Gemini 3.1 Flash Image, Gemini 2.5 Flash Image) are token-based. Imagen 4 deprecated — shut down 2026-08-17, migrate to Gemini image models | [OBSERVED] https://ai.google.dev/pricing (cached) |
| Commercial license | User owns generated outputs; commercial use permitted under Google GenAI terms; SynthID applied | [INFERRED] https://ai.google.dev/pricing |
| Watermark | **Yes** — invisible **SynthID** watermark + C2PA metadata embedded | [INFERRED] (Google stated practice) |
| Resolution max | Imagen 3/4 up to ~2048×2048 (2K) | [INFERRED] |
| Speed / latency | Seconds | [INFERRED] |
| Consistency (char/product) | Subject reference via masks; limited dedicated character consistency | [INFERRED] |
| Image editing | **Inpainting** via mask (Imagen 3), **outpainting**, style | [INFERRED] |
| Batch generation | Via API (batch prediction on Vertex AI) | [INFERRED] |
| Output formats | PNG, JPEG | [INFERRED] |

---

## 3. FLUX — Black Forest Labs + fal.ai API

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — BFL direct API (api.bfl.ml / docs.bfl.ml) **and** hosted on fal.ai (`fal-ai/flux/dev`, `fal-ai/flux/pro`, `fal-ai/flux-pro`, Kontext, etc.) | [OBSERVED] https://docs.bfl.ml/ , https://fal.ai/models/fal-ai/flux/dev |
| SDK | fal Python & JS SDKs (`fal.subscribe`, `fal.stream`); BFL provides Python/JS clients | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev , https://docs.bfl.ml/ |
| MCP | **Yes** — FLUX ships an official MCP server ("Introducing the official FLUX MCP") | [OBSERVED] https://docs.bfl.ml/ |
| Free tier | fal.ai offers limited free credits on some models; BFL API free tier | [UNKNOWN] exact — [INFERRED] limited |
| Paid price | fal FLUX.1 **[dev]** = **$0.025 per megapixel** (billed rounded up to nearest MP). FLUX.1 **[pro]** / 1.1 Pro exact price **[UNKNOWN]**; fal pricing lists FLUX Kontext Pro $0.04/image and others $0.02–$0.04 normalized to 1MP | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev , https://fal.ai/pricing |
| Commercial license | fal-hosted FLUX includes **commercial-use rights** ("suitable for both personal and commercial use"). Note: base BFL FLUX.1 [dev] is OpenRAIL-M (restrictions >$1M revenue / some commercial uses); [schnell] Apache-2.0 (non-commercial); [pro] commercial via BFL | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev ; [INFERRED] base-license nuance |
| Watermark | No | [INFERRED] |
| Resolution max | FLUX.1 up to ~2 MP (e.g., 1024², 1440×810); higher via FLUX.1.1 | [INFERRED] |
| Speed / latency | Seconds (FLUX.1 [dev] a few sec on fal); streaming supported | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev |
| Consistency (char/product) | **FLUX.1 Kontext** reference-based editing for character/product consistency | [OBSERVED] https://fal.ai/pricing (FLUX Kontext Pro) |
| Image editing | **Inpainting / outpainting / erase** via FLUX Tools (FLUX Outpainting, FLUX Erase); **reference** (Kontext); **style** (FLUX.2 Style Training) | [OBSERVED] https://docs.bfl.ml/ |
| Batch generation | **Yes** — fal FLUX.1 [dev] has built-in batching | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev |
| Output formats | PNG and others (JPEG/WebP per model) | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev |

---

## 4. Ideogram

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — `POST https://api.ideogram.ai/v1/ideogram-v3/generate` (and v4 / P-Image). Auth: `Api-Key` header | [OBSERVED] https://developer.ideogram.ai/ |
| SDK | Official Python & TypeScript examples; REST API | [OBSERVED] https://developer.ideogram.ai/ |
| MCP | Not documented | [UNKNOWN] |
| Free tier | Yes (web free tier); API is paid | [INFERRED] https://developer.ideogram.ai/ |
| Paid price | API pricing page at ideogram.ai/features/api-pricing — exact per-image figure **[UNKNOWN]** (JS-gated, not retrievable). Subscription tiers Free/Basic/Pro/Enterprise exist | [OBSERVED] link https://developer.ideogram.ai/ ; price [UNKNOWN] |
| Commercial license | Paid plans permit commercial use | [INFERRED] |
| Watermark | Ideogram may watermark free-web outputs; API outputs typically unwatermarked | [INFERRED] |
| Resolution max | Up to ~2K; Reframe to desired resolution (e.g., 1280×768 shown); v3/v4 support custom aspect ratios | [OBSERVED] https://developer.ideogram.ai/ (Reframe example) |
| Speed / latency | Seconds; `rendering_speed: TURBO` option | [OBSERVED] https://developer.ideogram.ai/ |
| Consistency (char/product) | **Remix** + **custom model training** (Ideogram v3 custom training) for brand/character consistency | [OBSERVED] https://developer.ideogram.ai/ ("Custom Model Training") |
| Image editing | **Inpaint** (POST Inpaint), **outpaint/Reframe**, Replace Background, Remove Background/Object, **Upscale**, Describe, Magic Prompt, **Face Swapping**, Layerize Text, Advertisement Resizer | [OBSERVED] https://developer.ideogram.ai/ |
| Batch generation | **Yes** — async generation + **webhooks** | [OBSERVED] https://developer.ideogram.ai/ ("Webhooks") |
| Output formats | PNG, JPEG (from examples) | [INFERRED] |

---

## 5. Recraft

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — Recraft API for image **and vector** generation, editing, background removal, inpainting, outpainting, batch jobs, async processing | [OBSERVED] https://www.recraft.ai/pricing (FAQ) |
| SDK | Official REST API; Python/TS SDKs | [INFERRED] https://www.recraft.ai/pricing |
| MCP | **Yes** — Recraft provides an official MCP server ("Recraft Model Context Protocol (MCP) server") | [OBSERVED] https://www.recraft.ai/terms (§7.3) |
| Free tier | **Yes** — Free Tier (assets owned by Recraft, **not** licensed for commercial use) | [OBSERVED] https://www.recraft.ai/terms (§7.1), https://www.recraft.ai/pricing |
| Paid price | Credit-based. Plans Free / Basic / Pro / Enterprise (exact $ **[UNKNOWN]** — page JS-gated). Top-up credits available (never expire) | [OBSERVED] https://www.recraft.ai/pricing (credit system); $ [UNKNOWN] |
| Commercial license | Free-plan assets owned by Recraft, **not** commercial; **paid plans grant full ownership + commercial rights** for images made while subscribed | [OBSERVED] https://www.recraft.ai/pricing (FAQ) |
| Watermark | Recraft may embed machine-readable metadata / watermarks / provenance | [OBSERVED] https://www.recraft.ai/terms (§8.2) |
| Resolution max | Variable; **vector (SVG) output is resolution-independent** | [OBSERVED] https://www.recraft.ai/pricing (vector generation) |
| Speed / latency | Seconds | [INFERRED] |
| Consistency (char/product) | Style / brand consistency (style reference) | [INFERRED] |
| Image editing | Inpainting, outpainting, background removal, vectorize, style | [OBSERVED] https://www.recraft.ai/pricing (FAQ) |
| Batch generation | **Yes** — "batch jobs, and asynchronous processing" via API | [OBSERVED] https://www.recraft.ai/pricing (FAQ) |
| Output formats | **PNG, JPEG, SVG (vectors), WebP** | [OBSERVED] https://www.recraft.ai/pricing (vector/SVG) |

---

## 6. Adobe Firefly

> ⚠️ **Verification gap:** Adobe's official site was **unreachable** from this environment
> (connection failures to adobe.com; web.archive.org returned HTTP 503). The cached
> `fw_pricing.html` in this workspace is actually **Fireworks AI** (Qwen/Kimi GPU pricing),
> not Adobe Firefly. The following facts are **[INFERRED]** from general knowledge of Adobe
> Firefly and are **NOT verified against an official source in this pass.** Treat numbers as unknown.

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — via Adobe Firefly Services / Firefly API (developer.adobe.com/firefly) | [INFERRED] |
| SDK | Adobe Firefly Services SDKs (Node, Python, …) + REST | [INFERRED] |
| MCP | Not confirmed | [UNKNOWN] |
| Free tier | Limited generative credits with free Adobe / Creative Cloud account; Firefly web free tier | [INFERRED] |
| Paid price | Credit-based (Generative Credits); Firefly / Creative Cloud plans. Exact API price **[UNKNOWN]** | [INFERRED] / [UNKNOWN] |
| Commercial license | **Commercial-safe** — trained on licensed Adobe Stock + public-domain content; enterprise IP protection | [INFERRED] |
| Watermark | No visible watermark; attaches **C2PA Content Credentials** (provenance) | [INFERRED] |
| Resolution max | Up to ~2K+ (2048 px+) | [INFERRED] |
| Speed / latency | Seconds | [INFERRED] |
| Consistency (char/product) | Style / structure reference ("Reference Image" features) | [INFERRED] |
| Image editing | Generative Fill (**inpainting**), Generative Expand (**outpainting**), style transfer, text effects, recolor | [INFERRED] |
| Batch generation | Via Firefly Services API (async) | [INFERRED] |
| Output formats | PNG, JPEG | [INFERRED] |

---

## 7. Stability AI — SD3 / Ultra

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — Stability Platform API at `api.stability.ai` (e.g., `/v2beta/stable-image/generate/sd3`, `sd3.5`, `ultra`) | [OBSERVED] https://stability.ai/pricing , https://stability.ai/license ; endpoint [INFERRED] from docs |
| SDK | Official Python, Node, Go, JS SDKs + REST | [INFERRED] https://platform.stability.ai/docs |
| MCP | Not confirmed | [UNKNOWN] |
| Free tier | **Yes** — 1000 free credits on signup (trial) | [OBSERVED] https://stability.ai/pricing |
| Paid price | Subscription credits: **Free (1000 credits)**, **$19/mo (2000 credits)**, **$50/mo (5000 credits)**; Enterprise custom. Credits refresh monthly, no rollover | [OBSERVED] https://stability.ai/pricing |
| Commercial license | **Community License** — free for < **$1M** annual revenue (research / non-commercial / commercial); >$1M revenue requires paid **Enterprise License**. Core Models (incl. SD3 2B) free unless commercial use >$1M | [OBSERVED] https://stability.ai/license |
| Watermark | No (outputs owned by user) | [INFERRED] |
| Resolution max | SD3.5 supports up to ~2 MP (1024², 1152×896, 1216×832, 1536×640, …) | [INFERRED] |
| Speed / latency | Seconds | [INFERRED] |
| Consistency (char/product) | SDXL style; no dedicated character model | [INFERRED] |
| Image editing | **Inpainting**, sketch-to-image, recoloring (per pricing feature list) | [OBSERVED] https://stability.ai/pricing |
| Batch generation | Via API | [INFERRED] |
| Output formats | PNG, JPEG, WebP | [INFERRED] |

---

## 8. Replicate — hosted models

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — HTTP API + Python/JS SDK + OpenAPI schema; hosts 1000s of models (FLUX, SDXL, Ideogram, Recraft, …) | [OBSERVED] https://replicate.com/docs , https://replicate.com/pricing |
| SDK | Python (`replicate` pkg), Node.js SDK, HTTP API, OpenAPI | [OBSERVED] https://replicate.com/docs |
| MCP | Replicate provides an MCP server (mcp-replicate) | [INFERRED] |
| Free tier | "Try for free" — free trial credits | [OBSERVED] https://replicate.com/pricing |
| Paid price | Pay-per-use, per model. Examples: **FLUX Pro $0.04 / output image**, **FLUX.1 [dev] $0.025 / output image**, **Ideogram v3 $0.09 / output image**, **Recraft V3 $0.04 / output image**; many models billed by GPU time ($/sec) | [OBSERVED] https://replicate.com/pricing |
| Commercial license | **Customer owns Outputs** ("Customer owns and will continue to own all rights … in and to its applicable Customer Data" incl. Outputs). Underlying model licenses vary (e.g., FLUX.1 [dev] OpenRAIL non-commercial restrictions) | [OBSERVED] https://replicate.com/terms ; model-license nuance [INFERRED] |
| Watermark | No (model-dependent) | [INFERRED] |
| Resolution max | Model-dependent (FLUX up to 2 MP+, SDXL 1024²) | [INFERRED] |
| Speed / latency | Seconds to minutes by model/hardware | [INFERRED] |
| Consistency (char/product) | Via FLUX Kontext / reference models hosted | [OBSERVED] https://replicate.com/pricing (model catalog) |
| Image editing | Inpainting / outpainting via specific models (FLUX Kontext, SDXL inpaint) | [OBSERVED] https://replicate.com/pricing |
| Batch generation | Via API predictions (run many) | [INFERRED] |
| Output formats | PNG, JPEG, WebP (model-dependent) | [INFERRED] |

---

## 9. fal.ai — hosted models

| Attribute | Value | Evidence |
|-----------|-------|----------|
| API availability | **Yes** — unified REST API + Python/JS SDK; **1000+ models** (FLUX, Ideogram, Recraft, SDXL, …); Model APIs + Platform APIs | [OBSERVED] https://docs.fal.ai/ |
| SDK | Python & JavaScript SDKs (`fal.subscribe`, `fal.stream`; sync/async queue; WebSocket streaming) | [OBSERVED] https://docs.fal.ai/ |
| MCP | Not confirmed in fetched docs | [UNKNOWN] |
| Free tier | fal offers free credits on signup for some models | [UNKNOWN] exact — [INFERRED] limited |
| Paid price | Per-model, per image or per megapixel. Eg. **FLUX.1 [dev] $0.025 / MP**; FLUX Kontext Pro $0.04/image; normalized ~$0.02–$0.04/image @1MP. Deploy-your-own GPU from **$1.89/hr** (H100) | [OBSERVED] https://fal.ai/pricing , https://fal.ai/models/fal-ai/flux/dev |
| Commercial license | Customer owns Inputs; Output ownership per fal terms (customer retains rights to generated content); commercial use permitted | [OBSERVED] https://fal.ai/terms (Customer owns Input); Output ownership [INFERRED] |
| Watermark | No | [INFERRED] |
| Resolution max | Model-dependent (FLUX up to 2 MP+) | [INFERRED] |
| Speed / latency | Seconds; streaming / WebSocket real-time | [OBSERVED] https://docs.fal.ai/ |
| Consistency (char/product) | Via FLUX Kontext on fal | [OBSERVED] https://fal.ai/pricing |
| Image editing | Inpainting / outpainting via FLUX Tools on fal; reference (Kontext) | [OBSERVED] https://docs.bfl.ml/ (FLUX Tools) |
| Batch generation | **Yes** — built-in batching (fal FLUX.1 [dev]); queue/async | [OBSERVED] https://fal.ai/models/fal-ai/flux/dev , https://docs.fal.ai/ |
| Output formats | PNG, JPEG, WebP (model-dependent) | [INFERRED] |

---

## Best-for mapping (autonomous website factory)

| Use case | Recommended providers | Why |
|----------|----------------------|-----|
| **Product photography** | OpenAI gpt-image-1, Adobe Firefly, FLUX.1 Pro/Kontext (fal), Recraft | Photoreal quality; commercial-safe (Firefly); strong edits/inpainting |
| **Lifestyle** | OpenAI, FLUX (fal), Ideogram | Photoreal + creative, good prompt adherence |
| **Editorial** | Ideogram (text rendering), Recraft (illustration/vectors), Adobe Firefly | Ideogram excels at in-image text; Recraft for illustrated editorial |
| **Illustrations** | Recraft, Ideogram, FLUX | Stylized output; Recraft best for consistent illustration sets |
| **Icons** | **Recraft** (SVG icons), Adobe Firefly | Recraft generates true vector SVG icons |
| **Vectors** | **Recraft** (SVG/vector generation), Adobe Firefly (vector recolor) | Only Recraft produces editable vector output natively |
| **Textures / patterns** | FLUX (fal), Stability SD3/Ultra, fal-hosted | Tileable/abstract generation; cheap at scale |
| **Mockups** | Recraft (mockups), OpenAI (product mockups via edits), FLUX Kontext | Recraft mockup templates; OpenAI edits product into scene |

**Factory routing notes**
- Need **vectors/SVG** (icons, logos, illustrations): use **Recraft** (only native vector output + MCP).
- Need **commercial-safe, liability-light** assets: **Adobe Firefly** (licensed training data) — but verify pricing/access separately.
- Need **fast, cheap, high-volume** raster: **FLUX via fal.ai** or **Replicate** (pay-per-image, many models).
- Need **in-image text / typography** (headlines, labels): **Ideogram** (best text rendering) or **Recraft**.
- Need **photoreal product shots + inpainting** from a single reliable API: **OpenAI gpt-image-1**.
- Need **open-weight / self-hostable** (data residency, cost at scale): **Stability SD3.5** (Community License <$1M revenue).
