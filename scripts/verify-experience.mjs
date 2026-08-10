/**
 * Checks the promises the experience makes to people who cannot take it at
 * full strength: reduced motion, no WebGL, and keyboard-only navigation.
 *
 *   node scripts/verify-experience.mjs [port]
 *
 * These paths are easy to claim and easy to leave broken, because nobody
 * developing the page ever sees them.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 4321);
const outDir = path.join(ROOT, 'output', 'review', 'degraded');
await fs.mkdir(outDir, { recursive: true });

const results = [];

/* ---------------------------- reduced motion ---------------------------- */
{
  const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu'] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const el = document.getElementById('scene-rise');
    const line = document.querySelector('.display .line-in');
    return {
      bodyClass: document.body.className,
      // With motion reduced the type must already be in place, not waiting
      // offscreen for a transition that will never be allowed to run.
      lineTransform: line ? getComputedStyle(line).transform : 'none',
      stageOpacity: el ? getComputedStyle(el.querySelector('.stage')).opacity : null,
      plateClip: getComputedStyle(document.querySelector('.plate')).clipPath,
    };
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35));
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(outDir, 'reduced-motion.png'), animations: 'disabled', timeout: 20000,
  });
  results.push({ mode: 'reduced-motion', errors, ...r });
  await browser.close();
}

/* ------------------------------- no WebGL ------------------------------- */
{
  const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Deny the context before any script runs.
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).indexOf('webgl') === 0) return null;
      return real.call(this, type, ...rest);
    };
  });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => ({
    bodyClass: document.body.className,
    fallbackShown: getComputedStyle(document.querySelector('.gl-fallback')).display,
    canvasShown: getComputedStyle(document.getElementById('proof-gl')).display,
    curtainGone: document.getElementById('curtain') === null,
  }));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.33));
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(outDir, 'no-webgl.png'), animations: 'disabled', timeout: 20000,
  });
  results.push({ mode: 'no-webgl', errors, ...r });
  await browser.close();
}

/* ------------------- readable at every scroll position ------------------- */

// The page blends its ground continuously, including one full polarity flip
// from night to daylight whose midpoint is about 1.05:1. The claim being
// checked is that no visitor ever reads text during that crossing: wherever
// copy is actually visible, it clears 4.5:1 against the ground behind it.
//
// Both motion modes are swept, because they reach that claim by different
// routes. Normally the copy is faded out while the ground moves. With motion
// reduced every stage is pinned opaque, so the ground has to snap instead —
// a difference that is invisible unless it is actually measured.
for (const motion of ['no-preference', 'reduce']) {
  const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu'] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
  });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2600);

  const samples = await page.evaluate(async () => {
    const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => {
      const ch = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const contrast = (a, b) =>
      (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

    const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const total = document.body.scrollHeight - window.innerHeight;
    const worst = [];

    for (let i = 0; i <= 220; i++) {
      window.scrollTo(0, Math.round((total * i) / 220));
      await wait();

      const ground = parse(getComputedStyle(document.documentElement)
        .getPropertyValue('--ground'));

      for (const scene of document.querySelectorAll('.scene')) {
        const vis = parseFloat(scene.style.getPropertyValue('--vis') || '1');
        // Content-heavy scenes flow rather than fade; they are always visible.
        const flowing = getComputedStyle(scene.querySelector('.stage')).position !== 'sticky';
        const opacity = flowing ? 1 : vis;
        if (opacity < 0.06) continue;

        const rect = scene.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        for (const sel of ['.display', '.body-copy', '.log li']) {
          const el = scene.querySelector(sel);
          if (!el) continue;
          const ink = parse(getComputedStyle(el).color);
          const c = contrast(ink, ground);
          // Copy sitting over a full-bleed photograph is judged against its
          // own scrim, not the page ground, so it is measured separately.
          if (scene.classList.contains('k-plate')) continue;
          worst.push({
            y: window.scrollY, scene: scene.id, sel, opacity, c,
            vis: scene.style.getPropertyValue('--vis'),
            p: scene.style.getPropertyValue('--p'),
            flowing, ground: ground.join(','), ink: ink.join(','),
          });
        }
      }
    }

    worst.sort((a, b) => a.c - b.c);
    return worst.slice(0, 6);
  });

  const failures = samples.filter((s) => s.c < 4.5);
  results.push({
    mode: `contrast-while-scrolling (${motion})`,
    worst: samples.slice(0, 3).map((s) => ({
      scene: s.scene, sel: s.sel, c: Number(s.c.toFixed(2)), opacity: s.opacity,
    })),
    failures: failures.length,
  });
  await browser.close();
}

/* ------------------------------- keyboard ------------------------------- */
{
  const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const stops = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const a = document.activeElement;
      if (!a) return null;
      const style = getComputedStyle(a);
      return {
        tag: a.tagName.toLowerCase(),
        text: (a.textContent || '').trim().slice(0, 42),
        outline: style.outlineStyle + ' ' + style.outlineWidth,
      };
    }));
  }
  results.push({ mode: 'keyboard', stops });
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
