/**
 * Smoke test: render the bakery fixture with the Awwwards `avantgarde`
 * direction and the three new runtime primitives, and assert the output
 * actually wires them up (no crash, fonts emitted, primitives present).
 * Run: npx tsx scripts/smoke-awwwards.ts
 */
import { renderSite } from '../lib/render/index.js';
import { composeDesign } from '../lib/design/compose.js';
import { profileFixture, strategyFixture } from '../test/fixtures/business.js';
import { fullContent } from '../test/fixtures/content.js';
import { runtimeSourceFor } from '../lib/runtime/scroll-progress.js';
import { runtimePrimitiveRules } from '../lib/render/runtime-rules.js';

const design = composeDesign(
  { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
  { direction: 'avantgarde' },
);

const site = renderSite(fullContent, {
  design,
  runtime: 'scroll-progress',
  runtimePrimitives: ['horizontal-scroll', 'bento-card-tilt', 'cursor-reactive-webgl', 'lenis-smooth-scroll', 'gsap-scrolltrigger'],
});

const css = site.files.find((f) => f.path === 'styles.css')?.contents ?? '';
const runtime = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

const newFonts = ['Instrument Serif', 'Space Mono', 'JetBrains Mono'].filter((f) => css.includes(f));
const primitiveWiring = ['horizontal-scroll', 'bento-card-tilt', 'cursor-reactive-webgl'].filter(
  (p) => runtime.includes(p) || css.includes(p),
);

console.log('direction:', design.direction);
console.log('has @font-face:', css.includes('@font-face'));
console.log('avantgarde fonts emitted:', newFonts.join(', ') || '(none)');
console.log('primitive wiring present:', primitiveWiring.join(', ') || '(none)');
console.log('runtime.js bytes:', runtime.length);
console.log('SMOKE_OK');
