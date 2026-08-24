/**
 * Design Memory (Freeze N-18, F-11, P6-1/2/3).
 *
 * The memory's job is to stop the battle from delivering the same design
 * twice to the same kind of business in the same place. It is deliberately
 * **never a global structural repulsor** — a design for a bakery in Sibiu must
 * not be shaped by what a gym in Madrid was delivered.
 *
 *   - **Scoped** (P6-1): a comparison only ever considers records inside the
 *     same scope — same industry ∧ within 50 km ∧ within the last 18 months.
 *     Anything outside the scope does not exist for the memory.
 *   - **Three layers, decaying** (P6-2, F-11): distinctness is measured at the
 *     three fingerprint levels. The required level escalates with occupancy:
 *     a lightly-occupied scope is satisfied by a different decision surface
 *     (L1); as the scope fills, the memory demands structural (L2) and then
 *     rendered (L3) distinctness. Older records decay, so an 18-month-old
 *     design weighs less than last week's.
 *   - **Exhaustion rule** (P6-2): when a scope's structural space is exhausted
 *     — every plausible structural family already delivered — the memory stops
 *     requiring structural distinctness and logs it, rather than rejecting
 *     candidates forever.
 *   - **Retention + erasure** (P6-3): records are pseudonymous (a hashed
 *     `businessId`, never the raw id), retained 36 months, and erasable by
 *     `businessId`.
 *
 * Pure: `now` is injected, no clock, no I/O, no model calls.
 */

import { createHash } from 'node:crypto';

import type { DesignDirective } from '../design/directive.js';
import type { GeoPoint } from '../types.js';
import { fingerprintDirective } from '../design/fingerprint.js';

const SOURCE = 'memory.design';

/** Scope constants frozen by the freeze (§1.2): 50 km, 18 months. */
export const SCOPE_RADIUS_KM = 50;
export const SCOPE_MONTHS = 18;
/** Retention floor: records older than this are pruned (P6-3). */
export const RETENTION_MONTHS = 36;

/** How many structurally-distinct designs a scope may hold before exhaustion. Tuning. */
export const SCOPE_CAPACITY = 8;

/** The three fingerprint levels a comparison can demand. */
export type DistinctnessLevel = 'l1' | 'l2' | 'l3';

/** One pseudonymous memory record. */
export interface DesignMemoryRecord {
  /** SHA-256 of the business id — never the raw id. */
  readonly businessKey: string;
  readonly industry: string;
  readonly geo: GeoPoint | null;
  /** ISO timestamp of when the design was delivered. */
  readonly recordedAt: string;
  readonly l1: string;
  readonly l2: string;
  readonly l3: string;
}

export interface DesignScope {
  readonly industry: string;
  readonly geo: GeoPoint | null;
  /** ISO timestamp of "now", injected so the module stays pure. */
  readonly now: string;
  /** Custom radius. Defaults to the frozen 50 km. */
  readonly radiusKm?: number;
  /** Custom lookback in months. Defaults to the frozen 18. */
  readonly lookbackMonths?: number;
}

/** A scoped neighbour: one record inside the same industry ∧ ≤50 km ∧ ≤18 months. */
export interface ScopedNeighbour {
  readonly record: DesignMemoryRecord;
  /** Weight 0..1, decaying with age over the lookback window. */
  readonly weight: number;
  /** Distance from the scope's geo point, in km. */
  readonly distanceKm: number;
}

export interface MemoryAdvice {
  readonly scoped: readonly ScopedNeighbour[];
  /** The distinctness level the current occupancy demands. */
  readonly requiredLevel: DistinctnessLevel;
  /** 0..1 — how structurally full the scope is. */
  readonly occupancy: number;
  /** Whether the scope is exhausted and no longer demands structural distinctness. */
  readonly exhausted: boolean;
  /** Whether the candidate is distinct enough at the required level. */
  readonly distinct: boolean;
  /** Why this verdict, for the log the exhaustion rule mandates. */
  readonly rationale: string;
}

/**
 * A DesignMemory is a store of records plus the scope logic over them.
 * Created with `createDesignMemory`, retained by the caller.
 */
export interface DesignMemory {
  readonly records: readonly DesignMemoryRecord[];
  readonly add: (record: DesignMemoryRecord) => DesignMemory;
  /** Removes every record for a business (P6-3 erasure). */
  readonly eraseByBusiness: (businessId: string) => DesignMemory;
  /** Prunes records older than the 36-month retention floor (P6-3). */
  readonly pruneExpired: (now: string) => DesignMemory;
  /** Advises whether a candidate directive is distinct within the scope. */
  readonly advise: (candidate: DesignDirective, l2: string, l3: string, scope: DesignScope) => MemoryAdvice;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Haversine distance between two points, in km. `null` when a point is absent. */
export function distanceKm(a: GeoPoint | null, b: GeoPoint | null): number | null {
  if (a === null || b === null) return null;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

function monthsBetween(nowIso: string, thenIso: string): number {
  const now = Date.parse(nowIso);
  const then = Date.parse(thenIso);
  if (Number.isNaN(now) || Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now - then) / (1000 * 60 * 60 * 24 * 30.44);
}

/**
 * Whether a record is inside the scope: same industry ∧ within radius ∧
 * within lookback. A scope with no geo point relaxes the geo clause (a
 * business with no coordinates cannot be distance-compared); the industry and
 * time clauses always hold.
 */
export function inScope(record: DesignMemoryRecord, scope: DesignScope): boolean {
  if (record.industry !== scope.industry) return false;
  const age = monthsBetween(scope.now, record.recordedAt);
  if (age < 0 || age > (scope.lookbackMonths ?? SCOPE_MONTHS)) return false;
  if (scope.geo === null || record.geo === null) return true;
  const distance = distanceKm(scope.geo, record.geo);
  if (distance === null) return true;
  return distance <= (scope.radiusKm ?? SCOPE_RADIUS_KM);
}

/** Distance to the scope point; `null` when either side has no geo. */
function neighbourDistance(record: DesignMemoryRecord, scope: DesignScope): number | null {
  if (scope.geo === null || record.geo === null) return null;
  return distanceKm(scope.geo, record.geo);
}

/** Age decay: 1.0 fresh, 0.0 at the lookback edge. */
function ageWeight(record: DesignMemoryRecord, scope: DesignScope): number {
  const age = monthsBetween(scope.now, record.recordedAt);
  const window = scope.lookbackMonths ?? SCOPE_MONTHS;
  if (window <= 0) return 1;
  return Math.max(0, 1 - age / window);
}

/* ------------------------------------------------------------------ */
/* The memory                                                          */
/* ------------------------------------------------------------------ */

export function createDesignMemory(records: readonly DesignMemoryRecord[] = []): DesignMemory {
  const store = [...records];

  return {
    records: store,

    add(record) {
      return createDesignMemory([...store, record]);
    },

    eraseByBusiness(businessId) {
      const key = businessKey(businessId);
      return createDesignMemory(store.filter((r) => r.businessKey !== key));
    },

    pruneExpired(now) {
      return createDesignMemory(store.filter((r) => monthsBetween(now, r.recordedAt) <= RETENTION_MONTHS));
    },

    advise(candidate, l2, l3, scope) {
      const neighbours = scopedNeighbours(store, scope);
      return advise(candidate, l2, l3, neighbours, scope);
    },
  };
}

/** The scoped, age-weighted neighbours of a scope. */
export function scopedNeighbours(
  records: readonly DesignMemoryRecord[],
  scope: DesignScope,
): readonly ScopedNeighbour[] {
  return records
    .filter((r) => inScope(r, scope))
    .map((r) => ({
      record: r,
      weight: ageWeight(r, scope),
      distanceKm: neighbourDistance(r, scope) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Occupancy: the decayed count of structurally-distinct designs in the scope,
 * over capacity. Structural identity is L2 (two L2-identical designs are one
 * structural family regardless of directive prose).
 */
export function occupancy(
  neighbours: readonly ScopedNeighbour[],
  capacity: number = SCOPE_CAPACITY,
): number {
  if (capacity <= 0) return 0;
  const families = new Map<string, number>();
  for (const n of neighbours) {
    families.set(n.record.l2, Math.max(families.get(n.record.l2) ?? 0, n.weight));
  }
  let total = 0;
  for (const weight of families.values()) total += weight;
  return Math.min(1, total / capacity);
}

/** The distinctness level a given occupancy demands. */
export function requiredLevel(occupancyValue: number): DistinctnessLevel {
  if (occupancyValue >= 0.66) return 'l3';
  if (occupancyValue >= 0.33) return 'l2';
  return 'l1';
}

/**
 * The core advice. Pure and exported so the tests can call it directly.
 *
 * `exhausted` means the scope is at capacity: every structural family is
 * already represented, so demanding structural distinctness would reject every
 * candidate forever. The exhaustion rule therefore *relaxes* to L1 — the
 * cheapest, most honest bar — and logs it in the rationale.
 */
export function advise(
  candidate: DesignDirective,
  l2: string,
  l3: string,
  neighbours: readonly ScopedNeighbour[],
  scope: DesignScope,
): MemoryAdvice {
  if (neighbours.length === 0) {
    return {
      scoped: neighbours,
      requiredLevel: 'l1',
      occupancy: 0,
      exhausted: false,
      distinct: true,
      rationale: 'scope is empty — no prior design constrains this candidate',
    };
  }

  const occupancyValue = occupancy(neighbours);
  const exhausted = occupancyValue >= 1;
  const level = exhausted ? 'l1' : requiredLevel(occupancyValue);

  const l1 = fingerprintDirective(candidate);

  const l1Clash = neighbours.some((n) => n.record.l1 === l1);
  if (l1Clash) {
    return {
      scoped: neighbours,
      requiredLevel: level,
      occupancy: occupancyValue,
      exhausted,
      distinct: false,
      rationale: exhausted
        ? `scope exhausted (occupancy ${occupancyValue.toFixed(2)}) — L1 surface already delivered`
        : `L1 decision surface already delivered in this scope — reconcept or accept repetition`,
    };
  }

  if (level === 'l2' || level === 'l3') {
    const l2Clash = neighbours.some((n) => n.record.l2 === l2);
    if (l2Clash) {
      return {
        scoped: neighbours,
        requiredLevel: level,
        occupancy: occupancyValue,
        exhausted,
        distinct: false,
        rationale: exhausted
          ? `scope exhausted — structural family already delivered`
          : `structural family (L2) already delivered at occupancy ${occupancyValue.toFixed(2)} — a deeper divergence is required`,
      };
    }
  }

  if (level === 'l3') {
    const l3Clash = neighbours.some((n) => n.record.l3 === l3);
    if (l3Clash) {
      return {
        scoped: neighbours,
        requiredLevel: level,
        occupancy: occupancyValue,
        exhausted,
        distinct: false,
        rationale: `rendered result (L3) already delivered at occupancy ${occupancyValue.toFixed(2)}`,
      };
    }
  }

  return {
    scoped: neighbours,
    requiredLevel: level,
    occupancy: occupancyValue,
    exhausted,
    distinct: true,
    rationale: exhausted
      ? `scope exhausted (occupancy ${occupancyValue.toFixed(2)}) — structural distinctness no longer required; distinct at L1`
      : `distinct at ${level.toUpperCase()} within this scope`,
  };
}

/** Pseudonymous key for a business id (P6-3). */
export function businessKey(businessId: string): string {
  return createHash('sha256').update(businessId).digest('hex');
}

export const SOURCE_NAME = SOURCE;