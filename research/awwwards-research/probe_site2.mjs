import { chromium } from 'playwright';

const targets = [
  { name: 'zentry', url: 'https://zentry.com/' },
  { name: 'obys', url: 'https://obys.agency/' },
  { name: 'cuberto', url: 'https://cuberto.com/' },
  { name: 'unseen', url: 'https://unseen-studio.co.uk/' },
  { name: 'resn', url: 'https://resn.com/' },
  { name: 'activetheory', url: 'https://www.activetheory.net/' },
  { name: 'aristidebenoist', url: 'https://aristidebenoist.com/' },
  { name: 'aktarialex', url: 'https://www.aktarialex.com/' },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const report = [];
for (const t of targets) {
  try {
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const data = await page.evaluate(() => {
      const out = {};
      // ONLY real script srcs (CDN libs), not text mentions
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      const srcText = scripts.join(' ');
      const libRe = ['gsap','scrolltrigger','splittext','lenis','locomotive','three','oGL','webgl','pixi','curtains','spline','lottie','howler','barba','swup','framer-motion','studio-freight'];
      out.cdnLibs = libRe.filter(k => new RegExp(k, 'i').test(srcText));
      // runtime globals actually present
      out.globals = ['__lenis','lenis','ScrollTrigger','gsap','THREE','OGL','Plimsh','Barba'].filter(g => (window)[g] !== undefined);
      // webgl canvas
      const canvases = Array.from(document.querySelectorAll('canvas'));
      out.canvasCount = canvases.length;
      out.webgl = canvases.some(c => { try { return !!(c.getContext('webgl') || c.getContext('webgl2')); } catch { return false; } });
      // fonts (custom = not system)
      const fonts = new Set();
      for (const el of document.querySelectorAll('body *')) {
        const f = getComputedStyle(el).fontFamily;
        if (f) f.split(',').forEach(x => fonts.add(x.trim().replace(/["']/g, '')));
      }
      const system = ['Times New Roman','Inter Tight','Roboto','Helvetica Neue','Arial','sans-serif','serif','system-ui','-apple-system','Segoe UI','Noto Sans','Apple Color Emoji'];
      out.customFonts = Array.from(fonts).filter(f => !system.includes(f)).slice(0, 8);
      out.bodyBg = getComputedStyle(document.body).backgroundColor;
      const h1 = document.querySelector('h1');
      out.h1Size = h1 ? getComputedStyle(h1).fontSize : null;
      out.h1Transform = h1 ? getComputedStyle(h1).textTransform : null;
      // smooth scroll indicator
      out.lenisClass = document.documentElement.className.includes('lenis') || !!document.querySelector('[data-lenis]');
      out.title = document.title;
      return out;
    });
    // screenshot for the record
    try { await page.screenshot({ path: `research/awwwards-research/shot-${t.name}.png`, fullPage: false }); } catch {}
    report.push({ name: t.name, url: t.url, status: 'ok', ...data });
  } catch (e) {
    report.push({ name: t.name, url: t.url, status: 'error', error: e.message.split('\n')[0] });
  }
}
console.log(JSON.stringify(report, null, 2));
await browser.close();
