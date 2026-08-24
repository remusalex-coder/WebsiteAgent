import { chromium } from 'playwright';

const targets = [
  { name: 'awwwards-listing', url: 'https://www.awwwards.com/' },
  { name: 'zentry', url: 'https://zentry.com/' },
  { name: 'aktarialex', url: 'https://www.aktarialex.com/' },
  { name: 'obys', url: 'https://obys.agency/' },
  { name: 'locomotive', url: 'https://locomotive.ca/' },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const report = [];
for (const t of targets) {
  try {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 }));
    await page.waitForTimeout(3500);
    const data = await page.evaluate(() => {
      const out = {};
      // libraries: scan scripts + globals
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      const allSrc = scripts.join(' ');
      const html = document.documentElement.outerHTML;
      const detect = (keys) => keys.filter(k => new RegExp(k, 'i').test(allSrc + ' ' + html));
      out.libraries = detect(['gsap', 'lenis', 'locomotive', 'three', 'three\\.min', 'webgl', 'scrolltrigger', 'splittext', 'barba', 'swup', 'lottie', 'howler', 'spline', 'oGL', 'pixi', 'curtains', 'studio-freight', 'framer', 'next', 'nuxt', 'react', 'vue', 'webflow', 'shopify', 'wordpress', 'tensorflow', 'ml5']);
      // canvas / webgl
      const canvases = Array.from(document.querySelectorAll('canvas'));
      out.canvasCount = canvases.length;
      out.canvasContexts = canvases.map(c => {
        try { return c.getContext('webgl') || c.getContext('webgl2') ? 'webgl' : (c.getContext('2d') ? '2d' : 'other'); } catch { return 'err'; }
      });
      // fonts
      const fonts = new Set();
      for (const el of document.querySelectorAll('*')) {
        const f = getComputedStyle(el).fontFamily;
        if (f) f.split(',').forEach(x => fonts.add(x.trim().replace(/["']/g, '')));
      }
      out.fonts = Array.from(fonts).slice(0, 12);
      // palette (background of body + sections)
      const cols = new Set();
      for (const el of document.querySelectorAll('body, header, section, footer, main')) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') cols.add(bg);
      }
      out.palette = Array.from(cols).slice(0, 10);
      out.bodyBg = getComputedStyle(document.body).backgroundColor;
      // hero media
      const hero = document.querySelector('header, section, main') || document.body;
      const video = hero.querySelector('video');
      out.heroVideo = !!video;
      out.heroVideoAutoplay = video ? (!video.paused && video.autoplay) : false;
      // h1 scale
      const h1 = document.querySelector('h1, .hero h1, header h1');
      out.h1Text = h1 ? h1.textContent.trim().slice(0, 60) : null;
      out.h1Size = h1 ? getComputedStyle(h1).fontSize : null;
      out.h1Transform = h1 ? getComputedStyle(h1).textTransform : null;
      out.h1Weight = h1 ? getComputedStyle(h1).fontWeight : null;
      // meta
      out.title = document.title;
      out.lang = document.documentElement.lang;
      // smooth scroll hint
      out.scrollBehavior = getComputedStyle(document.documentElement).scrollBehavior;
      return out;
    });
    report.push({ name: t.name, url: t.url, ...data });
  } catch (e) {
    report.push({ name: t.name, url: t.url, error: e.message.split('\n')[0] });
  }
}
console.log(JSON.stringify(report, null, 2));
await browser.close();
