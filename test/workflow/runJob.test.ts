/**
 * The rejection loop's terminal states.
 *
 * Both assertions here are about a defect the freeze names: when a reconcept
 * build throws, the loop logged "escalate rather than spin" and then returned a
 * job whose `decision` was still `'running'`. A terminated job claiming to be
 * in flight is indistinguishable from a crashed one to anything reading
 * `job.json`, which is every dashboard and both drivers.
 *
 * The loop needs a browser and a model to reach that branch, so `runJob` takes
 * three optional hooks. They exist for this test: the failure branches are the
 * ones that must be asserted and the only ones that are otherwise unreachable
 * without launching Chromium and spending a call.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../../lib/config.js';
import { createConsoleSink, createLogger } from '../../lib/logger.js';
import { runJob } from '../../lib/workflow/runJob.js';
import { loadIndex } from '../../lib/workflow/candidates.js';
import type { WebsiteDesign } from '../../lib/types.js';

function silentLogger(): ReturnType<typeof createLogger> {
  return createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });
}

/**
 * A design tuned to fail the gate and route to a *rebuildable* stage.
 *
 * The numbers matter: `scoreExperience` has to land below the pass threshold of
 * 70 while leaving `explainability` at or above 0.5, because an explainability
 * under 0.5 is diagnosed as thin evidence and escalates immediately — which
 * would never reach the reconcept branch this test exists to exercise.
 *
 * Three of six decisions carry a rationale plus evidence (explainability 0.5),
 * and the primary CTA is empty (conversion clarity 0.5). That lands at ~69.
 */
function failingDesign(marker: number): WebsiteDesign {
  return {
    world: 'neutral',
    industry: { id: 'general' },
    personality: { rationale: 'Calm and considered.', evidence: ['rating 4.7'] },
    experience: {
      mode: 'brochure',
      signatureMoment: null,
      galleryLead: false,
      rationale: 'A clear functional page.',
      evidence: ['thin imagery'],
    },
    conversion: {
      mode: 'balanced',
      ctaPlacement: 'end',
      // Empty on purpose: conversion clarity drops to 0.5, which is what pulls
      // the overall score under the threshold.
      primaryCta: '',
      conversionMoment: 'end',
      rationale: 'Ask at the end.',
      evidence: ['no urgency signal'],
    },
    // No evidence: not "explained".
    interaction: { level: 'static', ceiling: 'static', rationale: 'Still.', evidence: [] },
    assets: { hero: null, reduceImagery: false, rationale: 'Nothing to lead with.', evidence: [] },
    layout: {
      // Empty rationale: not "explained".
      rationale: '',
      order: [0, 1],
      hero: 'centered',
      sections: [
        { index: 0, kind: 'hero', variant: 'a', emphasis: 1, fullBleed: false },
        { index: 1, kind: 'contact', variant: 'a', emphasis: 1, fullBleed: false },
      ],
    },
    tokens: { typography: { heading: { family: 'sans' }, body: { family: 'sans' } } },
    accessibility: { targetLevel: 'AA' },
    experienceScript: { beats: [], conversionAt: 0 },
    marker,
  } as unknown as WebsiteDesign;
}

interface Fixture {
  readonly runId: string;
  readonly runDir: string;
  readonly config: ReturnType<typeof loadConfig>;
}

function fixture(): Fixture {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-runjob-'));
  const runId = 'testrun';
  const runDir = path.join(outputRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(
    path.join(runDir, '3-profile.json'),
    JSON.stringify({ name: { value: 'Test Business' }, category: { value: 'general' }, description: null }),
    'utf8',
  );
  fs.writeFileSync(path.join(runDir, '5-content.json'), JSON.stringify({ sections: [] }), 'utf8');

  const config = { ...loadConfig(), outputDir: outputRoot };
  return { runId, runDir, config };
}

/** Writes what the build stage would have written, without composing anything. */
function writeBuild(runDir: string, marker: number): void {
  fs.writeFileSync(path.join(runDir, '5b-design.json'), JSON.stringify(failingDesign(marker)), 'utf8');
  fs.mkdirSync(path.join(runDir, 'site'), { recursive: true });
  fs.writeFileSync(path.join(runDir, 'site', 'index.html'), `<!doctype html><title>${marker}</title>`, 'utf8');
}

/* ------------------------------------------------------------------ */
/* P0-4 — a failed reconcept is terminal                               */
/* ------------------------------------------------------------------ */

test('a reconcept build failure terminates the job as escalated', async () => {
  const { runId, runDir, config } = fixture();
  let reconceptCalls = 0;

  const job = await runJob({
    runId,
    business: 'Test Business',
    maxIter: 3,
    config,
    logger: silentLogger(),
    hooks: {
      build: async () => {
        writeBuild(runDir, 1);
      },
      capture: async () => [{ viewport: 'desktop' as const, path: path.join(runDir, 'shots', 'desktop.png') }],
      reconcept: async () => {
        reconceptCalls += 1;
        throw new Error('renderer exploded');
      },
    },
  });

  assert.equal(
    reconceptCalls,
    1,
    'the fixture must reach the reconcept branch — if this is 0 the gate routed elsewhere and the test proves nothing',
  );
  assert.equal(job.decision, 'escalate', 'a job that has stopped must not report decision "running"');
  assert.equal(job.stage, 'human');
  assert.ok(
    job.errors.some((e) => e.includes('renderer exploded')),
    'the cause must survive into the job record',
  );
});

test('a build failure terminates the job as escalated', async () => {
  const { runId, config } = fixture();

  const job = await runJob({
    runId,
    business: 'Test Business',
    config,
    logger: silentLogger(),
    hooks: {
      build: async () => {
        throw new Error('compose failed');
      },
      capture: async () => [],
      reconcept: async () => {
        throw new Error('should never be reached');
      },
    },
  });

  assert.equal(job.decision, 'escalate');
  assert.equal(job.implementationStatus, 'failed');
});

/* ------------------------------------------------------------------ */
/* P0-2 — the loop records candidates and escalates holding the best   */
/* ------------------------------------------------------------------ */

test('the loop records a candidate before deciding, and escalation carries the best', async () => {
  const { runId, runDir, config } = fixture();

  const job = await runJob({
    runId,
    business: 'Test Business',
    maxIter: 3,
    config,
    logger: silentLogger(),
    hooks: {
      build: async () => {
        writeBuild(runDir, 1);
      },
      capture: async () => [{ viewport: 'desktop' as const, path: path.join(runDir, 'shots', 'desktop.png') }],
      reconcept: async () => {
        throw new Error('stop after one candidate');
      },
    },
  });

  const index = await loadIndex(runDir);
  assert.equal(index.candidates.length, 1, 'the first attempt is recorded before Hermes decides');
  assert.equal(index.bestId, 'c000');
  assert.equal(job.decision, 'escalate');

  // The run root holds the winning candidate's bytes, so every existing reader
  // of `5b-design.json` and `site/` still resolves to the delivered result.
  const design = JSON.parse(fs.readFileSync(path.join(runDir, '5b-design.json'), 'utf8')) as { marker: number };
  assert.equal(design.marker, 1);
  assert.equal(job.finalOutput, path.join(runDir, 'site', 'index.html'));
});
