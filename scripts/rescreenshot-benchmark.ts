/** Re-screenshots every already-rendered benchmark artifact with the fixed (non-fullPage) capture technique. No pipeline re-run, no AI calls. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveDirectory } from '../lib/qa/preflight.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');
const OUT = path.join(ROOT, 'benchmark-10');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function screenshotVariant(dir: string): Promise<void> {
  const shotDir = path.join(dir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });
  const server = await serveDirectory(dir);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const { name, width, height } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(server.url, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(fullHeight, 20_000) });
      await page.mouse.wheel(0, fullHeight);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(shotDir, `${name}.png`) });
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main(): Promise<void> {
  const businesses = await fs.readdir(OUT, { withFileTypes: true });
  for (const b of businesses) {
    if (!b.isDirectory()) continue;
    for (const variant of ['control', 'director']) {
      const dir = path.join(OUT, b.name, variant);
      try {
        await fs.access(path.join(dir, 'index.html'));
      } catch {
        continue;
      }
      console.log(`re-screenshotting ${b.name}/${variant}`);
      await screenshotVariant(dir);
    }
  }
  console.log('done');
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
