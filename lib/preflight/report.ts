/**
 * Turns a flat list of `CheckResult`s into the report a caller actually reads:
 * tallies per status and per category, and the one verdict that matters most
 * — whether this run is allowed to reach production.
 */

import { CHECK_CATEGORIES } from './types.js';

import type { CategoryTally, CheckResult, PreflightSummary, ProductionGate } from './types.js';

type MutableTally = { -readonly [K in keyof CategoryTally]: CategoryTally[K] };

function emptyTally(): MutableTally {
  return { pass: 0, fail: 0, warn: 0, notApplicable: 0, blocked: 0 };
}

function tallyKey(status: CheckResult['status']): keyof CategoryTally {
  switch (status) {
    case 'PASS':
      return 'pass';
    case 'FAIL':
      return 'fail';
    case 'WARN':
      return 'warn';
    case 'NOT_APPLICABLE':
      return 'notApplicable';
    case 'BLOCKED':
      return 'blocked';
  }
}

export function summarize(results: readonly CheckResult[]): PreflightSummary {
  const totals = emptyTally();
  const byCategory = new Map<string, MutableTally>();
  for (const category of CHECK_CATEGORIES) byCategory.set(category, emptyTally());

  for (const result of results) {
    const key = tallyKey(result.status);
    totals[key] += 1;
    const bucket = byCategory.get(result.category);
    if (bucket !== undefined) bucket[key] += 1;
  }

  return {
    ...totals,
    total: results.length,
    byCategory: Object.fromEntries(byCategory) as PreflightSummary['byCategory'],
  };
}

/**
 * The only rule that blocks production: a `FAIL` at `critical` severity.
 *
 * Every check that can reach `critical` is either a real, verifiable security
 * property of the rendered output (secrets, escaping, structured-data
 * integrity) or the one business-integrity rule this factory will not bend on
 * — a testimonials section with no real evidence behind it. `BLOCKED` never
 * blocks: it means "not yet knowable," not "known bad."
 */
export function computeProductionGate(results: readonly CheckResult[]): ProductionGate {
  const blockingChecks = results.filter((result) => result.status === 'FAIL' && result.severity === 'critical');
  return { blocksProduction: blockingChecks.length > 0, blockingChecks };
}
