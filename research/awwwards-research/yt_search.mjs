import { chromium } from 'playwright';
const query = 'how to build awwwards website tutorial gsap lenis';
const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto warn', e.message));
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(800); }
const items = await page.evaluate(() => {
  const out = [];
  const els = Array.from(document.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer'));
  for (const el of els.slice(0, 15)) {
    const titleEl = el.querySelector('#video-title, a#video-title');
    const href = titleEl ? titleEl.getAttribute('href') : null;
    const title = titleEl ? titleEl.textContent.trim() : '';
    const meta = el.querySelector('#channel-info, #metadata-line')?.textContent?.trim() || '';
    if (href && href.includes('watch')) {
      const id = href.split('v=')[1]?.split('&')[0] || href.split('/').pop();
      out.push({ title, id, url: 'https://www.youtube.com' + href, meta: meta.slice(0, 80) });
    }
  }
  return out;
});
console.log(JSON.stringify(items, null, 2));
await browser.close();
