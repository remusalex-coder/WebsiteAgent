/**
 * `writeCostReport` persists the orchestrator's existing `CostBreakdown` so
 * "what did this site cost and why" is answerable from one file after a
 * build. It adds no accounting of its own — these assert the write is
 * faithful and that nothing sensitive ever lands in the file (test #13).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { writeCostReport, COST_REPORT_FILE } from '../../lib/cost/report.js';
import { summarizeCost } from '../../lib/cost/ledgerEntry.js';

import type { CostLine } from '../../lib/cost/ledgerEntry.js';

async function tmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'bf-cost-report-'));
}

const LINES: readonly CostLine[] = [
  { jobId: 'run-1', provider: 'anthropic', model: 'claude-sonnet-5', capability: 'prose_writing', cents: 12.42, at: '2026-08-19T00:00:00.000Z', requestId: 'req-a' },
  { jobId: 'run-1', provider: 'deepseek', model: 'deepseek-v4-flash', capability: 'reasoning', cents: 0.73, at: '2026-08-19T00:01:00.000Z', requestId: null },
];

test('writeCostReport writes valid JSON matching the given breakdown', async () => {
  const dir = await tmpDir();
  const breakdown = summarizeCost(LINES);

  await writeCostReport(dir, breakdown, () => Date.parse('2026-08-19T12:00:00.000Z'));

  const raw = await fs.readFile(path.join(dir, COST_REPORT_FILE), 'utf8');
  const parsed = JSON.parse(raw) as {
    generatedAt: string;
    totalCents: number;
    byProvider: Record<string, number>;
    byCapability: Record<string, number>;
    lines: CostLine[];
  };

  assert.equal(parsed.generatedAt, '2026-08-19T12:00:00.000Z');
  assert.equal(parsed.totalCents, breakdown.totalCents);
  assert.deepEqual(parsed.byProvider, breakdown.byProvider);
  assert.deepEqual(parsed.byCapability, breakdown.byCapability);
  assert.deepEqual(parsed.lines, breakdown.lines);
});

test('a run that spent nothing still writes a report, with zero cost and no lines', async () => {
  const dir = await tmpDir();
  await writeCostReport(dir, summarizeCost([]));

  const raw = await fs.readFile(path.join(dir, COST_REPORT_FILE), 'utf8');
  const parsed = JSON.parse(raw) as { totalCents: number; lines: unknown[] };
  assert.equal(parsed.totalCents, 0);
  assert.deepEqual(parsed.lines, []);
});

test('creates the output directory if it does not exist yet', async () => {
  const dir = path.join(await tmpDir(), 'nested', 'run-dir');
  await writeCostReport(dir, summarizeCost(LINES));
  const raw = await fs.readFile(path.join(dir, COST_REPORT_FILE), 'utf8');
  assert.ok(raw.length > 0);
});

test('no secret material appears in the written file (test #13)', async () => {
  const dir = await tmpDir();
  await writeCostReport(dir, summarizeCost(LINES));
  const raw = await fs.readFile(path.join(dir, COST_REPORT_FILE), 'utf8');

  // CostLine's own fields are provider/model/capability names, cents, a
  // timestamp and a provider request id — never a credential. Assert the
  // shape holds: nothing resembling an API key pattern is present.
  assert.doesNotMatch(raw, /sk-[A-Za-z0-9]{10,}/);
  assert.doesNotMatch(raw, /Bearer\s+\S+/);
  assert.doesNotMatch(raw, /_API_KEY/);
});
