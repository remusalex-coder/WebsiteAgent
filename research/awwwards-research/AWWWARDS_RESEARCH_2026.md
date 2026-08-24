# Awwwards-Level Research — YouTube + Live Browser Teardown

**Date:** 2026-08-20
**Method:** Real browser (Playwright/Chromium, this repo) probed 8 *current* Awwwards-winning live sites + awwwards.com listing; 11 YouTube tutorial transcripts fetched and read.
**Goal:** Extract falsifiable technique facts to raise WebsiteAgent output to Awwwards level, mapped to existing `lib/forge`, `lib/runtime`, `lib/design`, `lib/render`.

---

## 1. Live evidence — 8 current Awwwards winners probed (2026-08-20)

| Site | Smooth-scroll | Animation libs (globals) | WebGL canvas | Custom display font(s) | H1 size / transform | Hero video | Base bg |
|---|---|---|---|---|---|---|---|
| likova.space | — | — | ✅ (1) | TT Norms Pro | **143px / UPPERCASE** | — | white |
| mosbyfiles.com | ✅ Lenis | — | — | Signifier + IBM Plex Mono + Founders Grotesk | **144px / UPPERCASE** | — | #191919 dark |
| revelatio.studio | ✅ Lenis | ✅ gsap + ScrollTrigger | ✅ (2) | Neue Haas Grotesk | 36px | ✅ **yes** | #000 black |
| verostudio.com | — | — | ✅ (2) | Beausite Classic + Louize (serif) | 21px | — | #F3F0ED warm |
| produx.design | ✅ Lenis | — | ✅ (13!) | At Aero + DM Mono | 64px | — | #0E0E0E dark |
| noth.in | ✅ Lenis | ✅ gsap | — | PP Neue Montréal + IBM Plex Mono | — | — | white |
| k95.it | ✅ Lenis | — | ✅ (2) | "adaptive" | 32px | — | #000 black |
| haoqi.design | ✅ Lenis | — | ✅ (2) | tronica-mono | — | — | #FBFAF4 off-white |

### Signal summary (8 sites)
- **Lenis smooth scroll: 6/8** (the de-facto standard; `lib/runtime/lenis.ts` already vendored ✅)
- **WebGL canvas present: 7/8** (oGL / Three / raw — motion/particle/cursor-reactive)
- **GSAP + ScrollTrigger: 3/8 directly observed** (more use it but bundle/minify; tutorials confirm it's near-universal)
- **Oversized uppercase H1: 2 sites at 143–144px**; type-scale contrast is the norm
- **Custom display typeface: 8/8** (never system fonts; serif-display + mono pairing common)
- **Dark (#000/#0E0E0E/#191919) OR warm off-white (#F3F0ED/#FBFAF4) base — 8/8**, never pure white
- **Hero video: only 1/8** (revelatio) — most use *typographic* or *WebGL* heroes, not stock video. Matches existing P-001/P-002.

> Note: Zentry (the 2.5M-view tutorial clone target) = `lenis + three + ScrollTrigger + SplitText + spline + oGL + ml5`, 3 canvases, purple #5542FF base, custom "ZentryScreamer" font. Tutorials that promise "Awwwards winner" uniformly rebuild Zentry's **video hero with hover-swap + bento grid + card-tilt + animated text reveal**.

---

## 2. YouTube tutorial technique (11 transcripts read)

Recurring, explicit stack across every "Awwwards build" tutorial:
1. **Lenis** — smooth inertia scroll (every video mentions it first).
2. **GSAP + ScrollTrigger** — scroll-pinned sections, parallax (`scrub: true`), staggered reveals, timelines.
3. **Horizontal scroll** — pin a section, translate a track on X via ScrollTrigger (`S6WNo2GDHxI`, `z_9fvGuOyBc`).
4. **3D card reveal** — `transform-style: preserve-3d` + `perspective` parent; cards "rise from sleeping" (`OODKLwP6LpA`).
5. **Video hero with hover swap** — full-screen video, hover transitions to next clip, expands fullscreen (`zA9r5zTllx4` Zentry clone).
6. **Bento grid + card tilt** on cursor move (vanilla CSS/JS, "no external libraries").
7. **SplitText-style animated headline** reveals on scroll.
8. **Custom fonts** loaded via `@font-face` (Google Fonts / self-hosted display faces).
9. **Hosting**: tutorials use Hostinger (Premium ~$2.69/mo, free domain+SSL) — same deploy gap WebsiteAgent has (Lovable stub).
10. **GSAP went fully free** (Adrian/AW1yfBKRMKc) — no license cost to adopt.

### What tutorials get WRONG vs. real winners
- Tutorials overuse **stock video heroes**; real winners prefer **typographic or WebGL** heroes (only 1/8 use video). → WebsiteAgent should bias to P-001 (type hero) / WebGL, not video.
- Tutorials are **single-page React/Tailwind** clones; real winners ship **custom WebGL + bespoke fonts**. The differentiator is the *asset & motion craft*, not the framework.

---

## 3. Mapping to WebsiteAgent (what exists ✅ / what's missing ❌)

### ✅ Already built (turn it on, don't rebuild)
| Awwwards need | WebsiteAgent module | Status |
|---|---|---|
| Smooth scroll | `lib/runtime/lenis.ts` + `lenis-smooth-scroll` primitive | ✅ vendored; needs Director to select it |
| Scroll reveal / parallax | `lib/runtime/gsapScrollTrigger.ts`, `scroll-progress.ts` | ✅ vendored |
| WebGL hero object | `lib/runtime/threeHero.ts` + `three-js-hero-object` primitive | ✅ vendored |
| Oversized type hero, type-scale, restrained palette | `lib/design/*`, `docs/AWWWARDS_PATTERN_LIBRARY.md` (P-001…P-012) | ✅ codified |
| Anti-generic gate | `lib/qa/visual-critic.ts` + `lib/qa/distinctness-gate.ts` | ✅ built, **off by default** |
| Signature/Forge creative direction | `lib/forge/orchestrator.ts` | ✅ built, **off by default** |

### ❌ Gaps to close for true Awwwards level
| Gap | Why it matters | Evidence |
|---|---|---|
| **1. Director + Forge + Critic not in default `npm run dev`** | Generic output by default (the exact CloudCode problem) | `DIRECTOR_ENABLED=false`, `tier0` budget, `VISION_API_KEY` empty |
| **2. No custom display-font pipeline** | 8/8 winners use bespoke fonts; repo only vendors Playfair/Space Grotesk/Manrope | `lib/render/fontManifest.ts` |
| **3. No WebGL shader/cursor-reactive layer beyond `threeHero`** | 7/8 winners have WebGL; `threeHero` is a single object, not a site-wide shader/cursor system | `lib/runtime/threeHero.ts` is narrow |
| **4. No magnetic cursor / bento tilt / horizontal-scroll primitives** | Tutorials show these are the "wow" interactions; registry has `magnetic-cursor` but not bento-tilt/horizontal-scroll | `lib/design/experienceRegistry.ts` |
| **5. No asset-generation step** | Winners' hero imagery is original/generated; repo scrapes only | `research/asset-stack/` matrix not wired |
| **6. Deploy still a stub** | Loop doesn't close to a live URL | `agents/lovableAgent.ts` throws `NotImplementedError` |
| **7. No reference-image input** | CloudCode's best idea (paste a site you like) absent | `DesignDirective` has no image field |

---

## 4. Recommended action plan (priority order)

**P0 — Flip the switches (today, zero code):**
```
AI_PROVIDER=anthropic  ANTHROPIC_API_KEY=***
DIRECTOR_ENABLED=true
EXPERIENCE_ENGINE=signature
BF_BUDGET_TIER=tier2
VISION_API_KEY=***        # gemini or openai vision
npm run dev -- "<maps_url>"
```
This activates Director → Forge → Visual Critic → Distinctness Gate. Output jumps from "clean but generic" to art-directed.

**P1 — Font + primitive enrichment (small code):**
- Add 3–4 more self-hosted display faces to `lib/render/fontManifest.ts` (a serif-display + a grotesk + a mono per the winners' pairings).
- Register new primitives in `lib/design/experienceRegistry.ts`: `horizontal-scroll`, `bento-card-tilt`, `cursor-reactive-webgl` (extend `threeHero` into a cursor/particle layer).

**P2 — Asset generation (medium code):**
- Wire one generator from `research/asset-stack/` (e.g. Higgsfield-style image/video) into the Forge pre-build so heroes are original, not scraped.

**P3 — Close the loop (the real blocker):**
- Replace `lovableAgent` stub with a `RenderedSite → static host` deploy (Vercel/Netlify/Hosinger API) so the pipeline emits a live URL — matching the tutorials' Hostinger step and the `ROADMAP.md` M2 goal.

---

## 5. Honesty notes
- Lib detection scanned `window` globals + `canvas` contexts + Lenis class; minified bundles can hide libs (so "gsap present" is a floor, not a count). All 8 sites loaded and rendered; signals above are directly observed, not inferred.
- CDN `<script src>` substring matching produced false positives on awwwards.com (category names like "webflow/wordpress"); the table above uses runtime-global + canvas + Lenis-class signals only, which are reliable.
- Screenshots saved: `research/awwwards-research/shot-*.png` (zentry, obys, cuberto).
- This doc is **research only** — it does NOT modify WebsiteAgent. Implementation is tracked in section 4.
