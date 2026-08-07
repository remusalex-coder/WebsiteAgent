/**
 * Token generation.
 *
 * Turns a theme, a brand colour and a density into the numbers the renderer
 * emits. Everything here is arithmetic on the theme's ratios — no lookup
 * tables of hand-picked sizes, because a scale computed from one ratio is what
 * makes sizes look related rather than chosen one at a time.
 *
 * Two decisions worth naming:
 *
 * **Fluid, not stepped.** Every size is a pair — a value at a narrow viewport
 * and a value at a wide one — which the stylesheet interpolates with `clamp()`.
 * There are no typography breakpoints, so nothing jumps at 768px.
 *
 * **Contrast is constructed, not checked.** Text steps are pushed until they
 * clear the accessibility target against the surface they sit on. A pair that
 * cannot reach the target is reported in `notes` rather than silently shipped,
 * which is the same contract the renderer already honours.
 */

import {
  RAMP_ROLE,
  adjustForContrast,
  buildRamp,
  clampToGamut,
  contrastHex,
  hexToOklch,
  oklchToHex,
  readableOn,
} from './color.js';
import { FALLBACK_STACKS } from './themes.js';

import type { Oklch } from './color.js';
import type { ThemeDefinition, ThemeFontChoice } from './themes.js';
import type {
  AccessibilityPreferences,
  ColorRamp,
  ColorRole,
  ColorSystem,
  ElevationSystem,
  FontRole,
  MotionSystem,
  RadiusSystem,
  SemanticColors,
  SpaceStepName,
  SpacingSystem,
  TypeStep,
  TypeStepName,
  TypographySystem,
  VisualDensity,
} from './types.js';

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** Hue offsets for the status ramps. Fixed, because red means danger everywhere. */
const STATUS_HUES = { success: 145, warning: 75, danger: 27 } as const;

export interface ColorInput {
  /** Brand colour from the profile, if one was found. */
  readonly seedHex: string | null;
  /** Used when no brand colour was found. */
  readonly fallbackHue: number;
  readonly theme: ThemeDefinition;
  readonly accessibility: AccessibilityPreferences;
}

export interface ColorResult {
  readonly system: ColorSystem;
  readonly notes: readonly string[];
}

function ramp(role: ColorRole, seed: Oklch, seedHex: string, chroma: number): ColorRamp {
  return { role, seed: seedHex, steps: buildRamp(seed, { chroma }) };
}

function step(steps: readonly string[], index: number): string {
  return steps[index] ?? '#000000';
}

/**
 * Builds the colour system.
 *
 * The brand colour's *hue* is kept and its lightness and chroma are discarded:
 * a business whose logo is a very dark navy and one whose logo is a mid blue
 * should get equally usable ramps, differing in hue rather than in how much of
 * the ramp is reachable. The theme's chroma ceiling then decides how saturated
 * the whole system reads, which is what separates `minimal` from `bold` given
 * the same brand colour.
 */
export function buildColorSystem(input: ColorInput): ColorResult {
  const notes: string[] = [];
  const { theme, accessibility } = input;

  const parsed = input.seedHex === null ? null : hexToOklch(input.seedHex);
  if (input.seedHex !== null && parsed === null) {
    notes.push(`Brand colour "${input.seedHex}" could not be parsed; using the industry default hue.`);
  }

  const hue = parsed === null ? input.fallbackHue : parsed.h;
  if (parsed === null && input.seedHex === null) {
    notes.push(`No brand colour was found in the profile; using the industry default hue (${input.fallbackHue}°).`);
  }

  // A near-grey brand colour carries no usable hue, so the industry default is
  // a better seed than an arbitrary direction picked out of rounding noise.
  const effectiveHue = parsed !== null && parsed.c < 0.02 ? input.fallbackHue : hue;
  if (parsed !== null && parsed.c < 0.02) {
    notes.push('The brand colour is effectively neutral; hue taken from the industry default.');
  }

  const primarySeed: Oklch = clampToGamut({ l: 0.6, c: theme.chroma, h: effectiveHue });
  const primaryHex = oklchToHex(primarySeed);

  const shift = (degrees: number): Oklch =>
    clampToGamut({ l: 0.6, c: theme.chroma, h: (((effectiveHue + degrees) % 360) + 360) % 360 });

  const ramps: Record<ColorRole, ColorRamp> = {
    primary: ramp('primary', primarySeed, primaryHex, theme.chroma),
    secondary: ramp('secondary', shift(theme.secondaryHueShift), primaryHex, theme.chroma * 0.85),
    accent: ramp('accent', shift(theme.accentHueShift), primaryHex, theme.chroma),
    neutral: ramp('neutral', primarySeed, primaryHex, theme.neutralChroma),
    success: ramp('success', clampToGamut({ l: 0.6, c: 0.14, h: STATUS_HUES.success }), primaryHex, 0.14),
    warning: ramp('warning', clampToGamut({ l: 0.6, c: 0.16, h: STATUS_HUES.warning }), primaryHex, 0.16),
    danger: ramp('danger', clampToGamut({ l: 0.6, c: 0.17, h: STATUS_HUES.danger }), primaryHex, 0.17),
  };

  const neutral = ramps.neutral.steps;
  const brand = step(ramps.primary.steps, RAMP_ROLE.solid);
  const accent = step(ramps.accent.steps, RAMP_ROLE.solid);

  const canvas = step(neutral, RAMP_ROLE.canvas);
  const surface = step(neutral, RAMP_ROLE.surface);

  // Push text darker until it clears the body-contrast target against the page.
  const textSeed = hexToOklch(step(neutral, RAMP_ROLE.textStrong));
  const text = textSeed === null
    ? step(neutral, RAMP_ROLE.textStrong)
    : oklchToHex(adjustForContrast(textSeed, canvas, accessibility.minContrastBody, 'darker'));

  const mutedSeed = hexToOklch(step(neutral, RAMP_ROLE.text));
  const textMuted = mutedSeed === null
    ? step(neutral, RAMP_ROLE.text)
    : oklchToHex(adjustForContrast(mutedSeed, canvas, accessibility.minContrastBody, 'darker'));

  const inverted = step(neutral, RAMP_ROLE.textStrong);

  /**
   * A foreground for `background` that actually clears `target`.
   *
   * `readableOn` picks the better of the two poles, which is not the same as
   * picking one that works — against a mid-lightness fill both poles can land
   * in the low fours. So the winner is pushed away from the background until it
   * clears, the same way body text is constructed rather than checked.
   *
   * The second pole is the part that matters. The better *starting* pole is not
   * always the one with more room: a fill just light enough that near-white
   * beats near-black still has a near-white pole pinned at the top of the
   * lightness range with nowhere to go, while the dark one can run all the way
   * down. So the natural pole is kept whenever it can be made to work, and only
   * abandoned when it cannot.
   */
  const readableAgainst = (background: string, target: number): string => {
    const dark = step(neutral, RAMP_ROLE.textStrong);

    const push = (pole: string): string => {
      const seed = hexToOklch(pole);
      if (seed === null) return pole;
      return oklchToHex(adjustForContrast(seed, background, target, pole === dark ? 'darker' : 'lighter'));
    };

    const preferred = readableOn(background, dark, canvas);
    const first = push(preferred);
    if (contrastHex(first, background) >= target) return first;

    const second = push(preferred === dark ? canvas : dark);
    return contrastHex(second, background) >= contrastHex(first, background) ? second : first;
  };

  // The brand hue pushed dark enough to be read as body-sized type on the page.
  //
  // Measured against `surface`, not `canvas`. A link or an eyebrow does not only
  // appear on the page's lightest ground — it appears inside cards and on the
  // alternating band, which are a step and two steps darker. Tuning against the
  // lightest one leaves the others a tenth short, which is exactly how far under
  // AA the hero eyebrow sat on a third of the generated sites.
  const brandTextSeed = hexToOklch(brand);
  const brandText = brandTextSeed === null
    ? text
    : oklchToHex(adjustForContrast(brandTextSeed, surface, accessibility.minContrastBody, 'darker'));

  const semantic: SemanticColors = {
    canvas,
    canvasSubtle: step(neutral, RAMP_ROLE.canvasSubtle),
    surface,
    surfaceRaised: step(neutral, RAMP_ROLE.surfaceHover),
    border: step(neutral, RAMP_ROLE.borderSubtle),
    borderStrong: step(neutral, RAMP_ROLE.border),
    text,
    textMuted,
    heading: text,
    brand,
    brandHover: step(ramps.primary.steps, RAMP_ROLE.solidHover),
    // Against the body target, not the large-text one: these sit behind button
    // labels and navigation, which are normal-sized type however large the
    // block of colour under them is.
    onBrand: readableAgainst(brand, accessibility.minContrastBody),
    brandText,
    accent,
    onAccent: readableAgainst(accent, accessibility.minContrastBody),
    inverted,
    onInverted: readableAgainst(inverted, accessibility.minContrastBody),
    success: step(ramps.success.steps, RAMP_ROLE.solid),
    warning: step(ramps.warning.steps, RAMP_ROLE.solid),
    danger: step(ramps.danger.steps, RAMP_ROLE.solid),
  };

  const contrast = {
    textOnCanvas: round2(contrastHex(semantic.text, semantic.canvas)),
    textOnSurface: round2(contrastHex(semantic.text, semantic.surface)),
    onBrandOnBrand: round2(contrastHex(semantic.onBrand, semantic.brand)),
    mutedOnCanvas: round2(contrastHex(semantic.textMuted, semantic.canvas)),
  };

  // Report rather than throw: a shortfall is worth knowing about, and refusing
  // to produce a design over it would leave the pipeline with nothing.
  if (contrast.textOnCanvas < accessibility.minContrastBody) {
    notes.push(`Body text reaches only ${contrast.textOnCanvas}:1 against the page, below the ${accessibility.minContrastBody}:1 target.`);
  }
  if (contrast.mutedOnCanvas < accessibility.minContrastBody) {
    notes.push(`Muted text reaches only ${contrast.mutedOnCanvas}:1 against the page, below the ${accessibility.minContrastBody}:1 target.`);
  }
  // Held to the body target: a button label is normal-sized type whatever the
  // size of the coloured block behind it, and grading this against the 3:1
  // large-text floor was why every generated button sat in the low fours.
  if (contrast.onBrandOnBrand < accessibility.minContrastBody) {
    notes.push(`Text on the brand colour reaches only ${contrast.onBrandOnBrand}:1, below the ${accessibility.minContrastBody}:1 body target.`);
  }

  return { system: { ramps, semantic, scheme: 'light', contrast }, notes };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Two decimal places, enough for CSS and stable across platforms. */
function rem(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

/** Steps above and below the base, in modular-scale exponents. */
const TYPE_EXPONENTS: Readonly<Record<TypeStepName, number>> = {
  display: 5,
  h1: 4,
  h2: 3,
  h3: 2,
  h4: 1,
  bodyLarge: 0.5,
  body: 0,
  small: -1,
  caption: -1.5,
  eyebrow: -1.5,
};

/**
 * Line height falls as size rises.
 *
 * A 4rem heading at 1.6 line-height leaves a gap you could park in; body copy
 * at 1.2 is unreadable. Interpolating between the two by size is what a
 * typographer does by hand, and it is the difference most visible between a
 * designed page and a default one.
 */
function lineHeightFor(exponent: number): number {
  if (exponent >= 4) return 1.05;
  if (exponent >= 3) return 1.15;
  if (exponent >= 2) return 1.25;
  if (exponent >= 1) return 1.35;
  if (exponent >= 0) return 1.6;
  return 1.5;
}

function trackingFor(exponent: number, displayTracking: number): number {
  if (exponent >= 4) return displayTracking;
  if (exponent >= 2) return displayTracking / 2;
  return 0;
}

function stack(choice: ThemeFontChoice): string {
  const fallback = FALLBACK_STACKS[choice.fallback];
  // A family name is never quoted into the stack unsanitised: it comes from the
  // theme library, but the renderer treats every stack as untrusted anyway.
  return `"${choice.family}", ${fallback}`;
}

function fontRole(choice: ThemeFontChoice): FontRole {
  return {
    family: choice.family,
    stack: stack(choice),
    character: choice.character,
    weights: choice.weights,
  };
}

/** Density scales the whole type system without changing its proportions. */
const DENSITY_TYPE_SCALE: Readonly<Record<VisualDensity, number>> = {
  airy: 1.05,
  balanced: 1.0,
  dense: 0.95,
};

export function buildTypography(theme: ThemeDefinition, density: VisualDensity): TypographySystem {
  const base = theme.baseRem * DENSITY_TYPE_SCALE[density];

  // The narrow anchor compresses the scale: a ratio that reads as dramatic at
  // 1400px is unusable at 360px, where a 4rem heading wraps after two words.
  const narrowRatio = 1 + (theme.typeRatio - 1) * 0.62;

  const scale = {} as Record<TypeStepName, TypeStep>;
  for (const [name, exponent] of Object.entries(TYPE_EXPONENTS) as [TypeStepName, number][]) {
    const weights = name === 'body' || name === 'bodyLarge' || name === 'small' || name === 'caption'
      ? theme.bodyFont.weights
      : theme.headingFont.weights;

    scale[name] = {
      name,
      minRem: rem(base * narrowRatio ** exponent),
      maxRem: rem(base * theme.typeRatio ** exponent),
      lineHeight: lineHeightFor(exponent),
      letterSpacing: name === 'eyebrow' ? 0.12 : trackingFor(exponent, theme.displayTracking),
      // Eyebrows carry the heading face's weight; the heaviest weight goes to
      // the largest sizes, which is where weight contrast actually reads.
      weight: exponent >= 3
        ? Math.max(...theme.headingFont.weights)
        : (weights[0] ?? 400),
    };
  }

  return {
    heading: fontRole(theme.headingFont),
    body: fontRole(theme.bodyFont),
    mono: theme.monoFont === null ? null : fontRole(theme.monoFont),
    ratio: theme.typeRatio,
    baseRem: rem(base),
    scale,
    measureCh: theme.measureCh,
    fluidRange: { minRem: 20, maxRem: 90 },
  };
}

/* ------------------------------------------------------------------ */
/* Spacing                                                             */
/* ------------------------------------------------------------------ */

const SPACE_EXPONENTS: Readonly<Record<SpaceStepName, number>> = {
  '3xs': -3, '2xs': -2, xs: -1, sm: 0, md: 1, lg: 2, xl: 3, '2xl': 4, '3xl': 5, '4xl': 6,
};

/**
 * Section spacing, in rem, at the narrow and wide anchors.
 *
 * The single clearest density signal on a page — more so than font size or
 * column count. Airy and dense differ here by roughly a factor of two.
 *
 * This is padding at *each* edge, so the gap a reader sees between two sections
 * is double it: 12rem, 9rem and 6.5rem at the wide anchor. An earlier set ran
 * 9rem on `airy`, which is a defensible number until it is applied twice and a
 * section holding one line of text opens a 288px hole above it and another
 * below. The pair, not the single value, is what has to look considered.
 */
const SECTION_SPACE: Readonly<Record<VisualDensity, { min: number; max: number }>> = {
  airy: { min: 3, max: 6 },
  balanced: { min: 2.25, max: 4.5 },
  dense: { min: 1.75, max: 3.25 },
};

export function buildSpacing(theme: ThemeDefinition, density: VisualDensity): SpacingSystem {
  // 0.8rem, not 0.5rem. The scale's shape comes from the ratio; the base only
  // decides where it sits, and at 0.5 the whole thing sat one step low — `md`
  // came out at 0.75rem where a card's inner padding wants ~1.25rem, so every
  // card, quote and list row on a design-driven page rendered visibly cramped.
  // The `--space-*` names are shared with the base stylesheet, whose components
  // were built against that range, so the base is what aligns the two.
  const base = 0.8;
  const ratio = theme.spacingRatio;

  const scale = {} as Record<SpaceStepName, { name: SpaceStepName; minRem: number; maxRem: number }>;
  for (const [name, exponent] of Object.entries(SPACE_EXPONENTS) as [SpaceStepName, number][]) {
    const value = base * ratio ** exponent;
    scale[name] = {
      name,
      // Small steps barely grow with the viewport; large ones do most of the
      // work, which is what keeps a wide layout from looking merely stretched.
      minRem: rem(value * (exponent <= 0 ? 1 : 0.62)),
      maxRem: rem(value),
    };
  }

  const section = SECTION_SPACE[density];
  return {
    baseRem: base,
    ratio,
    scale,
    sectionMinRem: section.min,
    sectionMaxRem: section.max,
  };
}

/* ------------------------------------------------------------------ */
/* Radius and elevation                                                */
/* ------------------------------------------------------------------ */

const RADIUS_SCALE: Readonly<Record<RadiusSystem['style'], readonly [string, string, string]>> = {
  sharp: ['0', '0', '0'],
  subtle: ['0.1875rem', '0.3125rem', '0.5rem'],
  soft: ['0.375rem', '0.625rem', '1rem'],
  round: ['0.625rem', '1rem', '1.75rem'],
};

export function buildRadius(theme: ThemeDefinition): RadiusSystem {
  const [sm, md, lg] = RADIUS_SCALE[theme.radius];
  return { style: theme.radius, none: '0', sm, md, lg, pill: '999rem' };
}

/**
 * Shadows, tinted with the neutral hue rather than pure black.
 *
 * A black shadow over a warm page reads as dirty. Using the palette's own dark
 * end at low alpha is what makes elevation look like part of the design.
 */
export function buildElevation(theme: ThemeDefinition, shadowRgb: string): ElevationSystem {
  const flat = theme.elevation === 'flat';
  const intensity = { flat: 0, subtle: 1, lifted: 1.6, dramatic: 2.4 }[theme.elevation];

  const shadow = (y: number, blur: number, alpha: number): string =>
    intensity === 0
      ? 'none'
      : `0 ${rem(y * intensity)}rem ${rem(blur * intensity)}rem rgb(${shadowRgb} / ${Math.round(alpha * intensity * 100) / 100})`;

  return {
    style: theme.elevation,
    prefersBorders: flat,
    levels: {
      none: { name: 'none', shadow: 'none' },
      sm: { name: 'sm', shadow: shadow(0.0625, 0.125, 0.05) },
      md: { name: 'md', shadow: shadow(0.25, 0.75, 0.06) },
      lg: { name: 'lg', shadow: shadow(0.75, 2, 0.08) },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

const MOTION_DURATIONS: Readonly<Record<MotionSystem['level'], readonly [number, number, number]>> = {
  none: [0, 0, 0],
  subtle: [120, 200, 320],
  moderate: [140, 260, 420],
  expressive: [160, 320, 560],
};

export function buildMotion(theme: ThemeDefinition): MotionSystem {
  const [fast, base, slow] = MOTION_DURATIONS[theme.motion];
  return {
    level: theme.motion,
    durationFastMs: fast,
    durationBaseMs: base,
    durationSlowMs: slow,
    // A single easing curve across the whole site; mixing curves is a tell.
    easing: theme.motion === 'expressive'
      ? 'cubic-bezier(0.34, 1.2, 0.64, 1)'
      : 'cubic-bezier(0.4, 0, 0.2, 1)',
    effects: theme.motion === 'none' ? [] : theme.motionEffects,
    respectReducedMotion: true,
  };
}

/** `r g b` channel triple for the darkest neutral, for use inside `rgb(… / α)`. */
export function shadowChannels(darkestNeutral: string): string {
  const parsed = hexToOklch(darkestNeutral);
  if (parsed === null) return '0 0 0';

  const hex = oklchToHex({ ...parsed, l: 0.2 });
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}
