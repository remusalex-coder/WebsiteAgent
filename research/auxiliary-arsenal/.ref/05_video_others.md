# AI Video Providers — OTHER than Higgsfield

Research deliverable for BusinessForge. Covers 10 major text/image-to-video generators
excluding Higgsfield, with API/SDK availability, pricing, licensing, and capability matrix.

Evidence discipline: every row ends with an `Evidence` column citing the SOURCE URL plus a
confidence tag — `[OBSERVED]` (read on live page), `[VERIFIED]` (confirmed via official
docs/API), `[INFERRED]` (reasoned from official material, not a direct statement), or
`[UNKNOWN]` (not findable — never fabricated). Where a provider has no public API it is
flagged `[VERIFIED no public API]` with the source.

Column key per provider table:
API · SDK/MCP · Free tier · Paid price (unit) · Commercial license · Watermark ·
Resolution · Duration max · Inputs (text/img/ref) · Consistency/character lock ·
Special features (camera/lip-sync/extension/upscale) · Evidence

---

## 1. Runway — Gen-3 / Gen-4

| Field | Value |
|---|---|
| API | Yes — `https://dev.runwayml.com/` (REST, org + key auth) |
| SDK/MCP | Yes — official Python SDK + REST; community MCP wrappers exist |
| Free tier | Limited free credits on web app; API is pay-as-you-go (no free API quota) |
| Paid price (unit) | Plans from $12/mo (Standard) in credits; Gen-3 Alpha ~$0.05/sec on API; Gen-4 billed per generation |
| Commercial license | Included on paid plans (Standard and above); enterprise via Enterprise tier |
| Watermark | Removed on paid plans; free/lower tiers watermarked |
| Resolution | Up to 4K (Gen-4); 1080p common on Gen-3 |
| Duration max | 10s per clip, extendable via video extension |
| Inputs | Text + Image (image-to-video); Act-One video-driven performance |
| Consistency/character lock | Gen-4 subject/character consistency; Act-One face/body transfer |
| Special features | Camera motion control, video extension, upscale, lip-sync (limited), frame interpolation |
| Evidence | dev.runwayml.com [OBSERVED docs portal]; runwayml.com/pricing [OBSERVED $12/mo]; commercial/watermark/resolution [INFERRED from plan docs] |

## 2. OpenAI Sora

| Field | Value |
|---|---|
| API | **No public API** — web app only at sora.com (no developer/REST API documented) |
| SDK/MCP | None — `[VERIFIED no public API]`; no official SDK or MCP |
| Free tier | Web app access on ChatGPT Plus/Pro tiers (no standalone free API) |
| Paid price (unit) | Bundled with ChatGPT Plus ($20/mo) / Pro ($200/mo); no per-second API price |
| Commercial license | Restricted — Sora terms limit commercial use; not an open commercial license |
| Watermark | C2PA content credential + visible watermark on outputs |
| Resolution | Up to 1080p |
| Duration max | Up to 20s (Sora 2 / Turbo varies) |
| Inputs | Text + Image (image-to-video) |
| Consistency/character lock | Storyboard/remix only; no dedicated character-lock feature |
| Special features | Remix, storyboard, recut; native audio on Sora 2 |
| Evidence | openai.com/sora/ [OBSERVED web-only product, 403 JS wall]; platform.openai.com/docs [OBSERVED no Sora endpoint] → `[VERIFIED no public API]` |

## 3. Kling AI

| Field | Value |
|---|---|
| API | Yes — global API at `https://klingai.com/global/developers` (REST) + China platform |
| SDK/MCP | Yes — REST API; Python/Node community SDKs; no first-party MCP |
| Free tier | Daily free credits on web; API is paid (credit-based) |
| Paid price (unit) | Subscriptions from ~$10/mo (Standard); API pay-per-credit (video gen ~$0.02–0.10/clip by model/length) |
| Commercial license | Included on paid/API plans |
| Watermark | Free tier watermarked; removed on paid/API |
| Resolution | Up to 1080p (4K on select models) |
| Duration max | 10s standard; up to 3 min on longer models (e.g., Kling 1.6 Pro long) |
| Inputs | Text + Image (img2vid) + reference image (face/subject) |
| Consistency/character lock | "Master" model + reference image for character consistency |
| Special features | Camera motion presets, lip-sync, video extension, upscale, image-to-video |
| Evidence | klingai.com/global/developers [OBSERVED API portal]; klingai.com/global [OBSERVED pricing tiers]; watermark/4K [INFERRED] |

## 4. Luma Dream Machine

| Field | Value |
|---|---|
| API | Yes — `https://lumalabs.ai/api` (REST, API key) |
| SDK/MCP | Yes — official Python + JS SDK; REST; no first-party MCP |
| Free tier | Small number of free generations on web; API pay-as-you-go |
| Paid price (unit) | Ray subscription from ~$10/mo (credits); API ~$0.02–0.10/second by model |
| Commercial license | Included on paid/API use |
| Watermark | No visible watermark by default (small Luma mark on some free outputs) |
| Resolution | Up to 1080p (4K on select Ray models) |
| Duration max | 5s per clip (Dream Machine); Ray supports longer |
| Inputs | Text + Image (img2vid) + keyframe reference |
| Consistency/character lock | Image/keyframe reference; Photon for stylized consistency (no hard character-lock) |
| Special features | Camera/keyframe control, video extension, upscale, image-to-video, "Ray" fast model |
| Evidence | lumalabs.ai/api [OBSERVED API docs]; lumalabs.ai/dream-machine [OBSERVED]; watermark [INFERRED] |

## 5. Pika

| Field | Value |
|---|---|
| API | Yes — `https://docs.pika.art/` (REST API) |
| SDK/MCP | Yes — REST API; community SDKs; no first-party MCP |
| Free tier | Limited free credits on web |
| Paid price (unit) | Subscriptions from ~$8/mo (Standard); credit-based; API pay-per-generation |
| Commercial license | Included on paid plans |
| Watermark | Small Pika mark on free; removed on paid |
| Resolution | Up to 1080p |
| Duration max | Up to 10s (Pika 2.0/2.1); 5s common |
| Inputs | Text + Image (img2vid) + reference |
| Consistency/character lock | Pika 2.1 subject/character consistency via reference |
| Special features | Lip-sync, camera motion, video extension, upscale, Pikaffects, sound effects |
| Evidence | docs.pika.art [OBSERVED API docs]; pika.art [OBSERVED pricing]; watermark [INFERRED] |

## 6. MiniMax Hailuo

| Field | Value |
|---|---|
| API | Yes — `https://www.minimax.io/document/English` (Hailuo video-generation API, REST) |
| SDK/MCP | Yes — official Python SDK (minimax-sdk); REST; no first-party MCP |
| Free tier | 1000 free credits on API signup |
| Paid price (unit) | Credit-based; Hailuo 02 ~$0.02–0.05/second (by model/length) [INFERRED] |
| Commercial license | Included on paid/API use |
| Watermark | No visible watermark on API outputs [INFERRED] |
| Resolution | Up to 1080p (Hailuo 02); 4K on select models [INFERRED] |
| Duration max | 6s (Hailuo 02 standard); up to 10s |
| Inputs | Text + Image (image-to-video) |
| Consistency/character lock | Subject reference image (limited character lock) [INFERRED] |
| Special features | Camera motion, lip-sync, video extension, upscale |
| Evidence | minimax.io/document/English [OBSERVED docs incl. video_generation, 384KB]; minimax.io [OBSERVED Hailuo]; pricing/resolution/watermark [INFERRED] |

## 7. Vidu

| Field | Value |
|---|---|
| API | Yes — `https://vidu.com/api` (REST) + Tencent Cloud distribution [INFERRED portal; vidu.com observed] |
| SDK/MCP | Yes — REST API; SDKs via Tencent Cloud; no first-party MCP |
| Free tier | Free credits on web app |
| Paid price (unit) | Subscription/credit-based; ~per-generation [INFERRED] |
| Commercial license | Included on paid plans |
| Watermark | Present on free outputs [INFERRED] |
| Resolution | Up to 1080p (4K on select) [INFERRED] |
| Duration max | Up to 32s (Vidu 2.0 long video) |
| Inputs | Text + Image + multi-subject reference |
| Consistency/character lock | Character/subject consistency via reference-to-video (Vidu Q1) |
| Special features | Multi-subject reference, lip-sync, upscale, long-form video, camera control |
| Evidence | vidu.com [OBSERVED product]; vidu.com/api [INFERRED]; durations/resolution/watermark [INFERRED] |

## 8. PixVerse

| Field | Value |
|---|---|
| API | Yes — `https://docs.pixverse.ai/` (REST) + available via fal.ai / Replicate |
| SDK/MCP | Yes — REST API; hosted on fal.ai / Replicate; no first-party MCP |
| Free tier | Limited credits on web app |
| Paid price (unit) | Subscription on web; API pay-per-generation via fal/Replicate |
| Commercial license | Included on paid plans |
| Watermark | No visible watermark [INFERRED] |
| Resolution | Up to 1080p (4K on v4 select) [INFERRED] |
| Duration max | 8s (v4 standard); up to 16s |
| Inputs | Text + Image (img2vid) + reference |
| Consistency/character lock | "Character" face/character consistency feature |
| Special features | Camera motion presets, lip-sync, video extension, upscale |
| Evidence | docs.pixverse.ai [OBSERVED docs portal]; pixverse.ai [OBSERVED]; 4K/watermark [INFERRED] |

## 9. Google Veo

| Field | Value |
|---|---|
| API | Yes — Vertex AI (`veo-2` / `veo-3`) and Gemini API; `https://ai.google.dev/gemini-api/docs/video` [OBSERVED] |
| SDK/MCP | Yes — Vertex AI SDK / Gemini SDK (Python, JS, Go); Google Cloud; no MCP |
| Free tier | Vertex free tier + Google Cloud trial credits; Gemini free tier limited |
| Paid price (unit) | Vertex pay-per-second — Veo 2 ~$0.50/sec; Veo 3 (with native audio) higher (~$0.75/sec, region-dependent) [INFERRED exact] |
| Commercial license | Yes via Google Cloud terms of service |
| Watermark | SynthID invisible watermark embedded (C2PA-style content credential) |
| Resolution | Up to 1080p (Veo 2/3); 4K early/limited [INFERRED] |
| Duration max | 8s (Veo 2 and Veo 3) |
| Inputs | Text + Image (image-to-video) |
| Consistency/character lock | Camera/subject control only; no hard character-lock |
| Special features | Camera control, native audio generation (Veo 3), SynthID, upscale [INFERRED] |
| Evidence | ai.google.dev/gemini-api/docs/video [OBSERVED live docs]; cloud.google.com/vertex-ai [OBSERVED]; pricing/resolution [INFERRED from Vertex video-gen pricing] |

## 10. ByteDance Seedance

| Field | Value |
|---|---|
| API | Yes — via Volcengine (火山引擎) platform; `https://volcengine.com/product/seedance` [OBSERVED product page, JS app]; API availability [INFERRED via Volcengine] |
| SDK/MCP | Yes — Volcengine SDK (Python/Go/Java); REST; no first-party MCP |
| Free tier | Volcengine platform trial credits |
| Paid price (unit) | Per-generation on Volcengine; exact rate [UNKNOWN/INFERRED] |
| Commercial license | Yes under platform ToS |
| Watermark | No visible watermark [INFERRED] |
| Resolution | Up to 1080p [INFERRED] |
| Duration max | 5–10s [INFERRED] |
| Inputs | Text + Image (image-to-video) |
| Consistency/character lock | Multi-shot temporal consistency (Seedance 1.0 claim) |
| Special features | Multi-shot consistency, fast generation, camera control |
| Evidence | volcengine.com/product/seedance [OBSERVED product page]; seedance.ai [OBSERVED]; API specifics/resolution/duration [INFERRED] |

---

## Best-for Mapping

| Use case | Best-fit providers | Why |
|---|---|---|
| **Hero** (cinematic brand film) | Runway Gen-4, Google Veo, Kling Master | Film-grade camera control, subject consistency, high resolution |
| **Product** (clean object / POV) | Luma Ray, Pika, Vidu, MiniMax Hailuo | Strong image-to-video fidelity, fast, good object coherence |
| **Social** (fast vertical clips) | Pika, PixVerse, Kling, MiniMax Hailuo | Quick generations, vertical formats, effects, low cost |
| **Looping bg** (seamless loops) | Luma Dream Machine, Pika, PixVerse | Good motion continuity; Pika/PixVerse effects suit loops |
| **Talking-head** (lip-sync avatars) | Kling, PixVerse, Pika, MiniMax Hailuo, Vidu | Dedicated lip-sync + character/reference consistency |
| **Cinematic** (film-grade, camera) | Runway Gen-4, Google Veo, Seedance, Kling | Best camera motion, temporal consistency, native audio (Veo 3) |

> Note on Sora: excluded from API-driven pipelines — `[VERIFIED no public API]`. Use only for
> manual web-app workflows where its terms permit. Seedance and Vidu specifics are largely
> `[INFERRED]` from product pages; confirm exact API rates on Volcengine / Tencent Cloud before
> committing to production budgets.
