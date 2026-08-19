/**
 * Experience Strategy — validation and defaults for the closed-set
 * decisions defined on `ExperienceSignature.experienceStrategy`
 * (`lib/forge/types.ts`).
 *
 * Mirrors the classic pipeline's `applyDirective` discipline
 * (`docs/decisions/0004-the-directors-influence-is-one-enum.md`): the model
 * proposes a value for each field; this module is the only place that
 * decides whether the value is real. Anything outside the closed set —
 * missing, misspelled, invented — degrades to a named, documented default
 * rather than reaching the builder unchecked. A stage that trusted the raw
 * model object here would reopen exactly the free-text drift
 * `checkStructuralConvergence`'s docstring already found once this session.
 */

import type { ExperienceStrategy, FactualDossier, FunctionalModuleId } from './types.js';
import type { Logger } from '../logger.js';

/**
 * The safe, always-legitimate default: no motion beyond instant state
 * changes, standard navigation, no functional module, WCAG floor only,
 * performance tier 1. `EXPERIENCE_SIGNATURE_SYSTEM.md` §8's own fallback
 * ladder makes exactly this point — disciplined restraint is a first-class
 * successful outcome, never an error path.
 */
export const DEFAULT_EXPERIENCE_STRATEGY: ExperienceStrategy = {
  motionIntensity: 'subtle',
  navigationModel: 'inline',
  loadingModel: 'none',
  typographyBehavior: 'static',
  cursorBehavior: 'default',
  scrollBehavior: 'native',
  layoutGrammar: 'grid-regular',
  mediaStrategy: 'photography-only',
  requires3D: false,
  requires3DRationale: '',
  requiresVideo: false,
  requiresVideoRationale: '',
  functionalModules: ['enquiry-form'],
  mobileBehavior: 'mirrors-desktop',
  accessibilityStrategy: 'wcag-aa-floor',
  performanceTier: 1,
  reducedMotionStrategy: 'instant-state-only',
  rationale: 'Default strategy: no experience-strategy object was returned or it failed validation, so the deterministic floor decides rather than an unchecked model value reaching the builder.',
};

const MOTION_INTENSITIES = ['none', 'subtle', 'expressive', 'immersive'] as const;
const NAVIGATION_MODELS = ['inline', 'sticky-minimal', 'full-screen-menu', 'morphing'] as const;
const LOADING_MODELS = ['none', 'skeleton', 'progressive-reveal', 'asset-aware-preloader'] as const;
const TYPOGRAPHY_BEHAVIORS = ['static', 'kinetic-headlines', 'split-text-reveals', 'typography-led-navigation'] as const;
const CURSOR_BEHAVIORS = ['default', 'minimal-custom', 'magnetic', 'contextual'] as const;
const SCROLL_BEHAVIORS = ['native', 'smooth-native', 'pinned-storytelling', 'horizontal-section'] as const;
const LAYOUT_GRAMMARS = ['grid-regular', 'asymmetric-editorial', 'overlapping-layers', 'horizontal-narrative'] as const;
const MEDIA_STRATEGIES = ['photography-only', 'photography-plus-texture', 'ai-generated-imagery', 'video-background', 'cinematic-hero-media'] as const;
const MOBILE_BEHAVIORS = ['mirrors-desktop', 'simplified', 'reordered-priority'] as const;
const ACCESSIBILITY_STRATEGIES = ['wcag-aa-floor', 'wcag-aa-enhanced'] as const;
const REDUCED_MOTION_STRATEGIES = ['instant-state-only', 'preserve-essential-feedback'] as const;
const PERFORMANCE_TIERS = [0, 1, 2, 3, 4, 5] as const;
export const FUNCTIONAL_MODULE_IDS: readonly FunctionalModuleId[] = [
  'none', 'enquiry-form', 'booking-request', 'service-selector',
  'product-configurator', 'search-filter', 'comparison-tool', 'calculator',
];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * `performanceTier` travels on the wire as a string enum ("0".."5"), not a
 * numeric one. Found live (2026-08-19): Gemini's `responseSchema` dialect
 * rejected `{ type: 'number', enum: [0,1,2,3,4,5] }` with an HTTP 400 —
 * Gemini's `enum` keyword is documented for `type: STRING` only. Every
 * other vendor accepts either shape, so the string form is the one that
 * actually works everywhere rather than the one that reads more naturally
 * in TypeScript.
 */
function pickTier(value: unknown, fallback: 0 | 1 | 2 | 3 | 4 | 5): 0 | 1 | 2 | 3 | 4 | 5 {
  if (typeof value === 'number' && (PERFORMANCE_TIERS as readonly number[]).includes(value)) {
    return value as 0 | 1 | 2 | 3 | 4 | 5;
  }
  if (typeof value === 'string' && /^[0-5]$/.test(value)) {
    return Number(value) as 0 | 1 | 2 | 3 | 4 | 5;
  }
  return fallback;
}

function pickFunctionalModules(value: unknown): readonly FunctionalModuleId[] {
  if (!Array.isArray(value)) return DEFAULT_EXPERIENCE_STRATEGY.functionalModules;
  const valid = value.filter((v): v is FunctionalModuleId => typeof v === 'string' && (FUNCTIONAL_MODULE_IDS as readonly string[]).includes(v));
  if (valid.length === 0) return ['none'];
  // 'none' combined with a real module is a contradiction the model sometimes
  // produces; a real module always wins because it is the more specific claim.
  const real = valid.filter((v) => v !== 'none');
  return real.length > 0 ? [...new Set(real)] : ['none'];
}

/**
 * Validates a raw model response into a real `ExperienceStrategy`, applying
 * cross-field consistency rules the closed-set validation alone cannot
 * express:
 *
 * - `requires3D` needs `performanceTier >= 3` (Tier 3 is the first tier
 *   that budgets for canvas/lightweight WebGL) — raised, never lowered, so
 *   a low-tier claim paired with a 3D requirement doesn't silently ship an
 *   under-budgeted page.
 * - `motionIntensity: 'immersive'` needs `performanceTier >= 2` (GSAP-class
 *   techniques), for the same reason.
 * - A boolean `requires3D`/`requiresVideo` with an empty rationale is
 *   treated as false — an unjustified media requirement is exactly the
 *   "spectacle without evidence" failure mode `ANTI_AI_SLOP.md` A-19 names.
 */
export function normalizeExperienceStrategy(
  raw: unknown,
  dossier: Pick<FactualDossier, 'businessName'>,
  logger: Logger,
): ExperienceStrategy {
  if (raw === null || typeof raw !== 'object') {
    logger.warn('experienceStrategy missing or malformed; using the deterministic default', { businessName: dossier.businessName });
    return DEFAULT_EXPERIENCE_STRATEGY;
  }

  const r = raw as Record<string, unknown>;

  const requires3DRationale = typeof r['requires3DRationale'] === 'string' ? r['requires3DRationale'].trim() : '';
  const requires3D = Boolean(r['requires3D']) && requires3DRationale.length > 0;

  const requiresVideoRationale = typeof r['requiresVideoRationale'] === 'string' ? r['requiresVideoRationale'].trim() : '';
  const requiresVideo = Boolean(r['requiresVideo']) && requiresVideoRationale.length > 0;

  const motionIntensity = pickEnum(r['motionIntensity'], MOTION_INTENSITIES, DEFAULT_EXPERIENCE_STRATEGY.motionIntensity);
  let performanceTier = pickTier(r['performanceTier'], DEFAULT_EXPERIENCE_STRATEGY.performanceTier);

  if (requires3D && performanceTier < 3) performanceTier = 3;
  if (motionIntensity === 'immersive' && performanceTier < 2) performanceTier = 2;

  const rationale = typeof r['rationale'] === 'string' && r['rationale'].trim().length > 0
    ? r['rationale'].trim()
    : DEFAULT_EXPERIENCE_STRATEGY.rationale;

  return {
    motionIntensity,
    navigationModel: pickEnum(r['navigationModel'], NAVIGATION_MODELS, DEFAULT_EXPERIENCE_STRATEGY.navigationModel),
    loadingModel: pickEnum(r['loadingModel'], LOADING_MODELS, DEFAULT_EXPERIENCE_STRATEGY.loadingModel),
    typographyBehavior: pickEnum(r['typographyBehavior'], TYPOGRAPHY_BEHAVIORS, DEFAULT_EXPERIENCE_STRATEGY.typographyBehavior),
    cursorBehavior: pickEnum(r['cursorBehavior'], CURSOR_BEHAVIORS, DEFAULT_EXPERIENCE_STRATEGY.cursorBehavior),
    scrollBehavior: pickEnum(r['scrollBehavior'], SCROLL_BEHAVIORS, DEFAULT_EXPERIENCE_STRATEGY.scrollBehavior),
    layoutGrammar: pickEnum(r['layoutGrammar'], LAYOUT_GRAMMARS, DEFAULT_EXPERIENCE_STRATEGY.layoutGrammar),
    mediaStrategy: pickEnum(r['mediaStrategy'], MEDIA_STRATEGIES, DEFAULT_EXPERIENCE_STRATEGY.mediaStrategy),
    requires3D,
    requires3DRationale: requires3D ? requires3DRationale : '',
    requiresVideo,
    requiresVideoRationale: requiresVideo ? requiresVideoRationale : '',
    functionalModules: pickFunctionalModules(r['functionalModules']),
    mobileBehavior: pickEnum(r['mobileBehavior'], MOBILE_BEHAVIORS, DEFAULT_EXPERIENCE_STRATEGY.mobileBehavior),
    accessibilityStrategy: pickEnum(r['accessibilityStrategy'], ACCESSIBILITY_STRATEGIES, DEFAULT_EXPERIENCE_STRATEGY.accessibilityStrategy),
    performanceTier,
    reducedMotionStrategy: pickEnum(r['reducedMotionStrategy'], REDUCED_MOTION_STRATEGIES, DEFAULT_EXPERIENCE_STRATEGY.reducedMotionStrategy),
    rationale,
  };
}

/** The JSON-schema fragment `signature.ts` embeds under `experienceStrategy` in `SIGNATURE_SCHEMA`. */
export const EXPERIENCE_STRATEGY_SCHEMA = {
  type: 'object',
  required: [
    'motionIntensity', 'navigationModel', 'loadingModel', 'typographyBehavior',
    'cursorBehavior', 'scrollBehavior', 'layoutGrammar', 'mediaStrategy',
    'requires3D', 'requires3DRationale', 'requiresVideo', 'requiresVideoRationale',
    'functionalModules', 'mobileBehavior', 'accessibilityStrategy',
    'performanceTier', 'reducedMotionStrategy', 'rationale',
  ],
  properties: {
    motionIntensity: { type: 'string', enum: [...MOTION_INTENSITIES] },
    navigationModel: { type: 'string', enum: [...NAVIGATION_MODELS] },
    loadingModel: { type: 'string', enum: [...LOADING_MODELS] },
    typographyBehavior: { type: 'string', enum: [...TYPOGRAPHY_BEHAVIORS] },
    cursorBehavior: { type: 'string', enum: [...CURSOR_BEHAVIORS] },
    scrollBehavior: { type: 'string', enum: [...SCROLL_BEHAVIORS] },
    layoutGrammar: { type: 'string', enum: [...LAYOUT_GRAMMARS] },
    mediaStrategy: { type: 'string', enum: [...MEDIA_STRATEGIES] },
    requires3D: { type: 'boolean' },
    requires3DRationale: { type: 'string' },
    requiresVideo: { type: 'boolean' },
    requiresVideoRationale: { type: 'string' },
    functionalModules: { type: 'array', items: { type: 'string', enum: [...FUNCTIONAL_MODULE_IDS] } },
    mobileBehavior: { type: 'string', enum: [...MOBILE_BEHAVIORS] },
    accessibilityStrategy: { type: 'string', enum: [...ACCESSIBILITY_STRATEGIES] },
    performanceTier: { type: 'string', enum: PERFORMANCE_TIERS.map(String), description: 'A digit string "0".."5" — see the prompt below for what each tier means.' },
    reducedMotionStrategy: { type: 'string', enum: [...REDUCED_MOTION_STRATEGIES] },
    rationale: { type: 'string' },
  },
} as const;

/** The prompt fragment explaining the vocabulary and evidence triggers, for `signature.ts`'s signature prompt. */
export const EXPERIENCE_STRATEGY_PROMPT = `EXPERIENCE STRATEGY — decide each of the following explicitly, from the closed vocabulary given, never inventing a value outside it. Each is a real decision the deterministic builder will act on, not a mood word.

- motionIntensity: "none" | "subtle" | "expressive" | "immersive" — default posture is restraint; earn intensity with a reason, don't reach for it.
- navigationModel: "inline" | "sticky-minimal" | "full-screen-menu" | "morphing"
- loadingModel: "none" | "skeleton" | "progressive-reveal" | "asset-aware-preloader" — a preloader must be tied to real asset loading, never a fake timed animation.
- typographyBehavior: "static" | "kinetic-headlines" | "split-text-reveals" | "typography-led-navigation"
- cursorBehavior: "default" | "minimal-custom" | "magnetic" | "contextual"
- scrollBehavior: "native" | "smooth-native" | "pinned-storytelling" | "horizontal-section" — pinned/horizontal only when the central mechanism is genuinely spatial or temporal.
- layoutGrammar: "grid-regular" | "asymmetric-editorial" | "overlapping-layers" | "horizontal-narrative"
- mediaStrategy: "photography-only" | "photography-plus-texture" | "ai-generated-imagery" | "video-background" | "cinematic-hero-media" — never claim a strategy the real asset inventory can't support.
- requires3D (boolean) + requires3DRationale: leave false unless a 3D asset conveys something a photograph or CSS genuinely could not, and say what.
- requiresVideo (boolean) + requiresVideoRationale: same discipline — a rationale is required whenever true, or it is discarded.
- functionalModules: array from "none" | "enquiry-form" | "booking-request" | "service-selector" | "product-configurator" | "search-filter" | "comparison-tool" | "calculator" — select only what the business's own evidence justifies (a time-slotted, capacity-constrained service justifies booking-request; a small page count never justifies search-filter). Default to just "enquiry-form" absent a specific trigger.
- mobileBehavior: "mirrors-desktop" | "simplified" | "reordered-priority"
- accessibilityStrategy: "wcag-aa-floor" | "wcag-aa-enhanced"
- performanceTier: a single digit string "0"-"5" (0 = semantic/static baseline, 1 = CSS+DOM motion, 2 = advanced interaction/choreography, 3 = canvas/lightweight WebGL, 4 = complex 3D, 5 = AI-generated heavy media) — the tier must be justified by what motionIntensity/requires3D/requiresVideo/mediaStrategy actually need, never inflated for its own sake.
- reducedMotionStrategy: "instant-state-only" | "preserve-essential-feedback" (the latter only for a genuine determinate-progress or essential-spatial-feedback case).
- rationale: one paragraph tying these choices to the business's own verified evidence.`;
