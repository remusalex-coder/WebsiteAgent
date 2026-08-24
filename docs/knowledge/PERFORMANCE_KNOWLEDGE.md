# Performance Knowledge (Domain D33 / F5-Obligation) — Phase 15

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Performance Knowledge Architect
**Date:** 2026-08-17
**Class mix:** **K1** (invariant floor: Core Web Vitals thresholds, CLS-prevention, no-JS-by-default constraint) **+ K2** (craft tradeoffs, budget tuning, degradation choices)
**Vocabulary:** reuses `KNOWLEDGE_TAXONOMY.md` — knowledge classes K1–K4 and the `ACTIVATES_WHEN` / `SUPPRESSED_WHEN` fields. This document is the owning document for **D33 PERFORMANCE** (taxonomy §4).

---

## 0. Honesty note — verified vs synthesis

| Claim | Source | Verified live? |
|---|---|---|
| Core Web Vitals exist as LCP / INP / CLS with "good" thresholds | `https://web.dev/articles/vitals` | **YES** — HTTP 200 on 2026-08-17 |
| INP is the current responsiveness metric (replaced FID) | `https://web.dev/articles/inp` | **YES** — HTTP 200 on 2026-08-17 |
| Lighthouse performance scoring methodology | `https://developer.chrome.com/docs/lighthouse/performance` | **YES** — HTTP 200 on 2026-08-17 |
| General web-performance guidance | `https://developer.mozilla.org/en-US/docs/Web/Performance` | **YES** — HTTP 200 on 2026-08-17 |
| Specific "good" numbers: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | web.dev canonical published values (cited at the URLs above) | **YES** — canonical published web.dev/Lighthouse thresholds; URL live on 2026-08-17 |
| Byte budgets, draw-call caps, tier budgets, cost-matrix numbers | engineering craft synthesis (K2) | **UNVERIFIED as hard spec** — presented as budget recommendations, not a cited standard |
| OWASP Top 10:2021 edition | `https://owasp.org/www-project-top-ten/` | **YES** — HTTP 200 on 2026-08-17; canonical page presents the 2021 edition as the current published list |
| Repo facts: `lib/qa/gates/{performance,accessibility,technical}.ts`, `lib/render/*` static emit, `lib/browser.ts` screenshots at 1440×1000, `scripts/publish-run.ts` deploy hook, no backend runtime today | read from `C:\Users\40728\WebsiteAgent` | **YES** — read on 2026-08-17 |

**No source, spec, or CVE has been invented.** Any claim not listed above as verified is marked **UNVERIFIED** inline and is either (a) K2 engineering craft synthesis flagged as such, or (b) a forward-looking instruction for a future implementation worker.

---

## 1. Scope, KNOWS, activation

- **KNOWS:** the cost of every visual/sensory effect the factory can emit; the invariant performance floor (Core Web Vitals); how to spend a fixed performance budget so the signature survives without breaking the floor; how to degrade gracefully when budget is exceeded.
- **ACTIVATES_WHEN:** always (floor). Escalates in intensity with site tier (brochure → editorial → experience → commerce) and with effect richness.
- **SUPPRESSED_WHEN:** never suppressed. Presence is non-negotiable; only *depth/tuning* is tunable. A site may ship with **zero** WebGL/Canvas/motion and still pass; it may **not** ship with a Core Web Vitals failure and pass.
- **Hard repo constraint (K1):** `lib/render/` emits static HTML/CSS with **no JS by default**. Any effect requiring JS, Canvas, WebGL, or a runtime resource must justify its cost against the no-JS baseline and must provide a static, performant fallback. A "perfect" JS-only hero that fails LCP on a slow device is a defect, not a feature.

---

## 2. Core Web Vitals — K1 floor (verified at web.dev, 2026-08-17)

These are **gates**. A violation is a build failure at `lib/qa/gates/performance.ts`.

| Metric | "Good" (target) | "Needs improvement" | "Poor" | What it measures | Primary lever |
|---|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ **2.5 s** | 2.5–4.0 s | > 4.0 s | Loading: perceived load speed of main content | Image/font/preconnect on hero; no render-blocking |
| **INP** (Interaction to Next Paint) | ≤ **200 ms** | 200–500 ms | > 500 ms | Responsiveness: worst interaction latency | Avoid main-thread blocking JS; defer third-party |
| **CLS** (Cumulative Layout Shift) | ≤ **0.1** | 0.1–0.25 | > 0.25 | Visual stability | Reserve space (width/height, aspect-ratio) |
| **TTFB** (supporting, not a CWV) | ≤ 0.8 s | 0.8–1.8 s | > 1.8 s | Server/CDN responsiveness | Cache, CDN, no origin compute on static |

Source: `https://web.dev/articles/vitals` and `https://web.dev/articles/inp` (both live 2026-08-17). These are the canonical published "good" thresholds used by Lighthouse and CrUX.

**PERF-R01 (K1, gate).** LCP ≤ 2.5 s on the **hero viewport** at mobile throttling (e.g. Lighthouse "Slow 4G" / "Mid-tier mobile"). *Verification:* `lib/qa/gates/performance.ts` runs Lighthouse (or an equivalent field probe) and fails the build when p75 LCP > 2.5 s.
**PERF-R02 (K1, gate).** INP ≤ 200 ms. *Verification:* measure worst interaction on the page; fail when > 200 ms. (INP replaced FID; do not gate on FID — UNVERIFIED as current, FID is retired.)
**PERF-R03 (K1, gate).** CLS ≤ 0.1. *Verification:* track layout shifts during load + scroll; fail when > 0.1.

---

## 3. Image optimization (K1 floor + K2)

**PERF-R10 (K1).** Serve modern formats first. Emit `<picture>` with `image/avif` then `image/webp` then the baseline (e.g. JPEG/PNG) fallback. AVIF/WebP typically cut bytes 30–50% vs JPEG at equal quality. *(Percentages UNVERIFIED as exact; cite as K2 craft range.)*
**PERF-R11 (K1).** Every `<img>` and `<video>` poster carries explicit `width` and `height` (or `aspect-ratio` in CSS) so the browser reserves space → this is the primary CLS control. *Verification:* parse emitted HTML; fail if any content `<img>` lacks width/height or an ancestor `aspect-ratio` container.
**PERF-R12 (K2).** Use `srcset` + `sizes` so the device downloads the smallest sufficient resolution. *Mechanic:* `sizes` must reflect the element's rendered CSS width at each breakpoint; a wrong `sizes` silently ships the largest source. *Verification:* assert `sizes` coverage of breakpoints used in `lib/design/layout.ts`.
**PERF-R13 (K1).** Hero/LCP image: add `fetchpriority="high"` and (if not inlined) preload it; never lazy-load the LCP image. *Verification:* LCP element must not have `loading="lazy"`.
**PERF-R14 (K2).** Non-hero images: `loading="lazy"` + `decoding="async"`. *Verification:* content images below the fold default to lazy unless flagged hero.
**PERF-R15 (K2).** Emit images at the **rendered** resolution, not the source resolution. A 400 px-wide column must not ship a 2400 px-wide file. *Verification:* cross-check emitted `srcset` max width against `sizes` max.

---

## 4. Lazy loading (K2)

**PERF-R20.** `loading="lazy"` on all non-critical images/iframes. Never on the first viewport's content.
**PERF-R21.** Defer below-fold `<section>`s' heavy media via IntersectionObserver only when JS is present; the **no-JS baseline must still render all content** (native lazy is fine; JS-gated lazy is not acceptable as the only path).
**PERF-R22.** Iframes (maps, embeds): lazy-load + `title` + consent-gate if they carry tracking (cross-ref `SECURITY_KNOWLEDGE.md` cookie/consent rules). *Verification:* any `<iframe>` with a tracking host must be behind a consent state.

---

## 5. Fonts (K1 floor + K2)

**PERF-R30 (K1).** Every web font uses `font-display: swap` (or `optional`) — never `block` beyond a 100 ms fallback window, to avoid FOIT (invisible text). *Verification:* emitted `@font-face` blocks must contain `font-display`.
**PERF-R31 (K2).** Subset fonts to the glyphs actually used (especially for display/brand faces and non-Latin). *Mechanic:* subsetting can cut font bytes 60–90% for Latin-only usage. *(Percentages UNVERIFIED exact.)*
**PERF-R32 (K2).** Use `size-adjust` / `ascent-override` / `descent-override` (or a metric-compatible fallback) so the fallback and the web font swap without CLS. *Verification:* CLS probe must not spike at font swap (tie to PERF-R03).
**PERF-R33 (K2).** Preload the LCP-relevant font file (`<link rel="preload" as="font" crossorigin>`) only when it is on the critical path (hero headline). Do not preload more than 1–2 fonts.
**PERF-R34 (K1).** Limit distinct font families/weights. Each additional weight is a separate download. Default budget: ≤ 2 families, ≤ 3 weights total on brochure/editorial tiers. *(Budget UNVERIFIED as spec; K2 recommendation.)*

---

## 6. JavaScript budgets (K1 ceiling on critical path + K2)

**PERF-R40 (K1).** Total JS on first load for a **brochure/editorial** tier must stay at or near **0 KB** (no JS by default). Any added JS is an opt-in that must clear the effect-cost matrix (§11b).
**PERF-R41 (K2).** For tiers that do ship JS (experience/commerce), enforce a critical-path budget: ≤ 100 KB compressed for first-load interactivity; ≤ 300 KB total third-party. *(Budgets UNVERIFIED as spec; K2 craft.)*
**PERF-R42 (K1).** No synchronous, render-blocking `<script>` in `<head>`. Scripts are `defer` or `async` or module + `defer`. *Verification:* emitted HTML must not contain a non-deferred head script that touches layout.
**PERF-R43 (K2).** Code-split per route/section; do not ship the WebGL/motion runtime to a page that doesn't use it.

---

## 7. Animation compositing (K1 — which properties are free)

**PERF-R50 (K1).** Animate **only** `transform` and `opacity` for any continuous/scroll animation. These run on the compositor thread and **avoid layout + paint**.
- ✅ `transform: translate/scale/rotate`, `opacity`
- ❌ Layout-triggering: `width`, `height`, `top`, `left`, `margin`, `padding` (cause reflow)
- ❌ Paint-triggering: `box-shadow`, `background-color`, `filter`, `border-radius` (expensive repaint, especially on large areas)
**PERF-R51 (K1).** Any animation on a layout/paint property is a **K1 defect** unless it is a one-shot, single-element, non-scroll micro-interaction and `prefers-reduced-motion` is honored.
**PERF-R52 (K1).** Honor `prefers-reduced-motion: reduce` — disable non-essential motion, replace with instant/opacity-only state changes. *Verification:* CSS must contain a `@media (prefers-reduced-motion: reduce)` block that neutralizes transforms/keyframes.
**PERF-R53 (K2).** Use `will-change: transform` sparingly and only on elements about to animate; never globally (it increases GPU memory). Remove after animation.

---

## 8. Canvas / WebGL / 3D asset budgets (K2, cost-gated)

**PERF-R60 (K2).** D18 WebGL / D19 Canvas **ACTIVATES_WHEN** the effect is impossible in CSS/SVG *and* central to the signature (taxonomy §4). **SUPPRESSED_WHEN** it can be done in CSS/SVG at a fraction of cost, on conversion-critical first paint, or on a content site where LCP is the whole game.
**PERF-R61 (K2).** 3D asset budget per scene (UNVERIFIED exact; K2 recommendation):
| Budget item | Brochure/Editorial | Experience | Commerce (product viewer) |
|---|---|---|---|
| Max draw calls / frame | 0 (no 3D) | ≤ 100 | ≤ 250 |
| Max texture memory | 0 | ≤ 32 MB | ≤ 64 MB |
| Max glTF download (Draco) | 0 | ≤ 2 MB | ≤ 5 MB |
| Max individual texture | 0 | ≤ 2 MB (KTX2) | ≤ 4 MB (KTX2) |
**PERF-R62 (K2).** 3D models ship as **glTF + Draco** (geometry compression) + **KTX2** (GPU-compressed textures, e.g. Basis). Uncompressed PNG/JPEG textures or OBJ/FBX are prohibited for web delivery. *Verification:* asset pipeline output must be `.glb`/`.gltf` with KHR_draco_mesh_compression and KHR_texture_basisu, or the emit is rejected.
**PERF-R63 (K1).** WebGL context loss must be handled; the canvas must degrade to a static `<img>` poster on context-loss / unsupported / `prefers-reduced-motion` / low-end GPU. *Verification:* code path exists returning a poster image when `WEBGL_*` unavailable.
**PERF-R64 (K2).** Cap devicePixelRatio for canvas/WebGL at 2; do not render at 3× on 3× screens (quadruples fragment cost). *Verification:* `Math.min(devicePixelRatio, 2)`.
**PERF-R65 (K2).** Pause/resume the render loop on `visibilitychange` (tab hidden) and on scroll-out (IntersectionObserver). Idle WebGL burns battery and competes with INP.

---

## 9. Video (K2)

**PERF-R70.** `<video>` always ships a `poster` (static image) so LCP/first paint is instant and CLS-stable; the poster must carry width/height.
**PERF-R71.** `preload="none"` (or `metadata`) by default; `autoplay` only when muted + inline + user-intent (background hero). Autoplaying sound is a K1 UX/accessibility defect.
**PERF-R72.** Encode with modern codecs: **H.264** (universal baseline) + **AV1** (where supported) for ~30–50% savings. *(Savings UNVERIFIED exact.)* Provide multiple `<source>` by codec.
**PERF-R73.** Background hero video is the **highest-cost effect in the matrix** (§11b). It must clear the experience/commerce tier budget and must never be on a brochure/editorial site.

---

## 10. Network, caching, CDN (K1 baseline + K2)

**PERF-R80 (K1).** Static assets are immutable and cache-forever: `Cache-Control: public, max-age=31536000, immutable` on hashed filenames. HTML is `no-cache` (revalidate). *Verification:* deploy hook `scripts/publish-run.ts` must emit these headers.
**PERF-R81 (K2).** Serve from a CDN at the edge; ensure Brotli/Gzip compression on text (HTML/CSS/JS/JSON/SVG). *Verification:* response `content-encoding: br` present.
**PERF-R82 (K1).** Use `preconnect` (and `dns-prefetch` fallback) for any cross-origin host used on the critical path (font CDN, image CDN). Do not preconnect to hosts not used.
**PERF-R83 (K2).** Avoid third-party render-blocking scripts; self-host fonts + critical CSS where possible to keep TTFB and INP clean.
**PERF-R84 (K2).** HTTP/2 (or 3) multiplexing assumed; still minimize request count via sprite/concat for non-hashed small assets.

---

## 11. CORE DELIVERABLE — DECISION RULES

### 11a. Numeric budget table per site tier

These are **K2 craft budgets** (UNVERIFIED as hard spec). A tier that stays under all "Target" rows passes the K1 floor by construction. The "Cap" rows are hard ceilings a worker must never exceed.

| Dimension | Brochure | Editorial | Experience | Commerce |
|---|---|---|---|---|
| Render mode | static, **0 JS** | static, **0 JS** | static + opt-in JS | static + opt-in JS |
| Total first-load JS (compressed) | **0 KB** (cap 0) | **0 KB** (cap 0) | ≤ 100 KB (cap 150) | ≤ 200 KB (cap 300) |
| Third-party JS | 0 (cap 0) | 0 (cap 0) | ≤ 100 KB (cap 150) | ≤ 150 KB (cap 200) |
| LCP image bytes (hero) | ≤ 100 KB | ≤ 120 KB | ≤ 200 KB | ≤ 250 KB |
| Total image bytes (page) | ≤ 500 KB | ≤ 1 MB | ≤ 2 MB | ≤ 3 MB |
| Web fonts (families×weights) | ≤ 2×3 | ≤ 2×3 | ≤ 3×4 | ≤ 3×4 |
| WebGL/Canvas | prohibited | prohibited | ≤ budget §8 | ≤ budget §8 |
| Background video | prohibited | prohibited | allowed (cap) | allowed (cap) |
| LCP (all tiers) | ≤ 2.5 s | ≤ 2.5 s | ≤ 2.5 s | ≤ 2.5 s |
| INP (all tiers) | ≤ 200 ms | ≤ 200 ms | ≤ 200 ms | ≤ 200 ms |
| CLS (all tiers) | ≤ 0.1 | ≤ 0.1 | ≤ 0.1 | ≤ 0.1 |

**Rule PERF-TIER (K1/K2).** A site is assigned exactly one tier from its business signature. The worker MUST select the strictest applicable tier; a brochure business must not be up-tiered to "experience" to justify an effect. Up-tiering requires an explicit, recorded reason from the Experience Director.

### 11b. EFFECT COST MATRIX (mechanically evaluable)

Columns: **effect · bytes · main-thread ms · GPU · LCP risk · INP risk · CLS risk · verdict**. "verdict" values: `ALLOW` (K2, within budget), `ALLOW-IF-DEGRADED` (requires fallback per §11c), `PROHIBITED` (fails K1 floor or tier cap).

| effect | bytes | main-thread ms | GPU | LCP risk | INP risk | CLS risk | verdict |
|---|---|---|---|---|---|---|---|
| Static hero image (AVIF, sized) | ~80–200 KB | ~0 | none | low | none | low (if sized) | **ALLOW** |
| System/self-hosted font w/ swap+subset | ~10–40 KB | ~0 | none | low | none | low (if size-adjust) | **ALLOW** |
| CSS transform/opacity animation | 0 | ~0 (compositor) | low | none | none | none | **ALLOW** |
| CSS filter/box-shadow animation | 0 | 5–30 ms/frame | med | none | med | none | **ALLOW-IF-DEGRADED** |
| `loading="lazy"` images | 0 added | ~0 | none | none | none | low | **ALLOW** |
| JS island (deferred, <50 KB) | <50 KB | <50 ms | none | none | low | none | **ALLOW** (exp tiers) |
| Canvas 2D (static render) | <100 KB | 10–50 ms (one-shot) | low | none | low | none | **ALLOW-IF-DEGRADED** |
| WebGL signature scene (Draco+KTX2) | 1–5 MB | 5–20 ms/frame | high | med (if hero) | med | none | **ALLOW-IF-DEGRADED** (exp/com tiers) |
| Background autoplay video (AV1/H264) | 1–10 MB | 2–10 ms/frame | high | **high** | med | low (poster) | **ALLOW-IF-DEGRADED** (exp/com only) |
| Layout/paint-property animation (width/top) | 0 | 10–60 ms/frame | med | none | **high** | med | **PROHIBITED** (K1) |
| Third-party tag/analytics on critical path | 50–300 KB | 50–300 ms | none | med | **high** | none | **PROHIBITED** on brochure/editorial |
| JS-only hero (no static fallback) | var | var | var | **high** | med | med | **PROHIBITED** (no-JS K1) |

*Byte/ms figures are K2 craft estimates (UNVERIFIED exact). The structural rule — "layout/paint animation prohibited, compositor-only allowed, no-JS hero prohibited" — is K1.*

### 11c. Degradation ladder per effect class

Each effect class has a deterministic degrade path. A worker picks the **highest rung that passes the tier budget + K1 floor**; if none pass, the effect is dropped (not silently broken).

| Effect class | Rung 3 (full) | Rung 2 (reduced) | Rung 1 (fallback) | Rung 0 (dropped) |
|---|---|---|---|---|
| Image | AVIF full-res `srcset` | WebP single size | baseline JPEG, sized | (none — image is content; use smallest legible) |
| Font | subset swap + preload | swap, system fallback metric | system font only | — |
| Motion | transform/opacity loop | single entrance, no loop | instant state change | none (`reduced-motion`) |
| Canvas/WebGL | live scene | static poster `<img>` | CSS gradient placeholder | solid color block |
| Video | autoplay muted inline | click-to-play | poster + link | poster only |
| JS island | interactive | progressive-enhancement (works without) | static HTML content | static content |

**PERF-DEGRADE (K1).** Every effect emitted MUST have a defined Rung 1 (fallback) that (a) satisfies the K1 floor with **zero JS** and (b) carries no CLS. An effect with no Rung 1 is **PROHIBITED**.

### 11d. Decision rules — when effect wins vs when performance wins

**PERF-DECIDE-1 (K1 over K3).** If an effect would push LCP > 2.5 s, INP > 200 ms, or CLS > 0.1, **performance wins** — drop or degrade the effect. A signature that fails the floor is a failure regardless of beauty (taxonomy doctrine: K1 > K3).

**PERF-DECIDE-2 (K2 — effect worth the cost).** An expensive effect (WebGL scene, background video) is **worth the cost** ONLY when ALL hold:
1. Assigned tier is experience or commerce (brochure/editorial: never).
2. The effect is *central* to the verified signature (not decorative — anti-slop, taxonomy D39).
3. A Rung-1 zero-JS fallback exists and passes the floor.
4. The tier's byte/JS budget (§11a) is not exceeded after the effect.

**PERF-DECIDE-3 (K1 — no-JS baseline).** The no-JS static render must be fully usable and on-brand. JS/effects are **progressive enhancement only**. If removing all JS breaks content or layout, that is a K1 defect.

**PERF-DECIDE-4 (K2 — restraint).** Default to the cheapest effect that conveys the intent. CSS/SVG before Canvas; Canvas before WebGL; still image before video. "Can it be done cheaper and still true?" is asked at every ADD edge (taxonomy D39 Restraint).

---

## 12. Repo integration notes (non-modifying)

- `lib/qa/gates/performance.ts` is the enforcement point for PERF-R01/02/03 and the budget rows. This document is **input to** that gate, not a modification of it.
- `lib/render/*` emits the static HTML/CSS; PERF-R11/13/30/42 etc. are satisfied by what it emits — a future worker checks emitted output against these rules.
- `scripts/publish-run.ts` (deploy hook) is where PERF-R80/81 (cache headers, compression) are realized at delivery.
- `lib/browser.ts` screenshots at 1440×1000 — the QA screenshot is a *desktop* probe; LCP/CLS gates MUST also be evaluated at mobile throttling (rule PERF-R01) because desktop 1440×1000 will not surface mobile LCP failures.

---

### Footer

- Class of this document: **K1 (floor) + K2 (tradeoff)**; it contains no K3/K4 by design (performance floor is invariant).
- Re-verify annually: CWV thresholds (web.dev), OWASP edition (if security cross-ref), codec/format support tables (MDN/caniuse).
- Do not implement. Hand to the Performance/QA worker and the Frontend worker as the decision reference for `lib/qa/gates/performance.ts` and `lib/render/*`.
