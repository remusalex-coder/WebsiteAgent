/**
 * The orchestrator is the object Hermes holds. These assert the three things
 * that make it usable as a control plane: the board costs nothing to produce
 * even with zero credentials, spend accumulates across calls, and the budget
 * a later plan sees actually shrinks by what was already spent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../../lib/config.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { createCapabilityOrchestrator } from '../../lib/capability/orchestrator.js';
import { unmeteredQuotaLedger } from '../../lib/capability/quota.js';
import { createRateGovernor } from '../../lib/ai/governor.js';

import type { PlanStep } from '../../lib/capability/plan.js';

const logger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink(false) });

async function tmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'bf-orchestrator-'));
}

test('board() plans every capability without contacting anything or requiring a credential', async () => {
  const config = loadConfig({});
  const orchestrator = await createCapabilityOrchestrator({
    config,
    logger,
    quota: unmeteredQuotaLedger(),
    governor: createRateGovernor(),
  });

  const board = orchestrator.board();
  assert.ok(board.total > 30, `expected the full capability vocabulary, got ${board.total}`);
  assert.ok(board.available > 0, 'expected at least the deterministic terminals to be available');
  assert.equal(board.credentialsPresent.length, 0);
});

test('a capability with only a deterministic terminal is available with no credentials at all', async () => {
  const config = loadConfig({});
  const orchestrator = await createCapabilityOrchestrator({
    config,
    logger,
    quota: unmeteredQuotaLedger(),
    governor: createRateGovernor(),
  });

  const plan = orchestrator.plan('accessibility');
  assert.equal(plan.plannable, true);
});

test('run() accumulates cost across calls, and remainingCents reflects it', async () => {
  const config = loadConfig({ ANTHROPIC_API_KEY: 'test-key' });
  const orchestrator = await createCapabilityOrchestrator({
    config,
    logger,
    quota: unmeteredQuotaLedger(),
    governor: createRateGovernor(),
    policy: { allowPaid: true, budgetCentsRemaining: 1_000, preferFree: false },
  });

  const before = orchestrator.remainingCents();
  const result = await orchestrator.run('prose_writing', async (step) => {
    if (step.binding.provider !== 'anthropic') throw new Error('skip');
    return 'written';
  });

  assert.equal(result.outcome.ok, true);
  const after = orchestrator.remainingCents();
  assert.ok(after < before, 'spending on a call should shrink what remains');

  const spend = orchestrator.spend();
  assert.ok(spend.totalCents > 0);
});

test('a later plan sees the shrunken budget from an earlier run in the same session', async () => {
  const config = loadConfig({ ANTHROPIC_API_KEY: 'test-key' });
  const orchestrator = await createCapabilityOrchestrator({
    config,
    logger,
    quota: unmeteredQuotaLedger(),
    governor: createRateGovernor(),
    policy: { allowPaid: true, budgetCentsRemaining: 0.01, preferFree: false },
  });

  await orchestrator.run('creative_direction', async (step) => {
    if (step.binding.provider !== 'anthropic') throw new Error('skip');
    return 'directed';
  });

  const plan = orchestrator.plan('creative_direction', { policy: { preferFree: false } });
  const anthropicStep = plan.chain.find((s) => s.binding.provider === 'anthropic');
  assert.equal(anthropicStep, undefined, 'the budget should be exhausted after the first paid call');
});

test('sequential run() calls decrement the cumulative job budget correctly (test #15)', async () => {
  const config = loadConfig({ ANTHROPIC_API_KEY: 'test-key' });
  const orchestrator = await createCapabilityOrchestrator({
    config,
    logger,
    quota: unmeteredQuotaLedger(),
    governor: createRateGovernor(),
    policy: { allowPaid: true, budgetCentsRemaining: 1_000, preferFree: false },
  });

  const spendAfter = async (): Promise<number> => {
    const result = await orchestrator.run('prose_writing', async (step) => {
      if (step.binding.provider !== 'anthropic') throw new Error('skip');
      return 'written';
    });
    assert.equal(result.outcome.ok, true);
    return orchestrator.spend().totalCents;
  };

  const before = orchestrator.remainingCents();
  const first = await spendAfter();
  const afterFirst = orchestrator.remainingCents();
  const second = await spendAfter();
  const afterSecond = orchestrator.remainingCents();

  assert.ok(second > first, 'a second real call should add to the running total, not replace it');
  assert.equal(first * 2, second, 'two identical calls should cost exactly twice one');
  assert.ok(afterFirst < before, 'remaining budget shrinks after the first call');
  assert.ok(afterSecond < afterFirst, 'remaining budget shrinks again after the second');
  assert.equal(before - second, afterSecond, 'remainingCents is exactly the budget minus cumulative spend');
});

test(
  'retrying a capability call adds exactly one new charge per real attempt, never duplicates one (test #17)',
  async () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: 'test-key' });
    const orchestrator = await createCapabilityOrchestrator({
      config,
      logger,
      quota: unmeteredQuotaLedger(),
      governor: createRateGovernor(),
      policy: { allowPaid: true, budgetCentsRemaining: 1_000, preferFree: false },
    });

    await orchestrator.run('prose_writing', async (step) => {
      if (step.binding.provider !== 'anthropic') throw new Error('skip');
      return 'attempt one';
    });
    const linesAfterFirst = orchestrator.spend().lines.length;

    // A caller-level retry: the same capability, called again.
    await orchestrator.run('prose_writing', async (step) => {
      if (step.binding.provider !== 'anthropic') throw new Error('skip');
      return 'attempt two';
    });
    const linesAfterSecond = orchestrator.spend().lines.length;

    assert.equal(
      linesAfterSecond,
      linesAfterFirst + 1,
      'a retry is a new real charge, not a duplicate of the first one',
    );
  },
);

test(
  'KNOWN LIMITATION: two concurrent run() calls can both plan against the same ' +
    'pre-spend budget and jointly overshoot it (test #16)',
  async () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: 'test-key' });
    // prose_writing/anthropic costs exactly 12.42c at the default token estimate
    // (276/1380 cents-per-million, 15k in / 6k out). 15c fits one call, not two.
    const singleCallCents = 15;
    const orchestrator = await createCapabilityOrchestrator({
      config,
      logger,
      quota: unmeteredQuotaLedger(),
      governor: createRateGovernor(),
      policy: { allowPaid: true, budgetCentsRemaining: singleCallCents, preferFree: false },
    });

    const invoke = async (step: PlanStep): Promise<string> => {
      if (step.binding.provider !== 'anthropic') throw new Error('skip');
      return 'concurrent';
    };

    const [a, b] = await Promise.all([
      orchestrator.run('prose_writing', invoke),
      orchestrator.run('prose_writing', invoke),
    ]);

    const totalSpent = orchestrator.spend().totalCents;
    // Documenting the gap, not asserting it is fine: `plan()` reads
    // `remainingCents()` synchronously before either call's `await invoke()`
    // resolves, so both can see the same unspent budget and both can charge
    // against it. If this assertion ever starts failing because the
    // orchestrator began reserving spend at plan time, that is a real fix —
    // update this test to assert the safe bound instead of documenting the gap.
    if (a.outcome.ok && b.outcome.ok) {
      // Both succeeded: the known race allowed a joint overshoot.
      assert.ok(
        totalSpent > singleCallCents,
        'expected the documented race to allow a joint overshoot when both calls succeed',
      );
    } else {
      // At least one failed for an unrelated reason (e.g. a genuine
      // serialisation this run's environment happened to provide) — the
      // total must not exceed the budget in that case.
      assert.ok(totalSpent <= singleCallCents * 2);
    }
  },
);

test('the on-disk quota ledger survives across two orchestrators pointed at the same directory', async () => {
  const dir = await tmpDir();
  const config = loadConfig({ OUTPUT_DIR: dir, GEMINI_API_KEY: 'test-key' });

  const first = await createCapabilityOrchestrator({ config, logger, governor: createRateGovernor() });
  await first.run('reasoning', async (step) => {
    if (step.binding.provider !== 'gemini') throw new Error('skip');
    return 'reasoned';
  });

  const second = await createCapabilityOrchestrator({ config, logger, governor: createRateGovernor() });
  const snapshot = second.quota.snapshot();
  assert.ok(Object.keys(snapshot.used).length > 0, 'expected the first orchestrator\'s usage to persist');
});
