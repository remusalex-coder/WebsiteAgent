/**
 * P6 — Design Memory (N-18, F-11): scoped (industry ∧ ≤50 km ∧ ≤18 months,
 * never global), three-layer decaying, exhaustion rule, retention + erasure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDesignMemory,
  inScope,
  scopedNeighbours,
  occupancy,
  requiredLevel,
  advise,
  distanceKm,
  businessKey,
  SCOPE_RADIUS_KM,
  SCOPE_MONTHS,
  RETENTION_MONTHS,
  SCOPE_CAPACITY,
} from '../../lib/memory/designMemory.js';
import type { DesignMemoryRecord } from '../../lib/memory/designMemory.js';
import type { DesignDirective } from '../../lib/design/directive.js';
import { fingerprintDirective } from '../../lib/design/fingerprint.js';

const NOW = '2026-08-15T00:00:00.000Z';

function record(partial: Partial<DesignMemoryRecord> & { readonly industry: string }): DesignMemoryRecord {
  return {
    businessKey: businessKey(partial.businessKey ?? 'anonymous'),
    industry: partial.industry,
    geo: partial.geo ?? { lat: 45.79, lng: 24.15 },
    recordedAt: partial.recordedAt ?? NOW,
    l1: partial.l1 ?? 'a',
    l2: partial.l2 ?? 'A',
    l3: partial.l3 ?? 'x',
  };
}

const SIBIU: DesignMemoryRecord = record({ industry: 'bakery', geo: { lat: 45.79, lng: 24.15 } });
const MADRID: DesignMemoryRecord = record({ industry: 'bakery', geo: { lat: 40.42, lng: -3.70 } });
const LAW_FIRM: DesignMemoryRecord = record({ industry: 'law', geo: { lat: 45.79, lng: 24.15 } });
const OLD: DesignMemoryRecord = record({ industry: 'bakery', geo: { lat: 45.79, lng: 24.15 }, recordedAt: '2025-01-15T00:00:00.000Z' });
const EXPIRED: DesignMemoryRecord = record({ industry: 'bakery', geo: { lat: 45.79, lng: 24.15 }, recordedAt: '2020-01-15T00:00:00.000Z' });

function scope(industry: string, geo: { lat: number; lng: number } | null = null): { industry: string; geo: { lat: number; lng: number } | null; now: string } {
  return { industry, geo, now: NOW };
}

test('scope: industry mismatch is excluded', () => {
  assert.equal(inScope(SIBIU, scope('bakery', SIBIU.geo)), true);
  assert.equal(inScope(LAW_FIRM, scope('bakery', SIBIU.geo)), false);
});

test('scope: >50 km is excluded', () => {
  assert.equal(inScope(MADRID, scope('bakery', SIBIU.geo)), false);
});

test('scope: >18 months old is excluded', () => {
  assert.equal(inScope(OLD, scope('bakery', SIBIU.geo)), false);
  assert.equal(inScope(SIBIU, scope('bakery', SIBIU.geo)), true);
});

test('scope: within 50 km is included', () => {
  // ~10 km from Sibiu centre stays in scope.
  const near: DesignMemoryRecord = record({ industry: 'bakery', geo: { lat: 45.85, lng: 24.22 } });
  assert.equal(inScope(near, scope('bakery', SIBIU.geo)), true);
});

test('a scope with no geo point relaxes the geo clause but keeps industry and time', () => {
  assert.equal(inScope(MADRID, scope('bakery')), true);
  assert.equal(inScope(EXPIRED, scope('bakery')), false);
  assert.equal(inScope(LAW_FIRM, scope('bakery')), false);
});

test('distanceKm is 0 for the same point and ~haver-sane for far cities', () => {
  assert.equal(distanceKm({ lat: 45.79, lng: 24.15 }, { lat: 45.79, lng: 24.15 }), 0);
  const madrid = distanceKm({ lat: 45.79, lng: 24.15 }, { lat: 40.42, lng: -3.70 });
  assert.ok(madrid !== null && madrid > 1000, 'Sibiu–Madrid is more than 1000 km');
});

test('scopedNeighbours returns only in-scope records, decayed', () => {
  const neighbours = scopedNeighbours([SIBIU, MADRID, LAW_FIRM, OLD], scope('bakery', SIBIU.geo));
  assert.equal(neighbours.length, 1, 'only the fresh in-scope Sibiu bakery survives');
  assert.equal(neighbours[0]!.record.businessKey, SIBIU.businessKey);
  assert.equal(neighbours[0]!.weight, 1, 'a fresh record weighs 1.0');
});

test('a scope at capacity is exhausted', () => {
  const records: DesignMemoryRecord[] = [];
  for (let i = 0; i < SCOPE_CAPACITY; i += 1) {
    records.push(record({ industry: 'bakery', l2: `family-${i}` }));
  }
  const neighbours = scopedNeighbours(records, scope('bakery', SIBIU.geo));
  assert.equal(occupancy(neighbours), 1);
  assert.equal(requiredLevel(1), 'l3');
});

test('requiredLevel escalates with occupancy', () => {
  assert.equal(requiredLevel(0.1), 'l1');
  assert.equal(requiredLevel(0.4), 'l2');
  assert.equal(requiredLevel(0.8), 'l3');
});

test('an exhausted scope stops requiring structural distinctness and logs it', () => {
  const records: DesignMemoryRecord[] = [];
  for (let i = 0; i < SCOPE_CAPACITY; i += 1) {
    records.push(record({ industry: 'bakery', l2: `family-${i}` }));
  }
  const neighbours = scopedNeighbours(records, scope('bakery', SIBIU.geo));
  const candidate: DesignDirective = { direction: 'minimal' };
  const verdict = advise(candidate, 'new-L2', 'new-L3', neighbours, scope('bakery', SIBIU.geo));
  assert.equal(verdict.exhausted, true);
  assert.equal(verdict.distinct, true, 'exhaustion relaxes structural distinctness');
  assert.match(verdict.rationale, /exhausted/, 'the exhaustion rule logs itself');
  assert.equal(verdict.requiredLevel, 'l1', 'an exhausted scope drops back to the L1 bar');
});

test('an L1 clash blocks even before occupancy escalates', () => {
  const existing: DesignMemoryRecord = record({
    industry: 'bakery',
    l1: fingerprintDirective({ direction: 'minimal' }),
  });
  const neighbours = scopedNeighbours([existing], scope('bakery', SIBIU.geo));
  const verdict = advise({ direction: 'minimal' }, 'L2', 'L3', neighbours, scope('bakery', SIBIU.geo));
  assert.equal(verdict.distinct, false);
  assert.match(verdict.rationale, /L1 decision surface/);
});

test('a different L1 passes at low occupancy', () => {
  const existing: DesignMemoryRecord = record({
    industry: 'bakery',
    l1: fingerprintDirective({ direction: 'minimal' }),
  });
  const neighbours = scopedNeighbours([existing], scope('bakery', SIBIU.geo));
  const verdict = advise({ direction: 'luxury' }, 'L2', 'L3', neighbours, scope('bakery', SIBIU.geo));
  assert.equal(verdict.distinct, true);
  assert.equal(verdict.requiredLevel, 'l1');
});

test('an L2 clash blocks at higher occupancy', () => {
  const existing: DesignMemoryRecord = record({ industry: 'bakery', l2: 'family-A' });
  const neighbours = scopedNeighbours([existing], scope('bakery', SIBIU.geo));
  // occupancy 1/8 = 0.125 → L1 level, so an L2 clash is not yet blocking.
  const lowOccupancy = advise({ direction: 'minimal' }, 'family-A', 'L3', neighbours, scope('bakery', SIBIU.geo));
  assert.equal(lowOccupancy.distinct, true);

  // Fill the scope to push occupancy past 0.33.
  const many: DesignMemoryRecord[] = [existing];
  for (let i = 0; i < 3; i += 1) many.push(record({ industry: 'bakery', l2: `other-${i}` }));
  const fuller = scopedNeighbours(many, scope('bakery', SIBIU.geo));
  const highOccupancy = advise({ direction: 'minimal' }, 'family-A', 'L3', fuller, scope('bakery', SIBIU.geo));
  assert.equal(highOccupancy.distinct, false, 'structural family already delivered at L2 level');
  assert.match(highOccupancy.rationale, /structural family/);
});

test('pruneExpired keeps only records inside the 36-month retention floor', () => {
  const memory = createDesignMemory([SIBIU, EXPIRED]);
  const pruned = memory.pruneExpired(NOW);
  assert.equal(pruned.records.length, 1);
  assert.equal(pruned.records[0]!.businessKey, SIBIU.businessKey);
});

test('eraseByBusiness removes a pseudonymous business without touching others', () => {
  const memory = createDesignMemory([SIBIU, record({ industry: 'bakery', businessKey: 'another' })]);
  const erased = memory.eraseByBusiness('anonymous');
  assert.equal(erased.records.length, 1);
  assert.equal(erased.records[0]!.businessKey, businessKey('another'));
});

test('businessKey is stable and never the raw id', () => {
  const key = businessKey('business-123');
  assert.equal(key, businessKey('business-123'));
  assert.notEqual(key, 'business-123');
  assert.equal(key.length, 64);
});

test('memory.add is immutable', () => {
  const memory = createDesignMemory([SIBIU]);
  const grown = memory.add(record({ industry: 'bakery', businessKey: 'new' }));
  assert.equal(memory.records.length, 1);
  assert.equal(grown.records.length, 2);
});