/**
 * Screenshots every example site, desktop and mobile.
 *
 *   npx tsx scripts/screenshot-examples.ts [suffix]
 *
 * Writes `output/examples/_shots/<slug>-desktop[-suffix].png` and `-mobile`.
 * The suffix exists so a before and an after set can sit side by side.
 *
 * Also prints the computed values that decide whether the design tokens are
 * reaching the page at all — a screenshot shows that two sites look different,
 * but not whether the difference is the one the design layer intended.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

import { EXAMPLES } from './example-businesses.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output', 'examples');
const SHOTS = path.join(OUT, '_shots');

const suffix = process.argv[2] === undefined ? '' : `-${process.argv[2]}`;

/** What the page actually resolved, as opposed to what the stylesheet declared. */
const PROBE = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const el = (s) => document.querySelector(s);
  const px = (s, p) => { const e = el(s); return e === null ? null : getComputedStyle(e)[p]; };
  const button = el('.button');
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    canvasToken: v('--color-canvas'),
    sectionPad: px('.section', 'paddingTop'),
    sectionToken: v('--space-section'),
    container: px('.container', 'maxWidth'),
    containerToken: v('--container-max'),
    h1: px('h1', 'fontSize'),
    h1Token: v('--text-h1-size'),
    buttonHeight: button === null ? null : Math.round(button.getBoundingClientRect().height),
    cardPad: px('.card', 'padding'),
    cardShadow: px('.card', 'boxShadow'),
    docWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
  };
})()`;

/**
 * Scrolls the page so `loading="lazy"` images decode before the shot.
 *
 * A full-page screenshot does not move the viewport, so every gallery image
 * below the fold stays unloaded and photographs as a hole — which looks exactly
 * like a broken layout and is not one.
 */
async function settle(page: import('playwright').Page): Promise<void> {
  await page.evaluate(`(async () => {
    const step = innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    scrollTo(0, 0);
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {})));
  })()`);
  await page.waitForTimeout(150);
}

async function main(): Promise<void> {
  await fs.mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const rows: string[] = [];

  for (const spec of EXAMPLES) {
    const url = pathToFileURL(path.join(OUT, spec.slug, 'index.html')).href;

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await desktop.goto(url, { waitUntil: 'load' });
    await settle(desktop);
    await desktop.screenshot({
      path: path.join(SHOTS, `${spec.slug}-desktop${suffix}.png`),
      fullPage: true,
    });
    const probe = await desktop.evaluate(PROBE) as Record<string, unknown>;
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(url, { waitUntil: 'load' });
    await settle(mobile);
    await mobile.screenshot({
      path: path.join(SHOTS, `${spec.slug}-mobile${suffix}.png`),
      fullPage: true,
    });
    // A document wider than the viewport is a horizontal scrollbar on a phone,
    // which is the one responsive failure that is never a matter of taste.
    const overflow = await mobile.evaluate(
      '({ doc: document.documentElement.scrollWidth, view: innerWidth })',
    ) as { doc: number; view: number };
    await mobile.close();

    rows.push([
      spec.slug.padEnd(16),
      `bg ${String(probe.bodyBg).padEnd(20)}`,
      `canvas ${String(probe.canvasToken).padEnd(9)}`,
      `sectionPad ${String(probe.sectionPad).padEnd(7)}`,
      `container ${String(probe.container).padEnd(8)}`,
      `h1 ${String(probe.h1).padEnd(9)}`,
      `btnH ${String(probe.buttonHeight).padEnd(4)}`,
      `cardPad ${String(probe.cardPad).padEnd(12)}`,
      `mobileOverflow ${overflow.doc > overflow.view ? `YES (${overflow.doc}>${overflow.view})` : 'no'}`,
    ].join('  '));
  }

  await browser.close();
  console.log(rows.join('\n'));
}

await main();
