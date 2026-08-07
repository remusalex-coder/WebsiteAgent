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
  BusinessCategory,
  BusinessProfile,
  BusinessStrategy,
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
    rating: null,
    reviewCount: null,
    navigation: [],
    services,
    pages: overrides.pages ?? [],
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
