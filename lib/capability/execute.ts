/**
 * The executor: a plan in, an outcome and a record out.
 *
 * The planner decides; this walks the decision. It owns the four things that
 * have to happen around every capability call and that were, until now,
 * happening in five different places or not at all:
 *
 *   1. **rate governance** — wait for a token before touching a vendor;
 *   2. **quota accounting** — count the request against today's allowance
 *      *before* the call, so a crash mid-call cannot un-spend it;
 *   3. **telemetry** — record latency and success against the service;
 *   4. **cost** — emit a ledger line for what the step actually consumed.
 *
 * ## Why the caller supplies the work
 *
 * `execute` takes an `invoke` function rather than knowing how to call a model,
 * drive Playwright and reach an MCP server. Three reasons, in order of
 * importance: it keeps the layer testable without a network, it keeps `lib/`
 * free of a dependency on every implementation at once, and it means a stage
 * that already knows how to do its work — and most of them do — can adopt
 * routing, failover, quota and cost accounting without being rewritten.
 *
 * `invokers.ts` supplies the standard model invoker, so the common case is one
 * line at the call site.
 *
 * ## The failure contract
 *
 * A step that throws advances the chain. A step that throws something marked
 * non-retryable *still* advances the chain — failing over to a different
 * service is precisely the response to "this one cannot do it", and it is a
 * different question from whether to retry the same one (which
 * `lib/ai/factory.ts` already owns, with jitter). The chain is exhausted only
 * when every member has thrown, and then the last error is rethrown as the
 * outcome's error so the caller sees a real cause rather than "everything
 * failed".
 */

import { capabilityError, failed, ok } from '../platform/types.js';
import { modelKey } from './models.js';
import { serviceRef } from './types.js';

import type { Logger } from '../logger.js';
import type { Telemetry } from '../platform/telemetry.js';
import type { CapabilityError, CapabilityOutcome } from '../platform/types.js';
import type { CostLine } from '../cost/ledgerEntry.js';
import type { RateGovernor } from '../ai/governor.js';
import type { QuotaLedger } from './quota.js';
import type { CapabilityPlan, PlanStep } from './plan.js';

const SOURCE = 'capability.execute';

/** What the caller does with a selected step. Throws to fail over. */
export type CapabilityInvoker<T> = (step: PlanStep) => Promise<T>;

/** One step's attempt, kept whether it succeeded or not. */
export interface AttemptRecord {
  readonly service: string;
  readonly kind: PlanStep['binding']['kind'];
  readonly provider: string | null;
  readonly model: string | null;
  readonly order: number;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly estimatedCents: number;
  /** The failure message, truncated. `null` on success. */
  readonly error: string | null;
}

/**
 * What happened, in full.
 *
 * Persisted alongside a run's artifacts: it is the answer to "why did this
 * capability come from there, and what did it cost", which is the question an
 * operator asks first and which no previous version of this pipeline could
 * answer without reading a log.
 */
export interface ExecutionRecord {
  readonly capability: CapabilityPlan['capability'];
  /** Every step attempted, in order. */
  readonly attempts: readonly AttemptRecord[];
  /** The service that produced the result, or `null` when all failed. */
  readonly servedBy: string | null;
  /** Cost lines for the attempts that consumed anything. */
  readonly costLines: readonly CostLine[];
  readonly totalCents: number;
  /** Whether the answer came from the deterministic terminal. */
  readonly degraded: boolean;
}

export interface ExecuteOptions<T> {
  readonly plan: CapabilityPlan;
  readonly invoke: CapabilityInvoker<T>;
  readonly logger: Logger;
  /** For the cost lines. Defaults to `unattributed`. */
  readonly jobId?: string;
  readonly governor?: RateGovernor;
  readonly quota?: QuotaLedger;
  readonly telemetry?: Telemetry;
  readonly signal?: AbortSignal;
}

export interface ExecuteResult<T> {
  readonly outcome: CapabilityOutcome<T>;
  readonly record: ExecutionRecord;
}

/**
 * Runs a plan.
 *
 * Never throws for a capability failure — the outcome carries it, matching the
 * platform's `CapabilityOutcome` contract, so a caller asking for an optional
 * capability writes a branch rather than a `try`. An abort is the exception:
 * a cancelled run must stop, not fail over.
 */
export async function executeCapability<T>(options: ExecuteOptions<T>): Promise<ExecuteResult<T>> {
  const { plan, invoke, logger, quota, telemetry, governor, signal } = options;
  const jobId = options.jobId ?? 'unattributed';
  const scoped = logger.child(plan.capability);

  const attempts: AttemptRecord[] = [];
  const costLines: CostLine[] = [];
  const startedAt = Date.now();

  if (!plan.plannable) {
    const detail = plan.excluded[0]?.detail ?? 'no service is eligible';
    return {
      outcome: failed<T>(
        capabilityError(
          { kind: 'skill', id: `capability:${plan.capability}` },
          plan.excluded[0]?.reason === 'requires-human' ? 'disabled' : 'not_registered',
          `cannot be planned on this run: ${detail}`,
          { details: { excluded: plan.excluded } },
        ),
        Date.now() - startedAt,
      ),
      record: emptyRecord(plan),
    };
  }

  let lastError: CapabilityError | null = null;

  for (const step of plan.chain) {
    if (signal?.aborted === true) {
      return {
        outcome: failed<T>(
          capabilityError(serviceRef(step.binding), 'cancelled', 'the run was aborted'),
          Date.now() - startedAt,
        ),
        record: assemble(plan, attempts, costLines, null),
      };
    }

    const vendor = step.binding.provider;
    const attemptStartedAt = Date.now();

    try {
      // 1. Rate governance, before anything is sent.
      if (governor !== undefined && vendor !== null) {
        await governor.acquire(vendor, signal);
      }

      // 2. Quota, charged before the call. An uncounted request that succeeded
      //    is how an allowance gets overspent; a counted one that failed only
      //    costs one request of headroom, which is the cheap direction to be
      //    wrong in.
      if (quota !== undefined && step.model !== null) {
        await quota.record(modelKey(step.model));
      }

      const data = await invoke(step);
      const durationMs = Date.now() - attemptStartedAt;

      attempts.push(attemptOf(step, true, durationMs, null));
      telemetry?.record({
        capability: serviceRef(step.binding),
        operation: plan.capability,
        ok: true,
        durationMs,
        at: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
        fields: { service: step.binding.id, model: step.model?.id ?? null },
      });
      if (step.estimatedCents > 0) {
        costLines.push(costLineOf(jobId, plan, step));
      }

      if (step.binding.kind === 'deterministic' && step.order > 0) {
        scoped.warn('capability degraded to its deterministic terminal', {
          service: step.binding.id,
          afterFailures: step.order,
        });
      }

      return {
        outcome: ok(data, Date.now() - startedAt),
        record: assemble(plan, attempts, costLines, step.binding.id),
      };
    } catch (error) {
      const durationMs = Date.now() - attemptStartedAt;
      const message = error instanceof Error ? error.message : String(error);

      if (isAbort(error)) {
        return {
          outcome: failed<T>(
            capabilityError(serviceRef(step.binding), 'cancelled', 'the run was aborted'),
            Date.now() - startedAt,
          ),
          record: assemble(plan, attempts, costLines, null),
        };
      }

      attempts.push(attemptOf(step, false, durationMs, message));
      telemetry?.record({
        capability: serviceRef(step.binding),
        operation: plan.capability,
        ok: false,
        durationMs,
        at: new Date().toISOString(),
        errorCode: 'upstream',
        errorMessage: message.slice(0, 400),
        fields: { service: step.binding.id, model: step.model?.id ?? null },
      });

      // A failed model call still consumed the vendor's quota and, on some
      // vendors, its tokens. The cost line stays.
      if (step.estimatedCents > 0) {
        costLines.push(costLineOf(jobId, plan, step));
      }

      lastError = capabilityError(serviceRef(step.binding), 'upstream', message.slice(0, 400), {
        details: { service: step.binding.id, order: step.order },
      });

      const next = plan.chain[step.order + 1];
      scoped.warn('capability step failed, failing over', {
        service: step.binding.id,
        error: message.slice(0, 160),
        next: next?.binding.id ?? '(chain exhausted)',
      });
    }
  }

  return {
    outcome: failed<T>(
      lastError ??
        capabilityError(
          { kind: 'skill', id: `capability:${plan.capability}` },
          'internal',
          'the chain was exhausted without producing an error',
        ),
      Date.now() - startedAt,
    ),
    record: assemble(plan, attempts, costLines, null),
  };
}

/* ------------------------------------------------------------------ */
/* Record assembly                                                     */
/* ------------------------------------------------------------------ */

function attemptOf(
  step: PlanStep,
  succeeded: boolean,
  durationMs: number,
  error: string | null,
): AttemptRecord {
  return {
    service: step.binding.id,
    kind: step.binding.kind,
    provider: step.binding.provider,
    model: step.model?.id ?? null,
    order: step.order,
    ok: succeeded,
    durationMs,
    estimatedCents: step.estimatedCents,
    error: error === null ? null : error.slice(0, 400),
  };
}

function costLineOf(jobId: string, plan: CapabilityPlan, step: PlanStep): CostLine {
  return {
    jobId,
    provider: step.binding.provider ?? step.binding.kind,
    model: step.model?.id ?? step.binding.id,
    capability: plan.capability,
    cents: step.estimatedCents,
    at: new Date().toISOString(),
    requestId: null,
  };
}

function assemble(
  plan: CapabilityPlan,
  attempts: readonly AttemptRecord[],
  costLines: readonly CostLine[],
  servedBy: string | null,
): ExecutionRecord {
  const served = plan.chain.find((step) => step.binding.id === servedBy);
  return {
    capability: plan.capability,
    attempts,
    servedBy,
    costLines,
    totalCents: costLines.reduce((sum, line) => sum + line.cents, 0),
    degraded: served?.binding.kind === 'deterministic' && served.order > 0,
  };
}

function emptyRecord(plan: CapabilityPlan): ExecutionRecord {
  return {
    capability: plan.capability,
    attempts: [],
    servedBy: null,
    costLines: [],
    totalCents: 0,
    degraded: false,
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export const SOURCE_NAME = SOURCE;
