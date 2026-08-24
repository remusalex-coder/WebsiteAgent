/**
 * Lenis smooth-scroll adapter — the first external, open-source Tier-2
 * runtime primitive (registry id `lenis-smooth-scroll`,
 * `lib/design/experienceRegistry.ts`).
 *
 * ## Why this shape
 *
 * The renderer has no bundler (PHASE 1 of the integration task audited this:
 * `package.json` carries no build tool beyond `tsc`, and `lib/render/css.ts`'s
 * own docstring promises a rendered site "looks the same offline" — no CDN
 * script tag can keep that promise). So a real npm dependency cannot become
 * `import Lenis from 'lenis'` anywhere the renderer runs; the *actual*
 * upstream code has to reach the artifact some other way.
 *
 * The answer used here: vendor the exact published build. `vendor/lenisSource.ts`
 * holds `dist/lenis.min.js` (npm `lenis@1.3.26`) byte-for-byte, as a string
 * constant with its MIT license header — the same technique
 * `lib/runtime/scroll-progress.ts`'s `RUNTIME_SOURCE` already uses for this
 * repo's own runtime, just applied to someone else's library instead of ours.
 * Lenis's core build is a self-contained IIFE (`globalThis.Lenis = ...`) with
 * no `import`/`export`/`require`, which is exactly what makes this possible —
 * it needs nothing bundled alongside it to run.
 *
 * This file supplies the other half: the small, hand-written glue
 * (`LENIS_INIT_SOURCE`) that constructs `window.Lenis` behind the same guard
 * discipline every other primitive in this directory already applies
 * (reduced-motion, a capability check, a try/catch), and concatenates it
 * after the vendored body so `window.Lenis` exists by the time the glue runs.
 *
 * ## Reusability (PHASE 11)
 *
 * Nothing above is Lenis-specific in shape: "vendor the real build as a
 * string, write a small typed guard-and-construct wrapper, dispatch both
 * halves off the `RuntimePrimitiveId`". GSAP's and Three.js's own dist
 * bundles are not all single dependency-free IIFEs the way Lenis's core
 * build is (Three.js in particular is large and GPU-bound), so *this exact*
 * vendoring strategy will not drop in unchanged for either — but the seam
 * (`vendor/<lib>Source.ts` → `<lib>.ts` guard/construct wrapper →
 * `RUNTIME_PRIMITIVE_SOURCES` / `RUNTIME_PRIMITIVE_RULES` dispatch →
 * `PrimitiveDescriptor.externalIntegration`) is the reusable part, and both
 * would fill in the same contract rather than inventing a new one.
 */
import {
  LENIS_VENDOR_CSS,
  LENIS_VENDOR_LICENSE,
  LENIS_VENDOR_PACKAGE,
  LENIS_VENDOR_SOURCE,
  LENIS_VENDOR_VERSION,
} from './vendor/lenisSource.js';

export { LENIS_VENDOR_LICENSE, LENIS_VENDOR_PACKAGE, LENIS_VENDOR_VERSION };

/**
 * The init/teardown glue, appended after the vendored library body.
 *
 * Guard order matters — cheapest and most decisive first:
 *   1. reduced motion            → never construct Lenis; the static floor
 *      the CSS reduced-motion branches already guarantee stays exactly that.
 *   2. coarse pointer (touch)    → never construct Lenis; native momentum
 *      scrolling on a phone is already the right feel, and Lenis's touch
 *      handling is the primitive's own documented `mobileSupport: 'disabled'`
 *      trade-off (registry entry), not a missing feature.
 *   3. `window.Lenis` missing    → the vendored script above this one failed
 *      to define it (should be unreachable in a page this renderer emits,
 *      since both halves ship together, but the check costs nothing and
 *      means "vendored source changed shape" fails safe instead of throwing).
 *   4. construction throws       → caught; the page is the static floor.
 *
 * `autoRaf: true` asks Lenis to run its own internal `requestAnimationFrame`
 * loop rather than this adapter hand-rolling one — one less moving part, and
 * the exact mechanism upstream's own examples use for a bare integration.
 *
 * `data-runtime-scroll="lenis"` mirrors `data-runtime-cursor="magnetic"`
 * (`lib/runtime/scroll-progress.ts`) — a marker attribute a QA pass or a test
 * can assert on without inspecting Lenis's own internal state, and the same
 * attribute the teardown closure below removes.
 */
const LENIS_INIT_SOURCE = `function startLenisSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
  if (window.matchMedia('(pointer: coarse)').matches) return function () {};
  if (typeof window.Lenis !== 'function') return function () {};
  var lenis;
  try {
    lenis = new window.Lenis({ autoRaf: true });
  } catch (err) {
    return function () {};
  }
  document.documentElement.setAttribute('data-runtime-scroll', 'lenis');
  var teardown = function () {
    document.documentElement.removeAttribute('data-runtime-scroll');
    try { lenis.destroy(); } catch (err) {}
  };
  window.addEventListener('pagehide', teardown, { once: true });
  return teardown;
}
startLenisSmoothScroll();
`;

/**
 * The full `runtime.js` fragment for `lenis-smooth-scroll` — the vendored
 * library, then the glue that uses it. Order is load-bearing: the glue reads
 * `window.Lenis`, which only exists once the vendored IIFE ahead of it has
 * executed. Threaded through `lib/runtime/scroll-progress.ts`'s
 * `RUNTIME_PRIMITIVE_SOURCES` dispatch exactly like `magnetic-cursor`'s own
 * JS fragment — appended only when `lenis-smooth-scroll` is a requested
 * primitive, so a caller that never asks for it ships zero new bytes.
 */
export const LENIS_RUNTIME_SOURCE = `${LENIS_VENDOR_SOURCE}\n${LENIS_INIT_SOURCE}`;

/**
 * The CSS half — upstream's own stylesheet (`dist/lenis.css`), unwrapped.
 * Every selector is scoped under `.lenis`, a class only Lenis's own
 * constructor ever adds to `document.documentElement` (`rootElement`,
 * default `wrapper: window`). On any page or visitor the guards above reject
 * — reduced motion, a coarse pointer, a construction failure — that class
 * never appears, so these rules are inert there, the same
 * "reports/marks, the stylesheet decides, nothing is assumed" split every
 * other primitive in `lib/render/runtime-rules.ts` already uses. Threaded
 * through that file's `RUNTIME_PRIMITIVE_RULES` dispatch the same way.
 */
export const LENIS_STYLE_RULES = LENIS_VENDOR_CSS;
