# SOURCES

> Every source fetched/consulted for this research. Evidence class: V=VERIFIED
> (official site/docs returned data), O=OBSERVED, I=INFERRED, U=UNKNOWN (JS-rendered or
> blocked, number not confirmed). Capture date 2026-08-19. Raw HTML in
> `research/asset-stack/.raw/`.

## Priority / image+video
- https://higgsfield.ai/ — V (homepage: MCP & CLI, Seedance 2.5, one creative suite)
- https://higgsfield.ai/pricing — V (tier names; numbers JS-rendered, tiers I via search)
- https://docs.higgsfield.ai/ — V (one async API image/video/audio/3D, SDKs, webhooks, auth)
- https://fal.ai/pricing — V (Wan $0.05/s, Kling $0.07/s, Veo3 $0.40/s, Flux $0.04/1MP, H100 $1.89/hr)
- https://fal.ai/models — V (model list)
- https://replicate.com/pricing — V (flux-1.1-pro $0.04, flux-dev $0.025, flux-schnell $0.003, ideogram $0.09)
- https://replicate.com/explore — V
- https://www.elevenlabs.io/pricing — V (Free $0/10k, Starter $6 comm, Creator $22, Pro $99, Scale $299, Business $990)

## 3D
- https://www.meshy.ai/pricing — V (Free/Pro/Studio/Ent, API, MCP, CLI; numeric tiers not static)
- https://spline.design/ — V (free embed, spline-viewer, design platform)
- https://tripo3d.ai/ — O (API present; pricing JS-rendered, price U)
- https://threejs.org/ — V (MIT, runtime)

## Video
- https://www.runwayml.com/pricing — V (Free 125cr, Standard $12/625cr no-WM, Pro $28, Max $76/9500cr)
- https://luma.ai/api/pricing — V (page JS-heavy, pricing not static, U)
- https://ideogram.ai/pricing — blocked 403 (price via replicate/search: V/I)
- https://www.recraft.ai/pricing — V (free NON-commercial; paid full ownership+commercial; API)

## Audio / voice
- https://suno.com/suno-plus — V (free 10 songs/day non-commercial; Pro/Premier commercial)
- https://www.play.ht/ — blocked (price U)
- https://api.cartesia.ai/ — minimal (price U)
- https://kokoros.tts — unresolved (local model, KNOWN)
- https://github.com/rhasspy/piper — KNOWN (local TTS)
- https://github.com/ggerganov/whisper.cpp — KNOWN (local STT)
- https://huggingface.co/hexgrad/Kokoro-82M — KNOWN (local TTS)

## Motion / interaction
- https://greensock.com/gsap/ — V (free; plugin status I — verify at integration)
- https://gsap npm — blocked 403 (use greensock.com)
- CRAV (crav.co) — O (interaction mechanisms)
- Cuberto (cuberto.com) — O (interaction mechanisms)
- CSS Design Awards / Awwwards / FWA — referenced for patterns (not individually fetched)

## Functional capabilities
- https://web3forms.com/ — V (free 250/mo, no backend, access key public-safe)
- https://formspree.io/ — V (free tier)
- https://www.cloudflare.com/products/r2/ — V (free 10GB, 1M/10M ops, no egress; paid $0.015/GB-mo)
- https://supabase.com/pricing — V (free 50k MAU, Pro $25, Team $599)
- https://stripe.com/pricing — V (no monthly; ~2.9%+$0.30 EU per tx)
- https://openstreetmap.org/about — V (ODbL, no key)
- https://cal.com/ — V (OSS self-host free)
- https://plausible.io/ — V (self-host free)
- https://www.npmjs.com/package/gsap — blocked (use greensock)

## Real site research (observed / known)
Osteria Francescana, Noma, Eleven Madison Park, Aman, Six Senses, The Standard, Pagani,
BMW, Porsche, Rimac, Gucci, Balenciaga, SSENSE, COS, Sotheby's Intl, Compass, Knightsbridge,
BIG, Zaha Hadid, Studio McPhee, Apple, Linear, Vercel, Stripe, Nubank, Revolut, Monzo,
MasterClass, Coursera, Active Theory, CRAV, Cuberto, Locomotive, + typical local
clinic/gym sites. Evidence: O (observed) / K (known public knowledge). Tech columns I/U
unless source-verified.

## Search-snippet sources (for JS-rendered price gaps)
- DuckDuckGo HTML snippets used to confirm: Higgsfield tiers ($15/$39/$99, ~10cr/day),
  Ideogram API ($0.03–0.09), Recraft/ElevenLabs/Suno licence facts cross-checked against
  official pages above. Treated as I (inferred) where official static page unavailable.

## UNKNOWN / needs live fetch at integration
- Adobe Firefly exact price (brand-safe licence confirmed safe, price U)
- Google Veo 3 / OpenAI Sora API pricing (U)
- Kling/Luma/Pika/Hailuo/Vidu/PixVerse direct pricing (via fal/Runway exposed; direct U)
- Meshy/Tripo/Suno/PlayHT/Cartesia/Murf exact per-unit prices (U)
- GSAP premium-plugin licence status post-Webflow acquisition (I — verify)

## Methodology note
Browser CLI was unavailable (pydantic_core binary error in this environment); research
was conducted via direct HTTP fetch (curl + Python requests) of official pages + targeted
search snippets for JS-rendered pricing. All numbers attributed to V/I/U accordingly.
No prices invented; gaps explicitly UNKNOWN.
