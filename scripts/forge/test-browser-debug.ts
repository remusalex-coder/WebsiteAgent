import { chromium } from 'playwright';
import path from 'node:path';

async function verify() {
  const filePath = path.resolve('output/scju-sibiu/site/index.html');
  const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

  console.log(`Testing URL: ${fileUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check DOM text length and visibility
  const bodyText = await page.evaluate(() => document.body.innerText);
  const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
  const emergencyBarVisible = await page.isVisible('.emergency-bar');
  const headerVisible = await page.isVisible('.site-header');
  const sceneCount = await page.evaluate(() => document.querySelectorAll('.scene').length);

  console.log(`DOM Element Count: ${elementCount}`);
  console.log(`Body Text Length: ${bodyText.length} characters`);
  console.log(`Emergency Bar Visible: ${emergencyBarVisible}`);
  console.log(`Header Visible: ${headerVisible}`);
  console.log(`Scene Count: ${sceneCount}`);
  console.log(`Console Errors (${consoleErrors.length}):`, consoleErrors);

  // Re-capture screenshots
  await page.screenshot({ path: 'output/scju-sibiu/shots/desktop.png', fullPage: true });

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/scju-sibiu/shots/mobile.png', fullPage: true });

  await browser.close();

  if (bodyText.length > 500 && consoleErrors.length === 0 && emergencyBarVisible) {
    console.log('✅ VERIFICATION PASSED: Site renders perfectly with 0 console errors!');
  } else {
    console.error('❌ VERIFICATION FAILED!');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
