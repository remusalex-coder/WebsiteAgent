# OBSERVED Technical Evidence (curl-fetched, 2026-08-19)

All facts below were fetched live via curl (browser_exec broken in env). Marked OBSERVED where the signal appeared in returned source; UNKNOWN where a public page did not publish it.

## 1. Real-site technology signatures (OBSERVED in fetched HTML/JS)

| Site | URL | OBSERVED signals | Interpretation |
|---|---|---|---|
| CRAV (burgers) | cravburgers.shop | cursor(30), preload(22); earlier full-bundle grep: Lenis + GSAP/ScrollTrigger + Framer Motion + lerp cursor; NO three/WebGL | DOM-transform premium, no WebGL |
| Active Theory | activetheory.net | ogl(3), preload(1) | **OBSERVED: lightweight WebGL via OGL** |
| Dogstudio | dogstudio.co | ogl(11) | **OBSERVED: OGL WebGL** |
| 14islands | 14islands.com | three(5), ogl(10), canvas(3), preload(3) | **OBSERVED: Three.js + OGL + Canvas hybrid** |
| Cuberto | cuberto.com | gsap(2), webgl(1), ogl(3), cursor(84), preload(12) | GSAP + WebGL + heavy custom cursor |
| Monogrid | monogrid.com | ogl(8), preload(1) | OGL WebGL |
| Resn / Immersive Garden / Locomotive | — | fetch blocked (DNS/403) | UNKNOWN from live probe; reputation = WebGL/scroll studios (INFERRED) |

**Correction to earlier v1 assumption:** v1 implied premium == DOM transforms only. OBSERVED reality: top studios (Active Theory, Dogstudio, 14islands, Cuberto, Monogrid) DO use WebGL, but mostly **OGL** (a tiny ~10KB WebGL lib) or **Three.js**, NOT bespoke heavy shaders by default. BusinessForge should treat OGL (not Three.js) as the lightweight WebGL entry point and reserve Three.js/WebGPU for genuine 3D needs.

## 2. Provider / library facts (OBSERVED on official pages)

| Provider | Category | API/SDK | Free tier | Commercial rights | Cost signal | Notes |
|---|---|---|---|---|---|---|
| **Higgsfield** | AI video+image+audio | **YES — API documented** (docs.higgsfield.ai, /docs/llms.txt, 137 'api' hits) | UNKNOWN (not on public pricing page) | UNKNOWN (public ToS not fetched) | pricing page exists, exact $ not published | Image/Video/Audio gen; director/camera control terms present. **Named-critical: confirm via docs.** |
| Runway | AI video | site fetched, API page not probed | free(6 hits) | UNKNOWN | pricing page present | Established; not OBSERVED-API here |
| OpenAI Sora | AI video | 403 blocked | — | — | — | UNKNOWN from live probe |
| Google Veo | AI video | **api(89) + camera(10)** OBSERVED on DeepMind page | UNKNOWN | UNKNOWN | — | Strong programmatic + camera control signal |
| ElevenLabs | Voice/Music | api(35) | **$0 free**; Starter **$6/mo has Commercial License** | **Commercial on $6+** (OBSERVED) | $0/$6/$11/$22/$99/$299/$990 | Audio + Music + Agents |
| FLUX (Black Forest) | AI image | **API + open weights** | API $300 tier signal | License terms present (non-commercial open-weights) | $300 | Self-host possible |
| Tripo | 3D | **API**; free 200 credits | **$0 / 200 credits**; $19/$54/$89/$1078 | "Non-Commercial" on free; paid commercial implied | $0/$19/$54/$89/$1000 | 3D from image/text |
| Meshy | 3D | **API + MCP** | $0/$10/$20/$40/$70/$100/$240 | "you own assets; commercial OK on paid" (OBSERVED) | $0/$10/$20/$40/$70/$100/$240 | Has Unity/plugin + MCP |
| GSAP | Motion lib | free | **Free** (most features; 'no charge' club) | MIT-ish/own license | free | ScrollTrigger free |
| Lenis | Smooth scroll | free, npm | **Free, MIT** | — | free | **CONFIRMED maintained lightweight lib — standard** |
| Locomotive Scroll | Smooth scroll | — | — | — | — | **DEPRECATED/unmaintained — do NOT adopt; use Lenis** |
| Rive | Interactive runtime | runtime (webgl/canvas) | free tier exists | — | — | Interactive vector anim engine |

## 3. Higgsfield — named-critical assessment (OBSERVED + inferred)

OBSERVED:
- Public product: "Higgsfield AI Video & Image Generator" with Explore / Image / Video / Audio / Edit surfaces.
- Dedicated docs site docs.higgsfield.ai with an "API Docs" index and `/docs/llms.txt` (LLM-friendly full doc dump) — strong signal of a real, documented API.
- Director/camera-control terminology present on pricing/docs (camera hits).
UNKNOWN (not on public pages):
- Exact price, free-tier allowance, commercial license terms, watermark policy, latency, consistency metrics.
INFERRED (from category):
- Text-to-video + image-to-video with cinematic camera direction; this is the differentiator vs Runway/Pika.

**BusinessForge recommendation (do NOT blind-decide — gate on verification):**
- Expose `cap.video_generation` and `cap.image_to_video` as CONDITIONAL/ADVANCED capabilities, provider-backed by Higgsfield (and Runway/Veo as alternates).
- Activate ONLY when: (a) business evidence shows a product/brand that benefits from motion assets (restaurant hero, fashion lookbook, real-estate walkthrough), AND (b) budget tier allows per-generation cost, AND (c) a human/automated review confirms commercial license + no watermark.
- Do NOT auto-apply to every site (reject-list: decorative AI media by default).
- Before enabling, verify the three UNKNOWN items via docs.higgsfield.ai + ToS.

## 4. WebGPU status (INFERRED from MDN presence)

MDN documents WebGPU API → it exists and ships in Chromium-based + recent Safari/Firefox. Still NOT universally baseline; use as progressive enhancement behind capability detection. OBSERVED: MDN pages exist.

## 5. View Transitions API (INFERRED from MDN presence)

MDN documents View Transitions API → available in Chromium, expanding. Use for route/page transitions as progressive enhancement with a JS fallback (e.g., GSAP/Barba) for unsupported browsers.
