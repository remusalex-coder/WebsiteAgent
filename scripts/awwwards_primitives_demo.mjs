// Visual demo of the Awwwards runtime primitives, built from the repo's own
// dispatch (runtimeSourceFor / runtimePrimitiveRules) — not a mock. Renders a
// standalone HTML page exercising every new primitive, scrolls it, and
// screenshots desktop + mobile so the components can be verified without the
// LLM pipeline. Usage: node scripts/awwwards_primitives_demo.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runtimeSourceFor } from '../lib/runtime/scroll-progress.ts';
import { runtimePrimitiveRules } from '../lib/render/runtime-rules.ts';

const primitives = [
  'marquee', 'image-hover-reveal', 'animated-counter',
  'sticky-text-pin', 'menu-overlay', 'magnetic-cursor',
  'scroll-reveal', 'bento-card-tilt', 'horizontal-scroll',
];

const js = runtimeSourceFor(primitives);
const css = runtimePrimitiveRules(primitives);

const html = `<!doctype html><html lang="en" data-runtime="scroll-progress" data-runtime-cursor="magnetic"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{
  --font-display:'Times New Roman',serif; --color-accent:#e23b2e; --color-bg:#0d0d0d;
  --color-on-bg:#f5f1ea; --color-surface:#15110d; --color-border:#3a342c; --space-md:1.5rem;
  --marquee-duration:18s;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Helvetica,Arial,sans-serif;background:var(--color-on-bg);color:var(--color-bg);line-height:1.5}
section{padding:8vh 6vw}
h1{font-family:var(--font-display);font-size:clamp(3rem,12vw,9rem);text-transform:uppercase;line-height:0.9}
h2{font-family:var(--font-display);font-size:clamp(2rem,6vw,4rem);text-transform:uppercase;margin-bottom:1rem}
.kicker{text-transform:uppercase;letter-spacing:.3em;font-size:.8rem;opacity:.6}
.dark{background:var(--color-bg);color:var(--color-on-bg)}
.hero{height:100vh;display:flex;flex-direction:column;justify-content:center;gap:1rem}
/* marquee */
.marquee-demo{background:var(--color-bg);color:var(--color-on-bg);padding:2rem 0}
/* image reveal */
.img-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.img-grid [data-runtime-img-reveal]{aspect-ratio:4/5;background:#ccc}
.img-grid [data-runtime-img-reveal] img{border-radius:8px}
/* counter */
.counters{display:flex;gap:4rem;flex-wrap:wrap}
.counter{font-family:var(--font-display);font-size:4rem}
.counter small{display:block;font-family:sans-serif;font-size:.9rem;text-transform:uppercase;letter-spacing:.1em}
/* bento */
.bento{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:160px;gap:1rem}
.bento [data-tilt]{background:var(--color-bg);color:var(--color-on-bg);border-radius:12px;padding:1rem}
.bento [data-tilt]:nth-child(1){grid-column:span 2;grid-row:span 2}
/* horizontal scroll */
.hscroll{height:100vh;display:flex;align-items:center}
[data-runtime-hscroll]{width:100%}
[data-runtime-hscroll] [data-hscroll-track]{gap:1rem}
[data-runtime-hscroll] [data-hscroll-track]>div{flex:0 0 60vw;height:60vh;background:var(--color-bg);color:var(--color-on-bg);border-radius:12px;display:grid;place-content:center;font-family:var(--font-display);font-size:2rem}
/* sticky pin */
.pin-copy{max-width:40ch;font-family:var(--font-display);font-size:clamp(1.6rem,4vw,3rem)}
.pin-progress{margin-top:2rem}
/* menu */
[data-menu-overlay] a:nth-child(2){color:var(--color-accent)}
</style>
<style>${css}</style>
</head><body>
<button data-menu-toggle aria-label="Menu" aria-expanded="false">☰</button>
<nav data-menu-overlay>
  <a href="#home">Home</a><a href="#work">Work</a><a href="#about" style="color:var(--color-accent)">About</a><a href="#contact">Contact</a>
</nav>

<section class="hero dark" id="home">
  <span class="kicker">Est. 1888 — Lower East Side</span>
  <h1>Katz's<br>Delicatessen</h1>
  <p>A site of the day, built from components.</p>
</section>

<section class="marquee-demo"><div data-runtime-marquee>
  <div class="marquee__track">
    <span class="marquee__item">Pastrami on rye · </span><span class="marquee__item">Since 1888 · </span><span class="marquee__item">Hand-carved · </span><span class="marquee__item">New York icon · </span>
    <span class="marquee__item">Pastrami on rye · </span><span class="marquee__item">Since 1888 · </span><span class="marquee__item">Hand-carved · </span><span class="marquee__item">New York icon · </span>
  </div>
  <div class="marquee__track" aria-hidden="true">
    <span class="marquee__item">Pastrami on rye · </span><span class="marquee__item">Since 1888 · </span><span class="marquee__item">Hand-carved · </span><span class="marquee__item">New York icon · </span>
    <span class="marquee__item">Pastrami on rye · </span><span class="marquee__item">Since 1888 · </span><span class="marquee__item">Hand-carved · </span><span class="marquee__item">New York icon · </span>
  </div>
</div></section>

<section id="work"><h2>Gallery</h2>
  <div class="img-grid">
    <a data-runtime-img-reveal><img src="https://picsum.photos/seed/katz1/600/750" alt=""></a>
    <a data-runtime-img-reveal><img src="https://picsum.photos/seed/katz2/600/750" alt=""></a>
    <a data-runtime-img-reveal><img src="https://picsum.photos/seed/katz3/600/750" alt=""></a>
  </div>
</section>

<section class="dark"><h2>By the numbers</h2>
  <div class="counters">
    <div><div class="counter" data-count-to="137">0</div><small>Years open</small></div>
    <div><div class="counter" data-count-to="15000">0</div><small>Pastrami lbs / week</small></div>
    <div><div class="counter" data-count-to="48">0</div><small>States shipped to</small></div>
  </div>
</section>

<section><h2>Menu board</h2>
  <div class="bento">
    <div data-tilt><strong>Pastrami</strong><br>on rye</div>
    <div data-tilt>Corned beef</div>
    <div data-tilt>Hot dog</div>
    <div data-tilt>Knish</div>
    <div data-tilt>Cheesecake</div>
    <div data-tilt>Tongue</div>
  </div>
</section>

<section class="hscroll dark"><div data-runtime-hscroll><div data-hscroll-track>
  <div>Signature</div><div>Counter</div><div>Window</div><div>History</div>
</div></div></section>

<section data-runtime-pin class="dark" id="about"><div>
  <h2>The story</h2>
  <p class="pin-copy">A counter that has served New York for 137 years — now with a website that moves like the city.</p>
  <div class="pin-progress" data-pin-progress></div>
</div></section>

<section id="contact"><h2>Visit</h2><p>205 E Houston St, New York.</p></section>

<script type="module">${js}</script>
</body></html>`;

mkdirSync('preview', { recursive: true });
const path = 'preview/awwwards-primitives.html';
writeFileSync(path, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('file://' + process.cwd() + '/' + path);
await page.waitForTimeout(800);
await page.screenshot({ path: 'preview/primitives-desktop-top.png' });
// scroll to counters to trigger count-up, then to pin
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.42));
await page.waitForTimeout(1600);
await page.screenshot({ path: 'preview/primitives-desktop-counters.png' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.85));
await page.waitForTimeout(900);
await page.screenshot({ path: 'preview/primitives-desktop-pin.png' });
// open menu
await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-menu-toggle]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'preview/primitives-desktop-menu.png' });
// mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await m.goto('file://' + process.cwd() + '/' + path);
await m.waitForTimeout(600);
await m.screenshot({ path: 'preview/primitives-mobile-top.png' });
await browser.close();
console.log('demo written ->', path);
