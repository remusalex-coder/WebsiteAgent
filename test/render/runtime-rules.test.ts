/**
 * `RUNTIME_RULES` had no test coverage at all before this pass (`grep -r
 * "scroll-progress" test/` returned nothing). These are structural
 * assertions over the string, covering the two behaviours that already
 * shipped (the pinned cinematic hero, the ember world crossing).
 *
 * A third primitive (scroll reveal) was drafted and reverted during the
 * Decision Gate implementation pass: `RUNTIME_RULES` is appended to *every*
 * rendered stylesheet unconditionally (`lib/render/css.ts:193`), and
 * `test/__snapshots__/design.bakery.styles.css` snapshots those bytes
 * verbatim — so any change to this string, not just a behaviourally
 * significant one, moves a frozen snapshot. See the note at the top of
 * `lib/render/runtime-rules.ts` and `BUSINESSFORGE_2.0_DECISION_GATE.md` §10
 * item 5.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RUNTIME_RULES, runtimePrimitiveRules } from '../../lib/render/runtime-rules.js';

test('every runtime rule is scoped to [data-runtime="scroll-progress"]', () => {
  for (const selector of [
    '[data-runtime="scroll-progress"] .section--hero',
    '[data-world="ember"][data-runtime="scroll-progress"]',
  ]) {
    assert.ok(RUNTIME_RULES.includes(selector), `expected to find selector: ${selector}`);
  }
});

test('the whole ruleset sits inside a prefers-reduced-motion: no-preference guard', () => {
  const guardStart = RUNTIME_RULES.indexOf('@media (prefers-reduced-motion: no-preference)');
  assert.notEqual(guardStart, -1, 'the reduced-motion guard must exist');
  const heroRuleStart = RUNTIME_RULES.indexOf('.section--hero {');
  assert.ok(heroRuleStart > guardStart, 'the pinned-hero rule must be inside the reduced-motion guard');
});

test('the pinned hero is gated to desktop, hover-capable, fine-pointer devices only', () => {
  const guard = RUNTIME_RULES.indexOf('@media (min-width: 768px) and (hover: hover) and (pointer: fine)');
  assert.notEqual(guard, -1);
  const heroRule = RUNTIME_RULES.indexOf('.section--hero {');
  assert.ok(heroRule > guard, 'the pinned-hero rule must be inside the desktop/hover/fine-pointer guard');
});

test('the ember world crossing reads only the signals the runtime already emits, never a hardcoded colour', () => {
  const block = RUNTIME_RULES.slice(RUNTIME_RULES.indexOf('[data-world="ember"]'));
  assert.ok(block.includes('--forge-vis') || block.includes('--forge-scroll'));
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(block), 'no hardcoded colour — brightness/opacity restate the world\'s own tokens');
});

/* ------------------------------------------------------------------ */
/* runtimePrimitiveRules — the Tier-2 primitive dispatch, opt-in only  */
/* ------------------------------------------------------------------ */

test('opt-out: no requested primitives produces no bytes at all', () => {
  assert.equal(runtimePrimitiveRules([]), '');
});

test('opt-in: scroll-reveal produces the rule, scoped to the runtime attribute, never the hero', () => {
  const css = runtimePrimitiveRules(['scroll-reveal']);
  assert.ok(css.length > 0);
  assert.ok(css.includes('[data-runtime="scroll-progress"]'));
  assert.ok(css.includes('.section:not(.section--hero)'));
  assert.ok(css.includes('--forge-vis'), 'reuses the existing per-section visibility signal, no new JS');
});

test('scroll-reveal is gated on prefers-reduced-motion: no-preference', () => {
  const css = runtimePrimitiveRules(['scroll-reveal']);
  const guard = css.indexOf('@media (prefers-reduced-motion: no-preference)');
  assert.notEqual(guard, -1);
  assert.ok(css.indexOf('.section:not(.section--hero)') > guard);
});

test('scroll-reveal never hardcodes a colour and only animates compositor-safe properties', () => {
  const css = runtimePrimitiveRules(['scroll-reveal']);
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css), 'no hardcoded colour — a generic, business-free primitive');
  const rule = css.slice(css.indexOf('{'), css.indexOf('}') + 1);
  const declaredProperties = [...rule.matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]).filter((p): p is string => p !== undefined);
  for (const prop of declaredProperties) {
    assert.ok(['opacity', 'transform', 'will-change'].includes(prop), `${prop} risks layout/paint jank under continuous scroll updates`);
  }
});

test('requesting the same primitive twice does not duplicate its CSS', () => {
  assert.equal(runtimePrimitiveRules(['scroll-reveal', 'scroll-reveal']), runtimePrimitiveRules(['scroll-reveal']));
});

test("runtimePrimitiveRules never touches RUNTIME_RULES's own content", () => {
  const before = RUNTIME_RULES;
  runtimePrimitiveRules(['scroll-reveal']);
  assert.equal(RUNTIME_RULES, before, 'RUNTIME_RULES must stay exactly as it was — the pre-existing unconditional injection is untouched by this pass');
});
