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
