# 04 — AWWWARDS / PREMIUM EXPERIENCE PATTERNS

> Extract REUSABLE patterns from premium sites. Study mechanisms, never copy branding.
> Repository already has `docs/AWWWARDS_PATTERN_LIBRARY.md` and `02_layout_scroll_type.md`,
> `01_entry_nav_cursor.md` in `bf_research/`. This extends with 2026 observations.

## A. Sites studied (OBSERVED / KNOWN mechanisms)
CRAV, Cuberto, Locomotive, Resn, Dogstudio, Active Theory, 14islands, Immersive Garden,
Monogrid, Apple, Linear, Vercel, Stripe, Awwwards/FWA/CSS-Design-Awards/Land-book/One Page
Love/SiteInspire/Godly galleries. Prior `bf_research` covers layout/scroll/type and
entry/nav/cursor in depth — reuse, don't duplicate.

## B. Pattern → mechanism → BusinessForge implementation (FREE)

| Pattern | Mechanism | BF impl | Justify when |
|---|---|---|---|
| Preloader | asset-aware count (real) | build-time loader | rich media site |
| Skeleton UI | placeholder layout | CSS | data-heavy |
| Custom cursor | CSS+JS lerp follow | `01_entry_nav_cursor` pattern | interactive brand |
| Magnetic buttons | JS proximity + GSAP | same | CTAs |
| Horizontal scroll | ScrollTrigger pin | GSAP | portfolios |
| Pinned sections | ScrollTrigger | GSAP | storytelling |
| Kinetic type | GSAP split + stagger | GSAP | headlines |
| Clip-path reveals | CSS clip + GSAP | CSS | section transitions |
| Image displacement | WebGL shader | Three.js/OGL | hero/fashion |
| Page transitions | View Transitions API | native | route change |
| Scroll choreography | ScrollTrigger timeline | GSAP+Lenis | brand narrative |
| Rive/Lottie micro | runtime + JSON | Rive/Lottie | icons/states |
| 3D configurator | raycast + GLB | Three.js | product |
| Reduced-motion | `prefers-reduced-motion` | all | accessibility |

## C. When NOT to use (reject conditions)
- Decorative motion with no business relevance → reject (see 15/REJECT in asset-stack).
- Heavy WebGL on mobile / low-value pages → gate behind capability + reduced-motion.
- Autoplay-with-sound → never. Mute + controls.

## D. Awwwards-level without premium cost
All patterns above are FREE (GSAP/Lenis/Three.js/Rive/Lottie are free). The "premium feel"
is craft + restraint + business relevance, not spend. This is the core anti-generic lever.

## E. Studying vs copying
- Use premium sites to learn *timing, layering, restraint* — feed into Design Director's
  `experienceStrategy`. Do NOT template-clone a site's look (brand/IP + genericity risk).
- The repo's `AWWWARDS_PATTERN_LIBRARY.md` is the canonical pattern store; extend it.
