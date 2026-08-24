/**
 * T03 — the classic `main.ts` CLI pipeline feeds the one canonical `JobState`.
 *
 * Per the Consolidation Map, `main.ts`'s nine stages stay the direct/local
 * invocation path, but a run must no longer be invisible to persistence: it
 * must call into `lib/workflow/jobState.ts` — the same module
 * `scripts/n8n/stage.ts` uses — so a CLI-invoked job is loadable by id and
 * shows a plausible stage progression, exactly like an n8n-triggered one.
 *
 * These tests exercise the real pipeline, not a mock of it. Artifacts for
 * `discovery` through `design` are seeded on disk (the same shape
 * `composeStandalone` itself produces, for the two stages — content, design —
 * that actually get rendered), and `resumePipeline` is asked to resume from
 * `enhance`. That runs exactly two stages for real: `enhance` (which, at the
 * default budget tier, renders the deterministic baseline and skips the
 * Forge/model path entirely — see `shouldAttemptEnhance`) and `deploy` (which,
 * with no `NETLIFY_DEPLOY_TOKEN` configured, returns `status: 'skipped'`
 * rather than attempting a real network call — see `lib/deploy/netlify.ts`).
 * No browser, no model, no network — real code, real assertions, still fast.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { resumePipeline } from '../main.js';
import { loadJob } from '../lib/workflow/jobState.js';
import { loadConfig } from '../lib/config.js';
import { profileFixture, strategyFixture } from './fixtures/business.js';
import { fullContent } from './fixtures/content.js';
import { composeDesign } from '../lib/design/compose.js';

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fsp.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Seeds a run directory with valid `discovery` through `design` artifacts, so
 * `resumePipeline(runId, 'enhance', config)` can load all of them off disk and
 * run only `enhance`/`deploy` for real.
 */
async function seedRunThroughDesign(outputDir: string, runId: string): Promise<void> {
  await fsp.mkdir(outputDir, { recursive: true });

  await writeJson(path.join(outputDir, '1-discovery.json'), {
    sourceUrl: 'https://maps.app.goo.gl/test-job-state',
    canonicalUrl: 'https://maps.google.com/place/test-bakery',
    name: 'Test Bakery',
  });

  await writeJson(path.join(outputDir, '2-collected.json'), {
    identity: { name: 'Test Bakery' },
    pages: [],
    collectedAt: '2026-08-24T00:00:00.000Z',
  });

  const profile = profileFixture({ name: 'Test Bakery' });
  await writeJson(path.join(outputDir, '3-profile.json'), profile);

  await writeJson(path.join(outputDir, '4-strategy.json'), strategyFixture());

  await writeJson(path.join(outputDir, '5a-directive.json'), { directive: null, provenance: null });

  // `write` and `design` must be genuinely renderable — `enhance` really
  // renders them — so these two are built the same way `composeStandalone`
  // (main.ts's own no-model path) builds them, not hand-rolled shapes.
  const content = fullContent;
  await writeJson(path.join(outputDir, '5-content.json'), content);

  const design = composeDesign({ profile, content });
  await writeJson(path.join(outputDir, '5b-design.json'), design);

  void runId; // kept for readability at call sites; not otherwise needed here
}

function tmpOutputDir(): { root: string; runsDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-main-jobstate-'));
  return { root, runsDir: root };
}

test('T03: a resumed main.ts run persists a loadable JobState, ending at delivery/deliver with a finalOutput', async () => {
  const { root } = tmpOutputDir();
  const prevOutputDir = process.env.OUTPUT_DIR;
  // Deliberately forced empty regardless of the ambient shell/CI environment:
  // this test must never attempt a real Netlify deploy. `deployToNetlify`'s
  // own contract is that an empty token means `skipped`, never `failed` —
  // this is what the test actually verifies, so the token must be reliably
  // absent, not merely absent by accident.
  const prevNetlifyToken = process.env.NETLIFY_DEPLOY_TOKEN;
  process.env.OUTPUT_DIR = root;
  process.env.NETLIFY_DEPLOY_TOKEN = '';
  try {
    const runId = 'jobstate-t03';
    const config = loadConfig();
    const outputDir = path.join(config.outputDir, runId);
    await seedRunThroughDesign(outputDir, runId);

    const result = await resumePipeline(runId, 'enhance', config);

    // The pipeline itself still behaves exactly as before this wiring
    // existed: a working site, deploy recorded as skipped (never failed)
    // because no Netlify token is configured in this environment.
    assert.equal(result.deployment.status, 'skipped');

    const job = await loadJob(outputDir);
    assert.ok(job, 'a main.ts run must leave a loadable JobState behind');
    assert.equal(job?.jobId, runId, 'the JobState is reloadable by the run id main.ts used');
    assert.equal(job?.business, 'https://maps.app.goo.gl/test-job-state', 'business identity is the Maps URL, set once at job creation');
    assert.equal(job?.stage, 'delivery', 'the last stage this pipeline reaches is recorded as JobState delivery');
    assert.equal(job?.decision, 'deliver', 'a run that finishes is recorded as delivered, not left at "running"');
    assert.ok(job?.finalOutput, 'a finished run always records a finalOutput, live URL or local path');
    assert.equal(job?.errors.length, 0, 'a clean run records no errors');
  } finally {
    if (prevOutputDir === undefined) delete process.env.OUTPUT_DIR;
    else process.env.OUTPUT_DIR = prevOutputDir;
    if (prevNetlifyToken === undefined) delete process.env.NETLIFY_DEPLOY_TOKEN;
    else process.env.NETLIFY_DEPLOY_TOKEN = prevNetlifyToken;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('T03: a stage that fails to resume records the failure on JobState before rethrowing, and never fabricates delivery', async () => {
  const { root } = tmpOutputDir();
  const prevOutputDir = process.env.OUTPUT_DIR;
  process.env.OUTPUT_DIR = root;
  try {
    const runId = 'jobstate-t03-fail';
    const config = loadConfig();
    const outputDir = path.join(config.outputDir, runId);

    // Only `discovery` exists — resuming from `design` requires reading back
    // `collect`/`normalize`/`analyze`/`write`/`direct` too, none of which are
    // on disk, so this fails for real inside `readArtifact`, exactly the way
    // a genuinely corrupted or partial run directory would.
    await fsp.mkdir(outputDir, { recursive: true });
    await writeJson(path.join(outputDir, '1-discovery.json'), {
      sourceUrl: 'https://maps.app.goo.gl/test-job-state-fail',
      canonicalUrl: 'https://maps.google.com/place/test-bakery-fail',
      name: 'Test Bakery Fail',
    });

    await assert.rejects(() => resumePipeline(runId, 'design', config));

    const job = await loadJob(outputDir);
    assert.ok(job, 'even a run that fails leaves a loadable JobState behind (the create-job write happens first)');
    assert.equal(job?.decision, 'running', 'a failed run is never recorded as delivered');
    assert.notEqual(job?.stage, 'delivery', 'a failed run never reaches the delivery stage on JobState');
    assert.equal(job?.errors.length, 1, 'the failure is recorded as an error on the persisted job');
    assert.match(job?.errors[0] ?? '', /2-collected\.json/, 'the recorded error names what was actually missing');
  } finally {
    if (prevOutputDir === undefined) delete process.env.OUTPUT_DIR;
    else process.env.OUTPUT_DIR = prevOutputDir;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
