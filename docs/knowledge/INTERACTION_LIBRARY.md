# BusinessForge — Interaction Library (Phase 8)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.** This document is a catalogue of interaction techniques with activation/suppression guidance, not a spec to be built now.
**Author role:** Research Director / Interaction Knowledge Architect
**Date:** 2026-08-17
**Sibling docs:** `KNOWLEDGE_TAXONOMY.md` (K1–K4, ACTIVATES_WHEN / SUPPRESSED_WHEN), `PERFORMANCE_KNOWLEDGE.md`, `TRUTH_AND_EVIDENCE.md`, `EXPERIENCE_SIGNATURE_SYSTEM.md`.

---

## 0. Honesty note

This is a research catalogue. Claims are coded by verification state:

- **VERIFIED (live):** Three reference APIs were checked by `curl -I` on 2026-08-17:
  - `developer.mozilla.org/.../IntersectionObserver` → HTTP 200.
  - `developer.mozilla.org/.../View_Transitions_API` → HTTP 301 (permanent redirect to canonical locale slug; canonical exists).
  - `developer.mozilla.org/.../animation-timeline` → HTTP 301 (same).
  These three are the highest-risk "does this API exist" references; the 3-call budget was spent here.
- **UNVERIFIED (URL):** All other named APIs (Web Animations API, `scroll()`, `view()`, `popover`/`dialog`, `position: sticky`, `content-visibility`, `prefers-reduced-motion`, Canvas2D, WebGL/WebGPU, Pointer Events, CSS `@property`, `mask`/`clip-path`, `background-clip: text`, `:user-invalid`, scroll-snap) are real, established web-platform features drawn from established practice. Their individual doc URLs were **not** re-checked live; mark them UNVERIFIED for live-link purposes.
- **UNVERIFIED (numbers):** All performance figures (byte costs, ms, LCP/INP/CLS deltas) are synthesis from established practice and general engineering knowledge, not measurements against the live BusinessForge renderer. They are directional, not lab-certified.
- **Repository context (assumed verified, not re-checked this pass):** `lib/experience/{compose,emit,runtime,shader,styles,types}.ts`, `lib/design/interaction.ts`, and `lib/render/` exist; `lib/render/` emits **static HTML/CSS with NO JavaScript by default**. The "NO-JS FEASIBILITY" field for every entry is the single most operationally valuable field here: it states whether a given technique is achievable in the current no-JS renderer (CSS-only), or would require a JS runtime the repo does not yet ship.

---

## 1. How to read an entry

Each entry carries: CONCEPT, USER PURPOSE, VISUAL EFFECT, TECHNICAL IMPLEMENTATION (real APIs named), PERFORMANCE COST (numbers + LCP/INP/CLS impact), ACCESSIBILITY CONSIDERATION, WHEN TO USE, WHEN NOT TO USE, KNOWLEDGE CLASS (K1–K4 per `KNOWLEDGE_TAXONOMY.md`), NO-JS FEASIBILITY, and DEGRADATION LADDER.

**NO-JS FEASIBILITY** uses three values:
- **CSS-only** — achievable in the current static `lib/render/` output with no runtime.
- **Partial** — the resting/static state is CSS-only; the dynamic state needs JS the repo does not ship (degrades gracefully to the static state).
- **JS-required** — cannot function without a JS runtime the repo does not yet ship.

---

# CATEGORY: LOADING

Loading interactions occupy the first paint and the gap before content is ready. On conversion-critical local-business sites they are the highest-risk category — see the forbidden list in §Final.

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| L1 | Skeleton Shimmer | CSS-only | K2 |
| L2 | Determinate Progress Bar | Partial | K2 |
| L3 | Brand Reveal Preloader | Partial | K4 |

### L1 — Skeleton Shimmer
- **CONCEPT:** Grey placeholder blocks with a moving gradient sweep stand in for content while it loads.
- **USER PURPOSE:** Reduce perceived wait; signal "content is coming" instead of a blank void.
- **VISUAL EFFECT:** Pulsing/translating light band across rounded grey rectangles shaped like the real layout.
- **TECHNICAL IMPLEMENTATION:** CSS `@keyframes` translating a `linear-gradient` background-position, or `mask` + animated overlay; `content-visibility: auto` on below-fold sections to defer layout. Pure CSS, no observer.
- **PERFORMANCE COST:** ~0.3–0.8 KB CSS. Negligible main-thread cost (compositor-only if using `transform`/`background-position` on GPU layers). LCP: neutral-to-positive (holds layout, prevents CLS shift when real content swaps in at same box). CLS: **prevents** shift if skeleton box matches final box. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Mark skeletons `aria-hidden="true"` and expose real loading state via `aria-busy="true"` on the container; pair with an accessible live region announcing "Loading". Respect `prefers-reduced-motion` by freezing the shimmer (static grey).
- **WHEN TO USE:** Content arrives async (images, fonts, data tables) and the box is known.
- **WHEN NOT TO USE:** Above-the-fold hero on a local-business site where the real content can be server-rendered immediately — a skeleton there delays the money message.
- **KNOWLEDGE CLASS:** K2 (craft — pacing/restraint).
- **NO-JS FEASIBILITY:** CSS-only — achievable now. The shimmer is decorative; the real content is in the static HTML and shows when ready.
- **DEGRADATION LADDER:** JS off → skeleton still shows (CSS animation) then static content replaces it. Reduced motion → frozen shimmer. No `content-visibility` support → sections render normally (just no lazy layout deferral).

### L2 — Determinate Progress Bar
- **CONCEPT:** A bar fills from 0→100% to communicate real load progress.
- **USER PURPOSE:** Honest progress signal for multi-step loads (uploads, large media, config generation).
- **VISUAL EFFECT:** Thin bar along top or within a loader, width tracks actual completion.
- **TECHNICAL IMPLEMENTATION:** `<progress>` element styled via CSS, or a `div` whose `width` is set from a real progress event. The *animation* (transition on width) is CSS; the *value* requires JS to update.
- **PERFORMANCE COST:** <0.5 KB. Width transitions are composited. INP: only if updated on main thread too frequently (>10/s) — throttle to ~4/s. LCP/CLS: none if bar is fixed/overlay.
- **ACCESSIBILITY CONSIDERATION:** Use `<progress>` with `aria-valuenow`/`valuemin`/`valuemax` (native semantics), or `role="progressbar"`. Never fake 100% — false completion is a trust violation (K1 truthfulness).
- **WHEN TO USE:** Genuinely multi-stage operations with real progress events.
- **WHEN NOT TO USE:** Page boot on a marketing site — there is no real "progress" to report, so it becomes a fake determinate bar (K4 slop).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** Partial — static `width:0` bar renders; the fill needs a JS runtime to set the value. Degrades to an inert bar.
- **DEGRADATION LADDER:** JS off → empty/indeterminate bar (or hide it). Reduced motion → remove width transition, keep stepping.

### L3 — Brand Reveal Preloader
- **CONCEPT:** A full-screen overlay shows the logo/wordmark, then wipes away to reveal the site.
- **USER PURPOSE:** Cinematic brand handshake; "we are premium".
- **VISUAL EFFECT:** Logo fades/scales in, overlay slides or masks away on a timed or load-complete cue.
- **TECHNICAL IMPLEMENTATION:** CSS `@keyframes` for the logo + overlay fade, `clip-path`/mask wipe. A timed auto-dismiss is CSS-only; dismiss-on-`window.load` needs a tiny script.
- **PERFORMANCE COST:** Can be **expensive**: blocks first meaningful content, delays LCP by the animation duration (often 1.5–3 s). Adds 1–3 KB. LCP: strongly negative if overlay covers hero. CLS: risk if overlay removed abruptly.
- **ACCESSIBILITY CONSIDERATION:** Never trap keyboard focus in the overlay; provide an immediate "Skip" affordance. Respect `prefers-reduced-motion` by cutting the duration to ~0. Screen readers must reach real content immediately (`aria-hidden` on overlay, or remove from DOM fast).
- **WHEN TO USE:** Brand-led launches, portfolios, award-site intros where the handshake is the point.
- **WHEN NOT TO USE:** Any conversion-critical local-business site — a 2 s logo wall in front of "Call now / Open hours" is a direct revenue leak (see §Final forbidden list).
- **KNOWLEDGE CLASS:** K4 (anti-knowledge when used on conversion sites; trend-decoration elsewhere).
- **NO-JS FEASIBILITY:** Partial — a timed CSS-only fade is possible (overlay auto-hides after Ns), but gating on real load needs JS. Either way the renderer can emit the CSS.
- **DEGRADATION LADDER:** JS off → timed CSS fade still works. Reduced motion → near-instant removal. No overlay support/old browser → static first paint (overlay simply absent).

---

# CATEGORY: NAVIGATION

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| N1 | Sticky Anchor Nav | CSS-only | K2 |
| N2 | Scrollspy Highlight | JS-required | K2 |
| N3 | Mega Menu Popover | CSS-only | K2 |

### N1 — Sticky Anchor Nav
- **CONCEPT:** Primary navigation stays pinned to the top (or bottom) as the user scrolls.
- **USER PURPOSE:** Persistent wayfinding; never lose the menu or the primary CTA.
- **VISUAL EFFECT:** Nav detaches and floats over content once its scroll offset is passed; often gains a shadow/blur backdrop.
- **TECHNICAL IMPLEMENTATION:** `position: sticky; top: 0` on the nav container. Backdrop blur via `backdrop-filter`. No script.
- **PERFORMANCE COST:** ~0.5 KB. `sticky` is cheap; `backdrop-filter` can cost 2–6 ms/frame on low-end GPUs during scroll. LCP: none. CLS: ensure nav height is reserved so content doesn't jump. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Sticky bars must not cover focus targets — keep them short and never overlay full-screen. `prefers-reduced-motion` irrelevant (no animation). Ensure focus order is unchanged (sticky is visual only).
- **WHEN TO USE:** Any multi-section page longer than ~1.5 viewports.
- **WHEN NOT TO USE:** Single-screen landing pages; a sticky bar there is dead weight.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only — `position: sticky` works in the static renderer today.
- **DEGRADATION LADDER:** No `sticky` support (very old) → nav scrolls away (acceptable static behaviour). No `backdrop-filter` → solid background fallback.

### N2 — Scrollspy Highlight
- **CONCEPT:** The nav item for the section currently in view is highlighted.
- **USER PURPOSE:** Orientation — "where am I on this page?".
- **VISUAL EFFECT:** Active link gets underline/colour; previous de-highlights as you pass.
- **TECHNICAL IMPLEMENTATION:** `IntersectionObserver` toggling an `.active` class; or CSS scroll-driven `animation-timeline: view()` driving a highlight (modern, no JS). JS path is the pragmatic default today.
- **PERFORMANCE COST:** IntersectionObserver is off-main-thread-ish and cheap (<0.3 KB). LCP/CLS: none. INP: none if class toggle is deferred.
- **ACCESSIBILITY CONSIDERATION:** Highlight is decorative; do not rely on colour alone (add underline/weight). Keep the active state perceivable for low-vision; pair with logical DOM order. Reduced motion: instant toggle fine.
- **WHEN TO USE:** Long docs/anchored pages with 4+ sections.
- **WHEN NOT TO USE:** Short pages or pages whose sections are reached by separate routes (no in-page scroll context).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** JS-required for the IntersectionObserver path; **Partial** if the CSS `view()` scroll-driven path is used (CSS-only on supporting browsers, needs JS fallback otherwise). Today the repo would ship the JS version.
- **DEGRADATION LADDER:** JS off / no IO → no highlight (links still work). Unsupported `view()` → same. Reduced motion → unaffected.

### N3 — Mega Menu Popover
- **CONCEPT:** Hovering/focusing a top-level item reveals a large panel of links grouped by topic.
- **USER PURPOSE:** Expose deep structure without a click; aid discovery.
- **VISUAL EFFECT:** Panel fades/slides in below the trigger, often with grouped columns.
- **TECHNICAL IMPLEMENTATION:** Declarative `popover` attribute + `<button popovertarget>` (no JS) OR `<details>`/`:hover` + `:focus-within` CSS. `:popover-open` styles the top-layer panel.
- **PERFORMANCE COST:** <1 KB. Popover is compositor-light. LCP: none (hidden by default). CLS: none (top-layer, out of flow).
- **ACCESSIBILITY CONSIDERATION:** **Keyboard must open it** — `:hover`-only fails WCAG 2.1.1; `popovertarget` button or `:focus-within` satisfies this. Provide Escape-to-close (native for popover). Keep panels within 44px target sizes. Announce via natural focus movement, not aria-live.
- **WHEN TO USE:** Sites with 10+ navigable sections (large local service groups, multi-location).
- **WHEN NOT TO USE:** Simple 3–5 item nav — a mega menu is overhead and a mobile nightmare.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `popovertarget` button or `:focus-within` — achievable now.
- **DEGRADATION LADDER:** No popover support → fall back to `<details>` or always-visible grouped links. Touch devices → tap-to-open (popover handles this). Reduced motion → instant show.

---

# CATEGORY: SCROLL

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| S1 | Scroll-Linked Progress | CSS-only | K2 |
| S2 | Infinite Scroll | JS-required | K3 |
| S3 | Snap Scrolling | CSS-only | K3 |

### S1 — Scroll-Linked Progress
- **CONCEPT:** A bar or element reflects how far down the page the user has scrolled.
- **USER PURPOSE:** Sense of position/completion on long reads.
- **VISUAL EFFECT:** Top bar fills 0→100% with scroll; or a vertical rail indicator.
- **TECHNICAL IMPLEMENTATION:** CSS scroll-driven animation: `animation-timeline: scroll(root block)` with a `scaleX` keyframe. Pure CSS, no listener.
- **PERFORMANCE COST:** ~0.4 KB. Scroll-driven animations run off the main thread — **zero** scroll-handler jank. LCP/CLS: none. INP: none. (Big win over JS scroll listeners.)
- **ACCESSIBILITY CONSIDERATION:** Decorative — `aria-hidden`. Do not make it the only position indicator; the URL/section heading suffices. Reduced motion: the mapping is positional, not animated, so it's fine to keep.
- **WHEN TO USE:** Articles, long-form, docs.
- **WHEN NOT TO USE:** Short local-business pages — there's nothing to track.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `animation-timeline: scroll()` — achievable in the static renderer (progressive enhancement; unsupported browsers simply show no bar).
- **DEGRADATION LADDER:** No `scroll()` support (Safari<26/older) → no progress bar (graceful nothing). Reduced motion → unaffected. JS off → still works (it's CSS).

### S2 — Infinite Scroll
- **CONCEPT:** New content appends automatically as the user nears the bottom.
- **USER PURPOSE:** Frictionless browse of feeds/catalogues.
- **VISUAL EFFECT:** Spinner/skeleton appears, then more items insert.
- **TECHNICAL IMPLEMENTATION:** `IntersectionObserver` on a bottom sentinel fetching the next page; `content-visibility: auto` on appended items.
- **PERFORMANCE COST:** Fetches add network + parse cost; cap concurrent items (e.g. 60) and use `content-visibility` to keep DOM cheap. LCP: fine. CLS: **high risk** if inserted above viewport — only append below. INP: fetching off main thread; render in idle.
- **ACCESSIBILITY CONSIDERATION:** **Provide a "Load more" button fallback** (WCAG 2.2.2 pause/control; keyboard users and AT often can't trigger infinite scroll). Page doesn't have a footer/end for screen-reader users without a sentinel announcement. Respect "reach end" with a live region.
- **WHEN TO USE:** Large catalogues/galleries where browse > find.
- **WHEN NOT TO USE:** Local-business sites with finite content (services, menu, team) — infinite scroll hides the footer CTA and contact info (conversion harm).
- **KNOWLEDGE CLASS:** K3 (trend; decoration, never organizing principle).
- **NO-JS FEASIBILITY:** JS-required (IntersectionObserver + fetch). No CSS-only equivalent.
- **DEGRADATION LADDER:** JS off → pagination links (must ship them as the baseline). Reduced motion → unaffected (no motion, just insertion).

### S3 — Snap Scrolling
- **CONCEPT:** Scroll settles on defined "slides" rather than free-stopping.
- **USER PURPOSE:** Rhythmic, presentation-like browsing of full sections.
- **VISUAL EFFECT:** Each swipe snaps to the next full-height panel.
- **TECHNICAL IMPLEMENTATION:** `scroll-snap-type: y mandatory` on the container + `scroll-snap-align: start` on children. Pure CSS.
- **PERFORMANCE COST:** <0.3 KB. GPU/compositor handled. LCP/CLS: none. INP: none (native scrolling).
- **ACCESSIBILITY CONSIDERATION:** `mandatory` can trap users trying to read content split across a snap point — prefer `proximity`. Never combine with `overflow: hidden` that blocks keyboard scrolling. Reduced motion: unaffected (snap is positional).
- **WHEN TO USE:** Full-screen storytelling sections, galleries, onboarding.
- **WHEN NOT TO USE:** Content-heavy pages where users need to stop mid-section to read.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** CSS-only — `scroll-snap` works in the static renderer.
- **DEGRADATION LADDER:** No snap support → normal smooth scroll. Reduced motion → unaffected.

# CATEGORY: HOVER

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| H1 | Link Underline Grow | CSS-only | K2 |
| H2 | Card Lift | CSS-only | K2 |
| H3 | Image Zoom-on-Hover | CSS-only | K3 |

### H1 — Link Underline Grow
- **CONCEPT:** A link's underline animates in from a thin line to full width on hover/focus.
- **USER PURPOSE:** Affordance + delight on inline and nav links.
- **VISUAL EFFECT:** Underline wipes left→right (or scales from centre) on hover; retracts on leave.
- **TECHNICAL IMPLEMENTATION:** `background-size` transition on a linear-gradient underline, or `text-decoration` + `text-underline-offset` transition, or a pseudo-element `transform: scaleX()` with `transform-origin`. Pure CSS `:hover`/`:focus-visible`.
- **PERFORMANCE COST:** <0.2 KB, composited. LCP/CLS/INP: none.
- **ACCESSIBILITY CONSIDERATION:** Must trigger on `:focus-visible` too (keyboard). Never colour-only — pair with underline weight/offset change. Respect that hover is unavailable on touch (provide persistent affordance like colour/underline at rest for key links).
- **WHEN TO USE:** Editorial/text-heavy sites, nav, inline citations.
- **WHEN NOT TO USE:** Where links are already clearly button-styled; redundant motion.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only — `:hover`/`:focus-visible` work in the static renderer.
- **DEGRADATION LADDER:** Touch/no-hover → underline present at rest (don't hide it on non-hover). Reduced motion → instant, no wipe.

### H2 — Card Lift
- **CONCEPT:** A card raises and casts a deeper shadow on hover/focus.
- **USER PURPOSE:** Tactile feedback that the element is interactive (clickable card).
- **VISUAL EFFECT:** `translateY(-6px)` + larger `box-shadow`, subtle.
- **TECHNICAL IMPLEMENTATION:** CSS `transition` on `transform`/`box-shadow` keyed to `:hover`/`:focus-visible`. Use `will-change: transform` sparingly.
- **PERFORMANCE COST:** ~0.2 KB. Shadow repaint can cost 1–3 ms on low-end; prefer `transform` (composited). CLS: none if transform only. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Keyboard focus must show it (`:focus-visible`). Ensure the whole card is a single focusable target (or contains one). 44px min target. Reduced motion → drop the translate, keep a static shadow change.
- **WHEN TO USE:** Card grids (services, portfolio, products).
- **WHEN NOT TO USE:** When cards aren't actionable (decorative) — fake affordance misleads.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only.
- **DEGRADATION LADDER:** No-hover → static shadow at rest signals interactivity. Reduced motion → no movement.

### H3 — Image Zoom-on-Hover
- **CONCEPT:** An image scales slightly within its frame on hover.
- **USER PURPOSE:** Draw attention to a product/photo; "look closer".
- **VISUAL EFFECT:** `scale(1.05–1.1)` with `overflow:hidden` frame; optional brightness shift.
- **TECHNICAL IMPLEMENTATION:** CSS `:hover img { transform: scale() }` inside `overflow:hidden` container. Pure CSS.
- **PERFORMANCE COST:** ~0.2 KB. Can cause repaint if not promoted; add `transform: translateZ(0)` to the image. LCP: none. CLS: none (frame fixed). INP: none.
- **ACCESSIBILITY CONSIDERATION:** Zoom is decorative; ensure the non-zoomed image already conveys the content (don't hide detail behind hover). Keyboard `:focus-visible` parity. Reduced motion → disable scale.
- **WHEN TO USE:** Product/portfolio galleries.
- **WHEN NOT TO USE:** Above-the-fold hero where zoom distracts from the CTA. Avoid on text-bearing images (legibility).
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** CSS-only.
- **DEGRADATION LADDER:** Touch → static. Reduced motion → static.

---

# CATEGORY: CURSOR

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| C1 | Custom Cursor Dot | JS-required | K3 |
| C2 | Magnetic Cursor | JS-required | K3 |
| C3 | Cursor Trail | JS-required | K4 |

### C1 — Custom Cursor Dot
- **CONCEPT:** The native cursor is hidden and a small dot/ring follows the pointer.
- **USER PURPOSE:** Brand-tinted pointer; designed feel.
- **VISUAL EFFECT:** Tiny circle tracks pointer with slight lag/easing; grows over interactive elements.
- **TECHNICAL IMPLEMENTATION:** `cursor: none` + a fixed element moved via Pointer Events (`pointermove`) and `transform`. Needs a JS runtime.
- **PERFORMANCE COST:** Pointer Events are main-thread; throttle with `requestAnimationFrame`. ~1–2 KB JS. INP: risk if handler heavy (keep to transform-only). LCP/CLS: none.
- **ACCESSIBILITY CONSIDERATION:** **Must keep a visible pointer for keyboard/AT users and respect `prefers-reduced-motion`** (disable the custom cursor). Never hide the cursor entirely on form fields (users lose the I-beam). Touch devices have no cursor — must no-op. WCAG 2.5.8 target size unaffected if dot is non-interactive.
- **WHEN TO USE:** Brand-led, low-density creative sites.
- **WHEN NOT TO USE:** Local-business / utility sites — a custom cursor adds risk, hurts form usability, and signals "agency showreel" not "get me a plumber".
- **KNOWLEDGE CLASS:** K3 (trend; risky on conversion sites).
- **NO-JS FEASIBILITY:** JS-required — the repo's no-JS renderer cannot track the pointer.
- **DEGRADATION LADDER:** JS off → native cursor (just don't set `cursor:none`). Reduced motion → native cursor. Touch → native.

### C2 — Magnetic Cursor
- **CONCEPT:** The cursor (or a follower) is pulled toward nearby interactive elements.
- **USER PURPOSE:** Playful "things are attracted to you" feel on hero CTAs.
- **VISUAL EFFECT:** Follower lags then snaps toward buttons/links within a radius.
- **TECHNICAL IMPLEMENTATION:** Pointer Events + per-frame distance math moving a follower element via `transform`. JS-only.
- **PERFORMANCE COST:** Similar to C1; add radius checks per interactive node (cache the node list). INP: keep math O(interactive nodes). LCP/CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Purely decorative — keyboard users see nothing; ensure the underlying control is fully usable without it. Reduced motion → disable. Never let it obscure the actual focus ring.
- **WHEN TO USE:** Singular hero moments on brand sites.
- **WHEN NOT TO USE:** Anywhere with many controls (magnetic chaos) or on conversion sites.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required.
- **DEGRADATION LADDER:** JS off/reduced motion/touch → native cursor, controls intact.

### C3 — Cursor Trail
- **CONCEPT:** A fading trail of particles/ghosts follows the pointer.
- **VISUAL EFFECT:** Tail of dots/letters that fade out behind the cursor.
- **TECHNICAL IMPLEMENTATION:** Pointer Events spawning short-lived DOM/Canvas nodes with opacity decay, or a Canvas2D trail. JS-only.
- **PERFORMANCE COST:** Can be **high** — spawning nodes per move event causes GC churn; use a pooled Canvas trail. Risk of INP regression on low-end. LCP/CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Pure decoration; can induce vestibular discomfort and distract AT users. **Strongly** gate behind `prefers-reduced-motion` (disable entirely). Touch → no-op.
- **WHEN TO USE:** Rarely; only the most expressive brand showcases.
- **WHEN NOT TO USE:** Almost everywhere else — classic K4 slop signal on business sites.
- **KNOWLEDGE CLASS:** K4 (anti-knowledge in business contexts).
- **NO-JS FEASIBILITY:** JS-required.
- **DEGRADATION LADDER:** JS off/reduced motion/touch → no trail (correct baseline).

---

# CATEGORY: DRAG

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| D1 | Drag-to-Reorder | JS-required | K3 |
| D2 | Drag Carousel | JS-required | K2 |
| D3 | Drag-to-Scrub | JS-required | K3 |

### D1 — Drag-to-Reorder
- **CONCEPT:** User drags list/grid items to reorder them.
- **USER PURPOSE:** Personalisation (e.g. "my services in my order").
- **VISUAL EFFECT:** Item lifts, others reflow, drop indicator shows target slot.
- **TECHNICAL IMPLEMENTATION:** Pointer Events for grab/move + `transform` feedback; state reorder via JS. Native HTML5 drag-and-drop is an alternative but poor on touch.
- **PERFORMANCE COST:** ~2–4 KB JS. Keep transforms composited; avoid layout thrash on every move. INP: main-thread during drag. LCP/CLS: none post-interaction.
- **ACCESSIBILITY CONSIDERATION:** **Must provide a non-drag path** (keyboard: move-up/move-down buttons or arrow-key reorder) — drag alone fails WCAG 2.1.1. Announce reorder result via live region. 44px handles. Reduced motion → instant snap, no fly animation.
- **WHEN TO USE:** User-customisable dashboards/wishlists.
- **WHEN NOT TO USE:** Content the business controls (services list) — reordering adds zero value and breaks the intended narrative.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required.
- **DEGRADATION LADDER:** JS off → static ordered list + keyboard move buttons as baseline. Touch → Pointer Events handle it (better than native DnD).

### D2 — Drag Carousel
- **CONCEPT:** Horizontal gallery the user drags through (like a touch gallery on desktop).
- **USER PURPOSE:** Browse many items in a compact strip.
- **VISUAL EFFECT:** Strip tracks the pointer with inertia/momentum.
- **TECHNICAL IMPLEMENTATION:** Pointer Events translating a track; or CSS scroll with `scroll-snap` + native drag (touch) plus JS for mouse-drag. A CSS-only `overflow-x:auto; scroll-snap` covers touch/mouse-wheel; mouse *drag* needs JS.
- **PERFORMANCE COST:** CSS scroll path is free. JS drag path ~1–2 KB. INP: transform-only drag is fine. LCP: none.
- **ACCESSIBILITY CONSIDERATION:** Provide prev/next buttons and keyboard arrow support (roving tabindex). Never `overflow:hidden` without a control. Reduced motion → disable inertia, keep stepped scroll.
- **WHEN TO USE:** Testimonials, portfolio, product strips.
- **WHEN NOT TO USE:** When 3 items fit without scrolling — a carousel is needless.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** Partial — CSS `overflow-x:auto` + scroll-snap is CSS-only for wheel/touch; mouse-drag needs JS. Static fallback: all items visible/stacked.
- **DEGRADATION LADDER:** JS off → native horizontal scroll (buttons still work). Reduced motion → stepped.

### D3 — Drag-to-Scrub
- **CONCEPT:** Dragging scrubs through a video/timeline/before-after.  (JS-required.)
- **USER PURPOSE:** Manual control of playback/comparation.  (JS-required.)
- **VISUAL EFFECT:** Pointer X maps to frame/time/position.  (JS-required.)
- **TECHNICAL IMPLEMENTATION:** Pointer Events mapping X→`currentTime`/clip position; range input is the accessible baseline. JS-only for the drag feel.
- **PERFORMANCE COST:** ~1–2 KB. Seek can be costly on video; throttle. INP: keep decode off main thread. LCP/CLS: none.
- **ACCESSIBILITY CONSIDERATION:** **Always ship a `<input type="range">`** as the real control (keyboard + AT). Drag is an enhancement. Label it. Reduced motion → unaffected (user-driven).
- **WHEN TO USE:** Before/after sliders, video scrubbers, 360° product preview.
- **WHEN NOT TO USE:** Static images presented as scrubbers (fake interactivity).
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required (range input baseline is HTML, but the drag-scrub enhancement needs JS).
- **DEGRADATION LADDER:** JS off → range input / static frame. Touch → Pointer Events.

---

# CATEGORY: MAGNETIC

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| M1 | Magnetic Button | JS-required | K3 |
| M2 | Magnetic Menu Item | JS-required | K3 |

### M1 — Magnetic Button
- **CONCEPT:** A CTA shifts toward the cursor when the pointer is near, as if magnetic.
- **USER PURPOSE:** Inviting, "alive" primary action on hero/landing.
- **VISUAL EFFECT:** Button translates a few px toward the pointer; label may counter-shift for parallax.
- **TECHNICAL IMPLEMENTATION:** Pointer Events on a proximity radius computing offset → `transform` on the button (and inner label). JS-only.
- **PERFORMANCE COST:** ~1–2 KB. Per-frame transform; cheap if throttled with rAF. INP: low if transforms only. LCP/CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Decorative — keyboard focus must still activate normally; the magnetic offset must not move the hit area away from where the user expects (keep within ~8px). Reduced motion → disable offset. Touch → no-op (no hover).
- **WHEN TO USE:** Solo hero CTA on brand sites.
- **WHEN NOT TO USE:** Forms, dense UIs, or conversion sites where the CTA must be rock-steady and unmistakable.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required.
- **DEGRADATION LADDER:** JS off/reduced motion/touch → static button (fully functional).

### M2 — Magnetic Menu Item
- **CONCEPT:** Nav/menu links drift toward the cursor on hover.
- **USER PURPOSE:** Lively navigation on expressive sites.
- **VISUAL EFFECT:** Each item nudges toward pointer; optional dot-follower between items.
- **TECHNICAL IMPLEMENTATION:** Per-item Pointer Events offset like M1. JS-only.
- **PERFORMANCE COST:** Multiply M1 cost by item count; cache node list, cap radius checks. INP: keep O(items). LCP/CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Keyboard users get no drift — ensure focus styling is independent and clear. Don't let drift break the 44px target or overlap neighbours. Reduced motion → disable.
- **WHEN TO USE:** Overlay/expressive menus on brand sites.
- **WHEN NOT TO USE:** Utility nav, footers, conversion sites.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required.
- **DEGRADATION LADDER:** JS off/reduced motion/touch → static menu items.

---

# CATEGORY: REVEAL

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| R1 | Intersection Reveal | CSS-only | K2 |
| R2 | Staggered List Reveal | CSS-only | K2 |
| R3 | Text Line Mask Reveal | CSS-only | K2 |

### R1 — Intersection Reveal
- **CONCEPT:** Elements fade/slide in as they enter the viewport.
- **USER PURPOSE:** Guide attention; make the page feel composed, not dumped.
- **VISUAL EFFECT:** Opacity 0→1 + small `translateY` as the block scrolls into view.
- **TECHNICAL IMPLEMENTATION:** CSS scroll-driven `animation-timeline: view()` with a fade/slide keyframe — **CSS-only, no observer**. (JS `IntersectionObserver` is the older fallback.)
- **PERFORMANCE COST:** ~0.4 KB. Scroll-driven animations are off-main-thread → no scroll jank. LCP: ensure above-fold hero is NOT reveal-gated (it must be visible at load). CLS: avoid final-position shift (animate transform/opacity only). INP: none.
- **ACCESSIBILITY CONSIDERATION:** Content must be present in DOM/HTML at load (don't hide it from AT behind a never-firing trigger). Respect `prefers-reduced-motion` → show immediately, no transform. Never reveal-gate essential above-fold content.
- **WHEN TO USE:** Below-fold sections on any content page.
- **WHEN NOT TO USE:** Above-fold hero/CTA (delaying it hurts LCP + conversion).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `animation-timeline: view()` — achievable in the static renderer; unsupported browsers show content statically (progressive enhancement).
- **DEGRADATION LADDER:** No `view()` support → content visible immediately (fine). Reduced motion → visible immediately. JS off → still works (CSS).

### R2 — Staggered List Reveal
- **CONCEPT:** List/grid children reveal in sequence rather than all at once.
- **USER PURPOSE:** Rhythmic, crafted entrance; signals intentionality.
- **VISUAL EFFECT:** Items cascade with incremental delay (e.g. 60ms steps).
- **TECHNICAL IMPLEMENTATION:** CSS `view()` timeline + `animation-delay: calc(var(--i) * 60ms)` per child (set `--i` inline). Pure CSS.
- **PERFORMANCE COST:** ~0.5 KB. Composited. Same LCP/CLS rules as R1. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Stagger is cosmetic; all items reachable immediately by keyboard. Reduced motion → all visible at once. Don't stagger so long it delays reading (cap total <600ms).
- **WHEN TO USE:** Feature lists, team grids, card collections.
- **WHEN NOT TO USE:** Long lists (stagger becomes a wait); above-fold critical content.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only (inline `--i` custom property in static HTML).
- **DEGRADATION LADDER:** No `view()` → static visible. Reduced motion → instant.

### R3 — Text Line Mask Reveal
- **CONCEPT:** Headlines reveal line-by-line as if wiped by a mask.
- **USER PURPOSE:** Premium, editorial entrance for hero/section titles.
- **VISUAL EFFECT:** Each line clips upward from a mask on scroll/hover.
- **TECHNICAL IMPLEMENTATION:** Wrap lines in `overflow:hidden` spans; child `transform: translateY(100%)→0` keyed to `view()` or `:hover`. CSS-only (line splitting is a build/static step).
- **PERFORMANCE COST:** ~0.5 KB. Transform-only. LCP: don't gate the hero H1 behind scroll — reveal on load for above-fold. CLS: mask container reserves height. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Screen readers read the text normally (mask is visual). Reduced motion → lines shown. Ensure the text is real text, not an image (SEO/AT).
- **WHEN TO USE:** Editorial heroes, section openers.
- **WHEN NOT TO USE:** Body copy (over-designed); above-fold if it delays the message.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only (with static line spans in HTML).
- **DEGRADATION LADDER:** No `view()`/mask → text visible. Reduced motion → visible.

# CATEGORY: PARALLAX

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| P1 | Background Parallax | CSS-only | K3 |
| P2 | Foreground Parallax | CSS-only | K3 |
| P3 | Multi-layer Depth Parallax | CSS-only | K3 |

### P1 — Background Parallax
- **CONCEPT:** A background layer moves slower than the foreground as the user scrolls.
- **USER PURPOSE:** Depth and immersion; makes a hero feel alive.
- **VISUAL EFFECT:** BG image drifts up/down at ~0.3–0.5× scroll speed behind content.
- **TECHNICAL IMPLEMENTATION:** CSS scroll-driven `animation-timeline: scroll()` translating the BG layer's `Y` proportionally. Pure CSS, no scroll listener.
- **PERFORMANCE COST:** ~0.4 KB. Scroll-driven → off-main-thread, no jank. Large BG images cost LCP if not preloaded/`fetchpriority`. CLS: none if layer is `position:absolute` behind. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Parallax can cause vestibular discomfort — **always** disable under `prefers-reduced-motion` (freeze layers). Keep movement small (<40px). Don't put text on a parallaxing layer (legibility). Reduced motion → static.
- **WHEN TO USE:** Hero/section backdrops on brand/editorial sites.
- **WHEN NOT TO USE:** Conversion sites where a calm, fast, legible hero wins; or with text-bearing layers.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** CSS-only via `scroll()` — achievable in the static renderer (progressive; unsupported browsers show a static BG).
- **DEGRADATION LADDER:** No `scroll()` → static BG. Reduced motion → static. JS off → still works (CSS).

### P2 — Foreground Parallax
- **CONCEPT:** A foreground element (image, badge) moves faster than the page.
- **USER PURPOSE:** Playful layered motion; draw the eye to a floating element.
- **VISUAL EFFECT:** Element drifts opposite/quicker than scroll.
- **TECHNICAL IMPLEMENTATION:** Same `scroll()` timeline, different `translate` magnitude/sign. CSS-only.
- **PERFORMANCE COST:** ~0.4 KB, composited. Same LCP/CLS/INP as P1. Ensure the element never overlaps the CTA (CLS/occlusion).
- **ACCESSIBILITY CONSIDERATION:** Decorative; must not cover interactive content or trap focus. Reduced motion → freeze. Keep within safe margins.
- **WHEN TO USE:** Decorative accents on expressive heroes.
- **WHEN NOT TO USE:** Dense layouts; conversion pages.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** CSS-only via `scroll()`.
- **DEGRADATION LADDER:** No `scroll()`/reduced motion → static element.

### P3 — Multi-layer Depth Parallax
- **CONCEPT:** Several layers move at distinct speeds for a 2.5D scene.
- **USER PURPOSE:** Cinematic depth (clouds slow, midground medium, foreground fast).
- **VISUAL EFFECT:** Layered scene with differential drift.
- **TECHNICAL IMPLEMENTATION:** Multiple `scroll()` timelines with per-layer `translate` factors. CSS-only.
- **PERFORMANCE COST:** ~0.6 KB. Each layer composited; watch total layers (5+ large images hurt LCP/memory on mobile). INP: none. CLS: none if absolutely positioned.
- **ACCESSIBILITY CONSIDERATION:** Strongest vestibular risk of the three — gate hard on `prefers-reduced-motion`. Provide a single static composed frame as the reduced-motion/unsupported view. Don't hide essential info in a layer.
- **WHEN TO USE:** Showcase heroes, landing splash.
- **WHEN NOT TO USE:** Business/utility sites; any page prioritising speed and clarity.
- **KNOWLEDGE CLASS:** K3 (verges on K4 if overused on the wrong site).
- **NO-JS FEASIBILITY:** CSS-only via `scroll()`.
- **DEGRADATION LADDER:** No `scroll()`/reduced motion → static composed frame.

---

# CATEGORY: PINNING

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| PN1 | Sticky Section Pin | CSS-only | K2 |
| PN2 | Horizontal Scroll Pin | CSS-only | K3 |

### PN1 — Sticky Section Pin
- **CONCEPT:** A section (or its inner panel) stays fixed in view while surrounding content scrolls past.
- **USER PURPOSE:** Hold a key visual/diagram in place while explanatory copy scrolls.
- **VISUAL EFFECT:** Panel "sticks" for a scroll distance, then releases.
- **TECHNICAL IMPLEMENTATION:** `position: sticky; top: 0` within a tall parent; the parent's height defines the pin duration. Pure CSS.
- **PERFORMANCE COST:** ~0.3 KB. `sticky` is cheap. LCP/CLS: none if height reserved. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Sticky is visual only — DOM order and focus must remain logical. Ensure the pinned content isn't taller than the viewport on mobile (it would never release / trap scroll). Reduced motion: unaffected.
- **WHEN TO USE:** "Sticky sidebar + scrolling steps" explainers, maps, specs.
- **WHEN NOT TO USE:** Short sections; mobile (pinning eats the small viewport).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `position: sticky`.
- **DEGRADATION LADDER:** No `sticky` → normal flow (content stacks). Reduced motion → unaffected.

### PN2 — Horizontal Scroll Pin
- **CONCEPT:** Vertical scroll is mapped to horizontal motion of a pinned panel (a "horizontal scroll section").
- **USER PURPOSE:** Gallery/process walkthrough that reads sideways while the page scrolls down.
- **VISUAL EFFECT:** Section pins; inner track translates X as the user scrolls Y.
- **TECHNICAL IMPLEMENTATION:** `position: sticky` pin + CSS scroll-driven `animation-timeline: scroll()` translating the track's `X` by scroll progress. **CSS-only** in modern browsers (no scroll-hijack JS).
- **PERFORMANCE COST:** ~0.6 KB. Scroll-driven → off-main-thread. Pin + large track images can cost LCP/memory. CLS: none. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Mapping vertical→horizontal is disorienting for some; disable under `prefers-reduced-motion` (show the track as a normal vertical/stacked list). Ensure keyboard users can still reach every item (don't hide items off-screen without scroll access). Mobile: prefer stacked.
- **WHEN TO USE:** Process/timeline/portfolio showcases on brand sites.
- **WHEN NOT TO USE:** Conversion sites; any page where the user needs to find one specific thing fast.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** CSS-only via `sticky` + `scroll()` translate (progressive; unsupported → stacked/vertical).
- **DEGRADATION LADDER:** No `scroll()` → vertical stacked sections. Reduced motion → stacked.

---

# CATEGORY: TRANSITIONS

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| T1 | View Transition Page Swap | JS-required | K3 |
| T2 | Shared Element Transition | JS-required | K3 |
| T3 | Route Crossfade | Partial | K2 |

### T1 — View Transition Page Swap
- **CONCEPT:** The old page fades/blurs out and the new page in on navigation.
- **USER PURPOSE:** Continuity between routes; less "hard cut".
- **VISUAL EFFECT:** Full snapshot crossfade/scale between old and new view.
- **TECHNICAL IMPLEMENTATION:** `document.startViewTransition(() => updateDOM())` (same-document SPA) — JS required. Cross-document (MPA) view transitions can be enabled declaratively via the Navigation API opt-in + CSS `@view-transition`, but BusinessForge's static output is multi-page, so the SPA path needs a JS runtime the repo doesn't ship.
- **PERFORMANCE COST:** ~1–3 KB JS + the transition snapshot (one frame capture, cheap). LCP: the new page's LCP still governs; ensure it's server-rendered fast. CLS: none if both states same layout. INP: brief main-thread during capture.
- **ACCESSIBILITY CONSIDERATION:** Respect `prefers-reduced-motion` — the View Transitions spec disables animations under it automatically, but verify. Announce route change via the document title/focus move (don't rely on motion). Reduced motion → instant swap.
- **WHEN TO USE:** Multi-route brand sites where flow matters.
- **WHEN NOT TO USE:** Single-page local-business sites (nothing to swap); or where speed > flourish.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required for the SPA path; declarative MPA opt-in is experimental and not in the current renderer. No-JS → plain navigation (fine baseline).
- **DEGRADATION LADDER:** JS off / unsupported → instant navigation. Reduced motion → instant.

### T2 — Shared Element Transition
- **CONCEPT:** One element (e.g. a product image) morphs from list position to detail position across navigation.
- **USER PURPOSE:** Object continuity — "this is the same thing" across routes.
- **VISUAL EFFECT:** The element's bounding box animates from source to destination.
- **TECHNICAL IMPLEMENTATION:** View Transition API with a matching `view-transition-name` on the source and destination elements. JS to initiate. Requires the same-document or opted-in MPA path.
- **PERFORMANCE COST:** Like T1 plus a morph (cheap, transform/scale). LCP: destination element should be the LCP and load fast. INP: minimal. CLS: none if names unique per transition.
- **ACCESSIBILITY CONSIDERATION:** `view-transition-name` must be unique at any moment; duplicate names throw. Reduced motion → instant. Keyboard/AT: continuity is cosmetic; ensure focus lands on the new page's main heading.
- **WHEN TO USE:** Product grids → detail pages, card → expanded.
- **WHEN NOT TO USE:** Sites without a clear source→destination pair.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required.
- **DEGRADATION LADDER:** JS off/unsupported/reduced motion → normal navigation.

### T3 — Route Crossfade
- **CONCEPT:** Content opacity crossfades when switching in-page sections/routes.
- **USER PURPOSE:** Soft section changes without layout jump.
- **VISUAL EFFECT:** Old section fades out, new fades in (often with a short hold).
- **TECHNICAL IMPLEMENTATION:** CSS `transition: opacity` toggled by a state class (`:target` hack is CSS-only; a real router needs JS to toggle). Declarative `:target` + `opacity` works without JS for anchor-driven sections.
- **PERFORMANCE COST:** <0.3 KB. Opacity-only = composited. LCP/CLS/INP: none if no layout shift. Keep both sections absolutely positioned during crossfade to avoid CLS.
- **ACCESSIBILITY CONSIDERATION:** Maintain focus on the newly shown section; `aria-hidden` the fading-out one. Reduced motion → instant switch (no crossfade). Keyboard: `:target` path is fully keyboard-operable.
- **WHEN TO USE:** Tab-like in-page section switching.
- **WHEN NOT TO USE:** When a real page navigation is clearer.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** Partial — `:target`-based crossfade is CSS-only; a JS router gives smoother control. Static fallback: sections show on anchor.
- **DEGRADATION LADDER:** JS off → `:target` crossfade still works. Reduced motion → instant.

---

# CATEGORY: MASKS

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| MK1 | Gradient Text Mask | CSS-only | K2 |
| MK2 | Clipped Reveal Mask | CSS-only | K2 |
| MK3 | SVG Mask Wipe | CSS-only | K3 |

### MK1 — Gradient Text Mask
- **CONCEPT:** Text filled with a gradient or image via clipping.
- **USER PURPOSE:** Brand-tinted, premium typography.
- **VISUAL EFFECT:** Headline rendered in a gradient/photo fill.
- **TECHNICAL IMPLEMENTATION:** `background: <gradient>; -webkit-background-clip: text; color: transparent;` (or `background-clip: text`). Pure CSS.
- **PERFORMANCE COST:** <0.2 KB. Paint cost trivial on modern GPUs. LCP/CLS/INP: none (text still real text). Ensure sufficient contrast for WCAG.
- **ACCESSIBILITY CONSIDERATION:** Text remains real, selectable, screen-reader text — good. **Contrast is the trap**: gradient fills often fail WCAG AA; keep one stop dark enough or add a subtle text-shadow. Reduced motion: unaffected.
- **WHEN TO USE:** Hero headlines, logos, section titles.
- **WHEN NOT TO USE:** Body copy or any text that must meet strict contrast (use solid colour).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only (`background-clip: text`).
- **DEGRADATION LADDER:** No clip support (ancient) → solid `color` fallback. Reduced motion → unaffected.

### MK2 — Clipped Reveal Mask
- **CONCEPT:** Content is revealed by animating a `clip-path`/mask shape.
- **USER PURPOSE:** Shaped entrances (circle expand, diagonal wipe) for images/sections.
- **VISUAL EFFECT:** Element appears through a growing/shifting mask.
- **TECHNICAL IMPLEMENTATION:** CSS `clip-path: inset()/circle()` or `mask` animated via `@keyframes` or `scroll()` `view()`. CSS-only.
- **PERFORMANCE COST:** ~0.4 KB. `clip-path` is composited on most browsers. LCP: don't gate above-fold LCP behind a mask reveal. CLS: container reserves box. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Mask is visual; ensure content is in DOM for AT and shown when reduced-motion. Reduced motion → reveal fully, no wipe. Don't mask essential controls.
- **WHEN TO USE:** Image/section entrances, before/after reveals.
- **WHEN NOT TO USE:** Body text (obscures reading); above-fold LCP.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only (`clip-path`/`mask` + `view()`).
- **DEGRADATION LADDER:** No mask/clip support → content visible. Reduced motion → visible.

### MK3 — SVG Mask Wipe
- **CONCEPT:** An SVG mask defines a non-rectangular reveal (e.g. organic edge, logo-shaped).
- **USER PURPOSE:** Distinctive, brand-shaped transitions.
- **VISUAL EFFECT:** Content wiped by an SVG path/shape mask.
- **TECHNICAL IMPLEMENTATION:** CSS `mask: url(#svgMask)` with an animated `<mask>` (SMIL or CSS on the mask geometry), or `clip-path: url(#shape)`. CSS-only for static; animating the SVG mask shape may need SMIL/CSS.
- **PERFORMANCE COST:** ~0.5 KB + SVG. Vector masks are cheap. LCP/CLS: none if box reserved. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Same as MK2 — content must be AT-accessible; reduced-motion → full reveal. Keep the mask from hiding focusable content at rest.
- **WHEN TO USE:** Brand-shaped heroes, signature transitions.
- **WHEN NOT TO USE:** Utility pages; where a simple fade suffices.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** CSS-only (static mask; shape animation via CSS/SMIL, no JS runtime needed).
- **DEGRADATION LADDER:** No mask support → content visible. Reduced motion → visible.

---

# CATEGORY: IMAGE DISTORTION

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| ID1 | Hover Displacement | JS-required | K3 |
| ID2 | Liquid Image Filter | JS-required | K3 |
| ID3 | RGB Split | Partial | K3 |

### ID1 — Hover Displacement
- **CONCEPT:** An image warps/distorts under the cursor on hover.
- **USER PURPOSE:** Tactile, "liquid" image interactivity on expressive sites.
- **VISUAL EFFECT:** Pixels displaced around the pointer (ripple/lens).
- **TECHNICAL IMPLEMENTATION:** WebGL/Canvas shader sampling the image with a displacement map modulated by pointer position (Pointer Events feed uniforms). JS + GPU runtime required.
- **PERFORMANCE COST:** **High** — WebGL context + per-frame shader (2–6 ms GPU). Risk to INP/LCP if context created late. Memory: texture upload. CLS: none (fixed frame). Only on hover (idle otherwise).
- **ACCESSIBILITY CONSIDERATION:** Purely decorative; the static image must convey the content at rest. Keyboard users get no distortion — ensure the control/link is usable without it. Reduced motion → disable distortion (static image). Touch → no hover; show static.
- **WHEN TO USE:** Portfolio/brand image grids where the effect is the point.
- **WHEN NOT TO USE:** Product images where accurate representation matters (distortion misleads); conversion sites.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required (WebGL/Canvas). Static HTML shows the un-distorted image.
- **DEGRADATION LADDER:** JS off/reduced motion/touch → clean static image (correct).

### ID2 — Liquid Image Filter
- **CONCEPT:** Continuous flowing distortion (e.g. flowing water/heat) over an image.
- **USER PURPOSE:** Living, ambient imagery.
- **VISUAL EFFECT:** Perpetual subtle warp via animated noise displacement.
- **TECHNICAL IMPLEMENTATION:** WebGL fragment shader with time-animated noise sampling the texture. JS + GPU runtime.
- **PERFORMANCE COST:** **High and continuous** — runs every frame even when idle (battery/GPU drain). 3–8 ms GPU. Strongly affects mobile battery and can hurt INP. CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Continuous motion is the **worst** vestibular case — must be off under `prefers-reduced-motion` (show static image). Can distract AT users. Never on text-bearing images. Provide a static poster.
- **WHEN TO USE:** Rarely; ambient brand backdrops only.
- **WHEN NOT TO USE:** Almost all business sites — high cost, low value, accessibility risk (K4-leaning).
- **KNOWLEDGE CLASS:** K3 (often K4 in business context).
- **NO-JS FEASIBILITY:** JS-required. Static poster image is the no-JS baseline.
- **DEGRADATION LADDER:** JS off/reduced motion → static poster. Touch → static.

### ID3 — RGB Split
- **CONCEPT:** Red/blue channel offset creates a chromatic-aberration / glitch look.
- **USER PURPOSE:** Editorial/retro/glitch aesthetic on images or text.
- **VISUAL EFFECT:** Colour fringes separating on hover or scroll.
- **TECHNICAL IMPLEMENTATION:** **CSS approximation:** stack 3 copies of the image with `mix-blend-mode` and offset `translate` on hover (no JS). True per-pixel RGB split needs a WebGL shader (JS).
- **PERFORMANCE COST:** CSS path ~0.5 KB, composited (cheap). Shader path high (see ID1/ID2). LCP/CLS: none. INP: none for CSS.
- **ACCESSIBILITY CONSIDERATION:** Fringing reduces legibility — avoid on text/essential images. Reduced motion → no animated split (static or none). Keyboard parity for hover triggers.
- **WHEN TO USE:** Stylised hero images, logos, glitch sections.
- **WHEN NOT TO USE:** Product/people photos where accurate colour matters; any essential text.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** Partial — CSS layered-blend split is CSS-only; true shader split is JS-required. Static fallback: single clean image.
- **DEGRADATION LADDER:** JS off → CSS layered split works; reduced motion → static.

# CATEGORY: CANVAS

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| CV1 | Canvas Particle Field | JS-required | K3 |
| CV2 | Canvas Trail | JS-required | K4 |
| CV3 | Canvas Noise Grain | JS-required | K3 |

### CV1 — Canvas Particle Field
- **CONCEPT:** Hundreds of drifting particles on a `<canvas>` backdrop.
- **USER PURPOSE:** Ambient, premium "alive" background.
- **VISUAL EFFECT:** Slow-moving dots/lines; optional pointer attraction.
- **TECHNICAL IMPLEMENTATION:** Canvas2D `requestAnimationFrame` loop drawing particles; optional Pointer Events for interaction. JS runtime required.
- **PERFORMANCE COST:** **High** — per-frame redraw of N particles (N=150 ≈ 1–3 ms; N=400 ≈ 4–8 ms GPU/CPU). Cap N by viewport; pause when off-screen (`IntersectionObserver`). CLS: none (fixed canvas). LCP: ensure canvas isn't the LCP. INP: loop competes for main thread.
- **ACCESSIBILITY CONSIDERATION:** Decorative — `aria-hidden`, behind content, never trapping focus. Reduced motion → render a single static frame (no loop) or omit. Touch → no pointer interaction; static ok.
- **WHEN TO USE:** Brand hero backdrops where ambiance is the message.
- **WHEN NOT TO USE:** Conversion sites (cost, no value); low-power devices.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. No-JS → a static CSS gradient/image backdrop replaces it.
- **DEGRADATION LADDER:** JS off/reduced motion → static backdrop. Low-end → fewer particles or static.

### CV2 — Canvas Trail
- **CONCEPT:** Pointer leaves a fading canvas stroke behind it.
- **VISUAL EFFECT:** Glowing comet trail following the cursor.
- **TECHNICAL IMPLEMENTATION:** Canvas2D, Pointer Events appending points, fade via low-alpha clear each frame. JS-only.
- **PERFORMANCE COST:** Moderate–high (per-frame redraw + fade). Like CV1. INP: pointer handler should be light.
- **ACCESSIBILITY CONSIDERATION:** Pure decoration; vestibular/distraction risk — reduced-motion → off. Touch → no trail. Never over interactive content.
- **WHEN TO USE:** Rare expressive showcases.
- **WHEN NOT TO USE:** Business sites — classic K4 slop.
- **KNOWLEDGE CLASS:** K4 (anti-knowledge in business contexts).
- **NO-JS FEASIBILITY:** JS-required. No-JS → nothing (baseline correct).
- **DEGRADATION LADDER:** JS off/reduced motion/touch → no trail.

### CV3 — Canvas Noise Grain
- **CONCEPT:** A subtle film-grain/noise overlay across the page or a section.
- **USER PURPOSE:** Tactile, analogue texture; unifies composited imagery.
- **VISUAL EFFECT:** Fine animated (or static) grain.
- **TECHNICAL IMPLEMENTATION:** Canvas2D drawing random noise, or a pre-rendered noise PNG with `mix-blend-mode: overlay` (the PNG path is CSS-only and cheaper). Animated grain needs JS.
- **PERFORMANCE COST:** Animated: per-frame noise redraw is **expensive** (use a small tile + `background-position` jitter, or pre-baked frames). Static PNG grain: negligible. LCP/CLS: none. INP: only if animated via JS.
- **ACCESSIBILITY CONSIDERATION:** Grain can reduce contrast/legibility — keep opacity <8%. Reduced motion → use static grain or none. Don't grain over text.
- **WHEN TO USE:** Editorial/brand sites for texture.
- **WHEN NOT TO USE:** High-contrast-required pages; conversion sites.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** Partial — static PNG grain is CSS-only; animated grain is JS-required. Degrades to solid/static.
- **DEGRADATION LADDER:** JS off → static grain or none. Reduced motion → static.

---

# CATEGORY: WEBGL

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| WG1 | WebGL Image Hover Effect | JS-required | K3 |
| WG2 | WebGL Fluid Background | JS-required | K4 |
| WG3 | WebGL Displacement | JS-required | K3 |

### WG1 — WebGL Image Hover Effect
- **CONCEPT:** Rich shader-based image treatment reacting to hover (e.g. RGB shift, refraction).
- **USER PURPOSE:** Premium, differentiated image interaction.
- **VISUAL EFFECT:** Shader-driven morph/colour response under cursor.
- **TECHNICAL IMPLEMENTATION:** WebGL renderer (Three.js / OGL / raw) with a fragment shader sampling the texture, uniforms from Pointer Events. JS + GPU runtime.
- **PERFORMANCE COST:** **High** — context init + per-frame shader on hover (2–6 ms GPU). Only active on hover (idle otherwise). Memory: texture. CLS: none. LCP: ensure image LCP loads via `<img>` first, then enhance.
- **ACCESSIBILITY CONSIDERATION:** Decorative; static `<img>` must be the accessible, indexed content. Reduced motion → static image. Touch → static. Keyboard usable without effect.
- **WHEN TO USE:** High-end brand/portfolio image grids.
- **WHEN NOT TO USE:** Product accuracy sites; conversion pages.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. The repo's no-JS renderer ships the plain `<img>`.
- **DEGRADATION LADDER:** JS off/reduced motion/touch → clean static image (correct).

### WG2 — WebGL Fluid Background
- **CONCEPT:** A perpetually flowing fluid/smoke simulation behind content.
- **USER PURPOSE:** Living, mesmerising backdrop.
- **VISUAL EFFECT:** Continuous fluid colour motion.
- **TECHNICAL IMPLEMENTATION:** WebGL Navier–Stokes-ish shader loop (e.g. WebGL-Fluid). JS + heavy GPU runtime.
- **PERFORMANCE COST:** **Very high and continuous** — 6–15 ms GPU/frame, major battery drain, competes with INP. Not suitable for most production business sites on mobile.
- **ACCESSIBILITY CONSIDERATION:** Worst-case continuous motion — must be fully off under `prefers-reduced-motion` (static gradient). Distracting to AT. Never behind text without a calm fallback.
- **WHEN TO USE:** Almost never in BusinessForge's local-business scope.
- **WHEN NOT TO USE:** Essentially all conversion-critical sites (K4).
- **KNOWLEDGE CLASS:** K4.
- **NO-JS FEASIBILITY:** JS-required. Static gradient is the baseline.
- **DEGRADATION LADDER:** JS off/reduced motion → static gradient. Low-end → static.

### WG3 — WebGL Displacement
- **CONCEPT:** A displacement-map shader warps imagery/type on scroll or hover.
- **USER PURPOSE:** Signature liquid/refraction transitions.
- **VISUAL EFFECT:** Image melts/refracts between states.
- **TECHNICAL IMPLEMENTATION:** WebGL shader using a displacement texture, progress from scroll (`scroll()`-equivalent fed via JS) or pointer. JS + GPU.
- **PERFORMANCE COST:** **High** — shader + texture sampling per frame during the effect (3–8 ms GPU). Idle otherwise. CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Decorative; the underlying content must be AT-accessible and legible at rest. Reduced motion → static. Keep distortion away from essential text/controls.
- **WHEN TO USE:** Brand showcase transitions, hero reveals.
- **WHEN NOT TO USE:** Utility/business pages.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. Static image/text is the baseline.
- **DEGRADATION LADDER:** JS off/reduced motion → static content.

---

# CATEGORY: 3D

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| 3D1 | CSS 3D Tilt Card | Partial | K2 |
| 3D2 | Three.js Product Spin | JS-required | K3 |
| 3D3 | Scroll-driven 3D Scene | JS-required | K3 |

### 3D1 — CSS 3D Tilt Card
- **CONCEPT:** A card tilts in 3D space (perspective rotateX/rotateY).
- **USER PURPOSE:** Tactile depth on hover; "pick it up".
- **VISUAL EFFECT:** Card rotates toward the pointer (or a fixed tilt at rest).
- **TECHNICAL IMPLEMENTATION:** `transform: perspective(800px) rotateX() rotateY()` — a **static tilt is pure CSS**; pointer-following tilt needs JS (Pointer Events → transform). `transform-style: preserve-3d` for child depth.
- **PERFORMANCE COST:** <0.3 KB. Transform-only = composited, cheap. LCP/CLS: none. INP: none for static; JS path trivial.
- **ACCESSIBILITY CONSIDERATION:** Static tilt fine; pointer-tilt must have `:focus-visible` parity and reduced-motion → static tilt or none. Ensure tilt doesn't break the 44px target or text legibility. Keyboard usable.
- **WHEN TO USE:** Product/feature cards on brand sites.
- **WHEN NOT TO USE:** Dense data tables; conversion forms (distraction).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** Partial — static CSS tilt is CSS-only; pointer-driven tilt is JS-required. Degrades to flat/static card.
- **DEGRADATION LADDER:** JS off → static tilt or flat. Reduced motion → static.

### 3D2 — Three.js Product Spin
- **CONCEPT:** A real-time 3D product model the user rotates (360°).
- **USER PURPOSE:** Inspect a product from all angles before enquiring.
- **VISUAL EFFECT:** Draggable 3D object on a canvas.
- **TECHNICAL IMPLEMENTATION:** Three.js (or OGL) loading a glTF, `OrbitControls`/Pointer Events for rotation. JS + WebGL runtime; large asset (glTF + textures, 0.5–5 MB).
- **PERFORMANCE COST:** **Very high** — WebGL + multi-MB asset hurts LCP/bandwidth; decode on main thread. Only load on intent (don't auto-load above fold). CLS: reserve canvas box. INP: drag is fine; init can spike.
- **ACCESSIBILITY CONSIDERATION:** Provide a static hero image + alt as the baseline; the 3D view is an enhancement. Keyboard rotate controls (arrow keys) required (WCAG 2.1.1). Reduced motion → allow manual rotate only, no auto-spin. Label the canvas.
- **WHEN TO USE:** Higher-tier product/businesses where 3D inspection adds real value (cars, furniture, architecture).
- **WHEN NOT TO USE:** Most local services — over-engineering (K4-leaning) and a bandwidth tax.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. Static product photo is the no-JS baseline.
- **DEGRADATION LADDER:** JS off → static photo. Reduced motion → no auto-spin. Low-end → static.

### 3D3 — Scroll-driven 3D Scene
- **CONCEPT:** A 3D scene progresses with scroll (camera moves through it).
- **USER PURPOSE:** Cinematic scroll storytelling in 3D.
- **VISUAL EFFECT:** World rotates/pans as you scroll.
- **TECHNICAL IMPLEMENTATION:** Three.js with camera/uniforms driven by scroll position (JS reads scroll and updates the scene each frame). JS + WebGL.
- **PERFORMANCE COST:** **Very high** — continuous render on scroll; 5–12 ms GPU. Risk to INP/LCP. Reserve canvas; throttle render to scroll events via rAF.
- **ACCESSIBILITY CONSIDERATION:** Reduced motion → show a single static representative frame (no scroll-linked motion). Keyboard users can't "scroll" a 3D world easily — provide the narrative in text too. Vestibular risk high.
- **WHEN TO USE:** Flagship brand narratives.
- **WHEN NOT TO USE:** Conversion/business sites.
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. Static poster frame is the baseline.
- **DEGRADATION LADDER:** JS off/reduced motion → static frame. Low-end → static.

---

# CATEGORY: AUDIO

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| AU1 | Hover Sound | JS-required | K4 |
| AU2 | Ambient Background Audio | JS-required | K4 |
| AU3 | Audio-reactive Visual | JS-required | K3 |

### AU1 — Hover Sound
- **CONCEPT:** A short UI sound plays on hover/click of elements.
- **USER PURPOSE:** Game-like feedback; "things respond".
- **VISUAL EFFECT:** None (audio); paired with hover state.
- **TECHNICAL IMPLEMENTATION:** Web Audio API (or `<audio>`), triggered by Pointer Events/`mouseenter`. JS runtime + a user-gesture unlock for autoplay policies.
- **PERFORMANCE COST:** Audio decode tiny; the JS + gesture handling is the cost. LCP/CLS: none. INP: minimal if pre-decoded.
- **ACCESSIBILITY CONSIDERATION:** **Almost always inappropriate** — unexpected sound violates user control and startles AT/screen-reader users and those with auditory sensitivities. If ever used, require explicit opt-in and a global mute, and never auto-play. WCAG 2.2.2 (pause/stop). Reduced motion is irrelevant; "reduced sound" isn't a media query — must be a control.
- **WHEN TO USE:** Effectively never in BusinessForge's scope.
- **WHEN NOT TO USE:** All conversion/business sites (K4 anti-knowledge).
- **KNOWLEDGE CLASS:** K4.
- **NO-JS FEASIBILITY:** JS-required. No sound at all is the correct baseline.
- **DEGRADATION LADDER:** JS off → silence. Any user setting → mute available.

### AU2 — Ambient Background Audio
- **CONCEPT:** Quiet music/ambience loops behind the site.
- **USER PURPOSE:** Mood-setting (rarely justified).
- **VISUAL EFFECT:** None.
- **TECHNICAL IMPLEMENTATION:** `<audio loop>` or Web Audio; autoplay is blocked without a gesture, so a play button/opt-in is required. JS.
- **PERFORMANCE COST:** Streaming audio uses bandwidth; otherwise light. LCP/CLS/INP: none.
- **ACCESSIBILITY CONSIDERATION:** Autoplaying audio is a well-known accessibility and UX failure; browsers block it. If present, must be behind an explicit, obvious control with pause. Distracting for AT users. Strongly K4 on business sites.
- **WHEN TO USE:** Never in local-business scope.
- **WHEN NOT TO USE:** Everything BusinessForge targets (K4).
- **KNOWLEDGE CLASS:** K4.
- **NO-JS FEASIBILITY:** JS-required. Silence is the baseline.
- **DEGRADATION LADDER:** JS off / no gesture → no audio.

### AU3 — Audio-reactive Visual
- **CONCEPT:** Visuals (canvas/WebGL) pulse to playing audio via frequency analysis.
- **USER PURPOSE:** Music-led brand experiences.
- **VISUAL EFFECT:** Bars/shapes driven by an FFT of the audio.
- **TECHNICAL IMPLEMENTATION:** Web Audio `AnalyserNode` + `getByteFrequencyData` feeding a Canvas/WebGL render loop. JS + Audio + GPU.
- **PERFORMANCE COST:** **High** — audio analysis + per-frame render (combined 4–10 ms). Only when audio plays. CLS: none.
- **ACCESSIBILITY CONSIDERATION:** Requires playing audio (see AU1/AU2 risks). Provide a non-audio static visual state. Reduced motion → static visual (audio may continue if user opted in). Keyboard controls for play/pause required.
- **WHEN TO USE:** Musician/event brand sites only.
- **WHEN NOT TO USE:** Business/local sites (K4-leaning).
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. Static visual is the baseline.
- **DEGRADATION LADDER:** JS off / no audio → static visual.

---

# CATEGORY: FORM INTERACTION

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| F1 | Floating Label | CSS-only | K2 |
| F2 | Inline Validation | Partial | K2 |
| F3 | Multi-step Wizard | JS-required | K2 |

### F1 — Floating Label
- **CONCEPT:** A field's placeholder text lifts to become a persistent label on focus/fill.
- **USER PURPOSE:** Save space while keeping labels visible (no lost context).
- **VISUAL EFFECT:** Label animates from inside the input to above it.
- **TECHNICAL IMPLEMENTATION:** CSS `:placeholder-shown` + `:focus` + `:not(:placeholder-shown)` moving a `<label>` via `transform`. **Pure CSS, no JS.**
- **PERFORMANCE COST:** <0.2 KB. Transform-only, composited. LCP/CLS/INP: none.
- **ACCESSIBILITY CONSIDERATION:** Label must remain a real associated `<label>` (not just placeholder) for screen readers — CSS-only approach keeps it as a true label. Don't drop the label entirely when empty. Reduced motion → instant move ok. Keep 44px targets.
- **WHEN TO USE:** Compact, elegant forms (contact, enquiry).
- **WHEN NOT TO USE:** Forms where always-visible labels aid clarity (long/complex forms) — then a static top label is clearer.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only (`:placeholder-shown` + `:focus`).
- **DEGRADATION LADDER:** No `:placeholder-shown` (ancient) → label always above (fine). Reduced motion → instant.

### F2 — Inline Validation
- **CONCEPT:** Fields validate and show feedback as the user types/leaves.
- **USER PURPOSE:** Catch errors early; reduce submit failures.
- **VISUAL EFFECT:** Field border turns red/green; message appears below.
- **TECHNICAL IMPLEMENTATION:** CSS `:valid`/`:invalid`/`:user-invalid` for styling (CSS-only for the visual). Custom messages + async (e.g. "email taken") need JS. `:user-invalid` avoids flagging empty fields on load.
- **PERFORMANCE COST:** <0.3 KB CSS; JS path small. LCP/CLS: avoid layout shift from message insertion (reserve space). INP: none.
- **ACCESSIBILITY CONSIDERATION:** **Critical:** pair colour with text/icon (not colour alone — WCAG 1.4.1). Link message to input via `aria-describedby`. Use `:user-invalid` so users aren't scolded before interacting. Announce errors on submit via `aria-live`. Reduced motion → instant.
- **WHEN TO USE:** Any form with non-trivial rules.
- **WHEN NOT TO USE:** Trivial single-field forms (overkill), but validation is rarely wrong.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** Partial — CSS `:valid`/`:user-invalid` styling is CSS-only; custom/async messages are JS-required. Degrades to native browser validation.
- **DEGRADATION LADDER:** JS off → native validation + CSS styling. Reduced motion → instant.

### F3 — Multi-step Wizard
- **CONCEPT:** A form split into sequential steps with progress.
- **USER PURPOSE:** Reduce perceived length; guide complex submissions.
- **VISUAL EFFECT:** Step panels swap; progress indicator advances.
- **TECHNICAL IMPLEMENTATION:** State machine in JS toggling step visibility; progress via `aria` + CSS. Requires a JS runtime for step logic (CSS `:target` can fake simple prev/next but breaks on refresh/back).
- **PERFORMANCE COST:** ~2–4 KB JS. Tiny render cost. LCP/CLS: reserve step container height to avoid shift. INP: minimal.
- **ACCESSIBILITY CONSIDERATION:** **Essential:** announce step changes (`aria-live`), keep a logical focus move to the new step's heading, allow back/forward, persist data if a step is invalid, and never hide errors. Keyboard fully operable. Reduced motion → instant step swap.
- **WHEN TO USE:** Multi-field quote/booking/enquiry flows.
- **WHEN NOT TO USE:** Short forms (a wizard adds friction); then one screen is better.
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** JS-required for real step logic; a CSS `:target` fallback is fragile. No-JS → a single long form is the robust baseline.
- **DEGRADATION LADDER:** JS off → single-page form. Reduced motion → instant swaps.

# CATEGORY: DATA VISUALIZATION

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| DV1 | Animated Bar Chart | CSS-only | K2 |
| DV2 | Scroll-linked Line Chart | CSS-only | K2 |
| DV3 | Interactive Map | JS-required | K2 |

### DV1 — Animated Bar Chart
- **CONCEPT:** Bars grow from zero to value on reveal.
- **USER PURPOSE:** Make statistics feel earned; compare at a glance.
- **VISUAL EFFECT:** Bars rise/fill as the chart enters view.
- **TECHNICAL IMPLEMENTATION:** CSS `height`/`transform: scaleY` animated via `animation-timeline: view()` (CSS-only) — bars grow when scrolled into view. Pure CSS.
- **PERFORMANCE COST:** <0.4 KB. Transform/height composited. LCP: don't gate the headline stat behind it. CLS: reserve chart box so bars don't push layout. INP: none.
- **ACCESSIBILITY CONSIDERATION:** **Data must exist as real text/table** for screen readers — the bars are a visualisation, not the data (WCAG 1.1.1). Provide `<table>` or `aria` labels with the values. Reduced motion → bars shown at final value immediately.
- **WHEN TO USE:** Stats/impact/credibility sections.
- **WHEN NOT TO USE:** When a plain number + label communicates better (don't chart one stat).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `view()` (values present in DOM as text regardless).
- **DEGRADATION LADDER:** No `view()` → bars at final value. Reduced motion → final value. JS off → still works.

### DV2 — Scroll-linked Line Chart
- **CONCEPT:** A line path draws itself as the user scrolls.
- **USER PURPOSE:** Reveal a trend progressively; tie motion to reading.
- **VISUAL EFFECT:** `stroke-dashoffset` animates from full to zero, "drawing" the line.
- **TECHNICAL IMPLEMENTATION:** SVG `<path>` with `stroke-dasharray`/`stroke-dashoffset` animated by `animation-timeline: scroll()` (CSS-only). No JS.
- **PERFORMANCE COST:** <0.4 KB. Vector stroke animation is cheap. LCP/CLS: reserve SVG box. INP: none.
- **ACCESSIBILITY CONSIDERATION:** Same as DV1 — the underlying values must be in a real table/text for AT. Reduced motion → line shown complete. Don't rely on the draw to convey the trend (it's decorative).
- **WHEN TO USE:** Trend/performance sections, case-study results.
- **WHEN NOT TO USE:** Precise data the user must read exactly (static labelled chart is clearer).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `scroll()` on SVG stroke.
- **DEGRADATION LADDER:** No `scroll()` → complete line shown. Reduced motion → complete. JS off → works.

### DV3 — Interactive Map
- **CONCEPT:** A map with hover/click regions revealing data (locations, coverage).
- **USER PURPOSE:** Spatial exploration of multi-location businesses or service areas.
- **VISUAL EFFECT:** Regions highlight; tooltips/panels show info on interaction.
- **TECHNICAL IMPLEMENTATION:** SVG map with `:hover`/`:focus` CSS highlighting (CSS-only for the visual) + `<title>`/`<desc>` for AT; full pan/zoom/click-filtering needs JS. A static `<img>` map with a list of locations is the no-JS baseline.
- **PERFORMANCE COST:** SVG hover is free; JS pan/zoom adds ~2–5 KB. LCP: a simplified static map image first. CLS: reserve map box. INP: minimal for CSS path.
- **ACCESSIBILITY CONSIDERATION:** **Critical:** a map is not accessible to AT as geometry — must provide an equivalent **list/table of locations** (addresses, links). Keyboard-focusable regions with `:focus` styles. Reduced motion → no animated pan. Never make the map the only way to find a location.
- **WHEN TO USE:** Multi-location businesses, service-area explainers.
- **WHEN NOT TO USE:** Single-location business (a static address + embed suffices).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** Partial — CSS `:hover`/`:focus` highlight is CSS-only; pan/zoom/filtering is JS-required. Static map image + location list is the robust no-JS baseline.
- **DEGRADATION LADDER:** JS off → static map + full location list. Reduced motion → no animated pan.

---

# CATEGORY: PRODUCT CONFIGURATORS

| ID | Variant | JS? | Class |
|----|---------|-----|-------|
| PC1 | Color/Swatch Picker | CSS-only | K2 |
| PC2 | 3D Model Configurator | JS-required | K3 |
| PC3 | Option Builder | JS-required | K2 |

### PC1 — Color/Swatch Picker
- **CONCEPT:** User picks a colour/swatch and the displayed product updates.
- **USER PURPOSE:** See variants before enquiring/ordering.
- **VISUAL EFFECT:** Selected swatch highlights; product image/swatch preview changes.
- **TECHNICAL IMPLEMENTATION:** Hidden `<input type="radio">` + `:checked ~` sibling selectors swap a visible image/swatch via CSS `display`/`opacity`. **Pure CSS, no JS.** Accessible by default (radios are keyboard-operable).
- **PERFORMANCE COST:** <0.3 KB. Display toggle only. LCP/CLS/INP: none.
- **ACCESSIBILITY CONSIDERATION:** Use real radio inputs with associated labels (keyboard + screen reader native). Indicate selection beyond colour (checkmark/ring) — WCAG 1.4.1. Reduced motion → instant swap. Ensure the chosen variant is announced (radios do this natively).
- **WHEN TO USE:** Products with colour/finish variants (salons, paint, food options, vehicles).
- **WHEN NOT TO USE:** Single-variant offerings (no choice to make).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** CSS-only via `:checked` + sibling selectors — achievable in the static renderer today.
- **DEGRADATION LADDER:** No `:checked` sibling support (ancient) → all variants visible/stacked. Reduced motion → instant.

### PC2 — 3D Model Configurator
- **CONCEPT:** A 3D product the user customises (colour, parts, materials) in real time.
- **USER PURPOSE:** Fully explore a configurable product before enquiring.
- **VISUAL EFFECT:** Live 3D model reflecting each option choice.
- **TECHNICAL IMPLEMENTATION:** Three.js scene with swappable materials/meshes driven by control state. JS + WebGL + multi-MB assets.
- **PERFORMANCE COST:** **Very high** — WebGL + assets (see 3D2). Load on intent. CLS: reserve canvas. INP: interaction is fine; init spikes.
- **ACCESSIBILITY CONSIDERATION:** Provide a static image per configuration + alt as baseline; the 3D view is an enhancement. Keyboard-operable controls (radios/buttons) that also drive the model. Reduced motion → no auto-rotate. Label everything.
- **WHEN TO USE:** Higher-tier configurable products (cars, furniture, builders).
- **WHEN NOT TO USE:** Most local services — over-engineering + bandwidth tax (K4-leaning).
- **KNOWLEDGE CLASS:** K3.
- **NO-JS FEASIBILITY:** JS-required. Static per-option images are the no-JS baseline.
- **DEGRADATION LADDER:** JS off → static images per option. Reduced motion → no auto-rotate. Low-end → static.

### PC3 — Option Builder
- **CONCEPT:** User assembles a package from options (add-ons, tiers) with live price/summary.
- **USER PURPOSE:** Self-serve quoting/configuration before enquiry.
- **VISUAL EFFECT:** Selections update a summary panel and running total.
- **TECHNICAL IMPLEMENTATION:** State in JS computing the summary; controls are native checkboxes/radios (keyboard-accessible). A CSS-only `:checked` + `counter()` can show a *count* but not arithmetic pricing — real price math is JS.
- **PERFORMANCE COST:** ~2–4 KB JS. Tiny. LCP/CLS: reserve summary box. INP: minimal.
- **ACCESSIBILITY CONSIDERATION:** Build on native checkboxes/radios (keyboard + AT free). Announce summary/price changes via `aria-live`. Keep focus order logical. Reduced motion → instant updates.
- **WHEN TO USE:** Services with optional add-ons (catering, events, packages).
- **WHEN NOT TO USE:** Fixed-scope offerings (a single price is clearer).
- **KNOWLEDGE CLASS:** K2.
- **NO-JS FEASIBILITY:** JS-required for price arithmetic; the controls (checkboxes/radios) and labels are HTML, so a no-JS fallback is a plain form that submits for a quote.
- **DEGRADATION LADDER:** JS off → static form (submit for quote). Reduced motion → instant.

---

# FINAL — Interactions forbidden on conversion-critical local-business sites

These patterns are **K4 anti-knowledge** for the local-business / conversion-critical segment BusinessForge primarily serves. Using them is a defect regardless of execution quality, because they trade revenue for flourish.

1. **Brand Reveal Preloader (L3)** — a 1.5–3 s logo wall in front of "Call now / Open hours" is a direct conversion leak. Suppress when `SUPPRESSED_WHEN`: the site's primary job is a phone/visit/enquiry action.
2. **Custom / Magnetic / Trail cursors (C1–C3, M1–M2)** — hide the native pointer, hurt form usability, and signal "agency showreel" not "get me a service". Suppress on utility/conversion pages.
3. **Infinite Scroll (S2)** — hides the footer CTA, contact info, and "reach end" for screen-reader users. Suppress when content is finite and the footer/contact is conversion-critical.
4. **Continuous WebGL/Canvas motion (WG2, ID2, CV2, AU1–AU2)** — fluid backgrounds, liquid image filters, cursor trails, background audio: continuous GPU/battery drain and the worst vestibular/AT risks. Suppress on all business sites.
5. **Hover/ambient sound (AU1–AU2)** — unexpected audio startles and is broadly forbidden by autoplay policy and WCAG 2.2.2. Suppress everywhere in scope.
6. **Horizontal Scroll Pin / Scroll-driven 3D (PN2, 3D3)** — disorienting vertical→horizontal or 3D-world mapping; suppress when the user needs to find one specific thing fast.
7. **Parallax on text-bearing or hero LCP layers (P1–P3)** — delays/obscures the money message and risks vestibular discomfort. Suppress on conversion heroes; if used at all, keep movement <40px and freeze under reduced-motion.
8. **Above-fold reveal-gating (R1–R3, MK2)** — never hide the hero/CTA behind a scroll or mask reveal; it harms LCP and conversion. Suppress above the fold.

**Override rule (from `KNOWLEDGE_TAXONOMY.md`):** a K4 suppression may be overridden only with explicit, evidence-backed intent (e.g. a deliberately brand-led launch microsite where the brief documents conversion is *not* the primary job). Absent that, suppression is a gate, not a suggestion.

---

# FINAL — The accessibility floor (no interaction may breach this)

Regardless of class, trend, or art direction, the following are **K1 invariants** — non-negotiable, gate-level, overridable by nobody. A violation is a build failure.

- **AF1 — Keyboard parity.** Every interaction available to a pointer user must be operable by keyboard (WCAG 2.1.1). Hover-only menus, drag-only controls, and pointer-locked effects fail. *No-JS renderer note:* this is why CSS `:focus-visible`, `:checked`, `popovertarget`, and `:target` paths are preferred — they are keyboard-native without a runtime.*
- **AF2 — `prefers-reduced-motion` compliance.** All motion, parallax, continuous animation, and transitions must be disabled or reduced under `prefers-reduced-motion: reduce` (WCAG 2.3.3 / 2.2.2). Vestibular-safe static state is the baseline.
- **AF3 — No colour-only signalling.** State (error/active/selected/disabled) must be conveyed by more than colour — add text, icon, underline, or shape (WCAG 1.4.1).
- **AF4 — Target size.** Interactive targets meet ≥44×44 CSS px (WCAG 2.5.8 / 2.5.5). Magnetic/drift effects must not shrink the effective hit area below this.
- **AF5 — Content is real and present.** Visual effects must not remove content from the DOM/AT. Reveal/mask/distortion layers sit over real text/images that screen readers and search engines receive. No `aria-hidden` on essential content.
- **AF6 — Focus order & visibility.** DOM/focus order stays logical; focus is always visible (`:focus-visible`); no interaction traps focus or scrolls the user unexpectedly (WCAG 2.4.3, 2.4.7).
- **AF7 — Honest state.** Loading/progress/validation states reflect reality (no fake determinate bars, no false "done"). Truthfulness is K1 (see `TRUTH_AND_EVIDENCE.md`).
- **AF8 — Performance as access.** LCP must not regress past the "good" threshold (<2.5 s) and CLS must stay <0.1; heavy JS/WebGL effects that break this on low-end devices deny access to slower users (WCAG 1.4.13 / perf equity). *No-JS renderer note:* the current static `lib/render/` output already satisfies the no-JS, fast-LCP, CLS-stable floor — interactions that require a JS runtime must not degrade it below this line.*

---

## Closing note

This library is a **research catalogue**, not an implementation spec. Every entry's `NO-JS FEASIBILITY` field tells the renderer team which techniques the current static `lib/render/` pipeline can already emit (CSS-only), which need only a graceful CSS static state (Partial), and which require a JS runtime the repo does not yet ship (JS-required). Pair this document with `KNOWLEDGE_TAXONOMY.md` (activation/suppression), `PERFORMANCE_KNOWLEDGE.md` (budget discipline), and `TRUTH_AND_EVIDENCE.md` (no invented claims). Do not implement against this file.

