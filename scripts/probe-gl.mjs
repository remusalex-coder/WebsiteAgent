import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => console.log('  page:', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  ERR:', e.message));
await page.goto('http://localhost:4321/', { waitUntil: 'load' });
await page.waitForTimeout(3000);

const report = await page.evaluate(() => {
  const c = document.getElementById('proof-gl');
  const r = c.getBoundingClientRect();
  const cs = getComputedStyle(c);
  const gl = c.getContext('webgl2');
  let sample = null;
  if (gl) {
    const px = new Uint8Array(4 * 9);
    // read a 3x3 block at the middle of the drawing buffer
    gl.readPixels(
      Math.floor(c.width / 2) - 1, Math.floor(c.height / 2) - 1,
      3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px,
    );
    sample = Array.from(px.slice(0, 12));
  }
  return {
    rect: { w: r.width, h: r.height, top: r.top },
    buffer: { w: c.width, h: c.height },
    style: { display: cs.display, opacity: cs.opacity, zIndex: cs.zIndex,
             visibility: cs.visibility, position: cs.position },
    bodyClass: document.body.className,
    centrePixel: sample,
    glLost: gl ? gl.isContextLost() : 'no ctx',
    state: window.__PROOF__ ? 'present' : 'missing',
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
