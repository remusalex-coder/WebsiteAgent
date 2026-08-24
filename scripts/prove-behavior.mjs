// Prove the experience BEHAVES differently: hero pins + world grounds cross continuously.
import { chromium } from 'playwright';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const url = 'http://localhost:8099/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

async function sample(frac) {
  await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
  await page.waitForTimeout(250);
  return await page.evaluate(() => {
    const root = document.documentElement;
    const hero = document.querySelector('.section--hero');
    const sig = document.querySelector('.section--moment');
    const cs = (el) => el ? getComputedStyle(el).backgroundColor : null;
    // find sections with data-bg
    const bands = [...document.querySelectorAll('section.section[data-bg]')].map(s => ({ bg: s.getAttribute('data-bg'), color: getComputedStyle(s).backgroundColor }));
    return {
      forgeScroll: root.style.getPropertyValue('--forge-scroll') || getComputedStyle(root).getPropertyValue('--forge-scroll'),
      heroPos: hero ? getComputedStyle(hero).position : null,
      heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
      heroVis: hero ? hero.style.getPropertyValue('--forge-vis') : null,
      sigVis: sig ? sig.style.getPropertyValue('--forge-vis') : null,
      bands,
    };
  });
}

const top = await sample(0);
const mid = await sample(0.5);
const low = await sample(0.85);

console.log('TOP  (scroll=0):', JSON.stringify(top, null, 1));
console.log('MID  (scroll=.5):', JSON.stringify(mid, null, 1));
console.log('LOW  (scroll=.85):', JSON.stringify(low, null, 1));

// Does the inverted band's background colour CHANGE between scroll positions?
// (continuous crossing vs static band)
const invTop = top.bands.find(b => b.bg === 'inverted')?.color;
const invMid = mid.bands.find(b => b.bg === 'inverted')?.color;
const invLow = low.bands.find(b => b.bg === 'inverted')?.color;
console.log('INVERTED band bg over scroll:', invTop, '->', invMid, '->', invLow, '| crossing?', (invTop !== invLow));

await browser.close();
