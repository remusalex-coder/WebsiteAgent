/**
 * The daily ledger is the constraint that actually binds this deployment
 * (Gemini's free tier is metered per day, not per minute), so these assert the
 * three properties that make it trustworthy: it counts, it persists across a
 * reopen, and it prunes anything older than yesterday.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { openQuotaLedger, unmeteredQuotaLedger, utcDay } from '../../lib/capability/quota.js';

async function tmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'bf-quota-'));
}

test('utcDay is stable within a day and changes at the UTC boundary', () => {
  const noon = Date.parse('2026-08-18T12:00:00.000Z');
  const almostMidnight = Date.parse('2026-08-18T23:59:59.999Z');
  const justAfter = Date.parse('2026-08-19T00:00:00.001Z');
  assert.equal(utcDay(noon), '2026-08-18');
  assert.equal(utcDay(almostMidnight), '2026-08-18');
  assert.equal(utcDay(justAfter), '2026-08-19');
});

test('record increments used and hasRoom respects the allowance', async () => {
  const dir = await tmpDir();
  const ledger = await openQuotaLedger({ dir });

  assert.equal(ledger.used('gemini:x'), 0);
  assert.equal(ledger.hasRoom('gemini:x', 2), true);

  await ledger.record('gemini:x');
  assert.equal(ledger.used('gemini:x'), 1);
  assert.equal(ledger.hasRoom('gemini:x', 2), true);

  await ledger.record('gemini:x');
  assert.equal(ledger.used('gemini:x'), 2);
  assert.equal(ledger.hasRoom('gemini:x', 2), false);
});

test('a null allowance is treated as unmetered', async () => {
  const dir = await tmpDir();
  const ledger = await openQuotaLedger({ dir });
  await ledger.record('anthropic:claude', 1000);
  assert.equal(ledger.hasRoom('anthropic:claude', null), true);
  assert.equal(ledger.remaining('anthropic:claude', null), null);
});

test('counts persist across reopening the ledger', async () => {
  const dir = await tmpDir();
  const first = await openQuotaLedger({ dir });
  await first.record('gemini:x', 5);

  const second = await openQuotaLedger({ dir });
  assert.equal(second.used('gemini:x'), 5);
});

test('a missing or corrupt quota file is treated as zero usage, not an error', async () => {
  const dir = await tmpDir();
  await fs.mkdir(path.join(dir, '.bf'), { recursive: true });
  await fs.writeFile(path.join(dir, '.bf', 'quota.json'), '{not json', 'utf8');

  const ledger = await openQuotaLedger({ dir });
  assert.equal(ledger.used('gemini:x'), 0);
});

test('a day older than yesterday is pruned on write', async () => {
  const dir = await tmpDir();
  const oldDay = '2020-01-01';
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, '.bf'), { recursive: true });
  await fs.writeFile(
    path.join(dir, '.bf', 'quota.json'),
    JSON.stringify({ [oldDay]: { 'gemini:x': 99 } }),
    'utf8',
  );

  const ledger = await openQuotaLedger({ dir, now: () => Date.parse('2026-08-18T12:00:00.000Z') });
  await ledger.record('gemini:y');

  const raw = JSON.parse(await fs.readFile(path.join(dir, '.bf', 'quota.json'), 'utf8'));
  assert.equal(oldDay in raw, false, 'a stale day should have been pruned');
  assert.ok('2026-08-18' in raw);
});

test('the unmetered ledger never blocks and never persists', async () => {
  const ledger = unmeteredQuotaLedger();
  assert.equal(ledger.hasRoom('anything', 1), true);
  await ledger.record('anything', 1000);
  assert.equal(ledger.hasRoom('anything', 1), true);
});
