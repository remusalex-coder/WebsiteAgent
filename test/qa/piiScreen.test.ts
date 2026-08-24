/**
 * P4-7 — PII screening at normalize, pre-model (N-19, CP10).
 *
 * A typed boundary marks a field structurally unrenderable; a boundaried
 * personal mobile never reaches a brief.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyPhone, classifyEmail } from '../../lib/sources/piiScreen.js';

test('a business-published phone passes unchanged', () => {
  const result = classifyPhone('+40 21 555 0100', { businessPublished: true, individualConsented: false }, 'maps');
  assert.equal(result.boundary, null);
  assert.equal(result.suppressedValue, null);
});

test('a personal mobile attributed to an individual is boundaried', () => {
  const result = classifyPhone('+40 722 555 019', { businessPublished: false, individualConsented: false }, 'profile');
  assert.ok(result.boundary !== null);
  assert.equal(result.boundary.kind, 'phone');
  assert.equal(result.boundary.masked, 'REDACTED');
  assert.equal(result.suppressedValue, '+40 722 555 019');
  assert.match(result.boundary.fingerprint, /^…5019$/, 'fingerprint shows only the last digits');
});

test('an individually-consented phone passes', () => {
  const result = classifyPhone('+40 722 555 019', { businessPublished: false, individualConsented: true }, 'profile');
  assert.equal(result.boundary, null);
});

test('a phone with no personal attribution is not screened on digits alone', () => {
  const result = classifyPhone('+40 722 555 019', { businessPublished: false, individualConsented: false }, 'website');
  assert.equal(result.boundary, null, 'nothing is guessed from digits alone');
});

test('a personal email attached to a review byline is boundaried', () => {
  const result = classifyEmail('jane@example.com', { businessPublished: false, individualConsented: false }, 'review');
  assert.ok(result.boundary !== null);
  assert.equal(result.boundary.kind, 'email');
  assert.match(result.boundary.fingerprint, /^j…@example\.com$/);
});

test('a business email passes', () => {
  const result = classifyEmail('contact@bakery.ro', { businessPublished: true, individualConsented: false }, 'website');
  assert.equal(result.boundary, null);
});

test('a boundary is structurally distinct from a renderable value', () => {
  const result = classifyPhone('+40 722 555 019', { businessPublished: false, individualConsented: false }, 'profile');
  const boundary = result.boundary!;
  // The marker is a fixed constant, not a sanitised echo of the value: no
  // render path could accidentally print the original.
  assert.equal(boundary.masked, 'REDACTED');
  assert.notEqual(boundary.fingerprint, '+40 722 555 019');
});