// Screenshots the FINAL shipped site/ for a given run dir, full-page + mobile.
// Usage: node scripts/shot_final.mjs <runDir>
import { chromium } from 'playwright';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) { console.error('usage: node scripts/shot_final.mjs <runDir>'); process.exit(1); }
const siteDir = path.join(runDir, 'site');
const fileUrl = 'file://' + path.resolve(siteDir, 'index.html');

const browser = await chromium.launch();
const shots = path.join(runDir, 'shots-final');
await import('node:fs/promises').then((fs) => fs.mkdir(shots, { recursive: true }));

// Desktop full page
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(shots, 'final-desktop.png'), fullPage: true });

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await m.goto(fileUrl, { waitUntil: 'networkidle' });
await m.waitForTimeout(1200);
await m.screenshot({ path: path.join(shots, 'final-mobile.png'), fullPage: true });

console.log('FINAL_SHOTS=' + shots);
await browser.close();
