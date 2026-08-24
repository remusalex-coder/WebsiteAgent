/**
 * The per-site cost report — the answer to "what did this site cost and why",
 * from a single artifact rather than a re-derivation over logs.
 *
 * `lib/capability/orchestrator.ts` already accumulates every `CostLine` a run
 * produces and exposes it as a `CostBreakdown` via `spend()`. This module adds
 * nothing to that accounting — it only persists the existing breakdown
 * alongside a run's other artifacts. `CostLine`/`CostBreakdown` never carry
 * credential values (provider name, model id, capability, cents, timestamp,
 * request id only — see `ledgerEntry.ts`), so this file is safe to write
 * next to a site's public output.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { CostBreakdown } from './ledgerEntry.js';

const SOURCE = 'cost.report';

export const COST_REPORT_FILE = 'cost-report.json';

export interface CostReport {
  readonly generatedAt: string;
  readonly totalCents: number;
  readonly byProvider: Readonly<Record<string, number>>;
  readonly byCapability: Readonly<Record<string, number>>;
  readonly lines: CostBreakdown['lines'];
}

function toReport(breakdown: CostBreakdown, now: () => number): CostReport {
  return {
    generatedAt: new Date(now()).toISOString(),
    totalCents: breakdown.totalCents,
    byProvider: breakdown.byProvider,
    byCapability: breakdown.byCapability,
    lines: breakdown.lines,
  };
}

/**
 * Writes `<outputDir>/cost-report.json`.
 *
 * Called once at run teardown, after every stage has had the chance to spend.
 * A run that never left its free tier still writes a report — one with
 * `totalCents: 0` and an empty `lines` array — so "did this cost anything" is
 * always answerable from the same place, paid or not.
 */
export async function writeCostReport(
  outputDir: string,
  breakdown: CostBreakdown,
  now: () => number = Date.now,
): Promise<void> {
  const file = path.join(outputDir, COST_REPORT_FILE);
  const report = toReport(breakdown, now);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export const SOURCE_NAME = SOURCE;
