import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' });
const detailUrls = [
  'https://www.awwwards.com/sites/likova','https://www.awwwards.com/sites/mosbys-files',
  'https://www.awwwards.com/sites/revelatio-studio','https://www.awwwards.com/sites/vero-new-york',
  'https://www.awwwards.com/sites/produx-design','https://www.awwwards.com/sites/nothin',
  'https://www.awwwards.com/sites/studio-k95-3','https://www.awwwards.com/sites/haoqi-design'
];
const found = [];
for (const u of detailUrls) {
  try {
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const site = await page.evaluate(() => {
      const a = document.querySelector('a.show-site, a.visit-site, a[href*="http"]:not([href*="awwwards"])');
      // fallback: the big "Visit Site" button
      const btn = Array.from(document.querySelectorAll('a')).find(x => /visit|live|view site/i.test(x.textContent||'') && x.href.startsWith('http'));
      return (btn || a)?.href || null;
    });
    found.push({ awwwards: u, site });
  } catch (e) { found.push({ awwwards: u, error: e.message.split('\n')[0] }); }
}
console.log(JSON.stringify(found, null, 2));
await browser.close();
