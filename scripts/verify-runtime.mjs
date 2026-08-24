// Serve + screenshot + verify scroll-progress runtime on a built site.
// Usage: node scripts/verify-runtime.mjs <dir> <tag>
import { chromium } from 'playwright';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dir = process.argv[2];
const tag = process.argv[3] || 'run';
const url = process.argv[4] || ('file://' + join(root, dir, 'site', 'index.html'));
const outDir = join(root, 'output', 'demo-shots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Confirm runtime present
const hasRuntime = await page.evaluate(() => document.documentElement.getAttribute('data-runtime'));
const hasScript = await page.$('script[src="runtime.js"]') !== null;

// Scroll to 50% and read --forge-scroll / a section's --forge-vis
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
await page.waitForTimeout(300);
const mid = await page.evaluate(() => ({
  forgeScroll: getComputedStyle(document.documentElement).getPropertyValue('--forge-scroll'),
  heroVis: document.querySelector('.section--hero')?.style.getPropertyValue('--forge-vis'),
  anyVis: [...document.querySelectorAll('section.section')].map(s => s.style.getPropertyValue('--forge-vis')).filter(Boolean).slice(0, 3),
}));

// Scroll to signature (moment) section and check it's framed
const sigSel = '.section--moment';
const sigBox = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  return true;
}, sigSel);
await page.waitForTimeout(400);
const sigVis = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return el ? el.style.getPropertyValue('--forge-vis') : null;
}, sigSel);

await page.screenshot({ path: join(outDir, `${tag}-desktop.png`), fullPage: true });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: join(outDir, `${tag}-hero.png`), fullPage: false });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(url, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: join(outDir, `${tag}-mobile.png`), fullPage: true });
const mobileRuntime = await mobile.evaluate(() => {
  // on coarse/pointer-fine false in headless? emulate to confirm hero not pinned
  const hero = document.querySelector('.section--hero');
  return { runtime: document.documentElement.getAttribute('data-runtime'), heroPos: hero ? getComputedStyle(hero).position : 'none' };
});

console.log(JSON.stringify({
  hasRuntime, hasScript,
  mid_forgeScroll: mid.forgeScroll, mid_heroVis: mid.heroVis, mid_anyVis: mid.anyVis,
  sigVis,
  mobile: mobileRuntime,
  consoleErrors: errors.length ? errors : 'none',
}, null, 2));

await browser.close();
