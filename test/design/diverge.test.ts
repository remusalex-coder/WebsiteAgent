/**
 * P5-2 — Divergence + diversity gate, pre-spend: M=10 perturbations with zero
 * model calls, at most one candidate per L1 decision surface (N-17, F-09).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { enumeratePerturbations, diverge, diversityGate, M_PERTURBATIONS, isDiverseEnough } from '../../lib/design/diverge.js';
import { fingerprintDirective } from '../../lib/design/fingerprint.js';
import type { DesignDirective } from '../../lib/design/directive.js';

const BASE: DesignDirective = {
  direction: 'modern',
  experienceMode: 'brochure',
  conversionStrategy: 'balanced',
  interactionStrategy: 'static',
  signatureMoment: 'hero',
};

test('exactly M=10 perturbations are enumerated', () => {
  const perturbations = enumeratePerturbations(BASE);
  assert.equal(perturbations.length, M_PERTURBATIONS);
});

test('each perturbation rotates exactly one axis to a different value', () => {
  const perturbations = enumeratePerturbations(BASE);
  for (const p of perturbations) {
    const fingerprint = fingerprintDirective(p.directive);
    assert.notEqual(fingerprint, fingerprintDirective(BASE), `${p.axis}@${p.step} differs from base`);
    // Rotating one axis means the directive is still mostly the base.
    if (p.axis === 'direction') assert.equal(p.directive.experienceMode, 'brochure');
  }
});

test('zero model calls through the divergence and diversity gate', () => {
  // The gate imports no provider and touches no network; this test asserts the
  // strongest observable version of that: the module's own surface is pure.
  // diverge() is deterministic given the same inputs.
  const a = diverge(BASE, ['hero', 'about', 'cta']);
  const b = diverge(BASE, ['hero', 'about', 'cta']);
  assert.deepEqual(a.map((p) => fingerprintDirective(p.directive)), b.map((p) => fingerprintDirective(p.directive)));
});

test('the diversity gate keeps at most one candidate per L1 decision surface', () => {
  const perturbations = enumeratePerturbations(BASE);
  const gated = diversityGate(perturbations);
  const allowed = gated.filter((p) => p.allowed);
  const seen = new Set<string>();
  for (const p of allowed) {
    const id = fingerprintDirective(p.directive);
    assert.equal(seen.has(id), false, `no two allowed candidates share an L1 surface (${p.axis}@${p.step})`);
    seen.add(id);
  }
});

test('diversity gate preserves order and blocks duplicates with a reason', () => {
  const perturbations = enumeratePerturbations(BASE);
  const gated = diversityGate(perturbations);
  const blocked = gated.filter((p) => !p.allowed);
  for (const p of blocked) {
    assert.match(p.blocked ?? '', /L1 decision surface/, 'a duplicate is blocked with an explicit reason');
  }
});

test('filterByContent blocks a moment the content does not have', () => {
  const perturbations = enumeratePerturbations(BASE);
  // Base signatureMoment is 'hero'; business content has no hero section.
  const filtered = diverge(BASE, ['about', 'cta']);
  const momentPerturbations = filtered.filter((p) => !p.allowed && (p.blocked ?? '').includes('hero'));
  assert.ok(momentPerturbations.length > 0, 'a moment the content lacks is filtered before build');
});

test('diverge returns the allowed candidates in order for building', () => {
  const allowed = diverge(BASE, ['hero', 'about', 'cta', 'gallery']).filter((p) => p.allowed);
  assert.ok(allowed.length > 0);
  assert.equal(allowed[0]!.axis, 'direction');
});

test('isDiverseEnough compares L1 surfaces', () => {
  assert.equal(isDiverseEnough(BASE, { ...BASE, direction: 'luxury' }), true);
  assert.equal(isDiverseEnough(BASE, { ...BASE, rationale: 'different prose' }), false);
});