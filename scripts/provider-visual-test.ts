/**
 * Same business, three AI providers — OpenAI vs DeepSeek vs Cerebras through
 * the real Creative Director pipeline. Gemini is excluded from this test by
 * construction (each run's `config.ai.provider` is pinned to one of the
 * three; nothing here ever falls back to Gemini on failure — a failed
 * provider is recorded as failed and the loop moves on).
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
import { directDesign } from '../agents/designDirectorAgent.js';
import { collectPreflightEvidence, gatePreflight, serveDirectory } from '../lib/qa/preflight.js';

import type { AppConfig } from '../lib/config.js';
import type { AIProviderName } from '../lib/ai/types.js';
import type { ImageAsset } from '../lib/types.js';
import type { CapabilityOrchestrator, PlanOverrides } from '../lib/capability/orchestrator.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');
const OUT = path.join(ROOT, 'benchmark', 'providers');

/* Identical business identity for all three runs — the only variable is the provider. */
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
    reviews: [],
    description: attributed(BUSINESS.description),
    images: { logo, favicon, hero, gallery },
    validation: { ok: true, issues: [] },
    sources: [SITE],
    normalizedAt: '2026-08-19T00:00:00.000Z',
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
    model: 'provider-visual-test-fixture', generatedAt: '2026-08-19T00:00:00.000Z',
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

/** desktop-top, desktop-full (safe resize-then-shoot), mobile-top, interaction (scrolled to the mid-page experience section) — all over real HTTP, never file://. */
async function screenshotSet(dir: string): Promise<Record<string, number>> {
  const shotDir = path.join(dir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });
  const server = await serveDirectory(dir);
  const browser = await chromium.launch({ headless: true });
  const bytes: Record<string, number> = {};
  const shoot = async (name: string, page: Awaited<ReturnType<typeof browser.newPage>>) => {
    const p = path.join(shotDir, `${name}.png`);
    await page.screenshot({ path: p });
    bytes[name] = (await fs.stat(p)).size;
  };
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktop.goto(server.url, { waitUntil: 'load' });
    await desktop.waitForTimeout(300);
    await shoot('desktop-top', desktop);

    const fullHeight = await desktop.evaluate(() => document.documentElement.scrollHeight);
    await desktop.setViewportSize({ width: 1440, height: Math.min(fullHeight, 20_000) });
    await desktop.mouse.wheel(0, fullHeight);
    await desktop.waitForTimeout(400);
    await shoot('desktop-full', desktop);

    await desktop.setViewportSize({ width: 1440, height: 900 });
    await desktop.mouse.wheel(0, Math.round(fullHeight * 0.55));
    await desktop.waitForTimeout(400);
    await shoot('interaction-section', desktop);
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(server.url, { waitUntil: 'load' });
    await mobile.waitForTimeout(300);
    await shoot('mobile-top', mobile);
    await mobile.close();
  } finally {
    await browser.close();
    await server.close();
  }
  return bytes;
}

/* ------------------------------------------------------------------ */

const ALL_CHAIN_PROVIDERS: readonly AIProviderName[] = ['anthropic', 'openai', 'gemini', 'deepseek', 'cerebras'];

/**
 * Forces the capability orchestrator to hit exactly one named provider —
 * every other vendor in the `creative_direction` chain is excluded, so a
 * failure falls straight to the deterministic floor (`derive-character`),
 * never sideways to another AI vendor (Gemini included). Also lifts the
 * standing zero-budget policy just enough to let one real paid call through
 * (founder-approved spend exception for this test, <$0.05 total across all
 * three providers) and allows Cerebras's unverified-pricing placeholder,
 * since its catalog entry has no confirmed rate card yet.
 */
function forceProvider(capabilities: CapabilityOrchestrator, only: AIProviderName): CapabilityOrchestrator {
  const exclude = ALL_CHAIN_PROVIDERS.filter((p) => p !== only);
  const mergeOverrides = (overrides: PlanOverrides = {}): PlanOverrides => ({
    ...overrides,
    policy: { allowPaid: true, budgetCentsRemaining: 5, allowUnverifiedPricing: true, ...overrides.policy },
    excludeProviders: [...exclude, ...(overrides.excludeProviders ?? [])],
  });
  return {
    ...capabilities,
    plan: (capability, overrides) => capabilities.plan(capability, mergeOverrides(overrides)),
    run: (capability, invoke, overrides) => capabilities.run(capability, invoke, mergeOverrides(overrides)),
  };
}

interface ProviderRun {
  readonly provider: AIProviderName;
  readonly model: string;
}

const RUNS: readonly ProviderRun[] = [
  { provider: 'openai', model: 'gpt-5.2' },
  { provider: 'deepseek', model: 'deepseek-v4-flash' },
  { provider: 'cerebras', model: 'gpt-oss-120b' },
];

async function runProvider(run: ProviderRun, logger: ReturnType<typeof createLogger>): Promise<Record<string, unknown>> {
  const dir = path.join(OUT, run.provider);
  await fs.mkdir(dir, { recursive: true });

  const base = loadConfig();
  const config: AppConfig = {
    ...base,
    outputDir: dir,
    ai: { ...base.ai, provider: run.provider, maxRetries: 0 },
    // The capability planner gates spend on a worst-case estimate
    // (`maxOutputTokens` billed in full), not actual usage — at the 12,000
    // default, OpenAI's frontier rate alone estimates to ~11 cents and gets
    // planned out under this test's 5-cent budget before it ever sends a
    // request. 4,000 tokens is still generous for a schema-constrained JSON
    // directive and keeps every provider's worst case under the approved cap.
    director: { ...base.director, enabled: true, model: run.model, maxOutputTokens: 4000 },
  };
  const platform = await createPlatform({ config, logger, signal: new AbortController().signal, outputDir: dir });

  const profile = buildProfile();
  const strategy = buildStrategy();
  const written = composeBaseline(profile as never);
  const plan = planNarrative(profile as never, written, { categories: [strategy.category.primary, ...strategy.category.secondary] });
  const directed = directContent(profile as never, written, plan);
  const content = directed.content;

  const providerPlatform = { ...platform, capabilities: forceProvider(platform.capabilities, run.provider) };
  const ctx = {
    runId: `provider-visual-test-${run.provider}`,
    config,
    logger: logger.child(`director.${run.provider}`),
    getBrowser: () => { throw new Error('the design director does not use a browser'); },
    platform: providerPlatform,
    outputDir: dir,
    signal: new AbortController().signal,
  } as const;

  const result = await directDesign({ profile: profile as never, strategy: strategy as never, content }, ctx as never);
  await fs.writeFile(path.join(dir, 'directive.json'), JSON.stringify(result.directive, null, 2));
  await fs.writeFile(path.join(dir, 'provenance.json'), JSON.stringify(result.provenance, null, 2));

  const options = applyDirective(result.directive, {}, ctx.logger);
  const design = composeDesign({ profile: profile as never, strategy: strategy as never, content }, options);
  const requestedIds = directiveRuntimePrimitiveIds(result.directive, ctx.logger);
  const resolved = resolvePrimitives(NEUTRAL_ARCHITECTURE, requestedIds);
  const runtimeEngaged = resolved.length > 0;

  const site = renderSite(content, {
    design,
    ...(runtimeEngaged ? { runtime: 'scroll-progress' as const, runtimePrimitives: resolved } : {}),
    location: BUSINESS.coordinates,
    siteUrl: `https://${run.provider}.provider-test.example`,
  });

  await writePlaceholders(dir, [profile.images.logo, profile.images.favicon, profile.images.hero, ...profile.images.gallery].filter((x): x is ImageAsset => x !== null));
  const { missingAssets } = await writeRenderedSite(site, { sourceDir: dir, targetDir: dir });
  const shotBytes = await screenshotSet(dir);
  const evidence = await collectPreflightEvidence({ siteDir: dir, logger });
  const verdict = gatePreflight(evidence);

  return {
    provider: run.provider,
    status: 'ok',
    model: result.provenance.model,
    inputTokens: result.provenance.inputTokens,
    outputTokens: result.provenance.outputTokens,
    direction: result.directive.direction,
    experienceMode: result.directive.experienceMode,
    creativeThesis: result.directive.creativeThesis,
    requestedRuntimePrimitives: (result.directive.runtimePrimitives ?? []).map((r) => ({ id: r.id, reason: r.reason })),
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

async function main(): Promise<void> {
  await fs.mkdir(OUT, { recursive: true });
  const sink = createMultiSink(createConsoleSink(), createFileSink(path.join(OUT, 'run.log')));
  const logger = createLogger({ level: 'warn', scope: 'provider-visual-test', sink });

  const only = process.env.ONLY_PROVIDER;
  const targets = only === undefined ? RUNS : RUNS.filter((r) => r.provider === only);

  const results: Record<string, unknown>[] = [];
  for (const run of targets) {
    console.log(`\n=== ${run.provider.toUpperCase()} (${run.model}) ===`);
    try {
      const result = await runProvider(run, logger);
      results.push(result);
      console.log(`  OK — direction:${(result as { direction?: string }).direction} mode:${(result as { experienceMode?: string }).experienceMode} primitives:[${((result as { resolvedPrimitives?: string[] }).resolvedPrimitives ?? []).join(', ')}]`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED (not falling back to Gemini): ${message}`);
      results.push({ provider: run.provider, status: 'failed', model: run.model, error: message });
    }
    await fs.writeFile(path.join(OUT, run.provider, 'result.json'), JSON.stringify(results[results.length - 1], null, 2));
  }

  // Merge with any other providers' already-written result.json (so a
  // filtered re-run for one failed provider does not clobber the others).
  const merged: Record<string, unknown>[] = [];
  for (const r of RUNS) {
    const own = results.find((x) => (x as { provider: string }).provider === r.provider);
    if (own !== undefined) { merged.push(own); continue; }
    try {
      merged.push(JSON.parse(await fs.readFile(path.join(OUT, r.provider, 'result.json'), 'utf8')));
    } catch { /* not run yet */ }
  }
  await fs.writeFile(path.join(OUT, 'SUMMARY.json'), JSON.stringify(merged, null, 2));
  console.log(`\nAll artifacts under ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
