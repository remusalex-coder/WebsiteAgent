/**
 * The design layer's public surface.
 *
 * `WebsiteContent` says what the site communicates; `WebsiteDesign` says how it
 * looks. Callers import from here and nothing deeper.
 *
 *   const design = composeDesign({ profile, strategy, content });
 *   const site = renderSite(content, { design });
 */

export { composeDesign } from './compose.js';
export { classifyIndustry, defaultsFor, emphasisFor, INDUSTRY_DEFAULTS } from './industries.js';
export { THEMES, themeFor, FALLBACK_STACKS } from './themes.js';
export { chooseHero, chooseVariant, orderSections, planLayout } from './layout.js';
export {
  buildColorSystem,
  buildElevation,
  buildMotion,
  buildRadius,
  buildSpacing,
  buildTypography,
} from './tokens.js';
export {
  RAMP_ROLE,
  RAMP_STEPS,
  buildRamp,
  clampToGamut,
  contrastHex,
  contrastRatio,
  formatHex,
  hexToOklch,
  luminance,
  oklchToHex,
  parseHex,
  readableOn,
  rgbToOklch,
} from './color.js';

export type { ComposeInput, ComposeOptions } from './compose.js';
export type { ClassifyInput, ClassifyResult, IndustryDefaults } from './industries.js';
export type { ThemeDefinition, ThemeFontChoice } from './themes.js';
export type { LayoutInput } from './layout.js';
export type { ColorInput, ColorResult } from './tokens.js';
export type { Oklch, Rgb } from './color.js';

export type {
  AccessibilityPreferences,
  AnimationLevel,
  BrandMood,
  ColorRamp,
  ColorRole,
  ColorSystem,
  ContrastLevel,
  DesignDirection,
  DesignTokens,
  ElevationSystem,
  Emphasis,
  FontRole,
  FooterVariant,
  HeroVariant,
  IconStyle,
  IconSystem,
  ImageStrategy,
  Industry,
  IndustryBasis,
  IndustryClassification,
  LayoutPlan,
  MotionEffect,
  MotionSystem,
  RadiusStyle,
  RadiusSystem,
  ResponsiveSystem,
  SectionBackground,
  SectionDesign,
  SectionVariant,
  SemanticColors,
  SpaceStepName,
  SpacingSystem,
  TypeStep,
  TypeStepName,
  TypographySystem,
  VisualDensity,
  VisualPersonality,
  WebsiteDesign,
} from './types.js';

export { COLOR_ROLES, DESIGN_DIRECTIONS, HERO_VARIANTS, INDUSTRIES, SECTION_VARIANTS } from './types.js';
