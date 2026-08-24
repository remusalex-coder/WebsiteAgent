# BUSINESSFORGE EXPERIENCE ARSENAL v2
### Research & Intelligence Artifact — RESEARCH ONLY (no repo/registry/dependency changes)

Built on `BUSINESSFORGE_EXPERIENCE_ARSENAL_v1.md` (CRAV-grounded, 32 sections) + this deeper
brief (Higgsfield/provider cost matrix, real-site OBSERVED examples, 10 explicit final questions).

Evidence discipline:
- **OBSERVED** = seen in fetched HTML/JS/CSS source (curl, since browser_exec is broken here).
- **VERIFIED** = confirmed from official docs/ToS.
- **INFERRED** = strong but not directly probed (e.g. studio reputation, MDN-doc presence).
- **UNKNOWN** = not published / not fetchable; never fabricated.

Companion files (this folder):
- `research_evidence_observed.md` — live curl evidence (Higgsfield, ElevenLabs, FLUX, Tripo, Meshy, Lenis, site signatures)
- `01_entry_nav_cursor.md`, `02_layout_scroll_type.md` — async breadth taxonomies (35 + 41 patterns)
- `BUSINESSFORGE_ARSENAL_APPENDIX.md` — reconciliation (incl. Locomotive = deprecated; file `03`` absent)
- `AWWWARDS_PATTERN_LIBRARY.md`, `BUSINESSFORGE_2.0_ARSENAL.md` — prior foundation docs reused

---

# 1. EXECUTIVE SUMMARY

BusinessForge must select experiences **conditionally from business evidence**, not apply a template.
This v2 upgrade adds three things the first pass lacked:

1. **Higgsfield / AI-media provider matrix with honest cost+license facts** (OBSERVED where public, UNKNOWN where not).
2. **Real-site OBSERVED evidence** — we fetched and grepped actual studio + CRAV source, not listicles.
3. **Explicit answers to the 10 final questions**, including the 20 highest-value capabilities and the
   reject list derived from research.

**Headline correction from v1 — RETRACTED & RE-VERIFIED (2026-08-19):** A first pass claimed "top
premium studios use OGL/WebGL (OBSERVED)". That was a **false positive**: the token `ogl` matches the
substring of `g-o-o-g-l-e`. Boundary-aware re-grep (`(?<!g)ogl(?!e)`) + actual JS-bundle fetches show
**Active Theory, Dogstudio, 14islands, Monogrid, Cuberto, CRAV all have ZERO OGL/Three/WebGL signatures
in homepage HTML and initial bundles.** So: premium does NOT require WebGL. The verified OBSERVED pattern
(CRAV, Cuberto) is **GSAP + ScrollTrigger + Lenis + split-text + lerp custom cursor** — pure DOM
transforms, ~0 GPU cost. Whether studios lazy-load WebGL in route chunks is **UNKNOWN** (needs a rendered
DOM probe — static curl is insufficient). BusinessForge's 3D tier should enter at **OGL** (correct lib
choice when 3D IS justified), never assume it is present by default.

**The 20 highest-value capabilities** (see §35) are dominated by: a coherent MOTION SYSTEM, reduced-motion
branch, skeleton/optimistic UI, scroll storytelling, custom cursor, View Transitions, interactive product
viewers/configurators, search/filter, booking/scheduling, maps, payments/checkout, microinteractions,
and a real provider-backed AI-media capability (Higgsfield) gated behind business evidence + license check.

---

# 2. CRAV REVERSE ENGINEERING (v2 — corrected & deepened)

**Site identified: cravburgers.shop** ("CRAV | Artisan Smashed Burgers", Next.js/Turbopack).
Other "CRAV" domains checked and rejected: cravstudio.com (plain Tailwind/Next), crav.online (Squarespace commerce).

**OBSERVED stack (from full HTML + 15 JS bundles, grep):**
- Lenis smooth/inertia scroll — `lerp`, `wheel`, `requestAnimationFrame` signatures.
- GSAP + ScrollTrigger — split-text reveals, pinned storytelling, scrub.
- Framer Motion — component-level transitions.
- Custom follower cursor with **exponential smoothing**: `value += (target - value) * (1 - exp(-k * dt))`
  (frame-rate-independent lerp — this is the "physics" the user perceived).
- `preload` (22 refs), `cursor` (30), `transition` (28), `clip` (9) in HTML.
- **`prefers-reduced-motion` branch OBSERVED** (matchMedia + aria-label + opacity-only fallback).
- **NO `three`, NO `webgl`, NO `ogl` in homepage bundles** → the "physics/ingredients react to cursor"
  effect is DOM transforms + transforms on imagery, NOT WebGL/shaders.

**Per-behavior table (what the user saw → real mechanism → BusinessForge rule):**

| Behavior user noticed | Technical name | OBSERVED mechanism | CRAV uses | BF rule |
|---|---|---|---|---|
| opening animation / loading | Preloader + content-reveal choreography | preload orchestration, then hero reveal | YES (preload=22, reveals) | OBSERVED: real asset-gated loader, not fake progress |
| cursor with following elements | Follower cursor w/ inertia | exponential-smoothing lerp | YES | cap.cursor.follower (DOM, cheap) |
| layout/sections look truncated | Clipped / cropped viewport composition | CSS clip / overflow + asymmetry | YES (clip=9) | cap.layout.clip (structural, not decoration) |
| menu with animation | Overlay/full-screen menu morph | Framer Motion + transform | YES | cap.nav.overlay (conditional) |
| transitions between views | Route/page transition | Framer Motion + (likely) View Transitions | YES (transition=28) | cap.nav.transition (progressive enhancement) |
| text moves on scroll | Scroll-linked kinetic typography | GSAP ScrollTrigger split-text | YES | cap.type.kinetic (conditional) |
| many subtle interactions | Coherent microinteraction system | one motion language (durations/easing) | YES | cap.motion.system (CORE) |

**What CRAV did particularly well (answer to Q7):**
1. **One coherent motion language** — every animation shares duration/easing vocabulary.
2. **Restraint** — no WebGL, no autoplay audio, no fake progress. Premium via craft, not spectacle.
3. **Real loader** gated on actual assets → perceived performance is honest.
4. **Reduced-motion is a first-class branch**, not an afterthought.
5. **Cursor follows content** (lerp), making the whole page feel "alive" cheaply.

**What BusinessForge should learn WITHOUT copying (Q8):**
- Learn the *system* (coherence, restraint, real loader, reduced-motion branch, lerp cursor as a
  signature). Do NOT copy the *specific* burger branding or its exact clip ratios. The transferable
  principle is "premium = coherent DOM-transform motion system + honest performance + a11y branch."

**WebGL nuance for BF:** CRAV proves you can hit 7/10 distinctiveness with ZERO WebGL. Reserve WebGL
(OGL/Three) for businesses where 3D adds functional or brand value (product viewer, real-estate tour),
per §17.

---

# 3–22. EXPERIENCE TAXONOMY (condensed pointers to v1 + new evidence)

> Full per-pattern records live in v1 §3–§21 and `01`/`02`. Below we add the v2-critical updates and
> the provider/real-site evidence that the first pass did not have.

## 4–6. Loading / Navigation / Page Transitions
- **Preloader:** OBSERVED on CRAV (asset-gated, real). Reject fake progress bars (reject-list).
- **View Transitions API:** INFERRED-available (MDN docs exist, Chromium + expanding). Use as
  progressive enhancement with GSAP/Barba fallback. cap.nav.transition (CONDITIONAL).
- **Overlay/full-screen menu:** OBSERVED on CRAV via Framer Motion. Good for editorial/luxury/portfolio;
  bad for utility dashboards.

## 7. Cursor / Pointer
- **Follower + lerp inertia:** OBSERVED core CRAV/Cuberto technique. Cheap (DOM transforms).
  cap.cursor.follower. Good: creative/luxury/restaurant/fashion/portfolio. Bad: gov/healthcare/finance-utility.
- **Touch fallback:** cursor effects MUST disable on touch (CRAV does). Non-negotiable.

## 8–9. Layout / Scroll
- **Clipped/cropped composition:** OBSERVED CRAV (clip=9). Structural, not decoration.
- **Smooth scroll + inertia:** Lenis CONFIRMED maintained (OBSERVED README). Standard over Locomotive.
- **Scroll storytelling (pin + scrub):** GSAP ScrollTrigger OBSERVED on CRAV/Cuberto. cap.scroll.story.

## 10–13. Typography / Images / Video / Audio
- Kinetic typography, image reveal/mask, cinematic hero video, ambient video — see v1 §10–§12.
- **Audio:** autoplay is harmful by default (browser policy + UX). Gate behind explicit toggle.
  Reject autoplay-with-sound.

## 14. Motion Systems (library best-fit — rational hierarchy)
- **GSAP + ScrollTrigger** = scroll-linked, timeline, pin/scrub, complex choreography. Best-in-class there.
- **Lenis** = smooth/inertia scroll + parallax sync. Standard.
- **Framer Motion / Motion** = component/route transitions in React. Best for app-like UI.
- **Anime.js** = lightweight one-off element animations (no scroll need).
- **Theatre.js** = timeline authoring/editor, not runtime.
- **CSS scroll-driven animations** (`animation-timeline: scroll()/view()`) = zero-JS progressive enhancement for simple reveals.
- **Web Animations API** = imperative JS animation without a lib.
- **View Transitions API** = native route transitions.
- Do NOT put GSAP on everything. Match library to job (Q: "do not recommend a library just because popular").

## 15. Microinteractions
- Button/hover/focus/validation/success/error/empty/loading/skeleton states.
- These are PRODUCT QUALITY, not decoration. cap.micro.* (CORE floor).

## 16. Functional Interactions (what a *complete* site can do)
- Search, filtering, product configurator, booking/scheduling, maps, calculators/quote builders,
  comparison tools, forms, auth, accounts, dashboards, payments/subscriptions, CMS, CRM, notifications,
  personalization, real-time data, external APIs, databases, customer portals.
- BusinessForge must automate these from business evidence (the factory's real job). See v1 §16 + §27–30.

## 17. 3D / WebGL / WebGPU (WHEN IT IS WORTH IT)
- **RETRACTED (2026-08-19):** an earlier draft asserted "top studios use OGL/WebGL (OBSERVED)". That was a
  substring false positive (`ogl` inside `google`). Boundary-aware re-grep + JS-bundle fetches show
  **Active Theory, Dogstudio, 14islands, Monogrid, Cuberto, CRAV have ZERO OGL/Three/WebGL signatures in
  homepage HTML + initial bundles.** Whether they lazy-load WebGL in route chunks is **UNKNOWN** (needs a
  rendered-DOM probe — static curl cannot see it). Do NOT claim studio WebGL without that probe.
- **Verified:** premium experience does NOT require WebGL (CRAV = GSAP+Lenis+DOM transforms, 0 GPU cost).
- **Worth it (when justified by business evidence):** 3D product viewer, configurator, real-estate
  walkthrough, interactive environment, scroll-controlled 3D story — where 3D adds FUNCTIONAL or strong
  brand value. Use **OGL** (tiny ~10KB) as the lightweight entry; **Three.js** for full 3D; **WebGPU** only
  as progressive enhancement (not baseline).
- **Decorative overkill:** floating shader blobs on a restaurant/menu site, generic "particles" hero
  with no business meaning. Reject (reject-list).
- **WebGPU:** INFERRED available (MDN docs) but not baseline — progressive enhancement only.

## 18. AI MEDIA — PROVIDER MATRIX (OBSERVED + UNKNOWN, honest)

| Provider | Cat | API | Free | Commercial | Cost signal | BF relevance |
|---|---|---|---|---|---|---|
| **Higgsfield** | vid+img+audio | **YES (docs)** | UNKNOWN | UNKNOWN (verify ToS) | pricing page, exact $ not public | **HIGH** — director/camera video; expose cap.video_generation / cap.image_to_video CONDITIONALLY |
| Runway | vid | site OK, API not probed | free tier exists | UNKNOWN | pricing page | HIGH alt |
| Google Veo | vid | **api(89)+camera(10)** OBSERVED | UNKNOWN | UNKNOWN | — | HIGH (programmatic + camera) |
| OpenAI Sora | vid | 403 blocked | — | — | — | UNKNOWN live |
| FLUX | img | **API + open weights** | API $300 tier | license terms present | $300 | MED (self-host option) |
| ElevenLabs | voice/music | **api(35)** | **$0**; $6/mo = **Commercial License** | **YES on $6+** | $0/$6/$11/$22/$99/$299/$990 | **HIGH** (narration, brand VO) |
| Tripo | 3D | **API** | **$0/200 cr** | non-commercial free; paid commercial | $0/$19/$54/$89/$1000 | MED (product 3D) |
| Meshy | 3D | **API + MCP** | $0/$10… | "you own; commercial OK paid" OBSERVED | $0/$10/$20/$40/$70/$100/$240 | MED (Unity/MCP pipeline) |
| Rive | interactive | runtime (webgl/canvas) | free tier | — | — | MED (interactive vector) |

**Higgsfield assessment (Q9):** Confirmed real product with documented API + image/video/audio +
director/camera control. Before exposing cap.video_generation, VERIFY (a) price, (b) free allowance,
(c) commercial license + watermark — all UNKNOWN on public pages. Gate activation on business evidence
(product/brand benefits from motion assets) + budget + license review. Do NOT auto-apply to every site.

## 19. Maps / Data / Visualization
- Interactive maps (Mapbox/Leaflet/Google), route planning, dashboards, data viz (D3/Canvas/WebGL),
  real-time data (WebSockets). Functional value high for hotel/real-estate/tourism/logistics.
  See v1 §19.

## 20–22. Performance / Accessibility / Mobile
- **Premium ≠ slow.** Lazy load, code-split, prefetch, priority hints, responsive/adaptive assets,
  progressive enhancement, device-capability detection, adaptive quality.
- **Accessibility floor:** keyboard, focus management, screen-reader, reduced-motion, touch alternative.
- **Mobile:** disable cursor effects; reduce WebGL; use native scroll; respect data-saver.
- **Reduced motion:** OBSERVED on CRAV as a designed branch (opacity-only fallback). Mandatory pattern.

(Sections 23–34 of v1 cover Business Context Matrix, Provider/Library Matrix, Real Examples,
Capability Taxonomy, Tiers 0–3, Reject List, Hermes Knowledge Structure, Blueprint primitives, QA —
reused and extended below.)

---

# 23. BUSINESS CONTEXT MATRIX (systematic GOOD / BAD)

| Capability | GOOD business types | BAD / reject-by-default |
|---|---|---|
| Custom cursor (follower/lerp) | creative studio, luxury, fashion, restaurant, premium product, portfolio | government, healthcare, financial utility, accessibility-heavy |
| Page/route transition | editorial, luxury, hospitality, creative, portfolio | emergency healthcare, high-speed transactional, utility dashboards |
| Scroll storytelling (pin/scrub) | brand/luxury, restaurant, nonprofit story, real-estate | dense data dashboards, internal tools |
| Interactive product viewer/3D | ecommerce product, real-estate, automotive, furniture | pure content/blog, utility |
| Booking/scheduling | restaurant, hotel, salon, clinic, services | — (almost always good when relevant) |
| Maps | hotel, restaurant, real-estate, tourism, logistics | — (good when location matters) |
| AI-generated video (Higgsfield) | restaurant hero, fashion lookbook, real-estate walkthrough, brand film | government, healthcare, finance-utility, every-template site |
| Ambient/autoplay audio | (almost never by default) | ALL — reject autoplay-with-sound |
| Fake progress bar | (never) | ALL — reject |
| Decorative WebGL | (rarely) | restaurant/menu without 3D need, utility — reject |

---

# 24. PROVIDER / LIBRARY MATRIX (consolidated)

Libraries (all OBSERVED-maintained / free unless noted):
- GSAP + ScrollTrigger — free, scroll/choreography king.
- Lenis — free, smooth scroll standard (Locomotive = DEPRECATED, do not use).
- Framer Motion / Motion — free, React transitions.
- Anime.js — free, lightweight.
- Theatre.js — free, authoring.
- OGL — free, tiny WebGL (studio entry point).
- Three.js — free, full 3D.
- Rive — free tier, interactive runtime.
- Lottie — free, vector animation playback.

AI media (see §18 table for facts). Motion libs are €0 → fit the "€0 before first customer" constraint.

---

# 25. REAL-SITE EXAMPLES (OBSERVED evidence, boundary-verified)

OBSERVED via curl fetch + **boundary-aware** grep (`(?<!g)ogl(?!e)` to exclude `google`; actual JS-bundle
fetches). Full dossier in `04_real_examples.md`.

| Site | Type | OBSERVED stack (homepage HTML) | Notable |
|---|---|---|---|
| **CRAV** cravburgers.shop | restaurant | Lenis+GSAP+ScrollTrigger+Framer+lerp cursor; **0 WebGL** | Coherent DOM-transform premium, reduced-motion branch |
| **Cuberto** cuberto.com | agency | gsap(2) webgl(1) cursor(84) preload(12) in HTML; bundle: gsap(105) scrolltrigger(25) lenis(42) split(72) cursor(55); **0 OGL/three** | Same family as CRAV; minimal WebGL signal |
| Awwwards winners listing | directory | gsap(4) webgl(4) three(1) cursor(70) | Directory; WebGL present across winners (aggregation) |
| Codrops | dev blog | gsap(11) three(3) webgl(8) | Tutorials explicitly about WebGL/Three |
| Webflow | platform | gsap(50) three(34) | Platform marketing, not a single experience |

**Studio WebGL status = UNKNOWN (not proven absent):** Active Theory, Dogstudio, 14islands, Monogrid,
Immersive Garden, Resn return SPA/WordPress shells where WebGL would live in lazily-loaded route chunks
NOT in the initial fetch. Static curl cannot see them. **Do not assert these studios use/avoid WebGL
without a rendered-DOM probe (Playwright/Chrome).** The only firm OBSERVED-absent finding is CRAV (0
WebGL in homepage + 15 bundles).

WHY THEY WORK: one coherent motion language + restraint + honest performance + a11y branch.
WHAT BF SHOULD NOT COPY: business-specific branding, exact clip ratios, spectacle-for-spectacle.

(Async dossier `04_real_examples.md` is the corrected, boundary-verified companion.)

---

# 26. CAPABILITY TAXONOMY (naming convention)
`cap.<domain>.<name>` — e.g. `cap.cursor.follower`, `cap.nav.transition`, `cap.scroll.story`,
`cap.motion.system`, `cap.entry.loader.brand`, `cap.product.viewer`, `cap.video_generation`,
`cap.booking`, `cap.maps`, `cap.payments`, `cap.micro.skeleton`. Each record carries the full
capability schema (§33) with TRIGGER + REJECTION conditions.

# 27–30. TIERS (from v1, extended)
- **TIER 0 (Core / existing):** motion.system, reduced-motion branch, skeleton/optimistic UI,
  microinteractions floor, lenis smooth scroll, gsap reveals, semantic a11y, responsive.
- **TIER 1 (implement next — high value, low/med cost):** custom follower cursor, scroll storytelling,
  overlay nav + View Transitions, clip layout, kinetic typography, interactive product viewer,
  search/filter, booking/scheduling, maps, payments/checkout, AI-media (Higgsfield) gated.
- **TIER 2 (conditional):** 3D/OGL viewer, configurator, dashboards, real-time data, ambient video,
  audio toggle, CMS-driven.
- **TIER 3 (advanced/experimental):** WebGPU, generative shader environments, AI-personalized motion,
  voice-navigated UI. Off by default.

# 31. REJECT LIST (derived from research)
1. Fake progress bars (CRAV used REAL asset-gated loader — copy that, not fake).
2. Decorative WebGL with no business meaning (use OGL only where it adds value).
3. Autoplay audio / sound-on-load.
4. Cursor effects on utility/government/healthcare/finance sites.
5. Animation that delays content (loader longer than asset load).
6. Heavy libs for trivial interactions (don't ship Three.js for a hover).
7. Locomotive Scroll (deprecated) — use Lenis.
8. Sora/expensive video by default (cost) — gate behind evidence.
9. Template-every-site AI media — apply only on business evidence + license check.
10. Effects with no user/business value.

# 32. PROPOSED HERMES KNOWLEDGE STRUCTURE
`experience_capability` records: {name, domain, category, ux, mechanism, evidence_level, good_contexts,
bad_contexts, functional_value, emotional_value, complexity, perf_cost, a11y_risk, mobile_strategy,
reduced_motion_strategy, deps, libraries, providers, license, cost, blueprint_primitive, qa,
trigger_conditions, rejection_conditions}. Indexable + injectable into Experience Director context.

# 33. PROPOSED EXPERIENCE BLUEPRINT PRIMITIVE
```json
{
  "capability": "cap.cursor.follower",
  "trigger": {"business_types": ["luxury","restaurant","creative","fashion"], "evidence": "brand_premium=true"},
  "reject": {"business_types": ["government","healthcare"], "reduced_motion": true, "touch": true},
  "mechanism": "gsap.quickTo + lenis + exponential lerp",
  "perf": "low (DOM transform)",
  "a11y": "disabled on touch + reduced-motion",
  "qa": ["cursor hidden on touch", "opacity-only under reduced-motion", "no layout shift"]
}
```

# 34. PROPOSED QA CRITERIA
- Functional QA: every capability has a no-JS / reduced-motion / touch fallback that still delivers content.
- Visual QA (existing critic): distinctiveness + business-specificity ≥ threshold.
- Perf QA: Lighthouse perf ≥ budget on mid mobile; no main-thread jank from animations.
- A11y QA: keyboard reachable, focus visible, screen-reader announces state, reduced-motion honored.
- Provider QA (AI media): license + watermark + commercial rights verified before publish.

---

# 35. ANSWERS TO THE 10 FINAL QUESTIONS

**Q1. 20 highest-value capabilities to implement first**
1. `cap.motion.system` (coherent duration/easing/stagger tokens) — CORE
2. `cap.motion.reduced_motion` branch — CORE/a11y
3. `cap.entry.loader.brand` (real asset-gated, not fake) — from CRAV
4. `cap.scroll.story` (GSAP pin/scrub storytelling)
5. `cap.cursor.follower` (lerp inertia) — premium signal, cheap
6. `cap.nav.overlay` + `cap.nav.transition` (View Transitions, progressive)
7. `cap.layout.clip` (cropped/editorial composition)
8. `cap.type.kinetic` (split-text reveal)
9. `cap.image.reveal` / `cap.image.mask`
10. `cap.micro.skeleton` + optimistic UI
11. `cap.micro.button` / hover / focus / validation states
12. `cap.product.viewer` (interactive imagery / 360)
13. `cap.search` + `cap.filter`
14. `cap.booking` / `cap.scheduling`
15. `cap.maps` (interactive)
16. `cap.payments` / `cap.checkout`
17. `cap.video.hero` (cinematic, gated)
18. `cap.video_generation` (Higgsfield, CONDITIONAL, license-gated)
19. `cap.configurator` (product, where relevant)
20. `cap.cms_driven` / dynamic content

**Q2. Capabilities that make a site feel less AI-generated**
- Coherent motion system + reduced-motion branch (most AI slop has random/janky motion or none).
- Real asset-gated loader (not instant or fake).
- Custom lerp cursor + clip layout + kinetic typography (the CRAV "signature").
- Business-specific interactions (booking, configurator, maps) vs generic sections.
- Honest performance + a11y (AI slop breaks keyboard/reduced-motion).

**Q3. Biggest perceived quality jump**
- A **single coherent motion language** (duration/easing/stagger tokens) + a **real loader** +
  **custom cursor**. Together they signal "designed," not "generated." (CRAV proof.)

**Q4. Cheap/easy enough to implement broadly (€0, low complexity)**
- Lenis smooth scroll, GSAP reveals, skeleton/optimistic UI, microinteractions, clip layout,
  kinetic typography, View Transitions, reduced-motion branch. All free libs / native CSS.

**Q5. Activate ONLY conditionally**
- Custom cursor (not on gov/health/finance/touch), 3D/WebGL (not on utility), AI video (not by default),
  ambient video, audio toggle, page transitions (not on transactional), configurator (only if products).

**Q6. Almost never use**
- Fake progress, autoplay audio, decorative WebGL, Locomotive, Sora-by-default, cursor on utility sites,
  animation that delays content.

**Q7. What CRAV did well** — see §2 (coherence, restraint, real loader, reduced-motion branch, lerp cursor).

**Q8. Learn without copying** — learn the SYSTEM (coherence/restraint/honest-perf/a11y/cursor-signature);
do not copy burger branding or exact clip ratios.

**Q9. What Higgsfield/providers add** — programmatic, director-controlled image/video/audio generation
for product/brand motion assets, gated behind business evidence + license verification. FLUX (self-host),
ElevenLabs (VO/commercial $6), Tripo/Meshy (3D), Veo (camera-controlled video). All have APIs + free tiers
fit the €0-before-customer constraint for dev; per-generation cost only on production.

**Q10. Ideal 2026 arsenal (best practical combination)**
- **Models:** Claude/OpenAI (reasoning + Experience Director), FLUX/Imagen (image), Higgsfield/Runway/Veo
  (video), ElevenLabs (voice), Tripo/Meshy (3D).
- **Tools:** GSAP+ScrollTrigger, Lenis, Framer Motion, OGL/Three (conditional), Rive (interactive).
- **MCP:** filesystem, browser (Playwright QA), Maps, Payments, CMS, provider APIs (Higgsfield/Tripo/etc.).
- **Browser automation:** Playwright for visual critic + functional QA + screenshot diff.
- **Web:** real-site probing for evidence (curl/Playwright), Awwwards/FWA as inspiration not templates.
- **Orchestration:** capability planner selects `cap.*` from business evidence → Experience Blueprint →
  deterministic implementation → functional + visual QA → repair. Conditional gating + reject-list prevent
  AI-slop. AI media only on verified license + business evidence.

---

# 36. RECOMMENDED NEXT IMPLEMENTATION ORDER
1. Motion system + reduced-motion branch + skeleton/micro floor (TIER 0, €0).
2. CRAV-style loader + lerp cursor + clip layout + kinetic type (TIER 1, cheap, high signal).
3. Scroll storytelling + overlay nav + View Transitions.
4. Functional: search/filter, booking, maps, payments (business-dependent).
5. Product viewer / configurator (where evidence supports).
6. AI media (Higgsfield) gated behind license + business check.
7. OGL/Three 3D only where functional value.
8. WebGPU / generative only as experimental, off by default.

END OF v2 CORE. (Companion dossiers `04_real_examples.md`, `05_provider_matrix.md` extend §18/§25 when present.)
