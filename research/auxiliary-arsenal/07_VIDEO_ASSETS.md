# 07 — VIDEO ASSETS

> Priority: Higgsfield. VERIFIED facts from `bf_research/05_video_*` + this pass.

## A. Higgsfield (PRIMARY — VERIFIED)
- **One API** for image+video+audio+3D (docs.higgsfield.ai). **MCP server + CLI**
  (`@higgsfield/cli`, `npx skills add higgsfield-ai/skills`). Agent list includes Hermes
  Agent. MCP needs NO API key (auth via account). OBSERVED.
- **Pricing (VERIFIED from bf_research live curl):** Free / **Starter $19/mo / Plus $47/mo
  (1,200 credits) / Ultra $99/mo (~9,000 credits)**, annual billing. (Note: my earlier
  asset-stack session saw $15/$39 search-snippets — PRESERVE bf_research VERIFIED $19/$47
  as authoritative; treat $15/$39 as INFERRED/older.)
- **Capabilities:** text→video, **image→video** (core camera-control value), audio+video
  same pass, 30+ models (Seedance 2.5 1080p/30s, Kling 3.0, Veo 3.1, Sora 2, Wan 2.6…).
  Per-model credit costs published (e.g. Seedance 2.0 1080p=45 cr/5s; Kling 3.0 1080p=8
  cr/5s; Veo 3.1 1080p=29 cr/4s). OBSERVED.
- **Commercial (VERIFIED ToS §4.4):** "Company does not claim ownership of Inputs/Outputs,
  nor restricts commercial use; rights survive cancellation, sublicensable to clients."
- **Watermark:** visibility on exported files UNKNOWN (§6.4 permits but doesn't warrant
  persistent watermark). Flag at QA.
- **Caveat (carried from research):** US company proxying Chinese-model backends for some
  presets — check per-preset data-residency/ToS. Not bound, not credentialed.

## B. Runway (VERIFIED)
- Free $0/125 cr; **Standard $12/mo; Pro $28/mo; Unlimited $76/mo**; commercial + **no
  watermark on paid**. Gen-4.5, Nano Banana Pro, Veo 3.1, Kling 3.0. API+SDK.

## C. Google Veo (VERIFIED)
- **Veo 3.1: $0.40/clip @720-1080p, $0.60 @4K, Fast $0.10-0.12, Lite $0.05-0.08**; first
  5,000 units free via Vertex trial; commercial via Google ToS. API via Vertex.

## D. Others (VERIFIED exist)
- **Kling** (API, commercial), **Luma Dream Machine** (API, commercial), **Pika** (API),
  **fal.ai** (Wan 2.5 $0.05/s, Kling 2.5 Turbo $0.07/s, Veo3 $0.40/s — VERIFIED fal.ai),
  **OpenAI Sora** (limited API, INFERRED commercial).

## E. When to use generated video (BUSINESS-EVIDENCE GATED)
- ✅ Hero with measurable conversion lift (restaurant/fashion/automotive/hotel).
- ✅ Product video / lookbook / walkthrough that specifically benefits from motion.
- ✅ Client has no usable footage AND brand tier justifies.
- ❌ Decorative video everywhere → REJECT (motion_media gate = human; frozen F-18 style).
- Fallback chain: procedural CSS/Canvas still-motion → local I2V → fal Wan/Kling →
  Runway → Higgsfield → Veo 3.1/Sora.

## F. FREE video
- Procedural CSS/Canvas/Ken-Burns (€0, premium feel). Client footage. Local I2V (heavy GPU,
  quality UNKNOWN). No autonomous free *cloud* video tier worth relying on.
