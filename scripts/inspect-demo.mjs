// DOM/CSS inspection of a rendered site. Usage: node scripts/inspect-demo.mjs <dir>
import { chromium } from 'playwright';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dir = process.argv[2];
const url = 'file://' + join(root, dir, 'site', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const data = await page.evaluate(() => {
  const out = { root: {}, sections: [], fonts: [], hero: {} };
  const html = document.documentElement;
  out.root.attrs = html.getAttributeNames().filter(a => a.startsWith('data-')).reduce((o,a)=>{o[a]=html.getAttribute(a);return o;},{});
  const secs = [...document.querySelectorAll('section.section')];
  for (const s of secs) {
    const cls = s.className;
    const role = s.getAttribute('data-role');
    const h = s.getBoundingClientRect().height;
    const h1 = s.querySelector('h1,h2');
    const cs = getComputedStyle(s);
    const bg = cs.backgroundColor;
    out.sections.push({ cls, role, h: Math.round(h), bg, hasMoment: cls.includes('section--moment'), hasSig: cls.includes('signature-composition'), hasBleed: cls.includes('section--bleed') });
  }
  // hero specifics
  const hero = document.querySelector('.section--hero');
  if (hero) {
    const img = hero.querySelector('img');
    const cs = getComputedStyle(hero);
    out.hero = {
      cls: hero.className,
      hasImg: !!img,
      imgSrc: img ? img.getAttribute('src') : null,
      bgImage: cs.backgroundImage.slice(0,60),
      minH: cs.minHeight,
      position: cs.position,
    };
  }
  // fonts actually used
  const used = new Set();
  document.querySelectorAll('h1,h2,h3,p,a,button,.display').forEach(el=>{ used.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'')); });
  out.fonts = [...used];
  // signature moment wash present?
  const styleText = [...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('\n')}catch(e){return ''}}).join('\n');
  out.hasMomentRule = styleText.includes('section--moment');
  out.momentRuleHasWash = /section--moment::before/.test(styleText) || styleText.includes('forge-moment-wash');
  return out;
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
