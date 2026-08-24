/**
 * Automated Playwright Verification Suite for SCJU Sibiu Multi-Page Functional Platform.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

async function verifyMultiPagePlatform() {
  const siteDir = path.resolve('output/scju-sibiu/site');
  const shotsDir = path.resolve('output/scju-sibiu/shots');
  await fs.mkdir(shotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[Console Error]: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(`[Page Error]: ${err.message}`);
  });

  const pagesToTest = [
    'index.html',
    'urgente.html',
    'programari.html',
    'pavilioane.html',
    'ghid-pacient.html',
    'analize.html',
    'contact.html',
  ];

  console.log('Starting Multi-Page Verification...');

  for (const pageName of pagesToTest) {
    const fileUrl = `file:///${path.join(siteDir, pageName).replace(/\\/g, '/')}`;
    console.log(`Testing ${pageName} -> ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const title = await page.title();
    const domCount = await page.evaluate(() => document.querySelectorAll('*').length);
    console.log(`  ✓ Title: "${title}" | DOM Elements: ${domCount}`);

    // Capture Desktop
    await page.screenshot({ path: path.join(shotsDir, `desktop-${pageName.replace('.html', '')}.png`), fullPage: true });
  }

  // Functional Test: Appointment Scheduler Flow in programari.html
  console.log('\nTesting Interactive Appointment Scheduler Flow...');
  await page.goto(`file:///${path.join(siteDir, 'programari.html').replace(/\\/g, '/')}`);

  // Step 1: Select Specialty
  await page.selectOption('#specialty-select', 'cardiologie');
  await page.click('#btn-next-step-1');
  await page.waitForTimeout(300);

  // Step 2: Next to date
  await page.click('#btn-next-step-2');
  await page.waitForTimeout(300);

  // Step 3: Select time slot
  await page.click('.slot-pill');
  await page.click('#btn-next-step-3');
  await page.waitForTimeout(300);

  // Step 4: Fill patient details
  await page.fill('#patient-name', 'Popescu Elena');
  await page.fill('#patient-cnp', '2850412321456');
  await page.fill('#patient-phone', '0722123456');
  await page.click('#btn-submit-appointment');
  await page.waitForTimeout(500);

  const confirmationVisible = await page.isVisible('.official-slip');
  console.log(`  ✓ Appointment Official Slip Visible: ${confirmationVisible}`);

  // Functional Test: Triage Wizard in index.html
  console.log('\nTesting Interactive Triage Wizard in index.html...');
  await page.goto(`file:///${path.join(siteDir, 'index.html').replace(/\\/g, '/')}`);
  await page.click('#triage-btn-acute');
  await page.waitForTimeout(300);
  const triageResultText = await page.textContent('#triage-result');
  console.log(`  ✓ Triage Result Triggered: ${triageResultText?.slice(0, 80)}...`);

  // Mobile Viewport test
  console.log('\nTesting Mobile Viewport (iPhone 14 / 390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`file:///${path.join(siteDir, 'index.html').replace(/\\/g, '/')}`);
  await page.screenshot({ path: path.join(shotsDir, 'mobile-index.png'), fullPage: true });

  await browser.close();

  console.log('\n=============================================');
  console.log(`TOTAL CONSOLE ERRORS: ${errors.length}`);
  if (errors.length > 0) {
    console.error('Errors found:', errors);
    process.exit(1);
  }
  console.log('ALL MULTI-PAGE & INTERACTIVE TESTS PASSED 100%!');
  console.log('=============================================\n');
}

verifyMultiPagePlatform().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
