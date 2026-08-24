/**
 * P7 — the diverge stage: a base directive diverges into K genuinely-different
 * design directions (frozen K=3), each is rendered and recorded as an
 * immutable candidate, and the jury's winner is restored to the run root.
 *
 * Runs hermetically: a real profile + content are written to a temp run
 * directory, `palette.json` short-circuits the brand seed so no image is
 * downloaded, and the deterministic compose/render path turns each direction
 * into a real rendered site — no model calls, no network.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { runStage, K_DESIGN_DIRECTIONS } from '../../scripts/n8n/stage.js';
import { profileFrom, baselineFrom, BAKERY } from '../content/fixtures.js';
import type { DesignDirective } from '../../lib/design/directive.js';

const BASE_DIRECTIVE: DesignDirective = {
  direction: 'editorial',
  experienceMode: 'showcase',
  signatureMoment: 'statement',
  rationale: 'base',
  confidence: 0.6,
  creativeThesis: 'base direction',
};

async function setupRun(): Promise<string> {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-diverge-'));
  const runId = 'divergetest';
  const runDir = path.join(tmpRoot, 'output', runId);
  fs.mkdirSync(runDir, { recursive: true });

  const profile = profileFrom(BAKERY);
  const content = baselineFrom(BAKERY, [
    'hero',
    'about',
    'services',
    'menu',
    'hours',
    'location',
    'contact',
    'cta',
    'faq',
    'gallery',
    'testimonials',
    'statement',
  ]);
  fs.writeFileSync(path.join(runDir, '3-profile.json'), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(runDir, '5-content.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  // The brand seed cache short-circuits image sampling: nothing is fetched.
  fs.writeFileSync(path.join(runDir, 'palette.json'), `${JSON.stringify({ hex: null, sampled: 0, note: '' })}\n`, 'utf8');
  fs.writeFileSync(
    path.join(runDir, 'job.json'),
    `${JSON.stringify(
      {
        jobId: runId,
        business: BAKERY.name,
        stage: 'creative',
        iteration: 0,
        maxIter: 3,
        creativeDirection: BASE_DIRECTIVE,
        design: null,
        providerLog: [],
        budgetCents: 20,
        decision: 'running',
        artifacts: {},
        errors: [],
        finalOutput: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return tmpRoot;
}

test('the frozen battle width is K=3', () => {
  assert.equal(K_DESIGN_DIRECTIONS, 3);
});

test('diverge renders K directions, records K candidates, and restores a winner', async () => {
  const tmpRoot = await setupRun();
  const originalOutput = process.env.OUTPUT_DIR;
  process.env.OUTPUT_DIR = path.join(tmpRoot, 'output');
  try {
    const result = await runStage({ stage: 'diverge', runId: 'divergetest', maxIter: 3 });
    assert.equal(result.stage, 'diverge');
    assert.ok(result.note !== undefined && result.note.includes('battled'), `note should describe the battle, got: ${result.note}`);

    const runDir = path.join(tmpRoot, 'output', 'divergetest');
    const index = JSON.parse(fs.readFileSync(path.join(runDir, 'candidates', 'index.json'), 'utf8'));
    assert.equal(index.candidates.length, K_DESIGN_DIRECTIONS);
    assert.ok(index.bestId !== null, 'a winner must be derived');

    // Every candidate is a real rendered site, not a JSON stub.
    for (const record of index.candidates) {
      const site = path.join(runDir, record.dir, 'site', 'index.html');
      assert.ok(fs.existsSync(site), `candidate ${record.candidateId} should have a rendered site`);
    }

    // The run root holds the winner's design after finalizeBest.
    const job = JSON.parse(fs.readFileSync(path.join(runDir, 'job.json'), 'utf8'));
    assert.ok(job.design !== null, 'the winner design must be persisted on the job');
    const directions = job.designDirections as {
      count: number;
      directions: { id: string; fingerprint: string }[];
      jury: { bestQuality: number; spread: number; judgeCount: number };
      winner: string;
    };
    assert.equal(directions.count, K_DESIGN_DIRECTIONS);
    assert.equal(directions.jury.judgeCount, 1, 'zero vision calls with the deterministic spread');
    assert.ok(directions.jury.bestQuality > 0);
    // Genuinely different, not the same page recoloured: distinct L1 surfaces.
    const fingerprints = new Set(directions.directions.map((d) => d.fingerprint));
    assert.equal(fingerprints.size, K_DESIGN_DIRECTIONS, 'each direction must occupy a distinct L1 decision surface');
  } finally {
    if (originalOutput === undefined) delete process.env.OUTPUT_DIR;
    else process.env.OUTPUT_DIR = originalOutput;
  }
});

test('diverge without a creative direction fails loudly', async () => {
  const tmpRoot = await setupRun();
  const runDir = path.join(tmpRoot, 'output', 'divergetest');
  const jobPath = path.join(runDir, 'job.json');
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  job.creativeDirection = null;
  fs.writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');

  const originalOutput = process.env.OUTPUT_DIR;
  process.env.OUTPUT_DIR = path.join(tmpRoot, 'output');
  try {
    await assert.rejects(
      () => runStage({ stage: 'diverge', runId: 'divergetest', maxIter: 3 }),
      /creative direction/,
    );
  } finally {
    if (originalOutput === undefined) delete process.env.OUTPUT_DIR;
    else process.env.OUTPUT_DIR = originalOutput;
  }
});