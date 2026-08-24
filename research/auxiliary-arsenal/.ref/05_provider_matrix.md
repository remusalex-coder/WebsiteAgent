# BusinessForge — Premium Web + AI Media: Cost & License Matrix

> Research sub-agent output. Compiled 2026-08-19 from official sites / pricing / docs pages fetched via `curl` (Chrome/browser_exec unavailable in this environment). Where a page is JS-rendered and the exact dollar amount was not in the fetched HTML, the figure is marked **INFERRED** and the price is flagged UNKNOWN/ESTIMATE rather than invented.

## How to read this
- **EVIDENCE LEVEL** — `OBSERVED` = verified in fetched official HTML/JSON; `INFERRED` = not on the fetched page but well-documented / standard knowledge; `UNKNOWN` = could not verify.
- **COST TIER** — `free` (= $0 usable tier) / `low` (<$20/mo) / `medium` ($20–100/mo) / `high` (>$100/mo or per-credit enterprise).
- **PROGRAMMATIC GENERATION** — can it be driven from code/automation (critical for BusinessForge pipelines)?
- **cap.* recommendation** — whether BusinessForge should expose a capability flag for it.

## Quick index (cost tier + key signal)
| Provider | Category | Cost tier | API | Commercial rights |
|---|---|---|---|---|
| Higgsfield | ai-video | medium (UNKNOWN $) | YES (REST+MCP+CLI) | INFERRED yes (paid) |
| Runway | ai-video | low–medium | YES | OBSERVED yes |
| OpenAI Sora | ai-video | low (in ChatGPT Plus) | limited | INFERRED yes (paid) |
| Google Veo | ai-video | high (per-sec) | YES (Vertex) | OBSERVED yes (Google ToS) |
| Kling | ai-video | low–high | YES | OBSERVED yes (API) |
| Luma Dream Machine | ai-video | low–high | YES | OBSERVED yes |
| Pika | ai-video | low–medium | YES | OBSERVED yes |
| OpenAI Images / DALL·E | ai-image | low (per-image) | YES | OBSERVED yes (paid/API) |
| Google Imagen | ai-image | low (per-image) | YES (Vertex) | OBSERVED yes |
| FLUX / Black Forest Labs | ai-image | low (per-credit) | YES | MIXED (see block) |
| Midjourney | ai-image | low–medium | NO official API | OBSERVED yes (paid) |
| Stable Diffusion (open) | ai-image | free (self-host) | YES (self-host) | OBSERVED (open licenses) |
| ElevenLabs | voice | low–high | YES | OBSERVED yes |
| ElevenLabs Music | music | medium–high | YES | OBSERVED yes (limits) |
| Suno | music | low–medium | NO public API | OBSERVED yes (paid) |
| Udio | music | free (beta) UNKNOWN | NO | UNKNOWN |
| Mubert | music | low–high | YES (Render API) | OBSERVED yes (royalty-free) |
| Tripo | 3d | low–high | YES | OBSERVED yes (paid) |
| Meshy | 3d | low–high | YES | OBSERVED yes |
| Luma Genie | 3d | low–high | YES (Luma) | OBSERVED yes |
| Rodin | 3d | UNKNOWN $ | YES | INFERRED yes |
| GSAP | motion-lib | free | N/A (lib) | OBSERVED free (Webflow) |
| Lenis | motion-lib | free | N/A (lib) | OBSERVED MIT |
| Framer Motion / Motion | motion-lib | free (MIT) + Motion+ | N/A (lib) | OBSERVED MIT |
| Anime.js | motion-lib | free | N/A (lib) | OBSERVED free |
| Theatre.js | motion-lib | free | N/A (lib) | INFERRED MIT |
| Rive | motion-lib | free runtime + paid | N/A (lib) | OBSERVED (runtime free) |
| Lottie (LottieFiles) | motion-lib | free + paid | N/A (lib) | INFERRED (platform tiers) |
| Three.js | web-lib | free | N/A (lib) | INFERRED MIT |
| React Three Fiber | web-lib | free | N/A (lib) | INFERRED MIT |
| OGL | web-lib | free | N/A (lib) | OBSERVED Unlicense |
| WebGPU | web-lib | free (browser) | N/A (standard) | OBSERVED (85.56% support) |
| Locomotive Scroll | web-lib | free BUT DEPRECATED | N/A (lib) | OBSERVED MIT — DO NOT USE |

---

## PROVIDER: Higgsfield — https://higgsfield.ai  (SPECIAL FOCUS)
- CATEGORY: ai-video (also image/audio/3d via one API)
- API/SDK: **YES.** Official "Higgsfield API" docs state: *"Generate images, video, audio, and 3D content through one asynchronous API."* (title tag: "Higgsfield API - Higgsfield API Docs"). Also ships an **MCP server** (`/mcp` page, branded for Claude/Cursor/OpenAI/Perplexity) and a **CLI** (nav shows "MCP & CLI"). Endpoints not enumerated in fetched HTML (Mintlify docs JS-rendered) — **INFERRED** REST + webhooks. (EVIDENCE: OBSERVED API/MCP/CLI existence; endpoints INFERRED)
- PRICING / FREE TIER: **Credit-based.** Meta keywords expose tiers *"Higgsfield Basic Pro Ultimate Creator"* and *"Higgsfield credit-based pricing … cost per month"*. Exact dollar amounts are **NOT in the fetched HTML** (pricing page is client-rendered). → **UNKNOWN exact $ ; INFERRED credit-based monthly tiers (Basic/Pro/Ultimate/Creator)**. No verifiable free-tier credit number. (EVIDENCE: INFERRED)
- COMMERCIAL RIGHTS: ToS not scraped. **INFERRED** commercial use permitted on paid plans (standard for this category). Mark **UNKNOWN** until ToS confirmed. (EVIDENCE: UNKNOWN)
- QUALITY: High for short social/commercial clips; strong "cinematic" preset library and product/commercial templates visible in home JSON (e.g. "High-energy cinematic product commercial", "chocolate japanese style commercial"). (EVIDENCE: OBSERVED marketing/presets)
- LATENCY: Not documented on fetched pages. **UNKNOWN** (typical 30s–few min per clip, INFERRED).
- CONSISTENCY: Good enough for single-product hero/fashion ads with camera moves; no hard character-lock across a long sequence (INFERRED). Key for product video: its camera-control presets (dolly/push/orbit) are purpose-built for product showcases.
- CAPABILITIES: Text-to-video, **image-to-video** (core "camera control" value prop — animate a still with directed camera moves), audio (SFX/music), 3D. Tagline: *"The ultimate AI-powered camera control for creators by creators."* Director-style camera presets are a differentiator vs Runway/Pika. (EVIDENCE: OBSERVED tagline + presets)
- PROGRAMMATIC GENERATION: **YES — strong.** Async REST API + MCP + CLI means it can be called from automation/agents directly. (EVIDENCE: OBSERVED)
- LIMITATIONS: Watermark policy UNKNOWN; content policy present (home JSON shows safety constraints e.g. "no nudity"); rate limits tied to credit tier (UNKNOWN). (EVIDENCE: INFERRED)
- BUSINESSFORGE RELEVANCE: **HIGH.** Purpose-built for product/commercial video with camera control, and uniquely offers API + MCP + CLI for agent-driven generation. Best fit for `cap.product_video_generation`.
- COST TIER: medium (UNKNOWN exact)
- EVIDENCE LEVEL: OBSERVED (API/MCP/CLI, capabilities, camera control) + INFERRED/UNKNOWN (price, commercial rights, latency)
- **cap.* RECOMMENDATION for BusinessForge:** Expose **`cap.video_generation` = yes**, **`cap.product_video_generation` = yes** (Higgsfield's strongest use case — directed camera control on product stills), and **`cap.image_to_video` = yes**. Treat as a premium/paid backend behind these caps; gate on credit balance.

---

## PROVIDER: Runway — https://runwayml.com
- CATEGORY: ai-video (also image, 3D/asset)
- API/SDK: **YES** — Runway API (Gen-4/4.5/Aleph), webhooks, "API" nav item present. (EVIDENCE: OBSERVED)
- PRICING / FREE TIER: **OBSERVED.** Free $0 (125 one-time credits, no expiry). Paid: **Standard $12/mo** (625 credits/mo), **Pro $28/mo** (2,250 credits/mo), **Unlimited $76/mo** (9,500 credits/mo). Credits: Gen-4.5 = 12 credits/sec; Gen-4 Turbo cheaper; image gens ~1 credit; Aleph 2.0 = 140 credits/5s. (EVIDENCE: OBSERVED from pricing HTML + JSON)
- COMMERCIAL RIGHTS: **OBSERVED** — paid plans include "No watermarks" + commercial use; users own outputs. Enterprise/Model-Weights licensing available. (EVIDENCE: OBSERVED)
- QUALITY: Top-tier (Gen-4.5/4.5 Turbo, Aleph). Strong for films/ads. (EVIDENCE: OBSERVED)
- LATENCY: Not explicitly documented; seconds–minutes per clip (INFERRED).
- CONSISTENCY: Good (Act-One, Aleph for character/scene consistency). (INFERRED)
- CAPABILITIES: Text-to-video, image-to-video, video-to-video, camera control, upscaling (4K), Act-One (performer-driven). (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (API + webhooks). (EVIDENCE: OBSERVED)
- LIMITATIONS: Watermark on free; credit caps; content policy. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — mature API, commercial rights, strong quality.
- COST TIER: low–medium
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: OpenAI Sora — https://openai.com/sora
- CATEGORY: ai-video
- API/SDK: Sora is a ChatGPT feature; **limited/NO standalone public generation API** (developer API access is restricted/whitelisted). (EVIDENCE: INFERRED — page JS-rendered, no API docs fetched)
- PRICING / FREE TIER: **INFERRED.** Included in ChatGPT plans: Free (limited), **Plus ~$20/mo**, **Pro ~$200/mo** (higher video limits / priority). Sora generations count against plan quotas. Exact Sora video caps UNKNOWN from fetched page. (EVIDENCE: INFERRED)
- COMMERCIAL RIGHTS: **INFERRED** yes on paid plans under OpenAI policy (outputs owned by user; enterprise terms for Business/Enterprise). (EVIDENCE: INFERRED)
- QUALITY: High (Sora 2/2.0/3 family), realistic motion + audio. (INFERRED)
- LATENCY: Minutes per clip (INFERRED).
- CONSISTENCY: Good (INFERRED).
- CAPABILITIES: Text-to-video, image-to-video, storyboard/remix. (INFERRED)
- PROGRAMMATIC GENERATION: Limited — not reliably callable from automation without API access. (EVIDENCE: INFERRED)
- LIMITATIONS: Watermark/C2PA on free; policy restrictions; no guaranteed API. (INFERRED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — great quality but weak programmatic access for automation; use as manual/agency step, not primary pipeline backend.
- COST TIER: low (bundled in Plus)
- EVIDENCE LEVEL: INFERRED (page not fetchable for numbers)

---

## PROVIDER: Google Veo / Imagen — https://deepmind.google/technologies/veo  · Cloud: https://cloud.google.com/vertex-ai/generative-ai/pricing
- CATEGORY: ai-video (Veo) + ai-image (Imagen)
- API/SDK: **YES** — Google Cloud Vertex AI API (REST + SDK). (EVIDENCE: OBSERVED pricing table)
- PRICING / FREE TIER: **OBSERVED (Vertex AI pricing page):**
  - **Veo 3.1**: $0.40 / count (720p & 1080p), $0.60 / count (4K); with audio. **Veo 3.1 Fast** $0.10 (720p) / $0.12 (1080p). **Veo 3.1 Lite** $0.05 / $0.08. **Veo 3** $0.40. **Veo 2** $0.50 / count (720p). ("1 count" ≈ 1 second of video.)
  - **Imagen 4**: $0.04 / image (gen), $0.06 (Ultra), $0.02 (Fast). **Imagen 3**: $0.04 / $0.02. **Imagen Product Recontext** (product-in-scene) $0.12 / image. Imagen 1 upscaling $0.003.
  - Free tier: Vertex AI "Free" $0.00 for first 5,000 units (trial). (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED (Google GenAI ToS)** — customers own generated outputs; use subject to Google's Generative AI Prohibited Use Policy. (EVIDENCE: OBSERVED ToS via Cloud)
- QUALITY: Top-tier (Veo 3.1 + Imagen 4). (EVIDENCE: OBSERVED)
- LATENCY: Seconds–minutes (INFERRED).
- CONSISTENCY: Strong (INFERRED).
- CAPABILITIES: Text-to-video, image-to-video (reference image), synchronized audio (Veo 3+), text-to-image, product recontext, inpainting. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (Vertex API, fully automatable, enterprise SLA). (EVIDENCE: OBSERVED)
- LIMITATIONS: Content policy, geographic availability, pay-per-use metering. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — best for programmatic, commercial, high-quality image+video with clear pricing; Imagen Product Recontext is directly useful for product shots.
- COST TIER: high (per-second video) but image is low
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Kling AI — https://klingai.com/global
- CATEGORY: ai-video (also image)
- API/SDK: **YES** — official "document-api" (Image API + Video API). (EVIDENCE: OBSERVED)
- PRICING / FREE TIER: **OBSERVED (API pricing JSON):**
  - Image API: 1 Unit = **$0.0035**. Kling Image 3.0 = 8 Units ($0.028)/image; Image 2.1 = 4 Units ($0.014).
  - Video API: 1 Unit = **$0.14**. Kling 3.0 = $0.112–0.168 /s (1080p), $0.42 /s (4K); Kling 3.0 Turbo = $0.14 /s; Kling 3.0 Omni = $0.112–0.168 /s.
  - Consumer tiers exist (Standard/Pro/Premium/Ultimate credit packs); enterprise "typically 5,000–30,000 USD/month". (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — "API Access" + "commercial production" framing; commercial use permitted. (EVIDENCE: OBSERVED)
- QUALITY: High (Kling 3.0, native 4K, strong motion). (EVIDENCE: OBSERVED)
- LATENCY: Seconds–minutes (INFERRED).
- CONSISTENCY: Good; supports "outfit, scene, prop replacement" for e-commerce (OBSERVED).
- CAPABILITIES: Text-to-video, image-to-video, 4K, camera control, multi-shot, e-commerce video. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (document API). (EVIDENCE: OBSERVED)
- LIMITATIONS: Content policy; rate caps on lower tiers. (INFERRED)
- BUSINESSFORGE RELEVANCE: **HIGH** — strong API, clear per-second pricing, e-commerce presets.
- COST TIER: low (image) – high (4K video)
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Luma Dream Machine — https://lumalabs.ai/dream-machine
- CATEGORY: ai-video (also image, 3D/Genie)
- API/SDK: **YES** — Dream Machine API (image + video + Genie 3D). (EVIDENCE: INFERRED from plan/API naming; OBSERVED plan data)
- PRICING / FREE TIER: **OBSERVED.** Luma **Plus $30/mo** (10,000 credits, commercial use), **Pro $90/mo** (40,000 credits, 4× Luma Agents), **Ultra $300/mo** (150,000 credits, 15× Agents). Credits reset monthly. (EVIDENCE: OBSERVED from home JSON + schema Offers)
- COMMERCIAL RIGHTS: **OBSERVED** — "Commercial use" listed as a plan feature. (EVIDENCE: OBSERVED)
- QUALITY: High (Ray/Flash models). (INFERRED)
- LATENCY: Seconds–minutes (INFERRED).
- CONSISTENCY: Good (INFERRED).
- CAPABILITIES: Text-to-video, image-to-video, keyframe/reference, image gen, 3D Genie, audio. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (API). (EVIDENCE: INFERRED/YES)
- LIMITATIONS: Credit caps; content policy. (INFERRED)
- BUSINESSFORGE RELEVANCE: **HIGH** — one account covers video + image + 3D, commercial rights, API.
- COST TIER: low–high
- EVIDENCE LEVEL: OBSERVED (pricing/rights) + INFERRED (API endpoints)

---

## PROVIDER: Pika — https://pika.art
- CATEGORY: ai-video
- API/SDK: **YES** — Pika API (OBSERVED nav/API). (EVIDENCE: INFERRED/YES)
- PRICING / FREE TIER: **OBSERVED.** Free $0; **Standard $8/mo**; **Pro $28/mo**; **Ultra $76/mo**. Credit costs: Turbo video 10 credits, Pro video 20 credits, Pro twists 80 credits, Pikatwists 60. (EVIDENCE: OBSERVED from pricing HTML)
- COMMERCIAL RIGHTS: **OBSERVED** — "Commercial use" and "Download videos with no watermark" listed as plan features. (EVIDENCE: OBSERVED)
- QUALITY: Good–high (Pika 2/2.2, Pikascenes/Pikadditions). (INFERRED)
- LATENCY: Seconds–minutes (INFERRED).
- CONSISTENCY: Moderate–good (INFERRED).
- CAPABILITIES: Text-to-video, image-to-video, Pikascenes (scene edit), Pikadditions, Pikaswaps, lip-sync. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (API). (EVIDENCE: INFERRED/YES)
- LIMITATIONS: Watermark on free; credit caps. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — solid budget video backend; weaker consistency than Runway/Higgsfield for hero product films.
- COST TIER: low–medium
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: OpenAI Images / DALL·E — https://openai.com/index/dall-e-3  · API: https://platform.openai.com/docs/models
- CATEGORY: ai-image
- API/SDK: **YES** — GPT-Image-1 + DALL·E 3 via OpenAI API (REST/SDK). (EVIDENCE: INFERRED — business pricing page is feature-list only; API per-image cost not in fetched HTML)
- PRICING / FREE TIER: **INFERRED (API docs knowledge, not in fetched HTML).** gpt-image-1: ~$0.011 (1024²) to ~$0.167 (full quality) per image; DALL·E 3: $0.040–$0.120 per image by size. ChatGPT Free includes limited image gen. → mark **UNKNOWN exact on fetched page; INFERRED per-image API pricing**. (EVIDENCE: INFERRED)
- COMMERCIAL RIGHTS: **OBSERVED/INFERRED** — paid/API users own outputs and may use commercially under OpenAI policy. (EVIDENCE: INFERRED)
- QUALITY: High (gpt-image-1 / DALL·E 3). (INFERRED)
- LATENCY: Seconds–tens of seconds (INFERRED).
- CONSISTENCY: Moderate (no hard IP/character lock; INFERRED).
- CAPABILITIES: Text-to-image, image edit/inpainting, transparent PNG, (Thinking mode). (INFERRED)
- PROGRAMMATIC GENERATION: **YES** (API, easy to automate). (EVIDENCE: INFERRED/YES)
- LIMITATIONS: Content policy, rate limits, no guaranteed character consistency. (INFERRED)
- BUSINESSFORGE RELEVANCE: **HIGH** — cheapest, easiest image API; good for backgrounds/products but not hero consistency.
- COST TIER: low (per-image)
- EVIDENCE LEVEL: INFERRED (API pricing not on fetched page)

---

## PROVIDER: Google Imagen (standalone) — https://cloud.google.com/vertex-ai/generative-ai/docs/image/generation/imagen
- CATEGORY: ai-image
- API/SDK: **YES** — Vertex AI Imagen API. (EVIDENCE: OBSERVED pricing)
- PRICING / FREE TIER: **OBSERVED** — see Veo/Imagen block above (Imagen 4 $0.04, Fast $0.02, Ultra $0.06; Product Recontext $0.12). (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — Google ToS: customer owns outputs. (EVIDENCE: OBSERVED)
- QUALITY: Top-tier, best-in-class text rendering + product recontext. (EVIDENCE: OBSERVED)
- LATENCY: Seconds (INFERRED).
- CONSISTENCY: Good; Product Recontext keeps product identity across scenes. (EVIDENCE: OBSERVED $0.12 feature)
- CAPABILITIES: Text-to-image, edit, mask inpaint, upscale, **Product Recontext** (re-imagine product in new scene), fine-tune subject. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (Vertex API). (EVIDENCE: OBSERVED)
- LIMITATIONS: Content policy, regional availability. (INFERRED)
- BUSINESSFORGE RELEVANCE: **HIGH** — Imagen Product Recontext is a direct product-photography automation win.
- COST TIER: low (per-image)
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: FLUX / Black Forest Labs — https://blackforestlabs.ai  · API: https://docs.bfl.ml  · https://api.bfl.ai
- CATEGORY: ai-image (open-weight + hosted API)
- API/SDK: **YES** — BFL API at api.bfl.ai (OpenAPI published), plus open weights on Hugging Face / fal.ai. (EVIDENCE: OBSERVED — "api.bfl.ai/openapi.json"; "1 credit equals $0.01 USD")
- PRICING / FREE TIER: **OBSERVED.** BFL API: **1 credit = $0.01 USD**; models include FLUX 3, FLUX.2, FLUX.1, batch. Open-weight self-hosting: **FLUX.1 [dev] / [schnell]** free to run locally (schnell = Apache 2.0; dev = FLUX Non-Commercial / research license). (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **MIXED (OBSERVED).** FLUX Pro / hosted API = commercial license. FLUX.1-dev open weights = **non-commercial** license (research/personal); FLUX.1-schnell = Apache 2.0 (commercial OK). Self-hosted commercial license available via bfl.ai/licensing. (EVIDENCE: OBSERVED licensing page)
- QUALITY: Top-tier (FLUX.1/2/3). (EVIDENCE: OBSERVED)
- LATENCY: Seconds (API) / depends on local GPU (self-host). (INFERRED)
- CONSISTENCY: Moderate–good; FLUX.1 Kontext [dev] for context/edit (INFERRED).
- CAPABILITIES: Text-to-image, image editing (Kontext), open weights, batch API. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (REST API + self-host). (EVIDENCE: OBSERVED)
- LIMITATIONS: dev weights non-commercial; content policy on hosted. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — flexible ($0.01/credit API or free self-hosted schnell/Apache); choose commercial license deliberately.
- COST TIER: low (per-credit) / free (self-host)
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Midjourney — https://www.midjourney.com  · https://docs.midjourney.com/docs/plans
- CATEGORY: ai-image
- API/SDK: **NO official API** (web/Discord only; third-party wrappers violate ToS). (EVIDENCE: INFERRED — no API page found)
- PRICING / FREE TIER: **OBSERVED.** Monthly: Basic **$10**, Standard **$30**, Pro **$60**, Mega **$120**. Annual (effective/mo): $8, $24, $48, $96. (EVIDENCE: OBSERVED from plans table)
- COMMERCIAL RIGHTS: **OBSERVED** — "General Commercial Terms" listed for all paid tiers (free trial excluded). (EVIDENCE: OBSERVED)
- QUALITY: Top-tier aesthetic. (INFERRED)
- LATENCY: Seconds–minutes (INFERRED).
- CONSISTENCY: Moderate (no hard IP lock; --cref for character reference). (INFERRED)
- CAPABILITIES: Text-to-image, image prompt, editing, character reference. (INFERRED)
- PROGRAMMATIC GENERATION: **NO** (no official API). (EVIDENCE: INFERRED)
- LIMITATIONS: No API; content policy; Pro/Mega required if company >$1M revenue. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **MEDIUM/LOW for automation** — great quality but no programmatic API; use for manual/agency asset creation only.
- COST TIER: low–medium
- EVIDENCE LEVEL: OBSERVED (pricing/rights) + INFERRED (no API)

---

## PROVIDER: Stable Diffusion (open) — https://stability.ai  · https://github.com/Stability-AI/stablediffusion
- CATEGORY: ai-image (open-source models)
- API/SDK: **YES (self-host)** — run locally / Stability Platform API. (EVIDENCE: INFERRED)
- PRICING / FREE TIER: **Free** to self-host (SDXL, SD3.5, Stable Image Core). Stability Platform API paid per image (INFERRED; not fetched). (EVIDENCE: OBSERVED open-source + Stability self-hosted license page)
- COMMERCIAL RIGHTS: **OBSERVED (mixed).** Stability AI License / Community License Agreement: SD3.5 Community license permits commercial use under revenue thresholds; self-hosted commercial license for larger. Models "trained on fully licensed data." (EVIDENCE: OBSERVED)
- QUALITY: Good (SDXL/SD3.5); below FLUX/Imagen for photorealism. (INFERRED)
- LATENCY: Depends on GPU (INFERRED).
- CONSISTENCY: Moderate (LoRA/embeddings for IP). (INFERRED)
- CAPABILITIES: Text-to-image, inpaint, control nets, video (Stable Video), audio (Stable Audio). (INFERRED)
- PROGRAMMATIC GENERATION: **YES** (self-host / API). (EVIDENCE: INFERRED/YES)
- LIMITATIONS: Requires GPU; license thresholds; quality vs hosted leaders. (INFERRED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — zero marginal cost at scale if GPU available; weaker quality; good for private/controlled generation.
- COST TIER: free (self-host)
- EVIDENCE LEVEL: OBSERVED (license) + INFERRED (quality/cost)

---

## PROVIDER: ElevenLabs — https://elevenlabs.io  · https://elevenlabs.io/pricing
- CATEGORY: voice
- API/SDK: **YES** — full REST API + SDK + webhooks. (EVIDENCE: OBSERVED)
- PRICING / FREE TIER: **OBSERVED.** Free $0 (10,000 credits); **Starter $6** (30,000); **Creator $22** (121,000); **Pro $99** (600,000); **Scale $299** (1,800,000, 3 seats); **Business $990** (6,000,000, 10 seats); Enterprise custom. Credit costs: TTS ~1 credit/char; SFX 25/min; Voice Changer/Isolator 1,000/min; Dubbing 2,000–10,000/min. (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — "Commercial License" included on paid plans. (EVIDENCE: OBSERVED)
- QUALITY: Best-in-class TTS/voice cloning. (INFERRED)
- LATENCY: Real-time / seconds (INFERRED).
- CONSISTENCY: High (voice clones stable). (INFERRED)
- CAPABILITIES: TTS, voice cloning, dubbing, voice changer, SFX, speech-to-text. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (API). (EVIDENCE: OBSERVED)
- LIMITATIONS: Watermark on auto-dubbing (removable paid); content policy; voice-clone consent. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — default voice backend; cheap, commercial, API-native.
- COST TIER: low–high
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: ElevenLabs Music — https://elevenlabs.io/music
- CATEGORY: music
- API/SDK: **YES** (same ElevenLabs API; Music v1 = 98 credits/min, 900 credits/min in cost tables). (EVIDENCE: OBSERVED from pricing JSON)
- PRICING / FREE TIER: Shared ElevenLabs credit plans (see ElevenLabs). Music v1 ≈ 900 credits/min. (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — "Trained on licensed data only. Every track you generate is cleared for commercial use." Self-serve: online/offline commercial OK **except film, TV, and Studio Games**; Enterprise lifts those. (EVIDENCE: OBSERVED FAQ)
- QUALITY: High, licensed music generation. (INFERRED)
- LATENCY: Minutes per track (INFERRED).
- CONSISTENCY: N/A (music). (INFERRED)
- CAPABILITIES: Prompt-to-music, custom model fine-tune, licensed tracks. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (API). (EVIDENCE: OBSERVED)
- LIMITATIONS: Film/TV/Studio Games excluded on self-serve (INFERRED from FAQ). (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — licensed, commercial-safe music for web/video without stock fees.
- COST TIER: medium–high
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Suno — https://suno.com  · https://suno.com/pricing
- CATEGORY: music
- API/SDK: **NO public API** (web app only). (EVIDENCE: INFERRED — pricing page JS, no API)
- PRICING / FREE TIER: **OBSERVED.** Free: 50 credits/day (10 songs), **no commercial use**. **Pro $8/mo**: 2,500 credits (~500 songs), commercial rights. **Premier $24/mo**: 10,000 credits (~2,000 songs), commercial rights. (Note: page shows "$10/month (starting 9/3/26)" — possible upcoming repricing; treat $8/$24 as current OBSERVED.) (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — commercial use rights for songs made while subscribed on Pro/Premier; Free = none. (EVIDENCE: OBSERVED)
- QUALITY: High for song sketches. (INFERRED)
- LATENCY: Seconds–minutes (INFERRED).
- CAPABILITIES: Text-to-song, personas, stems, editing. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **NO** (no API). (EVIDENCE: INFERRED)
- LIMITATIONS: No API; free no commercial; content policy. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **LOW for automation** — good manual music ideation; not pipeline-callable.
- COST TIER: low–medium
- EVIDENCE LEVEL: OBSERVED (pricing/rights) + INFERRED (no API)

---

## PROVIDER: Udio — https://udio.com
- CATEGORY: music
- API/SDK: **NO public API** (web only, beta). (EVIDENCE: UNKNOWN — page JS-rendered, 44-char fetch)
- PRICING / FREE TIER: **UNKNOWN** — free during beta; no public price table fetched. (EVIDENCE: UNKNOWN)
- COMMERCIAL RIGHTS: **UNKNOWN** from fetched page. (EVIDENCE: UNKNOWN)
- QUALITY: High (INFERRED, competitor to Suno).
- CAPABILITIES: Text-to-song, stems, remix (INFERRED).
- PROGRAMMATIC GENERATION: **NO** (INFERRED).
- BUSINESSFORGE RELEVANCE: **LOW** — no API, no verified pricing/rights.
- COST TIER: free (beta) UNKNOWN
- EVIDENCE LEVEL: UNKNOWN

---

## PROVIDER: Mubert — https://mubert.com  · https://mubert.com/render
- CATEGORY: music
- API/SDK: **YES** — Mubert Render API (royalty-free music generation/licensing). (EVIDENCE: OBSERVED Render + license pages)
- PRICING / FREE TIER: **UNKNOWN exact $** (pricing page JS-rendered; 0 $ hits). Mubert offers Free + paid subscription tiers + per-track licensing; "Pro license for monetized projects / long-form content (YouTube, etc.)", "single-track licensing = perpetual life-long license." → **INFERRED** subscription (Free / ~$14/mo Pro class) + API per-track. (EVIDENCE: INFERRED)
- COMMERCIAL RIGHTS: **OBSERVED** — "royalty-free music", users "may freely utilize compositions in commercial projects"; Pro license for monetized/long-form; single-track = perpetual license. (EVIDENCE: OBSERVED FAQ)
- QUALITY: Production-ready royalty-free tracks/background music. (INFERRED)
- CAPABILITIES: Royalty-free music generation, playlists, API, licensing. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (Render API). (EVIDENCE: OBSERVED)
- LIMITATIONS: License tiers; not custom-songlike (generative ambient/tracks). (INFERRED)
- BUSINESSFORGE RELEVANCE: **MEDIUM/HIGH** — clean royalty-free background music + API for automation; safer than Suno for web bgm.
- COST TIER: low–high (UNKNOWN exact)
- EVIDENCE LEVEL: OBSERVED (API/rights) + INFERRED (price)

---

## PROVIDER: Tripo — https://tripo3d.ai  · https://tripo3d.ai/pricing
- CATEGORY: 3d
- API/SDK: **YES** — Tripo API/platform (platform.tripo3d.ai). (EVIDENCE: INFERRED — pricing page confirms API-style plans; platform page blocked)
- PRICING / FREE TIER: **OBSERVED.** Free $0 (public models, non-commercial). **Pro $19.90/mo** (~200 models, $0.16/model); **Premium $89.90/mo** (~1,660 models, $0.09/model); **Ultra $109.90/mo**; **Ultra monthly $329.70/mo**. Yearly: $238.80 / $1,078.80 / $1,978.20. (EVIDENCE: OBSERVED from pricing HTML)
- COMMERCIAL RIGHTS: **OBSERVED** — paid plans = "Private Models · Commercial Use"; free = "Public Models · Non-Commercial Use". (EVIDENCE: OBSERVED)
- QUALITY: Strong image-to-3D / text-to-3D. (INFERRED)
- LATENCY: Seconds–minutes per model (INFERRED).
- CAPABILITIES: Text-to-3D, image-to-3D, rigging, texture, batch export, DCC bridge. (EVIDENCE: OBSERVED feature list)
- PROGRAMMATIC GENERATION: **YES** (API). (EVIDENCE: INFERRED/YES)
- LIMITATIONS: Free non-commercial; credit/queue limits. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — turn product photos into 3D viewer assets programmatically with commercial rights.
- COST TIER: low–high
- EVIDENCE LEVEL: OBSERVED (pricing/rights) + INFERRED (API)

---

## PROVIDER: Meshy — https://meshy.ai  · https://meshy.ai/pricing
- CATEGORY: 3d
- API/SDK: **YES** — API access on Pro+ (OBSERVED: "Pro at $20/mo gets you ... API access"). (EVIDENCE: OBSERVED)
- PRICING / FREE TIER: **OBSERVED.** Free $0 (100 credits/mo, **CC BY 4.0** license). **Pro $20/mo** (1,000 credits, private license, API). **Premium $40/mo** (3,000 credits). **Ultra $100/mo** (8,000 credits). **Studio $70/mo** (1 member, $10/mo extra seats). (EVIDENCE: OBSERVED FAQ + Offers JSON)
- COMMERCIAL RIGHTS: **OBSERVED** — paid = private license/commercial; free = CC BY 4.0 (commercial w/ attribution). (EVIDENCE: OBSERVED)
- QUALITY: Strong text/image-to-3D, PBR. (INFERRED)
- LATENCY: Seconds–minutes; Pro "60% faster" (OBSERVED). (EVIDENCE: OBSERVED)
- CAPABILITIES: Text-to-3D, image-to-3D, texture, rig, API, 10 concurrent tasks (Pro). (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: **YES** (API on Pro+). (EVIDENCE: OBSERVED)
- LIMITATIONS: Free non-commercial (CC BY); queue priority lower on free. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — cheapest commercial 3D API with clear rights; good for product 3D.
- COST TIER: low–high
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Luma Genie — https://lumalabs.ai/genie
- CATEGORY: 3d
- API/SDK: **YES** — part of Luma API (Dream Machine/Genie). Note: the standalone `/genie` URL returned a 404 page in fetch; Genie is accessed via Luma app/API. (EVIDENCE: INFERRED)
- PRICING / FREE TIER: Covered by Luma plans (Plus $30 / Pro $90 / Ultra $300) — see Luma Dream Machine block. Genie uses Luma credits. (EVIDENCE: OBSERVED Luma plans)
- COMMERCIAL RIGHTS: **OBSERVED** — Luma plans include "Commercial use". (EVIDENCE: OBSERVED)
- QUALITY: Strong image-to-3D. (INFERRED)
- CAPABILITIES: Image-to-3D, text-to-3D via Luma. (INFERRED)
- PROGRAMMATIC GENERATION: **YES** (Luma API). (EVIDENCE: INFERRED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — secondary 3D option; Luma already covered for video. (EVIDENCE: INFERRED)
- COST TIER: low–high
- EVIDENCE LEVEL: INFERRED (endpoint) + OBSERVED (plans/rights)

---

## PROVIDER: Rodin — https://hyperhuman.deemos.com/rodin
- CATEGORY: 3d
- API/SDK: **YES** — Rodin API (Deemos HyperHuman). (EVIDENCE: INFERRED — known API; pricing not in fetched HTML)
- PRICING / FREE TIER: **UNKNOWN exact $** (0 $ hits in fetch; page JS-rendered). Rodin offers free daily generations + paid credit packs (INFERRED). → mark UNKNOWN exact. (EVIDENCE: UNKNOWN)
- COMMERCIAL RIGHTS: **INFERRED** yes on paid (typical). (EVIDENCE: UNKNOWN)
- QUALITY: High (image-to-3D, game-ready). (INFERRED)
- CAPABILITIES: Image-to-3D, text-to-3D, rigging. (INFERRED)
- PROGRAMMATIC GENERATION: **YES** (API). (EVIDENCE: INFERRED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — strong 3D but unverified pricing/rights here. (EVIDENCE: UNKNOWN)
- COST TIER: UNKNOWN
- EVIDENCE LEVEL: UNKNOWN (fetch); INFERRED API exists

---

## PROVIDER: GSAP — https://gsap.com  · https://gsap.com/pricing
- CATEGORY: motion-lib
- API/SDK: N/A (client JS library).
- PRICING / FREE TIER: **OBSERVED — FREE FOR EVERYONE.** Home: *"GSAP is now free for everyone, thanks to Webflow's support!"* All plugins (formerly Club GSAP "no charge" club) are now free, including bonus plugins. (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — free for commercial use (no charge / "no charge" club). (EVIDENCE: OBSERVED)
- QUALITY: Industry-standard animation. (INFERRED)
- CAPABILITIES: Timelines, ScrollTrigger, MorphSVG, SplitText, etc. — all free now. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: N/A (library). (EVIDENCE: OBSERVED)
- LIMITATIONS: None meaningful; standard license. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — default premium animation lib, zero cost, commercial-safe. (EVIDENCE: OBSERVED)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Lenis — https://lenis.studio (redirects to https://lenis.dev)  · https://github.com/darkroomengineering/lenis
- CATEGORY: motion-lib (smooth scroll)
- API/SDK: N/A (client JS library). `npm install lenis`.
- PRICING / FREE TIER: **OBSERVED — FREE, open-source.** Docs: *"Lenis is a free, open-source library that turns native scroll into a silky, controllable experience."* Lightweight (<4kb). (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — MIT licensed (GitHub repo shows MIT). (EVIDENCE: OBSERVED MIT)
- QUALITY: Best-in-class smooth scroll. (INFERRED)
- CAPABILITIES: Smooth/inertia scroll, infinite scroll, horizontal, React/Vue/Svelte wrappers. (EVIDENCE: OBSERVED)
- PROGRAMMATIC GENERATION: N/A (lib). (EVIDENCE: OBSERVED)
- LIMITATIONS: None. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — recommended smooth-scroll standard. (EVIDENCE: OBSERVED)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Framer Motion / Motion — https://motion.dev
- CATEGORY: motion-lib
- API/SDK: N/A (client JS/React library).
- PRICING / FREE TIER: **OBSERVED — FREE, MIT.** Home: *"Motion 13.1.0 Free — Completely free to use, MIT licensed and open source."* A paid **Motion+** tier adds "AI Kit and Motion UI" (premium APIs/examples/lifetime updates). (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — MIT, free for commercial. (EVIDENCE: OBSERVED)
- QUALITY: Production-grade (powers Framer/Figma sites). (INFERRED)
- CAPABILITIES: Animation for React/JS/Vue, gestures, layout, scroll, AI Kit. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — free MIT animation for React sites; Motion+ optional for AI features. (EVIDENCE: OBSERVED)
- COST TIER: free (MIT) + Motion+ paid
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Anime.js — https://animejs.com
- CATEGORY: motion-lib
- API/SDK: N/A (client JS library).
- PRICING / FREE TIER: **OBSERVED — 100% free.** *"Anime.js is 100% free and is only made possible with the help of our sponsors."* (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — free (MIT-style; sponsor-funded). (EVIDENCE: OBSERVED)
- QUALITY: Fast, flexible engine. (INFERRED)
- CAPABILITIES: JS animation engine, SVG, timelines, modular. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — good lightweight alternative to GSAP/Motion. (EVIDENCE: OBSERVED)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Theatre.js — https://www.theatrejs.com
- CATEGORY: motion-lib
- API/SDK: N/A (client JS library).
- PRICING / FREE TIER: **INFERRED — free, open-source (MIT).** No paid tier found; community/open-source project. (EVIDENCE: INFERRED; license MIT standard)
- COMMERCIAL RIGHTS: **INFERRED** MIT (commercial OK). (EVIDENCE: INFERRED)
- QUALITY: Pro-grade keyframe animation for the web (used with React/Three.js). (INFERRED)
- CAPABILITIES: Timeline/keyframe animation, state, editor. (INFERRED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — useful for complex sequenced web animation; free. (EVIDENCE: INFERRED)
- COST TIER: free
- EVIDENCE LEVEL: INFERRED

---

## PROVIDER: Rive — https://rive.app  · https://rive.app/pricing
- CATEGORY: motion-lib (interactive animation / runtime)
- API/SDK: N/A (design tool + open-source runtimes).
- PRICING / FREE TIER: **INFERRED** — free tier (Rive editor free for individuals) + paid tiers (Pro/Team/Enterprise). Pricing page JS-rendered (0 $ hits). Runtimes are **open-source & free**. (EVIDENCE: OBSERVED runtimes free; price INFERRED)
- COMMERCIAL RIGHTS: **OBSERVED** — "Open source runtimes that run your Rive files natively on any platform" (free, incl. commercial). Editor/collaboration tiers paid. (EVIDENCE: OBSERVED)
- QUALITY: Best-in-class interactive/state-machine animation. (INFERRED)
- CAPABILITIES: State machines, interactive animation, runtimes for web/React Native/Unity/Unreal/etc. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — interactive animated UI/icons with free runtime; great differentiator for premium sites. (EVIDENCE: OBSERVED)
- COST TIER: free runtime + paid editor
- EVIDENCE LEVEL: OBSERVED (runtimes) + INFERRED (editor price)

---

## PROVIDER: Lottie (LottieFiles) — https://lottiefiles.com  · https://lottiefiles.com/pricing
- CATEGORY: motion-lib
- API/SDK: N/A (animation format + platform); Lottie web player is open-source.
- PRICING / FREE TIER: **INFERRED** — LottieFiles free tier (free animations, limited) + paid Pro/Team/Enterprise. Pricing page tiny/JS (5.6KB). The Lottie format & lottie-web player are free/open. (EVIDENCE: INFERRED; format free OBSERVED)
- COMMERCIAL RIGHTS: **INFERRED** — free animations usable; paid plans for teams/assets/CDN. (EVIDENCE: INFERRED)
- QUALITY: Lightweight vector animations. (INFERRED)
- CAPABILITIES: 800k+ free/premium animations, dotLottie, Motion Copilot, CDN, Figma/Webflow. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — easy lightweight motion; pair with free lottie-web player. (EVIDENCE: INFERRED)
- COST TIER: free + paid
- EVIDENCE LEVEL: INFERRED (price) + OBSERVED (format/player free)

---

## PROVIDER: Three.js — https://threejs.org
- CATEGORY: web-lib (3D)
- API/SDK: N/A (client JS library).
- PRICING / FREE TIER: **FREE, open-source.** (EVIDENCE: INFERRED MIT — Three.js is MIT; page confirms open project)
- COMMERCIAL RIGHTS: **INFERRED** MIT (commercial OK). (EVIDENCE: INFERRED)
- QUALITY: De-facto web 3D standard. (INFERRED)
- CAPABILITIES: WebGL/WebGPU 3D scenes, loaders, postprocessing. (INFERRED)
- BUSINESSFORGE RELEVANCE: **HIGH** — base for any 3D web experience. (EVIDENCE: INFERRED)
- COST TIER: free
- EVIDENCE LEVEL: INFERRED (license)

---

## PROVIDER: React Three Fiber — https://docs.pmnd.rs/react-three-fiber
- CATEGORY: web-lib (3D, React)
- API/SDK: N/A (React renderer for three.js).
- PRICING / FREE TIER: **FREE, open-source (MIT).** Install: `npm i three @react-three/fiber`. (EVIDENCE: OBSERVED install; license INFERRED MIT)
- COMMERCIAL RIGHTS: **INFERRED** MIT. (EVIDENCE: INFERRED)
- QUALITY: Declarative, production 3D in React. (INFERRED)
- CAPABILITIES: React components for three.js, interactivity, ecosystem (@react-three/drei). (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — if BusinessForge is React-based, this is the 3D layer. (EVIDENCE: INFERRED)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED (usage) + INFERRED (license)

---

## PROVIDER: OGL — https://github.com/oframe/ogl
- CATEGORY: web-lib (3D, minimal)
- API/SDK: N/A (client JS library).
- PRICING / FREE TIER: **FREE** — *"Unlicense. This is free and unencumbered software released into the public domain."* (EVIDENCE: OBSERVED — Unlicense)
- COMMERCIAL RIGHTS: **OBSERVED** — public domain (Unlicense), free for any use incl. commercial. (EVIDENCE: OBSERVED)
- QUALITY: Minimal, fast WebGL. (INFERRED)
- CAPABILITIES: Minimal WebGL library, shaders, examples. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **MEDIUM** — lightweight alternative to three.js for simple effects. (EVIDENCE: OBSERVED)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: WebGPU — https://developer.chrome.com/docs/web-platform/webgpu  · https://caniuse.com/webgpu
- CATEGORY: web-lib (browser graphics standard)
- API/SDK: N/A (native browser API; Three.js/R3F can target it).
- PRICING / FREE TIER: **FREE** — browser standard, no cost. (EVIDENCE: OBSERVED)
- COMMERCIAL RIGHTS: **OBSERVED** — open web standard, free to use. (EVIDENCE: OBSERVED)
- STATUS (key): **OBSERVED — Global usage 85.56%** (Can I Use). Chrome ✅ 113+, Edge ✅ 113+, Safari 18+ supported, Firefox rolling out (partial/flag). Meant to supersede WebGL. (EVIDENCE: OBSERVED caniuse)
- QUALITY: Hardware-accelerated compute + rendering. (INFERRED)
- CAPABILITIES: GPU compute/render in browser; enables heavier 3D/ML in-page. (EVIDENCE: OBSERVED)
- BUSINESSFORGE RELEVANCE: **HIGH** — target WebGPU where supported (with WebGL fallback) for premium 3D; ~85% coverage now. (EVIDENCE: OBSERVED)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED

---

## PROVIDER: Locomotive Scroll — https://github.com/locomotivemtl/locomotive-scroll
- CATEGORY: web-lib (smooth scroll) — **DEPRECATED / UNMAINTAINED**
- API/SDK: N/A (client JS library).
- PRICING / FREE TIER: **FREE** — MIT licensed (GitHub shows MIT). (EVIDENCE: OBSERVED MIT)
- COMMERCIAL RIGHTS: **OBSERVED** MIT (commercial OK). (EVIDENCE: OBSERVED)
- ⚠️ **STATUS — DO NOT USE.** Locomotive Scroll is **deprecated/unmaintained** (no active development; known issues with modern scroll/accessibility). (EVIDENCE: INFERRED from project status; MIT repo still public)
- QUALITY: Was good; now superseded. (INFERRED)
- CAPABILITIES: Smooth scroll, parallax, horizontal scroll (legacy). (INFERRED)
- BUSINESSFORGE RELEVANCE: **LOW / AVOID** — **RECOMMEND LENIS INSTEAD** (actively maintained, free, MIT, better perf + a11y). (EVIDENCE: INFERRED + OBSERVED Lenis as替代)
- COST TIER: free
- EVIDENCE LEVEL: OBSERVED (MIT) + INFERRED (deprecation)

---

## Cross-cutting notes for BusinessForge
1. **Programmatic backends (API-native, commercial-safe)** — highest priority for automation:
   - Video: Runway, Kling, Luma, Pika, Veo (Vertex), Higgsfield (API+MCP+CLI).
   - Image: OpenAI Images, Imagen (Vertex), FLUX/BFL (API or self-host), Stable Diffusion (self-host).
   - Voice/Music: ElevenLabs (+Music), Mubert (API).
   - 3D: Tripo, Meshy, Luma Genie, Rodin.
2. **Manual / no-API (use as agency steps, not pipeline):** Midjourney, Suno, Udio, Sora (limited API).
3. **Free libs to build the premium site itself:** GSAP (free), Lenis (free, use INSTEAD of Locomotive), Motion (MIT), Three.js/R3F/OGL (MIT/Unlicense), WebGPU (free, 85.5% support), Rive (free runtime), Lottie (free player).
4. **Higgsfield cap.* decision:** expose `cap.video_generation`, `cap.product_video_generation`, `cap.image_to_video` (all yes) — it is the strongest programmatic fit for directed product/commercial video and uniquely offers REST + MCP + CLI.
5. **Pricing honesty:** All dollar figures above marked OBSERVED were present in fetched official HTML/JSON. Higgsfield exact price, Rodin price, Mubert exact price, Udio price, Sora/OpenAI per-image API price, and Theatre.js/Lottie/Three.js/R3F licenses were NOT verifiable from the fetched pages and are marked INFERRED/UNKNOWN rather than invented.

*End of matrix.*
