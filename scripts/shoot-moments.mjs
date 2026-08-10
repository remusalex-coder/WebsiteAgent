/**
 * Photographs the three set pieces at the exact scroll offsets where they
 * happen, rather than at scene midpoints.
 *
 *   node scripts/shoot-moments.mjs [port] [label]
 *
 * A scene-midpoint pass shows compositions; it cannot show an event. The blade
 * travelling, the ear opening and the dawn whiteout each occupy a few hundred
 * pixels of scroll, and if they are not sampled deliberately they are invisible
 * in review even though they dominate the experience.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 4321);
const label = process.argv[3] ?? 'moments';
const outDir = path.join(ROOT, 'output', 'review', label);
await fs.mkdir(outDir, { recursive: true });

/** [name, sceneId, fraction through that scene]. */
const MOMENTS = [
  ['01-blade-approach', 'rise', 0.92],
  ['02-blade-cutting', 'blade', 0.30],
  ['03-blade-cut', 'blade', 0.52],
  ['04-blade-open', 'blade', 0.72],
  ['05-oven-spring', 'oven', 0.30],
  ['06-oven', 'oven', 0.50],
  ['07-dawn-rising', 'rack', 0.94],
  ['08-dawn-peak', 'rack', 1.0],
  ['09-morning', 'doors', 0.30],
  ['10-nightfall', 'threshold', 1.0],
  ['11-coda', 'coda', 0.45],
];

const browser = await chromium.launch({
  args: ['--use-angle=default', '--enable-gpu', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
await page.waitForTimeout(2600);

for (const [name, sceneId, frac] of MOMENTS) {
  const y = await page.evaluate(([id, f]) => {
    const el = document.getElementById('scene-' + id);
    if (!el) return null;
    const top = el.getBoundingClientRect().top + window.scrollY;
    return top + el.offsetHeight * f - window.innerHeight * 0.5;
  }, [sceneId, frac]);
  if (y === null) { console.log('missing scene', sceneId); continue; }

  await page.evaluate((to) => window.scrollTo(0, to), y);
  await page.waitForTimeout(1400);

  const probe = await page.evaluate(() => {
    const v = document.getElementById('veil');
    return {
      veil: v ? Number(v.style.opacity || 0) : null,
      clock: (document.querySelector('[data-clock]') || {}).textContent,
    };
  });

  await page.screenshot({
    path: path.join(outDir, `${name}.png`), animations: 'disabled', timeout: 20000,
  });
  console.log(name.padEnd(20), 'clock', probe.clock, '| veil', probe.veil);
}

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
