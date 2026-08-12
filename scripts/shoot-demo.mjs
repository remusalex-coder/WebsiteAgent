// Screenshot a built site (before/after comparison). Usage: node scripts/shoot-demo.mjs <dir> <tag>
import { chromium } from 'playwright';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dir = process.argv[2];
const tag = process.argv[3] || 'shot';
const siteDir = join(root, dir, 'site');
const outDir = join(root, 'output', 'demo-shots');
import { mkdirSync } from 'node:fs';
mkdirSync(outDir, { recursive: true });

const url = 'file://' + join(siteDir, 'index.html');
const browser = await chromium.launch();
const errors = [];

async function shoot(name, width, height, full) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `${tag}-${name}.png`), fullPage: full });
  const metrics = await page.evaluate(() => ({
    scrollH: document.body.scrollHeight,
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  console.log(`${tag}-${name}: ${metrics.scrollH}px tall, overflowX=${metrics.overflow} (sw=${metrics.docW} vw=${metrics.winW})`);
  await page.close();
  return metrics;
}

await shoot('desktop', 1440, 900, true);
await shoot('mobile', 390, 844, true);
// above-the-fold hero only
const hero = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await hero.goto(url, { waitUntil: 'networkidle' });
await hero.waitForTimeout(300);
await hero.screenshot({ path: join(outDir, `${tag}-hero.png`), fullPage: false });
await hero.close();

await browser.close();
console.log('CONSOLE_ERRORS:', errors.length ? errors.join(' | ') : 'none');
console.log('OUT:', outDir);
