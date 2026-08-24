/**
 * Runner concurrency (Freeze N-05, P3-6, F-12).
 *
 * The freeze divides labour between two modules: the router is *substitution*,
 * the pool is *concurrency* — and this is the pool. It runs K candidate builds
 * in parallel, bounds the parallelism, and keeps candidate writes from
 * interleaving.
 *
 * ## What "bounded" means
 *
 * Two different limits apply to two different resources:
 *
 * - **CPU / browser work** is bounded by `concurrency` — headless Chromium
 *   launches don't share nicely, so the pool never exceeds K simultaneous
 *   builds.
 * - **Model work** is bounded by the rate governor, per vendor, shared org-wide.
 *   The runner acquires a token from the governor before dispatching a task
 *   that will spend a model call.
 *
 * ## No interleaved ledger writes
 *
 * Candidate builds each write to their own directory, but the ledger rows they
 * produce share a single index. `SerializedWriter` is the guarantee that two
 * candidates never write the ledger index simultaneously — each mutation is
 * atomic, and the pool serialises them through one writer. This is the
 * acceptance criterion P3-6 names directly.
 */

import { createRateGovernor } from '../ai/governor.js';
import type { RateGovernor } from '../ai/governor.js';

const SOURCE = 'workflow.runner';

/** One unit of parallel work: a candidate build, a gate run, etc. */
export interface RunnerTask<T> {
  readonly id: string;
  /**
   * Vendor whose model call this task will make. When set, the pool acquires
   * a governor token before dispatch, so K parallel builds can't overwhelm an
   * org-metered vendor.
   */
  readonly governedVendor?: string;
  run(): Promise<T>;
}

export interface PoolOptions {
  /** Maximum simultaneous tasks. Browser-bound work should stay small (2–4). */
  readonly concurrency: number;
  /**
   * Vendors whose model calls must be governed. The runner acquires a token
   * before dispatching any task whose `governedVendor` is set. When omitted,
   * a fresh org-scoped governor is created.
   */
  readonly governor?: RateGovernor;
  readonly signal?: AbortSignal;
}

export interface RunnerResult<T> {
  readonly id: string;
  readonly value: T;
}

/** The result of a drained pool: successes and failures, never thrown away. */
export interface RunOutcome<T> {
  readonly results: readonly RunnerResult<T>[];
  readonly failures: readonly { readonly id: string; readonly error: Error }[];
  readonly aborted: boolean;
}

/**
 * Runs tasks with at most `concurrency` in flight.
 *
 * Resolves when every task settles. A task failure is collected, not thrown —
 * the caller decides whether a failed candidate kills the run or merely
 * escalates it. Order of `results` matches task order; `failures` never
 * contains an id twice.
 */
export async function runPool<T>(tasks: readonly RunnerTask<T>[], options: PoolOptions): Promise<RunOutcome<T>> {
  const { concurrency } = options;
  const k = Math.max(1, Math.floor(concurrency));
  const governor = options.governor ?? createRateGovernor();

  const results: RunnerResult<T>[] = [];
  const failures: { readonly id: string; readonly error: Error }[] = [];
  let aborted = false;

  let cursor = 0;
  const nextTask = (): RunnerTask<T> | undefined => {
    if (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      return task;
    }
    return undefined;
  };

  const slots = Array.from({ length: k }, async () => {
    while (!aborted) {
      const task = nextTask();
      if (task === undefined) return;
      try {
        await maybeGovern(task, governor, options.signal);
        if (options.signal?.aborted === true) {
          aborted = true;
          return;
        }
        const value = await task.run();
        results.push({ id: task.id, value });
      } catch (error) {
        if (options.signal?.aborted === true) {
          aborted = true;
          return;
        }
        failures.push({ id: task.id, error: error instanceof Error ? error : new Error(String(error)) });
      }
    }
  });

  await Promise.all(slots);
  return { results, failures, aborted };
}

/**
 * Acquires a governor token before dispatching a model-bound task, when the
 * task declares the vendor it will call.
 */
async function maybeGovern<T>(
  task: RunnerTask<T>,
  governor: RateGovernor,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (task.governedVendor === undefined) return;
  await governor.acquire(task.governedVendor, signal);
}

/**
 * A mutex around a single resource — the ledger index. Every candidate build
 * that appends a row must go through `SerializedWriter`, so no two writes can
 * interleave. This is the mechanism P3-6's "no interleaved ledger writes"
 * names; the ledger itself does the atomicity (temp file + rename), and this
 * guarantees the ordering.
 */
export interface SerializedWriter {
  /** Runs `write` while holding the lock. Failures propagate to the caller. */
  withLock<T>(write: () => Promise<T>): Promise<T>;
}

/**
 * Creates a serialised writer. `write` is serialised against every other
 * `withLock` on the same writer; it may be a read-modify-write over a file
 * whose final `rename` is atomic, which is what makes the guarantee real.
 */
export function createSerializedWriter(): SerializedWriter {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    withLock<T>(write: () => Promise<T>): Promise<T> {
      const result = tail.then(write, write);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

/** Runs `tasks` with K-wide parallelism, collecting results in order. */
export async function runCandidates<T>(
  tasks: readonly RunnerTask<T>[],
  concurrency: number,
  signal?: AbortSignal,
): Promise<RunOutcome<T>> {
  return runPool(tasks, { concurrency, ...(signal ? { signal } : {}) });
}

export const SOURCE_NAME = SOURCE;