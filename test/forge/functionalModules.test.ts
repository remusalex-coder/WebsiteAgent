/**
 * Functional modules — the concrete build contract for "beyond a landing
 * page". `lib/forge` renders a static site with no backend, so every spec
 * here resolves to a real, zero-infrastructure mechanism (mailto:) rather
 * than a form that silently does nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { functionalModulePrompt, specFor } from '../../lib/forge/functionalModules.js';

const dossier = { businessName: 'Ridgeway Motors', contact: { phone: '0700 000 000', email: 'hello@ridgeway.test' } };

test('"none" has no spec', () => {
  assert.equal(specFor('none', dossier), null);
});

test('every non-"none" module id has a spec with at least one real state beyond "idle"', () => {
  const ids = ['enquiry-form', 'booking-request', 'service-selector', 'product-configurator', 'search-filter', 'comparison-tool', 'calculator'] as const;
  for (const id of ids) {
    const spec = specFor(id, dossier);
    assert.ok(spec, `expected a spec for ${id}`);
    assert.ok(spec!.states.length >= 2, `${id} should have more than one state`);
  }
});

test('enquiry-form and booking-request use mailto — the only mechanism honest for a backend-less static site', () => {
  assert.equal(specFor('enquiry-form', dossier)!.submissionMechanism, 'mailto');
  assert.equal(specFor('booking-request', dossier)!.submissionMechanism, 'mailto');
});

test('booking-request preserves the visitor\'s preferred date as a real field, not lost through the flow', () => {
  const spec = specFor('booking-request', dossier)!;
  assert.ok(spec.fields.some((f) => f.name === 'preferredDate'));
});

test('client-side-only modules (service-selector, filters, etc.) never claim mailto', () => {
  for (const id of ['service-selector', 'product-configurator', 'search-filter', 'comparison-tool', 'calculator'] as const) {
    assert.equal(specFor(id, dossier)!.submissionMechanism, 'none');
  }
});

test('an empty module list produces an explicit "none selected" instruction, not silence', () => {
  const prompt = functionalModulePrompt(['none'], dossier);
  assert.match(prompt, /none selected/i);
});

test('a selected module\'s prompt names its real fields and forbids a fetch/POST call (no backend exists)', () => {
  const prompt = functionalModulePrompt(['booking-request'], dossier);
  assert.match(prompt, /preferredDate/);
  assert.match(prompt, /no backend/i);
  assert.match(prompt, /real inline validation/i);
});

test('calculator explicitly forbids inventing a price absent verified pricing evidence', () => {
  const spec = specFor('calculator', dossier)!;
  assert.match(spec.afterAction, /verified pricing|declines to show a number/i);
});
