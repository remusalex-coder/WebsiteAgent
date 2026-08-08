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

  /*
   * Captured by growing the viewport, not with `fullPage: true`.
   *
   * `fullPage` resizes the viewport and re-runs the browser's lazy and
   * intersection heuristics *after* the images were decoded, so the top of a
   * long page can paint as white. Zuni Café's gallery captured as a 2,900px
   * blank band while the DOM held eleven images, every one of them
   * `complete: true` at its natural size — and it looked exactly like a broken
   * layout. The previous fix (stripping `loading` and awaiting `decode()`)
   * happens before the resize and therefore does not survive it.
   *
   * Setting the viewport to the document height means no resize happens at
   * capture time at all. The measurements above are taken before this, at the
   * real viewport, so responsive behaviour is still measured honestly.
   */
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.min(fullHeight, 20_000) });
  // One frame for the newly revealed content to paint.
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(shotDir, `${label}-${name}.png`) });
  process.stdout.write(`${label} ${name}: ${JSON.stringify(measured)}\n`);
  await page.close();
}

await browser.close();
