/**
 * Experience Intent V1 smoke test.
 *
 *   npm run experience-intent               # full run: STANDARD + MOMENT-LED + DIRECTOR
 *   npm run experience-intent -- --deterministic-only   # no AI call at all
 *
 * Three variants, identical business, identical fixture:
 *
 *   STANDARD    fixture → composeDesign(applyDirective({ mode: 'standard' }))
 *   MOMENT-LED  fixture → composeDesign(applyDirective({ mode: 'moment-led',
 *                          moment: 'gallery', ... }))       — hand-supplied, no AI
 *   DIRECTOR    fixture → designDirectorAgent (REAL AI, one call)
 *                       → DesignDirective.experienceIntent
 *                       → applyDirective() → composeDesign()
 *
 * STANDARD and MOMENT-LED answer the question this milestone is actually
 * about, at zero cost: does a hand-supplied ExperienceIntent reach the
 * rendered page, in a bounded and visible way, without the model in the
 * loop at all? DIRECTOR is a narrower, separate question — can the model
 * populate the new contract sensibly — and costs exactly one call, made
 * only after every deterministic check below has already passed.
 *
 * Reuses the fixture, placeholder-imagery and browser-check machinery from
 * design-director-smoke.ts's own approach rather than importing its private
 * functions — this script does not modify or depend on that one, so proving
 * this milestone's contract can never regress the smoke test that proved
 * the Director's production integration.
 *
 * Artifacts land in smoke-test/experience-intent/, not gitignored, same
 * policy as smoke-test/control and smoke-test/director.
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
import type { DesignDirective, ExperienceIntent } from '../lib/design/directive.js';
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
const SMOKE = path.join(ROOT, 'smoke-test', 'experience-intent');

const STANDARD = path.join(SMOKE, 'standard');
const MOMENT_LED = path.join(SMOKE, 'moment-led');
const DIRECTOR = path.join(SMOKE, 'director');

const RESULTS = path.join(SMOKE, 'results.json');
const RUN_LOG = path.join(SMOKE, 'run.log.ndjson');
const RUN_META = path.join(SMOKE, 'run.meta.json');

const deterministicOnly = process.argv.includes('--deterministic-only');

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
/* The fixture — same shape as design-director-smoke.ts's, a business  */
/* where a moment-led decision is reasonable (real gallery photography) */
/* ------------------------------------------------------------------ */

const SITE = 'https://example.test';

function svgAsset(base: ImageAsset, name: string): ImageAsset {
  return { ...base, url: `${SITE}/${name}`, localPath: `assets/${name}` };
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

  const gallery: readonly ImageAsset[] = [
    svgAsset(logo, 'gallery-1.svg'),
    svgAsset(logo, 'gallery-2.svg'),
    svgAsset(logo, 'gallery-3.svg'),
    svgAsset(logo, 'gallery-4.svg'),
  ].map((asset): ImageAsset => ({
    ...asset, role: 'gallery', alt: 'The counter at opening time', width: 1200, height: 900,
  }));

  const sections: readonly WebsiteSection[] = fullContent.sections.map((section) => {
    if (section.kind === 'hero') return { ...section, images: [logoImage, faviconImage, heroImage] };
    if (section.kind === 'gallery') return { ...section, images: [...gallery, ...section.images.slice(1)] };
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
      pages: [{
        url: SITE,
        title: 'Padaria Ana & Sons',
        text: [
          'Bread baked before dawn. A neighbourhood bakery on Rua da Prata.',
          'We mill our own flour and bake through the night.',
          'Everything is sold the day it is made. Two ovens, four bakers and one long counter.',
        ].join(' '),
      }],
    }),
    images: { logo: logoImage, favicon: faviconImage, hero: heroImage, gallery: [...gallery] },
  };

  return { profile, strategy: strategyFixture(), content };
}

/** Identical, deterministic placeholder imagery — a real difference in the
 * screenshots can only come from the design, never from a different photo. */
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
    await fs.writeFile(path.join(dir, localPath), placeholderSvg(hero ? 1600 : 1200, 900), 'utf8');
  }));
}

async function renderVariant(dir: string, content: WebsiteContent, design: WebsiteDesign): Promise<readonly string[]> {
  const site = renderSite(content, { design });
  await fs.mkdir(dir, { recursive: true });
  await writePlaceholders(dir, site.assets.map((asset) => asset.sourcePath));
  const { missingAssets } = await writeRenderedSite(site, { sourceDir: dir, targetDir: dir });
  return [...site.warnings, ...missingAssets.map((asset) => `asset not found: ${asset}`)];
}

/* ------------------------------------------------------------------ */
/* Browser checks — functional QA + the reduced-motion / trap checks   */
/* this milestone specifically asks for                                */
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
  readonly hasMomentSection: boolean;
  readonly momentContrastRatio: number | null;
  readonly screenshot: string;
  readonly screenshotBytes: number;
  readonly navigationWorks: boolean | null;
}

interface VariantReport {
  readonly variant: string;
  readonly htmlPath: string;
  readonly htmlBytes: number;
  readonly htmlSha256: string;
  readonly cssSha256: string;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly rendererWarnings: readonly string[];
  readonly reducedMotion: { readonly consoleErrors: readonly string[]; readonly screenshot: string };
  readonly viewports: readonly ViewportReport[];
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

/** WCAG relative luminance / contrast — same formula the design layer itself uses. */
function contrastOf(fg: string, bg: string): number {
  const lum = (hex: string): number => {
    const n = parseInt(hex.replace('#', ''), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (l1! + 0.05) / (l2! + 0.05);
}

async function inspectVariant(variant: string, dir: string, rendererWarnings: readonly string[], logger: Logger): Promise<VariantReport> {
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
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${name}: ${m.text()}`); });
      page.on('pageerror', (e) => pageErrors.push(`${name}: ${e.message}`));
      page.on('requestfailed', (r) => failedRequests.push(`${name}: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`));
      page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${name}: HTTP ${r.status()} ${r.url()}`); });

      await page.goto(`file://${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) img.removeAttribute('loading');
        await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))));
      });
      await page.waitForTimeout(600);

      const measured = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('nav a[href^="#"]'));
        const dead = anchors
          .map((a) => a.getAttribute('href') ?? '')
          .filter((href) => href.length > 1 && document.querySelector(`[id="${href.slice(1)}"]`) === null);
        const moment = document.querySelector('.section--moment');
        return {
          words: (document.body.innerText.match(/\S+/g) ?? []).length,
          images: document.images.length,
          brokenImages: Array.from(document.images).filter((img) => img.naturalWidth === 0).length,
          sections: document.querySelectorAll('section').length,
          navLinks: anchors.length,
          deadNavLinks: dead,
          primaryCtas: document.querySelectorAll('a.button--primary').length,
          headingText: document.querySelector('h1')?.textContent?.trim() ?? '',
          documentHeight: document.documentElement.scrollHeight,
          horizontalOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hasMomentSection: moment !== null,
          textColor: moment ? getComputedStyle(moment.querySelector('h2, h3, p') ?? moment).color : null,
          groundColor: moment ? getComputedStyle(moment).backgroundColor : null,
        };
      });

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
        documentHeight: measured.documentHeight,
        horizontalOverflowPx: measured.horizontalOverflowPx,
        words: measured.words,
        images: measured.images,
        brokenImages: measured.brokenImages,
        sections: measured.sections,
        navLinks: measured.navLinks,
        deadNavLinks: measured.deadNavLinks,
        primaryCtas: measured.primaryCtas,
        headingText: measured.headingText,
        hasMomentSection: measured.hasMomentSection,
        momentContrastRatio: measured.textColor !== null && measured.groundColor !== null
          ? contrastOf(rgbToHex(measured.textColor), rgbToHex(measured.groundColor))
          : null,
        screenshot: path.relative(ROOT, screenshot).replace(/\\/g, '/'),
        screenshotBytes: stat.size,
        navigationWorks,
      });

      await page.close();
    }
  } finally {
    await browser.close();
  }

  // Reduced motion: a separate pass, checking the page still loads clean and
  // still works — this is the "does not trap the user" / accessibility check.
  const reducedErrors: string[] = [];
  const rmScreenshot = path.join(shotDir, 'desktop-reduced-motion.png');
  {
    const browser2 = await chromium.launch({ headless: true });
    const page = await browser2.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', (e) => reducedErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') reducedErrors.push(m.text()); });
    await page.goto(`file://${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    // Prove interaction still works under reduced motion — clicking the CTA
    // must not be blocked by anything the transition primitive left behind.
    const cta = await page.$('a.button--primary');
    if (cta !== null) await cta.click({ trial: true }).catch(() => { reducedErrors.push('primary CTA not clickable under reduced motion'); });
    await page.screenshot({ path: rmScreenshot, fullPage: false });
    await browser2.close();
  }

  const [htmlStat] = await Promise.all([fs.stat(indexPath), fs.stat(cssPath)]);

  return {
    variant,
    htmlPath: path.relative(ROOT, indexPath).replace(/\\/g, '/'),
    htmlBytes: htmlStat.size,
    htmlSha256: await sha256(indexPath),
    cssSha256: await sha256(cssPath),
    consoleErrors,
    pageErrors,
    failedRequests,
    rendererWarnings,
    reducedMotion: {
      consoleErrors: reducedErrors,
      screenshot: path.relative(ROOT, rmScreenshot).replace(/\\/g, '/'),
    },
    viewports,
  };
}

function rgbToHex(rgb: string): string {
  const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (m === null) return '#000000';
  const [, r, g, b] = m;
  return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
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
  const add = (id: string, passed: boolean, detail: string): void => { checks.push({ id: `${report.variant}.${id}`, passed, detail }); };

  add('html-loads', report.pageErrors.length === 0, report.pageErrors.length === 0 ? 'no uncaught page errors' : report.pageErrors.join('; '));
  add('no-console-errors', report.consoleErrors.length === 0, report.consoleErrors.length === 0 ? 'console clean' : report.consoleErrors.join('; '));
  add('no-failed-requests', report.failedRequests.length === 0, report.failedRequests.length === 0 ? 'every request resolved' : report.failedRequests.join('; '));
  add('reduced-motion.no-console-errors', report.reducedMotion.consoleErrors.length === 0,
    report.reducedMotion.consoleErrors.length === 0 ? 'console clean under reduced motion' : report.reducedMotion.consoleErrors.join('; '));

  for (const view of report.viewports) {
    add(`${view.viewport}.heading`, view.headingText.length > 0, `h1 = "${view.headingText}"`);
    add(`${view.viewport}.primary-cta`, view.primaryCtas >= 1, `${view.primaryCtas} primary call(s) to action`);
    add(`${view.viewport}.navigation`, view.navigationWorks === true, `${view.navLinks} in-page links, click resolved: ${String(view.navigationWorks)}`);
    add(`${view.viewport}.images-load`, view.brokenImages === 0, `${view.images} images, ${view.brokenImages} broken`);
    add(`${view.viewport}.no-horizontal-overflow`, view.horizontalOverflowPx <= 1, `${view.horizontalOverflowPx}px overflow`);
    add(`${view.viewport}.content-rendered`, view.words >= 50 && view.sections >= 5, `${view.words} words across ${view.sections} sections`);
    add(`${view.viewport}.screenshot`, view.screenshotBytes > 5_000, `${view.screenshot} (${view.screenshotBytes} bytes)`);
    if (view.momentContrastRatio !== null) {
      add(`${view.viewport}.moment-contrast`, view.momentContrastRatio >= 4.5, `${view.momentContrastRatio.toFixed(2)}:1`);
    }
  }

  return checks;
}

/* ------------------------------------------------------------------ */
/* Job runner (same resumable-step shape as design-director-smoke.ts)  */
/* ------------------------------------------------------------------ */

type StepStatus = 'produced' | 'resumed';
interface StepRecord { readonly id: string; readonly status: StepStatus; readonly artifacts: readonly string[]; readonly durationMs: number; }

async function step<T>(
  records: StepRecord[], logger: Logger, id: string, artifacts: readonly string[],
  produce: () => Promise<T>, resume: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const relative = artifacts.map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
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

function oneCallOnly(provider: AIProvider, onCall: () => void): AIProvider {
  let calls = 0;
  return {
    ...provider,
    async generate(request) {
      calls += 1;
      if (calls > 1) {
        throw new Error(`the experience-intent smoke test attempted AI call #${calls}; exactly one is allowed.`);
      }
      onCall();
      return provider.generate(request);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

interface RunMeta { readonly runId: string; readonly startedAt: string; }

const STANDARD_INTENT: ExperienceIntent = {
  mode: 'standard', moment: null, momentIntent: null, transitionAtMoment: false,
};

const MOMENT_LED_INTENT: ExperienceIntent = {
  mode: 'moment-led',
  moment: 'testimonials',
  momentIntent: 'A real customer review is the strongest evidence this business has, and it starts at the '
    + '"quiet" tier by default — the emphasis step here crosses into a genuinely different heading scale, '
    + 'not just a data attribute.',
  transitionAtMoment: true,
};

async function main(): Promise<void> {
  await fs.mkdir(SMOKE, { recursive: true });

  const meta: RunMeta = await exists(RUN_META)
    ? await readJson<RunMeta>(RUN_META)
    : { runId: crypto.randomUUID().slice(0, 8), startedAt: new Date().toISOString() };
  await writeJson(RUN_META, meta);

  const sink = createMultiSink(createConsoleSink(), createFileSink(RUN_LOG));
  const base = loadConfig();
  const config: AppConfig = {
    ...base,
    outputDir: SMOKE,
    ai: { ...base.ai, maxRetries: 0 },
    director: { ...base.director, enabled: true },
  };
  const logger = createLogger({ level: config.logLevel, scope: `experience-intent.${meta.runId}`, baseFields: { runId: meta.runId }, sink });
  const controller = new AbortController();
  const records: StepRecord[] = [];
  const input = smokeInput();

  const platform = await createPlatform({ config, logger, signal: controller.signal, outputDir: SMOKE });

  try {
    logger.info('experience-intent smoke test started', { deterministicOnly, artifacts: path.relative(ROOT, SMOKE) });

    /* ---------------- STANDARD (no AI) ---------------- */

    const standardDesign = await step(records, logger, 'standard.design', [path.join(STANDARD, 'design.json')],
      async () => { const d = composeDesign(input, applyDirective({ experienceIntent: STANDARD_INTENT })); await writeJson(path.join(STANDARD, 'design.json'), d); return d; },
      () => readJson<WebsiteDesign>(path.join(STANDARD, 'design.json')));
    const standardWarnings = await step(records, logger, 'standard.render', [path.join(STANDARD, 'index.html'), path.join(STANDARD, 'styles.css')],
      () => renderVariant(STANDARD, input.content, standardDesign), async () => []);
    const standardReport = await step(records, logger, 'standard.shoot',
      [path.join(STANDARD, 'screenshots', 'desktop.png'), path.join(STANDARD, 'screenshots', 'mobile.png'), path.join(STANDARD, 'report.json')],
      async () => { const r = await inspectVariant('standard', STANDARD, standardWarnings, logger); await writeJson(path.join(STANDARD, 'report.json'), r); return r; },
      () => readJson<VariantReport>(path.join(STANDARD, 'report.json')));

    /* ---------------- MOMENT-LED (no AI, hand-supplied) ---------------- */

    const momentDesign = await step(records, logger, 'moment-led.design', [path.join(MOMENT_LED, 'design.json')],
      async () => { const d = composeDesign(input, applyDirective({ experienceIntent: MOMENT_LED_INTENT })); await writeJson(path.join(MOMENT_LED, 'design.json'), d); return d; },
      () => readJson<WebsiteDesign>(path.join(MOMENT_LED, 'design.json')));
    const momentWarnings = await step(records, logger, 'moment-led.render', [path.join(MOMENT_LED, 'index.html'), path.join(MOMENT_LED, 'styles.css')],
      () => renderVariant(MOMENT_LED, input.content, momentDesign), async () => []);
    const momentReport = await step(records, logger, 'moment-led.shoot',
      [path.join(MOMENT_LED, 'screenshots', 'desktop.png'), path.join(MOMENT_LED, 'screenshots', 'mobile.png'), path.join(MOMENT_LED, 'report.json')],
      async () => { const r = await inspectVariant('moment-led', MOMENT_LED, momentWarnings, logger); await writeJson(path.join(MOMENT_LED, 'report.json'), r); return r; },
      () => readJson<VariantReport>(path.join(MOMENT_LED, 'report.json')));

    const deterministicChecks: Check[] = [
      ...functionalChecks(standardReport),
      ...functionalChecks(momentReport),
      {
        id: 'moment.section-present-only-in-moment-led',
        passed: momentReport.viewports.every((v) => v.hasMomentSection) && standardReport.viewports.every((v) => !v.hasMomentSection),
        detail: `standard: ${standardReport.viewports.map((v) => v.hasMomentSection).join(',')}; `
          + `moment-led: ${momentReport.viewports.map((v) => v.hasMomentSection).join(',')}`,
      },
      {
        id: 'visible-difference.html',
        passed: standardReport.htmlSha256 !== momentReport.htmlSha256,
        detail: `standard ${standardReport.htmlSha256.slice(0, 12)} vs moment-led ${momentReport.htmlSha256.slice(0, 12)}`,
      },
      {
        id: 'moment-emphasis-differs',
        passed: standardDesign.layout.sections.find((s) => s.kind === 'testimonials')?.emphasis
          !== momentDesign.layout.sections.find((s) => s.kind === 'testimonials')?.emphasis,
        detail: `standard: ${standardDesign.layout.sections.find((s) => s.kind === 'testimonials')?.emphasis}; `
          + `moment-led: ${momentDesign.layout.sections.find((s) => s.kind === 'testimonials')?.emphasis}`,
      },
    ];

    const deterministicFailed = deterministicChecks.filter((c) => !c.passed);

    if (deterministicOnly || deterministicFailed.length > 0) {
      const verdict = deterministicFailed.length === 0 ? 'PASS' : 'FAIL';
      await writeJson(RESULTS, {
        verdict,
        reason: deterministicFailed.length === 0
          ? (deterministicOnly ? 'INCOMPLETE: --deterministic-only, no AI call made' : 'deterministic checks failed before any AI call was attempted')
          : deterministicFailed.map((c) => `${c.id}: ${c.detail}`).join(' | '),
        runId: meta.runId,
        ai: { calls: 0 },
        steps: records,
        standard: { design: standardDesign, report: standardReport },
        momentLed: { design: momentDesign, report: momentReport },
        checks: deterministicChecks,
      });
      process.stdout.write(`\n${verdict}  ${path.relative(ROOT, RESULTS)}\n`);
      for (const check of deterministicChecks) process.stdout.write(`  ${check.passed ? 'ok  ' : 'FAIL'} ${check.id} — ${check.detail}\n`);
      if (deterministicFailed.length > 0) process.exitCode = 1;
      return;
    }

    /* ---------------- DIRECTOR (exactly one real AI call) ---------------- */

    let aiCalls = 0;
    let directiveSource: 'live' | 'resumed' = 'resumed';
    let provenance: DirectorProvenance | null = null;

    const guarded = oneCallOnly(platform.ai(), () => { aiCalls += 1; });
    const directorPlatform: Platform = { ...platform, ai: () => guarded, tryAi: () => guarded };
    const ctx: AgentContext = {
      runId: meta.runId,
      config,
      logger: logger.child('designDirectorAgent'),
      getBrowser: () => { throw new Error('the design director does not use a browser'); },
      platform: directorPlatform,
      outputDir: SMOKE,
      signal: controller.signal,
    };

    const directivePath = path.join(DIRECTOR, 'directive.json');
    const provenancePath = path.join(DIRECTOR, 'directive.provenance.json');

    const directive = await step(records, logger, 'director.directive', [directivePath, provenancePath],
      async () => { const r = await directDesign(input, ctx); directiveSource = 'live'; provenance = r.provenance; await writeJson(directivePath, r.directive); await writeJson(provenancePath, r.provenance); return r.directive; },
      async () => { provenance = await readJson<DirectorProvenance>(provenancePath); return readJson<DesignDirective>(directivePath); });

    const directorDesign = await step(records, logger, 'director.design', [path.join(DIRECTOR, 'design.json')],
      async () => { const options = applyDirective(directive, {}, logger.child('applyDirective')); const d = composeDesign(input, options); await writeJson(path.join(DIRECTOR, 'design.json'), d); return d; },
      () => readJson<WebsiteDesign>(path.join(DIRECTOR, 'design.json')));

    const directorWarnings = await step(records, logger, 'director.render', [path.join(DIRECTOR, 'index.html'), path.join(DIRECTOR, 'styles.css')],
      () => renderVariant(DIRECTOR, input.content, directorDesign), async () => []);

    const directorReport = await step(records, logger, 'director.shoot',
      [path.join(DIRECTOR, 'screenshots', 'desktop.png'), path.join(DIRECTOR, 'screenshots', 'mobile.png'), path.join(DIRECTOR, 'report.json')],
      async () => { const r = await inspectVariant('director', DIRECTOR, directorWarnings, logger); await writeJson(path.join(DIRECTOR, 'report.json'), r); return r; },
      () => readJson<VariantReport>(path.join(DIRECTOR, 'report.json')));

    const aiChecks: Check[] = [
      ...functionalChecks(directorReport),
      { id: 'ai.exactly-one-call', passed: aiCalls === 1 || (aiCalls === 0 && directiveSource === 'resumed'), detail: `${aiCalls} live call(s) this invocation, source=${directiveSource}` },
      { id: 'ai.directive-is-model-output', passed: provenance !== null, detail: provenance === null ? 'no provenance recorded' : `${provenance.provider}/${provenance.model}, ${String(provenance.inputTokens)} in / ${String(provenance.outputTokens)} out, request ${String(provenance.requestId)}` },
      {
        id: 'ai.experienceIntent-populated',
        passed: directive.experienceIntent !== undefined,
        detail: directive.experienceIntent === undefined
          ? 'model omitted experienceIntent entirely'
          : `mode=${directive.experienceIntent.mode}, moment=${String(directive.experienceIntent.moment)}`,
      },
      {
        id: 'ai.moment-references-real-section-kind',
        passed: directive.experienceIntent === undefined || directive.experienceIntent.mode === 'standard'
          || input.content.sections.some((s) => s.kind === directive.experienceIntent!.moment),
        detail: `nominated "${String(directive.experienceIntent?.moment)}"; business sections: ${input.content.sections.map((s) => s.kind).join(', ')}`,
      },
    ];

    const allChecks = [...deterministicChecks, ...aiChecks];
    const failed = allChecks.filter((c) => !c.passed);
    const verdict = failed.length === 0 ? 'PASS' : 'FAIL';

    await writeJson(RESULTS, {
      verdict,
      reason: failed.length === 0
        ? 'the deterministic standard/moment-led variants differ exactly where intended, and the real '
          + 'Director call populated experienceIntent with a section kind this business actually has'
        : failed.map((c) => `${c.id}: ${c.detail}`).join(' | '),
      runId: meta.runId,
      startedAt: meta.startedAt,
      finishedAt: new Date().toISOString(),
      ai: {
        calls: aiCalls,
        directiveSource,
        provider: provenance?.provider ?? null,
        model: provenance?.model ?? null,
        requestedModel: provenance?.requestedModel ?? null,
        inputTokens: provenance?.inputTokens ?? null,
        outputTokens: provenance?.outputTokens ?? null,
        requestId: provenance?.requestId ?? null,
        finishReason: provenance?.finishReason ?? null,
        startedAt: provenance?.startedAt ?? null,
        finishedAt: provenance?.finishedAt ?? null,
        durationMs: provenance?.durationMs ?? null,
        directiveArtifact: path.relative(ROOT, directivePath).replace(/\\/g, '/'),
        provenanceArtifact: path.relative(ROOT, provenancePath).replace(/\\/g, '/'),
      },
      directive,
      steps: records,
      standard: { design: standardDesign, report: standardReport },
      momentLed: { design: momentDesign, report: momentReport },
      director: { design: directorDesign, report: directorReport },
      checks: allChecks,
    });

    process.stdout.write(`\n${verdict}  ${path.relative(ROOT, RESULTS)}\n`);
    for (const check of allChecks) process.stdout.write(`  ${check.passed ? 'ok  ' : 'FAIL'} ${check.id} — ${check.detail}\n`);
    if (verdict === 'FAIL') process.exitCode = 1;
  } finally {
    await platform.dispose();
    sink.close?.();
  }
}

await main();
