/**
 * Screenshot a rendered site and measure it.
 *
 * Full-page capture resizes the viewport, which re-runs lazy-loading
 * heuristics — a gallery captures as an empty white band and looks exactly like
 * broken CSS. So `loading="lazy"` is stripped and every image is awaited before
 * the shutter. This trap has cost this project an hour twice.
 *
 *   npx tsx scripts/shoot.ts <runId> [label]
 */

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const runId = process.argv[2];
const label = process.argv[3] ?? runId;
if (runId === undefined) throw new Error('usage: shoot.ts <runId> [label]');

const indexPath = path.join(ROOT, 'output', runId, 'site', 'index.html');
if (!fs.existsSync(indexPath)) throw new Error(`no rendered site at ${indexPath}`);

const shotDir = path.join(ROOT, 'output', 'shots');
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
] as const) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`file://${indexPath.replace(/\\/g, '/')}`);

  // Force every image to load before the viewport is resized for the capture.
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) img.removeAttribute('loading');
    await Promise.all(
      Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
    );
  });
  await page.waitForTimeout(600);

  const measured = await page.evaluate(() => ({
    words: (document.body.innerText.match(/\S+/g) ?? []).length,
    images: document.images.length,
    sections: document.querySelectorAll('section, .section').length,
    trust: document.querySelectorAll('.trust-bar__item').length,
    ctas: document.querySelectorAll('a.button').length,
    height: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

  await page.screenshot({ path: path.join(shotDir, `${label}-${name}.png`), fullPage: true });
  process.stdout.write(`${label} ${name}: ${JSON.stringify(measured)}\n`);
  await page.close();
}

await browser.close();
