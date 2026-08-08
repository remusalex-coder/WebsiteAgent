/**
 * What trust signals does each benchmark business actually produce?
 *
 * Runs the writer's `trustSignals` over every saved profile, renders each saved
 * spec with the bar attached, and measures the result in a real browser.
 *
 * The point is that **none of this needs a model**. Stages 4 and 5 cost an API
 * quota that has now blocked two sessions; stage 3's `business.json` and stage
 * 5's `5-content.json` are on disk for six businesses and cost nothing to
 * re-read. A platform change to the writer's derived fields or to the renderer
 * is fully verifiable from them, which is the only reason this session could
 * measure anything at all.
 *
 *   npx tsx scripts/trust-audit.ts
 */

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

import { trustSignals } from '../agents/writerAgent.js';
import { renderSite } from '../lib/render/index.js';

import type { BusinessProfile, WebsiteContent, WebsiteDesign } from '../lib/types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, 'output');

interface Row {
  readonly runId: string;
  readonly name: string;
  readonly signals: readonly string[];
  readonly barItems: number;
  readonly overflowPx: number;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/** Every run directory holding both a profile and a written spec. */
function runsWithSpecs(): string[] {
  if (!fs.existsSync(OUTPUT)) return [];
  return fs
    .readdirSync(OUTPUT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[0-9a-f]{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .filter(
      (runId) =>
        fs.existsSync(path.join(OUTPUT, runId, 'business.json')) &&
        fs.existsSync(path.join(OUTPUT, runId, '5-content.json')),
    );
}

const browser = await chromium.launch({ headless: true });
const rows: Row[] = [];

for (const runId of runsWithSpecs()) {
  const dir = path.join(OUTPUT, runId);
  const saved = readJson<BusinessProfile>(path.join(dir, 'business.json'));
  const content = readJson<WebsiteContent>(path.join(dir, '5-content.json'));
  if (saved === null || content === null) continue;

  // The same backfill `readArtifact` applies in main.ts, for the same reason:
  // these profiles were written before `attributes` and `description` existed.
  const profile: BusinessProfile = { attributes: [], description: null, ...saved };

  // The saved spec predates the field, so the signals are recomputed from the
  // profile exactly as the writer would now compute them.
  const signals = trustSignals(profile);
  const withTrust: WebsiteContent = { ...content, trust: signals };
  const design = readJson<WebsiteDesign>(path.join(dir, '5b-design.json'));

  const site = renderSite(withTrust, {
    assetRoot: dir,
    ...(design === null ? {} : { design }),
  });

  const outDir = path.join(dir, 'site-trust');
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of site.files) {
    const target = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.contents);
  }

  // Measured at 390px: the width the recurring overflow defect shows up at.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`file://${path.join(outDir, 'index.html').replace(/\\/g, '/')}`);
  await page.waitForTimeout(300);

  const measured = await page.evaluate(() => ({
    barItems: document.querySelectorAll('.trust-bar__item').length,
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  await page.close();

  rows.push({
    runId,
    name: profile.name.value,
    signals: signals.map((signal) => `${signal.kind}:${signal.label}`),
    barItems: measured.barItems,
    overflowPx: measured.overflowPx,
  });
}

await browser.close();

process.stdout.write('\n=== Trust signals across the benchmark ===\n\n');
for (const row of rows) {
  process.stdout.write(`${row.name} (${row.runId})\n`);
  process.stdout.write(
    row.signals.length === 0
      ? '  none — nothing on this listing could be proved\n'
      : `${row.signals.map((signal) => `  - ${signal}`).join('\n')}\n`,
  );
  process.stdout.write(`  rendered items: ${row.barItems} · overflow at 390px: ${row.overflowPx}px\n\n`);
}

const withBar = rows.filter((row) => row.barItems > 0).length;
const overflowing = rows.filter((row) => row.overflowPx > 0);
process.stdout.write(`${withBar}/${rows.length} sites now render a trust bar.\n`);
process.stdout.write(
  overflowing.length === 0
    ? 'No horizontal overflow at 390px.\n'
    : `OVERFLOW: ${overflowing.map((row) => `${row.name} +${row.overflowPx}px`).join(', ')}\n`,
);

/*
 * A category scraped from Maps' own chrome rather than from the listing.
 *
 * This harness found "Add website in San Francisco" at the top of the benchmark
 * hotel's page — a UI button that had reached the profile, the schema.org type
 * and the design layer's industry match before anyone saw it. The extraction is
 * fixed; the check stays, because the trust bar puts whatever the category says
 * in the most prominent place on the page and the next bad value should fail
 * here rather than in front of a customer.
 */
const SUSPECT_CATEGORY = /^(add|suggest|claim|write|edit|share|save|send|report|update|verify)\b/i;
const suspect = rows.filter((row) =>
  row.signals.some((signal) => SUSPECT_CATEGORY.test(signal.replace(/^category:/, ''))),
);
if (suspect.length > 0) {
  process.stdout.write(
    `\nSUSPECT CATEGORY (Maps chrome, not a trade): ${suspect.map((row) => `${row.name} (${row.runId})`).join(', ')}\n` +
      'A run generated before the fix keeps its old profile. Re-run it from the top to clear.\n',
  );
}
