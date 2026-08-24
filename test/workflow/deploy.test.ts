/**
 * T04 — the production pipeline's `deploy` stage.
 *
 * Before this, `scripts/n8n/stage.ts`'s pipeline had a `preflight` and a
 * `report` stage but no `deploy` stage at all: a delivered job's
 * `finalOutput` was only ever a local `site/` path (set by `hermes`'s
 * deliver branch). `lib/deploy/netlify.ts` was real and already wired into
 * `main.ts`'s classic pipeline (via `agents/lovableAgent.ts`), but entirely
 * unreachable from this one — "browser opens on a live URL", the project's
 * own end-to-end target, was unreachable from this pipeline no matter how a
 * run went. This closes that gap.
 *
 * `NETLIFY_DEPLOY_TOKEN` is deliberately forced empty in every test here,
 * regardless of the ambient shell/CI environment (a real token exists in
 * this repo's `.env.awwwards`, unused by any code path, but a test must
 * never depend on that continuing to be true) — `deployToNetlify`'s own
 * contract is that an empty token means `status: 'skipped'`, never `failed`
 * and never a network call, which is exactly the boundary these tests
 * verify against real code. The `status: 'live'`/`status: 'failed'` branches
 * need a real Netlify account and network access and are exercised by
 * `deployToNetlify`'s own never-throws contract plus a documented manual
 * run, not by a unit test here — see T04's note in
 * `docs/IMPLEMENTATION_GAP.md`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { runStage } from '../../scripts/n8n/stage.js';
import { createJob, saveJob, loadJob } from '../../lib/workflow/jobState.js';

function withTempOutputDir<T>(fn: (outputDir: string, runId: string) => Promise<T>): Promise<T> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-deploy-'));
  const runId = 'deploy-test';
  const outputDir = path.join(root, runId);
  const prevOutputDir = process.env.OUTPUT_DIR;
  const prevNetlifyToken = process.env.NETLIFY_DEPLOY_TOKEN;
  process.env.OUTPUT_DIR = root;
  process.env.NETLIFY_DEPLOY_TOKEN = '';
  return fn(outputDir, runId).finally(() => {
    if (prevOutputDir === undefined) delete process.env.OUTPUT_DIR;
    else process.env.OUTPUT_DIR = prevOutputDir;
    if (prevNetlifyToken === undefined) delete process.env.NETLIFY_DEPLOY_TOKEN;
    else process.env.NETLIFY_DEPLOY_TOKEN = prevNetlifyToken;
    fs.rmSync(root, { recursive: true, force: true });
  });
}

test('T04: deploy is skipped, with no network attempt, when the job has not decided to deliver', () =>
  withTempOutputDir(async (outputDir, runId) => {
    await saveJob(outputDir, { ...createJob(runId, 'Test Bakery', 3), decision: 'escalate', finalOutput: null });

    const result = await runStage({ stage: 'deploy', runId, maxIter: 3 });

    assert.match(result.note ?? '', /not deliver/);
    await assert.rejects(fsp.access(path.join(outputDir, 'qa', 'deployment.json')), 'no deployment attempt is ever recorded for a non-delivering job');
    const job = await loadJob(outputDir);
    assert.equal(job?.finalOutput, null, 'finalOutput is never touched when deploy is skipped for this reason');
  }));

test('T04: with no NETLIFY_DEPLOY_TOKEN configured, a delivering job still deploys for real (status: skipped), never failed, and keeps its local finalOutput', () =>
  withTempOutputDir(async (outputDir, runId) => {
    const localSitePath = path.join(outputDir, 'site');
    await saveJob(outputDir, { ...createJob(runId, 'Test Bakery', 3), decision: 'deliver', finalOutput: localSitePath });

    const result = await runStage({ stage: 'deploy', runId, maxIter: 3 });

    assert.match(result.note ?? '', /NETLIFY_DEPLOY_TOKEN is not set/);
    const raw = await fsp.readFile(path.join(outputDir, 'qa', 'deployment.json'), 'utf8');
    const deployment = JSON.parse(raw) as { status: string; liveUrl: string | null };
    assert.equal(deployment.status, 'skipped', 'an unconfigured deploy target is recorded as skipped, never failed');
    assert.equal(deployment.liveUrl, null);

    const job = await loadJob(outputDir);
    assert.equal(job?.finalOutput, localSitePath, 'the local site remains the final output — never cleared, never fabricated as a live URL');
    assert.equal(job?.decision, 'deliver', 'a skipped deploy target never downgrades a delivered job');
  }));

test('T04: a second identical deploy call on the same delivered job is skipped by the T02 resume mechanism, not re-attempted', () =>
  withTempOutputDir(async (outputDir, runId) => {
    const localSitePath = path.join(outputDir, 'site');
    await saveJob(outputDir, { ...createJob(runId, 'Test Bakery', 3), decision: 'deliver', finalOutput: localSitePath });

    const first = await runStage({ stage: 'deploy', runId, maxIter: 3 });
    assert.doesNotMatch(first.note ?? '', /skipped: deploy's inputs/, 'the first call is a real attempt, not a resume-skip');

    const deploymentStat = await fsp.stat(path.join(outputDir, 'qa', 'deployment.json'));

    const second = await runStage({ stage: 'deploy', runId, maxIter: 3 });
    assert.match(
      second.note ?? '',
      /skipped: deploy's inputs are unchanged since its last successful run \(resume, T02\)/,
      'an unchanged job never re-deploys on resume — T02s skip check applies to deploy exactly like any other stage',
    );

    // No new deploy attempt happened: the artifact from the first call is untouched.
    const deploymentStatAfter = await fsp.stat(path.join(outputDir, 'qa', 'deployment.json'));
    assert.equal(deploymentStatAfter.mtimeMs, deploymentStat.mtimeMs);
  }));

test('T04: the report stage surfaces the recorded deployment status', () =>
  withTempOutputDir(async (outputDir, runId) => {
    const localSitePath = path.join(outputDir, 'site');
    await saveJob(outputDir, { ...createJob(runId, 'Test Bakery', 3), decision: 'deliver', finalOutput: localSitePath });

    await runStage({ stage: 'deploy', runId, maxIter: 3 });
    await runStage({ stage: 'report', runId, maxIter: 3 });

    const raw = await fsp.readFile(path.join(outputDir, 'qa', 'report.json'), 'utf8');
    const report = JSON.parse(raw) as { deployment: { status: string; liveUrl: string | null } | null };
    assert.deepEqual(report.deployment, { status: 'skipped', liveUrl: null });
  }));

test('T04: a run that never reaches deploy (e.g. an older run, or one that escalated before preflight) reports deployment as null, not a guess', () =>
  withTempOutputDir(async (outputDir, runId) => {
    await saveJob(outputDir, { ...createJob(runId, 'Test Bakery', 3), decision: 'escalate', finalOutput: null });

    await runStage({ stage: 'report', runId, maxIter: 3 });

    const raw = await fsp.readFile(path.join(outputDir, 'qa', 'report.json'), 'utf8');
    const report = JSON.parse(raw) as { deployment: unknown };
    assert.equal(report.deployment, null);
  }));
