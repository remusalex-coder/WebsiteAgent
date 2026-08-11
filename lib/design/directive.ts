/**
 * DesignDirective — the V1 AI Design Director contract.
 *
 * An AI Art Director decides *what* a website should feel and look like at a
 * high level. It must never become an indirect CSS or token generator — that is
 * the job of the deterministic design system that follows it.
 *
 * The flow is:
 *
 *   AI Design Director
 *     → DesignDirective          (this file: the contract)
 *     → applyDirective adapter   (this file: deterministic)
 *     → ComposeOptions           (small, existing set)
 *     → composeDesign()          (existing deterministic system)
 *     → WebsiteDesign
 *     → Renderer
 *
 * What this is NOT:
 * - Not a CSS generator.
 * - Not a token generator.
 * - Not a design-token DSL.
 * - Not a brand-color picker (brandColorHex, chromaScale, accentHueShift, etc.)
 * - Not a typography-size picker (typeScaleBias, etc.)
 *
 * V1 deliberately keeps the contract small. Extension happens when Visual Critic
 * evidence shows the deterministic design system needs additional control
 * surfaces. See docs/design-director-v1.md for the full rationale.
 */

import type { ComposeOptions } from './compose.js';
import type { Logger } from '../logger.js';
import type { DesignDirection, HeroVariant, ImageTreatment, VisualDensity } from './types.js';
import type { SectionKind } from '../types.js';
import type { ExperienceMode } from './experience.js';
import type { ConversionMode } from './conversion.js';
import type { InteractionLevel } from './interaction.js';

/** Director-facing pacing vocabulary (mapped to the internal `Pacing`). */
export type DirectorPacing = 'restrained' | 'measured' | 'cinematic' | 'immersive';
/** Director-facing imagery vocabulary. Advisory in this version. */
export type ImageryStrategy = 'functional' | 'editorial' | 'gallery-led' | 'hero-led' | 'atmospheric';

/** A Logger that discards all records. Used when no logger is supplied. */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
  time: async (_label, fn) => fn(),
};

/* ------------------------------------------------------------------ */
/* Hero intent                                                         */
/* ------------------------------------------------------------------ */

/**
 * A controlled hero preference from the director.
 *
 * The directive names a structural preference and attaches a semantic intent
 * string. The adapter translates this into `ComposeOptions` where appropriate;
 * the layout planner makes the final variant decision from the closed enum.
 */
export interface HeroIntent {
  /** A preferred hero structure. `null` means no preference. */
  readonly preference: HeroVariant | null;
  /** Why the director wants this treatment — one sentence. */
  readonly intent: string;
}

/* ------------------------------------------------------------------ */
/* Color strategy                                                      */
/* ------------------------------------------------------------------ */

/**
 * A high-level color strategy.
 *
 * 'brand-led'   — the primary brand hue is prominent throughout.
 * 'neutral'     — subdued palette; brand used only as an accent.
 * 'high-contrast' — accessibility and legibility are the primary drivers.
 */
export type ColorStrategy = 'brand-led' | 'neutral' | 'high-contrast';

/* ------------------------------------------------------------------ */
/* Typography intent                                                   */
/* ------------------------------------------------------------------ */

/**
 * Semantic typographic direction.
 *
 * `intent` is a one-sentence description of the typographic goal.
 * `preference` may suggest a typeface character class; the deterministic
 * system picks the actual typeface from the theme's approved set.
 */
export interface TypographyIntent {
  readonly intent: string;
  readonly preference: 'serif' | 'sans' | null;
}

/* ------------------------------------------------------------------ */
/* Imagery intent                                                      */
/* ------------------------------------------------------------------ */

/**
 * Semantic imagery direction.
 *
 * `intent` is a one-sentence description of the imagery goal.
 * `treatment` is an existing `ImageTreatment` value from the design system,
 * reused here rather than invented — the closed-set contract holds.
 */
export interface ImageryIntent {
  readonly intent: string;
  readonly treatment: ImageTreatment | null;
}

/* ------------------------------------------------------------------ */
/* Experience intent                                                   */
/* ------------------------------------------------------------------ */

/**
 * A signature-moment nomination — the one narrow, closed-set slice of
 * experiential capability the Director may exercise. See ADR 0005.
 *
 * `moment` references an existing `SectionKind`, never free text: the
 * Director cannot invent a moment the business's content does not have.
 * This type only enforces *shape*; whether the nominated kind actually
 * exists in this business's own sections is checked downstream, by
 * `planLayout`, which is the first place in the pipeline that has the
 * content to check it against. Until then the nomination is advisory, like
 * every other field in this contract.
 *
 * `mode: 'standard'` — with `moment`, `momentIntent` and `transitionAtMoment`
 * at their null/false rest values — must be a common, unremarkable answer,
 * not an edge case: most businesses have no single moment worth building
 * emphasis around, and saying so plainly is the correct output for them.
 */
export interface ExperienceIntent {
  readonly mode: 'standard' | 'moment-led';
  /** Required when `mode` is `'moment-led'`; must be `null` for `'standard'`. */
  readonly moment: SectionKind | null;
  /** One sentence: why this section deserves emphasis. `null` for `'standard'`. */
  readonly momentIntent: string | null;
  /** Whether the deterministic transition primitive marks entry to the moment. */
  readonly transitionAtMoment: boolean;
}

/* ------------------------------------------------------------------ */
/* DesignDirective                                                     */
/* ------------------------------------------------------------------ */

/**
 * The V1 AI Design Director contract.
 *
 * All fields are optional. Missing values degrade gracefully: the adapter
 * warns and falls back to the deterministic design system's own inference.
 * A completely empty directive is valid and produces identical output to
 * calling `composeDesign` with no options.
 *
 * Fields deliberately excluded from V1 (see spec for rationale):
 *   brandColorHex, chromaScale, accentHueShift, typeScaleBias, emphasisHints,
 *   layoutRhythm, arbitrary CSS, spacing, or typography size values.
 */
export interface DesignDirective {
  /**
   * The overall design direction.
   *
   * Uses the existing closed `DesignDirection` enum. When present, this
   * overrides industry inference. The operator's explicit `ComposeOptions.direction`
   * takes precedence over this value — operator override always wins.
   */
  readonly direction?: DesignDirection | undefined;

  /**
   * A free-text sentence describing the intended visual feel.
   *
   * Not mapped to any token. Logged for observability and included in
   * rationale trails. One sentence maximum.
   */
  readonly visualIntent?: string | undefined;

  /**
   * How much visual breathing room the layout should have.
   *
   * Maps to the existing `VisualDensity` type. Interpreted as a preference,
   * not a hard constraint — the deterministic system may adjust for page length.
   */
  readonly density?: VisualDensity | undefined;

  /**
   * Hero section preference and semantic intent.
   *
   * The `preference` names a hero variant from the existing closed set.
   * The layout planner has final say — it will override the preference if
   * the content or industry cannot support it.
   */
  readonly heroIntent?: HeroIntent | undefined;

  /**
   * Semantic layout intent.
   *
   * A one-sentence description of the intended spatial feel — e.g.
   * "editorial column with strong hierarchy" or "grid-forward, card-heavy".
   * Not mapped to layout tokens; informs observability only in V1.
   */
  readonly layoutIntent?: string | undefined;

  /**
   * High-level color strategy.
   *
   * Maps to `accessibilityLevel` in `ComposeOptions` when `high-contrast`
   * is chosen. Other values are logged for observability but do not currently
   * change composition — the director influences direction, which already
   * drives the palette.
   */
  readonly colorStrategy?: ColorStrategy | undefined;

  /**
   * Typographic semantic intent.
   *
   * `intent` is logged for observability. `preference` is a typeface
   * character class hint — the deterministic system chooses the actual
   * typeface from the theme's approved pairings.
   */
  readonly typographyIntent?: TypographyIntent | undefined;

  /**
   * Imagery semantic intent.
   *
   * `intent` is logged for observability. `treatment` is an existing
   * `ImageTreatment` value and is ignored in V1 (the theme owns the
   * treatment) — preserved as a typed slot for future use.
   */
  readonly imageryIntent?: ImageryIntent | undefined;

  /**
   * Target WCAG accessibility conformance level.
   *
   * Maps directly to `ComposeOptions.accessibilityLevel`.
   * Overridden by `colorStrategy: 'high-contrast'` which forces `'AAA'`.
   */
  readonly accessibilityTarget?: 'AA' | 'AAA' | undefined;

  /**
   * Why the director made these choices.
   *
   * Not a runtime constraint. Logged and recorded for audit trails. The
   * adapter warns when absent but does not fail.
   */
  readonly rationale?: string | undefined;

  /**
   * Director confidence in the directive, 0–1.
   *
   * Not a runtime constraint. Below 0.5 the adapter logs a warning.
   * No threshold causes a hard failure.
   */
  readonly confidence?: number | undefined;

  /**
   * A signature-moment nomination, when the business's evidence supports one.
   *
   * Unlike the ten fields above, this one actually reaches `ComposeOptions`
   * and changes layout (see `applyExperienceIntent`) rather than staying
   * advisory-only — a deliberate, narrow widening recorded in ADR 0005.
   * Optional so a historical directive, or a provider call that omits it,
   * degrades to exactly the pre-existing behaviour: absent is equivalent to
   * `{ mode: 'standard', moment: null, momentIntent: null,
   * transitionAtMoment: false }`.
   */
  readonly experienceIntent?: ExperienceIntent | undefined;

  /* ----------------------------------------------------------------
   * Experience-system decision surface (this version).
   *
   * These let the Director reason over the whole experience — not just one
   * moment — from image-content signals now present in the brief. Each is a
   * closed set, validated in `applyDirective`, and overrides the deterministic
   * floor only when valid. `experienceMode`, `conversionStrategy` and
   * `interactionStrategy` reach `ComposeOptions` and change the design;
   * `signatureMoment` reaches it as the moment nomination; `pacing` and
   * `imageryStrategy` are validated and recorded but advisory in this version
   * (their effects are derived deterministically from mode), pending the
   * runtime that would consume them.
   * ---------------------------------------------------------------- */
  readonly experienceMode?: ExperienceMode | undefined;
  readonly signatureMoment?: SectionKind | null | undefined;
  readonly pacing?: DirectorPacing | undefined;
  readonly imageryStrategy?: ImageryStrategy | undefined;
  readonly interactionStrategy?: InteractionLevel | undefined;
  readonly conversionStrategy?: ConversionMode | undefined;
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

const VALID_DIRECTIONS = new Set<string>([
  'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
  'creative', 'playful', 'bold', 'premium', 'friendly',
]);

const VALID_DENSITIES = new Set<string>(['airy', 'balanced', 'dense']);
const VALID_EXPERIENCE_MODES = new Set<string>(['brochure', 'showcase', 'narrative', 'immersive']);
const VALID_CONVERSION_MODES = new Set<string>(['direct', 'editorial', 'balanced', 'high-intent']);
const VALID_INTERACTION_LEVELS = new Set<string>(['static', 'subtle', 'guided', 'immersive']);
const VALID_PACING = new Set<string>(['restrained', 'measured', 'cinematic', 'immersive']);
const VALID_IMAGERY_STRATEGIES = new Set<string>(['functional', 'editorial', 'gallery-led', 'hero-led', 'atmospheric']);
const VALID_SECTION_KINDS = new Set<string>([
  'hero', 'statement', 'about', 'services', 'menu', 'gallery',
  'testimonials', 'hours', 'location', 'contact', 'cta', 'faq',
]);

/**
 * Validates one closed-set directive field.
 *
 * Returns the value when it is in the set, `undefined` (with a warning) when it
 * is not — the same fail-soft contract every other field in this adapter uses.
 * An invalid experience decision is not a failed stage; it is a decision the
 * deterministic floor makes instead.
 */
function validated<T extends string>(
  value: string | null | undefined,
  set: ReadonlySet<string>,
  field: string,
  logger: Logger,
): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (set.has(value)) return value as T;
  logger.warn(`DesignDirective: ${field} "${value}" is not a valid value; falling back to the deterministic floor`);
  return undefined;
}

/**
 * Translates a `DesignDirective` into `ComposeOptions`.
 *
 * Pure deterministic function: same directive + same operator options →
 * same `ComposeOptions` every time. No model calls, no clock, no I/O.
 *
 * Precedence rules:
 *   1. `operatorOptions.direction` wins over `directive.direction` (always).
 *   2. `operatorOptions.accessibilityLevel` wins over `directive.accessibilityTarget`
 *      and `directive.colorStrategy`.
 *   3. Missing fields degrade gracefully with a warning log; the composition
 *      proceeds with the deterministic system's own inference.
 *
 * @param directive  The AI director's high-level intent. May be undefined.
 * @param operatorOptions  Explicit operator overrides. Always take precedence.
 * @param logger  Optional logger for observability. Defaults to a no-op logger.
 *               Logging is never a required runtime dependency.
 */
export function applyDirective(
  directive: DesignDirective | undefined,
  operatorOptions: ComposeOptions = {},
  logger: Logger = noopLogger,
): ComposeOptions {
  if (directive === undefined) {
    return { ...operatorOptions };
  }

  // --- Observability --------------------------------------------------

  if (directive.rationale === undefined || directive.rationale.trim() === '') {
    logger.warn('DesignDirective: rationale is absent — decision trail will be incomplete');
  }

  if (directive.confidence !== undefined) {
    if (directive.confidence < 0 || directive.confidence > 1) {
      logger.warn(
        `DesignDirective: confidence ${directive.confidence} is out of range [0, 1]; ignoring`,
      );
    } else if (directive.confidence < 0.5) {
      logger.warn(
        `DesignDirective: confidence ${directive.confidence.toFixed(2)} is below 0.5 — `
        + 'directive will be applied but the design system may produce a better result from '
        + 'inference alone',
      );
    }
  }

  if (directive.visualIntent !== undefined) {
    logger.info(`DesignDirective: visualIntent = "${directive.visualIntent}"`);
  }
  if (directive.layoutIntent !== undefined) {
    logger.info(`DesignDirective: layoutIntent = "${directive.layoutIntent}"`);
  }
  if (directive.heroIntent?.intent !== undefined) {
    logger.info(`DesignDirective: heroIntent = "${directive.heroIntent.intent}"`);
  }
  if (directive.typographyIntent?.intent !== undefined) {
    logger.info(`DesignDirective: typographyIntent = "${directive.typographyIntent.intent}"`);
  }
  if (directive.imageryIntent?.intent !== undefined) {
    logger.info(`DesignDirective: imageryIntent = "${directive.imageryIntent.intent}"`);
  }

  // --- Direction ------------------------------------------------------

  // Operator direction always wins.
  let resolvedDirection = operatorOptions.direction;

  if (resolvedDirection === undefined && directive.direction !== undefined) {
    if (VALID_DIRECTIONS.has(directive.direction)) {
      resolvedDirection = directive.direction;
    } else {
      logger.warn(
        `DesignDirective: direction "${directive.direction}" is not a valid DesignDirection; `
        + 'falling back to inference',
      );
    }
  }

  // --- Density --------------------------------------------------------

  // density from directive is logged for future use; V1 passes it through
  // as a note only — the deterministic system still controls density from
  // direction × industry × section-count.
  if (directive.density !== undefined) {
    if (VALID_DENSITIES.has(directive.density)) {
      logger.info(`DesignDirective: density hint = "${directive.density}" (advisory in V1)`);
    } else {
      logger.warn(
        `DesignDirective: density "${directive.density}" is not valid; ignoring`,
      );
    }
  }

  // --- Accessibility --------------------------------------------------

  // Operator accessibility level always wins.
  let resolvedAccessibility = operatorOptions.accessibilityLevel;

  if (resolvedAccessibility === undefined) {
    if (directive.colorStrategy === 'high-contrast') {
      // 'high-contrast' forces AAA regardless of accessibilityTarget.
      resolvedAccessibility = 'AAA';
      logger.info('DesignDirective: colorStrategy = "high-contrast" → accessibilityLevel forced to AAA');
    } else if (directive.accessibilityTarget !== undefined) {
      // Use a runtime set so invalid values passed via `as any` are caught.
      const validTargets = new Set<string>(['AA', 'AAA']);
      if (validTargets.has(directive.accessibilityTarget)) {
        resolvedAccessibility = directive.accessibilityTarget as 'AA' | 'AAA';
      } else {
        logger.warn(
          `DesignDirective: accessibilityTarget "${String(directive.accessibilityTarget)}" is invalid; `
          + 'defaulting to AA',
        );
        resolvedAccessibility = 'AA';
      }
    }
  }

  // colorStrategy 'brand-led' and 'neutral' are semantic hints; in V1 they
  // influence direction selection (the direction drives the palette) rather
  // than token values. Logged above for observability.
  if (directive.colorStrategy !== undefined && directive.colorStrategy !== 'high-contrast') {
    logger.info(`DesignDirective: colorStrategy = "${directive.colorStrategy}" (advisory in V1)`);
  }

  // --- Experience intent ------------------------------------------------

  // Operator momentSection always wins, same precedence as direction and
  // accessibilityLevel above. No operator hook exists for this yet, but the
  // seam costs nothing to keep consistent.
  const experience = applyExperienceIntent(directive.experienceIntent, logger);

  // Experience-system decisions, each validated against its closed set. An
  // explicit `signatureMoment` outranks the older experienceIntent moment; an
  // operator override outranks both.
  const experienceMode = validated<ExperienceMode>(directive.experienceMode, VALID_EXPERIENCE_MODES, 'experienceMode', logger);
  const conversionMode = validated<ConversionMode>(directive.conversionStrategy, VALID_CONVERSION_MODES, 'conversionStrategy', logger);
  const interactionLevel = validated<InteractionLevel>(directive.interactionStrategy, VALID_INTERACTION_LEVELS, 'interactionStrategy', logger);
  const directedMoment = validated<SectionKind>(directive.signatureMoment ?? undefined, VALID_SECTION_KINDS, 'signatureMoment', logger);
  // Validated-but-advisory in this version; recorded for the trail, not yet wired.
  const pacing = validated<DirectorPacing>(directive.pacing, VALID_PACING, 'pacing', logger);
  const imagery = validated<ImageryStrategy>(directive.imageryStrategy, VALID_IMAGERY_STRATEGIES, 'imageryStrategy', logger);
  if (pacing !== undefined) logger.info(`DesignDirective: pacing = "${pacing}" (advisory this version)`);
  if (imagery !== undefined) logger.info(`DesignDirective: imageryStrategy = "${imagery}" (advisory this version)`);

  const resolvedMoment = operatorOptions.momentSection !== undefined
    ? operatorOptions.momentSection
    : directedMoment !== undefined
      ? directedMoment
      : experience.momentSection;

  // --- Return resolved ComposeOptions ---------------------------------

  // Preserve any other operator options that have no directive equivalent —
  // `photographicSeed` is the one that matters today: the brand colour read off
  // the business's own photographs must survive a directive that says nothing
  // about colour.
  return {
    ...operatorOptions,
    ...(resolvedDirection !== undefined ? { direction: resolvedDirection } : {}),
    ...(resolvedAccessibility !== undefined ? { accessibilityLevel: resolvedAccessibility } : {}),
    ...(resolvedMoment !== undefined ? {
      momentSection: resolvedMoment,
      momentTransition: resolvedMoment === operatorOptions.momentSection
        ? (operatorOptions.momentTransition ?? false)
        : directedMoment !== undefined
          ? true
          : experience.momentTransition,
    } : {}),
    ...(experienceMode !== undefined ? { experienceMode } : {}),
    ...(conversionMode !== undefined ? { conversionMode } : {}),
    ...(interactionLevel !== undefined ? { interactionLevel } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Experience intent — adapter                                        */
/* ------------------------------------------------------------------ */

/** What `applyExperienceIntent` resolves to, before being merged into `ComposeOptions`. */
interface ResolvedExperience {
  readonly momentSection: SectionKind | undefined;
  readonly momentTransition: boolean;
}

const NO_MOMENT: ResolvedExperience = { momentSection: undefined, momentTransition: false };

/**
 * Translates `ExperienceIntent` into the two `ComposeOptions` fields
 * `planLayout` reads.
 *
 * Pure and deterministic, same shape as `applyDirective`: a malformed or
 * internally-inconsistent intent degrades to "no moment", with a warning,
 * rather than throwing — an inconsistent nested field is not a failed stage.
 * This function does not know whether `moment` actually exists in the
 * business's content; that check needs `WebsiteContent` and belongs to
 * `planLayout`, the first place in the pipeline that has it. This function
 * only enforces the *shape* of the contract — the same division of labour
 * `applyDirective` already uses for `direction` and `accessibilityTarget`.
 *
 * @param experienceIntent  The director's moment nomination. May be undefined.
 * @param logger  Optional logger for observability. Defaults to a no-op logger.
 */
export function applyExperienceIntent(
  experienceIntent: ExperienceIntent | undefined,
  logger: Logger = noopLogger,
): ResolvedExperience {
  if (experienceIntent === undefined) return NO_MOMENT;

  if (experienceIntent.mode === 'standard') {
    /*
     * moment/momentIntent are unconditionally ignored here, not treated as an
     * inconsistency to warn about — the live schema cannot express null for
     * either (Gemini's structured-output translator rejects a `type:
     * ['string', 'null']` union), so a real model response always carries a
     * real section kind and sentence even in "standard" mode, exactly the
     * established pattern already used for heroIntent/typographyIntent/
     * imageryIntent's own preference fields. Only transitionAtMoment can
     * still express a genuine, worth-flagging inconsistency: a transition
     * requested for a moment the mode says does not exist.
     */
    if (experienceIntent.transitionAtMoment) {
      logger.warn(
        'ExperienceIntent: mode is "standard" but transitionAtMoment was true; ignoring it',
      );
    }
    return NO_MOMENT;
  }

  if (experienceIntent.mode !== 'moment-led') {
    logger.warn(`ExperienceIntent: mode "${String(experienceIntent.mode)}" is not valid; ignoring`);
    return NO_MOMENT;
  }

  if (experienceIntent.moment === null) {
    logger.warn(
      'ExperienceIntent: mode is "moment-led" but moment is null; falling back to standard',
    );
    return NO_MOMENT;
  }

  if (experienceIntent.momentIntent === null || experienceIntent.momentIntent.trim() === '') {
    logger.warn(
      'ExperienceIntent: mode is "moment-led" but momentIntent is missing; falling back to standard',
    );
    return NO_MOMENT;
  }

  logger.info(
    `ExperienceIntent: moment = "${experienceIntent.moment}" — ${experienceIntent.momentIntent}`,
  );
  return {
    momentSection: experienceIntent.moment,
    momentTransition: experienceIntent.transitionAtMoment,
  };
}
