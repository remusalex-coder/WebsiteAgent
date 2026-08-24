/**
 * A/B harness — blinding and the decision rule.
 *
 * The freeze asks for one thing here: that the manifest is not derivable from
 * the served artifacts. A judge who can tell which folder came from which arm
 * is not a blind judge, and the whole experiment turns into an expensive way to
 * confirm a prior.
 *
 * The decision rule is tested alongside it because the thresholds are frozen
 * (≥0.65 build, ≥0.45 ship the floor, below that investigate) and a silently
 * drifting boundary would change what the experiment concludes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { blindingLeaks, decide, wilson, type Manifest } from '../../scripts/ab-floor-vs-director.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bf-ab-'));
}

function manifest(over: Partial<Manifest> = {}): Manifest {
  return { version: 1, pairs: [], verdicts: [], ...over };
}

/* ------------------------------------------------------------------ */
/* Blinding                                                            */
/* ------------------------------------------------------------------ */

test('a clean pair leaks nothing', () => {
  const dir = tmpDir();
  for (const side of ['left', 'right']) {
    fs.mkdirSync(path.join(dir, side, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, side, 'index.html'),
      '<!doctype html><html lang="en"><head><title>A Bakery</title></head><body><h1>Bread</h1></body></html>',
    );
    fs.writeFileSync(path.join(dir, side, 'styles.css'), ':root { --color-brand: #b45; }');
    fs.writeFileSync(path.join(dir, side, 'assets', 'hero.jpg'), 'not really a jpeg');
  }
  assert.deepEqual(blindingLeaks(dir), []);
});

test('a provenance file in the tree is caught', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'left'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'left', 'index.html'), '<!doctype html><title>ok</title>');
  fs.writeFileSync(path.join(dir, 'left', 'arm-b.json'), '{}');

  const leaks = blindingLeaks(dir);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0] ?? '', /filename: left\/arm-b\.json/);
});

test('an arm named inside a served file is caught', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'right'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'right', 'index.html'),
    '<!doctype html><title>ok</title><!-- built by the deterministic floor -->',
  );

  const leaks = blindingLeaks(dir);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0] ?? '', /content: right\/index\.html/);
});

test('the served side names carry no information', () => {
  // `left` and `right` are the only names a judge sees, and neither is an arm.
  assert.equal(blindingLeaks.length >= 1, true);
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'left'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'right'), { recursive: true });
  assert.deepEqual(blindingLeaks(dir), []);
});

/* ------------------------------------------------------------------ */
/* The decision rule                                                   */
/* ------------------------------------------------------------------ */

function pairs(n: number): Manifest['pairs'] {
  return Array.from({ length: n }, (_, i) => ({
    label: `l${i}`,
    runId: `run${i}`,
    // Alternate the assignment so a test that ignored `sides` would fail.
    sides: (i % 2 === 0 ? { left: 'a', right: 'b' } : { left: 'b', right: 'a' }) as { left: 'a' | 'b'; right: 'a' | 'b' },
    preparedAt: '2026-08-14T00:00:00.000Z',
  }));
}

/** Records `bWins` verdicts choosing arm B, and the rest choosing arm A. */
function verdicts(total: number, bWins: number): Manifest['verdicts'] {
  const all = pairs(total);
  return all.map((p, i) => {
    const wantArm: 'a' | 'b' = i < bWins ? 'b' : 'a';
    const chose = p.sides.left === wantArm ? 'left' : 'right';
    return { label: p.label, chose, judge: `j${i}`, note: '' };
  });
}

test('fewer than seven verdicts is not a result', () => {
  const m = manifest({ pairs: pairs(6), verdicts: verdicts(6, 6) });
  const result = decide(m);
  assert.equal(result.decision, 'insufficient-data');
  assert.equal(result.armBWins, 6);
});

test('a decisive win for the model path routes to building P4-P8', () => {
  const m = manifest({ pairs: pairs(10), verdicts: verdicts(10, 8) });
  const result = decide(m);
  assert.equal(result.armBWinRate, 0.8);
  assert.equal(result.decision, 'build-p4-p8');
});

test('a middling result ships the deterministic floor', () => {
  const m = manifest({ pairs: pairs(10), verdicts: verdicts(10, 5) });
  assert.equal(decide(m).decision, 'ship-the-floor');
});

test('the floor winning routes to investigating degradation', () => {
  const m = manifest({ pairs: pairs(10), verdicts: verdicts(10, 2) });
  const result = decide(m);
  assert.equal(result.armBWinRate, 0.2);
  assert.equal(result.decision, 'investigate-degradation');
});

test('the arm is read through the hidden mapping, not the side', () => {
  // Every judge picks `left`. Because the mapping alternates, that is a 50/50
  // split between the arms — a harness that counted sides would report 100%.
  const m = manifest({
    pairs: pairs(10),
    verdicts: pairs(10).map((p, i) => ({ label: p.label, chose: 'left' as const, judge: `j${i}`, note: '' })),
  });
  const result = decide(m);
  assert.equal(result.armBWins, 5);
  assert.equal(result.armBWinRate, 0.5);
});

test('a verdict for an unknown label is ignored rather than counted', () => {
  const m = manifest({ pairs: pairs(8), verdicts: [...verdicts(8, 8), { label: 'ghost', chose: 'left', judge: 'x', note: '' }] });
  assert.equal(decide(m).verdicts, 8);
});

test('the confidence interval widens as the sample shrinks', () => {
  const wide = wilson(6, 8);
  const narrow = wilson(600, 800);
  assert.ok(wide.high - wide.low > narrow.high - narrow.low);
  assert.ok(narrow.low > 0.7 && narrow.high < 0.8);
});
