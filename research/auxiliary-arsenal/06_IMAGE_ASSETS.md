# 06 — IMAGE ASSETS (free + generation)

> FREE commercial-use libraries + generation providers. Generation VERIFIED facts from
> `bf_research/01_image.md` + this pass; reused verbatim.

## A. FREE commercial-use image libraries (always prefer over AI when fit)
| Lib | Licence | API | Hotlink | Attribution | Evidence |
|---|---|---|---|---|---|
| **Unsplash** | Unsplash licence (free, commercial) | ✅ API | ✅ | requested not required | KNOWN |
| **Pexels** | Pexels licence (free, commercial) | ✅ API | ✅ | not required | KNOWN |
| **Pixabay** | Pixabay licence (free, commercial) | ✅ API | ✅ | not required | KNOWN |
| **Openverse** (WP) | aggregates CC0/CC-BY | ✅ API | ✅ | per-source (CC-BY needs attr) | KNOWN |
| **Wikimedia Commons** | CC/PD mix — CHECK per file | ✅ API | ✅ | per-licence | KNOWN |
| **Poly Haven** | CC0 | ✅ | ✅ | no | KNOWN (also 3D/HDR) |

**Rule:** client photos > free library > generated. Never hotlink against ToS; download +
optimise via Sharp at build. Attribution only where licence demands (CC-BY/ODbL).

## B. Image generation (VERIFIED from bf_research + this pass)
| Provider | API | SDK | MCP | CLI | Free | MED $ | PREM $ | Comm | Watermark | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| **Gemini Imagen** | ✅(Vertex) | ✅ | ❌ | ❌ | free allowance | per-img | — | yes(paid) | no (C2PA meta) | VERIFIED |
| **OpenAI gpt-image-1** | ✅ | ✅ | ❌ | ❌ | no API free | $0.011–.167/img | — | yes(paid) | C2PA | VERIFIED |
| **FLUX (BFL)** | ✅(fal/Replicate/local) | ✅ | ❌ | ✅ | local $0; schnell $0.003 | dev $0.025; 1.1-pro $0.04 | — | model-dep | no | VERIFIED |
| **Ideogram** | ✅(API) | ❌ | ❌ | ❌ | limited | $0.03–.09/img | custom | yes(paid) | no | VERIFIED |
| **Recraft** | ✅ | ❌ | ❌ | ❌ | **NON-commercial** | paid owned+comm | ent | free=NO | no | VERIFIED |
| **Midjourney** | ❌ no API | ❌ | ❌ | ❌ | web only | sub | — | yes(paid) | no | VERIFIED (no API → REJECT for automation) |
| **Adobe Firefly** | ✅ | ❌ | ❌ | ❌ | limited | sub | ent(indem) | yes(safe) | no | UNKNOWN$ VERIFIED safe |
| **Stability** | ✅ | ✅ | ❌ | ✅ | free tier | sub | ent | model-dep | no | VERIFIED |

### Capability matrix (per task)
- inpainting/outpainting/reference/background-removal: OpenAI edits, FLUX Kontext, Recraft,
  Firefly, Higgsfield. VERIFIED.
- character/product consistency: multi-image reference (OpenAI), FLUX, Higgsfield reference.
- upscaling: fal/Replicate upscalers, Sharp (local, limited).
- vector generation: Recraft (vector native), `vector_generation` (procedural SVG, EXISTS).

## C. Recommendation
- **FREE/LOCAL default:** client photos + Unsplash/Pexels + local FLUX/SD (if licence
  permits commercial) → €0.
- **MEDIUM:** FLUX 1.1-pro $0.04 / Ideogram $0.09 / Recraft paid (commercial) / Gemini.
- **PREMIUM:** Adobe Firefly (brand-safe) / Higgsfield Ultra.
- **REJECT:** Midjourney (no API), Recraft-free (non-commercial), generic stock-like AI.
