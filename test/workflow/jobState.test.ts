/**
 * Worker observability ledger (P7, Wave 3).
 *
 * The job's own record of every worker call: who was asked, whether they
 * answered, and the budget the job is held to. `saveJob` must preserve the
 * ledger across patches, and the default must be a clean ledger.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createJob, loadJob, saveJob } from '../../lib/workflow/jobState.js';
import { STANDARD_JOB_BUDGET_CENTS } from '../../lib/cost/lease.js';

test('createJob starts with an empty providerLog and the standard budget', () => {
  const job = createJob('r1', 'Mara', 3);
  assert.deepEqual(job.providerLog, []);
  assert.equal(job.budgetCents, STANDARD_JOB_BUDGET_CENTS);
});

test('saveJob preserves the providerLog across patches', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-jobstate-'));
  try {
    await saveJob(dir, { jobId: 'r1', business: 'Mara', maxIter: 3 });
    await saveJob(dir, {
      providerLog: [
        { stage: 'analyze', capability: 'research', provider: 'gemini', outcome: 'ok', at: new Date().toISOString() },
        { stage: 'write', capability: 'content', provider: null, outcome: 'ok', at: new Date().toISOString() },
      ],
    });
    const loaded = await loadJob(dir);
    assert.ok(loaded !== null);
    assert.equal(loaded.providerLog.length, 2);
    assert.equal(loaded.providerLog[0]?.provider, 'gemini');
    assert.equal(loaded.providerLog[1]?.provider, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});