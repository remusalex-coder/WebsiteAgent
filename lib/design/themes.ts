/**
 * The theme library: eleven design directions.
 *
 * A direction is a coherent set of decisions that hold together — a scale
 * ratio, a radius style, a chroma ceiling, a font pairing, a motion budget. It
 * is not a template: no markup lives here, and two sites on the same direction
 * with different content and different brand colours look genuinely different.
 *
 * The set is closed and hand-authored, which is the point. A rule engine free
 * to combine any ratio with any radius with any palette produces the arithmetic
 * mean of all web design, which is exactly the generic output this layer exists
 * to fix. Constraint is where the character comes from.
 *
 * Font families are named but never fetched: the renderer emits a stack and no
 * external request, so a face the visitor lacks falls back within its own
 * character class. `fallback` records what that class is.
 */

import type {
  AnimationLevel,
  ContrastLevel,
  DesignDirection,
  ElevationStyle,
  FontCharacter,
  FooterVariant,
  HeroVariant,
  IconStyle,
  ImageTreatment,
  MotionEffect,
  RadiusStyle,
  SectionVariant,
  VisualDensity,
} from './types.js';

export interface ThemeFontChoice {
  readonly family: string;
  readonly character: FontCharacter;
  /** Which generic stack to fall back through. */
  readonly fallback: 'serif' | 'sans' | 'mono';
  readonly weights: readonly number[];
}

export interface ThemeDefinition {
  readonly id: DesignDirection;
  /** One line a person could argue with. */
  readonly description: string;

  /* Typography */
  readonly headingFont: ThemeFontChoice;
  readonly bodyFont: ThemeFontChoice;
  readonly monoFont: ThemeFontChoice | null;
  /** Modular scale ratio. Higher is more dramatic. */
  readonly typeRatio: number;
  readonly baseRem: number;
  readonly measureCh: number;
  /** em, applied to display sizes. Large type needs negative tracking. */
  readonly displayTracking: number;

  /* Colour */
  /** Peak chroma at the solid ramp step. The restraint dial. */
  readonly chroma: number;
  /** Chroma of the neutral ramp — how much brand hue bleeds into the greys. */
  readonly neutralChroma: number;
  readonly contrast: ContrastLevel;
  /** Degrees from primary to the secondary ramp. */
  readonly secondaryHueShift: number;
  /** Degrees from primary to the accent ramp. */
  readonly accentHueShift: number;

  /* Form */
  readonly radius: RadiusStyle;
  readonly elevation: ElevationStyle;
  readonly density: VisualDensity;
  readonly spacingRatio: number;

  /* Behaviour */
  readonly motion: AnimationLevel;
  readonly motionEffects: readonly MotionEffect[];
  readonly icons: IconStyle;
  readonly imageTreatment: ImageTreatment;

  /* Layout preferences, most preferred first */
  readonly heroPreference: readonly HeroVariant[];
  readonly footer: FooterVariant;
  /** Variants this direction will not use, whatever the section wants. */
  readonly avoidVariants: readonly SectionVariant[];
  readonly containerMaxRem: number;
}

const SANS_WEIGHTS = [400, 500, 600, 700] as const;

/**
 * The directions.
 *
 * Read the numbers as a spectrum rather than as eleven unrelated presets:
 * chroma runs 0.06 (minimal) to 0.22 (bold), type ratio 1.2 (corporate) to
 * 1.5 (editorial), radius sharp to round. A direction is a coordinate in that
 * space that a person has checked coheres.
 */
export const THEMES: Readonly<Record<DesignDirection, ThemeDefinition>> = {
  minimal: {
    id: 'minimal',
    description: 'Nothing that does not earn its place. Type, space and one accent.',
    headingFont: { family: 'Inter', character: 'sans', fallback: 'sans', weights: [500, 600] },
    bodyFont: { family: 'Inter', character: 'sans', fallback: 'sans', weights: [400, 500] },
    monoFont: null,
    typeRatio: 1.25,
    baseRem: 1.0,
    measureCh: 66,
    displayTracking: -0.02,
    chroma: 0.06,
    neutralChroma: 0.004,
    contrast: 'high',
    secondaryHueShift: 0,
    accentHueShift: 0,
    radius: 'subtle',
    elevation: 'flat',
    density: 'airy',
    spacingRatio: 1.5,
    motion: 'subtle',
    motionEffects: ['fade'],
    icons: 'line',
    imageTreatment: 'natural',
    heroPreference: ['minimal', 'centered', 'split'],
    footer: 'minimal',
    avoidVariants: ['collage', 'masonry', 'carousel', 'slider'],
    containerMaxRem: 64,
  },

  luxury: {
    id: 'luxury',
    description: 'Restraint as a signal of expense. Wide margins, small type, slow motion.',
    headingFont: { family: 'Cormorant Garamond', character: 'serif', fallback: 'serif', weights: [300, 400, 500] },
    bodyFont: { family: 'Jost', character: 'sans', fallback: 'sans', weights: [300, 400] },
    monoFont: null,
    typeRatio: 1.414,
    baseRem: 1.0,
    measureCh: 62,
    displayTracking: 0.01,
    chroma: 0.07,
    neutralChroma: 0.008,
    contrast: 'medium',
    secondaryHueShift: 24,
    accentHueShift: 40,
    radius: 'sharp',
    elevation: 'flat',
    density: 'airy',
    spacingRatio: 1.618,
    motion: 'subtle',
    motionEffects: ['fade', 'rise'],
    icons: 'line',
    imageTreatment: 'muted',
    heroPreference: ['full-bleed', 'editorial', 'centered'],
    footer: 'minimal',
    avoidVariants: ['bento', 'carousel', 'collage', 'timeline'],
    containerMaxRem: 72,
  },

  corporate: {
    id: 'corporate',
    description: 'Legible, predictable, credible. Structure over expression.',
    headingFont: { family: 'IBM Plex Sans', character: 'sans', fallback: 'sans', weights: [500, 600, 700] },
    bodyFont: { family: 'IBM Plex Sans', character: 'sans', fallback: 'sans', weights: [400, 500] },
    monoFont: { family: 'IBM Plex Mono', character: 'mono', fallback: 'mono', weights: [400] },
    typeRatio: 1.2,
    baseRem: 1.0,
    measureCh: 68,
    displayTracking: -0.01,
    chroma: 0.11,
    neutralChroma: 0.006,
    contrast: 'high',
    secondaryHueShift: 200,
    accentHueShift: 150,
    radius: 'subtle',
    elevation: 'subtle',
    density: 'balanced',
    spacingRatio: 1.5,
    motion: 'subtle',
    motionEffects: ['fade'],
    icons: 'solid',
    imageTreatment: 'natural',
    heroPreference: ['split', 'centered', 'image-first'],
    footer: 'corporate',
    avoidVariants: ['collage', 'masonry'],
    containerMaxRem: 72,
  },

  elegant: {
    id: 'elegant',
    description: 'Considered and quiet. Serif headings, generous leading, hairline rules.',
    headingFont: { family: 'Lora', character: 'serif', fallback: 'serif', weights: [400, 500, 600] },
    bodyFont: { family: 'Source Sans 3', character: 'sans', fallback: 'sans', weights: [400, 600] },
    monoFont: null,
    typeRatio: 1.333,
    baseRem: 1.0625,
    measureCh: 64,
    displayTracking: -0.005,
    chroma: 0.09,
    neutralChroma: 0.008,
    contrast: 'medium',
    secondaryHueShift: 30,
    accentHueShift: 60,
    radius: 'subtle',
    elevation: 'subtle',
    density: 'airy',
    spacingRatio: 1.5,
    motion: 'subtle',
    motionEffects: ['fade', 'rise'],
    icons: 'line',
    imageTreatment: 'warm',
    heroPreference: ['editorial', 'split', 'centered'],
    footer: 'minimal',
    avoidVariants: ['bento', 'carousel'],
    containerMaxRem: 68,
  },

  modern: {
    id: 'modern',
    description: 'Current without chasing. Geometric sans, real weight contrast, soft corners.',
    headingFont: { family: 'Manrope', character: 'sans', fallback: 'sans', weights: [600, 700, 800] },
    bodyFont: { family: 'Manrope', character: 'sans', fallback: 'sans', weights: [400, 500] },
    monoFont: null,
    typeRatio: 1.25,
    baseRem: 1.0,
    measureCh: 66,
    displayTracking: -0.03,
    chroma: 0.14,
    neutralChroma: 0.006,
    contrast: 'high',
    secondaryHueShift: 40,
    accentHueShift: 180,
    radius: 'soft',
    elevation: 'lifted',
    density: 'balanced',
    spacingRatio: 1.5,
    motion: 'moderate',
    motionEffects: ['fade', 'rise', 'stagger'],
    icons: 'line',
    imageTreatment: 'natural',
    heroPreference: ['split', 'centered', 'image-first'],
    footer: 'corporate',
    avoidVariants: ['collage'],
    containerMaxRem: 72,
  },

  editorial: {
    id: 'editorial',
    description: 'Built to be read. Strong vertical rhythm, big display type, rules not shadows.',
    headingFont: { family: 'Playfair Display', character: 'serif', fallback: 'serif', weights: [500, 600, 700] },
    bodyFont: { family: 'Source Serif 4', character: 'serif', fallback: 'serif', weights: [400, 600] },
    monoFont: null,
    typeRatio: 1.5,
    baseRem: 1.125,
    measureCh: 62,
    displayTracking: -0.02,
    chroma: 0.10,
    neutralChroma: 0.01,
    contrast: 'high',
    secondaryHueShift: 20,
    accentHueShift: 340,
    radius: 'sharp',
    elevation: 'flat',
    density: 'airy',
    spacingRatio: 1.618,
    motion: 'subtle',
    motionEffects: ['fade'],
    icons: 'none',
    imageTreatment: 'natural',
    heroPreference: ['editorial', 'magazine', 'minimal'],
    // Bento fragments linear reading, which is the one thing this direction is for.
    avoidVariants: ['bento', 'carousel', 'slider'],
    footer: 'minimal',
    containerMaxRem: 66,
  },

  creative: {
    id: 'creative',
    description: 'Asymmetry and overlap. For work that is itself visual.',
    headingFont: { family: 'Space Grotesk', character: 'sans', fallback: 'sans', weights: [500, 700] },
    bodyFont: { family: 'Work Sans', character: 'sans', fallback: 'sans', weights: [400, 500] },
    monoFont: { family: 'Space Mono', character: 'mono', fallback: 'mono', weights: [400] },
    typeRatio: 1.414,
    baseRem: 1.0,
    measureCh: 64,
    displayTracking: -0.03,
    chroma: 0.18,
    neutralChroma: 0.012,
    contrast: 'high',
    secondaryHueShift: 120,
    accentHueShift: 240,
    radius: 'soft',
    elevation: 'lifted',
    density: 'balanced',
    spacingRatio: 1.5,
    motion: 'expressive',
    motionEffects: ['fade', 'rise', 'scale', 'stagger'],
    icons: 'line',
    imageTreatment: 'natural',
    heroPreference: ['magazine', 'image-first', 'full-bleed'],
    footer: 'rich',
    avoidVariants: [],
    containerMaxRem: 76,
  },

  playful: {
    id: 'playful',
    description: 'Warm, round and unserious. Confident colour, soft everything.',
    headingFont: { family: 'Fredoka', character: 'display', fallback: 'sans', weights: [500, 600] },
    bodyFont: { family: 'Nunito', character: 'sans', fallback: 'sans', weights: [400, 600] },
    monoFont: null,
    typeRatio: 1.25,
    baseRem: 1.0625,
    measureCh: 62,
    displayTracking: -0.01,
    chroma: 0.19,
    neutralChroma: 0.014,
    contrast: 'medium',
    secondaryHueShift: 60,
    accentHueShift: 300,
    radius: 'round',
    elevation: 'lifted',
    density: 'balanced',
    spacingRatio: 1.5,
    motion: 'moderate',
    motionEffects: ['fade', 'rise', 'scale', 'stagger'],
    icons: 'solid',
    imageTreatment: 'warm',
    heroPreference: ['centered', 'split', 'image-first'],
    footer: 'rich',
    avoidVariants: ['timeline'],
    containerMaxRem: 70,
  },

  bold: {
    id: 'bold',
    description: 'Loud on purpose. Oversized type, flat blocks of colour, no apology.',
    headingFont: { family: 'Archivo', character: 'sans', fallback: 'sans', weights: [700, 800, 900] },
    bodyFont: { family: 'Archivo', character: 'sans', fallback: 'sans', weights: [400, 500] },
    monoFont: null,
    typeRatio: 1.5,
    baseRem: 1.0625,
    measureCh: 60,
    displayTracking: -0.04,
    chroma: 0.22,
    neutralChroma: 0.01,
    contrast: 'high',
    secondaryHueShift: 180,
    accentHueShift: 45,
    radius: 'sharp',
    elevation: 'flat',
    density: 'dense',
    spacingRatio: 1.5,
    motion: 'moderate',
    motionEffects: ['fade', 'rise', 'stagger'],
    icons: 'solid',
    imageTreatment: 'natural',
    heroPreference: ['full-bleed', 'centered', 'magazine'],
    footer: 'rich',
    avoidVariants: ['timeline', 'masonry'],
    containerMaxRem: 76,
  },

  premium: {
    id: 'premium',
    description: 'Dark ground, precise detail, restrained accent. Expensive rather than loud.',
    headingFont: { family: 'Outfit', character: 'sans', fallback: 'sans', weights: [500, 600] },
    bodyFont: { family: 'Outfit', character: 'sans', fallback: 'sans', weights: [300, 400] },
    monoFont: null,
    typeRatio: 1.333,
    baseRem: 1.0,
    measureCh: 64,
    displayTracking: -0.02,
    chroma: 0.10,
    neutralChroma: 0.01,
    contrast: 'high',
    secondaryHueShift: 20,
    accentHueShift: 35,
    radius: 'subtle',
    elevation: 'subtle',
    density: 'airy',
    spacingRatio: 1.618,
    motion: 'moderate',
    motionEffects: ['fade', 'rise', 'stagger'],
    icons: 'line',
    imageTreatment: 'cool',
    heroPreference: ['full-bleed', 'split', 'editorial'],
    footer: 'corporate',
    avoidVariants: ['collage', 'carousel'],
    containerMaxRem: 72,
  },

  friendly: {
    id: 'friendly',
    description: 'Approachable and plain. The default for a small business that just wants to be found.',
    headingFont: { family: 'Nunito Sans', character: 'sans', fallback: 'sans', weights: [600, 700] },
    bodyFont: { family: 'Nunito Sans', character: 'sans', fallback: 'sans', weights: [400, 600] },
    monoFont: null,
    typeRatio: 1.25,
    baseRem: 1.0,
    measureCh: 66,
    displayTracking: -0.01,
    chroma: 0.13,
    neutralChroma: 0.008,
    contrast: 'high',
    secondaryHueShift: 30,
    accentHueShift: 200,
    radius: 'soft',
    elevation: 'subtle',
    density: 'balanced',
    spacingRatio: 1.5,
    motion: 'subtle',
    motionEffects: ['fade', 'rise'],
    icons: 'line',
    imageTreatment: 'warm',
    heroPreference: ['split', 'centered', 'image-first'],
    footer: 'corporate',
    avoidVariants: ['collage', 'masonry'],
    containerMaxRem: 70,
  },
};

/** Generic stacks. No web font is ever fetched, so these are what most visitors see. */
export const FALLBACK_STACKS: Readonly<Record<'serif' | 'sans' | 'mono', string>> = {
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", Times, serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

export function themeFor(direction: DesignDirection): ThemeDefinition {
  return THEMES[direction];
}

/** Weights every theme guarantees, for callers that need a floor. */
export const BASE_WEIGHTS: readonly number[] = SANS_WEIGHTS;
