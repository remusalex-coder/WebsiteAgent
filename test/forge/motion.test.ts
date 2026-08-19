/**
 * The Motion System — numbers transcribed from `docs/knowledge/MOTION_LIBRARY.md`,
 * and the four-intensity contract that closes them into an enforceable system.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CURSOR_LERP_FORMULA,
  DURATION_BANDS_MS,
  EASING_CATALOG,
  FORBIDDEN_LIBRARIES,
  FORBIDDEN_TECHNIQUES,
  MOTION_CONTRACTS,
  MOTION_INTENSITIES,
  motionContractFor,
  motionContractPrompt,
  motionLibraryHtmlPrompt,
  staggerMsFor,
  staggerSequenceMs,
  STAGGER_BUDGET_MS,
} from '../../lib/forge/motion.js';

test('duration bands are transcribed verbatim from the research corpus', () => {
  assert.deepEqual(DURATION_BANDS_MS.microFeedback, [80, 120]);
  assert.deepEqual(DURATION_BANDS_MS.hover, [100, 200]);
  assert.deepEqual(DURATION_BANDS_MS.stateChange, [150, 250]);
  assert.deepEqual(DURATION_BANDS_MS.elementReveal, [200, 400]);
  assert.deepEqual(DURATION_BANDS_MS.sectionTransition, [300, 500]);
  assert.deepEqual(DURATION_BANDS_MS.pageRouteTransition, [300, 600]);
});

test('every duration band stays within the 400ms element-reveal ceiling except the two that are allowed past it', () => {
  for (const [band, [, max]] of Object.entries(DURATION_BANDS_MS)) {
    if (band === 'sectionTransition' || band === 'pageRouteTransition') continue;
    assert.ok(max <= 400, `${band} max ${max}ms exceeds the single-element reveal ceiling`);
  }
});

test('arrivals decelerate, exits accelerate — never the reverse', () => {
  assert.equal(EASING_CATALOG.decelerate.avoidFor.includes('exit'), true);
  assert.equal(EASING_CATALOG.accelerate.avoidFor, 'entrances');
});

test('spring has no CSS cubic-bezier — it is JS-runtime only and must say so', () => {
  assert.equal(EASING_CATALOG.spring.cubicBezier, null);
});

test('overshoot is never for error/data/loading/validation moments', () => {
  assert.match(EASING_CATALOG.overshoot.avoidFor, /error|data|loading|validation/i);
});

test('stagger-per-item shrinks as the list grows, per the research table', () => {
  assert.equal(staggerMsFor(4), 90);
  assert.equal(staggerMsFor(8), 60);
  assert.equal(staggerMsFor(15), 35);
  assert.equal(staggerMsFor(30), 0); // 21+: prefer no stagger
});

test('a 5-item list at the documented duration fits the list budget (540-900ms band, budget 600ms at the low end)', () => {
  // The research table's own worked example: 3-5 items at 80-100ms/item, 300ms item duration.
  const total = staggerSequenceMs(5, 300);
  assert.ok(total <= 900, `expected <=900ms, got ${total}ms`);
});

test('over-budget staggers reduce toward zero rather than silently exceeding the budget', () => {
  // 25 items would blow any list budget with a nonzero per-item stagger;
  // the table's reduction order ends in "drop stagger entirely".
  assert.equal(staggerMsFor(25), 0);
  const total = staggerSequenceMs(25, 300);
  assert.equal(total, 300); // all at once, not 25 * some nonzero stagger
});

test('MOTION_INTENSITIES lists exactly the four closed values', () => {
  assert.deepEqual([...MOTION_INTENSITIES].sort(), ['expressive', 'immersive', 'none', 'subtle']);
});

test('"none" still forbids the anti-motion list — restraint is not an exemption from it', () => {
  const contract = motionContractFor('none');
  assert.deepEqual(contract.forbiddenTechniques, FORBIDDEN_TECHNIQUES);
  assert.equal(contract.permitsPageTransitions, false);
  assert.equal(contract.permitsPinnedStorytelling, false);
});

test('intensity widens monotonically: each level permits everything the one below it does, plus more', () => {
  const none = motionContractFor('none');
  const subtle = motionContractFor('subtle');
  const expressive = motionContractFor('expressive');
  const immersive = motionContractFor('immersive');

  assert.ok(subtle.allowedDurationBands.length >= none.allowedDurationBands.length);
  assert.ok(expressive.allowedDurationBands.length >= subtle.allowedDurationBands.length);
  assert.ok(immersive.allowedDurationBands.length >= expressive.allowedDurationBands.length);

  // page transitions and pinned storytelling are immersive-only
  assert.equal(none.permitsPageTransitions, false);
  assert.equal(subtle.permitsPageTransitions, false);
  assert.equal(expressive.permitsPageTransitions, false);
  assert.equal(immersive.permitsPageTransitions, true);
});

test('every contract, at every intensity, carries the full unconditional forbidden-techniques list', () => {
  for (const intensity of MOTION_INTENSITIES) {
    const contract = motionContractFor(intensity);
    assert.deepEqual(contract.forbiddenTechniques, FORBIDDEN_TECHNIQUES, `${intensity} must forbid the same techniques as every other intensity`);
  }
});

test('spring easing is only ever allowed at immersive — it requires a JS runtime the other intensities do not assume', () => {
  assert.equal(motionContractFor('none').allowedEasings.includes('spring'), false);
  assert.equal(motionContractFor('subtle').allowedEasings.includes('spring'), false);
  assert.equal(motionContractFor('expressive').allowedEasings.includes('spring'), false);
  assert.equal(motionContractFor('immersive').allowedEasings.includes('spring'), true);
});

test('the prompt fragment names every allowed duration and easing, and the unconditional forbidden list', () => {
  const prompt = motionContractPrompt(motionContractFor('expressive'));
  assert.match(prompt, /200-400ms/); // elementReveal
  assert.match(prompt, /emphasizedDecelerate/);
  assert.match(prompt, /scroll-hijacking/);
  assert.match(prompt, /prefers-reduced-motion: reduce/);
});

test('the "none" prompt fragment is explicit that no animated transition is available, not merely quiet', () => {
  const prompt = motionContractPrompt(motionContractFor('none'));
  assert.match(prompt, /no animated transitions beyond instant state changes/);
});

/* -------------------------------------------------------------------- */
/* Library guidance — bf_research/BUSINESSFORGE_EXPERIENCE_ARSENAL_v2.md */
/* -------------------------------------------------------------------- */

test('"none" and "subtle" recommend no JS animation library — CSS only, zero dependencies', () => {
  assert.deepEqual(motionContractFor('none').libraries.recommended, ['CSS transitions/animations only — no JS animation library']);
  assert.ok(motionContractFor('subtle').libraries.recommended.every((l) => !/GSAP|Lenis/i.test(l)));
});

test('"expressive" and "immersive" recommend the OBSERVED real-world stack: GSAP + ScrollTrigger + Lenis', () => {
  for (const intensity of ['expressive', 'immersive'] as const) {
    const recommended = motionContractFor(intensity).libraries.recommended.join(' ');
    assert.match(recommended, /GSAP/);
    assert.match(recommended, /ScrollTrigger/);
    assert.match(recommended, /Lenis/);
  }
});

test('OGL, not Three.js, is the recommended 3D entry point, and only at immersive intensity', () => {
  const immersive = motionContractFor('immersive').libraries.recommended.join(' ');
  assert.match(immersive, /OGL/);
  // "Three.js" appears only as an explicit negation ("OGL (not Three.js)") —
  // never as a standalone recommendation of its own.
  assert.match(immersive, /OGL \(not Three\.js\)/);
  for (const intensity of ['none', 'subtle', 'expressive'] as const) {
    assert.doesNotMatch(motionContractFor(intensity).libraries.recommended.join(' '), /OGL/);
  }
});

test('Locomotive Scroll is forbidden at every intensity — confirmed unmaintained; Lenis is the direct replacement', () => {
  assert.deepEqual(FORBIDDEN_LIBRARIES, ['Locomotive Scroll (unmaintained/deprecated — use Lenis for the same job)']);
  for (const intensity of MOTION_INTENSITIES) {
    assert.deepEqual(motionContractFor(intensity).libraries.forbidden, FORBIDDEN_LIBRARIES);
  }
});

test('the prompt fragment names the recommended libraries and forbids Locomotive Scroll', () => {
  const prompt = motionContractPrompt(motionContractFor('expressive'));
  assert.match(prompt, /GSAP/);
  assert.match(prompt, /Lenis/);
  assert.match(prompt, /Locomotive Scroll/);
});

test('the prompt fragment includes the frame-rate-independent cursor lerp formula, not a naive fixed-fraction one', () => {
  const prompt = motionContractPrompt(motionContractFor('expressive'));
  assert.match(prompt, /exponential smoothing/);
  assert.ok(prompt.includes(CURSOR_LERP_FORMULA));
  assert.match(CURSOR_LERP_FORMULA, /Math\.exp/);
});

/* -------------------------------------------------------------------- */
/* motionLibraryHtmlPrompt — the Pass-1 fragment that fixes the plumbing */
/* gap: a CDN <script> tag has to land in the HTML pass, which never saw */
/* the full motion contract before this.                                 */
/* -------------------------------------------------------------------- */

test('"none" and "subtle" tell the HTML pass explicitly not to add a library CDN tag', () => {
  for (const intensity of ['none', 'subtle'] as const) {
    const prompt = motionLibraryHtmlPrompt(motionContractFor(intensity));
    assert.match(prompt, /none recommended/);
    assert.match(prompt, /do not add/i);
  }
});

test('"expressive" and "immersive" name the specific libraries and instruct loading them in THIS document', () => {
  for (const intensity of ['expressive', 'immersive'] as const) {
    const prompt = motionLibraryHtmlPrompt(motionContractFor(intensity));
    assert.match(prompt, /GSAP/);
    assert.match(prompt, /Lenis/);
    assert.match(prompt, /THIS document/);
  }
});

test('the HTML-pass fragment forbids Locomotive Scroll too, same as the full contract', () => {
  const prompt = motionLibraryHtmlPrompt(motionContractFor('immersive'));
  assert.match(prompt, /Locomotive Scroll/);
});
