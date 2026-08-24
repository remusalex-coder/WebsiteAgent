// Final screenshot over HTTP (runtime.js needs http, not file://).
import { chromium } from 'playwright';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dir = process.argv[2];
const tag = process.argv[3] || 'final';
const url = 'http://localhost:8099/';
const outDir = join(root, 'output', 'demo-shots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Capture hero, mid (signature), and full pages
await page.screenshot({ path: join(outDir, `${tag}-hero.png`) });
await page.evaluate(() => { const s=document.querySelector('.section--moment'); if(s) s.scrollIntoView({block:'center'}); });
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, `${tag}-signature.png`) });
await page.evaluate(() => window.scrollTo(0,0));
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, `${tag}-desktop.png`), fullPage: true });

const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(url, { waitUntil: 'networkidle' });
await m.waitForTimeout(400);
await m.screenshot({ path: join(outDir, `${tag}-mobile.png`), fullPage: true });

console.log('SHOTS:', outDir, '| console errors:', errs.length? errs : 'none');
await browser.close();
