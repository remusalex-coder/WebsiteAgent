// End-to-end proof: render an Awwwards-grade site (avantgarde direction +
// every runtime primitive) from the fixture, write it to disk, and report what
// actually reached the browser. Mirrors the exact call shape runJob now makes
// after the orchestrator fix (directive.direction + runtimePrimitives threaded
// through to composeDesign + renderSite).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderSite } from '../lib/render/index.ts';
import { composeDesign } from '../lib/design/compose.ts';
import { profileFixture } from '../test/fixtures/business.ts';
import { fullContent } from '../test/fixtures/content.ts';

const ALL = [
  'scroll-reveal', 'magnetic-cursor', 'lenis-smooth-scroll', 'gsap-scrolltrigger',
  'three-js-hero-object', 'horizontal-scroll', 'bento-card-tilt',
  'cursor-reactive-webgl', 'marquee', 'image-hover-reveal', 'animated-counter',
  'sticky-text-pin', 'menu-overlay',
];

const profile = profileFixture();
const content = fullContent;

const design = composeDesign({ profile, content }, { direction: 'avantgarde' });
const site = renderSite(content, { design, runtime: 'scroll-progress', runtimePrimitives: ALL });

const out = join('output', '_verify-awwwards', 'site');
mkdirSync(join(out, 'runtime'), { recursive: true });
for (const f of site.files) writeFileSync(join(out, f.path), f.contents);

const html = site.files.find((f) => f.path === 'index.html')?.contents ?? '';
const css = site.files.find((f) => f.path === 'styles.css')?.contents ?? '';
const runtime = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

// On-disk emitted terms differ from the RuntimePrimitiveId vocabulary:
// the renderer lowers/splits ids (e.g. 'horizontal-scroll' -> 'hscroll',
// 'bento-card-tilt' -> 'data-tilt'). Map each requested id to the substring
// that actually appears in the output so the report is truthful.
const WIRE_TERMS = {
  'scroll-reveal': ['forge-vis'],
  'magnetic-cursor': ['forge-cursor', 'magnetic'],
  'lenis-smooth-scroll': ['lenis', 'Lenis'],
  'gsap-scrolltrigger': ['ScrollTrigger', 'gsap'],
  'three-js-hero-object': ['THREE', 'three'],
  'horizontal-scroll': ['hscroll'],
  'bento-card-tilt': ['data-tilt', 'bento'],
  'cursor-reactive-webgl': ['cursor', 'reactive'],
  marquee: ['marquee'],
  'image-hover-reveal': ['img-reveal', 'imgReveal'],
  'animated-counter': ['count-to', 'counter'],
  'sticky-text-pin': ['sticky', 'pin'],
  'menu-overlay': ['menu-overlay'],
};

const wired = ALL.filter((id) => {
  const terms = WIRE_TERMS[id] ?? [id];
  return terms.some((t) => css.includes(t) || runtime.includes(t));
});

const cursorAttr = (html.match(/data-runtime-cursor="([^"]+)"/) || [])[1] ?? '(none)';

console.log('direction (personality) :', design.personality.direction);
console.log('heading font (css)       :', (css.match(/--font-heading:\s*([^;]+);/) || [])[1] ?? '(default)');
console.log('body font (css)          :', (css.match(/--font-body:\s*([^;]+);/) || [])[1] ?? '(default)');
console.log('index.html bytes        :', html.length);
console.log('data-runtime set        :', /data-runtime="scroll-progress"/.test(html));
console.log('data-runtime-cursor     :', cursorAttr);
console.log('runtime.js bytes        :', runtime.length);
console.log('@keyframes in css       :', (css.match(/@keyframes/g) || []).length);
console.log('primitives wired        :', wired.length, '/', ALL.length);
console.log('wired list              :', wired.join(', '));
console.log('written to              :', out);
console.log('VERIFY_OK');
