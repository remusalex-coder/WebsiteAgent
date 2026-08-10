/**
 * Design Director smoke test — one business, one real AI call.
 *
 *   npm run design-director                # full run: CONTROL + DIRECTOR
 *   npm run design-director -- --control-only   # no AI call at all
 *
 * The question this answers is narrow and the answer has to be unarguable:
 *
 *   does a real model call actually change what the deterministic design
 *   system builds, and does the page it builds still work?
 *
 * Two variants, identical inputs, one difference:
 *
 *   CONTROL   fixture → composeDesign()                  → design → HTML → shots
 *   DIRECTOR  fixture → designDirectorAgent (REAL AI)
 *                     → DesignDirective
 *                     → applyDirective()
 *                     → composeDesign()                  → design → HTML → shots
 *
 * There is no fallback directive, no mock provider and no canned response. If
 * the model call fails, the smoke test fails — a harness that can turn a failed
 * call into a passing run proves nothing about the call.
 *
 * ## Exactly one AI call
 *
 * Three independent guarantees, because "we only meant to call it once" is not
 * a guarantee:
 *
 *   1. `maxRetries` is forced to 0, so one `generate()` is one HTTP request.
 *   2. The provider is wrapped in a counter that throws on the second call.
 *   3. Every step is resumable. A crash *after* the directive is written is
 *      repaired and re-run for free, because the next run reads the directive
 *      off disk instead of asking the model again.
 *
 * (3) is the one that matters in practice. It is also the shape the production
 * orchestrator needs — JOB → WORKER → ARTIFACT → VALIDATION → NEXT JOB, each
 * job idempotent and each resumable after an interruption — so this harness is
 * a small honest instance of it rather than a throwaway.
 *
 * ## Artifacts
 *
 * Everything lands in `smoke-test/` at the repository root, which is *not*
 * gitignored: `output/` is, and an artifact an operator cannot open is not
 * evidence.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { loadConfig } from '../lib/config.js';
import {
  createConsoleSink,
  createFileSink,
  createLogger,
  createMultiSink,
} from '../lib/logger.js';
import { createPlatform } from '../lib/platform/platform.js';
import { composeDesign } from '../lib/design/compose.js';
import { applyDirective } from '../lib/design/directive.js';
import { renderSite, writeRenderedSite } from '../lib/render/index.js';
import { directDesign } from '../agents/designDirectorAgent.js';

import { profileFixture, strategyFixture } from '../test/fixtures/business.js';
import { fullContent } from '../test/fixtures/content.js';

import type { AppConfig } from '../lib/config.js';
import type { Logger } from '../lib/logger.js';
import type { AIProvider } from '../lib/ai/types.js';
import type { Platform } from '../lib/platform/platform.js';
import type { WebsiteDesign } from '../lib/design/types.js';
import type { DesignDirective } from '../lib/design/directive.js';
import type { DirectorProvenance } from '../agents/designDirectorAgent.js';
import type {
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  ImageAsset,
  WebsiteContent,
  WebsiteSection,
} from '../lib/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SMOKE = path.join(ROOT, 'smoke-test');

const CONTROL = path.join(SMOKE, 'control');
const DIRECTOR = path.join(SMOKE, 'director');

const RESULTS = path.join(SMOKE, 'smoke-results.json');
const RUN_LOG = path.join(SMOKE, 'run.log.ndjson');
const RUN_META = path.join(SMOKE, 'run.meta.json');

const controlOnly = process.argv.includes('--control-only');

/* ------------------------------------------------------------------ */
/* Filesystem helpers                                                  */
/* ------------------------------------------------------------------ */

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function sha256(file: string): Promise<string> {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

/* ------------------------------------------------------------------ */
/* The fixture                                                         */
/* ------------------------------------------------------------------ */

/**
 * One business, assembled from the repository's own fixtures.
 *
 * `test/fixtures` rather than `scripts/example-businesses.ts` deliberately:
 * the test fixtures are the ones the typechecker covers, so they cannot drift
 * away from `BusinessProfile` without the build saying so.
 *
 * The only edit made to them is the imagery. `fullContent` points its assets at
 * `.png`/`.jpg` paths that no file backs; a page full of broken-image icons
 * reads as a layout fault even when the layout is fine, so the assets are
 * repointed at `.svg` files this script writes. Nothing about the *business* is
 * invented — no facts, no copy, no claims.
 */
const SITE = 'https://example.test';

function svgAsset(base: ImageAsset, name: string): ImageAsset {
  return {
    ...base,
    url: `${SITE}/${name}`,
    localPath: `assets/${name}`,
  };
}

function smokeInput(): {
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
} {
  const heroSection = fullContent.sections.find((s) => s.kind === 'hero');
  const gallerySection = fullContent.sections.find((s) => s.kind === 'gallery');
  if (heroSection === undefined || gallerySection === undefined) {
    throw new Error('the content fixture no longer has a hero and a gallery section');
  }

  const [logo, favicon, hero] = heroSection.images;
  if (logo === undefined || favicon === undefined || hero === undefined) {
    throw new Error('the content fixture no longer carries a logo, favicon and hero image');
  }

  const logoImage = svgAsset(logo, 'logo.svg');
  const faviconImage = svgAsset(favicon, 'favicon.svg');
  const heroImage = svgAsset(hero, 'hero.svg');

  // Four gallery images: `masonry` and `collage` need four, and a fixture that
  // can only reach the `stack` fallback would hide half of what the layout
  // planner does. The unusable `javascript:` asset from the fixture is kept —
  // the renderer is supposed to drop it, and this is where that is proven.
  const gallery: readonly ImageAsset[] = [
    svgAsset(logo, 'gallery-1.svg'),
    svgAsset(logo, 'gallery-2.svg'),
    svgAsset(logo, 'gallery-3.svg'),
    svgAsset(logo, 'gallery-4.svg'),
  ].map((asset): ImageAsset => ({
    ...asset,
    role: 'gallery',
    alt: 'The counter at opening time',
    width: 1200,
    height: 900,
  }));

  const sections: readonly WebsiteSection[] = fullContent.sections.map((section) => {
    if (section.kind === 'hero') {
      return { ...section, images: [logoImage, faviconImage, heroImage] };
    }
    if (section.kind === 'gallery') {
      return { ...section, images: [...gallery, ...section.images.slice(1)] };
    }
    return section;
  });

  const content: WebsiteContent = { ...fullContent, sections };

  const profile: BusinessProfile = {
    ...profileFixture({
      name: 'Padaria Ana & Sons',
      category: 'Bakery',
      services: ['Sourdough', 'Pastel de nata', 'Celebration cakes', 'Coffee'],
      rating: 4.8,
      reviewCount: 412,
      phone: '+351 21 000 0000',
      description: 'A neighbourhood bakery on Rua da Prata, milling its own flour.',
      pages: [
        {
          url: SITE,
          title: 'Padaria Ana & Sons',
          text: [
            'Bread baked before dawn. A neighbourhood bakery on Rua da Prata.',
            'We mill our own flour and bake through the night.',
            'Everything is sold the day it is made. Two ovens, four bakers and one long counter.',
          ].join(' '),
        },
      ],
    }),
    images: {
      logo: logoImage,
      favicon: faviconImage,
      hero: heroImage,
      gallery: [...gallery],
    },
  };

  return { profile, strategy: strategyFixture(), content };
}

/* ------------------------------------------------------------------ */
/* Placeholder imagery                                                 */
/* ------------------------------------------------------------------ */

/**
 * A neutral stand-in for a photograph, identical for both variants.
 *
 * Deliberately *not* drawn from each variant's own palette, which is what
 * `scripts/generate-examples.ts` does. There the point is to review a page; here
 * the point is to attribute a visual difference, and a placeholder that changes
 * colour with the design would let "the images are a different grey" masquerade
 * as evidence about the layout. Identical bytes on both sides means every
 * difference in the screenshots belongs to the design system.
 */
function placeholderSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="presentation">`
    + `<rect width="${width}" height="${height}" fill="#d8d5d0"/>`
    + `<rect y="${Math.round(height * 0.58)}" width="${width}" height="${Math.round(height * 0.42)}" fill="#c2beb8"/>`
    + `<circle cx="${Math.round(width * 0.28)}" cy="${Math.round(height * 0.4)}" r="${Math.round(height * 0.14)}" fill="#a29c94"/>`
    + '</svg>\n';
}

async function writePlaceholders(dir: string, sourcePaths: readonly string[]): Promise<void> {
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await Promise.all(sourcePaths.map(async (localPath) => {
    const hero = localPath.includes('hero');
    await fs.writeFile(
      path.join(dir, localPath),
      placeholderSvg(hero ? 1600 : 1200, 900),
      'utf8',
    );
  }));
}

/* ------------------------------------------------------------------ */
/* Structural diff                                                     */
/* ------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every leaf path at which two designs disagree.
 *
 * Paths rather than values: the claim being tested is "the directive changed
 * the structure", and a list of the fields that moved is what supports or
 * refutes it. Values for the interesting ones are reported separately.
 */
function diffPaths(a: unknown, b: unknown, prefix = ''): readonly string[] {
  const here = prefix === '' ? '$' : prefix;

  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = [];
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      out.push(...diffPaths(a[index], b[index], `${prefix}[${index}]`));
    }
    return out;
  }

  if (isRecord(a) && isRecord(b)) {
    const out: string[] = [];
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      out.push(...diffPaths(a[key], b[key], prefix === '' ? key : `${prefix}.${key}`));
    }
    return out;
  }

  return Object.is(a, b) ? [] : [here];
}

/** The design decisions a human would read first, flattened for the report. */
function summarise(design: WebsiteDesign): Record<string, unknown> {
  return {
    direction: design.personality.direction,
    density: design.personality.density,
    contrast: design.personality.contrast,
    mood: design.personality.mood,
    world: design.world,
    patterns: design.patterns,
    industry: design.industry.id,
    hero: design.layout.hero,
    sectionOrder: design.layout.sections.map((section) => `${section.kind}:${section.variant}`),
    headingFont: design.tokens.typography.heading.family,
    bodyFont: design.tokens.typography.body.family,
    typeRatio: design.tokens.typography.ratio,
    measureCh: design.tokens.typography.measureCh,
    scheme: design.tokens.color.scheme,
    brand: design.tokens.color.semantic.brand,
    canvas: design.tokens.color.semantic.canvas,
    surface: design.tokens.color.semantic.surface,
    text: design.tokens.color.semantic.text,
    contrast: design.tokens.color.contrast,
    sectionRhythmRem: [design.tokens.spacing.sectionMinRem, design.tokens.spacing.sectionMaxRem],
    radiusStyle: design.tokens.radius.style,
    elevationStyle: design.tokens.elevation.style,
    accessibility: design.accessibility,
    imagery: design.imagery,
  };
}

/* ------------------------------------------------------------------ */
/* Browser checks                                                      */
/* ------------------------------------------------------------------ */

interface ViewportReport {
  readonly viewport: string;
  readonly width: number;
  readonly height: number;
  readonly documentHeight: number;
  readonly horizontalOverflowPx: number;
  readonly words: number;
  readonly images: number;
  readonly brokenImages: number;
  readonly sections: number;
  readonly navLinks: number;
  readonly deadNavLinks: readonly string[];
  readonly primaryCtas: number;
  readonly headingText: string;
  /**
   * Section headings, read with `textContent` rather than `innerText`.
   *
   * The distinction is the whole point: `innerText` reflects `text-transform`,
   * so an uppercased eyebrow reads as changed copy when only the CSS moved.
   * `textContent` returns what the writer actually wrote.
   */
  readonly mainHeadings: readonly string[];
  readonly sectionIds: readonly string[];
  readonly screenshot: string;
  readonly screenshotBytes: number;
  readonly navigationWorks: boolean | null;
}

interface VariantReport {
  readonly variant: string;
  readonly htmlPath: string;
  readonly htmlBytes: number;
  readonly htmlSha256: string;
  readonly cssBytes: number;
  readonly cssSha256: string;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly rendererWarnings: readonly string[];
  readonly viewports: readonly ViewportReport[];
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

/**
 * Screenshots one variant at both viewports and measures whether it works.
 *
 * The capture recipe is `scripts/shoot.ts`'s, and for the reason documented
 * there: `fullPage: true` resizes the viewport *after* images decoded and
 * re-runs the browser's lazy heuristics, so a gallery captures as a white band
 * that looks exactly like broken CSS. Growing the viewport to the document
 * height instead means no resize happens at capture time at all.
 */
async function inspectVariant(
  variant: string,
  dir: string,
  rendererWarnings: readonly string[],
  logger: Logger,
): Promise<VariantReport> {
  const indexPath = path.join(dir, 'index.html');
  const cssPath = path.join(dir, 'styles.css');
  const shotDir = path.join(dir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const viewports: ViewportReport[] = [];

  try {
    for (const { name, width, height } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });

      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(`${name}: ${message.text()}`);
      });
      page.on('pageerror', (error) => pageErrors.push(`${name}: ${error.message}`));
      page.on('requestfailed', (request) => {
        failedRequests.push(`${name}: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400) failedRequests.push(`${name}: HTTP ${response.status()} ${response.url()}`);
      });

      await page.goto(`file://${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });

      // Every image decoded before the viewport is touched. See the note above.
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) img.removeAttribute('loading');
        await Promise.all(Array.from(document.images).map((img) =>
          img.complete ? null : img.decode().catch(() => null)));
      });
      await page.waitForTimeout(600);

      const measured = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('nav a[href^="#"]'));
        const dead = anchors
          .map((a) => a.getAttribute('href') ?? '')
          .filter((href) => href.length > 1 && document.querySelector(`[id="${href.slice(1)}"]`) === null);

        return {
          words: (document.body.innerText.match(/\S+/g) ?? []).length,
          images: document.images.length,
          brokenImages: Array.from(document.images).filter((img) => img.naturalWidth === 0).length,
          sections: document.querySelectorAll('section').length,
          navLinks: anchors.length,
          deadNavLinks: dead,
          primaryCtas: document.querySelectorAll('a.button--primary').length,
          headingText: document.querySelector('h1')?.textContent?.trim() ?? '',
          mainHeadings: Array.from(document.querySelectorAll('main h1, main h2'))
            .map((heading) => (heading.textContent ?? '').trim()),
          sectionIds: Array.from(document.querySelectorAll('main section[id]'))
            .map((section) => section.id),
          documentHeight: document.documentElement.scrollHeight,
          horizontalOverflowPx:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      // Navigation is only proven by using it: click the first in-page link and
      // confirm the browser actually moved to the section it names.
      let navigationWorks: boolean | null = null;
      if (measured.navLinks > 0) {
        const target = await page.getAttribute('nav a[href^="#"]', 'href');
        await page.click('nav a[href^="#"]');
        await page.waitForTimeout(400);
        navigationWorks = await page.evaluate((href: string | null) => {
          if (href === null) return false;
          const element = document.querySelector(`[id="${href.slice(1)}"]`);
          if (element === null) return false;
          const box = element.getBoundingClientRect();
          // The section is at or above the fold after the jump.
          return window.location.hash === href && box.top < window.innerHeight;
        }, target);
        await page.evaluate(() => { window.scrollTo(0, 0); });
        await page.waitForTimeout(200);
      }

      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(fullHeight, 20_000) });
      await page.waitForTimeout(400);

      const screenshot = path.join(shotDir, `${name}.png`);
      await page.screenshot({ path: screenshot });
      const stat = await fs.stat(screenshot);

      viewports.push({
        viewport: name,
        width,
        height,
        screenshot: path.relative(ROOT, screenshot).replace(/\\/g, '/'),
        screenshotBytes: stat.size,
        navigationWorks,
        ...measured,
      });

      logger.info('variant captured', {
        variant,
        viewport: name,
        words: measured.words,
        images: measured.images,
        brokenImages: measured.brokenImages,
        overflowPx: measured.horizontalOverflowPx,
        navigationWorks,
        screenshotBytes: stat.size,
      });

      await page.close();
    }
  } finally {
    await browser.close();
  }

  const [htmlStat, cssStat] = await Promise.all([fs.stat(indexPath), fs.stat(cssPath)]);

  return {
    variant,
    htmlPath: path.relative(ROOT, indexPath).replace(/\\/g, '/'),
    htmlBytes: htmlStat.size,
    htmlSha256: await sha256(indexPath),
    cssBytes: cssStat.size,
    cssSha256: await sha256(cssPath),
    consoleErrors,
    pageErrors,
    failedRequests,
    rendererWarnings,
    viewports,
  };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

interface Check {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

function functionalChecks(report: VariantReport): readonly Check[] {
  const checks: Check[] = [];
  const add = (id: string, passed: boolean, detail: string): void => {
    checks.push({ id: `${report.variant}.${id}`, passed, detail });
  };

  add('html-loads', report.pageErrors.length === 0,
    report.pageErrors.length === 0 ? 'no uncaught page errors' : report.pageErrors.join('; '));
  add('no-console-errors', report.consoleErrors.length === 0,
    report.consoleErrors.length === 0 ? 'console clean' : report.consoleErrors.join('; '));
  add('no-failed-requests', report.failedRequests.length === 0,
    report.failedRequests.length === 0 ? 'every request resolved' : report.failedRequests.join('; '));

  for (const view of report.viewports) {
    add(`${view.viewport}.heading`, view.headingText.length > 0,
      `h1 = "${view.headingText}"`);
    add(`${view.viewport}.primary-cta`, view.primaryCtas >= 1,
      `${view.primaryCtas} primary call(s) to action`);
    add(`${view.viewport}.navigation`, view.navigationWorks === true,
      `${view.navLinks} in-page links, ${view.deadNavLinks.length} dead, click resolved: ${String(view.navigationWorks)}`);
    add(`${view.viewport}.images-load`, view.brokenImages === 0,
      `${view.images} images, ${view.brokenImages} broken`);
    add(`${view.viewport}.no-horizontal-overflow`, view.horizontalOverflowPx <= 1,
      `${view.horizontalOverflowPx}px overflow`);
    add(`${view.viewport}.content-rendered`, view.words >= 50 && view.sections >= 5,
      `${view.words} words across ${view.sections} sections`);
    add(`${view.viewport}.screenshot`, view.screenshotBytes > 5_000,
      `${view.screenshot} (${view.screenshotBytes} bytes)`);
  }

  return checks;
}

/* ------------------------------------------------------------------ */
/* Job runner                                                          */
/* ------------------------------------------------------------------ */

type StepStatus = 'produced' | 'resumed';

interface StepRecord {
  readonly id: string;
  readonly status: StepStatus;
  readonly artifacts: readonly string[];
  readonly durationMs: number;
}

/**
 * One resumable job.
 *
 * If every artifact it declares is already on disk the work is skipped and the
 * artifact is read back instead. That is what makes a crash after the model call
 * free to recover from, and it is the same contract a queue-driven worker needs:
 * running a job twice must cost no more than running it once.
 */
async function step<T>(
  records: StepRecord[],
  logger: Logger,
  id: string,
  artifacts: readonly string[],
  produce: () => Promise<T>,
  resume: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const relative = artifacts.map((file) => path.relative(ROOT, file).replace(/\\/g, '/'));

  const present = await Promise.all(artifacts.map(exists));
  if (present.every(Boolean) && artifacts.length > 0) {
    const value = await resume();
    records.push({ id, status: 'resumed', artifacts: relative, durationMs: Date.now() - startedAt });
    logger.info('step resumed from artifact', { step: id, artifacts: relative });
    return value;
  }

  logger.info('step started', { step: id });
  const value = await produce();
  records.push({ id, status: 'produced', artifacts: relative, durationMs: Date.now() - startedAt });
  logger.info('step finished', { step: id, artifacts: relative, durationMs: Date.now() - startedAt });
  return value;
}

/* ------------------------------------------------------------------ */
/* Rendering a variant                                                 */
/* ------------------------------------------------------------------ */

async function renderVariant(
  dir: string,
  content: WebsiteContent,
  design: WebsiteDesign,
): Promise<readonly string[]> {
  const site = renderSite(content, { design });

  await fs.mkdir(dir, { recursive: true });
  await writePlaceholders(dir, site.assets.map((asset) => asset.sourcePath));

  // Source and target are the same folder: the placeholders were written where
  // the plan expects to find them, and copying them over themselves is a no-op
  // the writer tolerates. It saves a staging directory.
  const { missingAssets } = await writeRenderedSite(site, { sourceDir: dir, targetDir: dir });

  return [
    ...site.warnings,
    ...missingAssets.map((asset) => `asset not found: ${asset}`),
  ];
}

/* ------------------------------------------------------------------ */
/* The one AI call                                                     */
/* ------------------------------------------------------------------ */

/**
 * Wraps a provider so a second generation is a crash rather than a surprise.
 *
 * The counter is the harness's own guarantee, independent of `maxRetries`. If
 * anything in this script ever grows a second model call by accident, this is
 * what makes that a failure instead of a quietly doubled bill.
 */
function oneCallOnly(provider: AIProvider, onCall: () => void): AIProvider {
  let calls = 0;
  return {
    ...provider,
    async generate(request) {
      calls += 1;
      if (calls > 1) {
        throw new Error(
          `the smoke test attempted AI call #${calls}; exactly one is allowed. `
          + 'Delete smoke-test/director/directive.json only if a fresh call is intended.',
        );
      }
      onCall();
      return provider.generate(request);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

interface RunMeta {
  readonly runId: string;
  readonly startedAt: string;
}

async function main(): Promise<void> {
  await fs.mkdir(SMOKE, { recursive: true });

  const meta: RunMeta = await exists(RUN_META)
    ? await readJson<RunMeta>(RUN_META)
    : { runId: crypto.randomUUID().slice(0, 8), startedAt: new Date().toISOString() };
  await writeJson(RUN_META, meta);

  const sink = createMultiSink(createConsoleSink(), createFileSink(RUN_LOG));
  const base = loadConfig();

  /*
   * Two overrides, both about the one-call rule:
   *   `maxRetries: 0` — one `generate()` is one HTTP request, never four.
   *   `director.enabled` — the harness is the caller that turns it on.
   */
  const config: AppConfig = {
    ...base,
    outputDir: SMOKE,
    ai: { ...base.ai, maxRetries: 0 },
    director: { ...base.director, enabled: true },
  };

  const logger = createLogger({
    level: config.logLevel,
    scope: `smoke.${meta.runId}`,
    baseFields: { runId: meta.runId },
    sink,
  });

  const controller = new AbortController();
  const records: StepRecord[] = [];
  const input = smokeInput();

  let aiCalls = 0;
  let directiveSource: 'live' | 'resumed' | 'skipped' = 'skipped';
  let provenance: DirectorProvenance | null = null;

  const platform = await createPlatform({
    config,
    logger,
    signal: controller.signal,
    outputDir: SMOKE,
  });

  try {
    logger.info('smoke test started', {
      controlOnly,
      provider: platform.describe().provider ?? '(unset)',
      directorModel: config.director.model,
      directorEffort: config.director.effort,
      directorMaxOutputTokens: config.director.maxOutputTokens,
      maxRetries: config.ai.maxRetries,
      artifacts: path.relative(ROOT, SMOKE),
    });

    /* ---------------- CONTROL ---------------- */

    const controlDesign = await step(
      records, logger, 'control.design', [path.join(CONTROL, 'design.json')],
      async () => {
        const design = composeDesign(input, {});
        await writeJson(path.join(CONTROL, 'design.json'), design);
        return design;
      },
      () => readJson<WebsiteDesign>(path.join(CONTROL, 'design.json')),
    );

    const controlWarnings = await step(
      records, logger, 'control.render',
      [path.join(CONTROL, 'index.html'), path.join(CONTROL, 'styles.css')],
      () => renderVariant(CONTROL, input.content, controlDesign),
      async () => [],
    );

    const controlReport = await step(
      records, logger, 'control.shoot',
      [
        path.join(CONTROL, 'screenshots', 'desktop.png'),
        path.join(CONTROL, 'screenshots', 'mobile.png'),
        path.join(CONTROL, 'report.json'),
      ],
      async () => {
        const report = await inspectVariant('control', CONTROL, controlWarnings, logger);
        await writeJson(path.join(CONTROL, 'report.json'), report);
        return report;
      },
      () => readJson<VariantReport>(path.join(CONTROL, 'report.json')),
    );

    if (controlOnly) {
      logger.warn('--control-only: stopping before the AI call', {
        checks: functionalChecks(controlReport).filter((check) => !check.passed).length,
      });
      await writeJson(RESULTS, {
        verdict: 'INCOMPLETE',
        reason: '--control-only: the DIRECTOR variant was not produced and no AI call was made',
        runId: meta.runId,
        ai: { calls: 0, directiveSource: 'skipped' },
        steps: records,
        control: { design: summarise(controlDesign), report: controlReport },
        checks: functionalChecks(controlReport),
      });
      logger.info('control-only run complete', { results: path.relative(ROOT, RESULTS) });
      return;
    }

    /* ---------------- DIRECTOR ---------------- */

    // The provider is built here, not lazily, so a missing credential is a
    // blocker reported before any work is thrown away.
    const guarded = oneCallOnly(platform.ai(), () => { aiCalls += 1; });
    const directorPlatform: Platform = {
      ...platform,
      ai: () => guarded,
      tryAi: () => guarded,
    };

    const ctx: AgentContext = {
      runId: meta.runId,
      config,
      logger: logger.child('designDirectorAgent'),
      getBrowser: () => {
        throw new Error('the design director does not use a browser');
      },
      platform: directorPlatform,
      outputDir: SMOKE,
      signal: controller.signal,
    };

    const directivePath = path.join(DIRECTOR, 'directive.json');
    const provenancePath = path.join(DIRECTOR, 'directive.provenance.json');

    const directive = await step(
      records, logger, 'director.directive', [directivePath, provenancePath],
      async () => {
        const result = await directDesign(input, ctx);
        directiveSource = 'live';
        provenance = result.provenance;
        await writeJson(directivePath, result.directive);
        await writeJson(provenancePath, result.provenance);
        return result.directive;
      },
      async () => {
        directiveSource = 'resumed';
        provenance = await readJson<DirectorProvenance>(provenancePath);
        return readJson<DesignDirective>(directivePath);
      },
    );

    const directorDesign = await step(
      records, logger, 'director.design', [path.join(DIRECTOR, 'design.json')],
      async () => {
        const options = applyDirective(directive, {}, logger.child('applyDirective'));
        logger.info('directive applied', { options: options as Record<string, unknown> });
        const design = composeDesign(input, options);
        await writeJson(path.join(DIRECTOR, 'design.json'), design);
        return design;
      },
      () => readJson<WebsiteDesign>(path.join(DIRECTOR, 'design.json')),
    );

    const directorWarnings = await step(
      records, logger, 'director.render',
      [path.join(DIRECTOR, 'index.html'), path.join(DIRECTOR, 'styles.css')],
      () => renderVariant(DIRECTOR, input.content, directorDesign),
      async () => [],
    );

    const directorReport = await step(
      records, logger, 'director.shoot',
      [
        path.join(DIRECTOR, 'screenshots', 'desktop.png'),
        path.join(DIRECTOR, 'screenshots', 'mobile.png'),
        path.join(DIRECTOR, 'report.json'),
      ],
      async () => {
        const report = await inspectVariant('director', DIRECTOR, directorWarnings, logger);
        await writeJson(path.join(DIRECTOR, 'report.json'), report);
        return report;
      },
      () => readJson<VariantReport>(path.join(DIRECTOR, 'report.json')),
    );

    /* ---------------- Verification ---------------- */

    const changedPaths = diffPaths(controlDesign, directorDesign);
    const controlSummary = summarise(controlDesign);
    const directorSummary = summarise(directorDesign);
    const changedDecisions = Object.keys(controlSummary).filter(
      (key) => JSON.stringify(controlSummary[key]) !== JSON.stringify(directorSummary[key]),
    );

    const controlDesktop = controlReport.viewports.find((v) => v.viewport === 'desktop');
    const directorDesktop = directorReport.viewports.find((v) => v.viewport === 'desktop');

    const checks: Check[] = [
      ...functionalChecks(controlReport),
      ...functionalChecks(directorReport),
      /*
       * Resuming is a pass, but it must never read as a live call.
       *
       * The directive on disk was produced by one, and the provenance beside it
       * says which model, when, and under what request id — so a resumed run is
       * still auditable. What it is not is fresh evidence, and the detail line
       * has to say so out loud.
       */
      {
        id: 'ai.exactly-one-call',
        passed: aiCalls === 1 || (aiCalls === 0 && directiveSource === 'resumed'),
        detail: directiveSource === 'live'
          ? `${aiCalls} live call this invocation`
          : `0 live calls this invocation; directive resumed from an artifact produced by a live `
            + `call at ${provenance?.startedAt ?? 'unknown'} (request ${provenance?.requestId ?? 'none'})`,
      },
      {
        id: 'ai.directive-is-model-output',
        passed: provenance !== null,
        detail: provenance === null
          ? 'no provenance recorded'
          : `${provenance.provider}/${provenance.model}, `
            + `${String(provenance.inputTokens)} in / ${String(provenance.outputTokens)} out, `
            + `finish ${String(provenance.finishReason)}`,
      },
      {
        id: 'design.structural-difference',
        passed: changedPaths.length > 0,
        detail: `${changedPaths.length} field(s) differ in WebsiteDesign; `
          + `decisions changed: ${changedDecisions.join(', ') || 'none'}`,
      },
      {
        id: 'render.observable-difference',
        passed: controlReport.htmlSha256 !== directorReport.htmlSha256
          || controlReport.cssSha256 !== directorReport.cssSha256,
        detail: `html ${controlReport.htmlSha256.slice(0, 12)} vs ${directorReport.htmlSha256.slice(0, 12)}; `
          + `css ${controlReport.cssSha256.slice(0, 12)} vs ${directorReport.cssSha256.slice(0, 12)}`,
      },
      /*
       * The claim this defends is "same words, different design", and it has to
       * be tested on the words the *writer* produced.
       *
       * A raw word count is the wrong instrument and said so on the first run:
       * the director's page came out 34 words shorter, all of it design —
       * `text-transform: uppercase` on the tagline (which `innerText` reports as
       * changed text), the ordinals a numbered section variant draws, and a
       * footer nav the editorial direction drops. None of that is copy. The
       * headings and the section identifiers are.
       */
      {
        id: 'render.same-copy',
        passed: controlDesktop !== undefined
          && directorDesktop !== undefined
          && JSON.stringify(controlDesktop.mainHeadings) === JSON.stringify(directorDesktop.mainHeadings)
          && JSON.stringify(controlDesktop.sectionIds) === JSON.stringify(directorDesktop.sectionIds),
        detail: `${controlDesktop?.mainHeadings.length ?? 0} headings and `
          + `${controlDesktop?.sectionIds.length ?? 0} sections, identical in both variants; `
          + `rendered word counts differ by ${Math.abs((controlDesktop?.words ?? 0) - (directorDesktop?.words ?? 0))} `
          + '(chrome and design ornament, not copy)',
      },
    ];

    const failed = checks.filter((check) => !check.passed);
    const verdict = failed.length === 0 ? 'PASS' : 'FAIL';

    await writeJson(RESULTS, {
      verdict,
      reason: failed.length === 0
        ? 'a single live model call produced a directive that measurably changed the deterministic '
          + 'design and the rendered page, and both variants render as working websites'
        : failed.map((check) => `${check.id}: ${check.detail}`).join(' | '),
      runId: meta.runId,
      startedAt: meta.startedAt,
      finishedAt: new Date().toISOString(),
      ai: {
        calls: aiCalls,
        directiveSource,
        provider: provenance?.provider ?? null,
        model: provenance?.model ?? null,
        requestedModel: provenance?.requestedModel ?? null,
        effort: config.director.effort,
        maxOutputTokens: config.director.maxOutputTokens,
        maxRetries: config.ai.maxRetries,
        inputTokens: provenance?.inputTokens ?? null,
        outputTokens: provenance?.outputTokens ?? null,
        requestId: provenance?.requestId ?? null,
        structuredOutput: provenance?.structuredOutput ?? null,
        finishReason: provenance?.finishReason ?? null,
        startedAt: provenance?.startedAt ?? null,
        finishedAt: provenance?.finishedAt ?? null,
        durationMs: provenance?.durationMs ?? null,
        directiveArtifact: path.relative(ROOT, directivePath).replace(/\\/g, '/'),
        provenanceArtifact: path.relative(ROOT, provenancePath).replace(/\\/g, '/'),
      },
      directive,
      steps: records,
      difference: {
        changedFieldCount: changedPaths.length,
        changedDecisions,
        changedPaths: changedPaths.slice(0, 200),
        control: controlSummary,
        director: directorSummary,
      },
      control: controlReport,
      director: directorReport,
      checks,
    });

    logger.info('smoke test finished', {
      verdict,
      aiCalls,
      directiveSource,
      changedFields: changedPaths.length,
      changedDecisions,
      failedChecks: failed.map((check) => check.id),
      results: path.relative(ROOT, RESULTS),
    });

    process.stdout.write(`\n${verdict}  ${path.relative(ROOT, RESULTS)}\n`);
    for (const check of checks) {
      process.stdout.write(`  ${check.passed ? 'ok  ' : 'FAIL'} ${check.id} — ${check.detail}\n`);
    }

    if (verdict === 'FAIL') process.exitCode = 1;
  } finally {
    await platform.dispose();
    sink.close?.();
  }
}

await main();
