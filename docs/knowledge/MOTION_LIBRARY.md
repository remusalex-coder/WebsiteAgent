# BusinessForge — Motion Library (Phase 9)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.** This document is a *principles* register for motion design — the doctrine that decides *whether, why, and how* anything on a site should move. It is not a CSS cookbook of fades and slides.
**Author role:** Research Director / Motion Knowledge Architect
**Date:** 2026-08-17
**Knowledge class mix:** **K1** (accessibility/vestibular law + no-JS-by-default constraint) **+ K2** (craft: pacing, easing, restraint) **+ K4** (anti-motion, prohibitive).
**Sibling docs:** `KNOWLEDGE_TAXONOMY.md` (K1–K4, ACTIVATES_WHEN / SUPPRESSED_WHEN), `INTERACTION_LIBRARY.md` (per-interaction *catalog* entries), `PERFORMANCE_KNOWLEDGE.md` (cost *budgets*), `ANTI_AI_SLOP.md` (A-13 meaningless animation). This document **owns the PRINCIPLES**; the interaction library owns individual technique entries; performance owns byte/ms cost ceilings. They are complementary, not overlapping.

---

## 0. Honesty note — verified vs synthesis

| Claim | Source | Verified live? |
|---|---|---|
| `prefers-reduced-motion` media query exists | `https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion` | **YES** — HTTP 301 (canonical redirect) on 2026-08-17 |
| CSS `easing-function` (incl. `cubic-bezier`, `linear`, `steps`) exists | `https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function` | **YES** — HTTP 301 on 2026-08-17 |
| `prefers-reduced-motion` guidance article | `https://web.dev/articles/prefers-reduced-motion` | **YES** — HTTP 200 on 2026-08-17 |
| Material Design 3 motion / understanding-motion page | `https://m3.material.io/styles/motion/understanding-motion` | **NO** — HTTP 404 on 2026-08-17; the URL does not resolve. Material easing *values* cited below are **UNVERIFIED** synthesis from established practice, not from a live page. |
| View Transitions API, Web Animations API, `scroll()`/`view()` timelines, IntersectionObserver, CSS `@property`, `scroll-snap` | MDN / web.dev (established platform features) | **UNVERIFIED** for live link — real, established APIs drawn from practice; doc URLs not re-checked live. |
| All millisecond durations, stagger formulae outputs, spring constants, and easing-to-meaning mappings | K2 engineering/craft synthesis | **UNVERIFIED as hard spec** — directional, calibrated from established motion-design practice, not lab-measured against the live renderer. |
| Repo fact: `lib/render/` emits static HTML/CSS with **NO JS by default** | `C:\Users\40728\WebsiteAgent` (read 2026-08-17, cross-confirmed by `INTERACTION_LIBRARY.md` §0 and `PERFORMANCE_KNOWLEDGE.md` §1) | **YES** — verified by reading files. |

**No spec or source has been invented.** Any claim not listed as verified live is marked **UNVERIFIED** inline and is either (a) K2 craft synthesis flagged as such, or (b) a forward instruction for a future implementation worker. The Material URL that 404'd is named explicitly so a later worker does not trust it.

---

## 1. The one repo constraint that shapes every principle

`lib/render/` emits **static HTML/CSS with NO JavaScript by default**. Therefore every principle below carries a **CSS-ONLY FEASIBLE?** field with three values:
- **CSS-only** — achievable now in the current static renderer (transitions, `@keyframes`, `:hover`, `:focus`, `:checked`, `prefers-reduced-motion`, `scroll-driven` CSS `animation-timeline: view()` where supported).
- **Partial** — the resting state is CSS-only; the dynamic state needs a JS runtime the repo does not ship (degrades gracefully to the static state).
- **JS-required** — cannot function without a JS runtime the repo does not yet ship (scroll-progress tracking, shared-element route transitions, spring physics, IntersectionObserver-gated reveals).

A "perfect" JS-only motion that breaks the no-JS baseline or the CWV floor is a defect, not a feature (cross-ref `PERFORMANCE_KNOWLEDGE.md` PERF-R40/R01–R03).

---

## 2. (a) DURATION BUDGET — by interaction class

Durations are the single highest-leverage motion decision. Too long = sluggish and a perceived-performance penalty; too short = invisible or jittery. Ranges below are K2 synthesis (UNVERIFIED as hard spec).

| Interaction class | Duration range | Reasoning |
|---|---|---|
| **Micro feedback** (button press, toggle, checkbox) | **80–120 ms** | Must feel *instant*; the brain reads <100 ms as cause-and-effect, not "animation". Longer reads as lag. |
| **Hover** (color/underline/scale on pointer-over) | **100–200 ms** | Hover is exploratory, not committed; a gentle ease that resolves before the pointer leaves. >200 ms feels sticky. |
| **State change** (active/selected, panel open) | **150–250 ms** | A committed change the user is watching; long enough to register, short enough to feel responsive. |
| **Element reveal** (single item entering viewport) | **200–400 ms** | Enough to perceive direction and easing; beyond 400 ms the content is *delayed*, which is a conversion cost (see A-13). |
| **Section transition** (block swapping in a view) | **300–500 ms** | Larger spatial change warrants more time, but the upper bound protects perceived load. |
| **Page / route transition** | **300–600 ms** | Cross-route changes are rare and deliberate; the longest sanctioned duration. Must collapse to ~0 under reduced motion. |
| **Loading sequence** (indeterminate spinner, shimmer) | **continuous, no fixed end** | Loading is *not* a timed transition — it is a state. It must communicate uncertainty, not fake progress (L3 / A-13 cross-ref). |

**Budget ceiling (K1-adjacent):** no single element reveal may exceed 400 ms on a conversion-critical local-business site; any motion that *delays the first meaningful content* (hero, price, hours, CTA) is forbidden regardless of beauty (cross-ref `INTERACTION_LIBRARY.md` §Final forbidden list).

---

## 3. (b) EASING CATALOG — real values, mapped to meaning

Easing is *what the motion communicates*. The curve is the message.

| Name | cubic-bezier / value | Communicates | Use for | Avoid for |
|---|---|---|---|---|
| **Linear** | `cubic-bezier(0,0,1,1)` / `linear` | Mechanical, unphysical, robotic | Progress that is genuinely constant (a determinate bar tied to real bytes); nothing else | Entrances, exits, anything meant to feel alive — linear reads as "the machine is moving it" |
| **Standard (material)** | `cubic-bezier(0.4, 0, 0.2, 1)` | Neutral, composed, general-purpose | Default for most state changes where no emphasis is needed | — |
| **Decelerate / arrival** | `cubic-bezier(0, 0, 0.2, 1)` | Settling, arriving, coming to rest | **Entrances, appearances, things entering the screen** — object eases in and stops | Exits (an exit should accelerate *away*, not decelerate *in*) |
| **Accelerate / departure** | `cubic-bezier(0.4, 0, 1, 1)` | Leaving, departing, being dismissed | **Exits, dismissals, things leaving the screen** — object speeds up as it goes | Entrances (an arrival that accelerates reads as "sucked in") |
| **Emphasized decelerate** | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Important arrival, landing with weight | Hero reveal, key moment emphasis | Routine hover (over-emphasised = heavy) |
| **Overshoot (back-out)** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful, springy, tactile, "physical" | Low-stakes delight: like/star toggle, success pop, micro-celebration | **Data, errors, loading, form validation** — overshoot on an error reads flippant and is a trust violation; on loading it reads broken |
| **Spring (runtime)** | stiffness 500 / damping 30 / mass 1 (Framer-style) — small overshoot | Bouncy, alive, physical | Playful feedback where a JS runtime exists | Anything CSS-only; springs need a runtime (JS-required) |

**Rules of meaning:**
- Arrivals decelerate (`ease-out` family). Exits accelerate (`ease-in` family). Swapping them is the most common amateur error and reads as "wrong physics".
- Linear reads mechanical because nothing in the physical world moves at constant velocity through a state change; use it *only* where the quantity itself is constant (real progress).
- Overshoot reads playful — correct for delight, **wrong** for anything carrying consequence (error, money, loading, validation). When in doubt, do not overshoot.

---

## 4. (c) STAGGER MATH

Staggering a list so items arrive in sequence adds rhythm — but only if the *total* sequence stays inside the budget. The governing equation:

```
total_sequence_time = base_delay + (N - 1) * stagger + item_duration
```

where `item_duration` is the per-item reveal (§2, element-reveal range). Constraint: `total_sequence_time ≤ BUDGET` (recommend ≤ 600 ms for a list; ≤ 1000 ms only for a deliberate hero cluster).

**Stagger must shrink as N grows** — the single most-violated stagger rule. A fixed 80 ms stagger across 20 items = 1.6 s of motion before the last item appears, which is content delay, not choreography.

Recommended stagger by count (K2 synthesis, UNVERIFIED as spec):

| N (items) | stagger per item | total sequence (item=300ms) |
|---|---|---|
| 3–5 | 80–100 ms | 540–900 ms |
| 6–10 | 50–70 ms | 740–990 ms |
| 11–20 | 30–45 ms | 870–1170 ms |
| 21+ | 20–30 ms (or drop stagger) | ≤ ~1200 ms; prefer no stagger |

**Rule:** if `(N-1) * stagger + item_duration` would exceed the budget, reduce `stagger` first, then reduce `item_duration`, then (last resort) drop the stagger entirely and reveal the group at once. A list that all appears together instantly is *correct* — it is never a defect (cross-ref A-13: "instant is a feature").

---

## 5. (d) CHOREOGRAPHY — what leads, what follows

Choreography is the ordering of motion across multiple elements in one transition. Bad choreography moves everything at once (noise); good choreography has a clear lead and a deliberate follow.

1. **One element leads.** In any multi-element transition, exactly one element carries the *initiating* motion. Everything else follows it on a small offset (40–120 ms), never simultaneously.
2. **Motion flows outward from the trigger.** The element the user touched (or the one that changed state) moves first; related elements cascade from it spatially.
3. **Containers before contents.** A panel/container opens (or its clip reveals) *before* its inner items stagger in — the frame arrives, then the contents populate it.
4. **Exits reverse the entrance.** If items entered bottom-up with a stagger, they leave top-down (or in reverse stagger). Symmetry of direction reduces cognitive re-parsing.
5. **No more than ~3 elements in independent motion at once** without a clear lead, or the eye has nothing to follow. Beyond that, group the rest as one unit.
6. **Continuity over fireworks.** When an element persists across the change (e.g. a thumbnail becoming a hero image), it leads and everything else defers to it (see §6).

---

## 6. (e) CONTINUITY — object permanence

Continuity is the principle that an element which exists before *and* after a change should be *the same element* on screen, not two elements (one leaving, one entering). This is "object permanence" applied to UI: the user's brain does not have to re-identify the object, so cognitive load drops.

- **Shared-element transition:** the same DOM/visual object morphs its size/position/color from state A to state B (e.g. a card expanding into a detail view). Reads as *one thing changing*, not *one thing vanishing and another appearing*.
- **Why it reduces load:** re-identification costs attention; a continuous object costs ~none. Award-site teardowns (`AWWWARDS_PATTERN_LIBRARY.md`) repeatedly use one persistent visual anchor across scroll/route changes.
- **Implementation:** animate the *same* property set (transform/opacity/clip) on the *same* element; do not cross-fade between two different elements pretending to be one.
- **CSS-ONLY FEASIBLE?** Partial — a `:target`/`:checked`-driven size/position morph is CSS-only; a true cross-route shared-element handoff (View Transitions API) is **JS-required** today.

---

## 7. (f) prefers-reduced-motion — remove / replace / exempt

The `prefers-reduced-motion: reduce` query (verified live, §0) is a **K1 accessibility gate**, not a preference. Three classes of motion:

**MUST BE REMOVED ENTIRELY (no substitute motion):**
- Large translational motion (elements flying across the viewport) — the primary vestibular trigger.
- Scroll-hijacking / scroll-linked parallax — remove; let content scroll natively.
- Infinite decorative loops (background shimmer, floating particles, auto-rotating carousels) — remove.

**MUST BE REPLACED by an instant state change (no duration, or ≤ ~0 ms):**
- Entrance reveals → element present immediately (no fade/slide).
- Hover/state transitions → snap to the end state (or keep only a color change, which is not motion).
- Page/route transitions → instant swap; if a cross-fade aids comprehension, cap at ≤ 0 (i.e. none) or a near-instant 1-frame cut.
- Loading shimmer → static placeholder (no sweep).
- Staggered lists → all items present at once.

**EXEMPT (motion that conveys essential meaning — may remain, documented):**
- A determinate/indeterminate progress indicator *that communicates real system status* (the motion *is* the information: "still working"). Replace decorative spinners, but a functional progress bar's motion is meaning, not decoration.
- Essential spatial feedback where direction carries information the user needs (e.g. an indicator that genuinely shows "content slid in from the right because you pressed Next"). Document the exemption per use; when in doubt, treat as removable.

**Mechanic (CSS-only):** wrap motion in `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition-duration: 0.01ms !important; } }` scoped to the relevant selectors, or set `transition: none` / `animation: none` on the specific elements. This is **CSS-only** and ships today.

---

## 8. (g) ANTI-MOTION — motion that must never ship

This section hardens `ANTI_AI_SLOP.md` A-13 ("meaningless animation"). These are prohibited at the gate level (K4 prohibitive).

1. **Scroll-jacking** — intercepting wheel/touch input to drive a scripted camera instead of native scroll. Removes user control; K1 accessibility + UX failure. JS-required and forbidden.
2. **Infinite decorative loops** — background animations with no information (floating orbs, endless gradient drift, ambient particles). Decoration substituting for meaning (ANTI_AI_SLOP mechanism #4). Remove under reduced motion; better, never ship.
3. **Animation that delays content** — any entrance/loader that pushes the first meaningful content (hero, price, hours, CTA) later than a static render would. Direct revenue leak on conversion sites.
4. **Identical motion on every section** — the global "fade + slide-up 20px on viewport enter" applied to all sections (A-13 verbatim). Ban as a default; assign motion per element with a stated purpose.
5. **Parallax on text** — translating copy against a background destroys legibility and is a vestibular trigger. Parallax, if ever used, is for imagery only, restrained, and CSS-only where supported — never on readable text.
6. **Autoplaying carousels** — content that cycles on a timer without user initiation; hides information behind a timer and fails reduced-motion. Use a static, user-controlled carousel or a static composition.
7. **Motion as the only signal** — feedback (success/error/state) conveyed *solely* by motion. Always pair with a persistent, non-animated signal (color, text, icon, `aria-live`).

---

## 9. ACTIVATES_WHEN / SUPPRESSED_WHEN (this domain)

Borrowing the taxonomy's load-bearing fields so motion is not applied indiscriminately (the factory's core failure mode):

- **KNOWS:** the principles in §10 — when motion earns its place, how to pace/ease/choreograph it, and what motion is forbidden.
- **ACTIVATES_WHEN:** the signature contract calls for motion as a *deliberate* device (a reveal that carries meaning, a state transition, an action's feedback, a real process depicted). Default posture is **restraint**, not motion.
- **SUPPRESSED_WHEN:** (1) the site is a reputation/portfolio artifact where stillness reads as confidence; (2) the business is conversion-critical local (call/hours/book) and motion would delay the money message; (3) `prefers-reduced-motion: reduce` is set (→ replace per §7); (4) no JS runtime ships and the only available motion is JS-required without a static fallback. A project may ship with **zero** motion and still be excellent.

---

## 10. Principle catalogue (MO-nnn)

Each principle is self-contained and carries the ten fields the factory workers consume. `CSS-ONLY FEASIBLE?` uses the three-value scheme from §1. Sources marked UNVERIFIED are K2 synthesis (see §0); verified URLs are noted where used.

### MO-001 — Keep micro-feedback under the perception threshold
- **PRINCIPLE:** Animate user-action feedback (press, toggle, check) in 80–120 ms so it reads as cause-and-effect, not as animation.
- **WHY:** The brain perceives sub-~100 ms changes as instantaneous response; beyond that the same change reads as lag and the UI feels broken.
- **WHEN:** Every committed, reversible action the user initiates (button press, switch, checkbox, tab select).
- **WHEN NOT:** Content reveals or route changes — those need longer to be perceptible (see §2).
- **IMPLEMENTATION IMPLICATION:** `transition: transform/background-color 90ms` on `:active`/`:checked`; prefer `transform` and `background-color` (compositor/cheap) over heavy `box-shadow` repaint.
- **KNOWLEDGE CLASS:** K2 (craft pacing).
- **CSS-ONLY FEASIBLE?:** CSS-only (`:active`, `:checked`, `:focus-visible`).
- **SOURCE + DATE:** K2 synthesis, duration range from §2; UNVERIFIED as hard spec. 2026-08-17.
- **CONFIDENCE:** Medium (calibrated craft, not lab-measured).
- **APPLICABLE WORKERS:** Interaction Design, Frontend, QA.

### MO-002 — Arrivals decelerate, exits accelerate
- **PRINCIPLE:** Use an ease-out curve for anything entering the screen and an ease-in curve for anything leaving it.
- **WHY:** Objects in the physical world decelerate as they arrive and accelerate as they depart; matching this is what makes motion read as "natural" rather than "wrong physics".
- **WHEN:** All entrances (reveals, menus, modals opening) and all exits (dismissals, closures).
- **WHEN NOT:** Never swap them — an arrival that accelerates reads as "sucked in"; an exit that decelerates reads as "refusing to leave".
- **IMPLEMENTATION IMPLICATION:** Entrance `cubic-bezier(0, 0, 0.2, 1)` (decelerate); exit `cubic-bezier(0.4, 0, 1, 1)` (accelerate). See §3 catalog.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only (`transition-timing-function`, `@keyframes`).
- **SOURCE + DATE:** Easing values established practice (Material/MDN); `cubic-bezier` verified-live at MDN §0. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Interaction Design, Frontend, Art Direction.

### MO-003 — Never use linear for state changes
- **PRINCIPLE:** Do not apply `linear` easing to entrances, exits, or state transitions; reserve it for motion where the underlying quantity is genuinely constant.
- **WHY:** Constant-velocity motion between two states reads as mechanical and robotic because nothing physical moves that way through a change; it signals "a machine is moving this", not "this object is behaving".
- **WHEN:** Only for a determinate progress bar whose `width`/`stroke-dashoffset` is tied to real, constant byte progress, or a similarly literal constant-rate indicator.
- **WHEN NOT:** Reveal/hover/state/route motion — all of these need ease-out/ease-in.
- **IMPLEMENTATION IMPLICATION:** Default `transition-timing-function` to a decelerate/accelerate curve; set `linear` only on the one progress property that is constant.
- **KNOWLEDGE CLASS:** K2 (craft) with K1-adjacent legibility rationale.
- **CSS-ONLY FEASIBLE?:** CSS-only.
- **SOURCE + DATE:** K2 synthesis; `linear`/`cubic-bezier` verified-live at MDN §0. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Interaction Design.

### MO-004 — Reserve overshoot for playful, low-stakes feedback
- **PRINCIPLE:** Use overshoot/back/spring easing only for delight with no consequence; never for data, errors, loading, or validation.
- **WHY:** Overshoot reads "playful/tactile". Applied to an error or a loading state it reads flippant and is a trust violation; on loading it reads "broken".
- **WHEN:** Like/star toggles, success "pop", micro-celebration, non-critical confirmation.
- **WHEN NOT:** Form errors, validation, payment/loading states, anything where the message is serious. Use a calm decelerate there.
- **IMPLEMENTATION IMPLICATION:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (back-out) for CSS; or a spring (stiffness 500, damping 30) when a JS runtime exists. Springs are JS-required.
- **KNOWLEDGE CLASS:** K2 (craft) + K4-adjacent (misuse is slop).
- **CSS-ONLY FEASIBLE?:** CSS-only for the static `cubic-bezier`; JS-required for true spring physics.
- **SOURCE + DATE:** K2 synthesis; material overshoot values UNVERIFIED (m3 URL 404, §0). 2026-08-17.
- **CONFIDENCE:** Medium (values unverified; principle established).
- **APPLICABLE WORKERS:** Interaction Design, Frontend.

### MO-005 — One element leads the choreography
- **PRINCIPLE:** In any multi-element transition, exactly one element carries the initiating motion; all others follow it on a deliberate offset, never simultaneously.
- **WHY:** With no lead, the eye has nothing to follow and the screen reads as noise; a clear lead gives the motion a subject.
- **WHEN:** Panel opens with inner items, list staggers in, route change with several elements.
- **WHEN NOT:** A single-element change needs no lead/follow structure.
- **IMPLEMENTATION IMPLICATION:** Lead element `transition-delay: 0`; followers `40–120 ms` incremental delays; cap independent motions at ~3 (§5 rule 5).
- **KNOWLEDGE CLASS:** K2 (craft choreography).
- **CSS-ONLY FEASIBLE?:** CSS-only (`transition-delay` per element/class).
- **SOURCE + DATE:** K2 synthesis from established choreography practice. 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Art Direction, Frontend.

### MO-006 — Cause must precede effect within ~100 ms
- **PRINCIPLE:** Sequence related changes so the trigger visibly precedes the result, and keep the gap at or below ~100 ms.
- **WHY:** Temporal contiguity is how the brain infers causality; a long or reversed gap makes the response feel disconnected from the action.
- **WHEN:** Action → feedback, parent → child reveal, toggle → dependent panel.
- **WHEN NOT:** Deliberate "thinking" delays (loading) are a different class and must not masquerade as causality.
- **IMPLEMENTATION IMPLICATION:** Drive both states from one trigger; set the dependent element's `transition-delay` ≤ 100 ms after the trigger.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only (`:checked ~`, `:focus-within`, `:target`).
- **SOURCE + DATE:** K2 synthesis. 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Frontend.

### MO-007 — Anticipation signals a larger change
- **PRINCIPLE:** A small anticipatory wind-up (a tiny reverse move before the main move) communicates that a bigger change is coming.
- **WHY:** Anticipation is how physical bodies preview motion; it prepares the eye and reads as intentional and alive.
- **WHEN:** A significant state change the user should expect (a panel about to expand, a modal about to open).
- **WHEN NOT:** Micro-feedback — a button press does not need a wind-up; it would feel sluggish.
- **IMPLEMENTATION IMPLICATION:** Two-phase move: `0%` slight opposite offset → settle → `100%` main move; keep the wind-up ≤ 60 ms.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only (`@keyframes` with a negative-direction first frame).
- **SOURCE + DATE:** K2 synthesis (animation principle: anticipation). 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Art Direction.

### MO-008 — Scroll-reveal only when it carries meaning
- **PRINCIPLE:** Reveal an element on scroll only when the reveal itself communicates something; never apply a global scroll-reveal as a default.
- **WHY:** Global "fade + slide-up on enter" (A-13) delays content, harms perceived performance, and makes every site feel like the same slideshow. If everything animates, nothing is emphasised.
- **WHEN:** A single hero image, a key stat, a process step where sequential appearance aids comprehension.
- **WHEN NOT:** Every section; boilerplate; anything above the fold that could be static (cross-ref A-13, §8 rule 4).
- **IMPLEMENTATION IMPLICATION:** Assign reveal per element with a stated purpose; prefer CSS `animation-timeline: view()` (CSS-only where supported) over IntersectionObserver (JS-required) for the no-JS baseline.
- **KNOWLEDGE CLASS:** K4 (prohibitive default) reinforced from A-13.
- **CSS-ONLY FEASIBLE?:** Partial — CSS `view()` timeline is CSS-only in supporting browsers; IntersectionObserver-gated reveal is JS-required.
- **SOURCE + DATE:** `ANTI_AI_SLOP.md` A-13 (read 2026-08-17) + K2 synthesis.
- **CONFIDENCE:** High (prohibition); Medium (per-element threshold).
- **APPLICABLE WORKERS:** Interaction Design, Art Direction, QA (gate on A-13 signal).

### MO-009 — Entrance distance scales with element size
- **PRINCIPLE:** Move larger elements a shorter distance on entrance; small elements may travel further.
- **WHY:** A huge element sliding 60 px reads as "the whole screen jumped"; a small chip travelling 60 px reads as a tidy arrival. Perceived motion energy should be roughly constant, not per-element identical.
- **WHEN:** Mixed-size reveals in one view (hero vs caption, card vs badge).
- **WHEN NOT:** When directional continuity (MO-013) demands a fixed travel vector.
- **IMPLEMENTATION IMPLICATION:** Map translate distance to element height: ≤ 12 px for full-bleed, 16–24 px for cards, 24–40 px for small chips; keep within §2 reveal range.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only (`transform: translateY()` per size class).
- **SOURCE + DATE:** K2 synthesis. 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Frontend.

### MO-010 — Morph shared properties, not two elements
- **PRINCIPLE:** When an object persists across a change, animate its own size/position/color as one element rather than cross-fading two different elements.
- **WHY:** Continuity (§6) lets the brain keep one identity, cutting re-parsing cost; two elements pretending to be one reads as a flicker/swap.
- **WHEN:** Card → detail expansion, thumbnail → hero, inline value → edited state.
- **WHEN NOT:** When the before/after are genuinely different objects (then a cross-fade or cut is honest).
- **IMPLEMENTATION IMPLICATION:** Animate `transform`/`clip-path`/`border-radius` on the *same* node; use `:target` or `:checked` state to toggle the morph (CSS-only); View Transitions API for cross-route (JS-required).
- **KNOWLEDGE CLASS:** K2 (craft) with K1-adjacent cognitive-load benefit.
- **CSS-ONLY FEASIBLE?:** Partial — `:target`/`:checked` morph is CSS-only; cross-route shared element needs JS (View Transitions).
- **SOURCE + DATE:** Continuity principle §6 + established practice. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Interaction Design, Frontend, Art Direction.

### MO-011 — Animate along the real spatial path
- **PRINCIPLE:** Move an element along the path it would physically take; do not teleport it and then fade to conceal the jump.
- **WHY:** A teleport-and-fade reads as two disconnected events; a continuous path reads as one object travelling, which the brain tracks effortlessly.
- **WHEN:** An element changes position (a dragged item snapping to grid, a tooltip relocating, a panel shifting).
- **WHEN NOT:** When the start and end are truly unrelated spaces and a cut is the honest choice.
- **IMPLEMENTATION IMPLICATION:** Animate `transform: translate()`/`translate3d()` along the actual vector; for curved paths use multi-keyframe `@keyframes` or `offset-path`. Keep on compositor.
- **KNOWLEDGE CLASS:** K2 (craft) with K1-adjacent cognitive-load benefit.
- **CSS-ONLY FEASIBLE?:** CSS-only (`transform`/`@keyframes`/`offset-path`).
- **SOURCE + DATE:** K2 synthesis + continuity §6. 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Frontend.

### MO-012 — Directional continuity at boundaries
- **PRINCIPLE:** New content should enter from the direction it came; "next" arrives from the right, "back" from the left.
- **WHY:** Consistent spatial grammar lets users predict where things go, reducing disorientation across navigation.
- **WHEN:** Carousels, wizards, step flows, any forward/back traversal.
- **WHEN NOT:** When the metaphor is not spatial (a modal is not "to the right"); then center it.
- **IMPLEMENTATION IMPLICATION:** Drive enter/exit `translateX` sign from traversal direction; pair with MO-002 easing.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only (`:target`/`:checked` state classes).
- **SOURCE + DATE:** K2 synthesis (spatial consistency). 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Frontend.

### MO-013 — Scroll-linked motion is mapped to scroll, not timed
- **PRINCIPLE:** When motion is tied to scrolling, bind it to scroll progress so it tracks the user's input; never auto-play it on a timer.
- **WHY:** Timed scroll motion fight the user's scroll position (scroll-jacking, §8 rule 1) and is a K1 accessibility failure; progress-bound motion stays under user control.
- **WHEN:** Sticky-section reveals, progress bars, scrubbed sequences where the user is driving.
- **WHEN NOT:** Never as a background auto-playing effect.
- **IMPLEMENTATION IMPLICATION:** CSS `animation-timeline: scroll()` / `view()` (CSS-only where supported); rolling your own needs IntersectionObserver + scroll listener (JS-required). Always provide native-scroll fallback.
- **KNOWLEDGE CLASS:** K1 (user control) + K2.
- **CSS-ONLY FEASIBLE?:** Partial — CSS `scroll()`/`view()` timelines are CSS-only in supporting browsers; polyfill needs JS.
- **SOURCE + DATE:** `scroll()`/`view()` established practice; CSS `animation-timeline` verified-live at MDN §0 (301). 2026-08-17.
- **CONFIDENCE:** Medium (support varies; provide fallback).
- **APPLICABLE WORKERS:** Frontend, Interaction Design, QA.

### MO-014 — Parallax only on imagery, never on text
- **PRINCIPLE:** If parallax is used at all, apply it to imagery only, keep it restrained, and never move readable text against its background.
- **WHY:** Translating text against a background destroys legibility and is a vestibular trigger; imagery tolerates subtle depth, text does not.
- **WHEN:** A hero photograph with a genuinely layered foreground/background, used as a deliberate signature.
- **WHEN NOT:** Body copy, captions, labels, or any readable text (§8 rule 5). Conversion-critical sites (prefer none).
- **IMPLEMENTATION IMPLICATION:** `transform: translateZ()` / `perspective` depth on image layers only; cap parallax speed delta; disable under `prefers-reduced-motion` (§7).
- **KNOWLEDGE CLASS:** K1 (legibility/vestibular) + K2.
- **CSS-ONLY FEASIBLE?:** Partial — CSS `scroll()` timeline parallax is CSS-only where supported; JS for fine control.
- **SOURCE + DATE:** K1 legibility + A-13/§8 rule 5. 2026-08-17.
- **CONFIDENCE:** High (prohibition on text); Medium (imagery caveat).
- **APPLICABLE WORKERS:** Art Direction, Frontend, QA.

### MO-015 — State changes transition only the changed property
- **PRINCIPLE:** In a state change, animate the single property that changed, in ≤ 200 ms; do not re-animate the whole element.
- **WHY:** Animating properties that did not change is wasted motion that draws the eye to nothing and can trigger layout/paint cost.
- **WHEN:** Hover/active/selected/focus/disabled state changes.
- **WHEN NOT:** A morph that genuinely changes several properties (then MO-010 applies).
- **IMPLEMENTATION IMPLICATION:** `transition: background-color 160ms` (not `all 160ms`); scope transitions to the exact property.
- **KNOWLEDGE CLASS:** K2 (craft) + K1-adjacent perf.
- **CSS-ONLY FEASIBLE?:** CSS-only.
- **SOURCE + DATE:** K2 synthesis; perf cross-ref `PERFORMANCE_KNOWLEDGE.md` §11. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Interaction Design.

### MO-016 — Hover feedback must feel instant
- **PRINCIPLE:** Hover/pointer-feedback transitions resolve in ≤ 80 ms so the response feels attached to the cursor, not trailing it.
- **WHY:** A hover that lags behind the pointer reads as unresponsive; the eye expects the highlight the instant the pointer arrives.
- **WHEN:** Links, buttons, cards, any pointer-hoverable surface.
- **WHEN NOT:** Touch/keyboard-only contexts (no hover) — use `:focus-visible` at the 80–120 ms micro-feedback band instead.
- **IMPLEMENTATION IMPLICATION:** `transition: color/background/transform 60–80ms ease-out` on `:hover`; ensure it reverses on `:hover` exit too.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only (`:hover`).
- **SOURCE + DATE:** K2 synthesis; duration from §2 hover band. 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Frontend, Interaction Design.

### MO-017 — Use shared-element transitions across routes
- **PRINCIPLE:** When a key object persists between two routes, carry it across as one continuous element rather than cutting between two screens.
- **WHY:** Object permanence (§6) removes the "where am I now" re-orientation cost on navigation; the persistent object is the thread.
- **WHEN:** List → detail (thumbnail becomes hero), nav brand persists, any repeated anchor across views.
- **WHEN NOT:** Unrelated routes with no shared object — a clean cut is honest and faster.
- **IMPLEMENTATION IMPLICATION:** View Transitions API `document.startViewTransition()` with `view-transition-name` on the shared node (JS-required). CSS `:target` single-page morph is the CSS-only substitute.
- **KNOWLEDGE CLASS:** K2 (craft) + K1-adjacent cognitive load.
- **CSS-ONLY FEASIBLE?:** Partial — SPA `:target` morph CSS-only; true cross-document shared element needs JS (View Transitions).
- **SOURCE + DATE:** View Transitions API established practice (URL UNVERIFIED live; 301 in INTERACTION_LIBRARY §0). 2026-08-17.
- **CONFIDENCE:** Medium (API support evolving).
- **APPLICABLE WORKERS:** Interaction Design, Frontend, Art Direction.

### MO-018 — Full-screen covers must be reduced-motion safe
- **PRINCIPLE:** Any full-screen wipe/cover/overlay transition must collapse to a near-instant cut under `prefers-reduced-motion` and must not trap focus.
- **WHY:** Large translational covers are the worst vestibular triggers and the biggest LCP risk (they can hide the hero); both are K1 failures.
- **WHEN:** Deliberate cinematic route changes where continuity cannot be achieved another way.
- **WHEN NOT:** Conversion-critical local-business sites — a cover in front of "Call now / hours" is a direct revenue leak (cross-ref INTERACTION_LIBRARY L3).
- **IMPLEMENTATION IMPLICATION:** Wrap the cover in `@media (prefers-reduced-motion: reduce)` → `transition-duration: 0.01ms`; `aria-hidden` the overlay; provide Skip; never block first meaningful content.
- **KNOWLEDGE CLASS:** K1 (accessibility + CWV) + K4 (misuse on conversion sites).
- **CSS-ONLY FEASIBLE?:** Partial — timed CSS cover is CSS-only; dismiss-on-load needs JS.
- **SOURCE + DATE:** K1 (§7) + L3 in INTERACTION_LIBRARY. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Interaction Design, QA.

### MO-019 — Loading motion never fakes progress
- **PRINCIPLE:** A loading indicator must communicate real uncertainty (indeterminate) or real progress (determinate from a real event); it must never animate toward a fake 100%.
- **WHY:** A false completion is a trust violation (K1 truthfulness, cross-ref ANTI_AI_SLOP truthfulness); fake determinate bars are K4 slop.
- **WHEN:** Genuinely async operations with or without real progress events.
- **WHEN NOT:** Page boot on a marketing site where there is no real progress to report — then show static content, not a spinner.
- **IMPLEMENTATION IMPLICATION:** Indeterminate spinner (`@keyframes rotate`, CSS-only) OR `<progress>`/`role="progressbar"` with `aria-valuenow` set from a real event (JS-required for the value). Freeze under reduced motion (§7 exempt only if it conveys status).
- **KNOWLEDGE CLASS:** K1 (truthfulness) + K2.
- **CSS-ONLY FEASIBLE?:** Partial — spinner CSS-only; determinate value needs JS.
- **SOURCE + DATE:** L2/L3 in INTERACTION_LIBRARY + K1 truthfulness. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Interaction Design, QA.

### MO-020 — Hold layout during load to prevent CLS
- **PRINCIPLE:** During load, reserve the final box so content swaps in without shifting; never animate content into a box that then moves.
- **WHY:** Layout shift during load is a Core Web Vitals failure (CLS ≤ 0.1, K1 gate PERF-R03) and a jolt the user feels.
- **WHEN:** Async images/fonts/data below or above the fold.
- **WHEN NOT:** Content that is server-rendered immediately — no skeleton needed, just render it.
- **IMPLEMENTATION IMPLICATION:** Skeleton placeholder sized to the real box (`content-visibility: auto` for below-fold); `aspect-ratio`/`width`/`height` on media; swap real content into the reserved box (CSS-only shimmer, see INTERACTION_LIBRARY L1).
- **KNOWLEDGE CLASS:** K1 (CWV gate) + K2.
- **CSS-ONLY FEASIBLE?:** CSS-only (shimmer + reserved box).
- **SOURCE + DATE:** `PERFORMANCE_KNOWLEDGE.md` PERF-R03/R11 + L1. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Performance, QA.

### MO-021 — Every action gets acknowledgement within 100 ms
- **PRINCIPLE:** Each user action must produce a visible acknowledgement (press, toggle, state flip) within ~100 ms; silence feels like the UI ignored the input.
- **WHY:** Absent feedback makes users repeat the action or assume failure; prompt acknowledgement is the difference between "responsive" and "broken".
- **WHEN:** Every click, tap, toggle, submit, key press with an effect.
- **WHEN NOT:** Actions with an inherently slow server response still need an *immediate* acknowledgement (e.g. button depress) even if the result is slow.
- **IMPLEMENTATION IMPLICATION:** `:active` transform/opacity dip at 80–120 ms (MO-001); pair with a persistent signal (MO-031) so feedback is not motion-only.
- **KNOWLEDGE CLASS:** K2 (craft) + K1-adjacent responsiveness.
- **CSS-ONLY FEASIBLE?:** CSS-only (`:active`).
- **SOURCE + DATE:** K2 synthesis; INP K1 floor cross-ref PERF-R02. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Interaction Design, Frontend, QA.

### MO-022 — Pair motion with a persistent signal
- **PRINCIPLE:** Convey success, error, or state with color/form/text, never with motion alone.
- **WHY:** Motion is transient; a user who looked away, or who has reduced-motion on, misses a motion-only signal. A persistent visual signal survives both.
- **WHEN:** Form submit, validation, toggle result, any state whose meaning must outlast the animation.
- **WHEN NOT:** Pure decorative acknowledgement where no meaning is conveyed (then MO-021 suffices).
- **IMPLEMENTATION IMPLICATION:** Add `aria-live` text + a color/`border` state that persists after the animation ends; the animation is supplementary, not the carrier.
- **KNOWLEDGE CLASS:** K1 (accessibility) + K2.
- **CSS-ONLY FEASIBLE?:** CSS-only (color/border state) + `aria-live` (JS to set text, but the visual state is CSS).
- **SOURCE + DATE:** K1 accessibility + §7/§8 rule 7. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Interaction Design, Frontend, QA.

### MO-023 — Stagger must shrink as the list grows
- **PRINCIPLE:** As item count N rises, reduce the per-item stagger so the total sequence stays inside budget; drop stagger entirely when it would exceed budget.
- **WHY:** A fixed stagger across many items becomes content delay (the last item is hidden far longer than the first), which is the A-13 failure in disguise.
- **WHEN:** Any revealed/ordered list of 3+ items.
- **WHEN NOT:** A list that should appear as one unit — reveal it all at once (instant is correct).
- **IMPLEMENTATION IMPLICATION:** Use the §4 formula `total = base + (N-1)*stagger + item_duration ≤ BUDGET`; at N≥21 prefer stagger ≤ 20–30 ms or none.
- **KNOWLEDGE CLASS:** K2 (craft) + K4-adjacent (violation reads as slop).
- **CSS-ONLY FEASIBLE?:** CSS-only (per-item `transition-delay`); the *computation* is a build-time decision, not runtime.
- **SOURCE + DATE:** Stagger math §4 + A-13. 2026-08-17.
- **CONFIDENCE:** Medium (calibration UNVERIFIED).
- **APPLICABLE WORKERS:** Interaction Design, Frontend.

### MO-024 — Match easing to the physical metaphor
- **PRINCIPLE:** Choose the easing that matches what the object is doing — settling, leaving, or springing — not a default curve.
- **WHY:** Easing is the message (§3); a mismatched curve breaks the illusion of a real object and reads as "templated".
- **WHEN:** Every transition — pick deliberately from the §3 catalog.
- **WHEN NOT:** Never reach for one curve as a global default for all motion.
- **IMPLEMENTATION IMPLICATION:** Map intent → curve: settle=`cubic-bezier(0,0,0.2,1)`; depart=`cubic-bezier(0.4,0,1,1)`; neutral=`cubic-bezier(0.4,0,0.2,1)`; play=`cubic-bezier(0.34,1.56,0.64,1)`.
- **KNOWLEDGE CLASS:** K2 (craft).
- **CSS-ONLY FEASIBLE?:** CSS-only.
- **SOURCE + DATE:** §3 easing catalog (material values UNVERIFIED, m3 URL 404 §0). 2026-08-17.
- **CONFIDENCE:** High (rule); Medium (exact values).
- **APPLICABLE WORKERS:** Interaction Design, Frontend, Art Direction.

### MO-025 — Animate few things; instant is a feature
- **PRINCIPLE:** Animate only a small number of moments that each do a job; let everything else appear instantly.
- **WHY:** Reinforces A-13 — if everything animates, nothing is emphasised, and a fast, confident site *feels* fast precisely because most of it does not move. Instant appearance is not a failure.
- **WHEN:** A hero reveal, a state transition, an action's feedback, a real process depicted.
- **WHEN NOT:** Never as a site-wide default (cross-ref §8 rule 4, A-13).
- **IMPLEMENTATION IMPLICATION:** Budget motion like a scarce resource; each animated element needs a one-line justification in the signature contract.
- **KNOWLEDGE CLASS:** K4 (prohibitive default) reinforced from A-13 + K2.
- **CSS-ONLY FEASIBLE?:** N/A (a restraint, not an effect).
- **SOURCE + DATE:** `ANTI_AI_SLOP.md` A-13 (read 2026-08-17). 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Interaction Design, Art Direction, QA (gate).

### MO-026 — Cap aggregate on-screen motion
- **PRINCIPLE:** Limit how many elements are in motion at once; a screen full of simultaneous motion overwhelms and reads as cheap.
- **WHY:** Perceptual bandwidth is finite; parallel motion competes for the same attention and none of it lands.
- **WHEN:** Complex views with many live regions (dashboards, feeds).
- **WHEN NOT:** A single focused moment (then full motion is fine).
- **IMPLEMENTATION IMPLICATION:** Enforce §5 rule 5 (≤ ~3 independent motions) + §7 reduced-motion collapse; consider a global motion budget constant in the build.
- **KNOWLEDGE CLASS:** K2 (craft) + K4-adjacent.
- **CSS-ONLY FEASIBLE?:** CSS-only (the cap is a design decision enforced at authoring).
- **SOURCE + DATE:** K2 synthesis (perceptual budget). 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Art Direction, QA.

### MO-027 — Animate compositor-only properties
- **PRINCIPLE:** Prefer `transform` and `opacity` for motion; avoid animating layout/paint properties (width, height, top, left, margin, box-shadow) that hit the main thread.
- **WHY:** Main-thread animation competes with input handling and can breach INP ≤ 200 ms (K1 gate PERF-R02); composited properties stay off the main thread.
- **WHEN:** Every transition/keyframe.
- **WHEN NOT:** When a layout change is the actual meaning (e.g. height collapse) — then minimise its duration and accept the cost, or use `transform: scaleY`.
- **IMPLEMENTATION IMPLICATION:** Use `transform: translate/scale/rotate` and `opacity`; promote layers with `will-change` sparingly; cross-ref `PERFORMANCE_KNOWLEDGE.md` §11.
- **KNOWLEDGE CLASS:** K1 (INP floor) + K2.
- **CSS-ONLY FEASIBLE?:** CSS-only.
- **SOURCE + DATE:** `PERFORMANCE_KNOWLEDGE.md` PERF-R02 + §11. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Performance.

### MO-028 — Reduced-motion replaces continuous motion with instant state
- **PRINCIPLE:** Under `prefers-reduced-motion: reduce`, convert continuous/looping/translational motion into an instant state change (or none), not a slower version of the same motion.
- **WHY:** A slowed spin is still a spin; the trigger is *motion*, not *speed*. The correct response is removal or instant snap (§7).
- **WHEN:** Every animated element when the query matches.
- **WHEN NOT:** Motion that is exempt because it conveys essential meaning (MO-029).
- **IMPLEMENTATION IMPLICATION:** `@media (prefers-reduced-motion: reduce) { .animated { animation: none; transition-duration: 0.01ms; } }` scoped to the relevant selectors (CSS-only, ships today).
- **KNOWLEDGE CLASS:** K1 (accessibility gate).
- **CSS-ONLY FEASIBLE?:** CSS-only.
- **SOURCE + DATE:** `prefers-reduced-motion` verified-live at MDN §0 + web.dev §0. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, QA (gate).

### MO-029 — Some motion is exempt as essential meaning
- **PRINCIPLE:** Motion that *is* the information (a real progress indicator, a direction that carries needed spatial meaning) may remain under reduced motion, but must be documented per use.
- **WHY:** Removing meaning-bearing motion would hide status the user needs; the exemption is narrow and must be justified, not assumed.
- **WHEN:** A determinate/indeterminate progress indicator tied to real status; a genuinely informative directional cue.
- **WHEN NOT:** Decorative, ambient, or "nice to have" motion — that is never exempt.
- **IMPLEMENTATION IMPLICATION:** Keep the exempt animation; record the exemption in the signature contract with the rationale; everything else collapses per MO-028.
- **KNOWLEDGE CLASS:** K1 (accessibility, with documented exception).
- **CSS-ONLY FEASIBLE?:** CSS-only (the exemption is a classification, not an effect).
- **SOURCE + DATE:** §7 EXEMPT class + K1. 2026-08-17.
- **CONFIDENCE:** High (narrow); Medium (per-use judgement).
- **APPLICABLE WORKERS:** Interaction Design, Frontend, QA.

### MO-030 — Page transitions favour continuity over decoration
- **PRINCIPLE:** Prefer a continuity/shared-element transition between routes over a decorative full-screen effect; the goal is orientation, not spectacle.
- **WHY:** Decoration on a route change costs LCP and vestibular comfort for no orientation benefit; continuity (§6) is both cheaper and clearer.
- **WHEN:** Any route change where a shared object or persistent context exists.
- **WHEN NOT:** When no continuity is possible and the change is minor — a clean instant cut beats a decorative cover.
- **IMPLEMENTATION IMPLICATION:** View Transitions API with `view-transition-name` (JS-required) or CSS `:target` morph (CSS-only); reserve covers for deliberate cinematic moments (MO-018).
- **KNOWLEDGE CLASS:** K2 (craft) + K1-adjacent (CWV/vestibular).
- **CSS-ONLY FEASIBLE?:** Partial — SPA morph CSS-only; cross-route needs JS.
- **SOURCE + DATE:** §6 continuity + MO-017/MO-018. 2026-08-17.
- **CONFIDENCE:** Medium.
- **APPLICABLE WORKERS:** Interaction Design, Frontend, Art Direction.

### MO-031 — Prefer CSS-only; supply a static fallback for JS-required motion
- **PRINCIPLE:** Default to motion the current static `lib/render/` can emit (CSS-only); any JS-required motion must have a performant, content-complete static fallback.
- **WHY:** The repo emits static HTML/CSS with no JS by default (K1 constraint, PERF-R40); a JS-only motion that fails without the runtime is a defect, not a feature.
- **WHEN:** Choosing any motion technique.
- **WHEN NOT:** Never ship JS-required motion as the *only* path to content or meaning.
- **IMPLEMENTATION IMPLICATION:** Author CSS `transition`/`@keyframes`/`prefers-reduced-motion` first; gate JS-only enhancements (scroll progress, springs, View Transitions) behind feature detection with a static resting state.
- **KNOWLEDGE CLASS:** K1 (no-JS constraint) + K2.
- **CSS-ONLY FEASIBLE?:** CSS-only is the default; JS-required techniques flagged per principle above.
- **SOURCE + DATE:** Repo fact verified 2026-08-17 (§1) + `PERFORMANCE_KNOWLEDGE.md` PERF-R40. 2026-08-17.
- **CONFIDENCE:** High.
- **APPLICABLE WORKERS:** Frontend, Interaction Design, QA, Performance.

---

## 11. Closing — relationship to sibling docs

This document is the **principles** layer. It is deliberately distinct from:
- `INTERACTION_LIBRARY.md` — the per-interaction *catalog* (technique entries L1…, N1…, each with NO-JS feasibility). Principles here are cited by those entries; the catalog does not restate doctrine.
- `PERFORMANCE_KNOWLEDGE.md` — the *cost budgets* (CWV gates, byte/JS ceilings). Where a principle touches cost (MO-020 CLS, MO-027 INP, MO-031 no-JS), it points at the perf gate rather than redefining the number.
- `ANTI_AI_SLOP.md` A-13 — meaningful-animation prohibition, hardened here in §8 (ANTI-MOTION) and reinforced by MO-008, MO-025.
- `KNOWLEDGE_TAXONOMY.md` — K1–K4 classes and ACTIVATES_WHEN/SUPPRESSED_WHEN vocabulary, applied per principle and in §9.

**Status reminder:** research artifact, pre-implementation. None of this is to be built now; it is the doctrine a future implementation worker consumes, with every UNVERIFIED claim flagged inline per §0. A site may ship with zero motion and still pass every gate.

---
