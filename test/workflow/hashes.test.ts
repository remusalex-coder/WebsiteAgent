/**
 * P2-2 â€” content-addressed stage outputs.
 *
 * The hash must be stable across key order, and a stage whose inputs are
 * unchanged must be skippable. Both are what make a resume free: zero model
 * calls, zero browser launches on a completed stage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { canonicalJson, hashValue, shortHash, shouldSkip, loadStageLedger, recordStage } from '../../lib/workflow/hashes.js';
import type { AddressedStage } from '../../lib/workflow/hashes.js';

test('canonicalJson is independent of key order', () => {
  const a = { b: 1, a: { d: 2, c: 3 } };
  const b = { a: { c: 3, d: 2 }, b: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('hashValue is equal for equal data, regardless of key order', () => {
  assert.equal(hashValue({ role: 'research', n: 2 }), hashValue({ n: 2, role: 'research' }));
});

test('shortHash is a readable 12-hex prefix and deterministic', () => {
  const a = shortHash({ x: 1 });
  const b = shortHash({ x: 1 });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{12}$/);
});

test('hashValue differs for different data', () => {
  assert.notEqual(hashValue({ x: 1 }), hashValue({ x: 2 }));
});

test('hashValue normalises -0 and float noise', () => {
  assert.equal(hashValue(-0), hashValue(0));
  assert.equal(hashValue(0.1 + 0.2), hashValue(0.3));
});

test('shouldSkip is true only when inputs match and an output exists', () => {
  const recorded: AddressedStage = {
    stage: 'evidence',
    inputHash: 'abc',
    outputHash: 'def',
    outputPath: '1-discovery.json',
    completedAt: '2026-01-01T00:00:00.000Z',
  };
  assert.equal(shouldSkip(recorded, 'abc'), true);
  assert.equal(shouldSkip(recorded, 'different'), false, 'changed inputs must re-run');
  assert.equal(
    shouldSkip({ ...recorded, outputPath: null }, 'abc'),
    false,
    'no output path means the stage never produced anything',
  );
});

test('shouldSkip is false when nothing was ever recorded', () => {
  const never: AddressedStage = {
    stage: 'evidence',
    inputHash: null,
    outputHash: null,
    outputPath: null,
    completedAt: null,
  };
  assert.equal(shouldSkip(never, 'abc'), false);
});

/**
 * T01 — the persisted stage ledger (`ledger.json`), the persistence
 * `AddressedStage`/`shouldSkip` above were built for but never had until now.
 */

function tmpOutputDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bf-ledger-'));
}

test('loadStageLedger returns an empty ledger when nothing was ever recorded', async () => {
  const dir = tmpOutputDir();
  try {
    const ledger = await loadStageLedger(dir);
    assert.deepEqual(ledger, { version: 1, stages: {} });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recordStage persists a completed entry, readable back by loadStageLedger', async () => {
  const dir = tmpOutputDir();
  try {
    const ledger = await recordStage(dir, { stage: 'research', inputHash: 'in-1', outputHash: 'out-1' });
    assert.equal(ledger.stages.research?.inputHash, 'in-1');
    assert.equal(ledger.stages.research?.outputHash, 'out-1');
    assert.ok(ledger.stages.research?.completedAt !== null, 'a completed stage has a completedAt timestamp');

    const reloaded = await loadStageLedger(dir);
    assert.deepEqual(reloaded, ledger);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recordStage merges: a second stage does not erase the first', async () => {
  const dir = tmpOutputDir();
  try {
    await recordStage(dir, { stage: 'research', inputHash: 'in-1', outputHash: 'out-1' });
    const ledger = await recordStage(dir, { stage: 'analyze', inputHash: 'in-2', outputHash: 'out-2' });
    assert.ok(ledger.stages.research !== undefined, 'the earlier stage entry survives');
    assert.ok(ledger.stages.analyze !== undefined, 'the new stage entry is present');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recordStage(failed: true) records the attempt without a reusable output, and never corrupts prior entries', async () => {
  const dir = tmpOutputDir();
  try {
    await recordStage(dir, { stage: 'research', inputHash: 'in-1', outputHash: 'out-1' });
    const ledger = await recordStage(dir, { stage: 'analyze', inputHash: 'in-2', outputHash: 'should-be-dropped', failed: true });

    assert.equal(ledger.stages.analyze?.outputHash, null, 'a failed stage never records an output hash');
    assert.equal(ledger.stages.analyze?.completedAt, null, 'a failed stage never records a completion time');
    assert.equal(ledger.stages.analyze?.inputHash, 'in-2', 'the input hash is kept so a later resume still knows what was attempted');
    assert.equal(shouldSkip(ledger.stages.analyze as AddressedStage, 'in-2'), false, 'a failed stage can never be skipped as if it had output');

    assert.deepEqual(ledger.stages.research, { stage: 'research', inputHash: 'in-1', outputHash: 'out-1', outputPath: null, completedAt: ledger.stages.research?.completedAt ?? null }, 'the earlier, unrelated stage entry is untouched by the failure');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recordStage serialises concurrent writes to the same job — no entry is lost to a race', async () => {
  const dir = tmpOutputDir();
  try {
    const stageNames = Array.from({ length: 12 }, (_, i) => `stage-${i}`);
    await Promise.all(
      stageNames.map((stage) => recordStage(dir, { stage, inputHash: `in-${stage}`, outputHash: `out-${stage}` })),
    );
    const ledger = await loadStageLedger(dir);
    assert.deepEqual(Object.keys(ledger.stages).sort(), stageNames.sort(), 'every concurrent writer’s entry survives');
    for (const stage of stageNames) {
      assert.equal(ledger.stages[stage]?.outputHash, `out-${stage}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
