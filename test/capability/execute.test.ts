/**
 * The executor's contract: never throws for a capability failure, always
 * fails over on a thrown step, records cost only for what actually consumed
 * something, and stops on abort rather than failing over.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { planCapability } from '../../lib/capability/plan.js';
import { executeCapability } from '../../lib/capability/execute.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

import type { PlanStep } from '../../lib/capability/plan.js';

const logger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink(false) });

const ALL_CREDENTIALS = new Set([
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
]);

test('a chain that is not plannable produces a failed outcome without calling invoke', async () => {
  const plan = planCapability({ capability: 'audio_speech', credentials: ALL_CREDENTIALS });
  let invoked = false;
  const result = await executeCapability({
    plan,
    logger,
    invoke: async () => {
      invoked = true;
      return 'never';
    },
  });
  assert.equal(invoked, false);
  assert.equal(result.outcome.ok, false);
});

test('a step that throws fails over to the next step in the chain', async () => {
  const plan = planCapability({ capability: 'reasoning', credentials: new Set() });
  assert.ok(plan.chain.length >= 1);

  const attempted: string[] = [];
  const result = await executeCapability<string>({
    plan,
    logger,
    invoke: async (step: PlanStep) => {
      attempted.push(step.binding.id);
      if (step.binding.kind !== 'deterministic') throw new Error('simulated failure');
      return 'floor result';
    },
  });

  assert.equal(result.outcome.ok, true);
  if (result.outcome.ok) assert.equal(result.outcome.data, 'floor result');
  assert.equal(result.record.servedBy, plan.chain[plan.chain.length - 1]?.binding.id);
  assert.equal(result.record.degraded, plan.chain.length > 1);
});

test('every step throwing produces a failed outcome carrying the last error', async () => {
  const plan = planCapability({ capability: 'reasoning', credentials: new Set() });
  const result = await executeCapability<string>({
    plan,
    logger,
    invoke: async () => {
      throw new Error('everything is down');
    },
  });
  assert.equal(result.outcome.ok, false);
  if (!result.outcome.ok) {
    assert.match(result.outcome.error.message, /everything is down/);
  }
  assert.equal(result.record.attempts.length, plan.chain.length);
  assert.ok(result.record.attempts.every((a) => a.ok === false));
});

test('an aborted signal stops the chain rather than failing over', async () => {
  const plan = planCapability({ capability: 'reasoning', credentials: new Set() });
  const controller = new AbortController();
  controller.abort();

  let calls = 0;
  const result = await executeCapability<string>({
    plan,
    logger,
    signal: controller.signal,
    invoke: async () => {
      calls += 1;
      return 'should not run';
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.outcome.ok, false);
  if (!result.outcome.ok) assert.equal(result.outcome.error.code, 'cancelled');
});

test('cost lines are only recorded for steps that estimated a non-zero cost', async () => {
  const plan = planCapability({
    capability: 'prose_writing',
    credentials: ALL_CREDENTIALS,
    policy: { allowPaid: true, budgetCentsRemaining: 1_000, preferFree: false },
  });
  const anthropicStep = plan.chain.find((s) => s.binding.provider === 'anthropic');
  assert.ok(anthropicStep, 'expected a paid step to exist for this test to mean anything');

  const result = await executeCapability<string>({
    plan,
    logger,
    invoke: async (step) => {
      if (step.binding.id === anthropicStep.binding.id) return 'wrote it';
      throw new Error('not this one');
    },
  });

  assert.equal(result.outcome.ok, true);
  assert.ok(result.record.costLines.length > 0);
  assert.ok(result.record.totalCents > 0);
});

test('a failed paid step still produces a cost line — it consumed the vendor call before it threw (test #12)', async () => {
  const plan = planCapability({
    capability: 'prose_writing',
    credentials: ALL_CREDENTIALS,
    policy: { allowPaid: true, budgetCentsRemaining: 1_000, preferFree: false },
  });
  const anthropicStep = plan.chain.find((s) => s.binding.provider === 'anthropic');
  assert.ok(anthropicStep, 'expected a paid step to exist for this test to mean anything');

  const result = await executeCapability<string>({
    plan,
    logger,
    invoke: async (step) => {
      if (step.binding.id === anthropicStep.binding.id) throw new Error('upstream 500');
      throw new Error('not this one either');
    },
  });

  const anthropicAttempt = result.record.attempts.find((a) => a.service === anthropicStep.binding.id);
  assert.equal(anthropicAttempt?.ok, false);
  const anthropicLine = result.record.costLines.find((l) => l.provider === 'anthropic');
  assert.ok(anthropicLine, 'a failed call that estimated a real cost must still be charged');
  assert.ok(anthropicLine.cents > 0);
});

test('a successful deterministic-only capability records zero cost', async () => {
  const plan = planCapability({ capability: 'accessibility', credentials: new Set() });
  const result = await executeCapability<string>({
    plan,
    logger,
    invoke: async () => 'checked',
  });
  assert.equal(result.outcome.ok, true);
  assert.equal(result.record.totalCents, 0);
});
