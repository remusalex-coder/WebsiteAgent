// Resolves a Maps search to a canonical /maps/place/... URL by clicking the
// top result, mirroring agents/discoveryAgent.ts consent handling.
import { chromium } from 'playwright';

const QUERY = process.argv[2] ?? "Katz's Delicatessen New York";
const SEARCH = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(QUERY)}&hl=en&gl=us`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage();
let resolved = null;
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame() && frame.url().includes('/maps/place/')) resolved = frame.url();
});

async function declineConsent() {
  if (!page.url().includes('consent.google.')) return;
  for (const sel of [
    'button[aria-label*="Reject all"]',
    'button:has-text("Reject all")',
    'form[action*="consent"] button:has-text("Reject")',
    'button:has-text("Refuză")',
  ]) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click({ timeout: 3000 }); return; }
    } catch { /* next */ }
  }
}

await page.goto(SEARCH, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await declineConsent();
await page.waitForTimeout(2000);

// Click the first result that links to a place.
let clicked = false;
for (const sel of ['a[href*="/maps/place/"]', 'div[role="feed"] a', 'a[href*="?q=place_id"]']) {
  try {
    const el = await page.$(sel);
    if (el) { await el.click({ timeout: 3000 }); clicked = true; break; }
  } catch { /* next */ }
}
if (!clicked) console.log('NO_RESULT_CLICKED');

try {
  await page.waitForFunction(() => location.href.includes('/maps/place/'), { timeout: 30000 });
} catch { /* fall back */ }
await page.waitForTimeout(2000);
const url = resolved ?? page.url();
console.log('RESOLVED_URL=' + url);
await browser.close();
