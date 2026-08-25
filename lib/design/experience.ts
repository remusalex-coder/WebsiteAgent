/**
 * Experience architecture — the arc a page walks, decided from character.
 *
 * ## The gap this closes
 *
 * A brochure is a list of sections; an experience is a sequence with a shape.
 * The section engine (`layout.ts`) is already good at the *inside* of a
 * section — which variant, which frame, how much emphasis — but nothing above
 * it decides whether the page as a whole is a quiet directory or a built arc
 * with a peak. `worlds.ts` gives a colour journey; this gives a *narrative*
 * one: how much the page leads with imagery, whether it has a signature moment,
 * and how it paces toward it.
 *
 * Crucially it does this by choosing values the renderer already understands —
 * emphasis, full-bleed, the moment marker, the transition primitive, density.
 * There is no new renderer primitive here, no new section, no decorative
 * motion. The novelty is entirely in the *orchestration*: turning evidence-read
 * character into a coherent set of layout decisions instead of a category
 * default. See docs and ADR for why the audit named this "connective tissue".
 *
 * ## Modes
 *
 * - `brochure`   — a clear, functional directory. The correct answer for a
 *                  plumber, a notary, a thin profile. No moment, compact pacing.
 * - `showcase`   — the business leads with imagery. The gallery becomes the
 *                  subject (lead emphasis, full-bleed), pacing opens up, but the
 *                  page is still a set of strong sections, not a story.
 * - `narrative`  — the evidence supports an arc. A signature moment is built to,
 *                  marked by the transition primitive, over cinematic pacing.
 * - `immersive`  — reserved. A continuous scroll-as-time experience (Bakery V2)
 *                  needs a client runtime the static renderer does not have, so
 *                  this mode is defined but never selected in V1. Declaring it
 *                  keeps the ladder honest: the system knows the rung exists and
 *                  knows it cannot reach it yet.
 */

import type { BusinessCharacter } from './character.js';
import type { SectionKind, WebsiteContent } from '../types.js';
import type { VisualDensity } from './types.js';

export type ExperienceMode = 'brochure' | 'showcase' | 'narrative' | 'immersive';

/** How the page spends vertical space and attention. */
export type Pacing = 'compact' | 'measured' | 'cinematic';

/*
 * The transition that marks entry to the signature moment (or the gallery lead).
 *
 * Replaces the old boolean `momentTransition`. A boolean could only say "a wash
 * exists"; it could not express *which* wash, so two businesses with a moment
 * got the identical micro-fade and the brief's "transitions visibly differ"
 * requirement was unreachable. An enum lets character decide the *kind*:
 *
 *   - `none`           — no transition (brochure / no earned moment)
 *   - `veil`           — a full-bleed whiteout/colour wash that peaks as the
 *                        moment arrives, then clears. The strongest "you have
 *                        crossed into the peak" signal. Reserved for a real
 *                        signature in a narrative.
 *   - `wipe`           — a directional wipe (left→right or bottom→up) revealing
 *                        the moment. Lighter than a veil; good for a showcase
 *                        gallery lead.
 *   - `circular-handoff` — a circular clip-path reveal used where a hero object
 *                        hands from a synthetic/abstract state to real
 *                        photography. Origin is *derived* from the asset, never
 *                        hard-coded (see §10 of the master plan).
 *
 * Every value is realized by a deterministic, reduced-motion-gated CSS primitive
 * (or, for scroll-driven timing, the optional generic runtime). The Director
 * never authors the CSS; it only nominates the kind.
 */
export type ExperienceTransition = 'none' | 'veil' | 'wipe' | 'circular-handoff';

/*
 * Tier-2 vocabulary (Decision Gate §5/§6, ADR 0008) — additive, not yet
 * embedded on `ExperienceArchitecture` or `WebsiteDesign`.
 *
 * `WebsiteDesign` is dumped verbatim into `test/__snapshots__/design.bakery.json`
 * / `design.law.json` (`JSON.stringify(designFor(), null, 2)`,
 * `test/design/renderer.test.ts:504,513`) — a snapshot the freeze forbids
 * regenerating to absorb a change. Adding a field to `ExperienceArchitecture`
 * would therefore break a frozen contract for a value nothing consumes yet.
 * These stay standalone, pure derivations over the already-decided
 * `ExperienceArchitecture` until the Tier-2 runtime (Decision Gate §10 item 5)
 * exists to actually read them — at which point they graduate onto the design
 * object in the same additive-field pass that wires the runtime, per ADR 0004's
 * "additive only, no behaviour change" precedent.
 */

/**
 * The motion-preset vocabulary a Tier-2 runtime would select from — mapped
 * from `lib/forge/motion.ts`'s four-value scale onto this pipeline's own
 * decision, not copied from Forge's schema (ADR 0008 §5.3/§6: one vocabulary,
 * not two). `none`/`subtle` need no external library; `expressive` is the
 * rung a narrative's earned moment reaches; `immersive` mirrors
 * `ExperienceMode`'s own reserved-but-unreachable rung — declared so the
 * ladder stays honest, never selected until a runtime exists to deliver it.
 */
export type MotionIntensity = 'none' | 'subtle' | 'expressive' | 'immersive';

/**
 * Derives the motion intensity a Tier-2 runtime should apply, from the
 * architecture already decided. Never reads character directly — motion
 * intensity is a *consequence* of the experience decision, not a second,
 * independent read of the same evidence (the same discipline that keeps
 * `densityForPacing` a function of `pacing`, not of character again).
 */
export function deriveMotionIntensity(architecture: ExperienceArchitecture): MotionIntensity {
  if (architecture.mode === 'immersive') return 'immersive';
  if (architecture.transition !== 'none') return 'expressive';
  if (architecture.mode === 'showcase') return 'subtle';
  return 'none';
}

/**
 * The closed vocabulary of Tier-2 runtime primitives a renderer can execute.
 *
 * This is the actual "Experience Signature → runtime declaration" seam
 * (implementation plan, this session): a *name*, never code. The renderer
 * (`lib/render/runtime-rules.ts`'s `runtimePrimitiveRules`) owns the one
 * deterministic CSS/JS implementation behind each id; nothing upstream of it
 * ever emits a style, a duration, or a selector. Extend this union — never a
 * free-text field — when a second primitive earns its place.
 *
 * `lenis-smooth-scroll`, `gsap-scrolltrigger`, and `three-js-hero-object` are
 * entries whose implementation is not hand-written by this repository — each
 * dispatches to a *vendored* external library (`lib/runtime/lenis.ts`,
 * `lib/runtime/gsapScrollTrigger.ts`, `lib/runtime/threeHero.ts`, and their
 * matching `lib/design/experienceRegistry.ts` entries). The vocabulary stays
 * exactly as closed as it was: each id is still just a name the registry
 * validates before anything dispatches on it, and `deriveRuntimePrimitives`
 * below does not select any of them automatically — each is reachable today
 * only through an explicit, registry-validated `declared` list passed to
 * `resolvePrimitives`, the same seam a validated Creative Director call
 * would use.
 */
export type RuntimePrimitiveId =
  | 'scroll-reveal'
  | 'text-reveal'
  | 'magnetic-cursor'
  | 'lenis-smooth-scroll'
  | 'gsap-scrolltrigger'
  | 'three-js-hero-object'
  | 'horizontal-scroll'
  | 'bento-card-tilt'
  | 'cursor-reactive-webgl'
  | 'marquee'
  | 'image-hover-reveal'
  | 'animated-counter'
  | 'sticky-text-pin'
  | 'menu-overlay'
  // WQ-021 / docs/IMPLEMENTATION_GAP.md P2-2: a section reveal driven by the
  // native CSS `animation-timeline: view()` (85.43% global support,
  // caniuse.com OBSERVED 2026-08-25 — Chrome 115+, Firefox 157+, Safari
  // 26.0+), gated behind `@supports` so it costs nothing anywhere it is not
  // understood. Zero JS: no `--forge-vis` custom property, no scroll
  // listener, no IntersectionObserver — the compositor drives it. Same
  // visual outcome as `scroll-reveal`, real product value is that Forge can
  // choose this over `gsap-scrolltrigger` for the simple reveal case the
  // gap named, at zero vendored-library weight.
  | 'css-scroll-driven-reveal';

/**
 * Budget: max simultaneous primitives one page carries. Registry task §7 —
 * "do not blindly select five heavy effects for the same page". Two is the
 * floor of a real budget mechanism, not a tuned constant; raise it only
 * against a measured performance/QA finding, never by feel.
 */
export const RUNTIME_PRIMITIVE_BUDGET = 2;

/**
 * Which Tier-2 primitives this architecture has earned, deterministically,
 * priority-ordered then budget-capped.
 *
 * Priority: `scroll-reveal` (baseline reveal, earned by any motion above
 * `none`) → `text-reveal` (earned by `narrative`, where the words are the
 * story) → `magnetic-cursor` (earned only once a real transition exists —
 * the strongest, most assertive primitive, reserved for the businesses that
 * already earned a signature moment). Order is the priority a budget cut
 * removes from the *end* of, never the start — `scroll-reveal` never loses
 * to a flashier primitive.
 */
export function deriveRuntimePrimitives(architecture: ExperienceArchitecture): readonly RuntimePrimitiveId[] {
  const intensity = deriveMotionIntensity(architecture);
  if (intensity === 'none') return [];

  const earned: RuntimePrimitiveId[] = ['scroll-reveal'];
  if (architecture.mode === 'narrative') earned.push('text-reveal');
  if (architecture.transition !== 'none') earned.push('magnetic-cursor');

  return earned.slice(0, RUNTIME_PRIMITIVE_BUDGET);
}

/**
 * How the primary navigation behaves — a Tier-2 field with no counterpart in
 * `LayoutPlan.showNavigation` (a boolean: present or absent). `persistent` is
 * today's only deliverable value; `overlay`/`minimal` are reserved for the
 * runtime-gated guided/immersive rungs `docs/experience-capability-audit.md`
 * §4 names ("guided-path navigation = opt-in, never default") and must never
 * become the default the way `showNavigation` already is.
 */
export type NavigationMode = 'persistent' | 'overlay' | 'minimal';

/**
 * Derives navigation mode. Capped at `persistent` until a Tier-2 runtime and
 * an explicit, validated Director override both exist — an overlay/minimal
 * nav is a legitimate choice for a business that has earned `immersive`, but
 * it is never the unrequested default (the exact rule the capability audit
 * names for guided-path navigation, applied here to its Forge-named
 * counterpart).
 */
export function deriveNavigationMode(architecture: ExperienceArchitecture): NavigationMode {
  return 'persistent';
}

export interface ExperienceArchitecture {
  readonly mode: ExperienceMode;
  /**
   * The section built to, checked against real content. `null` unless the mode
   * is `narrative` and the business actually has the candidate section.
   */
  readonly signatureMoment: SectionKind | null;
  /**
   * The transition kind that marks entry to the signature moment / gallery lead.
   * `none` unless a moment is earned. Drives the renderer's transition primitive.
   */
  readonly transition: ExperienceTransition;
  /** @deprecated retained for back-compat; `transition !== 'none'` is the source of truth. */
  readonly momentTransition: boolean;
  /** Whether the gallery is promoted to the page's subject (lead + full-bleed). */
  readonly galleryLead: boolean;
  readonly pacing: Pacing;
  readonly rationale: string;
  readonly evidence: readonly string[];
}

/**
 * A structurally-required, functionally-inert architecture — for a caller of
 * `resolvePrimitives` (`lib/design/experienceRegistry.ts`) that always
 * supplies an explicit `declared` list (never `undefined`, even when empty).
 *
 * `resolvePrimitives`'s first argument is only ever read via
 * `deriveRuntimePrimitives(architecture)`, and only when `declared` is
 * `undefined` — "no declaration was ever made", not "an empty one was". A
 * caller that always passes `declared` (the Creative Director wiring in
 * `main.ts`'s `executePipeline` is the first: `declared` is the
 * shape-validated output of `directiveRuntimePrimitiveIds`, `[]` when the
 * Director selected nothing or never ran) never exercises that fallback, so
 * this value's fields are never actually consulted — using it here rather
 * than a real, threaded `ExperienceArchitecture` is a deliberate scope
 * decision, not an oversight: threading the real one through a resumable,
 * multi-stage pipeline is a separate, larger piece of work (see the note in
 * `main.ts`'s `executePipeline` at the call site).
 */
export const NEUTRAL_ARCHITECTURE: ExperienceArchitecture = {
  mode: 'brochure',
  signatureMoment: null,
  transition: 'none',
  momentTransition: false,
  galleryLead: false,
  pacing: 'compact',
  rationale: 'neutral placeholder — the caller always supplies an explicit `declared` list to resolvePrimitives, so this architecture is structurally required but never actually read',
  evidence: [],
};

/** Pacing narrows or opens the base density by one step. */
export function densityForPacing(base: VisualDensity, pacing: Pacing): VisualDensity {
  const order: readonly VisualDensity[] = ['airy', 'balanced', 'dense'];
  const i = order.indexOf(base);
  if (pacing === 'cinematic') return order[Math.max(0, i - 1)] ?? base; // airier
  if (pacing === 'compact') return order[Math.min(order.length - 1, i + 1)] ?? base; // denser
  return base;
}

/**
 * Plans the experience architecture for a page.
 *
 * Reads character first, content second: character decides the *ambition* and
 * content decides what is *reachable*. A business whose character says
 * "narrative" but whose content carries no gallery cannot have a gallery-led
 * arc, and degrades to showcase or brochure rather than nominating a section
 * that is not there — the same discipline `planLayout` already applies to the
 * moment nomination.
 */
/**
 * A validated override from the AI Director. Only `mode` is honoured today; the
 * rest of the architecture is re-derived from the overridden mode so the result
 * stays internally consistent (a `brochure` never keeps a gallery lead). The
 * Director reaches this only through `applyDirective`, which validates the value
 * against the closed set first — no raw model output crosses this boundary.
 */
export interface ExperienceOverride {
  readonly mode?: ExperienceMode | undefined;
}

export function planExperience(
  character: BusinessCharacter,
  content: WebsiteContent,
  override?: ExperienceOverride,
): ExperienceArchitecture {
  const kinds = new Set(content.sections.map((s) => s.kind));
  const hasGallery = kinds.has('gallery');
  const evidence: string[] = [
    `visualWeight:${character.visualWeight}`,
    `register:${character.emotionalRegister}`,
    `narrative:${character.narrativePotential}`,
    `atmosphere:${character.atmosphereRange}`,
  ];

  // --- Mode ------------------------------------------------------------
  // The ladder: strong narrative potential earns `narrative`; leading with
  // imagery earns `showcase`; everything else is an honest `brochure`.
  // `immersive` is intentionally unreachable in V1 (no runtime).
  let mode: ExperienceMode;
  if (
    character.narrativePotential === 'strong'
    && character.signatureCandidate !== null
    && kinds.has(character.signatureCandidate)
  ) {
    mode = 'narrative';
  } else if (
    // Image-led earns a showcase outright; a "balanced" business earns one too
    // when it actually has photography to show (a gallery) and a register that
    // wants to show it — a restaurant with four dishes and a room is a showcase,
    // a mechanic with a logo is not.
    (character.visualWeight === 'image-led' && character.atmosphereRange >= 2)
    || (character.visualWeight === 'balanced' && hasGallery && character.atmosphereRange >= 2
      && character.emotionalRegister !== 'functional')
  ) {
    mode = 'showcase';
  } else {
    mode = 'brochure';
  }

  // A validated Director override replaces the floor's mode. `immersive` is
  // capped to `narrative` — the runtime for it does not exist yet — so the
  // Director cannot promise more than the renderer can keep.
  if (override?.mode !== undefined) {
    const requested = override.mode === 'immersive' ? 'narrative' : override.mode;
    if (requested !== mode) {
      evidence.push(`override:mode=${override.mode}${override.mode === 'immersive' ? '(capped:narrative)' : ''}`);
      mode = requested;
    }
  }

  // --- Signature moment ------------------------------------------------
  // A narrative always earns its nomination. A showcase ordinarily does not —
  // the whole difference between the two modes is that a showcase leads with
  // imagery without a built arc, and its gallery reads as `reveal`, not as the
  // page's one peak (see `roleFor` in script.ts, and the wedding-venue case
  // `test/content/director.test.ts` protects: leading with a room is not the
  // same claim as building the whole page around it).
  //
  // A craft business is the one showcase exception. Before this register
  // existed, a workshop, a garage, an electrician had no vocabulary of their
  // own to register with, so a showcase-worthy trade business was capped at
  // "reveal" however much evidence it had — the ceiling every functional trade
  // hit regardless of its photography. Register alone, not narrative
  // potential, is what earns the exception: a craft business's showcase
  // *is* its narrative, because a workshop has no arc beyond "here is the
  // work" — so a workshop's photographs get to be the moment they are rather
  // than silently downgraded because nothing about a garage builds to a turn.
  const signatureMoment: SectionKind | null =
    (mode === 'narrative' || (mode === 'showcase' && character.emotionalRegister === 'craft'))
      && character.signatureCandidate !== null
      && kinds.has(character.signatureCandidate)
      ? character.signatureCandidate
      : null;

  // --- Gallery lead ----------------------------------------------------
  // The single change that makes an image-led page read as a showcase rather
  // than a brochure with pictures: the photographs become the subject. Only
  // when there is a gallery and enough in it to fill a lead treatment.
  const galleryLead = (mode === 'showcase' || mode === 'narrative')
    && hasGallery && character.atmosphereRange >= 2;

  // --- Pacing ----------------------------------------------------------
  const pacing: Pacing =
    mode === 'narrative' ? 'cinematic'
      : mode === 'showcase' ? 'measured'
        : 'compact';

  // --- Transition ------------------------------------------------------
  // A transition is earned only by a real moment or a gallery lead, in a
  // narrative or a craft showcase — never as decoration (see the master brief's
  // "motion must have narrative purpose"). The *kind* of transition is chosen
  // from character so two businesses with a moment differ in how the peak is hit:
  //   - narrative + signature  -> `veil`   (the strongest "you have crossed into
  //                                   the peak" whiteout, per Bakery V2's daybreak)
  //   - craft showcase + lead   -> `wipe`   (a lighter directional reveal, since
  //                                   the gallery *is* the story, not a turn)
  const hasEarnedMoment =
    (mode === 'narrative' && signatureMoment !== null) ||
    ((mode === 'showcase' && character.emotionalRegister === 'craft') && galleryLead);
  const transition: ExperienceTransition = hasEarnedMoment
    ? (mode === 'narrative' ? 'veil' : 'wipe')
    : 'none';
  // Retained for back-compat: true whenever a transition is earned.
  const momentTransition = transition !== 'none';

  const rationale =
    mode === 'brochure'
      ? `Brochure: ${character.visualWeight}, ${character.narrativePotential} narrative potential — a clear, functional page is the honest answer.`
      : mode === 'showcase'
        ? `Showcase: image-led with ${character.atmosphereRange} visual movements — the photography leads, the gallery becomes the subject.`
        : `Narrative: strong potential around the ${signatureMoment} section — the page builds to it over cinematic pacing and marks its entry.`;

  return { mode, signatureMoment, transition, momentTransition, galleryLead, pacing, rationale, evidence };
}
