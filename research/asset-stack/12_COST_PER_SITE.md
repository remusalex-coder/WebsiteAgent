# 12 — COST PER WEBSITE

> Concrete scenarios. Prices VERIFIED from official sources where possible; UNKNOWN
> where official page was JS-rendered/blocked. Do NOT invent — gaps marked UNKNOWN.
> Currency: EUR, approx 1:1 with USD for planning. Capture 2026-08-19.

## A. €0 WEBSITE (default, internal budget €0)
| Layer | Choice | Cost |
|-------|--------|------|
| Imagery | client photos + Unsplash/Pexels + local SD | €0 |
| Video | procedural CSS/Canvas/Ken-Burns OR client footage | €0 |
| 3D | Three.js + client/open GLB | €0 |
| Voice | Kokoro/Piper local | €0 |
| Music/SFX | PD / Web Audio procedural | €0 |
| Motion | GSAP + Lenis + CSS + View Transitions | €0 |
| Interaction | CSS+JS (cursor, magnetic, sliders) | €0 |
| Forms | Web3Forms free (250/mo) | €0 |
| Maps | OSM + Leaflet | €0 |
| Auth/CMS/DB | Supabase free (50k MAU) | €0 |
| Booking | Cal.com self-host | €0 |
| Storage/CDN | Cloudflare free + R2 free (10GB, no egress) | €0 |
| Media proc | FFmpeg/Sharp at build | €0 |
| Analytics | Plausible self-host | €0 |
| **LLM (site build orchestration)** | local Ollama OR free tier of existing provider | €0* |
| **TOTAL BUILD COST** | | **€0** |

\* LLM cost depends on BusinessForge's own inference; if using a free API tier, €0. If
using paid LLM, that's BusinessForge's operating cost, not the client's asset cost.

## B. €0–€1 WEBSITE
Same free base + a few pay-per-use generative assets:
- 10–30 FLUX-schnell images @ $0.003 (Replicate/fal) ≈ €0.03–€0.09, OR
- 1–2 image edits via FLUX Kontext @ $0.04 ≈ €0.08, OR
- a handful of Recraft-free edits (non-commercial only).
- Suno free for music (non-commercial).
**Total generative spend: ~€0–€1.**

## C. €1–€5 WEBSITE
Free base + targeted MEDIUM assets:
- Higgsfield Starter (~$15/mo) used fractionally, OR
- fal.ai: ~20–60s video (Wan $0.05/s → €1–€3) + 20 FLUX images (€0.8) ≈ €2–€4, OR
- Runway Standard $12 prorated for one-off (over band → prefer fal pay-per-use),
- ElevenLabs Starter $6 is just over €5 → include only in D.
**Total generative spend: ~€1–€5** (concentrated on 1–2 hero assets).

## D. €5–€20 PREMIUM WEBSITE
Free base + surgical PREMIUM:
- Higgsfield Ultra (~$99/mo) or Runway Max ($76) — but for a single site, use pay-per-use
  fal Veo 3 ($0.40/s → 10–30s ≈ €4–€12) to stay in band, OR one-month sub prorated.
- ElevenLabs Creator/Pro ($22/$99) for studio voice-over ≈ €5–€20.
- Meshy Studio for 1–3 product 3D models ≈ (U price, estimate €5–€15).
- Recraft/Firefly paid for brand-safe imagery ≈ €5–€15.
**Total generative spend: ~€5–€20**, on the 1–3 assets with proven business value.

## INDUSTRY ESTIMATES (asset-stack cost only, build-time)

### Restaurant
- €0: client food photos + menu hover + Cal.com booking + Web3Forms + OSM. €0.
- €1–€5: + 10 FLUX menu-item edits + 1 short food video (fal Wan ~10s). ≈ €2.
- €5–€20: + Higgsfield food hero film + ElevenLabs menu narration. ≈ €10.

### Automotive
- €0: Three.js wheel/configurator + client photos + test-drive booking (Cal.com). €0.
- €1–€5: + product video (fal Kling ~15s) + FLUX studio shots. ≈ €3.
- €5–€20: + Higgsfield cinematic hero + multiple 3D models (Meshy). ≈ €15.

### Real Estate
- €0: OSM map + gallery + SVG floor plan + comparison table + booking. €0.
- €1–€5: + 10 property edits (FLUX) + 1 area video. ≈ €2.
- €5–€20: + 3D tour (Three.js + Meshy models) + hero film. ≈ €12.

### Fashion
- €0: editorial client photos + lookbook + Fuse.js filter + Stripe shop. €0.
- €1–€5: + 15 FLUX editorial + 1 fashion film (fal). ≈ €3.
- €5–€20: + Higgsfield campaign video + ElevenLabs voice + Recraft brand set. ≈ €15.

### Professional Services
- €0: trust motion (GSAP) + testimonials + Web3Forms + Supabase client portal + Plausible.
  €0.
- €1–€5: + headshot edits (FLUX) + 1 explainer video. ≈ €2.
- €5–€20: + ElevenLabs intro narration + Higgsfield brand film. ≈ €10.

## LLM / processing / other APIs row (per build)
- LLM: BusinessForge operating cost (free tier or local = €0; otherwise per existing
  provider rates — not in asset budget).
- Storage: R2 free 10GB = €0 (unless >10GB → $0.015/GB-mo).
- Processing: FFmpeg/Sharp local = €0.
- Payments: Stripe per-tx, borne by client sales, €0 build.
- Other APIs: only if client needs (maps free via OSM; no paid API required by default).

## Caveat
All MEDIUM/PREMIUM prices with UNKNOWN exact values must be fetched live at integration.
This doc is the planning ceiling, not a billing system.
