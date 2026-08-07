/**
 * `WebsiteDesign` — the design contract.
 *
 * `WebsiteContent` says what the site communicates. This says how it looks.
 * The two are deliberately independent: neither type imports the other, a
 * design can be composed for any content, and the same content rendered under
 * two designs differs in every visual respect and in none of its claims.
 *
 * Three properties this type is built to hold:
 *
 * 1. **No timestamp, no run id, nothing from the clock.** `BusinessStrategy`
 *    carries `generatedAt` because it records one model call. A design is a
 *    pure function of its inputs and must be byte-comparable across runs, so
 *    there is nowhere for the current time to enter.
 * 2. **Decisions carry their reasoning.** Every choice that could have gone
 *    another way records `rationale` and `evidence`, the same way a
 *    `Recommendation` does. A design nobody can argue with is a design nobody
 *    can review.
 * 3. **Layout is named, not drawn.** The design chooses a *variant* from a
 *    closed set; the renderer owns what that variant's markup is. That is what
 *    keeps this a decision document rather than a second template engine.
 */

import type { SectionKind } from '../types.js';

/* ------------------------------------------------------------------ */
/* Personality                                                         */
/* ------------------------------------------------------------------ */

/**
 * The eleven design directions.
 *
 * A closed set on purpose. A model or a rule asked to invent a direction
 * produces the same handful of generic looks; choosing from a curated set that
 * a person authored is what makes the output feel designed.
 */
export type DesignDirection =
  | 'minimal'
  | 'luxury'
  | 'corporate'
  | 'elegant'
  | 'modern'
  | 'editorial'
  | 'creative'
  | 'playful'
  | 'bold'
  | 'premium'
  | 'friendly';

export const DESIGN_DIRECTIONS: readonly DesignDirection[] = [
  'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
  'creative', 'playful', 'bold', 'premium', 'friendly',
];

/** How much air the layout leaves. Drives spacing, type size and column counts. */
export type VisualDensity = 'airy' | 'balanced' | 'dense';

/** How far apart the light and dark ends of the palette sit. */
export type ContrastLevel = 'soft' | 'medium' | 'high';

export type Formality = 'casual' | 'neutral' | 'formal';
export type Temperature = 'warm' | 'neutral' | 'cool';
export type Energy = 'calm' | 'steady' | 'energetic';

/** What the site should feel like, before any of it is measured in pixels. */
export interface BrandMood {
  readonly temperature: Temperature;
  readonly energy: Energy;
  readonly formality: Formality;
}

export interface VisualPersonality {
  readonly direction: DesignDirection;
  readonly mood: BrandMood;
  readonly density: VisualDensity;
  readonly contrast: ContrastLevel;
  /** Why this direction and not another. */
  readonly rationale: string;
  /** The profile and strategy facts the choice rests on. */
  readonly evidence: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Industry                                                            */
/* ------------------------------------------------------------------ */

export type Industry =
  | 'bakery'
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'law'
  | 'medical'
  | 'dental'
  | 'beauty'
  | 'spa'
  | 'gym'
  | 'construction'
  | 'automotive'
  | 'hotel'
  | 'retail'
  | 'real-estate'
  | 'professional-services'
  | 'general';

export const INDUSTRIES: readonly Industry[] = [
  'bakery', 'restaurant', 'cafe', 'bar', 'law', 'medical', 'dental', 'beauty',
  'spa', 'gym', 'construction', 'automotive', 'hotel', 'retail', 'real-estate',
  'professional-services', 'general',
];

/**
 * How confident the classification is.
 *
 * `listing` means the Maps category settled it, `inferred` means site content
 * did, `fallback` means nothing did and `general` was used. A fallback is not a
 * failure — it is the honest answer for a business whose category nothing in
 * the profile establishes.
 */
export type IndustryBasis = 'listing' | 'inferred' | 'fallback';

export interface IndustryClassification {
  readonly id: Industry;
  readonly basis: IndustryBasis;
  /** The strings that matched, so a misclassification is diagnosable. */
  readonly matchedOn: readonly string[];
  readonly rationale: string;
}

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

export type ColorRole =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger';

export const COLOR_ROLES: readonly ColorRole[] = [
  'primary', 'secondary', 'accent', 'neutral', 'success', 'warning', 'danger',
];

/** Twelve steps, lightest first. See `RAMP_ROLE` in `color.ts` for the roles. */
export interface ColorRamp {
  readonly role: ColorRole;
  /** The colour the ramp was derived from, as supplied. */
  readonly seed: string;
  readonly steps: readonly string[];
}

/**
 * The colours the renderer actually reaches for.
 *
 * Ramps are the source; this is the interface. A section renderer asks for
 * `surface` or `textMuted` and never indexes into a ramp, so the ramp curve can
 * change without touching a single component.
 */
export interface SemanticColors {
  readonly canvas: string;
  readonly canvasSubtle: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly heading: string;
  readonly brand: string;
  readonly brandHover: string;
  readonly onBrand: string;
  /**
   * The brand colour as *text on the page*, not as a fill.
   *
   * A separate slot because the two uses have opposite requirements. `brand` is
   * tuned so that something can sit legibly on top of it, which puts it in the
   * middle of the lightness range — and a mid-lightness colour set as 14px type
   * on a near-white page lands around 3.4:1, under the body target, on every
   * hue. Links and eyebrows take this instead, which is the same hue pushed
   * dark enough to be read rather than merely recognised.
   */
  readonly brandText: string;
  readonly accent: string;
  readonly onAccent: string;
  readonly inverted: string;
  readonly onInverted: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
}

export interface ColorSystem {
  readonly ramps: Readonly<Record<ColorRole, ColorRamp>>;
  readonly semantic: SemanticColors;
  /** Whether the page is light-on-dark or dark-on-light overall. */
  readonly scheme: 'light' | 'dark';
  /** Measured WCAG ratios for the pairs that matter, so gates can assert them. */
  readonly contrast: {
    readonly textOnCanvas: number;
    readonly textOnSurface: number;
    readonly onBrandOnBrand: number;
    readonly mutedOnCanvas: number;
  };
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

export type FontCharacter = 'serif' | 'sans' | 'mono' | 'display';

export interface FontRole {
  /** Family name as it will be quoted in CSS, e.g. `Playfair Display`. */
  readonly family: string;
  /** The full stack including fallbacks, ready to emit. */
  readonly stack: string;
  readonly character: FontCharacter;
  /** Weights the design uses. Contrast between them is what reads as designed. */
  readonly weights: readonly number[];
}

/** One step of the type scale, expressed fluidly. */
export interface TypeStep {
  readonly name: TypeStepName;
  /** Size at the narrow viewport anchor. */
  readonly minRem: number;
  /** Size at the wide viewport anchor. */
  readonly maxRem: number;
  readonly lineHeight: number;
  /** em. Negative tightens, which large display sizes need. */
  readonly letterSpacing: number;
  readonly weight: number;
}

export type TypeStepName =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodyLarge'
  | 'small'
  | 'caption'
  | 'eyebrow';

export interface TypographySystem {
  readonly heading: FontRole;
  readonly body: FontRole;
  /** Present only when the direction calls for a technical or data face. */
  readonly mono: FontRole | null;
  /** Modular scale ratio: 1.125–1.25 subtle, 1.25–1.333 standard, 1.5+ dramatic. */
  readonly ratio: number;
  readonly baseRem: number;
  readonly scale: Readonly<Record<TypeStepName, TypeStep>>;
  /** Target line length for body copy, in characters. */
  readonly measureCh: number;
  /** Viewport anchors the fluid sizes interpolate between, in rem. */
  readonly fluidRange: { readonly minRem: number; readonly maxRem: number };
}

/* ------------------------------------------------------------------ */
/* Spacing, radius, elevation                                          */
/* ------------------------------------------------------------------ */

export type SpaceStepName =
  | '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface SpaceStep {
  readonly name: SpaceStepName;
  readonly minRem: number;
  readonly maxRem: number;
}

export interface SpacingSystem {
  readonly baseRem: number;
  readonly ratio: number;
  readonly scale: Readonly<Record<SpaceStepName, SpaceStep>>;
  /** Vertical rhythm between sections — the single biggest density signal. */
  readonly sectionMinRem: number;
  readonly sectionMaxRem: number;
}

export type RadiusStyle = 'sharp' | 'subtle' | 'soft' | 'round';

export interface RadiusSystem {
  readonly style: RadiusStyle;
  readonly none: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly pill: string;
}

export type ElevationStyle = 'flat' | 'subtle' | 'lifted' | 'dramatic';

export interface ElevationLevel {
  readonly name: 'none' | 'sm' | 'md' | 'lg';
  /** A complete `box-shadow` value, ready to emit. */
  readonly shadow: string;
}

export interface ElevationSystem {
  readonly style: ElevationStyle;
  readonly levels: Readonly<Record<ElevationLevel['name'], ElevationLevel>>;
  /**
   * Whether depth is carried by borders rather than shadows.
   *
   * Flat and editorial directions separate surfaces with a hairline; shadows on
   * those directions read as a template.
   */
  readonly prefersBorders: boolean;
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

export type AnimationLevel = 'none' | 'subtle' | 'moderate' | 'expressive';

export interface MotionSystem {
  readonly level: AnimationLevel;
  readonly durationFastMs: number;
  readonly durationBaseMs: number;
  readonly durationSlowMs: number;
  readonly easing: string;
  /** Which effects the level permits. The renderer emits nothing outside this. */
  readonly effects: readonly MotionEffect[];
  /** Always true. Present as a token so the stylesheet cannot forget it. */
  readonly respectReducedMotion: true;
}

export type MotionEffect = 'fade' | 'rise' | 'scale' | 'stagger' | 'parallax';

/* ------------------------------------------------------------------ */
/* Imagery and icons                                                   */
/* ------------------------------------------------------------------ */

export type ImageTreatment = 'natural' | 'warm' | 'cool' | 'monochrome' | 'muted';
export type ImageCrop = 'square' | 'landscape' | 'portrait' | 'wide' | 'natural';

export interface ImageStrategy {
  readonly treatment: ImageTreatment;
  readonly heroCrop: ImageCrop;
  readonly galleryCrop: ImageCrop;
  /** Radius token name applied to images. */
  readonly radius: keyof Omit<RadiusSystem, 'style'>;
  /** Scrim behind text laid over an image. `null` when text never overlays. */
  readonly overlayOpacity: number | null;
  /** What to do when the profile supplied no usable imagery. */
  readonly fallback: 'pattern' | 'gradient' | 'solid' | 'omit';
}

export type IconStyle = 'none' | 'line' | 'solid' | 'duotone';

export interface IconSystem {
  readonly style: IconStyle;
  readonly strokeWidth: number;
  readonly sizeRem: number;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export type HeroVariant =
  | 'centered'
  | 'split'
  | 'editorial'
  | 'image-first'
  | 'full-bleed'
  | 'magazine'
  | 'minimal';

export const HERO_VARIANTS: readonly HeroVariant[] = [
  'centered', 'split', 'editorial', 'image-first', 'full-bleed', 'magazine', 'minimal',
];

export type SectionVariant =
  | 'stack'
  | 'cards'
  | 'bento'
  | 'alternating'
  | 'timeline'
  | 'feature-grid'
  | 'split'
  | 'list'
  | 'masonry'
  | 'grid'
  | 'collage'
  | 'carousel'
  | 'quotes'
  | 'editorial'
  | 'slider'
  | 'banner';

export const SECTION_VARIANTS: readonly SectionVariant[] = [
  'stack', 'cards', 'bento', 'alternating', 'timeline', 'feature-grid', 'split',
  'list', 'masonry', 'grid', 'collage', 'carousel', 'quotes', 'editorial',
  'slider', 'banner',
];

/**
 * How a section's head relates to its content, spatially.
 *
 * `SectionVariant` decides how the *items* are laid out — cards, a bento, a
 * rail. This decides the envelope around them, and it is the axis that was
 * missing: eleven variants all rendered as heading-above-content-full-width, so
 * a page of six sections was six identical silhouettes stacked down the left
 * edge whatever the variants said. That repetition is the single loudest
 * "template" signal a generated page gives off, and no amount of variety inside
 * the blocks fixes it.
 *
 * - `stacked`   head above, content below at full width. The neutral case.
 * - `aside`     head in a narrow rail that sticks while the content scrolls past
 * - `centered`  head on the page's axis, content below
 * - `offset`    head indented, content starting further in and running to the edge
 * - `statement` no head/body split — one large line. For sections with almost
 *               nothing in them, which otherwise render as a title in a void.
 */
export type SectionFrame = 'stacked' | 'aside' | 'centered' | 'offset' | 'statement';

export const SECTION_FRAMES: readonly SectionFrame[] = [
  'stacked', 'aside', 'centered', 'offset', 'statement',
];

export type FooterVariant = 'minimal' | 'corporate' | 'rich';

/** How much visual weight a section pulls relative to its neighbours. */
export type Emphasis = 'lead' | 'primary' | 'secondary' | 'quiet';

/** What the section sits on. */
export type SectionBackground = 'canvas' | 'subtle' | 'surface' | 'brand' | 'inverted';

/**
 * The design decision for one content section.
 *
 * Bound to content by `index` rather than by id, because `WebsiteSection` has
 * no id and this milestone must not change it. `kind` is echoed so a renderer
 * can assert the design it was handed matches the content it is rendering
 * rather than silently applying a testimonial layout to a contact section.
 */
export interface SectionDesign {
  /** Index into `WebsiteContent.sections`. */
  readonly index: number;
  /** The kind at that index when the design was composed. */
  readonly kind: SectionKind;
  readonly variant: SectionVariant;
  /** The envelope around the variant. See `SectionFrame`. */
  readonly frame: SectionFrame;
  readonly emphasis: Emphasis;
  readonly background: SectionBackground;
  readonly density: VisualDensity;
  /** Column count at the wide anchor. `null` lets the variant decide. */
  readonly columns: number | null;
  /** Whether this section's media runs to the viewport edge. */
  readonly fullBleed: boolean;
  readonly rationale: string;
}

/**
 * The whole page plan.
 *
 * `order` is the render sequence as indices into `WebsiteContent.sections`. It
 * is how the design reorders a page without touching content — the writer's
 * output stays exactly as written, and the sequencing decision lives here where
 * it can be reviewed.
 */
export interface LayoutPlan {
  readonly hero: HeroVariant;
  readonly footer: FooterVariant;
  readonly sections: readonly SectionDesign[];
  /** Indices into `WebsiteContent.sections`, in render order. */
  readonly order: readonly number[];
  /** Whether the header sticks. Dense pages want it; short pages do not. */
  readonly stickyHeader: boolean;
  readonly showNavigation: boolean;
  readonly rationale: string;
}

/* ------------------------------------------------------------------ */
/* Responsive and accessibility                                        */
/* ------------------------------------------------------------------ */

export interface ResponsiveSystem {
  /** Content column cap. Wider reads as a template; narrower as a blog. */
  readonly containerMaxRem: number;
  /** Wide container for full-bleed and magazine treatments. */
  readonly containerWideRem: number;
  readonly breakpoints: {
    readonly smRem: number;
    readonly mdRem: number;
    readonly lgRem: number;
  };
  /** Columns collapse to this below the medium breakpoint. */
  readonly mobileColumns: number;
  /** Fluid type and space rather than stepped breakpoints. Always true. */
  readonly fluid: true;
}

export interface AccessibilityPreferences {
  readonly targetLevel: 'AA' | 'AAA';
  /** 4.5 for AA body text, 7 for AAA. Asserted against the colour system. */
  readonly minContrastBody: number;
  /** 3 for AA large text. */
  readonly minContrastLarge: number;
  readonly minTapTargetPx: number;
  readonly respectReducedMotion: true;
  readonly focusStyle: 'outline' | 'ring';
  /** Emit an explicit `lang`, skip link and landmark labels. Always true. */
  readonly semanticLandmarks: true;
}

/* ------------------------------------------------------------------ */
/* The artifact                                                        */
/* ------------------------------------------------------------------ */

export interface DesignTokens {
  readonly color: ColorSystem;
  readonly typography: TypographySystem;
  readonly spacing: SpacingSystem;
  readonly radius: RadiusSystem;
  readonly elevation: ElevationSystem;
  readonly motion: MotionSystem;
}

/**
 * A complete visual specification for one site.
 *
 * Deterministic: composed from `BusinessProfile`, `BusinessStrategy` and
 * `WebsiteContent` by pure functions, with no clock, no randomness and no
 * model call. The same three inputs always produce an identical object, which
 * is what lets it be snapshot-tested and diffed like source.
 */
export interface WebsiteDesign {
  /** Bumped when the shape changes, so a stored design can be migrated. */
  readonly version: 1;
  readonly personality: VisualPersonality;
  readonly industry: IndustryClassification;
  readonly tokens: DesignTokens;
  readonly layout: LayoutPlan;
  readonly imagery: ImageStrategy;
  readonly icons: IconSystem;
  readonly responsive: ResponsiveSystem;
  readonly accessibility: AccessibilityPreferences;
  /**
   * What the composer had to work around or could not satisfy — an unreachable
   * contrast target, a section kind with no good variant for this direction.
   *
   * Reported rather than thrown, the same way the renderer reports. A design is
   * always produced; the compromises in it are visible.
   */
  readonly notes: readonly string[];
}
