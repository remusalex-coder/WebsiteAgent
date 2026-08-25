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
 * surfaces. See docs/design-director-v1-spec.md for the full rationale.
 */

import type { ComposeOptions } from './compose.js';
import type { Logger } from '../logger.js';
import type { DesignDirection, HeroVariant, ImageTreatment, VisualDensity } from './types.js';

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
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

const VALID_DIRECTIONS = new Set<string>([
  'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
  'creative', 'playful', 'bold', 'premium', 'friendly',
]);

const VALID_DENSITIES = new Set<string>(['airy', 'balanced', 'dense']);

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

  // --- Return resolved ComposeOptions ---------------------------------

  // Preserve any other operator options that have no directive equivalent.
  // (Currently ComposeOptions only has direction + accessibilityLevel; this
  // spread-then-override pattern future-proofs the merge.)
  return {
    ...operatorOptions,
    ...(resolvedDirection !== undefined ? { direction: resolvedDirection } : {}),
    ...(resolvedAccessibility !== undefined ? { accessibilityLevel: resolvedAccessibility } : {}),
  };
}
