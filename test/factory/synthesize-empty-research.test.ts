/**
 * Regression: research that was attempted and produced nothing must not be
 * synthesised into a confident-looking empty artifact.
 *
 * ## The incident
 *
 * A live Factory V1 run had its whole research pool 429'd by Gemini's free
 * tier. The fan-out node swallowed the per-member error — correctly, so one
 * vendor's rate limit cannot end a run — and `synthesize` then merged the zero
 * notes it found on disk into a `0-research.json` whose `providersUsed`,
 * `queryVotes`, `siteMustDo` and `differentiators` were all `[]`, returned
 * HTTP 200, and let the factory continue. Every stage downstream treated an
 * unresearched brief as a researched one.
 *
 * ## The distinction being tested
 *
 * "Nobody could be asked" and "everybody was asked and failed" are different
 * states and must stay so. An unstaffed pool is survivable and honest: the
 * brief's own query stands. A staffed pool that returned nothing is a failure
 * and has to surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runStage } from '../../scripts/n8n/stage.js';
import { synthesizeResearch } from '../../lib/factory/synthesize.js';

import type { FactoryBrief } from '../../lib/factory/brief.js';

const BRIEF: FactoryBrief = {
  order: 'Website premium pentru o cofetarie din Sibiu',
  businessType: 'patisserie',
  city: 'Sibiu',
  country: 'Romania',
  language: 'ro',
  searchQuery: 'cofetarie Sibiu',
  qualityBar: 'premium',
  authoredBy: null,
  createdAt: new Date().toISOString(),
};

/** A run directory holding a brief and no research notes. */
async function runWithBriefOnly(runId: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-synth-'));
  const dir = path.join(root, runId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, '0-brief.json'), JSON.stringify(BRIEF, null, 2), 'utf8');
  return root;
}

/** Runs `synthesize` with the environment describing a given pool. */
async function synthesizeUnder(
  env: Readonly<Record<string, string>>,
  runId: string,
  outputRoot: string,
): Promise<{ threw: boolean; message: string }> {
  const saved = { ...process.env };
  Object.assign(process.env, { OUTPUT_DIR: outputRoot, ...env });
  try {
    await runStage({ stage: 'synthesize', runId });
    return { threw: false, message: '' };
  } catch (error) {
    return { threw: true, message: error instanceof Error ? error.message : String(error) };
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

test('a staffed research pool that returned no notes fails the stage', async () => {
  const runId = 'synth-staffed';
  const root = await runWithBriefOnly(runId);

  const result = await synthesizeUnder(
    { BF_POOL_RESEARCH: 'gemini', GEMINI_API_KEY: 'test-key-present', AI_PROVIDER: 'gemini' },
    runId,
    root,
  );

  assert.equal(result.threw, true, 'an empty synthesis from a staffed pool must not report success');
  assert.match(result.message, /no notes/i);
  assert.match(result.message, /gemini/, 'the error must name who was asked');

  // Nothing may be written: a 0-research.json on disk is what downstream reads.
  const written = await fs
    .readFile(path.join(root, runId, '0-research.json'), 'utf8')
    .then(() => true)
    .catch(() => false);
  assert.equal(written, false, 'no empty research artifact may be persisted');

  await fs.rm(root, { recursive: true, force: true });
});

test('an unstaffed pool degrades to the brief’s own query instead of failing', async () => {
  const runId = 'synth-unstaffed';
  const root = await runWithBriefOnly(runId);

  const result = await synthesizeUnder(
    // Named, but with no credential — so nothing can be asked.
    { BF_POOL_RESEARCH: 'anthropic', ANTHROPIC_API_KEY: '', AI_PROVIDER: 'anthropic' },
    runId,
    root,
  );

  assert.equal(result.threw, false, `an unstaffed pool is survivable, got: ${result.message}`);

  const synthesis = JSON.parse(await fs.readFile(path.join(root, runId, '0-research.json'), 'utf8')) as {
    searchQuery: string;
    providersUsed: readonly string[];
  };
  assert.equal(synthesis.searchQuery, BRIEF.searchQuery, "the brief's own query must stand");
  assert.deepEqual(synthesis.providersUsed, [], 'no vendor may be claimed');

  await fs.rm(root, { recursive: true, force: true });
});

test('synthesizeResearch over zero notes is empty — which is why the guard exists', () => {
  const synthesis = synthesizeResearch(BRIEF, []);
  assert.deepEqual(synthesis.providersUsed, []);
  assert.deepEqual(synthesis.queryVotes, []);
  assert.deepEqual(synthesis.siteMustDo, []);
  assert.deepEqual(synthesis.differentiators, []);
  assert.equal(
    synthesis.searchQuery,
    BRIEF.searchQuery,
    'it still falls back to the brief, which is what makes the empty artifact look usable',
  );
});
