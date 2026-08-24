# LAYOUT / SCROLL / TYPOGRAPHY TAXONOMY — Premium Digital Experiences (2025-2026)

**Deliverable:** Experience Capability Library — CONDITIONAL capabilities tied to business context (not Awwwards effect templates).
**Author role:** Research Director (subagent).
**Output language:** English. Research only — no repository code.

## METHODOLOGY & EVIDENCE HONESTY NOTE
- **browser_exec was unavailable** in this environment (the `browser-use` CLI crashed on import: `ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'`). Research was therefore conducted via **direct HTTP fetches** of authoritative sources plus reuse of an in-workspace research artifact that already contains real DOM/CSS evidence.
- **OBSERVED** = verified against live official docs or live-site DOM/CSS facts (cited URL). Sources fetched live:
  - MDN `animation-timeline` / `scroll()` / `view()` / `view-timeline`: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline and https://developer.mozilla.org/en-US/docs/Web/CSS/view-timeline
  - GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ (verified: `pin`, `scrub`, `snap`, `trigger`, `start`/`end`, timelines)
  - GSAP SplitText: https://gsap.com/docs/v3/Plugins/SplitText/ (verified: `type:"words,chars,lines"`, `mask`, `autoSplit`, staggered animation, screen-reader accessibility)
  - Lenis: https://github.com/darkroomengineering/lenis (README verified: dependency-free, runs on native scroll, smooth/lerp, parallax, WebGL scroll-sync)
  - Three.js docs: https://threejs.org/docs (WebGL/canvas context)
  - Awwwards directory: https://www.awwwards.com/
  - In-workspace teardown `AWWWARDS_PATTERN_LIBRARY.md`: real DOM/CSS facts + URLs from 25 live Awwwards-winning sites (mosbyfiles.com, nexola.framer.website, vectrfl.com, studiomodular.be, paysages.studio, obscurastudio.webflow.io, normalisboring.es, spur.us, dragonfly.xyz, vanmorrison.com, etc.)
- **INFERRED** = technique is well-established and attributed to named studio sites (Active Theory activetheory.com, Resn resn.co.nz, Dogstudio dogstudio.co, 14islands 14islands.com, Immersive Garden immersive-garden.com, Monogrid monogrid.com, Cuberto cuberto.com) but their live DOM could not be probed here; mechanism described from documented practice.
- **UNKNOWN** = used only where no reliable signal exists.
- Reference libraries also cited: Codrops https://tympanus.net/codrops/, Locomotive Scroll https://locomotivemtl.github.io/locomotive-scroll/, Webflow Interactions https://university.webflow.com/docs/intro-to-interactions-and-animations.

Each record below uses the mandated field set. "BusinessForge capability name" is `cap.<domain>.<name>`.

---

# LAYOUT

## PATTERN: Asymmetric Grid
- CATEGORY: layout
- USER EXPERIENCE: Content deliberately aligned off-center / to one side, creating tension and a bespoke, non-template feel while keeping a hidden structural order.
- TECHNICAL MECHANISM: CSS Grid with 12-col base (`grid-template-columns: repeat(12, minmax(0,1fr))`); items placed with `grid-column: 2 / 9` etc. Asymmetry lives *within* a grid, never without one. Performance: negligible (pure CSS).
- EXAMPLES: Awwwards teardown shows 12-col discipline at Alkares, 3e Étage, Obscura; 16-col at Dragonfly; breakout patterns at studio sites. URL: https://www.awwwards.com/ (P-008 in AWWWARDS_PATTERN_LIBRARY.md).
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: architect, photographer, hotel, artist, boutique studio, premium/editorial brands.
- GOOD USE CASES: brand/showcase sites wanting craft signal; portfolio index; editorial landing.
- BAD USE CASES: utilitarian booking/checkout flows, dense data UIs, local-trust SMB needing predictable alignment.
- FUNCTIONAL VALUE: guides eye via intentional imbalance; supports clear hierarchy without symmetry cliché.
- EMOTIONAL VALUE: confidence, sophistication, "this was designed, not templated."
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: medium (must not break reading order / source order vs visual order)
- MOBILE STRATEGY: collapse to single or 2-col; keep source order = visual order.
- REDUCED MOTION STRATEGY: N/A (static layout); ensure no layout shift on load.
- DEPENDENCIES: CSS Grid only.
- PROVIDERS/LIBRARIES: native CSS; GSAP for any reorder animation.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.asymmetric_grid
- BLUEPRINT REPRESENTATION: {"layout":"grid","cols":12,"placement":"asymmetric","rule":"asymmetry within grid","breakpoints":{"mobile":"1-2col"}}
- QA REQUIREMENTS: DOM tab-order matches visual; no horizontal overflow at 320px; contrast AA; Lighthouse layout-shift (CLS) < 0.1.

## PATTERN: Editorial Composition
- CATEGORY: layout
- USER EXPERIENCE: Magazine-like arrangement — large display headline, narrow measure body, pull quotes, image+caption pairings, generous margins; reading feels curated.
- TECHNICAL MECHANISM: CSS multi-column / grid + `max-width` measure (~60-75ch), `font-size: clamp()` fluid type, `::first-line`/`::first-letter` flourishes. Performance: low.
- EXAMPLES: Mosby Files (Signifier + IBM Plex Mono + Founders Grotesk editorial system), Normal Is Boring (Juana + Editorial New), Studio OL (Times New Roman + red accent). URL: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: publisher, journalist, law firm (positioning), architect, hotel, artist, agency.
- GOOD USE CASES: long-form narrative, thought-leadership, brand manifesto.
- BAD USE CASES: quick-task utility flows, dashboards.
- FUNCTIONAL VALUE: improves comprehension and dwell time for reading-heavy content.
- EMOTIONAL VALUE: authority, calm, craft.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (text-first is inherently accessible)
- MOBILE STRATEGY: single column, preserve measure (min 16px body), keep hierarchy.
- REDUCED MOTION STRATEGY: N/A; static is fine.
- DEPENDENCIES: CSS only.
- PROVIDERS/LIBRARIES: native CSS; optional variable fonts.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.editorial_composition
- BLUEPRINT REPRESENTATION: {"layout":"editorial","measure":"65ch","typeScale":"editorial","hierarchy":"display+body"}
- QA REQUIREMENTS: reading order logical; body >=16px; measure <=75ch; no overflow; AA contrast.

## PATTERN: Clipped Sections
- CATEGORY: layout
- USER EXPERIENCE: Sections cut by angled/rounded/custom `clip-path` edges so one block visually slices into the next, removing hard rectangular borders.
- TECHNICAL MECHANISM: CSS `clip-path: polygon()` / `path()` or `border-radius` on section containers; can be combined with scroll to animate the clip. Performance: low (composited if `transform`-bound).
- EXAMPLES: Studio sites (Cuberto, Immersive Garden) use clipped/angled section transitions. INFERRED from documented practice: https://cuberto.com/ , https://www.immersive-garden.com/
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: creative agency, fashion, event, youth/energy brands.
- GOOD USE CASES: differentiating section boundaries; dynamic feel.
- BAD USE CASES: trust-first finance/legal; content that must print cleanly.
- FUNCTIONAL VALUE: visual rhythm; separates sections without extra whitespace.
- EMOTIONAL VALUE: modern, energetic, designed.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (decorative clip; keep content box accessible)
- MOBILE STRATEGY: simplify clip (flatter angles) to avoid content cut-off.
- REDUCED MOTION STRATEGY: keep static clip shape; disable clip animation.
- DEPENDENCIES: CSS clip-path; optional GSAP for animated clip.
- PROVIDERS/LIBRARIES: native CSS; GSAP; Lenis for scroll-driven clip.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.clipped_sections
- BLUEPRINT REPRESENTATION: {"layout":"section","edge":"clip-path","shape":"polygon","animated":false}
- QA REQUIREMENTS: no content clipped/cut on desktop+mobile; focus outlines visible; AA contrast; no layout shift.

## PATTERN: Masked Sections
- CATEGORY: layout
- USER EXPERIENCE: A section is revealed through a shaped "window" (gradient mask, image mask, or text-shaped mask) so underlying content appears/disappears through that shape.
- TECHNICAL MECHANISM: CSS `mask-image` / `mask-composite`, or GSAP `mask:"lines"` (SplitText v3.13+) which wraps lines in overflow-hidden masks for reveal. Performance: medium (mask repaint cost on animation).
- EXAMPLES: GSAP SplitText `mask:"lines"` verified at https://gsap.com/docs/v3/Plugins/SplitText/ ; CSS `mask-image` per MDN.
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: agency, artist, luxury brand, product launch.
- GOOD USE CASES: elegant text/section reveals; hero transitions.
- BAD USE CASES: low-end devices; text that must be selectable/copyable (mask can complicate selection).
- FUNCTIONAL VALUE: controls reveal direction; hides overflow during animation.
- EMOTIONAL VALUE: refinement, surprise, craft.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (masked text must remain in accessibility tree / SR-readable)
- MOBILE STRATEGY: reduce mask complexity; ensure final state fully visible.
- REDUCED MOTION STRATEGY: show final unmasked state instantly.
- DEPENDENCIES: GSAP SplitText (mask) or CSS mask.
- PROVIDERS/LIBRARIES: GSAP; native CSS mask.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.masked_sections
- BLUEPRINT REPRESENTATION: {"layout":"section","reveal":"mask","maskType":"lines|gradient","finalState":"visible"}
- QA REQUIREMENTS: SR reads all text; final state visible without motion; no clipped focus; reduced-motion shows final.

## PATTERN: Overlapping Sections
- CATEGORY: layout
- USER EXPERIENCE: Two or more blocks intentionally overlap (image over text, sticky card over scrolling list) creating depth and density.
- TECHNICAL MECHANISM: CSS `position: relative/absolute` + `z-index`, negative margins, or `grid-area` overlap (placing multiple items in same grid cell). Performance: low.
- EXAMPLES: Awwwards editorial sites overlap imagery on type (Mosby, Studio OL). URL: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: editorial, photographer, architect, fashion, portfolio.
- GOOD USE CASES: art-directed hero; pairing image with statement.
- BAD USE CASES: dense data; mobile (overlap must resolve to stack).
- FUNCTIONAL VALUE: density + depth without extra height.
- EMOTIONAL VALUE: crafted, layered, intentional.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: medium (overlap must not hide interactive/focusable content)
- MOBILE STRATEGY: convert overlap to vertical stack.
- REDUCED MOTION STRATEGY: N/A (static overlap OK).
- DEPENDENCIES: CSS only.
- PROVIDERS/LIBRARIES: native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.overlapping_sections
- BLUEPRINT REPRESENTATION: {"layout":"overlap","layers":2,"stackMobile":true}
- QA REQUIREMENTS: no focusable element hidden behind overlap; no overflow; mobile stacks cleanly; AA contrast.

## PATTERN: Broken Grid
- CATEGORY: layout
- USER EXPERIENCE: Elements deliberately break the column rhythm — a title spills across columns, an image juts past the container edge, breaking the expected alignment.
- TECHNICAL MECHANISM: CSS Grid with explicit `grid-column: 1 / -1` bleed items, `transform: translateX()` offsets, or sub-grid breakouts. Performance: low.
- EXAMPLES: Awwwards "Asymmetric Editorial Grid with Breakouts" (P-008): https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: premium/editorial, artist, architect, agency.
- GOOD USE CASES: signature moments; one or two breakout blocks per page.
- BAD USE CASES: utilitarian flows; overuse (loses structure).
- FUNCTIONAL VALUE: creates memorable focal breakouts within order.
- EMOTIONAL VALUE: bespoke, confident, non-template.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: disable breakouts; snap to column.
- REDUCED MOTION STRATEGY: N/A.
- DEPENDENCIES: CSS Grid.
- PROVIDERS/LIBRARIES: native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.broken_grid
- BLUEPRINT REPRESENTATION: {"layout":"grid","breakout":"defined-variants","count":"1-2"}
- QA REQUIREMENTS: no horizontal scroll at 320px; CLS < 0.1; reading order intact.

## PATTERN: Full-bleed Content
- CATEGORY: layout
- USER EXPERIENCE: Media or color extends edge-to-edge of the viewport, ignoring the centered container — immersive, cinematic.
- TECHNICAL MECHANISM: `width: 100vw` / `grid-column: 1 / -1` inside a centered grid, or `margin-inline: calc(50% - 50vw)`. Performance: low; watch LCP on heavy media.
- EXAMPLES: Nexola (130px wordmark over full-bleed video), No Art (full-bleed video), Cinética (video hero). URL: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: hotel, photographer, restaurant, artist, fitness, brand.
- GOOD USE CASES: hero media; immersive section dividers.
- BAD USE CASES: text-heavy utility pages; reading content (keep measure).
- FUNCTIONAL VALUE: maximal impact for sensory businesses.
- EMOTIONAL VALUE: cinematic, premium, immersive.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: medium (media weight)
- ACCESSIBILITY RISK: low (ensure text-on-media has scrim + AA contrast)
- MOBILE STRATEGY: keep full-bleed but optimize media (poster, lazy).
- REDUCED MOTION STRATEGY: static poster frame instead of autoplay video.
- DEPENDENCIES: CSS; media optimization.
- PROVIDERS/LIBRARIES: native CSS; poster/`<video>` best practices.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.full_bleed
- BLUEPRINT REPRESENTATION: {"layout":"full-bleed","media":"video|image","scrim":true}
- QA REQUIREMENTS: text contrast on media AA; no horizontal overflow; LCP budget met; reduced-motion shows poster.

## PATTERN: Negative Space
- CATEGORY: layout
- USER EXPERIENCE: Abundant empty space around a few elements; the void becomes the design, signaling confidence and luxury.
- TECHNICAL MECHANISM: Large `padding`/`margin`, `min-height: 100vh` sections, narrow measure, `gap` in fl/grid. Performance: negligible.
- EXAMPLES: Awwwards teardown: "Whitespace is high across the board"; Paysages, Studio OL, Serotoninn high whitespace. URL: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: luxury, architect, hotel, photographer, law, artist.
- GOOD USE CASES: premium positioning; single-focus statements.
- BAD USE CASES: information-dense utility; low-end value perception.
- FUNCTIONAL VALUE: focuses attention; improves comprehension.
- EMOTIONAL VALUE: calm, expensive, confident.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: maintain padding ratio; avoid cramming.
- REDUCED MOTION STRATEGY: N/A.
- DEPENDENCIES: CSS only.
- PROVIDERS/LIBRARIES: native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.negative_space
- BLUEPRINT REPRESENTATION: {"layout":"spacious","minSectionVH":0.8,"measure":"narrow"}
- QA REQUIREMENTS: content not orphaned; no empty-scroll traps; AA contrast.

## PATTERN: Variable Containers
- CATEGORY: layout
- USER EXPERIENCE: Container max-width flexes with viewport (e.g., 1200px desktop but wider on ultrawide, narrower mid-breakpoint) instead of one fixed width.
- TECHNICAL MECHANISM: `width: min(92vw, 1400px)` or `clamp()` container; CSS container queries (`@container`) for component-level responsiveness. Performance: low.
- EXAMPLES: Standard modern responsive practice; CSS `clamp()`/container queries documented on MDN. INFERRED/OBSERVED: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline (responsive context), general CSS.
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: all (universal responsive lever).
- GOOD USE CASES: fluid layouts across device ranges; ultrawide utilization.
- BAD USE CASES: none major.
- FUNCTIONAL VALUE: optimal density per viewport; fewer hard breakpoints.
- EMOTIONAL VALUE: polished, intentional at every size.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: inherent (fluid).
- REDUCED MOTION STRATEGY: N/A.
- DEPENDENCIES: CSS clamp/container queries.
- PROVIDERS/LIBRARIES: native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.variable_containers
- BLUEPRINT REPRESENTATION: {"layout":"fluid-container","width":"min(92vw,1400px)","containerQueries":true}
- QA REQUIREMENTS: no overflow 320-2560px; text wraps; measure readable.

## PATTERN: Nested Scroll Areas
- CATEGORY: layout
- USER EXPERIENCE: An inner region scrolls independently of the page (e.g., a scrolling panel inside a fixed frame, or horizontal scroller inside vertical page).
- TECHNICAL MECHANISM: `overflow: auto` inner container with its own scroll; can pair with `scroll-snap`. Must coordinate with smooth-scroll libs (Lenis supports nested scroll via `data-lenis-prevent`). Performance: low-medium.
- EXAMPLES: Lenis supports nested/inner scroll regions (`data-lenis-prevent`): https://github.com/darkroomengineering/lenis
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: SaaS dashboards, maps, data tables, galleries, chat/log viewers.
- GOOD USE CASES: contain long secondary content without page bloat.
- BAD USE CASES: marketing pages (confusing scroll traps); avoid scroll-jacking.
- FUNCTIONAL VALUE: keeps context (frame) while exploring detail.
- EMOTIONAL VALUE: control, focus.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: high (nested scroll can trap keyboard focus; needs visible scroll affordance)
- MOBILE STRATEGY: often better to expand to page flow; use `data-lenis-prevent`.
- REDUCED MOTION STRATEGY: native scroll; no inertial animation.
- DEPENDENCIES: CSS overflow; Lenis (nested) optional.
- PROVIDERS/LIBRARIES: Lenis; native scroll-snap.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.nested_scroll
- BLUEPRINT REPRESENTATION: {"layout":"nested-scroll","innerOverflow":"auto","preventParent":true}
- QA REQUIREMENTS: keyboard can enter+exit inner region; focus visible; no scroll trap; mobile not awkward.

## PATTERN: Sticky Layouts
- CATEGORY: layout
- USER EXPERIENCE: A column/element stays fixed in view while adjacent content scrolls past (sticky sidebar, sticky media next to scrolling text).
- TECHNICAL MECHANISM: CSS `position: sticky; top: <val>` within a taller parent; requires parent height. Performance: low (composited).
- EXAMPLES: Common pattern; sticky media+text in editorial/product pages. OBSERVED in Awwwards product pages (Spur 14 sections). URL: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: product (features vs detail), docs, real-estate, long-form.
- GOOD USE CASES: pair persistent context with scrolling detail.
- BAD USE CASES: very short pages (nothing to scroll past).
- FUNCTIONAL VALUE: maintains orientation/context.
- EMOTIONAL VALUE: stable, guided.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: stack (sticky often disabled on small screens).
- REDUCED MOTION STRATEGY: N/A (static sticky OK).
- DEPENDENCIES: CSS position:sticky.
- PROVIDERS/LIBRARIES: native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.sticky
- BLUEPRINT REPRESENTATION: {"layout":"sticky","stickyEl":"sidebar|media","top":"24px"}
- QA REQUIREMENTS: sticky releases at parent end (no overlap footer); works keyboard; no overflow.

## PATTERN: Pinned Sections
- CATEGORY: layout
- USER EXPERIENCE: A section "sticks" full-screen while the user keeps scrolling, and inner content animates (pinned storytelling) before release.
- TECHNICAL MECHANISM: GSAP ScrollTrigger `pin: true` (verified) pins element through a scroll range; CSS alternative `position: sticky` + tall spacer. Performance: medium (pin spacing recalculation).
- EXAMPLES: GSAP ScrollTrigger `pin:true` verified: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: brand storytelling, product tours, agency case studies, luxury.
- GOOD USE CASES: guided sequential narrative; hero that holds while reveal plays.
- BAD USE CASES: content sites needing fast scan; mobile (disable or shorten).
- FUNCTIONAL VALUE: controls pacing; reveals sequence on scroll.
- EMOTIONAL VALUE: cinematic, deliberate,沉浸.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (must not trap; respect reduced-motion)
- MOBILE STRATEGY: disable pin or use shorter range; fallback to stacked.
- REDUCED MOTION STRATEGY: disable pin; show sections stacked statically.
- DEPENDENCIES: GSAP ScrollTrigger; or CSS sticky.
- PROVIDERS/LIBRARIES: GSAP; Locomotive Scroll (pin); native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.pinned_sections
- BLUEPRINT REPRESENTATION: {"layout":"pin","lib":"gsap","pin":true,"scrub":true,"mobile":false}
- QA REQUIREMENTS: pin release correct (no gap/overlap); no scroll trap; reduced-motion static; mobile fallback verified.

## PATTERN: Horizontal Sections
- CATEGORY: layout
- USER EXPERIENCE: Page scrolls vertically but a section translates horizontally (vertical scroll drives horizontal movement) — gallery or chapter strip.
- TECHNICAL MECHANISM: GSAP ScrollTrigger with `pin` + `x` translate tied to scroll (verified pattern: pin container, animate `xPercent` of inner track). Performance: medium (transform composited).
- EXAMPLES: GSAP horizontal-scroll demo (pin + x). URL: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: portfolio, gallery, product line, agency, fashion lookbook.
- GOOD USE CASES: many items in limited vertical space; cinematic browse.
- BAD USE CASES: content needing deep read; mobile (use swipe carousel).
- FUNCTIONAL VALUE: packs more browseable content per scroll.
- EMOTIONAL VALUE: dynamic, editorial, premium.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (needs keyboard/swipe fallback)
- MOBILE STRATEGY: convert to native horizontal swipe scroll-snap.
- REDUCED MOTION STRATEGY: disable scroll-hijack; use static swipeable row.
- DEPENDENCIES: GSAP ScrollTrigger; Lenis for smoothing.
- PROVIDERS/LIBRARIES: GSAP; Lenis; Locomotive.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.horizontal_sections
- BLUEPRINT REPRESENTATION: {"layout":"horizontal","lib":"gsap","pin":true,"axis":"x","mobile":"swipe"}
- QA REQUIREMENTS: keyboard arrows work; mobile swipe; reduced-motion static; no trap.

## PATTERN: Hybrid Scrolling
- CATEGORY: layout
- USER EXPERIENCE: Mixes vertical and horizontal and pinned moments within one page — e.g., vertical intro, then a horizontal chapter, then a pinned finale.
- TECHNICAL MECHANISM: Compose GSAP ScrollTrigger `pin` + `x` tracks + Lenis smooth scroll across sequential sections; each section declares its own scroll mode. Performance: medium-high.
- EXAMPLES: Active Theory, Resn, 14islands known for multi-mode scroll narratives. INFERRED: https://activetheory.com/ , https://14islands.com/
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: high-craft brand, agency showcase, product launch, immersive campaign.
- GOOD USE CASES: flagship experience sites with budget.
- BAD USE CASES: SMB, content/SEO sites, low perf budget.
- FUNCTIONAL VALUE: choreographs a multi-act experience.
- EMOTIONAL VALUE: spectacle, memorability.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: high
- ACCESSIBILITY RISK: high (many motion modes)
- MOBILE STRATEGY: drastically simplify; mostly vertical + swipe.
- REDUCED MOTION STRATEGY: linear static vertical; drop pins/horizontal.
- DEPENDENCIES: GSAP ScrollTrigger; Lenis; WebGL optional.
- PROVIDERS/LIBRARIES: GSAP; Lenis; Three.js (optional).
- BUSINESSFORGE CAPABILITY NAME: cap.layout.hybrid_scroll
- BLUEPRINT REPRESENTATION: {"layout":"hybrid","modes":["vertical","horizontal","pinned"],"mobile":"vertical"}
- QA REQUIREMENTS: each mode releases cleanly; no trap; reduced-motion linear; mobile simplified; perf budget.

## PATTERN: Infinite Canvas
- CATEGORY: layout
- USER EXPERIENCE: A boundless pan/zoom surface (2D/3D) where the user explores freely rather than scrolling a fixed page — map-like or WebGL world.
- TECHNICAL MECHANISM: WebGL/Canvas (Three.js, PixiJS) with camera pan/zoom + scroll/wheel/drag mapped to camera; often paired with Lenis for inertia. Performance: high (GPU).
- EXAMPLES: Three.js camera/controls: https://threejs.org/docs ; 14islands, Active Theory WebGL worlds. INFERRED: https://14islands.com/
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: Web3, data-viz, gaming, immersive brand, parametric architect.
- GOOD USE CASES: exploratory data/brand worlds; strong engineering capability.
- BAD USE CASES: trust-first SMB; SEO/content sites; low-end devices.
- FUNCTIONAL VALUE: free exploration of spatial information.
- EMOTIONAL VALUE: wonder, playground, cutting-edge.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: high
- ACCESSIBILITY RISK: high (non-linear; needs alt navigation)
- MOBILE STRATEGY: touch drag/pinch; provide linear fallback.
- REDUCED MOTION STRATEGY: disable auto-motion; static key view + links.
- DEPENDENCIES: Three.js / PixiJS; Lenis optional.
- PROVIDERS/LIBRARIES: Three.js; GSAP; Lenis.
- BUSINESSFORGE CAPABILITY NAME: cap.layout.infinite_canvas
- BLUEPRINT REPRESENTATION: {"layout":"canvas","engine":"threejs","nav":"pan-zoom","fallback":"linear"}
- QA REQUIREMENTS: reduced-motion + no-WebGL fallback exists; keyboard reachable content; perf (FPS) acceptable; no trap.

# SCROLL

## PATTERN: Reveal
- CATEGORY: scroll
- USER EXPERIENCE: Elements fade/slide/scale in as they enter the viewport, rewarding scroll with discovery.
- TECHNICAL MECHANISM: GSAP ScrollTrigger `toggleActions` or CSS `animation-timeline: view()` (MDN verified) with `animation-range`. Native CSS scroll-driven reveal needs no JS. Performance: low (transform/opacity).
- EXAMPLES: MDN `view()` reveal: https://developer.mozilla.org/en-US/docs/Web/CSS/view-timeline ; GSAP toggleActions: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: all (universal entrance animation).
- GOOD USE CASES: section entrances; image/card reveals.
- BAD USE CASES: above-the-fold LCP content (reveal delays perception -> hurts LCP).
- FUNCTIONAL VALUE: paces content; draws attention to new content.
- EMOTIONAL VALUE: polish, liveliness.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (if content present without motion)
- MOBILE STRATEGY: keep; lighter distances.
- REDUCED MOTION STRATEGY: show final state immediately (no transform).
- DEPENDENCIES: GSAP ScrollTrigger or CSS view().
- PROVIDERS/LIBRARIES: GSAP; native CSS scroll-driven animations.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.reveal
- BLUEPRINT REPRESENTATION: {"scroll":"reveal","trigger":"view()","props":["opacity","y"],"range":"entry"}
- QA REQUIREMENTS: content visible without JS (progressive enhancement); reduced-motion shows final; no LCP regression; no overflow.

## PATTERN: Stagger
- CATEGORY: scroll
- USER EXPERIENCE: A group of items animates sequentially (one after another) on scroll-in, creating rhythm.
- TECHNICAL MECHANISM: GSAP `stagger` (verified) on ScrollTrigger batch; CSS alternative with `animation-delay` per child. Performance: low-medium (many elements).
- EXAMPLES: GSAP ScrollTrigger + `stagger`: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: galleries, feature lists, team grids, product cards.
- GOOD USE CASES: lists/grids entrance; "cascade" feel.
- BAD USE CASES: huge lists (thousands) -> perf; above-fold LCP.
- FUNCTIONAL VALUE: sequences information; guides scan order.
- EMOTIONAL VALUE: choreography, delight.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: reduce stagger count/distance.
- REDUCED MOTION STRATEGY: all items visible at once.
- DEPENDENCIES: GSAP; or CSS delays.
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.stagger
- BLUEPRINT REPRESENTATION: {"scroll":"stagger","targets":"children","step":0.08,"trigger":"view()"}
- QA REQUIREMENTS: all items reachable/visible; reduced-motion instant; no layout shift; perf with large lists.

## PATTERN: Text Reveal
- CATEGORY: scroll
- USER EXPERIENCE: Headlines/paragraphs reveal line-by-line or word-by-word as they scroll into view (often masked).
- TECHNICAL MECHANISM: GSAP SplitText `type:"lines,words"` + `mask:"lines"` + ScrollTrigger (verified at https://gsap.com/docs/v3/Plugins/SplitText/ and ScrollTrigger). Performance: medium (split DOM + animation).
- EXAMPLES: GSAP SplitText masked line reveal: https://gsap.com/docs/v3/Plugins/SplitText/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: editorial, agency, artist, luxury brand, manifesto.
- GOOD USE CASES: hero statements; section intros.
- BAD USE CASES: body copy (annoying); above-fold LCP text.
- FUNCTIONAL VALUE: dramatic entrance for key copy.
- EMOTIONAL VALUE: craft, suspense, premium.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (ensure SR reads full text; SplitText has SR accessibility)
- MOBILE STRATEGY: simpler (word or whole-line) reveal; shorter.
- REDUCED MOTION STRATEGY: show full text instantly.
- DEPENDENCIES: GSAP SplitText + ScrollTrigger.
- PROVIDERS/LIBRARIES: GSAP.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.text_reveal
- BLUEPRINT REPRESENTATION: {"scroll":"text-reveal","split":"lines,words","mask":true,"trigger":"view()"}
- QA REQUIREMENTS: SR reads complete text; final state visible; reduced-motion instant; no layout shift on split.

## PATTERN: Kinetic Typography (scroll-driven)
- CATEGORY: scroll
- USER EXPERIENCE: Type moves/transforms in response to scroll — words slide, rotate, or assemble as you scroll.
- TECHNICAL MECHANISM: GSAP ScrollTrigger `scrub` tied to SplitText chars/words (verified ScrollTrigger + SplitText). CSS `animation-timeline: scroll()` can also drive type transforms. Performance: medium.
- EXAMPLES: GSAP ScrollTrigger scrub + SplitText: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ , https://gsap.com/docs/v3/Plugins/SplitText/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: creative agency, artist, brand campaign, music/entertainment.
- GOOD USE CASES: hero type choreography; scroll-linked statements.
- BAD USE CASES: body text; trust-first/legal; above-fold LCP.
- FUNCTIONAL VALUE: makes scroll feel responsive to content.
- EMOTIONAL VALUE: energy, playfulness, modernity.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (motion on type)
- MOBILE STRATEGY: reduce intensity; simpler transforms.
- REDUCED MOTION STRATEGY: static type; no scrub motion.
- DEPENDENCIES: GSAP ScrollTrigger + SplitText; or CSS scroll().
- PROVIDERS/LIBRARIES: GSAP; native CSS scroll-driven.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.kinetic_type
- BLUEPRINT REPRESENTATION: {"scroll":"kinetic-type","lib":"gsap","scrub":true,"split":"chars"}
- QA REQUIREMENTS: reduced-motion static; SR readable; no LCP hit; perf ok.

## PATTERN: Parallax
- CATEGORY: scroll
- USER EXPERIENCE: Background and foreground move at different speeds during scroll, creating depth.
- TECHNICAL MECHANISM: Lenis "parallax effects" (verified in README: https://github.com/darkroomengineering/lenis); GSAP ScrollTrigger `y`/`yPercent` with different rates. CSS `translateZ` + `perspective` for true 3D parallax. Performance: low-medium.
- EXAMPLES: Lenis parallax: https://github.com/darkroomengineering/lenis ; GSAP: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: photographer, hotel, travel, brand, portfolio.
- GOOD USE CASES: hero depth; section immersion.
- BAD USE CASES: dense/text-heavy; can cause nausea if extreme.
- FUNCTIONAL VALUE: depth cue; visual interest.
- EMOTIONAL VALUE: depth, immersion, cinematic.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: reduce intensity (or disable on low-end); respect reduced-motion.
- REDUCED MOTION STRATEGY: disable parallax (static layers).
- DEPENDENCIES: Lenis; GSAP; or CSS perspective.
- PROVIDERS/LIBRARIES: Lenis; GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.parallax
- BLUEPRINT REPRESENTATION: {"scroll":"parallax","layers":["bg","fg"],"rates":[0.3,1]}
- QA REQUIREMENTS: reduced-motion static; no layout shift; perf (no jank); content not hidden.

## PATTERN: Depth Layers
- CATEGORY: scroll
- USER EXPERIENCE: Multiple z-positioned layers (foreground, mid, background) move/scale at distinct rates, building a 3D scene on scroll.
- TECHNICAL MECHANISM: Combine parallax + `scale` + `translateZ`/`perspective`; often WebGL (Three.js) with layered planes. Performance: medium-high.
- EXAMPLES: 14islands, Immersive Garden layered WebGL scenes. INFERRED: https://14islands.com/ , https://www.immersive-garden.com/
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: immersive brand, Web3, product hero, agency.
- GOOD USE CASES: rich hero worlds; storytelling scenes.
- BAD USE CASES: content/SEO sites; low perf budget.
- FUNCTIONAL VALUE: conveys spatial narrative.
- EMOTIONAL VALUE: wonder, depth, premium.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: high
- ACCESSIBILITY RISK: medium
- MOBILE STRATEGY: reduce layers; fallback static.
- REDUCED MOTION STRATEGY: flatten to single static layer.
- DEPENDENCIES: GSAP; Three.js; Lenis.
- PROVIDERS/LIBRARIES: GSAP; Three.js; Lenis.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.depth_layers
- BLUEPRINT REPRESENTATION: {"scroll":"depth","layers":3,"engine":"gsap|three","mobile":"reduced"}
- QA REQUIREMENTS: reduced-motion flat; no WebGL trap; perf FPS; fallback.

## PATTERN: Scale
- CATEGORY: scroll
- USER EXPERIENCE: Elements grow or shrink as you scroll (e.g., image zooms into focus, card expands).
- TECHNICAL MECHANISM: GSAP ScrollTrigger `scale` (scrub or toggle). CSS `animation-timeline: view()` can scale on entry. Performance: low (transform composited).
- EXAMPLES: GSAP ScrollTrigger scale: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: product, portfolio, brand, photographer.
- GOOD USE CASES: focus pull; hero zoom; emphasis.
- BAD USE CASES: text scaling (readability); extreme zoom.
- FUNCTIONAL VALUE: directs attention via size.
- EMOTIONAL VALUE: drama, focus.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: keep subtle.
- REDUCED MOTION STRATEGY: static final scale.
- DEPENDENCIES: GSAP; or CSS view().
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.scale
- BLUEPRINT REPRESENTATION: {"scroll":"scale","prop":"scale","range":"scrub"}
- QA REQUIREMENTS: reduced-motion static; no overflow from scale; perf.

## PATTERN: Rotation
- CATEGORY: scroll
- USER EXPERIENCE: Elements rotate as you scroll (e.g., a badge spins, a word tilts into place).
- TECHNICAL MECHANISM: GSAP ScrollTrigger `rotation` (scrub/toggle) or CSS `animation-timeline: scroll()` driving `rotate()`. Performance: low.
- EXAMPLES: GSAP ScrollTrigger rotation: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: playful brands, product, badge/logo moments, editorial.
- GOOD USE CASES: decorative spin; progress indicators; accent motion.
- BAD USE CASES: body text rotation (unreadable); trust-first.
- FUNCTIONAL VALUE: adds life; can encode progress.
- EMOTIONAL VALUE: playfulness, energy.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: keep subtle.
- REDUCED MOTION STRATEGY: static angle.
- DEPENDENCIES: GSAP; or CSS scroll().
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.rotation
- BLUEPRINT REPRESENTATION: {"scroll":"rotation","prop":"rotate","scrub":true}
- QA REQUIREMENTS: reduced-motion static; no readability harm; perf.

## PATTERN: Clip-path Reveal
- CATEGORY: scroll
- USER EXPERIENCE: A shape (circle, wedge, diagonal) wipes open to reveal content as you scroll.
- TECHNICAL MECHANISM: Animate CSS `clip-path` (polygon/circle/inset) via GSAP ScrollTrigger scrub, or CSS `animation-timeline: view()`. Performance: medium (clip repaint).
- EXAMPLES: GSAP clip-path scrub (standard technique); MDN clip-path. INFERRED/OBSERVED: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: agency, fashion, artist, product launch.
- GOOD USE CASES: dramatic section reveals; image reveals.
- BAD USE CASES: text-heavy; low-end.
- FUNCTIONAL VALUE: directional reveal control.
- EMOTIONAL VALUE: modern, surprising.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: low-medium (ensure final fully visible)
- MOBILE STRATEGY: simpler shape; shorter.
- REDUCED MOTION STRATEGY: final revealed state instantly.
- DEPENDENCIES: GSAP; or CSS view().
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.clip_path_reveal
- BLUEPRINT REPRESENTATION: {"scroll":"clip-reveal","shape":"polygon|circle","scrub":true}
- QA REQUIREMENTS: final state fully visible; reduced-motion instant; no content clipped.

## PATTERN: Mask Reveal
- CATEGORY: scroll
- USER EXPERIENCE: Content appears through a moving mask (gradient wipe, iris, or shape) as you scroll.
- TECHNICAL MECHANISM: Animate CSS `mask-image`/`mask-position` or `clip-path` via GSAP ScrollTrigger scrub; or use SplitText `mask:"lines"` for text. Performance: medium.
- EXAMPLES: GSAP SplitText mask + ScrollTrigger: https://gsap.com/docs/v3/Plugins/SplitText/ ; CSS mask: MDN.
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: agency, artist, luxury, product.
- GOOD USE CASES: elegant reveals; image/text wipes.
- BAD USE CASES: low-end; text selection needs care.
- FUNCTIONAL VALUE: directional, controlled reveal.
- EMOTIONAL VALUE: refinement, surprise.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (masked content must be in a11y tree)
- MOBILE STRATEGY: simpler mask; ensure final visible.
- REDUCED MOTION STRATEGY: final state instantly.
- DEPENDENCIES: GSAP; or CSS mask.
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.mask_reveal
- BLUEPRINT REPRESENTATION: {"scroll":"mask-reveal","mask":"gradient|lines","scrub":true}
- QA REQUIREMENTS: SR reads content; final visible; reduced-motion instant; no clipped focus.

## PATTERN: Pinned Storytelling
- CATEGORY: scroll
- USER EXPERIENCE: A section pins and a multi-step narrative plays (text/imagery/numbers change) as the user scrolls through its range.
- TECHNICAL MECHANISM: GSAP ScrollTrigger `pin:true` + `scrub` on a Timeline with labels (verified pattern: https://gsap.com/docs/v3/Plugins/ScrollTrigger); each label = story beat. Performance: medium.
- EXAMPLES: GSAP pinned timeline: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: brand story, product tour, case study, nonprofit impact.
- GOOD USE CASES: guided sequential narrative; hero that holds.
- BAD USE CASES: scan-oriented content; mobile (shorten/disable).
- FUNCTIONAL VALUE: paces a story to scroll; high recall.
- EMOTIONAL VALUE: cinematic, deliberate, memorable.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (no trap; reduced-motion)
- MOBILE STRATEGY: disable pin/scrub; stacked static beats.
- REDUCED MOTION STRATEGY: static stacked beats; no pin.
- DEPENDENCIES: GSAP ScrollTrigger.
- PROVIDERS/LIBRARIES: GSAP; Lenis.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.pinned_story
- BLUEPRINT REPRESENTATION: {"scroll":"pinned-story","pin":true,"scrub":true,"beats":4,"mobile":false}
- QA REQUIREMENTS: pin release clean; beats all visible without motion; reduced-motion static; mobile fallback.

## PATTERN: Scroll-scrubbing Video
- CATEGORY: scroll
- USER EXPERIENCE: A video plays forward/backward in lockstep with scroll position (not autoplay) — e.g., a product assembling as you scroll.
- TECHNICAL MECHANISM: Map ScrollTrigger progress -> `video.currentTime = progress * duration` (video preloaded, `muted`, `playsInline`). Performance: medium (decode cost).
- EXAMPLES: Apple-style scroll-scrubbed video technique (well-documented); GSAP ScrollTrigger progress. INFERRED/OBSERVED: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: product (auto, fashion, tech), architecture process, manufacturing.
- GOOD USE CASES: show a process/transformation tied to scroll.
- BAD USE CASES: low bandwidth; mobile data; above-fold LCP.
- FUNCTIONAL VALUE: interactive "scrubbable" explanation.
- EMOTIONAL VALUE: control, tactility, premium.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: high
- ACCESSIBILITY RISK: medium (provide poster + reduced-motion static)
- MOBILE STRATEGY: lighter/compressed video or static fallback.
- REDUCED MOTION STRATEGY: show representative frame/poster; no scrub.
- DEPENDENCIES: GSAP ScrollTrigger; `<video>` preload.
- PROVIDERS/LIBRARIES: GSAP; native `<video>`.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.scrub_video
- BLUEPRINT REPRESENTATION: {"scroll":"scrub-video","bind":"currentTime","muted":true,"reduced":"poster"}
- QA REQUIREMENTS: reduced-motion shows poster; video loads; no jank; mobile lightweight; controls/alt.

## PATTERN: Frame-by-frame Sequences
- CATEGORY: scroll
- USER EXPERIENCE: A canvas/image swaps through hundreds of pre-rendered frames as you scroll, simulating 3D rotation or morph.
- TECHNICAL MECHANISM: ScrollTrigger progress -> swap `<img>` src or draw frame on canvas from a sprite-sheet; preload frames. Performance: high (memory/IO).
- EXAMPLES: Common in premium product sites (Apple AirPods/Mac scroll sequences); studio sites. INFERRED: https://activetheory.com/ , https://dogstudio.co/
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: product (hardware, automotive), 3D showcase, brand.
- GOOD USE CASES: photoreal 360/product spin tied to scroll.
- BAD USE CASES: low bandwidth; many low-value frames; mobile.
- FUNCTIONAL VALUE: scroll-controlled 3D-like inspection.
- EMOTIONAL VALUE: realism, control, premium.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: high
- ACCESSIBILITY RISK: medium (static fallback needed)
- MOBILE STRATEGY: fewer frames / lower res / static.
- REDUCED MOTION STRATEGY: static hero frame.
- DEPENDENCIES: GSAP ScrollTrigger; frame assets.
- PROVIDERS/LIBRARIES: GSAP; canvas.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.frame_sequence
- BLUEPRINT REPRESENTATION: {"scroll":"frame-seq","frames":120,"bind":"index","reduced":"static"}
- QA REQUIREMENTS: reduced-motion static; frames preload; no jank; mobile lighter; alt text.

## PATTERN: Scroll-linked State
- CATEGORY: scroll
- USER EXPERIENCE: UI state changes with scroll — active nav item, theme shift, progress-dependent class toggles.
- TECHNICAL MECHANISM: GSAP ScrollTrigger `onUpdate`/`onToggle` or CSS `animation-timeline: scroll()` to set CSS custom properties / `data-*` state. Performance: low.
- EXAMPLES: GSAP ScrollTrigger callbacks: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: docs, long pages, product, editorial with section nav.
- GOOD USE CASES: active-section nav; scroll-linked theme; progress UI.
- BAD USE CASES: none major.
- FUNCTIONAL VALUE: orients user; reflects position.
- EMOTIONAL VALUE: responsiveness, control.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low
- MOBILE STRATEGY: keep (light).
- REDUCED MOTION STRATEGY: state still updates (no motion needed).
- DEPENDENCIES: GSAP; or CSS scroll().
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.linked_state
- BLUEPRINT REPRESENTATION: {"scroll":"linked-state","bind":"active-section|theme","lib":"gsap"}
- QA REQUIREMENTS: state correct at all positions; keyboard nav still works; reduced-motion fine.

## PATTERN: Scroll Progress
- CATEGORY: scroll
- USER EXPERIENCE: A progress indicator (bar/percentage) reflects how far down the page you are.
- TECHNICAL MECHANISM: CSS `animation-timeline: scroll()` driving a `scaleX` bar (MDN verified `scroll()`), or GSAP ScrollTrigger `progress`. Performance: low.
- EXAMPLES: MDN `scroll()` progress bar: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: long-form, docs, articles, reports, blogs.
- GOOD USE CASES: orientation on long pages.
- BAD USE CASES: very short pages (trivial).
- FUNCTIONAL VALUE: orientation / completion cue.
- EMOTIONAL VALUE: control, sense of progress.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (decorative; pair with aria)
- MOBILE STRATEGY: keep (thin bar).
- REDUCED MOTION STRATEGY: still works (no motion).
- DEPENDENCIES: CSS scroll() or GSAP.
- PROVIDERS/LIBRARIES: native CSS; GSAP.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.progress
- BLUEPRINT REPRESENTATION: {"scroll":"progress","indicator":"bar","bind":"scroll()"}
- QA REQUIREMENTS: accurate 0-100%; no layout shift; reduced-motion fine; aria-label.

## PATTERN: Horizontal Scroll (scroll-driven)
- CATEGORY: scroll
- USER EXPERIENCE: Vertical scroll input moves content horizontally (see also Layout > Horizontal Sections).
- TECHNICAL MECHANISM: GSAP ScrollTrigger pin + `x`/`xPercent` of an inner track tied to scroll (verified): https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: gallery, portfolio, product line, lookbook.
- GOOD USE CASES: browse many items in little vertical space.
- BAD USE CASES: deep-read content; mobile (use swipe).
- FUNCTIONAL VALUE: compact browse; cinematic.
- EMOTIONAL VALUE: dynamic, editorial.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (keyboard/swipe fallback)
- MOBILE STRATEGY: native swipe scroll-snap.
- REDUCED MOTION STRATEGY: static swipeable row.
- DEPENDENCIES: GSAP ScrollTrigger; Lenis.
- PROVIDERS/LIBRARIES: GSAP; Lenis.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.horizontal
- BLUEPRINT REPRESENTATION: {"scroll":"horizontal","pin":true,"axis":"x","mobile":"swipe"}
- QA REQUIREMENTS: keyboard works; mobile swipe; reduced-motion static; no trap.

## PATTERN: Sticky Transitions
- CATEGORY: scroll
- USER EXPERIENCE: A sticky element crossfades/swaps content as new sections pass (e.g., sticky phone showing app screens).
- TECHNICAL MECHANISM: `position: sticky` element + ScrollTrigger toggling opacity/state per passing section; or CSS `view()`-driven crossfade. Performance: low-medium.
- EXAMPLES: Sticky + ScrollTrigger state swap (standard). OBSERVED: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: product (app screens), feature explainers, real-estate.
- GOOD USE CASES: step-through feature demo pinned in view.
- BAD USE CASES: short pages; mobile (stack).
- FUNCTIONAL VALUE: holds demo while detail scrolls.
- EMOTIONAL VALUE: guided, modern.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low-medium
- MOBILE STRATEGY: stack vertically.
- REDUCED MOTION STRATEGY: static stacked states.
- DEPENDENCIES: CSS sticky; GSAP optional.
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.scroll.sticky_transitions
- BLUEPRINT REPRESENTATION: {"scroll":"sticky-transition","sticky":true,"swap":"state","mobile":"stack"}
- QA REQUIREMENTS: all states reachable; reduced-motion static; mobile stacks; no overlap.

---

# TYPOGRAPHY

## PATTERN: Kinetic Typography
- CATEGORY: typography
- USER EXPERIENCE: Type itself becomes the motion design — words slide, scramble, assemble, or react to cursor/scroll.
- TECHNICAL MECHANISM: GSAP + SplitText (chars/words) with ScrollTrigger or pointer events; CSS `animation-timeline: scroll()` for scroll-driven type. Performance: medium.
- EXAMPLES: GSAP SplitText + ScrollTrigger: https://gsap.com/docs/v3/Plugins/SplitText/ , https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: creative agency, artist, music/entertainment, brand campaign.
- GOOD USE CASES: hero statements; section titles; interactive moments.
- BAD USE CASES: body copy; trust-first/legal; LCP text.
- FUNCTIONAL VALUE: makes copy memorable; interactive.
- EMOTIONAL VALUE: energy, play, modernity.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (keep SR-readable; reduced-motion)
- MOBILE STRATEGY: reduce intensity.
- REDUCED MOTION STRATEGY: static type.
- DEPENDENCIES: GSAP SplitText + ScrollTrigger; or CSS.
- PROVIDERS/LIBRARIES: GSAP; native CSS.
- BUSINESSFORGE CAPABILITY NAME: cap.type.kinetic
- BLUEPRINT REPRESENTATION: {"type":"kinetic","split":"chars,words","trigger":"scroll|pointer"}
- QA REQUIREMENTS: SR reads full text; reduced-motion static; no LCP hit; perf.

## PATTERN: Variable Font Animation
- CATEGORY: typography
- USER EXPERIENCE: A typeface's weight/width/slant/optical-size animates (e.g., headline goes from thin to black as you scroll).
- TECHNICAL MECHANISM: Animate CSS `font-variation-settings` (e.g., `'wght' 100->900`) via GSAP or CSS `animation-timeline: scroll()`; requires a variable font. Performance: low-medium (font interpolation).
- EXAMPLES: Variable fonts + animation (MDN `font-variation-settings`); GSAP tween of variation settings. OBSERVED (technique documented): https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: brand, editorial, product with custom variable font.
- GOOD USE CASES: expressive headers; scroll-linked weight.
- BAD USE CASES: body text (jarring); non-variable fonts.
- FUNCTIONAL VALUE: single font yields many expressions.
- EMOTIONAL VALUE: living type, sophistication.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low-medium (ensure final legible)
- MOBILE STRATEGY: keep subtle; avoid heavy axes.
- REDUCED MOTION STRATEGY: static weight.
- DEPENDENCIES: variable font file; GSAP or CSS.
- PROVIDERS/LIBRARIES: GSAP; native CSS; variable-font CDNs (Google Fonts).
- BUSINESSFORGE CAPABILITY NAME: cap.type.variable_font
- BLUEPRINT REPRESENTATION: {"type":"variable-font","axes":["wght"],"bind":"scroll","reduced":"static"}
- QA REQUIREMENTS: reduced-motion static; final legible; font loads (FOUT handled); perf.

## PATTERN: Text Splitting (SplitText)
- CATEGORY: typography
- USER EXPERIENCE: Headlines/paragraphs are programmatically split into lines/words/chars so each unit can be animated independently.
- TECHNICAL MECHANISM: GSAP SplitText `SplitText.create(el, {type:"lines,words,chars", mask, autoSplit})` (verified): https://gsap.com/docs/v3/Plugins/SplitText/ — includes SR accessibility, responsive re-split.
- EXAMPLES: GSAP SplitText API (verified): https://gsap.com/docs/v3/Plugins/SplitText/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: editorial, agency, artist, brand.
- GOOD USE CASES: any staggered/reveal text animation.
- BAD USE CASES: very long body (cost); LCP text.
- FUNCTIONAL VALUE: enables granular text animation.
- EMOTIONAL VALUE: craft, precision.
- IMPLEMENTATION COMPLEXITY: low-medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (must keep SR reading order)
- MOBILE STRATEGY: re-split on resize (autoSplit).
- REDUCED MOTION STRATEGY: show unsplit final text.
- DEPENDENCIES: GSAP SplitText.
- PROVIDERS/LIBRARIES: GSAP.
- BUSINESSFORGE CAPABILITY NAME: cap.type.splittext
- BLUEPRINT REPRESENTATION: {"type":"split","type":"lines,words,chars","mask":true,"autoSplit":true}
- QA REQUIREMENTS: SR reads full text; final visible; reduced-motion instant; no layout shift on split.

## PATTERN: Character Animation
- CATEGORY: typography
- USER EXPERIENCE: Individual letters animate (rise, scatter, color, rotate) — highly granular kinetic type.
- TECHNICAL MECHANISM: GSAP SplitText `chars` + `stagger` + ScrollTrigger (verified): https://gsap.com/docs/v3/Plugins/SplitText/
- EXAMPLES: GSAP SplitText chars (verified): https://gsap.com/docs/v3/Plugins/SplitText/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: artist, brand, entertainment, creative agency.
- GOOD USE CASES: hero wordmarks; logotypes; accents.
- BAD USE CASES: body; trust-first; LCP.
- FUNCTIONAL VALUE: max granular expression.
- EMOTIONAL VALUE: playfulness, delight, craft.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium
- MOBILE STRATEGY: shorter distance; fewer chars animated.
- REDUCED MOTION STRATEGY: static.
- DEPENDENCIES: GSAP SplitText + ScrollTrigger.
- PROVIDERS/LIBRARIES: GSAP.
- BUSINESSFORGE CAPABILITY NAME: cap.type.char_animation
- BLUEPRINT REPRESENTATION: {"type":"char-anim","split":"chars","stagger":0.03,"trigger":"view()"}
- QA REQUIREMENTS: SR readable; reduced-motion static; perf with many chars.

## PATTERN: Word Animation
- CATEGORY: typography
- USER EXPERIENCE: Whole words animate in sequence (fade/rise/highlight) — coarser than char, calmer than line.
- TECHNICAL MECHANISM: GSAP SplitText `words` + `stagger` + ScrollTrigger (verified): https://gsap.com/docs/v3/Plugins/SplitText/
- EXAMPLES: GSAP SplitText words (verified): https://gsap.com/docs/v3/Plugins/SplitText/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: editorial, agency, brand, manifesto.
- GOOD USE CASES: statement reveals; emphasis on key words.
- BAD USE CASES: body copy; LCP.
- FUNCTIONAL VALUE: readable yet animated emphasis.
- EMOTIONAL VALUE: rhythm, emphasis, craft.
- IMPLEMENTATION COMPLEXITY: low-medium
- PERFORMANCE COST: low-medium
- ACCESSIBILITY RISK: medium
- MOBILE STRATEGY: keep; shorter.
- REDUCED MOTION STRATEGY: static.
- DEPENDENCIES: GSAP SplitText + ScrollTrigger.
- PROVIDERS/LIBRARIES: GSAP.
- BUSINESSFORGE CAPABILITY NAME: cap.type.word_animation
- BLUEPRINT REPRESENTATION: {"type":"word-anim","split":"words","stagger":0.06}
- QA REQUIREMENTS: SR readable; reduced-motion static; no LCP hit.

## PATTERN: Line Animation
- CATEGORY: typography
- USER EXPERIENCE: Lines of text reveal sequentially, often masked (each line wipes up from behind a mask).
- TECHNICAL MECHANISM: GSAP SplitText `lines` + `mask:"lines"` + ScrollTrigger (verified): https://gsap.com/docs/v3/Plugins/SplitText/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: editorial, luxury, agency, artist.
- GOOD USE CASES: elegant headline/paragraph reveals.
- BAD USE CASES: single-line; body; LCP.
- FUNCTIONAL VALUE: ordered, elegant reveal.
- EMOTIONAL VALUE: refinement, suspense.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium
- MOBILE STRATEGY: keep; re-split on resize.
- REDUCED MOTION STRATEGY: static full text.
- DEPENDENCIES: GSAP SplitText + ScrollTrigger.
- PROVIDERS/LIBRARIES: GSAP.
- BUSINESSFORGE CAPABILITY NAME: cap.type.line_animation
- BLUEPRINT REPRESENTATION: {"type":"line-anim","split":"lines","mask":true,"trigger":"view()"}
- QA REQUIREMENTS: SR reads full text; reduced-motion static; no shift on split.

## PATTERN: Morphing Text
- CATEGORY: typography
- USER EXPERIENCE: One word/phrase morphs into another (shape tween between letterforms) on interaction or scroll.
- TECHNICAL MECHANISM: SVG `<text>` path morph (flubber/GSAP MorphSVG) or variable-font interpolation; or crossfade between two SplitText states. Performance: medium.
- EXAMPLES: Studio sites use type morphing (Cuberto, Active Theory). INFERRED: https://cuberto.com/ , https://activetheory.com/
- EVIDENCE LEVEL: INFERRED
- BUSINESS CONTEXTS: brand, creative agency, product name changes.
- GOOD USE CASES: concept transitions (e.g., problem -> solution word).
- BAD USE CASES: body; trust-first; readability.
- FUNCTIONAL VALUE: conveys transformation.
- EMOTIONAL VALUE: surprise, cleverness.
- IMPLEMENTATION COMPLEXITY: high
- PERFORMANCE COST: medium
- ACCESSIBILITY RISK: medium (final state readable)
- MOBILE STRATEGY: simpler morph/crossfade.
- REDUCED MOTION STRATEGY: instant swap, no tween.
- DEPENDENCIES: GSAP MorphSVG/flubber; or variable font.
- PROVIDERS/LIBRARIES: GSAP; flubber; variable fonts.
- BUSINESSFORGE CAPABILITY NAME: cap.type.morph
- BLUEPRINT REPRESENTATION: {"type":"morph","from":"A","to":"B","method":"svg|varfont"}
- QA REQUIREMENTS: reduced-motion instant swap; both states readable; perf.

## PATTERN: Responsive Typography
- CATEGORY: typography
- USER EXPERIENCE: Type scales fluidly across viewport sizes — no jarring jumps at breakpoints.
- TECHNICAL MECHANISM: CSS `font-size: clamp(min, preferred-vw, max)` and `calc()`; fluid type scale (e.g., Utopia). Performance: negligible.
- EXAMPLES: Awwwards sites use clamp() for oversized type (e.g., 117px->16px). OBSERVED: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: all (universal).
- GOOD USE CASES: any site needing smooth scaling.
- BAD USE CASES: none.
- FUNCTIONAL VALUE: legibility + impact at every size.
- EMOTIONAL VALUE: polish, intentionality.
- IMPLEMENTATION COMPLEXITY: low
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: low (ensure min size floor, e.g., 16px body)
- MOBILE STRATEGY: inherent (fluid).
- REDUCED MOTION STRATEGY: N/A.
- DEPENDENCIES: CSS clamp/calc.
- PROVIDERS/LIBRARIES: native CSS; fluid-type tools.
- BUSINESSFORGE CAPABILITY NAME: cap.type.responsive
- BLUEPRINT REPRESENTATION: {"type":"responsive","body":"clamp(16px,1vw,18px)","display":"clamp(40px,8vw,150px)"}
- QA REQUIREMENTS: no overflow 320-2560px; body >=16px; measure readable; no tiny text.

## PATTERN: Typography as Navigation
- CATEGORY: typography
- USER EXPERIENCE: Large type itself is the menu — oversized nav items that animate/hover, sometimes replacing the hero.
- TECHNICAL MECHANISM: Big type nav with hover/scroll states (GSAP for hover reveal, Lenis for smooth); often a fullscreen type overlay menu. Performance: low.
- EXAMPLES: Awwwards sites with text nav (full text nav at Mosby, Normal Is Boring, No Art). OBSERVED: https://www.awwwards.com/
- EVIDENCE LEVEL: OBSERVED
- BUSINESS CONTEXTS: creative/editorial brands, portfolios, agencies, artists.
- GOOD USE CASES: brand-led nav; minimal sites.
- BAD USE CASES: complex IA (>7 items); local-trust needing persistent contact.
- FUNCTIONAL VALUE: merges identity + wayfinding.
- EMOTIONAL VALUE: bold, confident, editorial.
- IMPLEMENTATION COMPLEXITY: medium
- PERFORMANCE COST: low
- ACCESSIBILITY RISK: medium (must be keyboard + SR navigable)
- MOBILE STRATEGY: hamburger -> type overlay.
- REDUCED MOTION STRATEGY: instant open; no hover choreography.
- DEPENDENCIES: GSAP; Lenis optional.
- PROVIDERS/LIBRARIES: GSAP; Lenis.
- BUSINESSFORGE CAPABILITY NAME: cap.type.nav
- BLUEPRINT REPRESENTATION: {"type":"nav","style":"oversized","overlay":true,"items":["Work","About","Contact"]}
- QA REQUIREMENTS: keyboard reachable; SR labels; focus visible; reduced-motion instant; no trap.

---

# CROSS-CUTTING GUIDANCE (applies to all patterns above)

- **Conditional gating (BusinessForge principle):** These are CONDITIONAL capabilities, not defaults. Select per business character vector: price tier, sensory vs functional, consideration level, audience count, cultural duality, engineering capability, visual-output volume, performance budget. Do NOT apply an Awwwards effect because it is trendy.
- **Evidence tally:** OBSERVED patterns are backed by live official docs (MDN, GSAP, Lenis) or live-site DOM/CSS facts from the in-workspace Awwwards teardown. INFERRED patterns are attributed to named studio sites (Active Theory, Resn, Dogstudio, 14islands, Immersive Garden, Monogrid, Cuberto) from documented practice but their live DOM was not probed in this run.
- **Universal accessibility floor:** body text >= 16px; AA contrast; source/visual reading order match; focus never trapped; `prefers-reduced-motion` yields a complete static experience; no-JS / no-WebGL fallback for canvas/video.
- **Universal mobile rule:** heavy scroll-hijack (pin, horizontal, hybrid, infinite canvas, scrub-video, frame-sequence) must degrade to vertical scroll, swipe, or static on mobile and under reduced-motion.
- **Performance budget:** transform/opacity only for animation; `will-change` sparingly; lazy-load media; cap WebGL draw calls; keep LCP element out of reveal/scrub animations.
- **Anti-template rule:** Real sites (mosbyfiles.com, nexola.framer.website, vectrfl.com, studiomodular.be, etc.) evidence *principles* (oversized type, restrained palette, one accent, grid discipline), not templates. Generate character-matched output in the same neighborhood, never a clone.
