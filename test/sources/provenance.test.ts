/**
 * Deterministic tests for the A1 provenance architecture.
 *
 * These exercise `foldProvenance` and the `BusinessProfile` plumbing without any
 * network, browser, or model. They must run under `npm test` (node --test).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { foldProvenance, type SourceProvenance } from '../../lib/sources/collectedSources.js';
import { FIELD_AUTHORITY, authorityRank } from '../../lib/sources/authority.js';
import type { ProvenanceNote, BlockedSource } from '../../lib/sources/types.js';

const note = (
  confidence: ProvenanceNote['confidence'],
  status: ProvenanceNote['status'],
  text?: string,
): Omit<ProvenanceNote, 'sources'> => ({ confidence, status, note: text });

const part = (
  sourceClass: string,
  sourceUrl: string,
  fields: Record<string, Omit<ProvenanceNote, 'sources'>>,
): SourceProvenance => ({ sourceClass, sourceUrl, fields });

test('foldProvenance: single source yields agreed, single-source', () => {
  const out = foldProvenance([
    part('maps', 'https://maps.example/b', { rating: note('single-source', 'agreed', 'rating 4.7') }),
  ]);
  assert.equal(out.rating!.status, 'agreed');
  assert.equal(out.rating!.confidence, 'single-source');
  assert.deepEqual(out.rating!.sources, ['https://maps.example/b']);
  assert.equal(out.rating!.note, 'rating 4.7');
});

test('foldProvenance: same value from two sources becomes multi-source/agreed', () => {
  const out = foldProvenance([
    part('maps', 'https://maps.example/b', { rating: note('single-source', 'agreed', 'rating 4.7') }),
    part('places', 'https://places.example/b', { rating: note('single-source', 'agreed', 'rating 4.7') }),
  ]);
  assert.equal(out.rating!.status, 'agreed');
  assert.equal(out.rating!.confidence, 'multi-source');
  assert.deepEqual([...out.rating!.sources].sort(), ['https://maps.example/b', 'https://places.example/b']);
});

test('foldProvenance: conflicting values -> status conflicting, keeps both sources', () => {
  const out = foldProvenance([
    part('maps', 'https://maps.example/b', {
      address: note('single-source', 'agreed', 'Strada Regele Ferdinand 56'),
    }),
    part('serp', 'https://serp.example/b', {
      address: note('single-source', 'agreed', 'Strada Ferdinand 87'),
    }),
  ]);
  assert.equal(out.address!.status, 'conflicting');
  // most-authoritative source (maps, per FIELD_AUTHORITY.address) wins the note
  assert.equal(out.address!.note, 'Strada Regele Ferdinand 56');
  assert.equal(out.address!.sources.length, 2);
});

test('foldProvenance: checked-and-absent -> absent-checked', () => {
  const out = foldProvenance([
    part('maps', 'https://maps.example/b', {
      website: note('confirmed', 'absent-checked', 'No official website found'),
    }),
  ]);
  assert.equal(out.website!.status, 'absent-checked');
  assert.equal(out.website!.confidence, 'confirmed');
});

test('foldProvenance: blocked-only -> blocked status', () => {
  const out = foldProvenance([
    part('instagram', 'https://instagram.com/x', {
      description: note('unconfirmed', 'blocked', 'Signed-out bot wall'),
    }),
  ]);
  assert.equal(out.description!.status, 'blocked');
});

test('foldProvenance: a value plus a silent source -> agreed', () => {
  const out = foldProvenance([
    part('maps', 'https://maps.example/b', { rating: note('single-source', 'agreed', 'rating 4.7') }),
    part('website', 'https://site.example/', {}), // silent on rating: contributes no candidate
  ]);
  // rating is reported by exactly one candidate -> agreed, not partial.
  // `partial` means more than one source reported the field (some agreeing, some
  // silent overall) — a single reporting candidate stays `agreed`.
  assert.equal(out.rating!.status, 'agreed');
});

test('foldProvenance: empty input -> empty map', () => {
  assert.deepEqual(foldProvenance([]), {});
});

test('FIELD_AUTHORITY: places outranks maps for rating (interpretation only)', () => {
  assert.ok(authorityRank('rating', 'places') < authorityRank('rating', 'maps'));
});

test('FIELD_AUTHORITY: covers every declared FieldKind without holes', () => {
  const kinds: Array<keyof typeof FIELD_AUTHORITY> = [
    'identity', 'contact', 'address', 'hours', 'rating', 'reviewCount',
    'attributes', 'description', 'socials', 'photos', 'services',
  ];
  for (const k of kinds) {
    assert.ok(Array.isArray(FIELD_AUTHORITY[k]) && FIELD_AUTHORITY[k].length > 0, `missing authority for ${k}`);
  }
});

test('BlockedSource shape is preserved end-to-end via CollectedSources', () => {
  const blocked: BlockedSource[] = [
    { source: 'instagram', reason: 'Signed-out bot wall', checkedAt: '2026-08-11T00:00:00Z' },
  ];
  const out = foldProvenance([
    part('instagram', 'https://instagram.com/x', {
      description: note('unconfirmed', 'blocked', 'Signed-out bot wall'),
    }),
    part('maps', 'https://maps.example/b', {
      description: note('single-source', 'agreed', 'Google editorial description'),
    }),
  ]);
  // instagram was blocked (recorded in blockedSources, not here); maps reported
  // the value, so this field is `agreed`, not `partial` (blocked ≠ silent).
  assert.equal(out.description!.status, 'agreed');
  assert.ok(blocked.length === 1 && blocked[0]!.source === 'instagram');
});
