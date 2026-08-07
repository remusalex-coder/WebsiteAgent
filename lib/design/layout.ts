/**
 * Layout intelligence.
 *
 * Chooses a variant per section, an order for the page, and a background
 * rhythm across it. Everything here is a *name* from a closed set — the
 * renderer owns what `bento` or `alternating` actually looks like. That
 * separation is the whole point: this file can be reviewed as a set of design
 * judgements without reading a line of markup.
 *
 * Selection is a scored preference walk rather than a lookup table, so the
 * choice depends on what the section actually contains. A services section
 * with two bullets and no images is not the same design problem as one with
 * nine bullets and a photo for each, and giving both `cards` is how every
 * generated site ends up looking the same.
 */

import { defaultsFor, emphasisFor } from './industries.js';

import type { SectionKind, WebsiteContent, WebsiteSection } from '../types.js';
import type { ThemeDefinition } from './themes.js';
import type {
  Emphasis,
  FooterVariant,
  HeroVariant,
  Industry,
  LayoutPlan,
  SectionBackground,
  SectionDesign,
  SectionFrame,
  SectionVariant,
  VisualDensity,
} from './types.js';

/** What a section actually contains. Variant choice is a function of this. */
interface SectionShape {
  readonly bullets: number;
  readonly images: number;
  readonly bodyChars: number;
  readonly hasCta: boolean;
  readonly hasSubheading: boolean;
}

function shapeOf(section: WebsiteSection): SectionShape {
  return {
    bullets: section.bullets.length,
    // Logo and favicon belong to the page shell, not to the section's layout.
    images: section.images.filter((image) => image.role !== 'logo' && image.role !== 'favicon').length,
    bodyChars: section.body.trim().length,
    hasCta: section.callToAction !== null,
    hasSubheading: (section.subheading ?? '').trim() !== '',
  };
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

/**
 * Picks the hero.
 *
 * The theme states a preference order; content vetoes what it cannot support.
 * A split hero with no image is just a narrow column with dead space beside it,
 * so the veto matters more than the preference.
 */
export function chooseHero(
  content: WebsiteContent,
  theme: ThemeDefinition,
  imageReliance: 'essential' | 'supporting' | 'incidental',
): { variant: HeroVariant; rationale: string } {
  const hero = content.sections.find((section) => section.kind === 'hero');
  const shape = hero === undefined
    ? { bullets: 0, images: 0, bodyChars: 0, hasCta: false, hasSubheading: false }
    : shapeOf(hero);

  const needsImage: readonly HeroVariant[] = ['split', 'image-first', 'full-bleed', 'magazine'];

  for (const candidate of theme.heroPreference) {
    if (needsImage.includes(candidate) && shape.images === 0) continue;
    if (candidate === 'magazine' && shape.images < 2) continue;
    if (candidate === 'editorial' && shape.bodyChars < 80) continue;

    const why = needsImage.includes(candidate)
      ? `the ${theme.id} direction leads with imagery and the hero has ${shape.images} usable image${shape.images === 1 ? '' : 's'}`
      : `the ${theme.id} direction leads with type`;
    return { variant: candidate, rationale: `Chose the ${candidate} hero because ${why}.` };
  }

  // Nothing the theme wanted was supported. Centred works with anything.
  const fallback: HeroVariant = shape.bodyChars > 0 || shape.hasCta ? 'centered' : 'minimal';
  return {
    variant: fallback,
    rationale: imageReliance === 'essential'
      ? `Fell back to the ${fallback} hero: this industry leads with photography but the profile supplied no usable hero image.`
      : `Fell back to the ${fallback} hero: none of the ${theme.id} direction's preferred heroes were supported by the content.`,
  };
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

/** Candidate variants per kind, best first, before content and theme filtering. */
const CANDIDATES: Readonly<Record<SectionKind, readonly SectionVariant[]>> = {
  hero: ['stack'],
  about: ['split', 'editorial', 'stack'],
  services: ['bento', 'feature-grid', 'cards', 'alternating', 'list'],
  menu: ['list', 'cards', 'grid'],
  gallery: ['masonry', 'grid', 'collage', 'carousel'],
  testimonials: ['quotes', 'cards', 'editorial', 'slider'],
  hours: ['list', 'split'],
  location: ['split', 'stack'],
  // `list` first, not `cards`. A contact section rendered as cards puts each way
  // of reaching the business in a bordered grey box that reads as a disabled
  // form field; `list` routes to the contact block, where an address is set
  // large and a phone number is a link somebody can press.
  contact: ['list', 'split', 'stack'],
  cta: ['banner'],
  faq: ['list', 'editorial'],
};

/**
 * Whether a variant can carry what the section holds.
 *
 * These are the rules that stop the layout from lying about the content —
 * a bento grid needs enough heterogeneous items to fill its cells, a masonry
 * needs enough images to form columns, an alternating layout needs one image
 * per item. Failing any of them means the variant would render as an
 * embarrassing near-empty grid.
 */
function supports(variant: SectionVariant, shape: SectionShape): boolean {
  switch (variant) {
    case 'bento':
      // Below five cells a bento is a card grid pretending to be interesting.
      return shape.bullets >= 5;
    case 'feature-grid':
      return shape.bullets >= 3;
    case 'cards':
      return shape.bullets >= 2;
    case 'alternating':
      return shape.bullets >= 2 && shape.images >= shape.bullets;
    case 'timeline':
      return shape.bullets >= 3;
    case 'masonry':
      return shape.images >= 4;
    case 'collage':
      return shape.images >= 3;
    case 'grid':
      return shape.images >= 2;
    case 'carousel':
    case 'slider':
      return shape.images >= 4 || shape.bullets >= 4;
    case 'split':
      return shape.images >= 1 || shape.bodyChars >= 120;
    case 'editorial':
      return shape.bodyChars >= 160 || shape.bullets >= 2;
    case 'quotes':
      return shape.bullets >= 1;
    case 'list':
      return shape.bullets >= 1;
    case 'banner':
    case 'stack':
      return true;
  }
}

/**
 * Chooses a variant for one section.
 *
 * Order of authority: what the content can support, then what the theme
 * forbids, then what the industry prefers, then the default candidate order.
 * The industry hint is a nudge rather than a rule — it is promoted to the front
 * of the candidate list, not applied over a veto.
 */
export function chooseVariant(
  section: WebsiteSection,
  industry: Industry,
  theme: ThemeDefinition,
): { variant: SectionVariant; rationale: string } {
  const shape = shapeOf(section);
  const base = CANDIDATES[section.kind];
  const hint = defaultsFor(industry).variantHints[section.kind];

  const ordered = hint !== undefined && base.includes(hint)
    ? [hint, ...base.filter((entry) => entry !== hint)]
    : base;

  for (const candidate of ordered) {
    if (theme.avoidVariants.includes(candidate)) continue;
    if (!supports(candidate, shape)) continue;

    const why = candidate === hint
      ? `it is the ${industry} convention for a ${section.kind} section`
      : `the section has ${shape.bullets} item${shape.bullets === 1 ? '' : 's'} and ${shape.images} image${shape.images === 1 ? '' : 's'}`;
    return { variant: candidate, rationale: `Chose ${candidate} for ${section.kind}: ${why}.` };
  }

  // Every candidate was vetoed. `stack` renders anything, including nothing.
  return {
    variant: 'stack',
    rationale: `Fell back to stack for ${section.kind}: the section has too little content for any richer layout.`,
  };
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

/**
 * Kinds a statement frame must never take, however little they carry.
 *
 * A statement flattens whatever it holds into one line of prose, which is right
 * for an address and wrong for a testimonial — a single quotation is a *pull
 * quote*, the most valuable block a small business page has, and rendering it
 * as an unattributed sentence in a margin throws away the one piece of social
 * proof the writer produced. Contact is excluded for the same reason: the
 * fewer ways there are to get in touch, the more the page needs to show them.
 */
const NEVER_STATEMENT: ReadonlySet<SectionKind> = new Set(['testimonials', 'contact', 'cta', 'gallery', 'menu']);

/**
 * How much a section actually has to say.
 *
 * The threshold that separates a section worth a full head-and-body from one
 * that is a single sentence. A location section reading "40 Park Square" given
 * the same envelope as a nine-item services grid is what produces the long
 * empty bands that make a generated page feel padded rather than composed.
 */
function isThin(kind: SectionKind, shape: SectionShape): boolean {
  if (NEVER_STATEMENT.has(kind)) return false;
  return shape.bullets <= 1 && shape.images === 0 && shape.bodyChars < 150;
}

/**
 * Which frames a section could take, best first.
 *
 * Content decides eligibility and the section's kind decides taste. A CTA is
 * always centred because a banner that is not centred is not a banner; a thin
 * section is always a statement because there is nothing to frame.
 */
function frameCandidates(kind: SectionKind, shape: SectionShape, variant: SectionVariant): readonly SectionFrame[] {
  if (kind === 'cta') return ['centered'];
  if (kind === 'hero') return ['stacked'];
  if (isThin(kind, shape)) return ['statement'];

  // A variant that already builds its own two-column structure must not be put
  // inside a second one — `split` and `editorial` in an `aside` frame is a
  // narrow column inside a narrow column.
  if (variant === 'split' || variant === 'editorial' || variant === 'alternating') {
    return ['stacked', 'centered'];
  }

  // Imagery takes the full width or it is not worth showing.
  //
  // An eight-photograph gallery indented into two thirds of the container,
  // with the third the head left behind it standing empty, is a worse page
  // than the plain stack — the frames exist to vary a page's silhouette, and
  // buying variety with a hole beside the photographs is a bad trade.
  const wide: readonly SectionVariant[] = ['masonry', 'collage', 'grid', 'carousel', 'slider'];
  if (wide.includes(variant)) return ['stacked', 'centered'];

  // A bento is built out of its own unequal cells, so it needs width too, but
  // it survives an offset in a way a photograph does not.
  if (variant === 'bento') return ['stacked', 'offset'];

  return ['aside', 'offset', 'stacked', 'centered'];
}

/**
 * Assigns a frame to every section, refusing to repeat one twice running.
 *
 * The rule is the whole point. Choosing the best frame per section
 * independently gives a page where the best frame for `services`, `menu` and
 * `faq` is the same frame three times, which is exactly the silhouette
 * repetition this axis exists to break. A second-choice frame on one section is
 * a smaller cost than three identical ones.
 *
 * Deterministic: the walk is in render order and the fallback is the first
 * candidate that differs, so the same page always frames the same way.
 */
function assignFrames(
  entries: readonly { kind: SectionKind; shape: SectionShape; variant: SectionVariant }[],
): readonly SectionFrame[] {
  const out: SectionFrame[] = [];
  let previous: SectionFrame | null = null;

  for (const entry of entries) {
    const candidates = frameCandidates(entry.kind, entry.shape, entry.variant);

    // A statement frame is content-forced rather than chosen, so it is allowed
    // to repeat — two one-line sections in a row is a fact about the copy.
    const chosen = candidates.includes('statement')
      ? 'statement'
      : candidates.find((candidate) => candidate !== previous) ?? candidates[0] ?? 'stacked';

    out.push(chosen);
    previous = chosen;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rhythm                                                              */
/* ------------------------------------------------------------------ */

/**
 * Assigns backgrounds so adjacent sections separate.
 *
 * Alternating on a fixed parity produces stripes; what reads as designed is
 * changing ground only when the section beside it would otherwise look the
 * same. The CTA always inverts — it is the one section whose job is to
 * interrupt — and the hero paints its own ground.
 */
function assignBackgrounds(designs: readonly Omit<SectionDesign, 'background' | 'frame'>[]): readonly SectionBackground[] {
  const out: SectionBackground[] = [];
  let previous: SectionBackground = 'canvas';

  for (const design of designs) {
    if (design.kind === 'hero') {
      out.push('subtle');
      previous = 'subtle';
      continue;
    }
    if (design.kind === 'cta') {
      out.push('brand');
      // A brand band resets the rhythm: the section after it starts clean.
      previous = 'canvas';
      continue;
    }

    const next: SectionBackground = previous === 'canvas' ? 'subtle' : 'canvas';
    out.push(next);
    previous = next;
  }
  return out;
}

/**
 * Orders sections for the page.
 *
 * The hero leads and the CTA closes, whatever the writer emitted. Between
 * them, the industry's priority list decides — a gym's testimonials outrank its
 * hours, a law firm's do not. Sections the industry has no opinion on keep
 * their written order, which is a stable tiebreak and keeps the result
 * deterministic.
 */
export function orderSections(content: WebsiteContent, industry: Industry): readonly number[] {
  const priorities = defaultsFor(industry).prioritySections;

  const indexed = content.sections.map((section, index) => ({
    index,
    kind: section.kind,
    rank: priorities.indexOf(section.kind),
  }));

  return indexed
    .slice()
    .sort((a, b) => {
      if (a.kind === 'hero' && b.kind !== 'hero') return -1;
      if (b.kind === 'hero' && a.kind !== 'hero') return 1;
      if (a.kind === 'cta' && b.kind !== 'cta') return 1;
      if (b.kind === 'cta' && a.kind !== 'cta') return -1;

      const ra = a.rank === -1 ? priorities.length : a.rank;
      const rb = b.rank === -1 ? priorities.length : b.rank;
      if (ra !== rb) return ra - rb;

      // Stable: equal-priority sections keep the order the writer chose.
      return a.index - b.index;
    })
    .map((entry) => entry.index);
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

/** Emphasis narrows density: a quiet section is denser than a lead one. */
function densityFor(base: VisualDensity, emphasis: Emphasis): VisualDensity {
  if (emphasis === 'lead') return base === 'dense' ? 'balanced' : 'airy';
  if (emphasis === 'quiet') return base === 'airy' ? 'balanced' : 'dense';
  return base;
}

function footerFor(theme: ThemeDefinition, sectionCount: number): FooterVariant {
  // A rich footer under a three-section page looks heavier than the page.
  if (sectionCount <= 4) return 'minimal';
  return theme.footer;
}

export interface LayoutInput {
  readonly content: WebsiteContent;
  readonly industry: Industry;
  readonly theme: ThemeDefinition;
  readonly density: VisualDensity;
  readonly imageReliance: 'essential' | 'supporting' | 'incidental';
}

export function planLayout(input: LayoutInput): { plan: LayoutPlan; notes: readonly string[] } {
  const { content, industry, theme, density } = input;
  const notes: string[] = [];

  const order = orderSections(content, industry);
  const hero = chooseHero(content, theme, input.imageReliance);

  const partial = order.map((index, position) => {
    const section = content.sections[index];
    if (section === undefined) {
      return {
        index,
        kind: 'about' as SectionKind,
        variant: 'stack' as SectionVariant,
        emphasis: 'quiet' as Emphasis,
        density,
        columns: null,
        fullBleed: false,
        rationale: 'Section index out of range.',
      };
    }

    const chosen = chooseVariant(section, industry, theme);
    const emphasis = emphasisFor(industry, section.kind, position);
    const shape = shapeOf(section);

    if (chosen.variant === 'stack' && section.kind !== 'hero' && shape.bullets === 0 && shape.bodyChars === 0) {
      notes.push(`Section ${index} (${section.kind}) has no body, bullets or images and will render as a heading alone.`);
    }

    return {
      index,
      kind: section.kind,
      variant: chosen.variant,
      emphasis,
      density: densityFor(density, emphasis),
      columns: columnsFor(chosen.variant, shape),
      fullBleed: chosen.variant === 'collage' || (section.kind === 'gallery' && emphasis === 'lead'),
      rationale: chosen.rationale,
    };
  });

  const backgrounds = assignBackgrounds(partial);
  const frames = assignFrames(partial.map((design) => {
    const section = content.sections[design.index];
    return {
      kind: design.kind,
      variant: design.variant,
      shape: section === undefined
        ? { bullets: 0, images: 0, bodyChars: 0, hasCta: false, hasSubheading: false }
        : shapeOf(section),
    };
  }));

  const sections: readonly SectionDesign[] = partial.map((design, position) => ({
    ...design,
    frame: frames[position] ?? 'stacked',
    background: backgrounds[position] ?? 'canvas',
  }));

  const reordered = order.some((index, position) => index !== position);
  if (reordered) {
    notes.push(`Sections were reordered for the ${industry} category; content itself is unchanged.`);
  }

  return {
    plan: {
      hero: hero.variant,
      footer: footerFor(theme, content.sections.length),
      sections,
      order,
      // A short page has nothing to navigate back to.
      stickyHeader: content.sections.length >= 5,
      showNavigation: content.sections.length >= 4,
      rationale: hero.rationale,
    },
    notes,
  };
}

/** Column count at the wide anchor. `null` lets the variant decide. */
function columnsFor(variant: SectionVariant, shape: SectionShape): number | null {
  switch (variant) {
    case 'cards':
    case 'feature-grid':
      // Four items across three columns leaves one alone on a second row, which
      // looks like the grid ran out rather than like a decision. Two-by-two is
      // the arrangement a person would have picked.
      if (shape.bullets === 4) return 2;
      return shape.bullets >= 6 ? 3 : Math.min(shape.bullets, 3);
    case 'grid':
      return shape.images >= 6 ? 3 : 2;
    case 'masonry':
      return shape.images >= 8 ? 4 : 3;
    case 'quotes':
      return shape.bullets >= 3 ? 3 : shape.bullets;
    case 'split':
      return 2;
    default:
      return null;
  }
}
