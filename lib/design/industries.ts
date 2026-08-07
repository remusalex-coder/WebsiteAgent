/**
 * Industry intelligence.
 *
 * Two jobs: work out what kind of business this is, and say what that kind of
 * business's site usually needs.
 *
 * Classification is keyword matching over the Maps category first, then the
 * strategy's category, then services and page text — in that order, because
 * that is the order of how much each source can be trusted. It is deliberately
 * not a model call: the same profile must classify the same way every time, and
 * a wrong-but-stable classification is diagnosable in a way a wrong-and-drifting
 * one is not. `matchedOn` records what fired so a bad match can be traced to a
 * keyword rather than guessed at.
 *
 * The defaults are conventions, not laws. A law firm gets a serif-led, low-
 * density, cool-toned direction because that is what its visitors have been
 * trained by every other law firm to read as credible — and credibility is the
 * job of that site. A bakery gets warmth and imagery for the same reason in
 * reverse. Deviating from a convention is a choice a designer makes knowingly;
 * defaulting to one is how you avoid making it accidentally.
 */

import type {
  DesignDirection,
  Emphasis,
  Industry,
  SectionVariant,
  VisualDensity,
} from './types.js';
import type { SectionKind } from '../types.js';

export interface IndustryDefaults {
  readonly id: Industry;
  /** Preferred directions, most preferred first. */
  readonly directions: readonly DesignDirection[];
  readonly density: VisualDensity;
  /**
   * How much the site leans on photography.
   *
   * `essential` means the layout should hand imagery the lead and a missing
   * photo is a real gap; `incidental` means the site works as type and space.
   */
  readonly imageReliance: 'essential' | 'supporting' | 'incidental';
  /** Section kinds this industry's visitors come looking for, most important first. */
  readonly prioritySections: readonly SectionKind[];
  /** Preferred variant for a kind, where the industry has an opinion. */
  readonly variantHints: Readonly<Partial<Record<SectionKind, SectionVariant>>>;
  /**
   * OKLCH hue in degrees, used when the profile yields no brand colour.
   *
   * OKLCH, not HSL — the numbers do not transfer. Each value below was picked
   * by converting a real reference colour for the category (see the comment on
   * each entry) rather than by guessing a number, because a hue in this space
   * is not reviewable by reading it: 225° is a medical cyan here, not the navy
   * the same number names in HSL. `scripts/hue-report.ts` prints what each one
   * actually renders to, and `test/design/palette.test.ts` pins the result.
   */
  readonly fallbackHue: number;
  readonly rationale: string;
}

/**
 * Ordered classification rules. First match wins.
 *
 * Order matters where categories overlap: `dental` is tested before `medical`
 * because "dental clinic" contains "clinic", and `bakery` before `cafe` because
 * a bakery that serves coffee is still a bakery. Keeping the list ordered and
 * explicit is what makes that behaviour reviewable.
 */
interface Rule {
  readonly id: Industry;
  readonly keywords: readonly string[];
}

const RULES: readonly Rule[] = [
  { id: 'bakery', keywords: ['bakery', 'baker', 'patisserie', 'pâtisserie', 'padaria', 'boulangerie', 'cake shop', 'pastry'] },
  { id: 'dental', keywords: ['dentist', 'dental', 'orthodont', 'endodont', 'periodont'] },
  { id: 'medical', keywords: ['doctor', 'medical', 'clinic', 'physician', 'health cent', 'gp surgery', 'physiotherap', 'chiropract', 'optometr', 'veterinar', 'pharmac'] },
  { id: 'law', keywords: ['law', 'lawyer', 'attorney', 'solicitor', 'legal', 'advocate', 'notary', 'barrister'] },
  { id: 'spa', keywords: ['spa', 'massage', 'wellness', 'sauna', 'therapy cent'] },
  { id: 'beauty', keywords: ['beauty', 'salon', 'hair', 'barber', 'nail', 'cosmetic', 'aesthetic', 'lash', 'brow'] },
  { id: 'gym', keywords: ['gym', 'fitness', 'crossfit', 'pilates', 'yoga', 'martial art', 'boxing', 'personal train'] },
  { id: 'hotel', keywords: ['hotel', 'hostel', 'guest house', 'bed and breakfast', 'b&b', 'inn', 'resort', 'lodge', 'accommodation'] },
  { id: 'cafe', keywords: ['cafe', 'café', 'coffee', 'espresso', 'tea room', 'tea house'] },
  { id: 'bar', keywords: ['bar', 'pub', 'tavern', 'brewery', 'wine', 'cocktail', 'nightclub', 'taproom'] },
  { id: 'restaurant', keywords: ['restaurant', 'bistro', 'trattoria', 'pizzeria', 'diner', 'eatery', 'steakhouse', 'sushi', 'grill', 'kitchen', 'food'] },
  { id: 'construction', keywords: ['construction', 'builder', 'contractor', 'roofing', 'plumb', 'electric', 'carpent', 'renovation', 'landscap', 'hvac', 'scaffold', 'joiner'] },
  { id: 'automotive', keywords: ['auto', 'car ', 'garage', 'mechanic', 'tyre', 'tire', 'vehicle', 'motor', 'body shop', 'car wash'] },
  { id: 'real-estate', keywords: ['real estate', 'realtor', 'estate agent', 'property', 'letting', 'immobil'] },
  { id: 'retail', keywords: ['shop', 'store', 'boutique', 'retail', 'market', 'grocer', 'florist', 'bookshop', 'jewel'] },
  { id: 'professional-services', keywords: ['consult', 'account', 'agency', 'marketing', 'financial', 'insurance', 'architect', 'engineer', 'design studio', 'software', 'it services'] },
];

/**
 * The defaults.
 *
 * `directions` is a preference list rather than a single answer: the composer
 * takes the first that the brand's own evidence does not contradict, so a
 * bakery whose site copy is severe and monochrome can still land on `minimal`
 * rather than being forced into `friendly`.
 */
export const INDUSTRY_DEFAULTS: Readonly<Record<Industry, IndustryDefaults>> = {
  bakery: {
    id: 'bakery',
    directions: ['friendly', 'elegant', 'playful'],
    density: 'balanced',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'menu', 'gallery', 'hours', 'location', 'contact'],
    // `list`, not `cards`. A price set right against a leader is a four-hundred
    // year old convention and the single strongest signal that a page belongs
    // to somewhere that sells food; the same items in a card grid read as a
    // services section and throw that signal away.
    variantHints: { services: 'cards', menu: 'list', gallery: 'masonry' },
    // Honey / baked-crust gold, from #c8860d (73.6°) and #d4a017 (84.3°).
    fallbackHue: 76,
    rationale: 'Product is visual and impulse-driven; visitors want to see the food and know when it is open.',
  },
  restaurant: {
    id: 'restaurant',
    directions: ['elegant', 'editorial', 'friendly'],
    density: 'balanced',
    imageReliance: 'essential',
    prioritySections: ['hero', 'menu', 'gallery', 'hours', 'location', 'testimonials', 'contact'],
    variantHints: { menu: 'list', gallery: 'grid', testimonials: 'quotes' },
    // Brick / wine red, from #9c3b2e (30.2°) and #722f37 (15.1°). Appetite-warm
    // without tipping into the orange the bakery owns.
    fallbackHue: 28,
    rationale: 'Menu and atmosphere decide the visit; photography carries both.',
  },
  cafe: {
    id: 'cafe',
    directions: ['friendly', 'minimal', 'elegant'],
    density: 'airy',
    imageReliance: 'essential',
    prioritySections: ['hero', 'menu', 'gallery', 'hours', 'location', 'contact'],
    variantHints: { menu: 'list', gallery: 'masonry' },
    // Roasted coffee / sienna, from #6f4e37 (55.6°) and #a0522d (44.6°).
    fallbackHue: 52,
    rationale: 'Atmosphere sells more than menu detail; keep it light and photographic.',
  },
  bar: {
    id: 'bar',
    directions: ['bold', 'premium', 'creative'],
    density: 'balanced',
    imageReliance: 'essential',
    prioritySections: ['hero', 'menu', 'gallery', 'hours', 'location', 'contact'],
    variantHints: { menu: 'list', gallery: 'grid' },
    // Wine, from #7b2d43 (5.8°) and #722f37 (15.1°). Two earlier attempts are
    // worth recording: 300° rendered an electric violet that belonged to a
    // software product, and 330° — nominally plum — came out of the `bold`
    // direction's 0.22 chroma as a hot magenta. Nothing in the magenta band
    // survives that chroma at the solid step's lightness, so the wine end of
    // red is the hue that actually delivers the evening-room read.
    fallbackHue: 18,
    rationale: 'Evening trade and mood; dark grounds and strong imagery read correctly here.',
  },
  law: {
    id: 'law',
    directions: ['corporate', 'editorial', 'premium'],
    density: 'airy',
    imageReliance: 'incidental',
    prioritySections: ['hero', 'services', 'about', 'testimonials', 'contact', 'location'],
    variantHints: { services: 'list', testimonials: 'quotes', about: 'split' },
    // Navy, from #1a2b5f (267°) and #14213d (264°). Held clear of the medical
    // blue below so the two credibility categories do not converge.
    fallbackHue: 265,
    rationale: 'Credibility is the product. Restraint, generous spacing and serif authority; stock imagery actively harms trust.',
  },
  medical: {
    id: 'medical',
    directions: ['corporate', 'minimal', 'friendly'],
    density: 'balanced',
    imageReliance: 'supporting',
    prioritySections: ['hero', 'services', 'about', 'hours', 'location', 'contact', 'faq'],
    variantHints: { services: 'cards', faq: 'list' },
    // Clinical blue, from #2b6cb0 (252.3°), pushed a little cyan-ward to read
    // as clean rather than corporate. 225° rendered as a flat cyan.
    fallbackHue: 242,
    rationale: 'Clarity and reassurance. Visitors are looking for a specific service and how to book it.',
  },
  dental: {
    id: 'dental',
    directions: ['friendly', 'minimal', 'corporate'],
    density: 'balanced',
    imageReliance: 'supporting',
    prioritySections: ['hero', 'services', 'about', 'testimonials', 'hours', 'contact'],
    variantHints: { services: 'cards', testimonials: 'cards' },
    // Fresh aqua, from #00a3b4 (207.8°) — the category's own convention, and
    // deliberately not the medical blue, which reads colder than a practice
    // trying to reduce anxiety wants.
    fallbackHue: 208,
    rationale: 'Anxiety-reducing rather than clinical; warmth and testimonials do more than credentials.',
  },
  beauty: {
    id: 'beauty',
    directions: ['elegant', 'luxury', 'playful'],
    density: 'airy',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'gallery', 'testimonials', 'hours', 'contact'],
    variantHints: { services: 'list', gallery: 'masonry', testimonials: 'cards' },
    // Rose, from #d99ab0 (356.5°). Far enough from the bar's plum that the two
    // do not read as the same pink at a glance.
    fallbackHue: 352,
    rationale: 'Result is visual and personal; the portfolio and the price list are the site.',
  },
  spa: {
    id: 'spa',
    directions: ['luxury', 'elegant', 'minimal'],
    density: 'airy',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'gallery', 'about', 'hours', 'contact'],
    variantHints: { services: 'list', gallery: 'grid' },
    // Eucalyptus / sage, from #7d9b76 (139.7°) and #9caf88 (128.9°).
    fallbackHue: 142,
    rationale: 'Calm is the promise. Slow motion, wide margins, muted imagery.',
  },
  gym: {
    id: 'gym',
    directions: ['bold', 'modern', 'premium'],
    density: 'dense',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'gallery', 'testimonials', 'hours', 'cta', 'contact'],
    variantHints: { services: 'feature-grid', testimonials: 'cards', gallery: 'grid' },
    // Electric orange, from #ff5a1f (37.7°). The `bold` direction's 0.22 chroma
    // takes this most of the way to the full-strength hue, which is the point.
    // Held clear of the bar's wine, which leads with the same direction.
    fallbackHue: 42,
    rationale: 'Energy and transformation; high contrast and strong type match the category.',
  },
  construction: {
    id: 'construction',
    directions: ['corporate', 'bold', 'modern'],
    density: 'balanced',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'gallery', 'testimonials', 'about', 'contact'],
    variantHints: { services: 'cards', gallery: 'grid', testimonials: 'quotes' },
    // Hard-hat amber, from #cc7722 (59.6°) pushed toward hazard yellow. The
    // corporate direction's 150° accent shift then lands on blue, which is the
    // amber-and-blue pairing the trade already uses on its own vans.
    fallbackHue: 88,
    rationale: 'Proof of work decides the enquiry; the gallery is the portfolio and matters more than copy.',
  },
  automotive: {
    id: 'automotive',
    directions: ['modern', 'corporate', 'bold'],
    density: 'balanced',
    imageReliance: 'supporting',
    prioritySections: ['hero', 'services', 'about', 'testimonials', 'hours', 'location', 'contact'],
    variantHints: { services: 'cards', testimonials: 'cards' },
    // Steel blue, from #4682b4 (245.7°) — the workshop-signage convention.
    fallbackHue: 246,
    rationale: 'Competence and convenience. Service list and location do the work.',
  },
  hotel: {
    id: 'hotel',
    directions: ['luxury', 'elegant', 'premium'],
    density: 'airy',
    imageReliance: 'essential',
    prioritySections: ['hero', 'gallery', 'services', 'about', 'location', 'testimonials', 'contact'],
    variantHints: { gallery: 'grid', services: 'alternating', testimonials: 'quotes' },
    // Heritage petrol, from #0f5257 (202.6°) pulled green-ward. 240° made every
    // hotel a slate-blue corporate site; the deep green-teal is what the
    // category's own upscale end actually uses, and it keeps hospitality out of
    // the blue block that law, medical and automotive already occupy.
    fallbackHue: 186,
    rationale: 'The room and the view are the product; full-bleed imagery and a booking path.',
  },
  retail: {
    id: 'retail',
    directions: ['modern', 'friendly', 'minimal'],
    density: 'balanced',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'gallery', 'hours', 'location', 'contact'],
    variantHints: { services: 'cards', gallery: 'grid' },
    // Boutique violet, from #7c3aed (293°).
    fallbackHue: 298,
    rationale: 'Product-led. Grid layouts and clear opening hours.',
  },
  'real-estate': {
    id: 'real-estate',
    directions: ['premium', 'corporate', 'modern'],
    density: 'balanced',
    imageReliance: 'essential',
    prioritySections: ['hero', 'services', 'gallery', 'about', 'testimonials', 'contact'],
    variantHints: { services: 'cards', gallery: 'grid', testimonials: 'quotes' },
    // Slate indigo — past navy, so a property brand does not read as a law firm.
    fallbackHue: 283,
    rationale: 'High-value, trust-led, image-heavy. Property imagery leads and credentials follow.',
  },
  'professional-services': {
    id: 'professional-services',
    directions: ['corporate', 'modern', 'minimal'],
    density: 'balanced',
    imageReliance: 'incidental',
    prioritySections: ['hero', 'services', 'about', 'testimonials', 'cta', 'contact'],
    variantHints: { services: 'feature-grid', testimonials: 'quotes' },
    // Deep emerald, from #047857 (165.6°). The obvious choice was an indigo one
    // step from law's navy, and it was wrong: both categories lead with the
    // `corporate` direction, so the theme gives them identical type, spacing and
    // form and colour is the *only* thing left to tell a consultancy from a law
    // firm. Green is also the convention the finance end of this category
    // already uses.
    fallbackHue: 170,
    rationale: 'Expertise is intangible; structure, clarity and proof stand in for photography.',
  },
  general: {
    id: 'general',
    directions: ['friendly', 'minimal', 'modern'],
    density: 'balanced',
    imageReliance: 'supporting',
    prioritySections: ['hero', 'about', 'services', 'hours', 'location', 'contact'],
    variantHints: { services: 'cards' },
    // A plain, unloaded blue. Nothing is known about the business, so the
    // colour should assert nothing either.
    fallbackHue: 258,
    rationale: 'Nothing in the profile establishes a category; a neutral, legible default that suits any small business.',
  },
};

/** Lower-cases and collapses whitespace so matching is stable. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface ClassifyInput {
  /** Maps category — the most trustworthy signal. */
  readonly listingCategory: string | null;
  /** The analyst's category, primary and secondary. */
  readonly strategyCategories: readonly string[];
  /** Service names from the site. */
  readonly services: readonly string[];
  /** Business name — weakest signal, but "Joe's Bakery" is still a bakery. */
  readonly name: string;
}

export interface ClassifyResult {
  readonly id: Industry;
  readonly basis: 'listing' | 'inferred' | 'fallback';
  readonly matchedOn: readonly string[];
  readonly rationale: string;
}

function matchRule(haystack: string): { rule: Rule; keyword: string } | null {
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) return { rule, keyword };
    }
  }
  return null;
}

/**
 * Classifies a business, most trustworthy source first.
 *
 * Returns `general` with basis `fallback` rather than guessing when nothing
 * matches — a neutral default is honest, and a confidently wrong industry would
 * push the whole design in the wrong direction.
 */
export function classifyIndustry(input: ClassifyInput): ClassifyResult {
  const listing = input.listingCategory === null ? '' : normalise(input.listingCategory);
  if (listing !== '') {
    const hit = matchRule(listing);
    if (hit !== null) {
      return {
        id: hit.rule.id,
        basis: 'listing',
        matchedOn: [`category:${hit.keyword}`],
        rationale: `Maps lists the business as "${input.listingCategory}", which matches "${hit.keyword}".`,
      };
    }
  }

  for (const category of input.strategyCategories) {
    const hit = matchRule(normalise(category));
    if (hit !== null) {
      return {
        id: hit.rule.id,
        basis: 'inferred',
        matchedOn: [`strategy:${hit.keyword}`],
        rationale: `The strategy categorises the business as "${category}", which matches "${hit.keyword}".`,
      };
    }
  }

  // Services are noisier than a category but frequently decisive — a site
  // listing "root canal" and "teeth whitening" is a dental practice whatever
  // its listing says.
  const serviceHits: string[] = [];
  const tally = new Map<Industry, number>();
  for (const service of input.services) {
    const hit = matchRule(normalise(service));
    if (hit === null) continue;
    serviceHits.push(`service:${hit.keyword}`);
    tally.set(hit.rule.id, (tally.get(hit.rule.id) ?? 0) + 1);
  }

  if (tally.size > 0) {
    // Ties break by rule order rather than by Map order, so the result does not
    // depend on which service happened to be listed first.
    let best: Industry = 'general';
    let bestCount = 0;
    for (const rule of RULES) {
      const count = tally.get(rule.id) ?? 0;
      if (count > bestCount) {
        best = rule.id;
        bestCount = count;
      }
    }
    if (bestCount > 0) {
      return {
        id: best,
        basis: 'inferred',
        matchedOn: serviceHits,
        rationale: `${bestCount} service name${bestCount === 1 ? '' : 's'} on the site match the ${best} category.`,
      };
    }
  }

  const nameHit = matchRule(normalise(input.name));
  if (nameHit !== null) {
    return {
      id: nameHit.rule.id,
      basis: 'inferred',
      matchedOn: [`name:${nameHit.keyword}`],
      rationale: `The business name contains "${nameHit.keyword}".`,
    };
  }

  return {
    id: 'general',
    basis: 'fallback',
    matchedOn: [],
    rationale: 'Nothing in the listing, strategy, services or name identified an industry; using neutral defaults.',
  };
}

export function defaultsFor(industry: Industry): IndustryDefaults {
  return INDUSTRY_DEFAULTS[industry];
}

/**
 * Emphasis for a section kind given the industry's priorities.
 *
 * The first priority section leads, the next two are primary, the rest sit
 * secondary, and a kind the industry does not care about goes quiet. This is
 * what makes a gym's testimonials louder than a law firm's gallery.
 */
export function emphasisFor(industry: Industry, kind: SectionKind, position: number): Emphasis {
  if (position === 0) return 'lead';

  const priorities = INDUSTRY_DEFAULTS[industry].prioritySections;
  const rank = priorities.indexOf(kind);

  if (rank === -1) return 'quiet';
  if (rank <= 2) return 'primary';
  if (rank <= 4) return 'secondary';
  return 'quiet';
}
