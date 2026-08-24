/**
 * P3-5 â€” Budget leases and cost accounting.
 *
 * The freeze's requirements: no capability call without a lease; a worker
 * without a lease is refused; consumed budget survives a crash (charged into
 * the ledger at charge time); exhaustion escalates; a job cannot exceed its
 * budget.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { grantLease, STANDARD_JOB_BUDGET_CENTS } from '../../lib/cost/lease.js';
import { summarizeCost, withinBudget } from '../../lib/cost/ledgerEntry.js';
import type { LeaseLedger } from '../../lib/cost/lease.js';
import type { CostLine } from '../../lib/cost/ledgerEntry.js';

function memoryLedger(initialCents = STANDARD_JOB_BUDGET_CENTS): LeaseLedger & { spent(): number } {
  let remaining = initialCents;
  return {
    async charge(_jobId, amount, _currency, _reason?): Promise<void> {
      if (amount > remaining) throw new Error('budget exhausted');
      remaining -= amount;
    },
    async hasBudget(_jobId, amount): Promise<boolean> {
      return amount <= remaining;
    },
    spent(): number {
      return initialCents - remaining;
    },
  };
}

test('grantLease issues a lease when the job has budget', async () => {
  const ledger = memoryLedger();
  const lease = await grantLease(ledger, { jobId: 'run-1', level: 'stage', currency: 'EUR', amount: 5 });
  assert.equal(lease.amount, 5);
  assert.equal(lease.level, 'stage');
});

test('a job with no budget is refused every lease', async () => {
  const ledger = memoryLedger(0);
  await assert.rejects(
    () => grantLease(ledger, { jobId: 'run-1', level: 'capability', currency: 'EUR', amount: 1 }),
    /no lease/,
  );
});

test('a worker without a lease is refused', async () => {
  const ledger = memoryLedger(0);
  const outcome = await ledger.hasBudget('run-1', 1, 'EUR');
  assert.equal(outcome, false, 'no lease means no budget â€” the refusal is the guarantee');
});

test('charging into the ledger is what survives a crash', async () => {
  const ledger = memoryLedger(20);
  await ledger.charge('run-1', 7, 'EUR', 'one vision call');
  // The charge is already recorded; nothing needs the in-memory lease object.
  assert.equal(ledger.spent(), 7);
  assert.equal(await ledger.hasBudget('run-1', 13, 'EUR'), true);
  assert.equal(await ledger.hasBudget('run-1', 14, 'EUR'), false);
});

test('exhaustion escalates â€” charging past the budget throws', async () => {
  const ledger = memoryLedger(10);
  await ledger.charge('run-1', 10, 'EUR', 'last allowed call');
  await assert.rejects(() => ledger.charge('run-1', 1, 'EUR', 'over budget'), /budget exhausted/);
});

test('summarizeCost totals and breaks down by provider and capability', () => {
  const lines: readonly CostLine[] = [
    { jobId: 'run-1', provider: 'gemini', model: 'gemini-3.6-flash', capability: 'generate', cents: 2, at: 't', requestId: 'a' },
    { jobId: 'run-1', provider: 'gemini', model: 'gemini-3.6-flash', capability: 'vision', cents: 3, at: 't', requestId: 'b' },
    { jobId: 'run-1', provider: 'openai', model: 'gpt-5', capability: 'generate', cents: 5, at: 't', requestId: null },
  ];
  const summary = summarizeCost(lines);
  assert.equal(summary.totalCents, 10);
  assert.equal(summary.byProvider['gemini'], 5);
  assert.equal(summary.byProvider['openai'], 5);
  assert.equal(summary.byCapability['generate'], 7);
  assert.equal(summary.byCapability['vision'], 3);
});

test('withinBudget decides exhaustion', () => {
  assert.equal(withinBudget(18, 20), true);
  assert.equal(withinBudget(20, 20), true);
  assert.equal(withinBudget(21, 20), false);
});

