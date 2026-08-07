/**
 * The composer: profile + strategy + content → `WebsiteDesign`.
 *
 * Deterministic by construction. No clock, no randomness, no model call, no
 * network, no filesystem — the same three inputs always produce a byte-
 * identical design, which is what lets the whole layer be snapshot-tested and
 * what makes a visual regression a readable diff rather than a mystery.
 *
 * The decision order is fixed and each step narrows the one after it:
 *
 *   1. industry   — what kind of business is this?
 *   2. direction  — which of the eleven themes suits it, given the evidence?
 *   3. mood       — warmth, energy, formality, from the theme and the industry
 *   4. tokens     — colour, type, space, radius, elevation, motion
 *   5. layout     — hero, variants, order, rhythm
 *
 * Nothing later feeds back into anything earlier. That is deliberate: a
 * pipeline with a feedback loop in it is one where the output depends on
 * iteration count, and iteration count is exactly the kind of thing that stops
 * being deterministic the moment somebody adds an early exit.
 */

import { classifyIndustry, defaultsFor } from './industries.js';
import { planLayout } from './layout.js';
import { themeFor } from './themes.js';
import {
  buildColorSystem,
  buildElevation,
  buildMotion,
  buildRadius,
  buildSpacing,
  buildTypography,
  shadowChannels,
} from './tokens.js';
import { RAMP_ROLE } from './color.js';

import type { BusinessProfile, BusinessStrategy, WebsiteContent } from '../types.js';
import type { ThemeDefinition } from './themes.js';
import type {
  AccessibilityPreferences,
  BrandMood,
  ContrastLevel,
  DesignDirection,
  IconSystem,
  ImageStrategy,
  Industry,
  IndustryClassification,
  ResponsiveSystem,
  VisualDensity,
  VisualPersonality,
  WebsiteDesign,
} from './types.js';

export interface ComposeInput {
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
}

export interface ComposeOptions {
  /**
   * Forces a direction, overriding inference.
   *
   * The seam an operator uses to try a business in `luxury` rather than
   * `friendly` without editing the industry table — and the seam a future
   * model-driven director would plug into, returning a direction that the rest
   * of this file composes around deterministically.
   */
  readonly direction?: DesignDirection | undefined;
  /** Raises the contrast floor from AA to AAA. */
  readonly accessibilityLevel?: 'AA' | 'AAA' | undefined;
}

/* ------------------------------------------------------------------ */
/* Direction                                                           */
/* ------------------------------------------------------------------ */

/**
 * Words in the business's own copy that argue for a direction.
 *
 * A weak signal on its own, which is why it only reorders the industry's
 * preference list rather than overriding it: a bakery whose copy says
 * "artisan" and "heritage" lands on `elegant` instead of `friendly`, but a
 * bakery whose copy says nothing still lands on a bakery-appropriate default.
 */
const DIRECTION_SIGNALS: Readonly<Record<string, readonly DesignDirection[]>> = {
  luxury: ['luxury', 'premium'],
  luxurious: ['luxury', 'premium'],
  exclusive: ['luxury', 'premium'],
  bespoke: ['luxury', 'elegant'],
  artisan: ['elegant', 'editorial'],
  artisanal: ['elegant', 'editorial'],
  handmade: ['elegant', 'friendly'],
  heritage: ['editorial', 'elegant'],
  traditional: ['editorial', 'elegant'],
  established: ['corporate', 'editorial'],
  award: ['premium', 'editorial'],
  boutique: ['elegant', 'luxury'],
  modern: ['modern', 'minimal'],
  contemporary: ['modern', 'minimal'],
  innovative: ['modern', 'creative'],
  professional: ['corporate', 'modern'],
  trusted: ['corporate', 'friendly'],
  family: ['friendly', 'playful'],
  friendly: ['friendly', 'playful'],
  fun: ['playful', 'creative'],
  vibrant: ['bold', 'playful'],
  bold: ['bold', 'creative'],
  creative: ['creative', 'bold'],
  minimal: ['minimal', 'modern'],
  simple: ['minimal', 'friendly'],
};

function copyCorpus(content: WebsiteContent, strategy: BusinessStrategy): string {
  const parts: string[] = [content.tagline, content.voice.tone, content.seo.description];
  for (const section of content.sections) {
    parts.push(section.heading, section.subheading ?? '', section.body);
  }
  parts.push(strategy.category.primary, ...strategy.category.secondary);
  return parts.join(' ').toLowerCase();
}

/**
 * Picks the direction.
 *
 * An explicit override wins; otherwise the industry's preference list is
 * reordered by whichever directions the business's own words vote for, and the
 * top of that list is taken. Votes are counted in a fixed key order so the
 * result never depends on object iteration order.
 */
function chooseDirection(
  industry: Industry,
  content: WebsiteContent,
  strategy: BusinessStrategy,
  override: DesignDirection | undefined,
): { direction: DesignDirection; rationale: string; evidence: readonly string[] } {
  const preferences = defaultsFor(industry).directions;

  if (override !== undefined) {
    return {
      direction: override,
      rationale: `Direction was set explicitly to ${override}.`,
      evidence: ['operator override'],
    };
  }

  const corpus = copyCorpus(content, strategy);
  const votes = new Map<DesignDirection, number>();
  const matched: string[] = [];

  // Sorted keys: a Map built by iterating an object literal would otherwise
  // make the tally depend on declaration order, which is a determinism trap.
  for (const word of Object.keys(DIRECTION_SIGNALS).sort()) {
    if (!corpus.includes(word)) continue;
    matched.push(word);
    const directions = DIRECTION_SIGNALS[word] ?? [];
    directions.forEach((direction, rank) => {
      votes.set(direction, (votes.get(direction) ?? 0) + (rank === 0 ? 2 : 1));
    });
  }

  // Only directions the industry already considers appropriate are eligible —
  // a law firm whose copy says "fun" still should not get the playful theme.
  const ranked = preferences
    .map((direction, index) => ({ direction, index, score: votes.get(direction) ?? 0 }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  const winner = ranked[0];
  const direction = winner?.direction ?? preferences[0] ?? 'friendly';

  const evidence: string[] = [`industry:${industry}`];
  if (matched.length > 0) evidence.push(...matched.slice(0, 6).map((word) => `copy:"${word}"`));

  const rationale = (winner?.score ?? 0) > 0
    ? `The ${industry} category prefers ${preferences.join(', ')}; the business's own copy votes for ${direction}.`
    : `The ${industry} category's first preference is ${direction}, and nothing in the copy argues for another.`;

  return { direction, rationale, evidence };
}

/* ------------------------------------------------------------------ */
/* Mood and density                                                    */
/* ------------------------------------------------------------------ */

const WARM_HUES: readonly DesignDirection[] = ['friendly', 'playful', 'elegant'];
const COOL_HUES: readonly DesignDirection[] = ['corporate', 'premium', 'minimal'];

function moodFor(direction: DesignDirection, theme: ThemeDefinition): BrandMood {
  const temperature = WARM_HUES.includes(direction)
    ? 'warm'
    : COOL_HUES.includes(direction)
      ? 'cool'
      : 'neutral';

  const energy = theme.motion === 'expressive' || direction === 'bold'
    ? 'energetic'
    : theme.motion === 'none' || theme.density === 'airy'
      ? 'calm'
      : 'steady';

  const formality = direction === 'playful' || direction === 'friendly'
    ? 'casual'
    : direction === 'corporate' || direction === 'luxury' || direction === 'premium'
      ? 'formal'
      : 'neutral';

  return { temperature, energy, formality };
}

const DENSITY_ORDER: readonly VisualDensity[] = ['airy', 'balanced', 'dense'];

/**
 * Density: the airier of what the industry expects and what the direction
 * wants, then narrowed by how much there is to show.
 *
 * Both signals have to agree before a page gets crowded, because cramped is a
 * worse failure than spacious — a gym on the `bold` direction earns `dense`,
 * but a gym on `modern` does not. Taking the minimum is also what keeps the
 * theme's own density from being decorative: without it, every bakery would
 * render at the same density whether it landed on `minimal` or `bold`.
 */
function densityFor(
  industryDensity: VisualDensity,
  themeDensity: VisualDensity,
  sectionCount: number,
): VisualDensity {
  const airier = Math.min(DENSITY_ORDER.indexOf(industryDensity), DENSITY_ORDER.indexOf(themeDensity));
  const base = DENSITY_ORDER[airier] ?? 'balanced';

  if (sectionCount <= 4 && base === 'dense') return 'balanced';
  if (sectionCount >= 10 && base === 'airy') return 'balanced';
  return base;
}

function contrastFor(theme: ThemeDefinition): ContrastLevel {
  return theme.contrast;
}

/* ------------------------------------------------------------------ */
/* Brand colour                                                        */
/* ------------------------------------------------------------------ */

const HEX_IN_TEXT = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i;

/**
 * Finds a brand colour.
 *
 * `WebsiteContent.voice.palette` is the writer's suggestion and is taken first
 * when it parses; otherwise a hex in the page text is a decent second guess
 * (many sites state their brand colour in a stylesheet URL or a meta tag the
 * collector captured). Failing both, the industry's fallback hue is used and
 * that fact is recorded — an invented brand colour is still a design decision
 * somebody should be able to see was made.
 */
function findBrandColor(content: WebsiteContent, profile: BusinessProfile): string | null {
  for (const entry of content.voice.palette) {
    const match = HEX_IN_TEXT.exec(entry.trim());
    if (match !== null && entry.trim().startsWith('#')) return match[0];
  }

  for (const page of profile.pages) {
    const match = HEX_IN_TEXT.exec(page.text);
    if (match !== null) return match[0];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Compose                                                             */
/* ------------------------------------------------------------------ */

function accessibilityFor(level: 'AA' | 'AAA'): AccessibilityPreferences {
  return {
    targetLevel: level,
    minContrastBody: level === 'AAA' ? 7 : 4.5,
    minContrastLarge: level === 'AAA' ? 4.5 : 3,
    minTapTargetPx: 44,
    respectReducedMotion: true,
    focusStyle: 'outline',
    semanticLandmarks: true,
  };
}

function imageryFor(theme: ThemeDefinition, reliance: 'essential' | 'supporting' | 'incidental'): ImageStrategy {
  return {
    treatment: theme.imageTreatment,
    heroCrop: theme.heroPreference[0] === 'full-bleed' ? 'wide' : 'landscape',
    galleryCrop: theme.id === 'editorial' || theme.id === 'creative' ? 'natural' : 'landscape',
    radius: theme.radius === 'sharp' ? 'none' : 'md',
    overlayOpacity: theme.heroPreference[0] === 'full-bleed' ? 0.45 : null,
    // A category that leads with photography should show *something* rather
    // than a hole; one that does not is better with nothing than with filler.
    fallback: reliance === 'essential' ? 'gradient' : reliance === 'supporting' ? 'solid' : 'omit',
  };
}

function iconsFor(theme: ThemeDefinition): IconSystem {
  return {
    style: theme.icons,
    strokeWidth: theme.icons === 'line' ? (theme.id === 'bold' ? 2.25 : 1.75) : 0,
    sizeRem: 1.5,
  };
}

function responsiveFor(theme: ThemeDefinition): ResponsiveSystem {
  return {
    containerMaxRem: theme.containerMaxRem,
    containerWideRem: theme.containerMaxRem + 16,
    breakpoints: { smRem: 30, mdRem: 48, lgRem: 64 },
    mobileColumns: 1,
    fluid: true,
  };
}

/**
 * Composes a design.
 *
 * Never throws on content: a thin profile, an unparseable brand colour or a
 * contrast target that cannot be met all produce a usable design with the
 * compromise recorded in `notes`. The renderer makes the same promise, and a
 * pipeline where one stage reports and the next throws is one where failures
 * surface in the wrong place.
 */
export function composeDesign(input: ComposeInput, options: ComposeOptions = {}): WebsiteDesign {
  const { profile, strategy, content } = input;
  const notes: string[] = [];

  const classification = classifyIndustry({
    listingCategory: profile.category?.value ?? null,
    strategyCategories: [strategy.category.primary, ...strategy.category.secondary],
    services: profile.services.map((service) => service.name),
    name: profile.name.value,
  });

  const industry: IndustryClassification = {
    id: classification.id,
    basis: classification.basis,
    matchedOn: classification.matchedOn,
    rationale: classification.rationale,
  };
  if (classification.basis === 'fallback') {
    notes.push('Industry could not be determined; neutral defaults were used throughout.');
  }

  const defaults = defaultsFor(industry.id);
  const chosen = chooseDirection(industry.id, content, strategy, options.direction);
  const theme = themeFor(chosen.direction);

  const density = densityFor(defaults.density, theme.density, content.sections.length);
  if (density !== defaults.density) {
    notes.push(
      `Density is ${density}: the ${industry.id} category expects ${defaults.density} and the `
      + `${chosen.direction} direction expects ${theme.density}, over ${content.sections.length} sections.`,
    );
  }

  const personality: VisualPersonality = {
    direction: chosen.direction,
    mood: moodFor(chosen.direction, theme),
    density,
    contrast: contrastFor(theme),
    rationale: chosen.rationale,
    evidence: chosen.evidence,
  };

  const accessibility = accessibilityFor(options.accessibilityLevel ?? 'AA');

  const color = buildColorSystem({
    seedHex: findBrandColor(content, profile),
    fallbackHue: defaults.fallbackHue,
    theme,
    accessibility,
  });
  notes.push(...color.notes);

  const typography = buildTypography(theme, density);
  const spacing = buildSpacing(theme, density);
  const radius = buildRadius(theme);
  const elevation = buildElevation(
    theme,
    shadowChannels(color.system.ramps.neutral.steps[RAMP_ROLE.textStrong] ?? '#000000'),
  );
  const motion = buildMotion(theme);

  const layout = planLayout({
    content,
    industry: industry.id,
    theme,
    density,
    imageReliance: defaults.imageReliance,
  });
  notes.push(...layout.notes);

  return {
    version: 1,
    personality,
    industry,
    tokens: { color: color.system, typography, spacing, radius, elevation, motion },
    layout: layout.plan,
    imagery: imageryFor(theme, defaults.imageReliance),
    icons: iconsFor(theme),
    responsive: responsiveFor(theme),
    accessibility,
    notes,
  };
}
