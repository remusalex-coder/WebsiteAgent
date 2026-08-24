import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' });
// awwwards sites of the day/winners listing
await page.goto('https://www.awwwards.com/websites/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
await page.waitForTimeout(3000);
const urls = await page.evaluate(() => {
  const out = [];
  for (const a of Array.from(document.querySelectorAll('a[href*="/sites/"]')).slice(0, 25)) {
    const href = a.getAttribute('href');
    if (href && /sites/.test(href)) out.push('https://www.awwwards.com' + href);
  }
  return [...new Set(out)].slice(0, 12);
});
console.log(JSON.stringify(urls, null, 2));
await browser.close();
