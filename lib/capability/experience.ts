/**
 * The creative runtime ladder — what a page is allowed to run, and when.
 *
 * The brief for this layer said: *do not add libraries merely for the sake of
 * having them; determine when each capability should be used.* This module is
 * that determination, expressed as code rather than as a preference.
 *
 * ## The ladder
 *
 *   `none` → `css` → `js` → `webgl`
 *
 * A page starts at `none` and climbs only when the **evidence** gives it a
 * reason. Not the industry, not a flag, not a tier the operator bought — the
 * evidence. A bakery with four photographs and eleven reviews does not earn a
 * shader, and a page that has one anyway is not premium, it is decorated.
 *
 * That distinction is the whole point of the brief's rejection list:
 * "decorative animation added to generic websites" is what a runtime tier
 * chosen by anything other than evidence produces.
 *
 * ## Why so few libraries survive
 *
 * Every rung below `webgl` is served by code this repository already owns
 * (`lib/experience/runtime.ts`, `lib/runtime/scroll-progress.ts`,
 * `lib/experience/shader.ts`). A library earns adoption only when it does
 * something the platform cannot, at a weight the page can afford, under a
 * licence that survives redistribution — and almost none do:
 *
 *   - **Native CSS** (scroll-driven animations, view transitions, container
 *     queries) covers the overwhelming majority of motion at zero bytes. It is
 *     the platform, so it is the default, not the fallback.
 *   - **GSAP** is genuinely better at orchestrated sequences and is free for
 *     commercial use — adopted, *conditionally*, and only at `js` and above.
 *   - **Three.js** is the only credible path to a real WebGL scene, and it is
 *     heavy enough that it is quarantined to `webgl` and to businesses whose
 *     evidence is visual enough to justify the weight.
 *   - **Lenis** duplicates `scroll-behavior` and CSS scroll-driven animation
 *     for a permanent scroll hijack that fights the user's own input. Rejected.
 *   - **Lottie / Rive / Spline** each add a runtime, a hosting dependency and
 *     an authoring tool this pipeline has no way to drive from evidence. A
 *     generated site cannot author a Rive file, so adopting Rive would mean
 *     shipping stock animation — which is the definition of interchangeable.
 *     Rejected.
 *
 * The rejections are recorded here, with reasons, so the question is answered
 * once instead of relitigated whenever someone sees a nice demo.
 */

import type { CapabilityId } from './types.js';

const SOURCE = 'capability.experience';

/** How much client-side runtime a page carries. Ordered; index is the rung. */
export const RUNTIME_TIERS = ['none', 'css', 'js', 'webgl'] as const;

export type RuntimeTier = (typeof RUNTIME_TIERS)[number];

/** Where a rung sits on the ladder. Higher is heavier. */
export function tierRank(tier: RuntimeTier): number {
  return RUNTIME_TIERS.indexOf(tier);
}

/**
 * The evidence a page has to show for itself.
 *
 * Deliberately small and deliberately factual: every field is something the
 * collector either found or did not. Nothing here is a judgement, so nothing
 * here can be argued into a higher tier.
 */
export interface ExperienceEvidence {
  /** Photographs collected from the business's own sources. */
  readonly photographCount: number;
  /** Distinct products or services with their own descriptions. */
  readonly offeringCount: number;
  /** Reviews with quotable text. */
  readonly quotableReviewCount: number;
  /** Whether the business tells a story — an about page, a philosophy, a history. */
  readonly hasNarrative: boolean;
  /** Whether what the business sells is primarily looked at rather than read about. */
  readonly visuallyLed: boolean;
  /** Whether the collected photographs are high enough resolution to fill a viewport. */
  readonly hasLargeImagery: boolean;
}

export interface TierDecision {
  readonly tier: RuntimeTier;
  /** The specific evidence that earned this rung. */
  readonly earnedBy: readonly string[];
  /** Why it did not climb further. Always present, including at the top. */
  readonly heldBackBy: string;
  /** Libraries this tier permits, beyond what the repository ships. */
  readonly permittedLibraries: readonly LibraryId[];
}

/**
 * Decides the rung, from evidence alone.
 *
 * Deterministic and free: the same evidence always produces the same tier,
 * which is what lets the renderer's output be reproduced and what keeps a
 * model out of a decision that shapes every byte of the page.
 *
 * Each rung states its own threshold in the code rather than in a table,
 * because the thresholds are the argument.
 */
export function decideRuntimeTier(evidence: ExperienceEvidence): TierDecision {
  const earned: string[] = [];

  // `css` — the page has enough material for motion to have something to move.
  // A three-section page animating its three sections is a screensaver.
  const hasMaterial = evidence.offeringCount >= 3 || evidence.photographCount >= 3;
  if (!hasMaterial) {
    return {
      tier: 'none',
      earnedBy: [],
      heldBackBy:
        'fewer than three offerings and fewer than three photographs — there is nothing for motion to reveal',
      permittedLibraries: [],
    };
  }
  earned.push(
    `${evidence.offeringCount} offerings and ${evidence.photographCount} photographs give motion something to reveal`,
  );

  // `js` — the page has a sequence worth orchestrating: a narrative to pace, or
  // enough imagery that scroll position is genuinely carrying meaning.
  const hasSequence =
    (evidence.hasNarrative && evidence.offeringCount >= 4) || evidence.photographCount >= 6;
  if (!hasSequence) {
    return {
      tier: 'css',
      earnedBy: earned,
      heldBackBy:
        'no narrative across four or more offerings, and fewer than six photographs — scroll position is not carrying meaning here',
      permittedLibraries: [],
    };
  }
  earned.push(
    evidence.hasNarrative
      ? 'a narrative across enough offerings to pace'
      : `${evidence.photographCount} photographs make scroll position meaningful`,
  );

  // `webgl` — the business is looked at rather than read about, and the
  // photographs are good enough to survive being shown at full bleed. Both, not
  // either: a visually-led business with thumbnails gets a beautiful CSS page.
  const earnsWebgl =
    evidence.visuallyLed && evidence.hasLargeImagery && evidence.photographCount >= 10;
  if (!earnsWebgl) {
    return {
      tier: 'js',
      earnedBy: earned,
      heldBackBy: !evidence.visuallyLed
        ? 'what this business sells is read about, not looked at — a shader would decorate, not express'
        : !evidence.hasLargeImagery
          ? 'the collected photographs are too small to fill a viewport'
          : `${evidence.photographCount} photographs is below the ten a WebGL treatment needs to not repeat itself`,
      permittedLibraries: ['gsap'],
    };
  }
  earned.push('visually-led with large imagery — a WebGL treatment expresses rather than decorates');

  return {
    tier: 'webgl',
    earnedBy: earned,
    heldBackBy: 'nothing — this is the top of the ladder; 3D generation is rejected outright',
    permittedLibraries: ['gsap', 'three'],
  };
}

/* ------------------------------------------------------------------ */
/* The library register                                                */
/* ------------------------------------------------------------------ */

export const LIBRARY_IDS = [
  'native-css',
  'own-runtime',
  'own-shader',
  'gsap',
  'three',
  'lenis',
  'lottie',
  'rive',
  'spline',
] as const;

export type LibraryId = (typeof LIBRARY_IDS)[number];

export type LibraryStatus =
  /** Shipping today, in this repository. */
  | 'shipped'
  /** Adopted for a specific rung and a specific job. */
  | 'conditional'
  /** Considered and refused, with the reason recorded. */
  | 'rejected';

export interface LibraryEntry {
  readonly id: LibraryId;
  readonly name: string;
  readonly status: LibraryStatus;
  /** The lowest rung at which it may appear. `null` for rejected entries. */
  readonly minimumTier: RuntimeTier | null;
  /** What it does that the rung below cannot. */
  readonly justification: string;
  /** Approximate transferred weight, in kilobytes. Zero for platform features. */
  readonly weightKb: number;
  readonly licence: string;
}

export const LIBRARY_REGISTER: readonly LibraryEntry[] = [
  {
    id: 'native-css',
    name: 'Native CSS (scroll-driven animation, view transitions, container queries)',
    status: 'shipped',
    minimumTier: 'css',
    justification:
      'The platform. Covers most motion at zero transferred bytes and degrades correctly when the visitor asks for reduced motion.',
    weightKb: 0,
    licence: 'n/a',
  },
  {
    id: 'own-runtime',
    name: 'lib/experience/runtime.ts',
    status: 'shipped',
    minimumTier: 'js',
    justification:
      'Scroll progress, reveal sequencing and moment holds, authored against this renderer’s own markup. Nothing generic to configure.',
    weightKb: 3,
    licence: 'own code',
  },
  {
    id: 'own-shader',
    name: 'lib/experience/shader.ts',
    status: 'shipped',
    minimumTier: 'webgl',
    justification:
      'Procedural grounds and grain, generated from the directive. Replaces both generated imagery and a 3D asset pipeline.',
    weightKb: 4,
    licence: 'own code',
  },
  {
    id: 'gsap',
    name: 'GSAP',
    status: 'conditional',
    minimumTier: 'js',
    justification:
      'Orchestrated, interruptible sequences with correct timing across many elements — the one thing the own runtime does not do well. Free for commercial use.',
    weightKb: 24,
    licence: 'no-charge commercial',
  },
  {
    id: 'three',
    name: 'Three.js',
    status: 'conditional',
    minimumTier: 'webgl',
    justification:
      'The only credible path to a real WebGL scene. Quarantined to the top rung because its weight is only ever justified by imagery that fills a viewport.',
    weightKb: 160,
    licence: 'MIT',
  },
  {
    id: 'lenis',
    name: 'Lenis',
    status: 'rejected',
    minimumTier: null,
    justification:
      'A permanent scroll hijack that fights the visitor’s own input, to smooth something `scroll-behavior` and CSS scroll-driven animation already handle.',
    weightKb: 0,
    licence: 'MIT',
  },
  {
    id: 'lottie',
    name: 'Lottie',
    status: 'rejected',
    minimumTier: null,
    justification:
      'Needs an authored After Effects animation. This pipeline builds from evidence and cannot author one, so adopting it would mean shipping stock motion — interchangeable by construction.',
    weightKb: 0,
    licence: 'MIT',
  },
  {
    id: 'rive',
    name: 'Rive',
    status: 'rejected',
    minimumTier: null,
    justification:
      'Same objection as Lottie, plus a runtime and an editor dependency. A generated site cannot author a .riv file from a Maps listing.',
    weightKb: 0,
    licence: 'proprietary editor',
  },
  {
    id: 'spline',
    name: 'Spline',
    status: 'rejected',
    minimumTier: null,
    justification:
      'A hosted 3D scene editor. Adds a third-party runtime, a hosting dependency and a scene nobody in this pipeline authored.',
    weightKb: 0,
    licence: 'proprietary',
  },
];

/** Libraries permitted at a rung — everything shipped or conditional at or below it. */
export function librariesAt(tier: RuntimeTier): readonly LibraryEntry[] {
  return LIBRARY_REGISTER.filter(
    (entry) =>
      entry.status !== 'rejected' &&
      entry.minimumTier !== null &&
      tierRank(entry.minimumTier) <= tierRank(tier),
  );
}

/** Total transferred weight a rung permits, in kilobytes. For the performance budget. */
export function weightBudgetKb(tier: RuntimeTier): number {
  return librariesAt(tier).reduce((sum, entry) => sum + entry.weightKb, 0);
}

/** The capability this module decides. Named so the registry and this file agree. */
export const DECIDES: CapabilityId = 'runtime_tier';

export const SOURCE_NAME = SOURCE;
