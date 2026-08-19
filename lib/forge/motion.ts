/**
 * The Motion System — one shared contract, not per-component invention.
 *
 * Transcribed from `docs/knowledge/MOTION_LIBRARY.md` (research artifact,
 * 2026-08-17) into machine-usable constants: duration budgets, an easing
 * catalog, stagger math, choreography constants, and the reduced-motion and
 * anti-motion rules. Numbers are copied verbatim from that document, not
 * invented here — this module's own contribution is *closing* the system
 * (four `MotionIntensity` presets, each a bounded, internally-consistent
 * subset of the full catalog) and turning it into a request every builder
 * prompt must obey and every generated build can be checked against.
 *
 * ## Why this exists
 *
 * Before this module, `builder.ts`'s prompt asked the model for "refined
 * subtle animations" with no shared vocabulary — every section, every
 * business, every build invented its own durations and easings. That is
 * exactly what `MOTION_LIBRARY.md` §1 calls out: motion becomes decoration
 * when nothing enforces a system. This module is the system: a closed set
 * of intensities, each with concrete tokens, so two sections in the same
 * build (and, more importantly, a hover state and an entrance reveal) speak
 * the same motion language on purpose rather than by accident.
 *
 * ## The anti-motion list is unconditional
 *
 * `FORBIDDEN_TECHNIQUES` applies at every intensity, including `immersive`.
 * `MOTION_LIBRARY.md` §8 calls these a hard ceiling, not a preference:
 * scroll-hijacking, infinite decorative loops, motion that delays content,
 * identical motion on every section, parallax on readable text, autoplaying
 * carousels, and motion as the only signal. An "immersive" experience earns
 * more *categories* of motion, never an exemption from these.
 */

export type MotionIntensity = 'none' | 'subtle' | 'expressive' | 'immersive';

export const MOTION_INTENSITIES: readonly MotionIntensity[] = ['none', 'subtle', 'expressive', 'immersive'];

/** MOTION_LIBRARY.md §2 — duration bands, in milliseconds. */
export type DurationBand =
  | 'microFeedback'
  | 'hover'
  | 'stateChange'
  | 'elementReveal'
  | 'sectionTransition'
  | 'pageRouteTransition';

export const DURATION_BANDS_MS: Readonly<Record<DurationBand, readonly [number, number]>> = {
  microFeedback: [80, 120],
  hover: [100, 200],
  stateChange: [150, 250],
  elementReveal: [200, 400],
  sectionTransition: [300, 500],
  pageRouteTransition: [300, 600],
};

/** No single element reveal may exceed this on a conversion-critical site — MOTION_LIBRARY.md §2, "hard ceiling". */
export const MAX_ELEMENT_REVEAL_MS = 400;

/** MOTION_LIBRARY.md §3 — the easing catalog. `spring` has no CSS cubic-bezier; it is JS-runtime only. */
export type EasingName =
  | 'linear'
  | 'standard'
  | 'decelerate'
  | 'accelerate'
  | 'emphasizedDecelerate'
  | 'overshoot'
  | 'spring';

export interface EasingDefinition {
  readonly name: EasingName;
  /** `null` for `spring`, which is a runtime physics config, not a CSS curve. */
  readonly cubicBezier: string | null;
  readonly communicates: string;
  readonly useFor: string;
  readonly avoidFor: string;
}

export const EASING_CATALOG: Readonly<Record<EasingName, EasingDefinition>> = {
  linear: {
    name: 'linear',
    cubicBezier: 'cubic-bezier(0,0,1,1)',
    communicates: 'mechanical, robotic',
    useFor: 'determinate progress tied to a real constant rate (e.g. a byte-accurate upload bar)',
    avoidFor: 'entrances, exits, anything meant to feel alive',
  },
  standard: {
    name: 'standard',
    cubicBezier: 'cubic-bezier(0.4,0,0.2,1)',
    communicates: 'neutral, composed',
    useFor: 'the default for most state changes with no emphasis needed',
    avoidFor: 'a moment that should carry weight',
  },
  decelerate: {
    name: 'decelerate',
    cubicBezier: 'cubic-bezier(0,0,0.2,1)',
    communicates: 'settling, arriving',
    useFor: 'entrances and appearances',
    avoidFor: 'exits — arrivals decelerate, exits accelerate, never swap',
  },
  accelerate: {
    name: 'accelerate',
    cubicBezier: 'cubic-bezier(0.4,0,1,1)',
    communicates: 'leaving, departing',
    useFor: 'exits and dismissals',
    avoidFor: 'entrances',
  },
  emphasizedDecelerate: {
    name: 'emphasizedDecelerate',
    cubicBezier: 'cubic-bezier(0.05,0.7,0.1,1)',
    communicates: 'an important arrival landing with weight',
    useFor: 'the signature moment reveal, key-moment emphasis — spend this once, not everywhere',
    avoidFor: 'routine hover states',
  },
  overshoot: {
    name: 'overshoot',
    cubicBezier: 'cubic-bezier(0.34,1.56,0.64,1)',
    communicates: 'playful, springy, tactile',
    useFor: 'low-stakes delight only (a like/star toggle, a success pop)',
    avoidFor: 'data, errors, loading, or form validation — overshoot on a failed submission reads as mockery',
  },
  spring: {
    name: 'spring',
    cubicBezier: null,
    communicates: 'bouncy, physical',
    useFor: 'playful feedback where a JS runtime is already driving the interaction (stiffness 500, damping 30, mass 1)',
    avoidFor: 'anything CSS-only — it requires a JS runtime, so never claim it for a no-JS delivery envelope',
  },
};

/** MOTION_LIBRARY.md §4 — stagger math: total_sequence_time = base_delay + (N-1)*stagger + item_duration. */
export function staggerMsFor(itemCount: number): number {
  if (itemCount <= 5) return 90;
  if (itemCount <= 10) return 60;
  if (itemCount <= 20) return 35;
  return 0; // 21+: prefer no stagger over a sequence that outruns its budget
}

/** The budget a staggered reveal sequence must fit inside — a deliberate hero cluster may use the wider one. */
export const STAGGER_BUDGET_MS = { list: 600, heroCluster: 1000 } as const;

export function staggerSequenceMs(itemCount: number, itemDurationMs: number, baseDelayMs = 0): number {
  const stagger = staggerMsFor(itemCount);
  return baseDelayMs + Math.max(0, itemCount - 1) * stagger + itemDurationMs;
}

/** MOTION_LIBRARY.md §5 — choreography constants, in milliseconds unless noted. */
export const CHOREOGRAPHY = {
  followerOffsetMs: [40, 120] as const,
  maxSimultaneousMotions: 3,
  anticipationWindUpMaxMs: 60,
  causeToEffectMaxMs: 100,
  hoverFeedbackResolveMaxMs: 80,
  entranceTranslateDistancePx: {
    fullBleed: 12,
    cards: [16, 24] as const,
    smallChips: [24, 40] as const,
  },
} as const;

/**
 * MOTION_LIBRARY.md §8 — never ship, at any intensity. Hardens A-13
 * (`ANTI_AI_SLOP.md`); this list is what `checkMotionCoherence` in
 * `anti-ai-gate.ts` looks for.
 */
export const FORBIDDEN_TECHNIQUES: readonly string[] = [
  'scroll-hijacking (intercepting wheel/touch input to drive a scripted camera)',
  'infinite decorative loops (ambient particles, drifting gradients, orbiting shapes)',
  'motion that delays content (an entrance or loader pushing the hero, price, hours, or CTA later than a static render would)',
  'identical motion on every section (the same fade+slide-up applied everywhere regardless of content)',
  'parallax on readable text (imagery only, never text)',
  'autoplaying carousels (no user-initiated action, and they fail reduced-motion)',
  'motion as the only signal (a state change must also carry a persistent non-animated signal: color, text, or icon)',
];

/** One intensity's complete, bounded motion contract. */
export interface MotionContract {
  readonly intensity: MotionIntensity;
  readonly allowedDurationBands: readonly DurationBand[];
  readonly allowedEasings: readonly EasingName[];
  readonly maxSimultaneousMotions: number;
  readonly staggerBudgetMs: number;
  readonly permitsSectionChoreography: boolean;
  readonly permitsPageTransitions: boolean;
  readonly permitsCursorSystem: boolean;
  readonly permitsPinnedStorytelling: boolean;
  readonly forbiddenTechniques: readonly string[];
  readonly rationale: string;
}

/**
 * The four presets. `none` is not "no system" — it is the system's own
 * default posture (`MOTION_LIBRARY.md` §9: "default posture = restraint...
 * zero motion is a valid, excellent outcome"), and it still forbids the
 * anti-motion list because a build that claims `none` and then ships an
 * infinite decorative loop is lying about its own intensity, not merely
 * restrained.
 */
export const MOTION_CONTRACTS: Readonly<Record<MotionIntensity, MotionContract>> = {
  none: {
    intensity: 'none',
    allowedDurationBands: [],
    allowedEasings: [],
    maxSimultaneousMotions: 1,
    staggerBudgetMs: 0,
    permitsSectionChoreography: false,
    permitsPageTransitions: false,
    permitsCursorSystem: false,
    permitsPinnedStorytelling: false,
    forbiddenTechniques: FORBIDDEN_TECHNIQUES,
    rationale: 'Content presents at once; only instant, functional state changes (focus, active, error) are permitted. A legitimate outcome for a retrieval-dominant or reputation-through-stillness business.',
  },
  subtle: {
    intensity: 'subtle',
    allowedDurationBands: ['microFeedback', 'hover', 'stateChange', 'elementReveal'],
    allowedEasings: ['standard', 'decelerate', 'accelerate'],
    maxSimultaneousMotions: 2,
    staggerBudgetMs: STAGGER_BUDGET_MS.list,
    permitsSectionChoreography: false,
    permitsPageTransitions: false,
    permitsCursorSystem: false,
    permitsPinnedStorytelling: false,
    forbiddenTechniques: FORBIDDEN_TECHNIQUES,
    rationale: 'Functional feedback and single-item entrance reveals only. No section-level choreography, no page transitions, no cursor system — motion acknowledges the user\'s action, it does not narrate.',
  },
  expressive: {
    intensity: 'expressive',
    allowedDurationBands: ['microFeedback', 'hover', 'stateChange', 'elementReveal', 'sectionTransition'],
    allowedEasings: ['standard', 'decelerate', 'accelerate', 'emphasizedDecelerate', 'overshoot'],
    maxSimultaneousMotions: CHOREOGRAPHY.maxSimultaneousMotions,
    staggerBudgetMs: STAGGER_BUDGET_MS.heroCluster,
    permitsSectionChoreography: true,
    permitsPageTransitions: false,
    permitsCursorSystem: true,
    permitsPinnedStorytelling: false,
    forbiddenTechniques: FORBIDDEN_TECHNIQUES,
    rationale: 'Full reveal choreography and one earned emphasized-decelerate moment for the signature reveal. A cursor system is permitted; page-level transitions and pinned/scroll-jacked storytelling are not.',
  },
  immersive: {
    intensity: 'immersive',
    allowedDurationBands: ['microFeedback', 'hover', 'stateChange', 'elementReveal', 'sectionTransition', 'pageRouteTransition'],
    allowedEasings: ['standard', 'decelerate', 'accelerate', 'emphasizedDecelerate', 'overshoot', 'spring'],
    maxSimultaneousMotions: CHOREOGRAPHY.maxSimultaneousMotions,
    staggerBudgetMs: STAGGER_BUDGET_MS.heroCluster,
    permitsSectionChoreography: true,
    permitsPageTransitions: true,
    permitsCursorSystem: true,
    permitsPinnedStorytelling: true,
    forbiddenTechniques: FORBIDDEN_TECHNIQUES,
    rationale: 'Every category is available, including page-route transitions and pinned scroll storytelling — reserved for a signature whose central mechanism genuinely is spatial/temporal. Still bound by the same anti-motion list: immersive is a wider palette, not an exemption.',
  },
};

export function motionContractFor(intensity: MotionIntensity): MotionContract {
  return MOTION_CONTRACTS[intensity];
}

/** CSS mechanic MOTION_LIBRARY.md §6 ships today, verbatim, for every intensity above `none`. */
export const REDUCED_MOTION_CSS = `@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;

/**
 * Renders a motion contract as the prompt fragment `builder.ts` must include
 * verbatim — the model is told the exact tokens available, not asked to
 * invent its own, which is the whole point of a system over a suggestion.
 */
export function motionContractPrompt(contract: MotionContract): string {
  const durations = contract.allowedDurationBands
    .map((band) => `  - ${band}: ${DURATION_BANDS_MS[band][0]}-${DURATION_BANDS_MS[band][1]}ms`)
    .join('\n');
  const easings = contract.allowedEasings
    .map((name) => {
      const e = EASING_CATALOG[name];
      return `  - ${name}${e.cubicBezier ? ` (${e.cubicBezier})` : ' (JS runtime spring, not a CSS curve)'}: ${e.useFor}`;
    })
    .join('\n');

  return `MOTION SYSTEM CONTRACT (intensity: "${contract.intensity}") — use ONLY these tokens, define them once as CSS custom properties or JS constants and reuse them everywhere. Do not invent other durations or easing curves.

ALLOWED DURATIONS:
${durations || '  (none — this intensity ships no animated transitions beyond instant state changes)'}

ALLOWED EASINGS:
${easings || '  (none)'}

RULES:
  - Max ${contract.maxSimultaneousMotions} independent simultaneous motions without one clearly leading.
  - Staggered list reveals must fit within ${contract.staggerBudgetMs}ms total (0 = no stagger; reveal together instead).
  - Section-level choreography: ${contract.permitsSectionChoreography ? 'permitted' : 'NOT permitted at this intensity'}.
  - Page/route transitions: ${contract.permitsPageTransitions ? 'permitted' : 'NOT permitted at this intensity'}.
  - Custom cursor system: ${contract.permitsCursorSystem ? 'permitted' : 'NOT permitted at this intensity'}.
  - Pinned/scroll-driven storytelling: ${contract.permitsPinnedStorytelling ? 'permitted' : 'NOT permitted at this intensity'}.
  - Include the reduced-motion CSS block verbatim, unconditionally:
${REDUCED_MOTION_CSS}

NEVER, AT ANY INTENSITY:
${contract.forbiddenTechniques.map((t) => `  - ${t}`).join('\n')}`;
}
