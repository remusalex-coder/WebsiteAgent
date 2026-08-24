# Experience Capability Library — Entry / Loading, Navigation / Transitions, Cursor / Pointer
# Research dossier for BusinessForge (generated 2026-08-19)
# Motion-language note:
# A coherent premium "motion language" treats motion as communication, not decoration.
# Principle 1 — PURPOSE: every transition answers "where am I, where did I go, what is happening?"
# Principle 2 — HIERARCHY: loading = patience signal; navigation = spatial continuity; cursor = intent amplifier.
# Principle 3 — RESTRAINT: one signature move per surface. A site with a hero preloader should not also
#               have a magnetic cursor, a clip-path wipe, AND a distortion cursor — pick the move that
#               matches the business's emotional job (luxury=calm reveal; product=fast clarity; agency=wow).
# Principle 4 — SAFETY: every motion primitive ships with a prefers-reduced-motion and mobile fallback.
# Principle 5 — TRUTH IN LOADING: progress must map to real asset/network state; fake progress is only
#               acceptable as a branded minimum-duration floor, never as deception.
#
# EVIDENCE LEGEND:
#   OBSERVED  = seen on a named real site OR in official vendor/docs pages (URLs cited).
#   INFERRED   = reasonable from cited evidence but not directly verified on a specific named build.
#   UNKNOWN    = could not be verified from available sources.
# Research method: python/urllib fetches of official docs (MDN, Chrome Dev, GSAP, Can I Use, Lenis,
# Barba, Locomotive, three.js, WebGL Fundamentals) + confirmation that studio URLs resolve (HTTP 200)
# + public case-study knowledge (Awwwards/FWA/CSS Design Awards features, studio engineering posts).
# The live browser_exec CLI was unavailable in this environment (pydantic_core ABI crash), so studio
# implementation specifics are cited from their public sites/case studies rather than live DOM inspection.

---

## PATTERN: preloader
- CATEGORY: entry
- USER EXPERIENCE: A full-screen cover sits over the page while assets load; user waits behind a curtain, then content is revealed. Feels like an ante-chamber before the experience.
- TECHNICAL MECHANISM: Overlay div (fixed, z-index top) shown on load; removed after window 'load' or after a JS asset/promise queue resolves. Often paired with a percentage counter or progress bar. Vanilla JS + CSS; can gate with Promise.all([img.decode(), font.ready, ...]).
- EXAMPLES: Studio sites using intro curtains (https://cuberto.com/, https://www.dogstudio.co/); generic pattern documented broadly on Awwwards (https://www.awwwards.com/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: High-craft agency/portfolio, luxury brand, WebGL product launch, immersive campaign.
- GOOD USE CASES: Heavy first paint (WebGL, video, large hero imagery); brand-led sites where the wait is part of the show.
- BAD USE CASES: Content/marketing sites, SEO landing pages, e-commerce where load speed = revenue; anything where the curtain hides real content from crawlers.
- FUNCTIONAL VALUE: Hides FOUC/broken layout during asset fetch; prevents interaction with unready UI.
- EMOTIONAL VALUE: Anticipation, ritual, premium "show is about to start" feeling.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low (cost is the wait itself, not the curtain)
- ACCESSIBILITY RISK: medium (focus trap, screen-reader sees hidden content; must set aria-hidden + role=status for progress)
- MOBILE STRATEGY: Keep duration short; skip on slow connections (navigator.connection.saveData); never block first paint > 2.5s.
- REDUCED MOTION STRATEGY: Show a static branded frame for <=400ms then instant reveal; no spinner animation.
- DEPENDENCIES: None (vanilla). Optional: GSAP for exit tween.
- PROVIDERS/LIBRARIES: GSAP, anime.js, @barbajs/core (preload hook)
- BUSINESSFORGE CAPABILITY NAME: cap.entry.loader.pre
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.loader.pre","trigger":"route_enter","params":{"coverColor":"#0a0a0a","minMs":600,"maxMs":2500,"showProgress":true,"gateOn":"window.load"},"fallback":{"reducedMotion":"instant","mobile":"light"}}
- QA REQUIREMENTS: (1) Page becomes interactive after load; (2) no console errors; (3) reload 5x no stuck curtain; (4) Lighthouse SEO sees content; (5) tab focus not trapped after dismiss.

## PATTERN: branded loader
- CATEGORY: entry
- USER EXPERIENCE: Instead of a generic spinner, the brand's logo, mark, or signature animation plays while loading — you wait inside the brand's identity.
- TECHNICAL MECHANISM: SVG logo path-draw (stroke-dashoffset animation) or Lottie/JSON animation, or a short GSAP timeline revealing the wordmark. Often the same mark later used in the nav, creating continuity.
- EXAMPLES: Cuberto wordmark motion (https://cuberto.com/); Active Theory logo stings (https://activetheory.net/); Lottie docs (https://airbnb.io/lottie/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: Brand-forward companies, luxury, agencies, any site where identity recall matters.
- GOOD USE CASES: Rebrands, flagship campaign sites, portfolio where the mark is the hero.
- BAD USE CASES: Utility/tools, internal dashboards, anything where the brand mark adds zero recognition value.
- FUNCTIONAL VALUE: Reinforces brand memory during dead time; can double as a logo lockup intro.
- EMOTIONAL VALUE: Ownership, polish, "this is a real brand."
- IMPLEMENTATION COMPLEXITY: medium (logo asset + path animation or Lottie integration)
- PERFORMANCE COST: low-medium
- ACCESSIBILITY RISK: low-medium (decorative; mark role=img with aria-label, or aria-hidden if redundant)
- MOBILE STRATEGY: Smaller mark, shorter draw; respect saveData.
- REDUCED MOTION STRATEGY: Static logo fade-in only, no path-draw sweep.
- DEPENDENCIES: GSAP (DrawSVG/MotionPath optional) or Lottie-web; SVG.
- PROVIDERS/LIBRARIES: GSAP, Lottie (airbnb.io/lottie), anime.js
- BUSINESSFORGE CAPABILITY NAME: cap.entry.loader.brand
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.loader.brand","trigger":"route_enter","params":{"logoRef":"brand.mark.svg","technique":"path-draw","durationMs":1200,"loop":false},"fallback":{"reducedMotion":"fade","mobile":"short"}}
- QA REQUIREMENTS: (1) Logo visible & centered; (2) animation completes and curtain lifts; (3) no layout shift on reveal; (4) SVG has accessible label or is hidden.

## PATTERN: skeleton loading
- CATEGORY: entry
- USER EXPERIENCE: Grey placeholder boxes mimic the final layout's shape while data arrives; feels fast and structured rather than empty.
- TECHNICAL MECHANISM: CSS-only shimmer (linear-gradient animation) over layout-shaped blocks; swapped for real content when fetch resolves. Often paired with React Suspense / content-visibility. Pure CSS + a data-state toggle.
- EXAMPLES: Widely used in app UIs; documented pattern on web.dev (https://web.dev/articles/your-first-performance-budget) and MDN; Webflow/Awwwards app-style sites.
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: SaaS dashboards, marketplaces, feeds, data-driven web apps, e-commerce listings.
- GOOD USE CASES: Async content (API lists, user-generated feeds), perceived-performance wins.
- BAD USE CASES: Static brochure sites, brand-cinematic landings where skeletons break the mood.
- FUNCTIONAL VALUE: Reduces perceived latency; reserves layout space (no CLS); signals structure.
- EMOTIONAL VALUE: Calm, competent, "it's working."
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (use aria-busy on container; skeletons are decorative)
- MOBILE STRATEGY: Fully supported; keep shimmer subtle to save battery.
- REDUCED MOTION STRATEGY: Remove shimmer animation; keep static grey blocks.
- DEPENDENCIES: None (CSS). Frameworks: React Suspense, Vue <Suspense>.
- PROVIDERS/LIBRARIES: Native CSS, React, Vue, @tanstack/react-query (placeholder states)
- BUSINESSFORGE CAPABILITY NAME: cap.entry.loader.skeleton
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.loader.skeleton","trigger":"data_fetch","params":{"shimmer":true,"shapeFrom":"layout","ariaBusy":true},"fallback":{"reducedMotion":"static","mobile":"same"}}
- QA REQUIREMENTS: (1) Skeleton shows before data; (2) replaced without layout shift; (3) aria-busy toggles; (4) no infinite skeleton on error (show empty/error state).

## PATTERN: progressive loading
- CATEGORY: entry
- USER EXPERIENCE: Content appears in stages as each part is ready — text first, then images pop in — so the page feels alive immediately rather than all-at-once.
- TECHNICAL MECHANISM: Streamed HTML / partial hydration; image loading="lazy" + decode(); priority hints (fetchpriority="high" on LCP). IntersectionObserver to hydrate below-fold sections. Combines native loading primitives.
- EXAMPLES: Next.js streaming/SSR (https://nextjs.org/docs/app/building-your-application/routing/loading-ui); Astro islands (https://docs.astro.build/); web.dev loading guidance.
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: Content/publishing, e-commerce, blogs, docs, any data-rich site.
- GOOD USE CASES: Long pages, CMS content, image-heavy catalogs.
- BAD USE CASES: Tiny landing pages where staging adds complexity for no gain.
- FUNCTIONAL VALUE: Faster time-to-content / LCP; uses bandwidth efficiently.
- EMOTIONAL VALUE: Responsive, modern, low-friction.
- IMPLEMENTATION COMPLEXITY: medium (framework/hydration orchestration)
- PERFORMANCE COST: low (it improves performance)
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: Essential on mobile (bandwidth); use responsive images + priority hints.
- REDUCED MOTION STRATEGY: Keep staged loading (it is not motion); just no fade-in tween.
- DEPENDENCIES: Framework (Next/Astro/SvelteKit) or manual fetch + DOM patch.
- PROVIDERS/LIBRARIES: Next.js, Astro, SvelteKit, native loading primitives
- BUSINESSFORGE CAPABILITY NAME: cap.entry.loader.progressive
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.loader.progressive","trigger":"route_enter","params":{"stream":true,"lazyImages":true,"priorityHint":"LCP"},"fallback":{"reducedMotion":"same","mobile":"aggressive"}}
- QA REQUIREMENTS: (1) LCP < 2.5s; (2) no content missing after load; (3) images not distorted; (4) works with JS disabled (SSR fallback).

## PATTERN: content reveal after load
- CATEGORY: entry
- USER EXPERIENCE: Once loaded, hero text/images animate into place (fade/slide/mask) — the "curtain up" moment that turns a static page into a performance.
- TECHNICAL MECHANISM: After load gate, run a GSAP timeline or CSS @keyframes: clip-path/translate/opacity on hero elements, often staggered. Common: SplitText or line-mask reveal.
- EXAMPLES: Dogstudio hero reveals (https://www.dogstudio.co/); 14islands (https://14islands.com/); GSAP docs (https://gsap.com/docs/v3/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: Agencies, luxury, product launches, portfolios, editorial.
- GOOD USE CASES: Hero sections, headline reveals, first-impression pages.
- BAD USE CASES: Dense utility pages; anything where the reveal delays readable content.
- FUNCTIONAL VALUE: Directs attention to the key message; masks late layout.
- EMOTIONAL VALUE: Cinematic, considered, premium.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low-medium (animation only; avoid layout thrash — use transform/opacity)
- ACCESSIBILITY RISK: medium (content must be readable without animation; ensure final state is static & visible)
- MOBILE STRATEGY: Shorter, simpler reveal; skip on saveData.
- REDUCED MOTION STRATEGY: Jump straight to final visible state; no transform.
- DEPENDENCIES: GSAP (or CSS), optional SplitText/ScrollTrigger for scroll-linked.
- PROVIDERS/LIBRARIES: GSAP, anime.js, CSS @keyframes
- BUSINESSFORGE CAPABILITY NAME: cap.entry.reveal.afterload
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.reveal.afterload","trigger":"load_complete","params":{"target":"[data-hero]","staggerMs":80,"effect":"mask-up","ease":"power3.out"},"fallback":{"reducedMotion":"final-only","mobile":"short"}}
- QA REQUIREMENTS: (1) Hero fully visible post-load with JS off? (ensure no opacity:0 stuck); (2) reveal runs once; (3) no horizontal overflow; (4) reduced-motion ends visible.

## PATTERN: asset loading choreography
- CATEGORY: entry
- USER EXPERIENCE: Individual assets (images, fonts, modules) arrive on a timed, designed sequence — not a single dump — so the page "builds" deliberately.
- TECHNICAL MECHANISM: A load orchestrator resolves asset promises and triggers per-asset enter animations in a curated order (e.g., background, then product, then text). Uses await img.decode() + GSAP timeline sequencing.
- EXAMPLES: Immersive Garden builds (https://www.immersive-garden.com/); Monogrid (https://www.monogrid.com/); Active Theory (https://activetheory.net/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: High-end product, fashion, automotive, cinematic campaigns.
- GOOD USE CASES: Art-directed hero compositions; storytelling sequences.
- BAD USE CASES: Fast-scan content sites; SEO/marketing where every second costs.
- FUNCTIONAL VALUE: Controls first impression pacing; hides partial states.
- EMOTIONAL VALUE: Craft, intentionality, suspense.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: medium-high (must not over-delay LCP)
- ACCESSIBILITY RISK: medium (ensure all assets end visible; no stuck hidden)
- MOBILE STRATEGY: Compress sequence; drop non-critical steps on saveData.
- REDUCED MOTION STRATEGY: Reveal all assets at once (no stagger).
- DEPENDENCIES: GSAP timeline, asset promise queue.
- PROVIDERS/LIBRARIES: GSAP, Three.js (for WebGL asset sequencing), anime.js
- BUSINESSFORGE CAPABILITY NAME: cap.entry.asset.choreography
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.asset.choreography","trigger":"assets_ready","params":{"sequence":["bg","product","copy"],"perStepMs":200,"awaitDecode":true},"fallback":{"reducedMotion":"all-at-once","mobile":"trim"}}
- QA REQUIREMENTS: (1) All assets visible at end; (2) no promise hangs (timeout); (3) LCP within budget; (4) replay stable.

## PATTERN: fake vs real progress
- CATEGORY: entry
- USER EXPERIENCE: A progress bar that may reflect true asset loading OR a scripted animation that reaches 100% on a timer — user can't always tell the difference.
- TECHNICAL MECHANISM: REAL: tie width to bytes loaded / promises resolved (fetch progress, PerformanceObserver, asset queue). FAKE: ease a number 0→100 over a fixed min duration; cap real progress at ~90% until assets truly done. Hybrid = real until 90%, then animate to 100%.
- EXAMPLES: Discussed in loader tutorials (Codrops https://tympanus.net/codrops/; Awwwards https://www.awwwards.com/); common in game/launch sites.
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: Launches, games, WebGL experiences where real progress is janky/unmeasurable.
- GOOD USE CASES: When true progress is technically hard to measure and a floor-duration improves perceived smoothness.
- BAD USE CASES: Trust-sensitive contexts (banking, checkout) where fake progress erodes confidence; slow connections (lying about speed angers users).
- FUNCTIONAL VALUE: Smooths erratic real progress; guarantees a minimum branded beat.
- EMOTIONAL VALUE: Smooth, controlled (or manipulative if abused).
- IMPLEMENTATION COMPLEXITY: low-medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (announce via role=progressbar + aria-valuenow)
- MOBILE STRATEGY: Same; shorter floor on mobile.
- REDUCED MOTION STRATEGY: Keep numeric/bar static or instantly full.
- DEPENDENCIES: None; optionally nprogress-style bar.
- PROVIDERS/LIBRARIES: NProgress, GSAP, custom
- BUSINESSFORGE CAPABILITY NAME: cap.entry.progress.fake
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.progress.fake","trigger":"route_enter","params":{"mode":"hybrid","realCapPct":90,"floorMs":700,"maxMs":2500},"fallback":{"reducedMotion":"instant","mobile":"floor-short"}}
- QA REQUIREMENTS: (1) Bar never lies past asset completion regressions; (2) reaches 100% exactly when interactive; (3) no infinite loop on asset failure.

## PATTERN: active waiting
- CATEGORY: entry
- USER EXPERIENCE: Instead of a passive spinner, the wait is filled with micro-interaction — a playful cursor toy, a looping vignette, a "did you know" tip — so waiting feels intentional, not broken.
- TECHNICAL MECHANISM: Loop a small GSAP/Canvas animation or rotate contextual messages during the load window; cap duration and seamlessly hand off to content. Often combined with branded loader.
- EXAMPLES: Resn interactive waits (https://resn.co.nz/); Active Theory (https://activetheory.net/); playful loaders on Codrops (https://tympanus.net/codrops/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: Entertainment, gaming, eccentric brands, agency self-promo.
- GOOD USE CASES: Long unavoidable loads (3D scene compile, big video).
- BAD USE CASES: Serious/enterprise, medical, finance; anything where play reads as unprofessional.
- FUNCTIONAL VALUE: Converts dead time into brand engagement; reduces bounce during waits.
- EMOTIONAL VALUE: Delight, humor, personality.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low-medium (keep the toy cheap; don't compete with asset loading for CPU)
- ACCESSIBILITY RISK: medium (decorative loop must be pausable; respect reduced motion)
- MOBILE STRATEGY: Lighter toy or static frame on mobile.
- REDUCED MOTION STRATEGY: Static branded frame, no looping animation.
- DEPENDENCIES: GSAP, Canvas/WebGL (optional).
- PROVIDERS/LIBRARIES: GSAP, PixiJS (light loops), Lottie
- BUSINESSFORGE CAPABILITY NAME: cap.entry.waiting.active
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.waiting.active","trigger":"load_window","params":{"toy":"cursor-orb","tipRotate":true,"maxMs":3000},"fallback":{"reducedMotion":"static","mobile":"static"}}
- QA REQUIREMENTS: (1) Toy stops when load ends; (2) no CPU spike during load; (3) loop pausable; (4) doesn't block interaction after reveal.

## PATTERN: loading-to-hero morph
- CATEGORY: entry
- USER EXPERIENCE: The loader element (a logo, shape, or color) physically transforms INTO the hero — the curtain becomes the page. Seamless, no hard cut.
- TECHNICAL MECHANISM: Shared DOM node animated from loader state to hero state via FLIP technique (GSAP Flip plugin) or shared-element/View Transitions. The loader's logo scales/positions to the hero's final logo spot.
- EXAMPLES: GSAP Flip plugin docs (https://gsap.com/docs/v3/Plugins/Flip/); studio morphs on Awwwards (https://www.awwwards.com/); Immersive Garden (https://www.immersive-garden.com/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: Brand sites, product launches, any hero-led landing.
- GOOD USE CASES: When the brand mark belongs in both loader and hero (continuity payoff).
- BAD USE CASES: When loader and hero have nothing in common; forced morphs look gimmicky.
- FUNCTIONAL VALUE: Removes the "cut" between load and content; strong continuity.
- EMOTIONAL VALUE: Elegant, seamless, memorable.
- IMPLEMENTATION COMPLEXITY: high (FLIP measurement, layout coordination)
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (final state must be correct & static for SR/users)
- MOBILE STRATEGY: Use simpler scale/fade morph; skip FLIP measurement on tiny screens if janky.
- REDUCED MOTION STRATEGY: Crossfade loader→hero instantly, no geometric morph.
- DEPENDENCIES: GSAP Flip (or View Transitions API).
- PROVIDERS/LIBRARIES: GSAP Flip, View Transitions API, anime.js
- BUSINESSFORGE CAPABILITY NAME: cap.entry.morph.hero
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.morph.hero","trigger":"load_complete","params":{"sharedEl":"[data-brand]","technique":"flip","durationMs":900},"fallback":{"reducedMotion":"crossfade","mobile":"scale-fade"}}
- QA REQUIREMENTS: (1) Morph lands exactly on hero element box; (2) no flash of duplicate; (3) layout stable; (4) reduced-motion crossfade exact.

## PATTERN: loading-to-content transition
- CATEGORY: entry
- USER EXPERIENCE: The load curtain lifts/reveals to expose the already-ready content beneath — a wipe, fade, or mask that hands off from "loading" to "live."
- TECHNICAL MECHANISM: Overlay exit animation (clip-path inset, translateY, opacity) timed to load-complete; content underneath is interactive immediately after. Often uses GSAP timeline + will-change.
- EXAMPLES: Dogstudio (https://www.dogstudio.co/); Cuberto (https://cuberto.com/); generic reveal tutorials on Codrops (https://tympanus.net/codrops/).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: All cinematic/brand sites; the default "lift the curtain" pattern.
- GOOD USE CASES: Any site with a preloader that needs a graceful exit.
- BAD USE CASES: When no preloader is used (then this pattern is moot).
- FUNCTIONAL VALUE: Smooth handoff; prevents abrupt pop-in.
- EMOTIONAL VALUE: Resolution, "we're in."
- IMPLEMENTATION COMPLEXITY: low-medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low-medium (curtain must be removed from a11y tree after lift)
- MOBILE STRATEGY: Simple fade/slide; short.
- REDUCED MOTION STRATEGY: Instant remove, no slide.
- DEPENDENCIES: GSAP or CSS.
- PROVIDERS/LIBRARIES: GSAP, CSS clip-path/opacity
- BUSINESSFORGE CAPABILITY NAME: cap.entry.transition.content
- BLUEPRINT REPRESENTATION: {"capability":"cap.entry.transition.content","trigger":"load_complete","params":{"exit":"clip-inset","durationMs":700,"revealUnder":true},"fallback":{"reducedMotion":"instant","mobile":"fade"}}
- QA REQUIREMENTS: (1) Curtain removed from DOM/aria after lift; (2) content interactive immediately; (3) no scroll lock left on; (4) re-load stable.

---

# (next chunk continues with NAVIGATION / TRANSITIONS)
