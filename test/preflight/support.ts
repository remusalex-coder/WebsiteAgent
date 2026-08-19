/**
 * Fixture builders for the preflight test suite.
 *
 * Rather than hand-authoring a `WebsiteDesign` — a deep, many-field type that
 * would be easy to get subtly wrong by hand — these build a real
 * `BusinessProfile`/`BusinessStrategy`/`WebsiteContent` and run them through
 * the real `composeDesign` and `renderSite`, the same functions the pipeline
 * uses. A preflight test is then exercising the same artifacts a real run
 * would produce, not a stand-in shape of them.
 */

import { composeDesign } from '../../lib/design/index.js';
import { loadConfig } from '../../lib/config.js';
import { renderSite } from '../../lib/render/index.js';
import { EMPTY_SECRET_SCAN } from '../../lib/preflight/scan.js';

import type { AppConfig } from '../../lib/config.js';
import type {
  Attributed,
  BusinessProfile,
  BusinessStrategy,
  ImageAsset,
  PageText,
  PhoneNumber,
  PostalAddress,
  WebsiteContent,
  WebsiteSection,
} from '../../lib/types.js';
import type { PreflightContext, PreflightInput } from '../../lib/preflight/types.js';
import { runProductionPreflight } from '../../lib/preflight/index.js';

const SOURCE = 'https://example.test';

function attributed<T>(value: T, sourceUrl = SOURCE): Attributed<T> {
  return { value, source: 'website', sourceUrl, alternatives: [] };
}

export interface ProfileOverrides {
  readonly name?: string;
  readonly category?: string | null;
  readonly address?: PostalAddress | null;
  readonly phones?: readonly string[];
  readonly emails?: readonly string[];
  readonly rating?: number | null;
  readonly reviewCount?: number | null;
  readonly pages?: readonly PageText[];
  readonly services?: readonly string[];
  readonly gallery?: readonly ImageAsset[];
  readonly hero?: ImageAsset | null;
}

const ADDRESS: PostalAddress = {
  formatted: '112 Rua da Prata, Lisboa',
  street: '112 Rua da Prata',
  locality: 'Lisboa',
  region: null,
  postalCode: '1100-417',
  country: 'PT',
};

function phone(formatted: string): Attributed<PhoneNumber> {
  return attributed({ formatted, e164: null, digits: formatted.replace(/\D/g, '') });
}

export function profileFixture(overrides: ProfileOverrides = {}): BusinessProfile {
  return {
    name: attributed(overrides.name ?? 'Padaria Ana'),
    category: overrides.category === undefined ? attributed('Bakery') : overrides.category === null ? null : attributed(overrides.category),
    address: overrides.address === undefined ? attributed(ADDRESS) : overrides.address === null ? null : attributed(overrides.address),
    coordinates: null,
    website: attributed(SOURCE),
    phones: (overrides.phones ?? ['+351 21 000 0000']).map(phone),
    emails: (overrides.emails ?? []).map((email) => attributed(email)),
    socialProfiles: [],
    hours: [],
    rating: overrides.rating === undefined ? null : overrides.rating === null ? null : attributed(overrides.rating),
    reviewCount: overrides.reviewCount === undefined ? null : overrides.reviewCount === null ? null : attributed(overrides.reviewCount),
    navigation: [],
    services: (overrides.services ?? []).map((name) => ({ name, description: null, sourceUrl: SOURCE })),
    pages: overrides.pages ?? [],
    images: {
      logo: null,
      favicon: null,
      hero: overrides.hero ?? null,
      gallery: overrides.gallery ?? [],
    },
    validation: { ok: true, issues: [] },
    sources: [SOURCE],
    normalizedAt: '2026-08-06T00:00:00.000Z',
  };
}

export interface StrategyOverrides {
  readonly primary?: string;
}

export function strategyFixture(overrides: StrategyOverrides = {}): BusinessStrategy {
  return {
    businessName: 'Padaria Ana',
    category: {
      primary: overrides.primary ?? 'Bakery',
      secondary: [],
      rationale: 'Listed on Maps as a bakery.',
      basis: 'listing',
    },
    goals: [],
    audience: {
      primary: {
        name: 'Local residents',
        description: 'People within walking distance.',
        needs: ['opening hours'],
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

function section(overrides: Partial<WebsiteSection> = {}): WebsiteSection {
  return {
    kind: 'about',
    heading: 'About',
    subheading: null,
    body: 'We mill our own flour.',
    bullets: [],
    images: [],
    callToAction: null,
    ...overrides,
  };
}

export interface ContentOverrides {
  readonly sections?: readonly WebsiteSection[];
  readonly title?: string;
  readonly description?: string;
  readonly structuredData?: Record<string, unknown>;
}

export function contentFixture(overrides: ContentOverrides = {}): WebsiteContent {
  const sections = overrides.sections ?? [
    section({
      kind: 'hero',
      heading: 'Bread baked before dawn',
      body: 'A neighbourhood bakery on Rua da Prata.',
      callToAction: { label: 'Call us', href: 'tel:+351210000000' },
    }),
    section({ kind: 'about', heading: 'About', body: 'Two ovens, four bakers.' }),
    section({
      kind: 'contact',
      heading: 'Contact',
      bullets: ['Address — 112 Rua da Prata, Lisboa', 'Phone — +351 21 000 0000'],
    }),
  ];

  return {
    businessName: 'Padaria Ana',
    tagline: 'Bread, coffee and nothing else',
    voice: { tone: 'warm', palette: [], typography: { heading: 'Inter', body: 'Inter' } },
    sections,
    seo: {
      title: overrides.title ?? 'Padaria Ana — bakery in Lisboa',
      description: overrides.description ?? 'Sourdough and pastel de nata on Rua da Prata, open daily.',
      keywords: ['bakery lisboa'],
      structuredData: overrides.structuredData ?? {
        '@context': 'https://schema.org',
        '@type': 'Bakery',
        name: 'Padaria Ana',
        address: { '@type': 'PostalAddress', streetAddress: '112 Rua da Prata', addressLocality: 'Lisboa' },
      },
    },
    unresolvedGaps: [],
  };
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig({}), ...overrides };
}

export interface FixtureOverrides {
  readonly profile?: ProfileOverrides;
  readonly strategy?: StrategyOverrides;
  readonly content?: ContentOverrides;
  readonly config?: Partial<AppConfig>;
}

/** Builds a full, self-consistent context by running real profile/strategy/content through the real design and render pipeline. */
export function buildContext(overrides: FixtureOverrides = {}): PreflightContext {
  const profile = profileFixture(overrides.profile);
  const strategy = strategyFixture(overrides.strategy);
  const content = contentFixture(overrides.content);
  const design = composeDesign({ profile, strategy, content });
  const site = renderSite(content, { design });
  const config = testConfig(overrides.config);

  return {
    runId: 'test-run',
    profile,
    strategy,
    content,
    design,
    site,
    config,
    html: site.files.find((f) => f.path === 'index.html')?.contents ?? '',
    css: site.files.find((f) => f.path === 'styles.css')?.contents ?? '',
    secretScan: EMPTY_SECRET_SCAN,
  };
}

export async function buildReport(overrides: FixtureOverrides = {}, outputDir: string | null = null) {
  const profile = profileFixture(overrides.profile);
  const strategy = strategyFixture(overrides.strategy);
  const content = contentFixture(overrides.content);
  const design = composeDesign({ profile, strategy, content });
  const site = renderSite(content, { design });
  const config = testConfig(overrides.config);

  const input: PreflightInput = { runId: 'test-run', profile, strategy, content, design, site, config, outputDir };
  return runProductionPreflight(input);
}

export { section };
