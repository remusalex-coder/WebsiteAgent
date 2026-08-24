# 06 — VIDEO & IMAGE AI (deep dive)

> Verified from official pricing/docs 2026-08-19. V=VERIFIED, I=INFERRED, U=UNKNOWN.

## A. IMAGE GENERATION

### Models & pricing (VERIFIED)
| Model | Vendor | Price | Evidence |
|-------|--------|-------|----------|
| flux-1.1-pro | Replicate | $0.04 / image | replicate.com/pricing |
| flux-dev | Replicate | $0.025 / image | replicate.com/pricing |
| flux-schnell | Replicate | $0.003 / image (1k images) | replicate.com/pricing |
| Ideogram v3 | Replicate/API | $0.09 quality; API $0.03–0.09 | replicate + search |
| Recraft v3/v4 | Recraft API | credit-based; free NON-commercial | recraft.ai/pricing |
| Flux Kontext Pro | fal.ai | $0.04 / 1MP | fal.ai/pricing |
| Nanobanana | fal.ai | $0.0398 / 1MP | fal.ai/pricing |
| Seedream V4 | fal.ai | $0.03 / 1MP | fal.ai/pricing |
| Higgsfield image | Higgsfield | credit plan | docs.higgsfield.ai |
| Adobe Firefly | Adobe | U price; brand-safe | U price |

### Capabilities needed (task list)
- text-to-image ✅ all above
- image-to-image / editing: FLUX Kontext, Recraft, Higgsfield, Firefly
- inpainting/outpainting: FLUX/SD (local), Recraft, Firefly
- background removal: fal `pdfix`/rembg, local rembg (OSS)
- vector generation: Recraft (vector native), local SVG
- product photography: FLUX/Recraft + local SD controlnet
- editorial/food/fashion/auto/arch: prompt craft + reference; client photos best
- icons/diagrams/infographics: procedural SVG > AI (control)
- campaign imagery: Recraft/Firefly brand-safe

### Local option (FREE + owns output)
Local FLUX/SD via ComfyUI/Automatic1111. Zero per-call. Quality = model-dependent.
Best for €0 commercial path IF base model licence permits commercial use (check
FLUX [non-commercial on some], SD1.5/SDXL generally permissive, Pony/SDXL derivatives
vary). Automate via CLI/API. Fallback for every cloud image provider.

## B. VIDEO GENERATION

### Higgsfield (PRIORITY — VERIFIED)
- One async API for **image, video, audio, 3D** (docs.higgsfield.ai).
- SDKs: Python + TypeScript. Auth: API key (HF_API_KEY_ID:HF_API_KEY_SECRET).
- Lifecycle: POST → request_id + status_url + cancel_url → poll or webhook.
- Output retained ≥7 days; download to own storage.
- Homepage advertises **MCP & CLI** ("Turn Claude into a creative engine"),
  **Seedance 2.5 in 1080p**, Marketing Studio (1500+ presets), Cinema Studio 4.0.
- Pricing tiers (from search snippets, I): Starter ~$15 (~200 cr), Plus ~$39/annual
  (~1,000 cr), Ultra ~$99/annual (~3,000 cr); free ~10 cr/day. Credit-per-gen varies by
  model (not published prominently — I).
- Controls: camera/director controls advertised (Cinema Studio). Image-to-video present.

### Runway (VERIFIED runwayml.com/pricing)
- Free: 125 one-time credits. Standard $12/mo (625 cr = ~52s Gen-4.5 / 78 images),
  Pro $28/mo (2,250 cr), Max $76/mo (9,500 cr). **No watermarks on paid.** Models: Gen-4.5,
  Nano Banana Pro, Aleph, Veo 3.1, Kling 3.0, Seedance 2.5. API + SDK.

### fal.ai video (VERIFIED fal.ai/pricing)
- Wan 2.5: $0.05/s (~20s/$1). Kling 2.5 Turbo Pro: $0.07/s (~14s/$1).
- Veo 3: $0.40/s (~3s/$1). Ovi: $0.20/5 videos. Normalised to ~5s@720p.
- GPU fleet H100 $1.89/hr. Per-model API, async queue.

### Other (U price unless noted)
- Google Veo 3: top realism via Vertex AI. Price U. API via GCP.
- OpenAI Sora: API exists. Price U.
- Kling, Luma, Pika, Hailuo, Vidu, PixVerse: various; fal/Runway expose several.
- Luma: site is JS-heavy, pricing not statically fetchable (U).

### Capabilities mapping
- text-to-video: all. image-to-video: Higgsfield, Runway, fal(Kling/Wan), Luma.
- product video: Higgsfield I2V, Runway, fal. camera movement: Higgsfield director,
  Runway. video extension: Runway, Higgsfield. upscaling: Runway 4K, Topaz.
  frame interpolation: local FFmpeg minterpolate (FREE).

## C. FALLBACK CHAIN (image)
local SD → fal FLUX → Replicate FLUX → Recraft(paid) → Higgsfield → Firefly.

## D. FALLBACK CHAIN (video)
procedural CSS/Canvas → local I2V → fal Wan/Kling → Runway → Higgsfield → Veo3/Sora.
