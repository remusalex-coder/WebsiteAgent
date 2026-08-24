/**
 * Budget leases (Freeze N-07, P3-5, CP5).
 *
 * A lease is permission to spend: no capability call happens without one, and a
 * worker without a lease is refused. The four levels are admission, stage,
 * capability, and request — each is a narrower slice of the budget, so the
 * factory can enforce "a job cannot exceed its budget" at four granularities
 * instead of one.
 *
 * ## Crash survival
 *
 * A lease is spent (charged) or returned. Consumed spend survives a crash
 * because it is recorded into the ledger *at charge time*, before the work the
 * lease pays for runs — the byte on disk is the ledger row, not the in-memory
 * lease object. The in-memory lease is only the permission.
 */

const SOURCE = 'cost.lease';

/** The four lease levels. Narrower = closer to one request. */
export type LeaseLevel = 'job' | 'stage' | 'capability' | 'request';

export interface Lease {
  readonly id: string;
  readonly level: LeaseLevel;
  /** Currency unit this lease is denominated in (e.g. EUR cents). */
  readonly currency: string;
  /** Total budget held by this lease. */
  readonly amount: number;
  /** How much of `amount` has already been spent. */
  readonly spent: number;
  readonly grantedAt: string;
}

export interface LeaseRequest {
  readonly jobId: string;
  readonly level: LeaseLevel;
  readonly currency: string;
  readonly amount: number;
}

/** The ledger the lease charges against — the sole writer of spent budget. */
export interface LeaseLedger {
  /**
   * Atomically adds `amount` to the job's spent budget. Throws when the job
   * has no budget or when the charge would exceed it.
   */
  charge(jobId: string, amount: number, currency: string, reason?: string): Promise<void>;
  /** Whether a job still has budget for `amount`. */
  hasBudget(jobId: string, amount: number, currency: string): Promise<boolean>;
}

/**
 * Issues a lease after checking the job's remaining budget.
 *
 * Fails closed: a job with no budget row refuses every lease. The lease is
 * permission, not money — the actual spend is charged through the ledger when
 * the call happens, so a crash mid-lease leaves the ledger intact.
 */
export async function grantLease(
  ledger: LeaseLedger,
  request: LeaseRequest,
): Promise<Lease> {
  if (!(await ledger.hasBudget(request.jobId, request.amount, request.currency))) {
    throw new Error(
      `[${SOURCE}] no lease: job ${request.jobId} has no budget for ${request.amount} ${request.currency} at level ${request.level}`,
    );
  }
  return {
    id: `${request.jobId}:${request.level}:${Date.now()}`,
    level: request.level,
    currency: request.currency,
    amount: request.amount,
    spent: 0,
    grantedAt: new Date().toISOString(),
  };
}

/**
 * The default job budget — the freeze's €0.20 standard tier, in euro cents.
 */
export const STANDARD_JOB_BUDGET_CENTS = 20;

export const SOURCE_NAME = SOURCE;