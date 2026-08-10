/**
 * Looks at the built experience the way a visitor would, and reports back.
 *
 *   node scripts/shoot-experience.mjs [port] [label]
 *
 * Captures one frame per scene at the scroll offset where that scene is at its
 * strongest — not at evenly spaced intervals, which would mostly photograph
 * transitions — plus a mobile pass, the console log, and a frame-rate sample.
 * Critique needs the actual rendered pixels; this is how they get produced.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 4321);
const label = process.argv[3] ?? 'v1';
const outDir = path.join(ROOT, 'output', 'review', label);

const SCENES = [
  'levain', 'three-things', 'rise', 'blade', 'oven', 'cooling', 'rack', 'doors',
  'threshold', 'coda',
];

async function run(device, viewport) {
  // The real GPU, not swiftshader: swiftshader drops a WebGL2 context after a
  // few frames in this environment even for a trivial clear loop, so reviewing
  // through it photographs a fallback that no actual visitor would see.
  const browser = await chromium.launch({
    args: ['--use-angle=default', '--enable-gpu', '--disable-lcd-text'],
  });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });

  const messages = [];
  page.on('console', (m) => messages.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));

  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;

  await page.waitForTimeout(2600); // let the curtain lift

  const gl = await page.evaluate(() => ({
    hasGl: document.body.classList.contains('has-gl'),
    noGl: document.body.classList.contains('no-gl'),
  }));

  // Frame budget, sampled over a second of animation.
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const start = performance.now();
    const tick = () => {
      n++;
      if (performance.now() - start > 1000) {
        resolve(Math.round(n * 1000 / (performance.now() - start)));
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));

  await fs.mkdir(outDir, { recursive: true });

  for (const id of SCENES) {
    const y = await page.evaluate((sceneId) => {
      const el = document.getElementById('scene-' + sceneId);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      // Mid-scene: where the composition is open and the text is at full opacity.
      return top + el.offsetHeight * 0.46 - window.innerHeight * 0.5;
    }, id);
    if (y === null) continue;
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(outDir, `${device}-${id}.png`),
      animations: 'disabled',
      caret: 'hide',
      timeout: 20000,
    });
  }

  const height = await page.evaluate(() => document.body.scrollHeight);
  await browser.close();
  return { device, loadMs, gl, fps, messages, height, viewport };
}

const desktop = await run('desktop', { width: 1440, height: 900 });
const mobile = await run('mobile', { width: 390, height: 844 });

console.log(JSON.stringify({ desktop, mobile }, null, 2));
console.log('\nframes →', path.relative(ROOT, outDir));
