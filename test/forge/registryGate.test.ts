/**
 * `checkRuntimePrimitiveRegistryGate` — the check that stops
 * `lib/forge/builder.ts` from shipping a runtime library
 * `lib/design/experienceRegistry.ts` never registered, or from exceeding
 * `RUNTIME_PRIMITIVE_BUDGET` — the same "declare it, do not silently reach
 * for it" rule the classic pipeline's `resolvePrimitives` already enforces,
 * now applied to Forge's output too.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkRuntimePrimitiveRegistryGate } from '../../lib/forge/registryGate.js';

import type { GeneratedCode } from '../../lib/forge/types.js';

function code(js: string): GeneratedCode {
  return { html: '<html><body></body></html>', css: '', js };
}

test('code with no runtime-library calls at all passes with no flags', () => {
  const flags = checkRuntimePrimitiveRegistryGate(code('console.log("hi");'));
  assert.deepEqual(flags, []);
});

test('GSAP + ScrollTrigger, a registered primitive, passes clean', () => {
  const flags = checkRuntimePrimitiveRegistryGate(code('ScrollTrigger.create({}); gsap.to(".x", {});'));
  assert.deepEqual(flags, []);
});

test('Lenis, a registered primitive, passes clean', () => {
  const flags = checkRuntimePrimitiveRegistryGate(code('const lenis = new Lenis();'));
  assert.deepEqual(flags, []);
});

test('Three.js, a registered primitive, passes clean', () => {
  const flags = checkRuntimePrimitiveRegistryGate(code('const scene = new THREE.Scene();'));
  assert.deepEqual(flags, []);
});

test('OGL has no registry entry — using it fails outright, never silently passes', () => {
  const flags = checkRuntimePrimitiveRegistryGate(code(`import { Renderer } from 'ogl'; const r = new Renderer();`));
  assert.ok(flags.some((f) => f.code === 'RUNTIME_PRIMITIVE_UNREGISTERED'));
  assert.ok(flags.every((f) => f.severity === 'fail'));
});

test('using more distinct registered primitives than RUNTIME_PRIMITIVE_BUDGET fails as over-budget', () => {
  // GSAP+ScrollTrigger, Lenis, and Three.js are three distinct registered
  // primitives — one over the budget of 2.
  const flags = checkRuntimePrimitiveRegistryGate(code(
    'ScrollTrigger.create({}); const lenis = new Lenis(); const s = new THREE.Scene();',
  ));
  assert.ok(flags.some((f) => f.code === 'RUNTIME_PRIMITIVE_BUDGET_EXCEEDED'));
});

test('two distinct registered primitives, exactly at budget, does not trip the budget flag', () => {
  const flags = checkRuntimePrimitiveRegistryGate(code('ScrollTrigger.create({}); const lenis = new Lenis();'));
  assert.ok(!flags.some((f) => f.code === 'RUNTIME_PRIMITIVE_BUDGET_EXCEEDED'));
});
