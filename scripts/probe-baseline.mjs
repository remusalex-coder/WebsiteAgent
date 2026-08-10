/** Does a trivial WebGL2 context survive here at all? */
import { chromium } from 'playwright';

async function trial(name, args) {
  const browser = await chromium.launch({ args });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(`<canvas id=c width=600 height=400></canvas><script>
    var c = document.getElementById('c');
    var gl = c.getContext('webgl2');
    window.__r = { got: !!gl, frames: 0, lost: false };
    if (gl) {
      c.addEventListener('webglcontextlost', function(){ window.__r.lost = true; });
      (function loop(){
        if (!window.__r.lost) {
          gl.clearColor(0.9, 0.4, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
          window.__r.frames++;
        }
        requestAnimationFrame(loop);
      })();
    }
  </script>`);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    ...window.__r,
    renderer: (() => {
      const g = document.createElement('canvas').getContext('webgl2');
      if (!g) return 'none';
      const d = g.getExtension('WEBGL_debug_renderer_info');
      return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
    })(),
  }));
  console.log(name, JSON.stringify(r));
  await browser.close();
}

await trial('swiftshader ', ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']);
await trial('angle       ', ['--use-angle=default', '--enable-gpu']);
await trial('default     ', []);
