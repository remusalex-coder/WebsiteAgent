/**
 * `BusinessProfile` and `BusinessStrategy` fixtures.
 *
 * The design layer reads three inputs; `content.ts` supplies the third. These
 * two are built by helpers rather than written out in full because almost every
 * test varies one field — a category, a service list — and holding the other
 * forty constant is what makes the variation the thing under test.
 */

import type {
  Attributed,
  BusinessAttribute,
  BusinessCategory,
  BusinessProfile,
  BusinessStrategy,
  ListingReview,
  PageText,
  ServiceItem,
} from '../../lib/types.js';

const SOURCE = 'https://example.test';

function attributed<T>(value: T): Attributed<T> {
  return { value, source: 'website', sourceUrl: SOURCE, alternatives: [] };
}

export interface ProfileOverrides {
  readonly name?: string;
  readonly category?: string | null;
  readonly services?: readonly string[];
  readonly pages?: readonly PageText[];
  readonly attributes?: readonly BusinessAttribute[];
  readonly description?: string | null;
  readonly rating?: number | null;
  readonly reviewCount?: number | null;
  readonly reviews?: readonly ListingReview[];
}

/**
 * A verified review, long enough to be publishable.
 *
 * The body is padded past the source's forty-character floor deliberately: a
 * fixture that a real harvest would have rejected tests nothing about the page
 * a real harvest produces.
 */
export function reviewFixture(overrides: Partial<ListingReview> = {}): ListingReview {
  return {
    text: 'The custard tarts come out of the oven at eleven and they are worth the wait.',
    authorName: 'Marta S.',
    rating: 5,
    relativeTime: '3 weeks ago',
    publishedAt: '2026-07-18T09:12:00Z',
    sourceUrl: `${SOURCE}/review/1`,
    ...overrides,
  };
}

/** An attribute the listing states, available unless said otherwise. */
export function attributeFixture(
  label: string,
  available = true,
  group = 'Amenities',
): BusinessAttribute {
  return { group, label, available, sourceUrl: SOURCE };
}

export function profileFixture(overrides: ProfileOverrides = {}): BusinessProfile {
  const services: readonly ServiceItem[] = (overrides.services ?? []).map((name) => ({
    name,
    description: null,
    sourceUrl: SOURCE,
  }));

  const category = overrides.category === undefined ? 'Bakery' : overrides.category;

  return {
    name: attributed(overrides.name ?? 'Padaria Ana'),
    category: category === null ? null : attributed(category),
    address: null,
    coordinates: null,
    website: attributed(SOURCE),
    phones: [],
    emails: [],
    socialProfiles: [],
    hours: [],
    rating: overrides.rating === undefined || overrides.rating === null ? null : attributed(overrides.rating),
    reviewCount:
      overrides.reviewCount === undefined || overrides.reviewCount === null
        ? null
        : attributed(overrides.reviewCount),
    navigation: [],
    services,
    pages: overrides.pages ?? [],
    attributes: overrides.attributes ?? [],
    reviews: overrides.reviews ?? [],
    description:
      overrides.description === undefined || overrides.description === null
        ? null
        : attributed(overrides.description),
    images: { logo: null, favicon: null, hero: null, gallery: [] },
    validation: { ok: true, issues: [] },
    sources: [SOURCE],
    normalizedAt: '2026-08-06T00:00:00.000Z',
  };
}

export interface StrategyOverrides {
  readonly primary?: string;
  readonly secondary?: readonly string[];
}

export function strategyFixture(overrides: StrategyOverrides = {}): BusinessStrategy {
  const category: BusinessCategory = {
    primary: overrides.primary ?? 'Bakery',
    secondary: [...(overrides.secondary ?? ['Cafe'])],
    rationale: 'Listed on Maps as a bakery.',
    basis: 'listing',
  };

  return {
    businessName: 'Padaria Ana',
    category,
    goals: [],
    audience: {
      primary: {
        name: 'Local residents',
        description: 'People within walking distance.',
        needs: ['opening hours', 'what is baked today'],
        rationale: 'A bakery serves a walk-in catchment.',
      },
      secondary: [],
    },
    pages: [],
    features: [],
    backendModules: [],
    frontendModules: [],
    seoPriorities: [],
    openQuestions: [],
    model: 'test-model',
    generatedAt: '2026-08-06T00:00:00.000Z',
  };
}

/** A page whose text carries a hex colour, for brand-colour extraction tests. */
export function pageWithColor(hex: string): PageText {
  return { url: SOURCE, title: 'Home', text: `Our brand colour is ${hex} and we like it.` };
}
