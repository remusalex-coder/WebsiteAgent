/**
 * GSAP ScrollTrigger adapter — the second external, open-source Tier-2
 * runtime primitive (registry id `gsap-scrolltrigger`,
 * `lib/design/experienceRegistry.ts`), following the same seam
 * `lib/runtime/lenis.ts` established for Lenis.
 *
 * ## What's the same as Lenis, and what's genuinely different
 *
 * Same shape: vendor the real published build (`vendor/gsapSource.ts`),
 * write a small typed guard-and-construct glue, dispatch both halves off the
 * `RuntimePrimitiveId` through the same two tables Lenis already uses
 * (`RUNTIME_PRIMITIVE_SOURCES` / `RUNTIME_PRIMITIVE_RULES`).
 *
 * Different in ways that were worth proving before calling the mechanism
 * "reusable":
 *   - **Two vendored files, one load-order dependency.** GSAP ships its
 *     engine and ScrollTrigger as separate UMD bundles; ScrollTrigger reads
 *     `window.gsap` at load time and self-registers, so the core must run
 *     first. `GSAP_RUNTIME_SOURCE` below concatenates them in that order —
 *     Lenis, being a single file, never had an ordering question to get
 *     right.
 *   - **An explicit `registerPlugin` call in the glue**, not just
 *     construction — GSAP's plugin architecture, not Lenis's.
 *   - **A different licence shape.** GSAP is GreenSock's own "no charge"
 *     licence, not MIT/OSI open source (see `vendor/gsapSource.ts`'s header)
 *     — the registry's `license` field says so precisely rather than
 *     inheriting Lenis's "MIT" wholesale.
 *   - **No coarse-pointer guard.** Lenis disables entirely on touch
 *     (`mobileSupport: 'disabled'`); ScrollTrigger's scrub-based reveal
 *     degrades acceptably on touch rather than needing to be switched off
 *     (`mobileSupport: 'degraded'`, unchanged from the pre-existing registry
 *     row) — a real behavioural difference, not a copy-paste of Lenis's
 *     guard list.
 *
 * ## What this primitive actually does
 *
 * A scroll-scrubbed reveal on every non-hero section: `gsap.fromTo` animates
 * opacity/`y` with `scrollTrigger: { scrub: true }`, so the animation tracks
 * scroll position continuously rather than settling once a CSS
 * `--forge-vis` threshold is crossed (`scroll-reveal`'s mechanism). This is a
 * genuinely different capability from the internal `scroll-reveal`
 * primitive, not a re-implementation of it in a heavier library — the
 * distinguishing claim in the registry's own `capabilities` field
 * ("scroll-triggered timelines, pinning, scrubbing — far wider than the
 * internal runtime") is exercised, not just asserted.
 */
import {
  GSAP_CORE_VENDOR_SOURCE,
  GSAP_SCROLLTRIGGER_VENDOR_SOURCE,
  GSAP_VENDOR_LICENSE,
  GSAP_VENDOR_PACKAGE,
  GSAP_VENDOR_VERSION,
} from './vendor/gsapSource.js';

export { GSAP_VENDOR_LICENSE, GSAP_VENDOR_PACKAGE, GSAP_VENDOR_VERSION };

/**
 * Init/teardown glue, appended after both vendored bodies.
 *
 * Guard order:
 *   1. reduced motion            → never register the plugin or build a
 *      single ScrollTrigger; the static floor stays the static floor.
 *   2. `window.gsap`/`ScrollTrigger` missing → the vendored scripts above
 *      failed to define them (should be unreachable — both ship together —
 *      but fails safe rather than throwing if the vendored shape ever
 *      changes upstream).
 *   3. everything wrapped in try/catch        → a throw during
 *      `registerPlugin` or any `gsap.fromTo` call degrades to the static
 *      floor, identically to a rejected guard.
 *
 * `data-runtime-scroll-gsap="scrolltrigger"` mirrors
 * `data-runtime-scroll="lenis"` / `data-runtime-cursor="magnetic"` — a
 * marker attribute a QA pass or test can assert on without inspecting GSAP's
 * internal state.
 */
const GSAP_INIT_SOURCE = `function startGsapScrollTrigger() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
  if (!window.gsap || typeof window.gsap.registerPlugin !== 'function' || !window.ScrollTrigger) return function () {};
  var triggers = [];
  try {
    window.gsap.registerPlugin(window.ScrollTrigger);
    var sections = document.querySelectorAll('section.section:not(.section--hero)');
    for (var i = 0; i < sections.length; i += 1) {
      var section = sections[i];
      var tween = window.gsap.fromTo(
        section,
        { autoAlpha: 0.4, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 55%', scrub: true },
        }
      );
      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
    }
    document.documentElement.setAttribute('data-runtime-scroll-gsap', 'scrolltrigger');
  } catch (err) {
    return function () {};
  }
  var teardown = function () {
    document.documentElement.removeAttribute('data-runtime-scroll-gsap');
    for (var j = 0; j < triggers.length; j += 1) {
      try { triggers[j].kill(); } catch (err) {}
    }
  };
  window.addEventListener('pagehide', teardown, { once: true });
  return teardown;
}
startGsapScrollTrigger();
`;

/**
 * The full `runtime.js` fragment for `gsap-scrolltrigger` — the vendored
 * core, then the vendored plugin, then the glue. All three orderings matter:
 * the plugin needs `window.gsap` from the core, and the glue needs both.
 */
export const GSAP_RUNTIME_SOURCE = `${GSAP_CORE_VENDOR_SOURCE}\n${GSAP_SCROLLTRIGGER_VENDOR_SOURCE}\n${GSAP_INIT_SOURCE}`;
