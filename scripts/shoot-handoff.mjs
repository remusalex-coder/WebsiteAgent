/** Frames the moment the rendered loaf opens into the photograph of a real one. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(ROOT, 'output', 'review', 'handoff');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=default', '--enable-gpu', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4321/', { waitUntil: 'load' });
await page.waitForTimeout(2600);

for (const f of [0.06, 0.14, 0.22, 0.34]) {
  const y = await page.evaluate((frac) => {
    const el = document.getElementById('scene-cooling');
    const top = el.getBoundingClientRect().top + window.scrollY;
    return top + el.offsetHeight * frac - window.innerHeight * 0.5;
  }, f);
  await page.evaluate((to) => window.scrollTo(0, to), y);
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(outDir, `handoff-${String(Math.round(f * 100)).padStart(2, '0')}.png`),
    animations: 'disabled', timeout: 20000,
  });
}
await browser.close();
console.log('done');
