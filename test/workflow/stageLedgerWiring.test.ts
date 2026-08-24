/**
 * T01 — the stage ledger (`lib/workflow/hashes.js`'s `recordStage`) wired into
 * real execution via `scripts/n8n/stage.ts`'s `runStage`.
 *
 * These are integration tests on purpose: `hashes.test.ts` already proves
 * `recordStage`/`loadStageLedger` correct in isolation. What that cannot
 * prove is that `runStage` actually calls them — on both the success path and
 * the failure path — for a real stage execution. That is what these assert.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { runStage } from '../../scripts/n8n/stage.js';
import { loadStageLedger } from '../../lib/workflow/hashes.js';

async function withTempOutputDir<T>(fn: (tmpRoot: string) => Promise<T>): Promise<T> {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-stageledger-'));
  const original = process.env.OUTPUT_DIR;
  process.env.OUTPUT_DIR = path.join(tmpRoot, 'output');
  try {
    return await fn(tmpRoot);
  } finally {
    if (original === undefined) delete process.env.OUTPUT_DIR;
    else process.env.OUTPUT_DIR = original;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

test('a real "create" stage execution produces a ledger entry associated with the right job', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-create';
    const result = await runStage({ stage: 'create', runId, maxIter: 3 });
    assert.equal(result.stage, 'create');

    const runDir = path.join(tmpRoot, 'output', runId);
    const ledger = await loadStageLedger(runDir);
    const entry = ledger.stages.create;
    assert.ok(entry !== undefined, 'the create stage has a ledger entry');
    assert.equal(typeof entry?.inputHash, 'string', 'a real input hash is recorded');
    assert.equal(typeof entry?.outputHash, 'string', 'a real output hash is recorded');
    assert.ok(entry?.completedAt !== null, 'a successful stage records a completion time');

    // Not a second source of truth for job stage identity: job.json still owns it.
    const job = JSON.parse(fs.readFileSync(path.join(runDir, 'job.json'), 'utf8'));
    assert.equal(job.stage, 'created');
  });
});

test('re-running the same stage produces a fresh ledger entry for it', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-rerun';
    await runStage({ stage: 'create', runId, maxIter: 3 });
    const runDir = path.join(tmpRoot, 'output', runId);
    const firstLedger = await loadStageLedger(runDir);
    const firstCompletedAt = firstLedger.stages.create?.completedAt;

    await runStage({ stage: 'create', runId, maxIter: 3 });
    const secondLedger = await loadStageLedger(runDir);

    assert.ok(secondLedger.stages.create !== undefined, 'the entry still exists after a second run');
    assert.notEqual(secondLedger.stages.create?.completedAt, firstCompletedAt, 'a fresh run records a fresh completion time');
  });
});

// The merge property itself — that recording one stage never erases another
// stage's entry — is proven directly against `recordStage`/`loadStageLedger`
// in `hashes.test.ts`; a `runStage` integration test would only be composing
// two independently-proven pieces (this file already proves `runStage` reaches
// `recordStage` on both the success and failure path), and reaching it through
// a second real production stage here would mean a network-dependent stage
// (`intake` calls a model to parse the order) — the wrong trade for what this
// file needs to additionally prove.

test('a stage that throws for real records a failed attempt, not a fabricated success, and still rejects', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-fail';
    const runDir = path.join(tmpRoot, 'output', runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, 'job.json'),
      `${JSON.stringify(
        {
          jobId: runId,
          business: 'Test Bakery',
          stage: 'creative',
          iteration: 0,
          maxIter: 3,
          creativeDirection: null, // diverge requires this — its absence is what throws
          research: null,
          evidence: null,
          character: null,
          experienceIntent: null,
          experiencePlan: null,
          content: null,
          assetPlan: null,
          design: null,
          designDirections: null,
          implementationStatus: 'pending',
          browserStatus: 'pending',
          qaStatus: 'pending',
          visualCritique: null,
          distinctnessScore: null,
          layoutAudit: null,
          preflight: null,
          decision: 'running',
          artifacts: {},
          errors: [],
          finalOutput: null,
          providerLog: [],
          budgetCents: 20,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await assert.rejects(
      () => runStage({ stage: 'diverge', runId, maxIter: 3 }),
      /creative direction/,
    );

    const ledger = await loadStageLedger(runDir);
    const entry = ledger.stages.diverge;
    assert.ok(entry !== undefined, 'the failed attempt is still recorded');
    assert.equal(entry?.outputHash, null, 'a failed stage never claims an output');
    assert.equal(entry?.completedAt, null, 'a failed stage was never completed');
    assert.equal(typeof entry?.inputHash, 'string', 'the input hash is still recorded, so a later resume knows what was attempted');
  });
});
