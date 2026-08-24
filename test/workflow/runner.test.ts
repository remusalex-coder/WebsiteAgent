/**
 * P3-6 — Runner concurrency and candidate isolation.
 *
 * The freeze's acceptance: K candidates build in parallel; model work is
 * governed; a worker without a lease is refused; integration asserts no
 * interleaved ledger writes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { runPool, runCandidates, createSerializedWriter } from '../../lib/workflow/runner.js';
import { createRateGovernor } from '../../lib/ai/governor.js';
import type { RunnerTask } from '../../lib/workflow/runner.js';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('runPool keeps at most K tasks in flight', async () => {
  const gate = deferred<void>();
  let inFlight = 0;
  let maxInFlight = 0;
  const started: string[] = [];

  const tasks: RunnerTask<number>[] = Array.from({ length: 5 }, (_, i) => ({
    id: `t${i}`,
    async run(): Promise<number> {
      started.push(`t${i}`);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await gate.promise;
      inFlight -= 1;
      return i;
    },
  }));

  const outcomePromise = runPool(tasks, { concurrency: 3 });
  // Give the pool a tick to start its first three slots.
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(maxInFlight, 3, 'three slots fill before the gate opens');
  assert.equal(started.length, 3, 'only three tasks start before the gate opens');
  gate.resolve();
  const outcome = await outcomePromise;
  assert.equal(outcome.failures.length, 0);
  assert.deepEqual(outcome.results.map((r) => r.value), [0, 1, 2, 3, 4], 'results come back in task order');
});

test('a failing task is collected, not thrown, and does not stop the rest', async () => {
  const tasks: RunnerTask<string>[] = [
    { id: 'a', run: async () => 'ok-a' },
    { id: 'b', run: async () => { throw new Error('boom-b'); } },
    { id: 'c', run: async () => 'ok-c' },
  ];
  const outcome = await runPool(tasks, { concurrency: 3 });
  assert.deepEqual(outcome.results.map((r) => r.id), ['a', 'c']);
  assert.equal(outcome.failures.length, 1);
  assert.equal(outcome.failures[0]?.id, 'b');
});

test('governed tasks queue behind the governor rather than overwhelming it', async () => {
  const clock = { now: 1_000_000 };
  const governor = createRateGovernor(() => clock.now);
  governor.register('gemini', { capacity: 2, refillPerMs: 1 / 1000, minIntervalMs: 0 });
  // Two tokens are immediately available; the third must wait for a refill.
  let calls = 0;
  const tasks: RunnerTask<number>[] = Array.from({ length: 3 }, (_, i) => ({
    id: `g${i}`,
    governedVendor: 'gemini',
    async run(): Promise<number> {
      calls += 1;
      return i;
    },
  }));

  const outcomePromise = runPool(tasks, { concurrency: 3, governor });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls, 2, 'two calls slip through the initial tokens');
  clock.now += 1000; // refill one token
  await new Promise((r) => setTimeout(r, 60));
  const outcome = await outcomePromise;
  assert.equal(outcome.results.length, 3);
  assert.equal(calls, 3);
});

test('SerializedWriter never interleaves ledger writes', async () => {
  const writer = createSerializedWriter();
  const order: string[] = [];

  // Simulate K candidate builds each doing a read-modify-write on a shared
  // counter through the same writer. Interleaved writes would corrupt the
  // count; serialisation makes the final count exactly K.
  const K = 10;
  const writes = Array.from({ length: K }, (_, i) =>
    writer.withLock(async () => {
      order.push(`start-${i}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end-${i}`);
    }),
  );
  await Promise.all(writes);

  // Each start has its matching end immediately after — no interleaving.
  for (let i = 0; i < order.length; i += 2) {
    assert.match(order[i]!, /^start-/);
    assert.match(order[i + 1]!, /^end-/);
    assert.equal(order[i]!.slice(6), order[i + 1]!.slice(4), 'start/end pairs match');
  }
});

test('SerializedWriter failures propagate and do not wedge the lock', async () => {
  const writer = createSerializedWriter();
  await assert.rejects(() =>
    writer.withLock(async () => {
      throw new Error('write failed');
    }),
  );
  // The lock must still be usable afterwards.
  let ran = false;
  await writer.withLock(async () => {
    ran = true;
  });
  assert.equal(ran, true);
});

test('runCandidates is the K-wide thin wrapper over runPool', async () => {
  const tasks: RunnerTask<number>[] = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, run: async () => i }));
  const outcome = await runCandidates(tasks, 2);
  assert.deepEqual(outcome.results.map((r) => r.value), [0, 1, 2, 3]);
});