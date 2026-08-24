# 09 — 3D ASSETS

> Generation VERIFIED from `bf_research/03_3d.md`. Note: `three_d_generation` is tier
> **rejected** (frozen F-18) — Tripo/Meshy researched, NOT activated. Recorded for
> evidence-gated re-opening.

## A. 3D RUNTIME (FREE, always — ADOPT P0)
| Engine | Licence | Bundle | Notes | Evidence |
|---|---|---|---|---|
| **Three.js** | MIT | 178KB gz | WebGPURenderer r185; mobile ✅ | VERIFIED |
| **React Three Fiber** | MIT | 51KB gz | React declarative | VERIFIED |
| **OGL** | Unlicense | tiny | light WebGL | VERIFIED |
| **Babylon.js** | Apache-2 | larger | full engine, PBR, physics | KNOWN |
| **WebGPU** | browser | 0 | progressive enhancement | KNOWN |
| **Spline Viewer** | free embed | `<spline-viewer>` | drop-in scenes | VERIFIED spline.design |

Runtime = the factory's 3D path today (procedural geometry, client GLB). No generation cost.

## B. 3D GENERATION (candidates, gated)
| Provider | Free | MED $ | PREM $ | API | MCP | Comm | Evidence |
|---|---|---|---|---|---|---|---|
| **Meshy** | $0 | $10/$20/$40/$70/$100/$240 | ent | ✅ | ✅ | paid=YES | VERIFIED |
| **Tripo** | $0 (200cr, non-comm) | $19/$54/$89/$1000 | ent | ✅ | ❌ | paid=YES | VERIFIED |
| **Spline** | $0 (2k AI cr/mo) | Pro $20/$25 | ent $120/$150 | ✅ | ❌ | user-owns scenes | VERIFIED |
| **Local (InstantMesh/TripoSR)** | ✅ $0 | — | — | local | ❌ | OSS | KNOWN |
| **Sketchfab / Poly Haven / ambientCG** | CC/CC0 models+textures | — | — | API | ❌ | per-licence | KNOWN |

### Meshy (VERIFIED)
- Text/image→GLB, AI texturing, auto-rig/animation, **MCP server** ("Generate 3D inside
  Claude/Cursor"), CLI, API. Tiers $0/$10/$20/$40/$70/$100/$240. "You own generated assets,
  commercial OK on any paid plan."

### Tripo (VERIFIED)
- Text/image→GLB, tiers $0 (200cr non-comm)/$19/$54/$89/$1000. API+SDK.

## C. When 3D is business-justified
- ✅ Product configurator (e-commerce/automotive/furniture).
- ✅ Real-estate 3D tour (client model or Meshy).
- ✅ Interactive hero where product benefits from rotation.
- ❌ Generic 3D blobs / aimless WebGL → REJECT (reject list).

## D. Recommendation
- **ADOPT runtime (P0):** Three.js/R3F/OGL — €0, MIT, mobile, reduced-motion gated.
- **OPTIONAL generation (P2):** Meshy/Tripo/Spline **only if `three_d_generation` gate
  re-opens by evidence** (ExperienceSignature.requires3D with rationale).
- **FREE alt:** client-supplied GLB + Poly Haven/ambientCG CC0 + local reconstruction.
- **REJECT default:** generated meshes are heavy/generic/unverifiable (frozen F-18).
