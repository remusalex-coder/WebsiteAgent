/**
 * P3-4 â€” Rate Governor: per-vendor token bucket, scoped to the org.
 *
 * The freeze's requirement is that K=3 concurrent requests against a 2-RPM
 * bucket *queue* rather than 429. These tests use an injectable clock so they
 * run in milliseconds, not minutes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateGovernor } from '../../lib/ai/governor.js';

function makeClock(): { now(): number; advance(ms: number): void } {
  let t = 1_000_000;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test('an unregistered vendor is refused, not granted an ungoverned pass', async () => {
  const clock = makeClock();
  const governor = createRateGovernor(clock.now);
  await assert.rejects(() => governor.acquire('nobody'), /no rate bucket/);
});

test('concurrent requests queue rather than 429 when the bucket is small', async () => {
  const clock = makeClock();
  const governor = createRateGovernor(clock.now);
  // 1 token, refilled 1 per 1000ms â€” capacity 2, refill 1/1000ms.
  governor.register('gemini', { capacity: 2, refillPerMs: 1 / 1000, minIntervalMs: 0 });

  const start = clock.now();
  const acquire = governor.acquire('gemini');
  await acquire; // token 1 (immediate)

  const second = governor.acquire('gemini'); // token 2 (immediate)
  await second;

  const third = governor.acquire('gemini'); // must wait for refill
  let thirdResolved = false;
  third.then(() => {
    thirdResolved = true;
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(thirdResolved, false, 'the third call must queue, not pass');

  clock.advance(1000); // one token refilled
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(thirdResolved, true, 'the queued call proceeds once a token refills');
  void start;
});

test('minIntervalMs spaces calls even when tokens are available', async () => {
  const clock = makeClock();
  const governor = createRateGovernor(clock.now);
  governor.register('openai', { capacity: 10, refillPerMs: 1, minIntervalMs: 100 });

  await governor.acquire('openai');
  const second = governor.acquire('openai');
  let resolved = false;
  second.then(() => {
    resolved = true;
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(resolved, false, 'a hard interval must hold even with tokens spare');

  clock.advance(100);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(resolved, true);
});

test('tokensFor reflects capacity and refill', () => {
  const clock = makeClock();
  const governor = createRateGovernor(clock.now);
  governor.register('gemini', { capacity: 3, refillPerMs: 1 / 1000 });
  assert.equal(governor.tokensFor('gemini'), 3);
  clock.advance(2000);
  assert.equal(governor.tokensFor('gemini'), 3, 'capacity caps the refill');
});

test('abort signal releases a waiting acquire', async () => {
  const clock = makeClock();
  const governor = createRateGovernor(clock.now);
  governor.register('gemini', { capacity: 1, refillPerMs: 1 / 1000 });
  await governor.acquire('gemini'); // exhaust the single token

  const controller = new AbortController();
  const waiting = governor.acquire('gemini', controller.signal);
  controller.abort();
  await assert.rejects(() => waiting, /aborted/i);
});
