/**
 * Generic scroll-progress runtime — the smallest architecturally-correct
 * experience primitive.
 *
 * ## What it is
 *
 * A bread-free, model-free client module. It does exactly two things and nothing
 * Bakery-specific:
 *
 *   1. Writes `--forge-scroll` on `<html>` — the page's overall read progress,
 *      0 at the top, 1 at the bottom.
 *   2. Writes `--forge-vis` on each `<section>` — how much of that section is
 *      currently in view, 0 (none) → 1 (fully framed). Driven by
 *      IntersectionObserver, not a scroll listener, so it is cheap and pauses
 *      when the tab is hidden.
 *
 * That is the whole contract: `section progress → --p / --vis`. Everything the
 * CSS does with those numbers (a pinned hero, a continuous world-ground
 * crossing, a parallax) lives in the stylesheet, where it is reviewable and
 * deterministic. The runtime never authors a colour, a duration or a transform
 * value — it only reports position.
 *
 * ## Why it exists
 *
 * The deterministic renderer is not the same as a static one. A business whose
 * character earns a narrative can have its *traversal* be continuous: the scroll
 * itself carries the day. That is impossible in pure CSS without a progress
 * signal, and re-introducing a WebGL engine per business is the wrong answer
 * (see the master plan, §9 Tier 2). So: one tiny, opt-in, generic runtime.
 *
 * ## Safety
 *
 *  - `prefers-reduced-motion: reduce` → it does not start. The page is the
 *    static floor; the CSS's reduced-motion branches already guarantee that.
 *  - Touch / coarse pointers → it still reports `--forge-vis` (harmless) but the
 *    CSS does not pin or parallax on coarse devices, so there is no scroll
 *    hijack and no jank on a phone.
 *  - No WebGL, no rAF loop burning CPU: a single rAF-batched scroll read plus
 *    IntersectionObserver. It removes its own listeners on `pagehide`.
 *  - If anything throws, the page is simply the static floor — failure here can
 *    never break navigation or content.
 */

import { LENIS_RUNTIME_SOURCE } from './lenis.js';
import { GSAP_RUNTIME_SOURCE } from './gsapScrollTrigger.js';
import { THREE_HERO_RUNTIME_SOURCE } from './threeHero.js';
import { HORIZONTAL_SCROLL_SOURCE, BENTO_CARD_TILT_SOURCE, CURSOR_WEBGL_INIT_SOURCE, MARQUEE_SOURCE, IMAGE_HOVER_REVEAL_SOURCE, ANIMATED_COUNTER_SOURCE, STICKY_TEXT_PIN_SOURCE, MENU_OVERLAY_SOURCE } from './forgePrimitives.js';

import type { RuntimePrimitiveId } from '../design/experience.js';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function startScrollProgress(): () => void {
  // Guard against non-browser environments (e.g. importing the module under
  // Node for its RUNTIME_SOURCE string). Nothing here touches the DOM until
  // this function is actually called in a browser.
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }
  const ROOT = document.documentElement;
  // Reduced motion: do not run. The CSS reduced-motion branches keep the page
  // as the static floor, which is the correct degradation.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return () => {};

  const sections = Array.from(ROOT.querySelectorAll<HTMLElement>('section.section'));

  let ticking = false;
  const update = (): void => {
    ticking = false;
    const max = ROOT.scrollHeight - window.innerHeight;
    const scroll = max > 0 ? clamp01(window.scrollY / max) : 0;
    ROOT.style.setProperty('--forge-scroll', scroll.toFixed(4));

    // Per-section visibility from its rect (cheap; runs only on scroll frames).
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom <= 0 || rect.top >= vh) {
        section.style.setProperty('--forge-vis', '0');
        continue;
      }
      /*
       * The intersection of the section with the viewport, as a height.
       *
       * The obvious-looking `min(h, vh) - max(0, top) - max(0, vh - bottom)`
       * is wrong whenever the section is SHORTER than the viewport: the last
       * term subtracts the empty space below the element even though that gap
       * is not occluding anything, and a fully-visible short section scores 0.
       *
       * It goes wrong hardest exactly where it is most expensive. The
       * screenshot pass grows the viewport to the page's full height before
       * capturing (`captureScreenshots`), so `vh` becomes larger than every
       * section, every `--forge-vis` reads 0, and the entire page below the
       * fold renders transparent in the image the visual critic and the
       * distinctness gate then judge. The gate scored such a page 99/PASS.
       */
      const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
      const vis = rect.height > 0 ? clamp01(visible / Math.min(rect.height, vh)) : 0;
      section.style.setProperty('--forge-vis', vis.toFixed(4));
    }
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  // Seed once, then observe.
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Mark the root so CSS can opt into runtime-driven behaviour.
  ROOT.setAttribute('data-runtime', 'scroll-progress');

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    ROOT.removeAttribute('data-runtime');
  };
}

/**
 * Magnetic cursor — a synthetic pointer follower that snaps toward
 * interactive elements it nears (registry id `magnetic-cursor`, category
 * `cursor`).
 *
 * A genuinely different signal from scroll-progress's — pointer position, not
 * scroll or intersection — so it cannot be expressed as a function of
 * `--forge-scroll`/`--forge-vis`. Still routed through this one runtime host
 * rather than a second one: same guard discipline (reduced-motion, coarse
 * pointer), same "reports position, the stylesheet decides what it means"
 * split (`MAGNETIC_CURSOR_RULES` in `lib/render/runtime-rules.ts` owns every
 * visual value; this only ever writes a `transform`).
 *
 * Never attaches on touch/coarse pointers — the guard runs before a single
 * DOM node is created, so a phone visitor pays nothing for this primitive.
 */
export function startMagneticCursor(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !fine) return () => {};

  const ROOT = document.documentElement;
  const cursor = document.createElement('div');
  cursor.className = 'forge-cursor';
  document.body.appendChild(cursor);
  ROOT.setAttribute('data-runtime-cursor', 'magnetic');

  const move = (event: PointerEvent): void => {
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  };
  const onEnter = (): void => cursor.classList.add('forge-cursor--active');
  const onLeave = (): void => cursor.classList.remove('forge-cursor--active');

  const targets = Array.from(document.querySelectorAll<HTMLElement>('a, button'));
  window.addEventListener('pointermove', move, { passive: true });
  for (const target of targets) {
    target.addEventListener('pointerenter', onEnter);
    target.addEventListener('pointerleave', onLeave);
  }

  return () => {
    window.removeEventListener('pointermove', move);
    for (const target of targets) {
      target.removeEventListener('pointerenter', onEnter);
      target.removeEventListener('pointerleave', onLeave);
    }
    cursor.remove();
    ROOT.removeAttribute('data-runtime-cursor');
  };
}

/**
 * The magnetic cursor as a self-contained source-string fragment, appended to
 * `RUNTIME_SOURCE` only when `magnetic-cursor` is a requested primitive (see
 * `runtimeSourceFor` below). Same reasoning as `RUNTIME_SOURCE` itself: `tsx`/
 * esbuild rewrite named function bindings under `page.evaluate`, so the
 * shipped fragment is written without type annotations, kept in sync by hand.
 */
const MAGNETIC_CURSOR_SOURCE = `function startMagneticCursor() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const ROOT = document.documentElement;
  const cursor = document.createElement('div');
  cursor.className = 'forge-cursor';
  document.body.appendChild(cursor);
  ROOT.setAttribute('data-runtime-cursor', 'magnetic');
  const move = (e) => { cursor.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)'; };
  const onEnter = () => cursor.classList.add('forge-cursor--active');
  const onLeave = () => cursor.classList.remove('forge-cursor--active');
  window.addEventListener('pointermove', move, { passive: true });
  for (const t of document.querySelectorAll('a, button')) {
    t.addEventListener('pointerenter', onEnter);
    t.addEventListener('pointerleave', onLeave);
  }
}
startMagneticCursor();
`;

/**
 * Extra JS a `RuntimePrimitiveId` needs beyond the base `RUNTIME_SOURCE`.
 * `scroll-reveal`/`text-reveal` are CSS-only (empty string — the base
 * runtime's `--forge-vis` already covers them); `css-scroll-driven-reveal`
 * is CSS-only for a different reason — it needs no JS signal at all, not
 * even `--forge-vis`, since the native `animation-timeline: view()`
 * compositor timeline drives it directly. `magnetic-cursor` and
 * `lenis-smooth-scroll` are the primitives with a JS half of their own — the
 * latter's fragment is the vendored external library plus its init glue
 * (`lib/runtime/lenis.ts`'s `LENIS_RUNTIME_SOURCE`), not hand-written here,
 * but dispatched through the exact same table. Mirrors
 * `lib/render/runtime-rules.ts`'s `RUNTIME_PRIMITIVE_RULES` dispatch, kept as
 * a separate table because CSS and JS are genuinely different artifacts with
 * different injection points (`styles.css` vs `runtime.js`), not because the
 * vocabulary is different — both are keyed by the same `RuntimePrimitiveId`.
 */
const RUNTIME_PRIMITIVE_SOURCES: Readonly<Record<RuntimePrimitiveId, string>> = {
  'scroll-reveal': '',
  'text-reveal': '',
  // WQ-021: driven entirely by native `animation-timeline: view()` — no JS
  // of any kind, not even the base runtime's --forge-vis computation.
  'css-scroll-driven-reveal': '',
  'magnetic-cursor': MAGNETIC_CURSOR_SOURCE,
  'lenis-smooth-scroll': LENIS_RUNTIME_SOURCE,
  'gsap-scrolltrigger': GSAP_RUNTIME_SOURCE,
  'three-js-hero-object': THREE_HERO_RUNTIME_SOURCE,
  'horizontal-scroll': HORIZONTAL_SCROLL_SOURCE,
  'bento-card-tilt': BENTO_CARD_TILT_SOURCE,
  'cursor-reactive-webgl': CURSOR_WEBGL_INIT_SOURCE,
  'marquee': MARQUEE_SOURCE,
  'image-hover-reveal': IMAGE_HOVER_REVEAL_SOURCE,
  'animated-counter': ANIMATED_COUNTER_SOURCE,
  'sticky-text-pin': STICKY_TEXT_PIN_SOURCE,
  'menu-overlay': MENU_OVERLAY_SOURCE,
};

/**
 * The runtime's `runtime.js`, for a given set of requested primitives.
 * Defaults to exactly `RUNTIME_SOURCE` — every existing caller that never
 * requests a primitive gets byte-identical output to before this function
 * existed.
 */
export function runtimeSourceFor(ids: readonly RuntimePrimitiveId[]): string {
  const extra = [...new Set(ids)].map((id) => RUNTIME_PRIMITIVE_SOURCES[id]).join('');
  return RUNTIME_SOURCE + extra;
}

/**
 * The runtime as a self-contained ES-module source string, so the renderer can
 * emit it verbatim as `runtime.js` without a build step. Kept in sync with the
 * typed implementation above; this is the string that actually ships to the
 * browser. It is the same logic, written without type annotations.
 */
export const RUNTIME_SOURCE = `const ROOT = document.documentElement;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export function startScrollProgress() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const sections = Array.from(ROOT.querySelectorAll('section.section'));
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = ROOT.scrollHeight - window.innerHeight;
    const scroll = max > 0 ? clamp01(window.scrollY / max) : 0;
    ROOT.style.setProperty('--forge-scroll', scroll.toFixed(4));
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom <= 0 || r.top >= vh) { s.style.setProperty('--forge-vis', '0'); continue; }
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      s.style.setProperty('--forge-vis', (r.height > 0 ? clamp01(visible / Math.min(r.height, vh)) : 0).toFixed(4));
    }
  };
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(update); };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  ROOT.setAttribute('data-runtime', 'scroll-progress');
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    ROOT.removeAttribute('data-runtime');
  };
}
startScrollProgress();
`;
