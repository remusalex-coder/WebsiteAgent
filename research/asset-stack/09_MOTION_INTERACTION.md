# 09 — MOTION & INTERACTION (deep dive)

> Motion and interaction are CRAFT, not purchases. Everything here is FREE at base.
> V=VERIFIED, K=KNOWN, I=INFERRED.

## A. MOTION LIBRARIES

| Tool | Cost | Licence | Bundle | Mobile | Reduced-motion | React | SSR | Automation | Evidence |
|------|------|---------|--------|--------|----------------|-------|-----|------------|----------|
| **GSAP** | free (standard "no charge"); premium plugins free since Webflow ownership (I) | custom free | ~50KB | ✅ | manual | ✅ | ✅ | build | VERIFIED greensock.com/gsap (I plugin status) |
| **Lenis** | free | MIT | ~4KB | ✅ | ✅ | ✅ | ✅ | build | KNOWN |
| **ScrollTrigger** | free w/ GSAP | custom free | small | ✅ | manual | ✅ | ✅ | build | KNOWN |
| **Motion** (ex-Framer Motion) | free | MIT | mod | ✅ | ✅ | ✅ | ✅ | build | KNOWN |
| **Framer Motion** | free | MIT | mod | ✅ | ✅ | ✅ | ✅ | build | KNOWN |
| **CSS / WAAPI** | free | n/a | 0 | ✅ | ✅ | n/a | n/a | build | KNOWN |
| **View Transitions API** | free | browser | 0 | ✅ | ✅ | n/a | n/a | build | KNOWN |
| **Rive** | free tier | proprietary | small | ✅ | ✅ | ✅ | ✅ | build | KNOWN |
| **Lottie** | free | MIT (lottie-web) | mod | ✅ | ✅ | ✅ | ✅ | build | KNOWN |
| **SVG / Canvas** | free | n/a | 0 | ✅ | manual | n/a | n/a | build | KNOWN |
| **OGL / Three.js** | free | MIT | mod | ✅ | manual | ✅ | ✅ | build | VERIFIED |
| **WebGPU** | free | browser | 0 | ✅ | n/a | n/a | n/a | build | KNOWN |

### Accessibility (mandatory)
- All motion gated behind `prefers-reduced-motion`. Provide static fallback.
- Never autoplay sound. Provide pause/controls for looping media.
- Keyboard-navigable interactions; aria-live for dynamic reveals.

## B. INTERACTION PATTERNS (all procedural, FREE)

Study **CRAV** and **Cuberto** for *mechanisms*, not branding (do not copy visuals).

| Pattern | Implementation | Cost | When useful |
|---------|----------------|------|-------------|
| Custom cursor / follower | CSS + JS (lerp) + GSAP | €0 | interactive/brand sites |
| Magnetic buttons | JS + GSAP (mouse proximity) | €0 | CTAs, nav |
| Hover preview | CSS/JS image swap | €0 | galleries, portfolios |
| Drag | GSAP Draggable / native pointer | €0 | carousels, sliders |
| Physics | matter.js (MIT) | €0 | playful brands |
| Inertia / smooth | Lenis + GSAP | €0 | long-scroll editorial |
| Scroll storytelling | ScrollTrigger pinned | €0 | brand narratives |
| Horizontal scroll | ScrollTrigger + transform | €0 | portfolios, showcases |
| Image displacement | WebGL/Three.js shader | €0 | hero, fashion |
| Masks / clip-path | CSS clip-path + GSAP | €0 | reveals, transitions |
| Morphing | SVG path + GSAP/MorphSVG | €0 (I plugin) | logos, icons |
| Kinetic typography | CSS/JS/GSAP | €0 | headlines, hero |
| Interactive gallery | JS + lazy-load | €0 | real-estate, retail |
| Before/after slider | JS + range input | €0 | renovations, skincare |
| Configurator | Three.js state | €0 | product select |
| Hotspots | Three.js raycast / CSS | €0 | 3D tours |
| Timelines | GSAP timeline | €0 | sequence reveals |

## C. WHEN TO USE / REJECT
- Use motion to *direct attention* and *communicate state*. 
- Reject: motion without business purpose, fake loading, cursor effects on non-
  interactive pages, heavy WebGL on low-value pages (mobile perf). See 15_REJECT_LIST.

## D. LOADING / NAVIGATION (FREE)
- **Real preloader:** asset-aware (count loaded assets) — not timed fake.
- **Skeleton UI:** placeholder layout while data loads.
- **Progressive reveal:** IntersectionObserver + GSAP.
- **Animated menus / full-screen nav:** CSS + JS state.
- **Page transitions:** View Transitions API + GSAP; shared-element where supported.
- **Fallback:** instant render if JS disabled / reduced-motion.
- **Cost:** €0 (build-time). No vendor.

## E. STACK DECISION
Primary motion: GSAP + Lenis + CSS + View Transitions. React: Motion/Framer Motion.
3D interaction: Three.js/R3F. All FREE, automatable at build, no per-site cost.
