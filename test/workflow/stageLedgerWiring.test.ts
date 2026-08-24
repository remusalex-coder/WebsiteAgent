/**
 * T01/T02 — the stage ledger (`lib/workflow/hashes.js`'s `recordStage`,
 * `loadStageLedger`, `shouldSkip`) wired into real execution via
 * `scripts/n8n/stage.ts`'s `runStage`: every real stage gets a ledger entry
 * (T01), and a stage whose exact call is repeated against an unchanged job is
 * skipped rather than re-run for real (T02).
 *
 * These are integration tests on purpose: `hashes.test.ts` already proves
 * `recordStage`/`loadStageLedger`/`shouldSkip` correct in isolation. What
 * that cannot prove is that `runStage` actually calls them — on the success
 * path, the failure path, and the skip path — for a real stage execution.
 * That is what these assert.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { runStage, runJobFullWith } from '../../scripts/n8n/stage.js';
import type { StageResult } from '../../scripts/n8n/stage.js';
import { loadStageLedger, hashValue, recordStage } from '../../lib/workflow/hashes.js';

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
    assert.equal(entry?.outputPath, 'job.json', 'T02: the output path that makes this entry skippable next time');

    // Not a second source of truth for job stage identity: job.json still owns it.
    const job = JSON.parse(fs.readFileSync(path.join(runDir, 'job.json'), 'utf8'));
    assert.equal(job.stage, 'created');
  });
});

test('T02: a genuinely fresh job — no prior ledger entry — is never skipped', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-fresh';
    const result = await runStage({ stage: 'create', runId, maxIter: 3 });
    assert.equal(result.note, undefined, 'nothing to skip on a job\'s very first call');
    const runDir = path.join(tmpRoot, 'output', runId);
    assert.ok((await loadStageLedger(runDir)).stages.create !== undefined, 'the first real call still records an entry');
  });
});

test('T02: repeating an identical call against an unchanged job is skipped, not re-run', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-skip';
    await runStage({ stage: 'create', runId, maxIter: 3 });
    const runDir = path.join(tmpRoot, 'output', runId);
    const firstLedger = await loadStageLedger(runDir);
    const firstEntry = firstLedger.stages.create;
    assert.ok(firstEntry !== undefined);

    const second = await runStage({ stage: 'create', runId, maxIter: 3 });
    const secondLedger = await loadStageLedger(runDir);

    assert.match(second.note ?? '', /skipped/, 'the result says this call was skipped');
    assert.deepEqual(secondLedger.stages.create, firstEntry, 'the ledger entry is untouched — a skip never re-records');
  });
});

test('T02: a changed call against the same job is not skipped — it re-runs for real', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-changed';
    await runStage({ stage: 'create', runId, maxIter: 3 });
    const runDir = path.join(tmpRoot, 'output', runId);
    const firstEntry = (await loadStageLedger(runDir)).stages.create;

    // Same stage, same job — but a different maxIter changes `opts`, which is
    // part of what gets hashed, so this must not be recognised as the same call.
    const second = await runStage({ stage: 'create', runId, maxIter: 7 });
    const secondEntry = (await loadStageLedger(runDir)).stages.create;

    assert.equal(second.note, undefined, 'a real re-run has no skip note');
    assert.notEqual(secondEntry?.inputHash, firstEntry?.inputHash, 'the changed opts produced a different input hash');
    assert.notEqual(secondEntry?.completedAt, firstEntry?.completedAt, 'a real re-run records a fresh completion time');
  });
});

test('T02: a skipped "intake" still recomputes providers.pool, so a resumed research fan-out is not silently dropped', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-intake-resume';
    const runDir = path.join(tmpRoot, 'output', runId);
    fs.mkdirSync(runDir, { recursive: true });

    const jobOnDisk = {
      jobId: runId,
      business: 'Test Bakery',
      stage: 'research',
      iteration: 0,
      maxIter: 3,
      research: null,
      evidence: null,
      character: null,
      creativeDirection: null,
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(path.join(runDir, 'job.json'), `${JSON.stringify(jobOnDisk, null, 2)}\n`, 'utf8');

    // Reproduces runStage's own input-hash formula (opts + the job snapshot
    // minus updatedAt) to seed a ledger entry as if intake had already
    // completed for real — without any AI provider configured, which a real
    // intake call needs (draftBrief parses the order with a model). If the
    // skip below did not engage, this call would throw for a missing
    // provider; the call succeeding at all is part of what this proves.
    const opts = { stage: 'intake' as const, runId, maxIter: 3, order: 'a bakery in Sibiu' };
    const { updatedAt: _unused, ...hashableJob } = jobOnDisk;
    const inputHash = hashValue({ opts, job: hashableJob });
    await recordStage(runDir, { stage: 'intake', inputHash, outputHash: 'prior-output', outputPath: 'job.json' });

    const result = await runStage({ stage: 'intake', runId, maxIter: 3, order: 'a bakery in Sibiu' });

    assert.match(result.note ?? '', /skipped/, 'intake was recognised as already done');
    assert.ok(result.providers !== undefined, 'providers is populated even on a skip, for this one stage');
    assert.ok(Array.isArray(result.providers?.pool), 'pool — what the caller fans research out over — is recomputed, not dropped');
  });
});

test('T02: "hermes" is never skipped, even when a matching ledger entry exists', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-hermes-noskip';
    const runDir = path.join(tmpRoot, 'output', runId);
    fs.mkdirSync(runDir, { recursive: true });

    const jobOnDisk = {
      jobId: runId,
      business: 'Test Bakery',
      stage: 'distinctness-gate',
      iteration: 0,
      maxIter: 3,
      research: null,
      evidence: null,
      character: null,
      creativeDirection: null,
      experienceIntent: null,
      experiencePlan: null,
      content: null,
      assetPlan: null,
      design: null,
      designDirections: null,
      implementationStatus: 'built',
      browserStatus: 'shot',
      qaStatus: 'passed',
      visualCritique: null,
      // A PASS verdict: hermes.decide() reaches its cheap, model-free
      // "deliver" branch — this test only needs to prove hermes still runs
      // when a matching ledger entry exists, not exercise the repair path.
      distinctnessScore: { verdict: 'PASS', overallScore: 90, diagnosis: 'clean', route: 'deliver', reasons: [] },
      layoutAudit: null,
      preflight: null,
      decision: 'running',
      artifacts: {},
      errors: [],
      finalOutput: null,
      providerLog: [],
      budgetCents: 20,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(path.join(runDir, 'job.json'), `${JSON.stringify(jobOnDisk, null, 2)}\n`, 'utf8');

    // Seed a ledger entry for 'hermes' that WOULD match on a naive skip check
    // — if hermes were skip-eligible like every other stage, this call would
    // be recognised as already done and never touch `decision`/`stage` at all.
    const opts = { stage: 'hermes' as const, runId, maxIter: 3, decideOnly: true };
    const { updatedAt: _unused, ...hashableJob } = jobOnDisk;
    const inputHash = hashValue({ opts, job: hashableJob });
    await recordStage(runDir, { stage: 'hermes', inputHash, outputHash: 'prior-output', outputPath: 'job.json' });

    const result = await runStage({ stage: 'hermes', runId, maxIter: 3, decideOnly: true });

    // A real hermes run does set its own note ("delivering after N repair
    // iteration(s)") — the point is it's never the *skip* note, proving the
    // real case body ran rather than being bypassed by the matching entry.
    assert.doesNotMatch(result.note ?? '', /skipped/, 'hermes never reports a skip note — it always re-decides');
    assert.equal(result.decision, 'deliver', 'the real decide() ran and reached its PASS branch');
    const job = JSON.parse(fs.readFileSync(path.join(runDir, 'job.json'), 'utf8'));
    assert.equal(job.stage, 'delivery', 'job.json reflects a real hermes execution, not a reused snapshot');
  });
});

test('T02: a killed-and-restarted runJobFullWith resumes past an already-completed stage without re-running it', async () => {
  await withTempOutputDir(async (tmpRoot) => {
    const runId = 'ledgertest-killed-restart';
    const runDir = path.join(tmpRoot, 'output', runId);

    // Simulate "the process was killed right after `create` finished, and the
    // whole factory (runJobFullWith) is invoked again from scratch" by
    // running `create` once for real first, exactly as a fresh invocation's
    // first call would.
    await runStage({ stage: 'create', runId, maxIter: 3 });
    const createEntryBeforeRestart = (await loadStageLedger(runDir)).stages.create;
    assert.ok(createEntryBeforeRestart !== undefined);

    // A fresh `runJobFullWith` call always starts at `create` (see the
    // function itself) — there is no separate "which stage do I resume at"
    // planner to get right, because every stage decides for itself via the
    // ledger. This hybrid runner delegates `create` to the real `runStage`
    // (proving it is genuinely recognised as already done) and stubs every
    // later stage (which need real AI/browser capabilities this test
    // environment does not have) so the rest of the sequence can complete.
    const invoked: string[] = [];
    let hermesRuns = 0;
    const hybridRun: Parameters<typeof runJobFullWith>[1] = async (stageOpts) => {
      invoked.push(stageOpts.stage);
      if (stageOpts.stage === 'create') {
        return runStage(stageOpts);
      }
      if (stageOpts.stage === 'intake') {
        return {
          runId: stageOpts.runId, stage: 'intake', loop: false, iteration: 0, decision: null, verdict: null,
          nextStage: null, finalOutput: null, business: 'Test Bakery',
          providers: { used: [], absent: [], pool: ['groq'] },
        };
      }
      if (stageOpts.stage === 'hermes') {
        hermesRuns += 1;
        return {
          runId: stageOpts.runId, stage: 'hermes', loop: false, iteration: 0, decision: 'deliver', verdict: 'PASS',
          nextStage: null, finalOutput: '/site', business: 'Test Bakery',
        };
      }
      if (stageOpts.stage === 'report') {
        return {
          runId: stageOpts.runId, stage: 'report', loop: false, iteration: 1, decision: 'deliver', verdict: 'PASS',
          nextStage: null, finalOutput: '/site', business: 'Test Bakery',
        };
      }
      return {
        runId: stageOpts.runId, stage: stageOpts.stage, loop: false, iteration: 0, decision: null, verdict: null,
        nextStage: null, finalOutput: null,
      };
    };

    const final = await runJobFullWith({ runId, order: 'a bakery in Sibiu', maxIter: 3 }, hybridRun);

    assert.equal(invoked[0], 'create', 'the sequence still starts at create — no separate resume planner decides the entry point');
    assert.equal(hermesRuns, 1, 'the bounded QA loop still ran to a terminal decision');
    assert.equal(final.decision, 'deliver');

    const createEntryAfterRestart = (await loadStageLedger(runDir)).stages.create;
    assert.deepEqual(
      createEntryAfterRestart,
      createEntryBeforeRestart,
      'create was genuinely skipped on the restart, not silently re-run a second time',
    );
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
