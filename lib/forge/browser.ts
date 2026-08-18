/**
 * Browser Preview & Playwright Capture Engine.
 *
 * Renders the generated site in a headless browser, waits for fonts and animations to settle,
 * and captures high-resolution desktop and mobile full-page screenshots for vision QA.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import type { Logger } from '../logger.js';

export interface CaptureResult {
  readonly desktop: string;
  readonly mobile: string;
  readonly metrics: {
    readonly title: string;
    readonly totalElements: number;
    readonly sectionsCount: number;
    readonly hasCanvas: boolean;
  };
}

export async function captureSite(siteDir: string, runDir: string, logger: Logger): Promise<CaptureResult> {
  const shotsDir = path.join(runDir, 'shots');
  await fs.mkdir(shotsDir, { recursive: true });

  const indexPath = path.join(siteDir, 'index.html');
  const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;

  logger.info('Capturing site screenshots with Playwright', { fileUrl });

  const browser = await chromium.launch({ headless: true });
  let metrics = { title: '', totalElements: 0, sectionsCount: 0, hasCanvas: false };

  const desktopShotPath = path.join(shotsDir, 'desktop.png');
  const mobileShotPath = path.join(shotsDir, 'mobile.png');

  try {
    // 1. Desktop Capture (1440 x 900)
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await desktopPage.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
      await desktopPage.waitForTimeout(1000);

      // Force images to decode and canvas to render
      await desktopPage.evaluate(async () => {
        for (const img of Array.from(document.images)) img.removeAttribute('loading');
        await Promise.all(
          Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
        );
      });

      metrics = await desktopPage.evaluate(() => ({
        title: document.title,
        totalElements: document.querySelectorAll('*').length,
        sectionsCount: document.querySelectorAll('section').length,
        hasCanvas: document.querySelectorAll('canvas').length > 0,
      }));

      // Scroll smoothly to trigger reveals
      await desktopPage.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 200));
      });

      await desktopPage.screenshot({ path: desktopShotPath, fullPage: true });
      logger.debug('Desktop screenshot captured', { desktopShotPath });
    } finally {
      await desktopPage.close();
    }

    // 2. Mobile Capture (390 x 844)
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await mobilePage.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
      await mobilePage.waitForTimeout(1000);

      await mobilePage.evaluate(async () => {
        for (const img of Array.from(document.images)) img.removeAttribute('loading');
        await Promise.all(
          Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
        );
        window.scrollTo(0, 0);
      });

      await mobilePage.screenshot({ path: mobileShotPath, fullPage: true });
      logger.debug('Mobile screenshot captured', { mobileShotPath });
    } finally {
      await mobilePage.close();
    }
  } finally {
    await browser.close();
  }

  return {
    desktop: desktopShotPath,
    mobile: mobileShotPath,
    metrics,
  };
}
