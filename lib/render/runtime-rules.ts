/**
 * Runtime-driven CSS rules — the *stylesheet half* of the minimal scroll-progress
 * runtime.
 *
 * These rules only take effect when the generic runtime is running:
 * `<html data-runtime="scroll-progress">` exposes `--forge-scroll` (page progress
 * 0→1) and `--forge-vis` (per-section visibility). The runtime (see
 * `lib/runtime/scroll-progress.ts`) never authors a colour or a transform; it
 * only reports position. Everything here is gated on that attribute AND
 * `prefers-reduced-motion`, so a business without the runtime — or a visitor who
 * asked for stillness — gets the identical static page the deterministic floor
 * already produced.
 *
 * Two behaviours, no Bakery-specific code:
 *   B. Cinematic hero — the hero pins and the next section scrolls over it, so
 *      the opening photograph holds while the story begins. Tied to the hero's
 *      own `--forge-vis`, not to scroll-hijack.
 *   D. World crossing — the page's grounds blend continuously as you read, so
 *      the "scroll carries the day" concept is felt, not just read in the band
 *      sequence. The journey's grounds remain the source of truth; this only
 *      cross-fades between them on scroll instead of snapping.
 *
 * A third primitive, scroll reveal, was drafted directly into `RUNTIME_RULES`
 * in an earlier pass and reverted: `RUNTIME_RULES` is appended to *every*
 * rendered stylesheet unconditionally (`lib/render/css.ts`'s
 * `renderStylesheet`), not only when a runtime is actually selected — its
 * rules are inert without `data-runtime="scroll-progress"` on the page, but
 * the string's *bytes* are not, and `test/__snapshots__/design.bakery.styles.css`
 * snapshots those bytes verbatim for every business, including ones that
 * never select a runtime at all. `RUNTIME_RULES` therefore stays exactly as
 * it was — untouched, still unconditionally injected, a known and
 * deliberately un-fixed pre-existing issue — and the reveal primitive below
 * (`SCROLL_REVEAL_RULES` / `runtimePrimitiveRules`) is threaded through a
 * genuinely new, separate, additive parameter instead
 * (`RenderOptions.runtimePrimitives`), so nothing that does not explicitly
 * request it gets a single new byte.
 */
import { LENIS_STYLE_RULES } from '../runtime/lenis.js';
import { THREE_HERO_STYLE_RULES } from '../runtime/threeHero.js';
import { HORIZONTAL_SCROLL_RULES, BENTO_CARD_TILT_RULES, CURSOR_WEBGL_RULES, MARQUEE_RULES, IMAGE_HOVER_REVEAL_RULES, ANIMATED_COUNTER_RULES, STICKY_TEXT_PIN_RULES, MENU_OVERLAY_RULES } from '../runtime/forgePrimitives.js';

import type { RuntimePrimitiveId } from '../design/experience.js';

export const RUNTIME_RULES = `
/* ------------------------------------------------------------------ */
/* RUNTIME — continuous traversal (opt-in, generic, bread-free)         */
/* ------------------------------------------------------------------ */
[data-runtime="scroll-progress"] {
  --forge-scroll: 0;
}
[data-runtime="scroll-progress"] .section {
  --forge-vis: 0;
}

@media (prefers-reduced-motion: no-preference) {
  /* B. Cinematic pinned hero — wider viewports with a fine pointer only.
   * Never on touch/phone, where a pinned hero fights the visitor's thumb and
   * where Playwright/headless may misreport the pointer type. */
  @media (min-width: 768px) and (hover: hover) and (pointer: fine) {
    [data-runtime="scroll-progress"] .section--hero {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: clip;
    }
    [data-runtime="scroll-progress"] .section--hero + .section {
      position: relative;
      z-index: 2;
    }
    /* Gentle parallax: the hero media drifts as the page reads, bounded to the
     * hero's own visibility so it never escapes its frame. */
    [data-runtime="scroll-progress"] .section--hero .media-fill {
      transform: translateY(calc((1 - var(--forge-vis, 1)) * -8%));
      will-change: transform;
    }
  }

  /* D. Continuous world crossing (ember world). Two robust, color-free
   * effects driven only by --forge-vis / --forge-scroll:
   *   - each dark band warms as it is read (brightness tracks visibility), so
   *     the "room warms before morning" concept is felt continuously;
   *   - a faint global daylight overlay rises with page progress, so the whole
   *     page brightens as the scroll carries the day.
   * No colour is authored here — brightness and a dawn overlay restate the
   * world's own tokens. */
  [data-world="ember"][data-runtime="scroll-progress"] .section[data-bg="inverted"],
  [data-world="ember"][data-runtime="scroll-progress"] .section[data-bg="surface"] {
    filter: brightness(calc(0.72 + (var(--forge-vis, 1) * 0.32)));
  }
  [data-world="ember"][data-runtime="scroll-progress"]::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: var(--ember-dawn);
    opacity: calc(var(--forge-scroll, 0) * 0.14);
  }
}
`;

/* -------------------------------------------------------------------- */
/* Tier-2 runtime primitives — genuinely opt-in                          */
/* -------------------------------------------------------------------- */

/**
 * Scroll reveal — a section settles in as it is framed, reading only the
 * `--forge-vis` signal `lib/runtime/scroll-progress.ts` already emits per
 * section. No new JS. No colour, no business-specific value.
 *
 * Deliberately **not** appended into `RUNTIME_RULES` above. `RUNTIME_RULES`
 * is injected into every rendered stylesheet unconditionally
 * (`lib/render/css.ts`'s `renderStylesheet`, historically — see the note at
 * the top of this file), and `test/__snapshots__/design.bakery.styles.css`
 * snapshots those bytes verbatim for businesses that never select a runtime
 * at all. This primitive is instead threaded through as its own parameter
 * (`RenderOptions.runtimePrimitives`, resolved by
 * `lib/design/experience.ts`'s `deriveRuntimePrimitives`), appended only when
 * explicitly requested, so a caller that never asks for it — which includes
 * every existing snapshot fixture — gets zero new bytes. See
 * `runtimePrimitiveRules` below for the dispatch.
 *
 * Floor kept above zero opacity on purpose: a section whose visibility
 * measurement is briefly wrong (a resize mid-transition, a slow first paint)
 * degrades to "faint", never to "gone" — content must never depend on this
 * rule to exist.
 */
const SCROLL_REVEAL_RULES = `
@media (prefers-reduced-motion: no-preference) {
  [data-runtime="scroll-progress"] .section:not(.section--hero) {
    opacity: calc(0.4 + (var(--forge-vis, 1) * 0.6));
    transform: translateY(calc((1 - var(--forge-vis, 1)) * 24px));
    will-change: opacity, transform;
  }
}
`;

/**
 * Text reveal — heading, subheading, body and CTA settle in with a small
 * per-element stagger as their section is framed. Reads only `--forge-vis`;
 * no JS text-splitting, no per-word spans — the stagger is expressed as an
 * incrementing `transition-delay` over the section's own direct children,
 * which is why it is deterministic and CSS-only (registry: `internal`,
 * `deterministic: true`). Earned only by `mode: 'narrative'`
 * (`deriveRuntimePrimitives`), where the words carry the story.
 */
const TEXT_REVEAL_RULES = `
@media (prefers-reduced-motion: no-preference) {
  [data-runtime="scroll-progress"] .section > * {
    transition: opacity 320ms ease-out, transform 320ms ease-out;
    opacity: calc(0.3 + (var(--forge-vis, 1) * 0.7));
    transform: translateY(calc((1 - var(--forge-vis, 1)) * 12px));
  }
  [data-runtime="scroll-progress"] .section > *:nth-child(1) { transition-delay: 0ms; }
  [data-runtime="scroll-progress"] .section > *:nth-child(2) { transition-delay: 60ms; }
  [data-runtime="scroll-progress"] .section > *:nth-child(3) { transition-delay: 120ms; }
  [data-runtime="scroll-progress"] .section > *:nth-child(n+4) { transition-delay: 180ms; }
}
`;

/**
 * Magnetic cursor — a synthetic pointer follower that snaps toward
 * interactive elements it nears. The CSS half only hides the native cursor
 * and reserves the overlay's paint layer; the pointer-tracking logic itself
 * is JS (`lib/runtime/scroll-progress.ts`'s `MAGNETIC_CURSOR_SOURCE`), because
 * following a pointer position is not expressible as a function of
 * `--forge-scroll`/`--forge-vis` — a genuinely different signal, still routed
 * through the one runtime host rather than a second one. Desktop-with-a-fine-
 * pointer only; the JS half never attaches on touch, and this CSS never hides
 * the native cursor unless that JS half actually started.
 */
const MAGNETIC_CURSOR_RULES = `
@media (prefers-reduced-motion: no-preference) and (min-width: 768px) and (hover: hover) and (pointer: fine) {
  [data-runtime-cursor="magnetic"] {
    cursor: none;
  }
  [data-runtime-cursor="magnetic"] a,
  [data-runtime-cursor="magnetic"] button {
    cursor: none;
  }
  .forge-cursor {
    position: fixed;
    top: 0;
    left: 0;
    width: 16px;
    height: 16px;
    margin: -8px 0 0 -8px;
    border-radius: 50%;
    background: var(--color-accent, currentColor);
    opacity: 0.6;
    pointer-events: none;
    z-index: 9999;
    will-change: transform;
    transition: width 160ms ease-out, height 160ms ease-out, opacity 160ms ease-out;
  }
  .forge-cursor--active {
    width: 40px;
    height: 40px;
    margin: -20px 0 0 -20px;
    opacity: 0.25;
  }
}
`;

/**
 * CSS scroll-driven reveal — the same "settle in as it is framed" outcome as
 * `SCROLL_REVEAL_RULES`, driven entirely by the native
 * `animation-timeline: view()` compositor timeline instead of the JS-computed
 * `--forge-vis` custom property. No `data-runtime="scroll-progress"`
 * attribute is *required* by the mechanism itself — the browser drives the
 * animation range from the element's own position in the scrollport, nothing
 * else — but the rule is still scoped under it for the same reason every
 * other Tier-2 primitive is: one opt-in switch (`RenderOptions.runtime`),
 * not two independent ones a caller could get out of sync.
 *
 * `@supports (animation-timeline: view())` is the entire fallback mechanism:
 * a browser that does not understand the property never matches the block,
 * so an unsupported visitor gets the identical static floor as a visitor who
 * asked for `prefers-reduced-motion: reduce` — never a broken or half-applied
 * animation. `animation-range: entry 0% cover 40%` mirrors `scroll-reveal`'s
 * own settle distance (its `--forge-vis` reaches 1 well before a section is
 * fully centered), so the two primitives read as the same design intent
 * through two different engines, not two different-feeling reveals.
 */
const CSS_SCROLL_DRIVEN_REVEAL_RULES = `
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    @keyframes forge-view-reveal {
      from {
        opacity: 0.4;
        transform: translateY(24px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    [data-runtime="scroll-progress"] .section:not(.section--hero) {
      animation: forge-view-reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% cover 40%;
    }
  }
}
`;

/**
 * The closed dispatch table: a `RuntimePrimitiveId` in, its one deterministic
 * CSS implementation out. This is the entire surface a Director/Experience
 * Signature can reach — a name from `RuntimePrimitiveId`, never a style, a
 * selector, or a duration. Unknown ids (impossible under the closed union,
 * but the map stays exhaustive against it) contribute nothing.
 */
const RUNTIME_PRIMITIVE_RULES: Readonly<Record<RuntimePrimitiveId, string>> = {
  'scroll-reveal': SCROLL_REVEAL_RULES,
  'css-scroll-driven-reveal': CSS_SCROLL_DRIVEN_REVEAL_RULES,
  'text-reveal': TEXT_REVEAL_RULES,
  'magnetic-cursor': MAGNETIC_CURSOR_RULES,
  'lenis-smooth-scroll': LENIS_STYLE_RULES,
  // GSAP ScrollTrigger drives its reveal entirely from JS (inline styles via
  // gsap.fromTo), so it has no CSS half — unlike Lenis, whose vendored
  // stylesheet is load-bearing for its own class toggling.
  'gsap-scrolltrigger': '',
  'three-js-hero-object': THREE_HERO_STYLE_RULES,
  'horizontal-scroll': HORIZONTAL_SCROLL_RULES,
  'bento-card-tilt': BENTO_CARD_TILT_RULES,
  'cursor-reactive-webgl': CURSOR_WEBGL_RULES,
  'marquee': MARQUEE_RULES,
  'image-hover-reveal': IMAGE_HOVER_REVEAL_RULES,
  'animated-counter': ANIMATED_COUNTER_RULES,
  'sticky-text-pin': STICKY_TEXT_PIN_RULES,
  'menu-overlay': MENU_OVERLAY_RULES,
};

/**
 * Resolves a set of requested Tier-2 primitives to the CSS that implements
 * them, in declaration order, deduplicated. Empty input (the default for
 * every caller that does not explicitly opt in) returns `''` — concatenating
 * that onto a stylesheet changes nothing, which is what makes
 * `RenderOptions.runtimePrimitives` genuinely additive rather than a second
 * place a change can leak into unrelated output.
 */
export function runtimePrimitiveRules(ids: readonly RuntimePrimitiveId[]): string {
  const unique = [...new Set(ids)];
  return unique.map((id) => RUNTIME_PRIMITIVE_RULES[id]).join('');
}

/* -------------------------------------------------------------------- */
/* Location map — RenderOptions.location, not a runtime primitive        */
/* -------------------------------------------------------------------- */

/**
 * CSS for the location section's OpenStreetMap embed
 * (`lib/render/sections.ts`'s `renderLocationBlock`), threaded through the
 * same additive discipline `runtimePrimitiveRules` above uses and for the
 * identical reason: these classes only exist in the markup when
 * `RenderOptions.location` was supplied, and this codebase already learned
 * the hard way (this file's own docstring, re: `RUNTIME_RULES`) that CSS
 * added directly to the unconditional design-rules block
 * (`lib/render/variants.ts`) changes `test/__snapshots__/
 * design.bakery.styles.css` for *every* business, including ones that never
 * use the feature. Appended only when `locationRules(true)` is actually
 * called — every existing caller, and every business without coordinates,
 * gets zero new bytes.
 */
const LOCATION_MAP_RULES = `
.location-map {
  margin: var(--space-lg) 0 0;
  display: grid;
  gap: var(--space-xs);
}
.location-map__frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--color-border, #ccc);
  border-radius: var(--radius-md, 0);
}
.location-map__link {
  justify-self: start;
  font-size: var(--text-caption-size, 0.875rem);
  color: var(--color-text-muted, var(--color-muted, currentColor));
  text-decoration: underline;
}
.location-map__link:hover {
  color: var(--color-brand-text, var(--color-primary, currentColor));
}
`;

/** `''` when no location was supplied — genuinely additive, same contract as `runtimePrimitiveRules`. */
export function locationRules(hasLocation: boolean): string {
  return hasLocation ? LOCATION_MAP_RULES : '';
}

/* -------------------------------------------------------------------- */
/* Contact form — RenderOptions.contactForm, off by default (WQ-024)     */
/* -------------------------------------------------------------------- */

/**
 * CSS for the real, submittable enquiry form (`lib/render/sections.ts`'s
 * `renderContactFormBlock`), threaded through the exact same additive
 * discipline as `locationRules` above and for the identical reason: this
 * codebase already learned (see this file's own docstring, re: `RUNTIME_RULES`)
 * that CSS added directly to the unconditional design-rules block
 * (`lib/render/variants.ts`) changes `test/__snapshots__/design.bakery.styles.css`
 * for *every* business, including ones that never opt into `RenderOptions.
 * contactForm`. Appended only when `contactFormRules(true)` is actually
 * called; every existing caller, and every business that leaves the
 * default-off form disabled, gets zero new bytes. Styled with the same
 * design tokens `.contact-block` (`lib/render/variants.ts`) uses, so it
 * inherits whatever world/mood a given site was composed under rather than
 * looking like a foreign, unstyled browser form dropped onto a designed page.
 */
const CONTACT_FORM_RULES = `
.contact-form-block {
  margin: var(--space-xl) 0 0;
  max-width: 32rem;
}

.contact-form {
  display: grid;
  gap: var(--space-md);
}

/* The honeypot: invisible to every real visitor, sighted or not. */
.contact-form__trap {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.contact-form__field {
  display: grid;
  gap: var(--space-3xs);
}

.contact-form__field label {
  font-size: var(--text-caption-size);
  line-height: var(--text-caption-height);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.contact-form__field input,
.contact-form__field textarea {
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  transition: border-color var(--duration-fast) var(--easing);
}

.contact-form__field input:focus,
.contact-form__field textarea:focus {
  outline: none;
  border-color: var(--color-brand);
}

.contact-form__field textarea {
  resize: vertical;
  min-height: 6rem;
}

.contact-form button[type="submit"] {
  justify-self: start;
}

.contact-form button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.contact-form__status {
  margin: var(--space-sm) 0 0;
  font-size: var(--text-caption-size);
  color: var(--color-text-muted);
}
`;

/** `''` when the contact form is off (the default) — genuinely additive, same contract as `locationRules`. */
export function contactFormRules(hasContactForm: boolean): string {
  return hasContactForm ? CONTACT_FORM_RULES : '';
}
