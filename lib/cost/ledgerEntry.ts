/**
 * Cost accounting from provenance (Freeze N-08, P3-5).
 *
 * Every generated artifact carries provenance — provider, model, token usage,
 * request id. This module turns that provenance into a ledger row, so "how much
 * did this run cost" is answered by arithmetic over the artifacts on disk, not
 * by a guess. It deliberately owns no I/O: the caller supplies the rows, this
 * module produces the totals and the per-provider breakdown.
 */

const SOURCE = 'cost.ledgerEntry';

/**
 * A costable unit of work. `cents` is the currency's smallest unit (e.g. euro
 * cents), so integer arithmetic never drifts.
 */
export interface CostLine {
  readonly jobId: string;
  readonly provider: string;
  readonly model: string;
  readonly capability: string;
  readonly cents: number;
  readonly at: string;
  /** The provider request this line accounts for, when one exists. */
  readonly requestId: string | null;
}

export interface CostBreakdown {
  readonly totalCents: number;
  readonly byProvider: Readonly<Record<string, number>>;
  readonly byCapability: Readonly<Record<string, number>>;
  readonly lines: readonly CostLine[];
}

/**
 * Sums cost lines into a breakdown. Pure — the caller persists what it wants.
 */
export function summarizeCost(lines: readonly CostLine[]): CostBreakdown {
  const byProvider: Record<string, number> = {};
  const byCapability: Record<string, number> = {};
  let totalCents = 0;

  for (const line of lines) {
    totalCents += line.cents;
    byProvider[line.provider] = (byProvider[line.provider] ?? 0) + line.cents;
    byCapability[line.capability] = (byCapability[line.capability] ?? 0) + line.cents;
  }

  return { totalCents, byProvider, byCapability, lines };
}

/**
 * Whether a set of cost lines stays inside a budget. Used by the runner and by
 * Hermes to decide, at a terminal state, whether the job exhausted its budget
 * (Freeze §U: ABORT budget-exhausted) or finished within it.
 */
export function withinBudget(totalCents: number, budgetCents: number): boolean {
  return totalCents <= budgetCents;
}

export const SOURCE_NAME = SOURCE;