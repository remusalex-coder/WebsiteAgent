/**
 * Generate a set of businesses end to end, then measure every rendered site.
 *
 * The quality loop is mandatory and repeatable: platform defects only count as
 * platform defects when they show up across industries, and that is not a
 * judgement anyone can make from one site. This script is what makes the
 * comparison cheap enough to run after every milestone.
 *
 *   npx tsx scripts/batch-audit.ts            generate + measure everything
 *   npx tsx scripts/batch-audit.ts --measure  re-measure existing runs only
 *
 * Needs `--env-file=.env` for the two model stages:
 *   node --import tsx --env-file=.env scripts/batch-audit.ts
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

export interface BatchBusiness {
  readonly slug: string;
  readonly label: string;
  readonly industry: string;
  readonly mapsUrl: string;
}

/**
 * Five industries, five real listings.
 *
 * Search URLs rather than place URLs because a stable `ftid` is not knowable
 * without visiting first; discovery opens the first result. That makes the set
 * slightly non-deterministic between runs, which is acceptable here — the point
 * is industry coverage, not a fixed corpus.
 */
export const BUSINESSES: readonly BatchBusiness[] = [
  { slug: 'restaurant', label: 'Zuni Café', industry: 'Restaurant', mapsUrl: 'https://www.google.com/maps/search/Zuni+Cafe+1658+Market+St+San+Francisco' },
  { slug: 'dentist', label: 'Union Square Dental', industry: 'Dentist', mapsUrl: 'https://www.google.com/maps/search/Union+Square+Dental+San+Francisco' },
  { slug: 'lawyer', label: 'Kerr & Wagstaffe LLP', industry: 'Lawyer', mapsUrl: 'https://www.google.com/maps/search/Kerr+Wagstaffe+LLP+San+Francisco' },
  { slug: 'hotel', label: 'Hotel Union Square', industry: 'Hotel', mapsUrl: 'https://www.google.com/maps/search/Hotel+Union+Square+114+Powell+St+San+Francisco' },
  { slug: 'salon', label: 'Salon DnA', industry: 'Hair & Beauty Salon', mapsUrl: 'https://www.google.com/maps/search/Salon+DnA+San+Francisco' },
];

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, 'output');
const REGISTRY = path.join(OUTPUT, 'batch.json');

interface RunRecord {
  slug: string;
  label: string;
  industry: string;
  runId: string | null;
  error: string | null;
}

function runDirs(): Set<string> {
  if (!fs.existsSync(OUTPUT)) return new Set();
  return new Set(
    fs
      .readdirSync(OUTPUT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[0-9a-f]{8}$/.test(entry.name))
      .map((entry) => entry.name),
  );
}

/** Runs the whole pipeline for one business in its own process. */
function generate(business: BatchBusiness): RunRecord {
  const before = runDirs();
  process.stdout.write(`\n=== ${business.label} (${business.industry}) ===\n`);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--env-file=.env', 'main.ts', business.mapsUrl],
    { cwd: ROOT, encoding: 'utf8', timeout: 8 * 60_000 },
  );

  // Stage 6 is a stub and always throws; the site is written before it runs, so
  // a non-zero exit is expected and is not a failure of this batch.
  const after = runDirs();
  const created = [...after].filter((dir) => !before.has(dir));
  const runId = created[0] ?? null;

  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  for (const line of log.split('\n')) {
    if (/analysis finished|writing finished|design composed|site rendered|error|Error/.test(line)) {
      process.stdout.write(`${line.slice(0, 240)}\n`);
    }
  }

  if (runId === null) return { ...business, runId: null, error: 'no run directory was created' };
  const hasSite = fs.existsSync(path.join(OUTPUT, runId, 'site', 'index.html'));
  return { ...business, runId, error: hasSite ? null : 'pipeline produced no site' };
}

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

/**
 * Strips lazy loading and waits for decode before capturing.
 *
 * Playwright's fullPage capture resizes the viewport, which re-runs the lazy
 * heuristics — a gallery then screenshots as an empty band and looks exactly
 * like a broken layout. Measured in the DOM it is fine. This cost an hour once.
 */
const FORCE_LOAD = `(async () => {
  const imgs = Array.from(document.querySelectorAll('img'));
  for (const img of imgs) { img.loading = 'eager'; img.setAttribute('fetchpriority', 'high'); }
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
})()`;

const MEASURE = `(() => {
  var header = document.querySelector('header');
  var h1 = document.querySelector('h1');
  var nav = document.querySelector('nav');
  var imgs = document.querySelectorAll('img');
  var broken = 0;
  for (var i = 0; i < imgs.length; i++) { if (!imgs[i].naturalWidth) broken++; }
  var links = [];
  if (nav) { var as = nav.querySelectorAll('a'); for (var k = 0; k < as.length; k++) links.push((as[k].textContent||'').trim()); }
  var secs = [];
  var all = document.querySelectorAll('section');
  for (var j = 0; j < all.length; j++) {
    var s = all[j];
    var m = s.className.match(/section--([a-z]+)/);
    secs.push({ kind: m ? m[1] : '?', variant: s.getAttribute('data-variant'), frame: s.getAttribute('data-frame'),
      emphasis: s.getAttribute('data-emphasis'), height: Math.round(s.getBoundingClientRect().height),
      imgs: s.querySelectorAll('img').length, words: (s.textContent||'').trim().split(/\\s+/).length });
  }
  return {
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
    navLabels: links,
    h1Size: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : null,
    h1Font: h1 ? getComputedStyle(h1).fontFamily.split(',')[0].replace(/"/g,'') : null,
    bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g,''),
    totalImgs: imgs.length, brokenImgs: broken,
    mediaFills: document.querySelectorAll('.media-fill').length,
    ctas: document.querySelectorAll('.button').length,
    externalCtas: Array.from(document.querySelectorAll('.button')).filter(function(a){ return (a.getAttribute('href')||'').startsWith('http'); }).length,
    pageHeight: Math.round(document.body.scrollHeight),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    sections: secs
  };
})()`;

async function measure(record: RunRecord): Promise<Record<string, unknown>> {
  if (record.runId === null) return { ...record, measured: false };
  const dir = path.join(OUTPUT, record.runId);
  const url = `file:///${path.join(dir, 'site', 'index.html').replace(/\\/g, '/')}`;
  const shots = path.join(dir, 'shots');
  fs.mkdirSync(shots, { recursive: true });

  const browser = await chromium.launch();
  try {
    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktop = await desktopCtx.newPage();
    await desktop.goto(url, { waitUntil: 'networkidle' });
    await desktop.evaluate(FORCE_LOAD);
    await desktop.waitForTimeout(300);
    await desktop.screenshot({ path: path.join(shots, 'desktop.png'), fullPage: true });
    await desktop.screenshot({ path: path.join(shots, 'desktop-fold.png') });
    const facts = await desktop.evaluate(MEASURE);

    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await mobileCtx.newPage();
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await mobile.evaluate(FORCE_LOAD);
    await mobile.waitForTimeout(300);
    await mobile.screenshot({ path: path.join(shots, 'mobile.png'), fullPage: true });
    const mobileFacts = await mobile.evaluate(
      `({ headerHeight: Math.round(document.querySelector('header').getBoundingClientRect().height),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          h1: Math.round(parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)),
          pageHeight: Math.round(document.body.scrollHeight) })`,
    );

    const content = JSON.parse(fs.readFileSync(path.join(dir, '5-content.json'), 'utf8'));
    const design = JSON.parse(fs.readFileSync(path.join(dir, '5b-design.json'), 'utf8'));

    return {
      ...record,
      measured: true,
      businessName: content.businessName,
      tagline: content.tagline,
      seoTitle: content.seo.title,
      seoDescription: content.seo.description,
      keywords: content.seo.keywords,
      unresolvedGaps: content.unresolvedGaps,
      sectionKinds: content.sections.map((s: { kind: string }) => s.kind),
      detectedIndustry: design.industry.id,
      industryBasis: design.industry.basis,
      direction: design.personality.direction,
      heroVariant: design.layout.hero,
      designNotes: design.notes,
      desktop: facts,
      mobile: mobileFacts,
    };
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const measureOnly = process.argv.includes('--measure');

  let records: RunRecord[];
  if (measureOnly && fs.existsSync(REGISTRY)) {
    records = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).map(
      (r: Record<string, unknown>) => ({ slug: r.slug, label: r.label, industry: r.industry, runId: r.runId, error: r.error }) as RunRecord,
    );
  } else {
    records = BUSINESSES.map(generate);
  }

  const measured: Record<string, unknown>[] = [];
  for (const record of records) {
    try {
      measured.push(await measure(record));
    } catch (error) {
      measured.push({ ...record, measured: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  fs.writeFileSync(REGISTRY, `${JSON.stringify(measured, null, 2)}\n`, 'utf8');

  process.stdout.write('\n=== batch summary ===\n');
  for (const row of measured) {
    const d = row.desktop as Record<string, unknown> | undefined;
    process.stdout.write(
      `${String(row.slug).padEnd(11)} ${String(row.runId ?? '-').padEnd(9)} ` +
        `industry=${String(row.detectedIndustry ?? '-').padEnd(12)} dir=${String(row.direction ?? '-').padEnd(11)} ` +
        `hero=${String(row.heroVariant ?? '-').padEnd(12)} ` +
        `imgs=${String(d?.totalImgs ?? '-').padStart(3)} broken=${String(d?.brokenImgs ?? '-')} ` +
        `hdr=${String(d?.headerHeight ?? '-')}px sections=${(row.sectionKinds as string[] | undefined)?.length ?? '-'}` +
        `${row.error ? `  ERROR: ${row.error}` : ''}\n`,
    );
  }
  process.stdout.write(`\nregistry: ${REGISTRY}\n`);
}

void main();
