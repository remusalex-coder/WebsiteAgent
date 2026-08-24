/**
 * $0 verification of the enriched Creative Director (real Gemini free-tier
 * call, real render, real screenshot) — proves the brief now carries
 * description/reviews/character-reading and the two-call territory
 * divergence actually produces per-alternative reasoning, not just that it
 * typechecks.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { loadConfig } from '../lib/config.js';
import { createConsoleSink, createFileSink, createLogger, createMultiSink } from '../lib/logger.js';
import { createPlatform } from '../lib/platform/platform.js';
import { composeBaseline } from '../agents/writerAgent.js';
import { directContent } from '../lib/content/index.js';
import { planNarrative } from '../lib/design/plan.js';
import { composeDesign } from '../lib/design/compose.js';
import { applyDirective, directiveRuntimePrimitiveIds } from '../lib/design/directive.js';
import { NEUTRAL_ARCHITECTURE } from '../lib/design/experience.js';
import { resolvePrimitives } from '../lib/design/experienceRegistry.js';
import { renderSite, writeRenderedSite } from '../lib/render/index.js';
import { directDesign, buildDesignBrief } from '../agents/designDirectorAgent.js';
import { serveDirectory } from '../lib/qa/preflight.js';

import type { AppConfig } from '../lib/config.js';
import type { ImageAsset } from '../lib/types.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');
const OUT = path.join(ROOT, 'verify-director-enrichment');

const SITE = 'https://example.test';
const BUSINESS = {
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
} as const;

const REVIEWS = [
  { text: 'They designed our extension around a single window we already loved — nothing about the house feels imposed.', authorName: 'M. Santos', rating: 5, relativeTime: '3 months ago', publishedAt: null },
  { text: 'Slower than a big firm, but every drawing was walked through in person before it went to the builder.', authorName: 'J. Almeida', rating: 5, relativeTime: '7 months ago', publishedAt: null },
];

function attributed<T>(value: T): { value: T; source: 'website'; sourceUrl: string; alternatives: readonly never[] } {
  return { value, source: 'website', sourceUrl: SITE, alternatives: [] };
}

function svgAsset(role: ImageAsset['role'], name: string, width: number, height: number, alt: string): ImageAsset {
  return { url: `${SITE}/${name}`, role, alt, width, height, localPath: `assets/${name}`, bytes: null, sourceUrl: SITE };
}

function buildProfile() {
  const logo = svgAsset('logo', 'logo.svg', 240, 240, `${BUSINESS.label} logo`);
  const favicon = svgAsset('favicon', 'favicon.svg', 64, 64, '');
  const hero = svgAsset('hero', 'hero.svg', 1600, 900, `${BUSINESS.label} — hero photograph`);
  const gallery: readonly ImageAsset[] = Array.from({ length: BUSINESS.galleryCount }, (_unused, i) =>
    svgAsset('gallery', `gallery-${i + 1}.svg`, 1600, 1000, `${BUSINESS.label} — photograph ${i + 1}`));

  return {
    name: attributed(BUSINESS.label),
    category: attributed(BUSINESS.category),
    address: attributed({
      formatted: `${BUSINESS.locality} (illustrative address — not a real listing)`,
      street: null, locality: BUSINESS.locality, region: null, postalCode: null, country: null,
    }),
    coordinates: attributed(BUSINESS.coordinates),
    website: attributed(SITE),
    phones: [attributed({ formatted: BUSINESS.phone, e164: BUSINESS.phone.replace(/[^\d+]/g, ''), digits: BUSINESS.phone.replace(/\D/g, '') })],
    emails: [],
    socialProfiles: [],
    hours: [],
    rating: attributed(BUSINESS.rating),
    reviewCount: attributed(BUSINESS.reviewCount),
    navigation: [],
    services: BUSINESS.services.map((name) => ({ name, description: null, sourceUrl: SITE })),
    pages: [{ url: SITE, title: BUSINESS.label, text: BUSINESS.pageText }],
    attributes: BUSINESS.attributes.map((attr) => ({ group: 'Amenities', label: attr.label, available: attr.available, sourceUrl: SITE })),
    reviews: REVIEWS,
    description: attributed(BUSINESS.description),
    images: { logo, favicon, hero, gallery },
    validation: { ok: true, issues: [] },
    sources: [SITE],
    normalizedAt: '2026-08-20T00:00:00.000Z',
  };
}

function buildStrategy() {
  return {
    businessName: BUSINESS.label,
    category: { primary: BUSINESS.category, secondary: [...BUSINESS.secondary], rationale: `Listed as ${BUSINESS.category}.`, basis: 'listing' as const },
    goals: [], audience: {
      primary: { name: 'Local customers', description: 'People searching for this business locally.', needs: ['what they offer', 'how to reach them'], rationale: 'A local business serves a local catchment.' },
      secondary: [],
    },
    pages: [], features: [], backendModules: [], frontendModules: [], seoPriorities: [], openQuestions: [],
    model: 'verify-fixture', generatedAt: '2026-08-20T00:00:00.000Z',
  };
}

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

async function screenshot(dir: string): Promise<void> {
  const shotDir = path.join(dir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });
  const server = await serveDirectory(dir);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1440, height: Math.min(fullHeight, 20_000) });
    await page.mouse.wheel(0, fullHeight);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shotDir, 'desktop-full.png') });
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main(): Promise<void> {
  await fs.mkdir(OUT, { recursive: true });
  const sink = createMultiSink(createConsoleSink(), createFileSink(path.join(OUT, 'run.log')));
  const logger = createLogger({ level: 'info', scope: 'verify-director-enrichment', sink });

  const profile = buildProfile();
  const strategy = buildStrategy();

  // Log the brief directly, before any call — cheapest possible check that
  // description/reviews/character-reading actually reached it.
  const written = composeBaseline(profile as never);
  const plan = planNarrative(profile as never, written, { categories: [strategy.category.primary, ...strategy.category.secondary] });
  const directed = directContent(profile as never, written, plan);
  const content = directed.content;
  const brief = buildDesignBrief(profile as never, strategy as never, content, 2000);
  await fs.writeFile(path.join(OUT, 'brief.txt'), brief, 'utf8');
  console.log('brief sections found:');
  for (const marker of ['## Description', '## What customers say', '## Character reading']) {
    console.log(`  ${marker}: ${brief.includes(marker) ? 'PRESENT' : 'MISSING'}`);
  }

  const base = loadConfig();
  const config: AppConfig = { ...base, outputDir: OUT, ai: { ...base.ai, maxRetries: 0 }, director: { ...base.director, enabled: true } };
  const platform = await createPlatform({ config, logger, signal: new AbortController().signal, outputDir: OUT });

  const ctx = {
    runId: 'verify-director-enrichment',
    config,
    logger: logger.child('director'),
    getBrowser: () => { throw new Error('the design director does not use a browser'); },
    platform,
    outputDir: OUT,
    signal: new AbortController().signal,
  } as const;

  console.log('\ncalling real Gemini (free tier, $0) — 2 calls expected (territories, then directive)...');
  const result = await directDesign({ profile: profile as never, strategy: strategy as never, content }, ctx as never);
  await fs.writeFile(path.join(OUT, 'directive.json'), JSON.stringify(result.directive, null, 2));
  await fs.writeFile(path.join(OUT, 'provenance.json'), JSON.stringify(result.provenance, null, 2));

  console.log('\ndirective.creativeThesis:', result.directive.creativeThesis);
  console.log('directive.consideredTerritories:', JSON.stringify(result.directive.consideredTerritories, null, 2));
  console.log('directive.experienceMode:', result.directive.experienceMode);
  console.log('directive.runtimePrimitives:', JSON.stringify(result.directive.runtimePrimitives));

  const options = applyDirective(result.directive, {}, ctx.logger);
  const design = composeDesign({ profile: profile as never, strategy: strategy as never, content }, options);
  const requestedIds = directiveRuntimePrimitiveIds(result.directive, ctx.logger);
  const resolved = resolvePrimitives(NEUTRAL_ARCHITECTURE, requestedIds);

  const site = renderSite(content, {
    design,
    ...(resolved.length > 0 ? { runtime: 'scroll-progress' as const, runtimePrimitives: resolved } : {}),
    location: BUSINESS.coordinates,
    siteUrl: 'https://verify-director-enrichment.example',
  });

  await writePlaceholders(OUT, [profile.images.logo, profile.images.favicon, profile.images.hero, ...profile.images.gallery].filter((x): x is ImageAsset => x !== null));
  await writeRenderedSite(site, { sourceDir: OUT, targetDir: OUT });
  await screenshot(OUT);

  console.log(`\ndone — artifacts under ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
