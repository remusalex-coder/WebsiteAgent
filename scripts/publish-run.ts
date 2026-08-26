/**
 * Turn a finished run into a persistent, inspectable deliverable.
 *
 *   npm run publish -- <runId>
 *
 * The pipeline writes its own artifacts (`1-discovery.json` … `site/`) into the
 * run directory. Those names are good for resuming a run and bad for handing
 * one to a person, so this assembles the canonical tree beside them:
 *
 *   artifacts/<runId>/
 *     input/        the single input the whole system took
 *     evidence/     discovery, collected, profile — what was actually established
 *     strategy/     what the site should do, and why
 *     ux/           information architecture and the conversion path
 *     content/      what the site says
 *     directive/    the art director's decision, and its provenance
 *     design/       the deterministic design it produced
 *     render/       index.html + assets — the website itself
 *     screenshots/  desktop.png, mobile.png
 *     qa/           browser, accessibility, security and performance checks
 *     provenance/   run.json — one file answering "where did this come from"
 *
 * Then it opens the rendered site in a real browser and checks it works. A run
 * that renders but does not *work* is not a deliverable, and the only way to
 * know the difference is to load it.
 *
 * Nothing here re-runs a stage and nothing here calls a model. It is safe to run
 * as many times as you like.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const runId = process.argv[2];
if (runId === undefined) throw new Error('usage: publish-run.ts <runId>');

const ARTIFACTS_ROOT = path.resolve(process.env.ARTIFACTS_DIR ?? path.join(ROOT, 'artifacts'));
const RUN = path.join(ARTIFACTS_ROOT, runId);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function exists(target: string): Promise<boolean> {
  try { await fs.access(target); return true; } catch { return false; }
}

async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch { return null; }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function copyDir(from: string, to: string): Promise<void> {
  if (!(await exists(from))) return;
  await fs.mkdir(to, { recursive: true });
  await fs.cp(from, to, { recursive: true });
}

const rel = (p: string): string => path.relative(ROOT, p).replace(/\\/g, '/');

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

interface Check {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function inspect(indexPath: string, shotDir: string) {
  await fs.mkdir(shotDir, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const viewports: Record<string, unknown>[] = [];
  let security: Record<string, unknown> = {};
  let performance: Record<string, unknown> = {};

  try {
    for (const { name, width, height } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });

      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${name}: ${m.text()}`); });
      page.on('pageerror', (e) => pageErrors.push(`${name}: ${e.message}`));
      page.on('requestfailed', (r) => {
        failedRequests.push(`${name}: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`);
      });
      page.on('response', (r) => {
        if (r.status() >= 400) failedRequests.push(`${name}: HTTP ${r.status()} ${r.url()}`);
      });

      const startedAt = Date.now();
      await page.goto(`file://${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
      const loadMs = Date.now() - startedAt;

      // Decode every image before the viewport is touched. `fullPage: true`
      // resizes and re-runs the lazy heuristics, which captures a gallery as a
      // white band that looks exactly like broken CSS. See scripts/shoot.ts.
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) img.removeAttribute('loading');
        await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : i.decode().catch(() => null))));
      });
      await page.waitForTimeout(600);

      const measured = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        // The skip link is an accessibility affordance, not navigation.
        const inPage = anchors.filter((a) =>
          (a.getAttribute('href') ?? '').startsWith('#') && !a.classList.contains('skip-link'));
        /*
         * `#` and `#top` are not dead.
         *
         * The HTML fragment-navigation algorithm defines both as the top of the
         * document, with no element required — which is why the brand link uses
         * `#top` and why `lib/render/document.ts` says it "needs no element".
         * A checker that does not know that reports a working link as broken
         * and invites someone to "fix" correct markup.
         */
        const dead = inPage
          .map((a) => a.getAttribute('href') ?? '')
          .filter((h) => h.length > 1
            && h.toLowerCase() !== '#top'
            && document.querySelector(`[id="${h.slice(1)}"]`) === null);

        return {
          title: document.title,
          words: (document.body.innerText.match(/\S+/g) ?? []).length,
          images: document.images.length,
          brokenImages: Array.from(document.images).filter((i) => i.naturalWidth === 0).length,
          imagesMissingAlt: Array.from(document.images).filter((i) => !i.hasAttribute('alt')).length,
          sections: document.querySelectorAll('section').length,
          h1Count: document.querySelectorAll('h1').length,
          headingText: document.querySelector('h1')?.textContent?.trim() ?? '',
          links: anchors.length,
          inPageLinks: inPage.length,
          deadLinks: dead,
          ctas: document.querySelectorAll('a.button').length,
          primaryCtas: document.querySelectorAll('a.button--primary').length,
          actionable: Array.from(document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="maps."], a[href^="https://"]'))
            .map((a) => a.getAttribute('href') ?? '').slice(0, 40),
          lang: document.documentElement.getAttribute('lang') ?? '',
          hasSkipLink: document.querySelector('a[href="#main"], .skip-link') !== null,
          hasMainLandmark: document.querySelector('main') !== null,
          documentHeight: document.documentElement.scrollHeight,
          horizontalOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      /*
       * Navigation is only proven by using it — but not via the first
       * `a[href^="#"]` on the page, which is the skip link. That is positioned
       * off-viewport until focused, so Playwright waits for it to become
       * clickable until the run times out. Ask for a nav link.
       */
      const NAV_LINK = 'nav a[href^="#"]:not(.skip-link)';
      let navigationWorks: boolean | null = null;
      if (await page.locator(NAV_LINK).count() > 0) {
        const href = await page.getAttribute(NAV_LINK, 'href');
        await page.click(NAV_LINK);
        await page.waitForTimeout(400);
        navigationWorks = await page.evaluate((h: string | null) => {
          if (h === null) return false;
          const el = document.querySelector(`[id="${h.slice(1)}"]`);
          return el !== null && window.location.hash === h && el.getBoundingClientRect().top < window.innerHeight;
        }, href);
        await page.evaluate(() => { window.scrollTo(0, 0); });
        await page.waitForTimeout(200);
      }

      // The primary CTA has to actually go somewhere.
      let primaryCtaTarget: string | null = null;
      if (measured.primaryCtas > 0) {
        primaryCtaTarget = await page.getAttribute('a.button--primary', 'href');
      }

      if (name === 'desktop') {
        security = await page.evaluate(() => {
          const attrs: string[] = [];
          for (const el of Array.from(document.querySelectorAll('*'))) {
            for (const a of Array.from(el.attributes)) {
              if (a.name.startsWith('on')) attrs.push(`${el.tagName.toLowerCase()}[${a.name}]`);
            }
          }
          const hrefs = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? '');
          return {
            inlineEventHandlers: attrs,
            javascriptUrls: hrefs.filter((h) => /^\s*javascript:/i.test(h)),
            dataUrls: hrefs.filter((h) => /^\s*data:/i.test(h)),
            insecureHttpResources: [
              ...Array.from(document.images).map((i) => i.getAttribute('src') ?? ''),
              ...Array.from(document.querySelectorAll('link[href], script[src]'))
                .map((e) => e.getAttribute('href') ?? e.getAttribute('src') ?? ''),
            ].filter((u) => /^http:\/\//i.test(u)),
            externalLinksWithoutNoopener: Array.from(document.querySelectorAll('a[target="_blank"]'))
              .filter((a) => !(a.getAttribute('rel') ?? '').includes('noopener'))
              .map((a) => a.getAttribute('href') ?? ''),
            scriptTags: document.querySelectorAll('script').length,
            externalScripts: Array.from(document.querySelectorAll('script[src]'))
              .map((s) => s.getAttribute('src') ?? '')
              .filter((s) => /^https?:/i.test(s)),
            iframes: Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src') ?? ''),
            formsWithoutAction: Array.from(document.querySelectorAll('form'))
              .filter((f) => !f.getAttribute('action')).length,
          };
        });
        performance = { loadMs, ...(await page.evaluate(() => ({
          domNodes: document.querySelectorAll('*').length,
          images: document.images.length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
        }))) };
      }

      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(fullHeight, 20_000) });
      await page.waitForTimeout(400);

      const shot = path.join(shotDir, `${name}.png`);
      await page.screenshot({ path: shot });
      const stat = await fs.stat(shot);

      viewports.push({
        viewport: name, width, height, loadMs,
        screenshot: rel(shot), screenshotBytes: stat.size,
        navigationWorks, primaryCtaTarget, ...measured,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return { consoleErrors, pageErrors, failedRequests, viewports, security, performance };
}

function checksFor(report: Awaited<ReturnType<typeof inspect>>): Check[] {
  const checks: Check[] = [];
  const add = (id: string, passed: boolean, detail: string): void => { checks.push({ id, passed, detail }); };
  const sec = report.security as Record<string, string[] | number>;
  const list = (k: string): string[] => (Array.isArray(sec[k]) ? sec[k] as string[] : []);

  add('page.loads', report.pageErrors.length === 0,
    report.pageErrors.length === 0 ? 'no uncaught page errors' : report.pageErrors.join('; '));
  add('page.no-console-errors', report.consoleErrors.length === 0,
    report.consoleErrors.length === 0 ? 'console clean' : report.consoleErrors.join('; '));
  add('page.no-failed-requests', report.failedRequests.length === 0,
    report.failedRequests.length === 0 ? 'every request resolved' : report.failedRequests.join('; '));

  for (const v of report.viewports as Record<string, never>[]) {
    const name = v['viewport'] as unknown as string;
    const n = (k: string): number => Number(v[k] ?? 0);
    const s = (k: string): string => String(v[k] ?? '');
    const arr = (k: string): string[] => (Array.isArray(v[k]) ? v[k] as unknown as string[] : []);

    add(`${name}.heading`, s('headingText').length > 0 && n('h1Count') === 1,
      `${n('h1Count')} h1 — "${s('headingText')}"`);
    add(`${name}.primary-cta`, n('primaryCtas') >= 1 && s('primaryCtaTarget') !== '',
      `${n('primaryCtas')} primary CTA → ${s('primaryCtaTarget') || '(none)'}`);
    add(`${name}.navigation`, v['navigationWorks'] === true,
      `${n('inPageLinks')} in-page links, click resolved: ${String(v['navigationWorks'])}`);
    add(`${name}.links-resolve`, arr('deadLinks').length === 0,
      `${n('links')} links, ${arr('deadLinks').length} dead${arr('deadLinks').length ? `: ${arr('deadLinks').join(', ')}` : ''}`);
    add(`${name}.images-load`, n('brokenImages') === 0, `${n('images')} images, ${n('brokenImages')} broken`);
    add(`${name}.no-horizontal-overflow`, n('horizontalOverflowPx') <= 1, `${n('horizontalOverflowPx')}px overflow`);
    add(`${name}.content-rendered`, n('words') >= 50, `${n('words')} words across ${n('sections')} sections`);
    add(`${name}.screenshot`, n('screenshotBytes') > 5_000, `${s('screenshot')} (${n('screenshotBytes')} bytes)`);
    add(`${name}.a11y-landmarks`, v['hasMainLandmark'] === true && s('lang') !== '',
      `lang="${s('lang')}", main landmark: ${String(v['hasMainLandmark'])}, skip link: ${String(v['hasSkipLink'])}`);
    add(`${name}.a11y-image-alt`, n('imagesMissingAlt') === 0, `${n('imagesMissingAlt')} images without alt`);
  }

  add('security.no-inline-handlers', list('inlineEventHandlers').length === 0,
    `${list('inlineEventHandlers').length} inline on* attributes`);
  add('security.no-javascript-urls', list('javascriptUrls').length === 0,
    `${list('javascriptUrls').length} javascript: hrefs`);
  add('security.no-mixed-content', list('insecureHttpResources').length === 0,
    `${list('insecureHttpResources').length} http:// subresources`);
  add('security.external-links-noopener', list('externalLinksWithoutNoopener').length === 0,
    `${list('externalLinksWithoutNoopener').length} target=_blank without rel=noopener`);
  add('security.no-external-scripts', list('externalScripts').length === 0,
    `${list('externalScripts').length} third-party scripts (${Number(sec['scriptTags'] ?? 0)} script tags total)`);

  return checks;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

if (!(await exists(RUN))) {
  throw new Error(`no run at ${RUN}. Run the pipeline with OUTPUT_DIR=./artifacts first.`);
}

const site = path.join(RUN, 'site');
if (!(await exists(path.join(site, 'index.html')))) {
  throw new Error(`${site}/index.html is not there — the run did not reach the render stage.`);
}

// --- assemble the canonical tree ---------------------------------------

const discovery = await readJson<Record<string, unknown>>(path.join(RUN, '1-discovery.json'));
const collected = await readJson<Record<string, unknown>>(path.join(RUN, '2-collected.json'));
const profile = await readJson<Record<string, unknown>>(path.join(RUN, '3-profile.json'));
const strategy = await readJson<Record<string, unknown>>(path.join(RUN, '4-strategy.json'));
const content = await readJson<Record<string, unknown>>(path.join(RUN, '5-content.json'));
const directed = await readJson<Record<string, unknown>>(path.join(RUN, '5a-directive.json'));
const design = await readJson<Record<string, unknown>>(path.join(RUN, '5b-design.json'));

await writeJson(path.join(RUN, 'input', 'input.json'), {
  runId,
  sourceUrl: discovery?.['sourceUrl'] ?? null,
  canonicalUrl: discovery?.['canonicalUrl'] ?? null,
});
await writeJson(path.join(RUN, 'evidence', 'discovery.json'), discovery);
await writeJson(path.join(RUN, 'evidence', 'collected.json'), collected);
await writeJson(path.join(RUN, 'evidence', 'profile.json'), profile);
await writeJson(path.join(RUN, 'strategy', 'strategy.json'), strategy);
await writeJson(path.join(RUN, 'content', 'content.json'), content);
await writeJson(path.join(RUN, 'directive', 'directive.json'), directed?.['directive'] ?? null);
await writeJson(path.join(RUN, 'directive', 'provenance.json'), directed?.['provenance'] ?? null);
await writeJson(path.join(RUN, 'design', 'design.json'), design);

// UX is not a stage of its own: the information architecture is the strategy's
// page plan plus the design's section order and conversion path. Collected here
// so it can be reviewed as one thing rather than inferred from two files.
const layout = (design?.['layout'] ?? {}) as Record<string, unknown>;
await writeJson(path.join(RUN, 'ux', 'information-architecture.json'), {
  recommendedPages: strategy?.['pages'] ?? [],
  hero: layout['hero'] ?? null,
  sectionOrder: Array.isArray(layout['sections'])
    ? (layout['sections'] as Record<string, unknown>[]).map((s) => ({
        kind: s['kind'], variant: s['variant'], background: s['background'],
      }))
    : [],
  navigation: layout['navigation'] ?? null,
});

await copyDir(site, path.join(RUN, 'render'));

// --- QA the actual website ---------------------------------------------

const report = await inspect(path.join(RUN, 'render', 'index.html'), path.join(RUN, 'screenshots'));
const checks = checksFor(report);
const failed = checks.filter((c) => !c.passed);

await writeJson(path.join(RUN, 'qa', 'qa.json'), {
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  checkedAt: new Date().toISOString(),
  checks,
  browser: {
    consoleErrors: report.consoleErrors,
    pageErrors: report.pageErrors,
    failedRequests: report.failedRequests,
    viewports: report.viewports,
  },
  security: report.security,
  performance: report.performance,
});

const indexHtml = path.join(RUN, 'render', 'index.html');
await writeJson(path.join(RUN, 'provenance', 'run.json'), {
  runId,
  publishedAt: new Date().toISOString(),
  input: { sourceUrl: discovery?.['sourceUrl'] ?? null },
  business: profile?.['name'] ?? null,
  ai: {
    directive: directed?.['provenance'] ?? null,
    analystModel: strategy?.['model'] ?? null,
    writerModel: content?.['model'] ?? null,
  },
  design: {
    direction: ((design?.['personality'] ?? {}) as Record<string, unknown>)['direction'] ?? null,
    world: design?.['world'] ?? null,
    industry: ((design?.['industry'] ?? {}) as Record<string, unknown>)['id'] ?? null,
    patterns: design?.['patterns'] ?? [],
  },
  artifacts: {
    html: rel(indexHtml),
    htmlSha256: crypto.createHash('sha256').update(await fs.readFile(indexHtml)).digest('hex'),
    screenshots: {
      desktop: rel(path.join(RUN, 'screenshots', 'desktop.png')),
      mobile: rel(path.join(RUN, 'screenshots', 'mobile.png')),
    },
    directive: rel(path.join(RUN, 'directive', 'directive.json')),
    design: rel(path.join(RUN, 'design', 'design.json')),
    qa: rel(path.join(RUN, 'qa', 'qa.json')),
  },
  preview: `npm run preview -- ${runId}`,
  qaVerdict: failed.length === 0 ? 'PASS' : 'FAIL',
});

process.stdout.write(`\n${failed.length === 0 ? 'PASS' : 'FAIL'}  ${rel(RUN)}\n`);
for (const c of checks) {
  process.stdout.write(`  ${c.passed ? 'ok  ' : 'FAIL'} ${c.id} — ${c.detail}\n`);
}
process.stdout.write(`\nPreview:  npm run preview -- ${runId}\n`);
if (failed.length > 0) process.exitCode = 1;
