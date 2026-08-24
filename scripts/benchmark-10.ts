/**
 * 10-business benchmark — real production pipeline, real artifacts.
 *
 * For every business:
 *   composeBaseline(profile)          — real deterministic writer
 *   directPageCopy(profile, written, strategy)  — real content direction, real plan/experience
 *   composeDesign({profile, content}, {photographicSeed, plan})  — real deterministic design
 *   resolvePrimitives(plan.experience) — real deterministic primitive derivation (CONTROL)
 *   renderSite(content, {design, runtime, runtimePrimitives, location, siteUrl})  — real renderer
 *   real Playwright screenshot (desktop + mobile)
 *   real QA gates: accessibility, security, structured-data, performance (LCP/CLS live-measured)
 *
 * For a small sample (architecture studio, plumber, education), the same
 * business is ALSO run through the real, live Creative Director
 * (`directDesign`, one real Gemini free-tier call each, exactly-once guarded)
 * — DIRECTOR variant, clearly separate from CONTROL, never presented as if
 * it were the deterministic result.
 *
 * No business here is a real company. Coordinates are approximate city
 * centres, used only to exercise the real map feature — never claimed as a
 * real address for a real business.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { loadConfig } from '../lib/config.js';
import { resolveBudgetTier } from '../lib/capability/budget.js';
import { createConsoleSink, createFileSink, createLogger, createMultiSink } from '../lib/logger.js';
import { createPlatform } from '../lib/platform/platform.js';
import { composeBaseline } from '../agents/writerAgent.js';
import { directContent, auditContent } from '../lib/content/index.js';
import { planNarrative } from '../lib/design/plan.js';
import { composeDesign } from '../lib/design/compose.js';
import { applyDirective, directiveRuntimePrimitiveIds } from '../lib/design/directive.js';
import { NEUTRAL_ARCHITECTURE } from '../lib/design/experience.js';
import { resolvePrimitives, executablePrimitiveIds } from '../lib/design/experienceRegistry.js';
import { renderSite, writeRenderedSite } from '../lib/render/index.js';
import { directDesign } from '../agents/designDirectorAgent.js';
import { collectPreflightEvidence, gatePreflight, serveDirectory } from '../lib/qa/preflight.js';

import type { AppConfig } from '../lib/config.js';
import type { AIProvider } from '../lib/ai/types.js';
import type { Platform } from '../lib/platform/platform.js';
import type { WebsiteDesign } from '../lib/design/types.js';
import type {
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  ImageAsset,
} from '../lib/types.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');
const OUT = path.join(ROOT, 'benchmark-10');

/* ------------------------------------------------------------------ */
/* Business archetypes                                                 */
/* ------------------------------------------------------------------ */

interface Archetype {
  readonly slug: string;
  readonly label: string;
  readonly category: string;
  readonly secondary: readonly string[];
  readonly services: readonly string[];
  readonly description: string;
  readonly pageText: string;
  readonly rating: number;
  readonly reviewCount: number;
  readonly phone: string;
  readonly locality: string;
  readonly coordinates: { readonly lat: number; readonly lng: number };
  readonly attributes: readonly { readonly label: string; readonly available: boolean }[];
  readonly galleryCount: number;
  readonly galleryOrientation: 'landscape' | 'portrait' | 'square';
  readonly runLiveDirector: boolean;
}

const ARCHETYPES: readonly Archetype[] = [
  {
    slug: '01-architecture-studio',
    label: 'Premium architecture studio',
    category: 'Architecture firm',
    secondary: ['Interior design studio'],
    services: ['Residential architecture', 'Adaptive reuse', 'Interior architecture', 'Site planning'],
    description: 'A small studio designing houses and adaptive-reuse projects across the region, publishing every project as a case study.',
    pageText: [
      'We design houses that answer to their site before they answer to a brief.',
      'Every project on this page is built, not rendered — the photographs are of finished work, not proposals.',
      'The studio is four architects. We take on six to eight projects a year, each one seen through from first sketch to the final walkthrough.',
    ].join(' '),
    rating: 4.9,
    reviewCount: 38,
    phone: '+351 21 555 0101',
    locality: 'Lisboa',
    coordinates: { lat: 38.7223, lng: -9.1393 },
    attributes: [{ label: 'By appointment only', available: true }, { label: 'Wheelchair accessible entrance', available: true }],
    galleryCount: 6,
    galleryOrientation: 'landscape',
    runLiveDirector: true,
  },
  {
    slug: '02-artisan-bakery',
    label: 'Artisan bakery',
    category: 'Bakery',
    secondary: ['Cafe'],
    services: ['Sourdough', 'Viennoiserie', 'Celebration cakes', 'Coffee'],
    description: 'A neighbourhood bakery milling its own flour and baking through the night, everything sold the day it is made.',
    pageText: [
      'Bread baked before dawn, sold the same day it is made.',
      'We mill our own flour on-site and bake through the night — two ovens, four bakers, one long counter.',
      'Regulars know to come before nine for the sourdough; by noon it is usually gone.',
    ].join(' '),
    rating: 4.8,
    reviewCount: 412,
    phone: '+351 22 555 0202',
    locality: 'Porto',
    coordinates: { lat: 41.1579, lng: -8.6291 },
    attributes: [{ label: 'Wheelchair accessible entrance', available: true }, { label: 'Vegan options', available: true }],
    galleryCount: 4,
    galleryOrientation: 'square',
    runLiveDirector: false,
  },
  {
    slug: '03-high-end-restaurant',
    label: 'High-end restaurant',
    category: 'Restaurant',
    secondary: ['Fine dining restaurant'],
    services: ['Tasting menu', 'Wine pairing', 'Private dining room'],
    description: 'A twelve-table restaurant built around a single nightly tasting menu, sourced from a short list of named growers and fishers.',
    pageText: [
      'One tasting menu a night, twelve tables, no à la carte.',
      'Every ingredient on the menu is attributed to the farm or boat it came from — we name the grower, not just the vegetable.',
      'The room seats twenty-eight. Reservations open six weeks ahead and the Friday sitting is usually the first to go.',
    ].join(' '),
    rating: 4.9,
    reviewCount: 205,
    phone: '+33 1 55 55 03 03',
    locality: 'Paris',
    coordinates: { lat: 48.8566, lng: 2.3522 },
    attributes: [{ label: 'Reservations required', available: true }, { label: 'Wheelchair accessible entrance', available: true }],
    galleryCount: 5,
    galleryOrientation: 'landscape',
    runLiveDirector: false,
  },
  {
    slug: '04-local-plumber',
    label: 'Local plumber',
    category: 'Plumber',
    secondary: ['Emergency plumbing service'],
    services: ['Emergency call-outs', 'Boiler repair', 'Leak detection', 'Bathroom fitting'],
    description: 'A two-van plumbing business covering emergency call-outs across the borough, on call every day of the year.',
    pageText: [
      'Same-day call-outs, every day of the year, no exceptions.',
      'Two vans, fully stocked — most leaks and boiler faults are fixed on the first visit.',
      'Call the number on this page directly; there is no booking form, because a burst pipe does not wait for one.',
    ].join(' '),
    rating: 4.7,
    reviewCount: 156,
    phone: '+44 20 7946 0404',
    locality: 'London',
    coordinates: { lat: 51.5074, lng: -0.1278 },
    attributes: [{ label: 'Emergency service', available: true }, { label: 'Licensed and insured', available: true }],
    galleryCount: 0,
    galleryOrientation: 'landscape',
    runLiveDirector: true,
  },
  {
    slug: '05-technology-company',
    label: 'Technology company',
    category: 'Software company',
    secondary: ['IT service'],
    services: ['Inventory platform', 'API integrations', 'Onboarding', 'Support'],
    description: 'A small software company building inventory-management tools for independent retailers, currently serving around three hundred stores.',
    pageText: [
      'Inventory software built for independent retailers, not chains.',
      'The platform syncs stock across a till, a website and a marketplace listing in one pass — no spreadsheet reconciliation.',
      'Around three hundred stores use it today. Support is a real phone number, answered by someone who can read the database.',
    ].join(' '),
    rating: 4.6,
    reviewCount: 61,
    phone: '+49 30 5550 0505',
    locality: 'Berlin',
    coordinates: { lat: 52.5200, lng: 13.4050 },
    attributes: [{ label: 'Free trial', available: true }, { label: 'API access', available: true }],
    galleryCount: 0,
    galleryOrientation: 'landscape',
    runLiveDirector: false,
  },
  {
    slug: '06-fashion-brand',
    label: 'Fashion / luxury brand',
    category: 'Clothing store',
    secondary: ['Fashion designer'],
    services: ['Made-to-measure', 'Ready-to-wear', 'Alterations'],
    description: 'An atelier producing a single small ready-to-wear collection each season alongside made-to-measure commissions.',
    pageText: [
      'Two collections a year, made in the workshop above the shop floor.',
      'Every ready-to-wear piece is numbered; the made-to-measure book is fitted in three sessions, start to finish.',
      'The current collection is shown by appointment through the end of the season.',
    ].join(' '),
    rating: 4.8,
    reviewCount: 74,
    phone: '+39 02 5550 0606',
    locality: 'Milano',
    coordinates: { lat: 45.4642, lng: 9.1900 },
    attributes: [{ label: 'By appointment only', available: true }, { label: 'Made to measure', available: true }],
    galleryCount: 6,
    galleryOrientation: 'portrait',
    runLiveDirector: false,
  },
  {
    slug: '07-boutique-hotel',
    label: 'Boutique hotel',
    category: 'Hotel',
    secondary: ['Bed and breakfast'],
    services: ['Rooms', 'Breakfast', 'Rooftop terrace', 'Airport transfer'],
    description: 'A fourteen-room hotel in a converted townhouse, each room different, with a rooftop terrace open to guests through the evening.',
    pageText: [
      'Fourteen rooms, no two the same, in a townhouse that has stood here since the 1890s.',
      'Breakfast is on the terrace when the weather allows it, and most mornings it does.',
      'The rooftop stays open to guests until midnight — it is the reason half our return guests come back.',
    ].join(' '),
    rating: 4.9,
    reviewCount: 318,
    phone: '+34 93 555 0707',
    locality: 'Barcelona',
    coordinates: { lat: 41.3851, lng: 2.1734 },
    attributes: [{ label: 'Free WiFi', available: true }, { label: 'Airport transfer', available: true }],
    galleryCount: 6,
    galleryOrientation: 'landscape',
    runLiveDirector: false,
  },
  {
    slug: '08-creative-agency',
    label: 'Creative agency',
    category: 'Marketing agency',
    secondary: ['Graphic design studio'],
    services: ['Brand identity', 'Campaign design', 'Motion', 'Web design'],
    description: 'A ten-person studio working on brand identity and campaign work for independent retail and hospitality clients.',
    pageText: [
      'Brand and campaign work for independent retail and hospitality clients.',
      'Ten people, one studio floor, no account layer between the client and the person doing the work.',
      'Every project on this page shipped — nothing here is a pitch deck that never ran.',
    ].join(' '),
    rating: 4.7,
    reviewCount: 29,
    phone: '+31 20 555 0808',
    locality: 'Amsterdam',
    coordinates: { lat: 52.3676, lng: 4.9041 },
    attributes: [{ label: 'Portfolio available on request', available: true }],
    galleryCount: 5,
    galleryOrientation: 'landscape',
    runLiveDirector: false,
  },
  {
    slug: '09-medical-dental',
    label: 'Medical / dental practice',
    category: 'Dental clinic',
    secondary: ['Dentist'],
    services: ['Check-ups', 'Cleaning', 'Fillings', 'Emergency appointments'],
    description: 'A four-dentist practice taking new NHS and private patients, with same-week emergency appointments.',
    pageText: [
      'Four dentists, taking new NHS and private patients.',
      'Same-week emergency appointments are held open every day for genuine dental pain.',
      'The practice has been on this street for over twenty years; most patients are referred by another patient.',
    ].join(' '),
    rating: 4.8,
    reviewCount: 240,
    phone: '+43 1 555 0909',
    locality: 'Wien',
    coordinates: { lat: 48.2082, lng: 16.3738 },
    attributes: [{ label: 'Wheelchair accessible entrance', available: true }, { label: 'Accepts new patients', available: true }],
    galleryCount: 2,
    galleryOrientation: 'landscape',
    runLiveDirector: false,
  },
  {
    slug: '10-education-platform',
    label: 'Education / knowledge platform',
    category: 'Tutoring service',
    secondary: ['Educational institution'],
    services: ['One-to-one tutoring', 'Exam preparation', 'Study groups', 'Online sessions'],
    description: 'A tutoring collective covering secondary-school maths and sciences, both in person and online, with fifteen tutors.',
    pageText: [
      'Secondary-school maths and sciences, one-to-one or in small groups.',
      'Fifteen tutors, all subject specialists, matched to a student after a short first conversation, not an algorithm.',
      'Sessions run in person or online; exam-season groups fill first, usually by February.',
    ].join(' '),
    rating: 4.9,
    reviewCount: 187,
    phone: '+353 1 555 1010',
    locality: 'Dublin',
    coordinates: { lat: 53.3498, lng: -6.2603 },
    attributes: [{ label: 'Online sessions available', available: true }, { label: 'Free introductory call', available: true }],
    galleryCount: 1,
    galleryOrientation: 'landscape',
    runLiveDirector: true,
  },
];

/* ------------------------------------------------------------------ */
/* Fixture construction                                                */
/* ------------------------------------------------------------------ */

const SITE = 'https://example.test';

function attributed<T>(value: T): { value: T; source: 'website'; sourceUrl: string; alternatives: readonly never[] } {
  return { value, source: 'website', sourceUrl: SITE, alternatives: [] };
}

function svgAsset(role: ImageAsset['role'], name: string, width: number, height: number, alt: string): ImageAsset {
  return {
    url: `${SITE}/${name}`,
    role,
    alt,
    width,
    height,
    localPath: `assets/${name}`,
    bytes: null,
    sourceUrl: SITE,
  };
}

function buildProfile(a: Archetype): BusinessProfile {
  const [galleryW, galleryH] = a.galleryOrientation === 'portrait' ? [900, 1200] : a.galleryOrientation === 'square' ? [1000, 1000] : [1600, 1000];
  const logo = svgAsset('logo', 'logo.svg', 240, 240, `${a.label} logo`);
  const favicon = svgAsset('favicon', 'favicon.svg', 64, 64, '');
  const hero = a.galleryCount > 0 ? svgAsset('hero', 'hero.svg', 1600, 900, `${a.label} — hero photograph`) : null;
  const gallery: readonly ImageAsset[] = Array.from({ length: a.galleryCount }, (_unused, i) =>
    svgAsset('gallery', `gallery-${i + 1}.svg`, galleryW, galleryH, `${a.label} — photograph ${i + 1}`));

  return {
    name: attributed(a.label.replace(/ \/ /g, ' / ')),
    category: attributed(a.category),
    address: attributed({
      formatted: `${a.locality} (illustrative address — not a real listing)`,
      street: null,
      locality: a.locality,
      region: null,
      postalCode: null,
      country: null,
    }),
    coordinates: attributed(a.coordinates),
    website: attributed(SITE),
    phones: [attributed({ formatted: a.phone, e164: a.phone.replace(/[^\d+]/g, ''), digits: a.phone.replace(/\D/g, '') })],
    emails: [],
    socialProfiles: [],
    hours: [],
    rating: attributed(a.rating),
    reviewCount: attributed(a.reviewCount),
    navigation: [],
    services: a.services.map((name) => ({ name, description: null, sourceUrl: SITE })),
    pages: [{ url: SITE, title: a.label, text: a.pageText }],
    attributes: a.attributes.map((attr) => ({ group: 'Amenities', label: attr.label, available: attr.available, sourceUrl: SITE })),
    reviews: [],
    description: attributed(a.description),
    images: { logo, favicon, hero, gallery },
    validation: { ok: true, issues: [] },
    sources: [SITE],
    normalizedAt: '2026-08-19T00:00:00.000Z',
  };
}

function buildStrategy(a: Archetype): BusinessStrategy {
  return {
    businessName: a.label,
    category: { primary: a.category, secondary: [...a.secondary], rationale: `Listed as ${a.category}.`, basis: 'listing' },
    goals: [],
    audience: {
      primary: { name: 'Local customers', description: 'People searching for this business locally.', needs: ['what they offer', 'how to reach them'], rationale: 'A local business serves a local catchment.' },
      secondary: [],
    },
    pages: [],
    features: [],
    backendModules: [],
    frontendModules: [],
    seoPriorities: [],
    openQuestions: [],
    model: 'benchmark-fixture',
    generatedAt: '2026-08-19T00:00:00.000Z',
  };
}

/* ------------------------------------------------------------------ */
/* Placeholders + screenshots                                          */
/* ------------------------------------------------------------------ */

function placeholderSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="presentation">`
    + `<rect width="${width}" height="${height}" fill="#d8d5d0"/>`
    + `<rect y="${Math.round(height * 0.58)}" width="${width}" height="${Math.round(height * 0.42)}" fill="#c2beb8"/>`
    + `<circle cx="${Math.round(width * 0.28)}" cy="${Math.round(height * 0.4)}" r="${Math.round(height * 0.14)}" fill="#a29c94"/>`
    + '</svg>\n';
}

async function writePlaceholders(dir: string, assets: readonly ImageAsset[]): Promise<void> {
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await Promise.all(assets.filter((a) => a.localPath !== null).map(async (a) => {
    await fs.writeFile(path.join(dir, a.localPath!), placeholderSvg(a.width ?? 1200, a.height ?? 900), 'utf8');
  }));
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

/**
 * Screenshots at both viewports.
 *
 * Deliberately NOT `page.screenshot({ fullPage: true })` — that option
 * re-triggers a resize internally at capture time, which re-runs the
 * browser's lazy-load/IntersectionObserver heuristics a second time and
 * (for any page with `scroll-reveal`/`text-reveal` engaged) leaves every
 * section's `--forge-vis` reading near-zero, rendering as a wall of
 * near-invisible content below the fold — exactly the failure mode
 * `lib/runtime/scroll-progress.ts`'s own doc comment names ("the gate
 * scored such a page 99/PASS"). The fix, proven in
 * `scripts/design-director-smoke.ts`'s `inspectVariant`: resize the
 * viewport itself to the document's real height, THEN take a plain
 * (non-fullPage) screenshot — no second resize happens at capture time.
 * The first attempt at this script used `fullPage: true` anyway and
 * produced visibly broken screenshots for every scroll-reveal business —
 * caught only by actually looking at the images, not by any test or gate.
 */
async function screenshotVariant(dir: string): Promise<Record<string, number>> {
  const shotDir = path.join(dir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });
  // A second, deeper bug found on top of the fullPage one: `file://` blocks
  // runtime.js (a <script type="module">, refused cross-origin, and every
  // file:// resource is origin "null"), so --forge-vis never leaves its
  // stylesheet base value of 0 and every scroll-reveal/text-reveal section
  // screenshots near-invisible — confirmed directly (getComputedStyle read
  // '0' even after a real scroll gesture on a file:// page). Not a renderer
  // bug, does not affect a real deployed (real-HTTP) visitor — purely a
  // capture-tooling gap, fixed by reusing lib/qa/preflight.ts's
  // serveDirectory rather than re-introducing the same file:// gap here.
  const server = await serveDirectory(dir);
  const browser = await chromium.launch({ headless: true });
  const bytes: Record<string, number> = {};
  try {
    for (const { name, width, height } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(server.url, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(fullHeight, 20_000) });
      // A real scroll gesture too, so --forge-vis updates through the
      // runtime's own scroll listener exactly as it would for a real
      // visitor — belt-and-suspenders alongside the resize listener.
      await page.mouse.wheel(0, fullHeight);
      await page.waitForTimeout(400);
      const shot = path.join(shotDir, `${name}.png`);
      await page.screenshot({ path: shot });
      const stat = await fs.stat(shot);
      bytes[name] = stat.size;
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return bytes;
}

/* ------------------------------------------------------------------ */
/* One business, CONTROL variant (deterministic, no live AI)           */
/* ------------------------------------------------------------------ */

async function runControl(a: Archetype, logger: ReturnType<typeof createLogger>) {
  const profile = buildProfile(a);
  const strategy = buildStrategy(a);
  const dir = path.join(OUT, a.slug, 'control');
  await fs.mkdir(dir, { recursive: true });

  const written = composeBaseline(profile);
  const plan = planNarrative(profile, written, { categories: [strategy.category.primary, ...strategy.category.secondary] });
  const directed = directContent(profile, written, plan);
  const audit = auditContent({
    content: directed.content,
    evidence: directed.evidence,
    roles: plan.roles,
    conversion: plan.conversion,
  });
  const content = directed.content;

  const design = composeDesign({ profile, strategy, content });
  const resolved = resolvePrimitives(plan.experience); // deterministic derivation only — no live AI
  const runtimeEngaged = resolved.length > 0;

  const site = renderSite(content, {
    design,
    ...(runtimeEngaged ? { runtime: 'scroll-progress' as const, runtimePrimitives: resolved } : {}),
    location: a.coordinates,
    siteUrl: `https://${a.slug}.benchmark.example`,
  });

  await writePlaceholders(dir, [profile.images.logo, profile.images.favicon, profile.images.hero, ...profile.images.gallery].filter((x): x is ImageAsset => x !== null));
  const { missingAssets } = await writeRenderedSite(site, { sourceDir: dir, targetDir: dir });

  const shotBytes = await screenshotVariant(dir);
  const evidence = await collectPreflightEvidence({ siteDir: dir, logger });
  const verdict = gatePreflight(evidence);

  return {
    slug: a.slug, label: a.label, variant: 'control' as const,
    experienceMode: plan.experience.mode,
    experienceTransition: plan.experience.transition,
    character: { visualWeight: plan.character.visualWeight, register: plan.character.emotionalRegister, narrative: plan.character.narrativePotential },
    resolvedPrimitives: resolved,
    hero: design.layout.hero,
    industry: design.industry.id,
    files: site.files.map((f) => f.path),
    hasMap: site.files.find((f) => f.path === 'index.html')?.contents.includes('<iframe') ?? false,
    missingAssets,
    rendererWarnings: site.warnings,
    contentAudit: { score: audit.score, specificity: audit.specificity, issueCount: audit.issues.length },
    qa: {
      technicalPassed: verdict.technical.passed,
      technicalFailures: verdict.technical.checks.filter((c) => !c.passed).map((c) => c.id),
      accessibilityPassed: verdict.accessibility.passed,
      accessibilityFailures: verdict.accessibility.checks.filter((c) => !c.passed).map((c) => c.id),
      structuredDataValid: verdict.structuredData.valid,
      structuredDataIssues: verdict.structuredData.issues,
      performanceCaveats: verdict.performance.caveats.map((c) => c.detail),
      lcpMs: evidence.performance.lcpMs ?? null,
      cls: evidence.performance.cls ?? null,
      pageBytes: evidence.performance.pageBytes,
    },
    screenshotBytes: shotBytes,
    dir: path.relative(ROOT, dir).replace(/\\/g, '/'),
  };
}

/* ------------------------------------------------------------------ */
/* One business, DIRECTOR variant (real, live, one AI call)            */
/* ------------------------------------------------------------------ */

function oneCallOnly(provider: AIProvider, onCall: () => void): AIProvider {
  let calls = 0;
  return {
    ...provider,
    async generate(request) {
      calls += 1;
      if (calls > 1) throw new Error(`benchmark attempted a second AI call for this business; exactly one is allowed.`);
      onCall();
      return provider.generate(request);
    },
  };
}

async function runDirector(a: Archetype, config: AppConfig, platform: Platform, logger: ReturnType<typeof createLogger>) {
  const profile = buildProfile(a);
  const strategy = buildStrategy(a);
  const dir = path.join(OUT, a.slug, 'director');
  await fs.mkdir(dir, { recursive: true });

  const written = composeBaseline(profile);
  const plan = planNarrative(profile, written, { categories: [strategy.category.primary, ...strategy.category.secondary] });
  const directed = directContent(profile, written, plan);
  const content = directed.content;

  let aiCalls = 0;
  const guarded = oneCallOnly(platform.ai(), () => { aiCalls += 1; });
  const directorPlatform: Platform = { ...platform, ai: () => guarded, tryAi: () => guarded };
  const ctx: AgentContext = {
    runId: `benchmark-${a.slug}`,
    config,
    logger: logger.child(`director.${a.slug}`),
    getBrowser: () => { throw new Error('the design director does not use a browser'); },
    platform: directorPlatform,
    outputDir: dir,
    signal: new AbortController().signal,
  };

  const result = await directDesign({ profile, strategy, content }, ctx);
  await fs.writeFile(path.join(dir, 'directive.json'), JSON.stringify(result.directive, null, 2));
  await fs.writeFile(path.join(dir, 'provenance.json'), JSON.stringify(result.provenance, null, 2));

  const options = applyDirective(result.directive, {}, ctx.logger);
  const design = composeDesign({ profile, strategy, content }, options);
  const requestedIds = directiveRuntimePrimitiveIds(result.directive, ctx.logger);
  const resolved = resolvePrimitives(NEUTRAL_ARCHITECTURE, requestedIds);
  const runtimeEngaged = resolved.length > 0;

  const site = renderSite(content, {
    design,
    ...(runtimeEngaged ? { runtime: 'scroll-progress' as const, runtimePrimitives: resolved } : {}),
    location: a.coordinates,
    siteUrl: `https://${a.slug}.benchmark.example`,
  });

  await writePlaceholders(dir, [profile.images.logo, profile.images.favicon, profile.images.hero, ...profile.images.gallery].filter((x): x is ImageAsset => x !== null));
  const { missingAssets } = await writeRenderedSite(site, { sourceDir: dir, targetDir: dir });
  const shotBytes = await screenshotVariant(dir);
  const evidence = await collectPreflightEvidence({ siteDir: dir, logger });
  const verdict = gatePreflight(evidence);

  return {
    slug: a.slug, label: a.label, variant: 'director' as const,
    aiCalls,
    provenance: { provider: result.provenance.provider, model: result.provenance.model, inputTokens: result.provenance.inputTokens, outputTokens: result.provenance.outputTokens },
    directive: {
      direction: result.directive.direction,
      experienceMode: result.directive.experienceMode,
      conversionStrategy: result.directive.conversionStrategy,
      requestedRuntimePrimitives: (result.directive.runtimePrimitives ?? []).map((r) => ({ id: r.id, reason: r.reason })),
      creativeThesis: result.directive.creativeThesis,
      rationale: result.directive.rationale,
    },
    resolvedPrimitives: resolved,
    hero: design.layout.hero,
    industry: design.industry.id,
    hasMap: site.files.find((f) => f.path === 'index.html')?.contents.includes('<iframe') ?? false,
    missingAssets,
    qa: {
      technicalPassed: verdict.technical.passed,
      accessibilityPassed: verdict.accessibility.passed,
      structuredDataValid: verdict.structuredData.valid,
      lcpMs: evidence.performance.lcpMs ?? null,
      cls: evidence.performance.cls ?? null,
    },
    screenshotBytes: shotBytes,
    dir: path.relative(ROOT, dir).replace(/\\/g, '/'),
  };
}

/* ------------------------------------------------------------------ */
/* One business, ENHANCE variant (real, live, full Forge pipeline)     */
/* ------------------------------------------------------------------ */

/**
 * Exercises the same ship/fallback decision `main.ts`'s `'enhance'` pipeline
 * step uses (`lib/forge/decide.ts:shouldShipEnhancedSite`), so this benchmark
 * can no longer silently diverge from what the real default pipeline does —
 * the exact gap that let CONTROL/DIRECTOR alone stand in for "the
 * architecture studio benchmark" while never once exercising
 * `lib/forge/orchestrator.ts`, which is the bug this variant fixes.
 *
 * Reuses this benchmark's own already-built `profile` rather than
 * re-fetching or re-crawling anything: Forge's grounding stage ingests a
 * passed-in `profile` directly (`lib/forge/orchestrator.ts`'s branch when
 * `options.profile` is set).
 *
 * Real spend, real live calls — this is `€0`-policy-crossing on purpose,
 * exactly like DIRECTOR above, and must only be run deliberately (never from
 * `npm test`, never unattended) with a founder-approved budget exception.
 */
async function runEnhance(a: Archetype, baseConfig: AppConfig, logger: ReturnType<typeof createLogger>) {
  const profile = buildProfile(a);

  // Forge needs a real, non-`tier0` budget to do anything — the shared
  // `platform` DIRECTOR uses is deliberately `tier0` (DIRECTOR calls the raw
  // provider directly via `platform.ai()`, bypassing the capability
  // orchestrator's budget check, and stays €0 on Gemini's free tier). Forge's
  // stages all route through `routing.capabilities.run(...)`, which DOES
  // enforce the policy, so enhance gets its own orchestrator, scoped
  // explicitly, rather than silently inheriting a €0 one it would just fail
  // under.
  const enhanceConfig: AppConfig = { ...baseConfig, outputDir: OUT, budgetTier: 'tier1' };
  const enhancePlatform = await createPlatform({
    config: enhanceConfig,
    logger,
    signal: new AbortController().signal,
    outputDir: OUT,
    capabilityPolicy: resolveBudgetTier('tier1'),
  });

  try {
    const { runExperienceForge } = await import('../lib/forge/orchestrator.js');
    const { shouldShipEnhancedSite } = await import('../lib/forge/decide.js');

    const forgeResult = await runExperienceForge({
      runId: `${a.slug}/enhance`,
      outputDir: OUT,
      profile,
      autoOpen: false,
      routing: { capabilities: enhancePlatform.capabilities, providers: enhancePlatform.providers },
    });

    const shipped = shouldShipEnhancedSite(forgeResult.finalVerdict);
    return {
      slug: a.slug, label: a.label, variant: 'enhance' as const,
      attempted: true,
      shipped,
      territoryId: forgeResult.signature.selectedTerritoryId,
      selectionRationale: forgeResult.signature.selectionRationale,
      verdict: forgeResult.finalVerdict.verdict,
      blockingFailure: forgeResult.finalVerdict.blockingFailure,
      quality: forgeResult.finalVerdict.quality,
      iterations: forgeResult.iterations,
      dir: path.relative(ROOT, forgeResult.siteDir).replace(/\\/g, '/'),
    };
  } catch (err) {
    console.error(`  ENHANCE call failed for ${a.label}:`, err instanceof Error ? err.message : String(err));
    return {
      slug: a.slug, label: a.label, variant: 'enhance' as const,
      attempted: true,
      shipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await enhancePlatform.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  await fs.mkdir(OUT, { recursive: true });
  const sink = createMultiSink(createConsoleSink(), createFileSink(path.join(OUT, 'run.log')));
  const logger = createLogger({ level: 'warn', scope: 'benchmark10', sink });

  console.log(`registry has ${executablePrimitiveIds().length} executable primitives: ${executablePrimitiveIds().join(', ')}`);

  const controlResults = [];
  for (const a of ARCHETYPES) {
    console.log(`\n=== CONTROL: ${a.label} ===`);
    const result = await runControl(a, logger);
    controlResults.push(result);
    await fs.writeFile(path.join(OUT, a.slug, 'control-summary.json'), JSON.stringify(result, null, 2));
    console.log(`  experience: ${result.experienceMode}/${result.experienceTransition}  primitives: [${result.resolvedPrimitives.join(', ')}]  map: ${result.hasMap}  a11y:${result.qa.accessibilityPassed} sec:${result.qa.technicalPassed} sd:${result.qa.structuredDataValid} lcp:${result.qa.lcpMs}ms cls:${result.qa.cls}`);
  }

  const liveTargets = ARCHETYPES.filter((a) => a.runLiveDirector);
  const directorResults = [];
  const enhanceResults = [];
  if (liveTargets.length > 0) {
    const base = loadConfig();
    const config: AppConfig = { ...base, outputDir: OUT, ai: { ...base.ai, maxRetries: 0 }, director: { ...base.director, enabled: true } };
    const platform = await createPlatform({ config, logger, signal: new AbortController().signal, outputDir: OUT });
    for (const a of liveTargets) {
      console.log(`\n=== DIRECTOR (live AI): ${a.label} ===`);
      try {
        const result = await runDirector(a, config, platform, logger);
        directorResults.push(result);
        await fs.writeFile(path.join(OUT, a.slug, 'director-summary.json'), JSON.stringify(result, null, 2));
        console.log(`  provider:${result.provenance.provider} model:${result.provenance.model}  requested:[${result.directive.requestedRuntimePrimitives.map((r) => r.id).join(', ')}]  resolved:[${result.resolvedPrimitives.join(', ')}]  map:${result.hasMap}`);
      } catch (err) {
        console.error(`  DIRECTOR call failed for ${a.label}:`, err instanceof Error ? err.message : String(err));
        directorResults.push({ slug: a.slug, label: a.label, variant: 'director' as const, error: err instanceof Error ? err.message : String(err) });
      }

      console.log(`\n=== ENHANCE (live AI, full Forge pipeline): ${a.label} ===`);
      const enhanceResult = await runEnhance(a, config, logger);
      enhanceResults.push(enhanceResult);
      await fs.writeFile(path.join(OUT, a.slug, 'enhance-summary.json'), JSON.stringify(enhanceResult, null, 2));
      console.log(`  attempted:${enhanceResult.attempted} shipped:${enhanceResult.shipped} verdict:${'verdict' in enhanceResult ? enhanceResult.verdict : 'n/a'}`);
    }
  }

  await fs.writeFile(path.join(OUT, 'SUMMARY.json'), JSON.stringify({ control: controlResults, director: directorResults, enhance: enhanceResults }, null, 2));
  console.log(`\nAll artifacts under ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
