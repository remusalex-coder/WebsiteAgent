/**
 * Candidate store — the guarantee that a worse attempt cannot replace a better
 * one.
 *
 * The freeze asks for two things here: a property test showing that
 * `quality(best)` never decreases under any order of promotion, and the
 * regression for the run that scored 68, then 55, then 51 and escalated holding
 * the 51.
 *
 * The property test matters more than the regression. `selectBest` is a pure
 * `argmax`, so permutation-invariance is a property of the function rather than
 * a behaviour a caller has to preserve — and that is precisely what the test
 * is for: if someone later "optimises" it into an incremental pointer update,
 * this fails.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  bestCandidate,
  finalizeBest,
  isBetter,
  isDeliverable,
  loadIndex,
  recordCandidate,
  selectBest,
  type CandidateRecord,
} from '../../lib/workflow/candidates.js';
import { createSerializedWriter } from '../../lib/workflow/runner.js';

function record(over: Partial<CandidateRecord> & { index: number }): CandidateRecord {
  return {
    candidateId: `c${String(over.index).padStart(3, '0')}`,
    iteration: over.index,
    dir: `candidates/c${String(over.index).padStart(3, '0')}`,
    costUnits: 0,
    createdAt: '2026-08-14T00:00:00.000Z',
    scores: { quality: 0, distinctness: 0, blockingClean: true },
    ...over,
  };
}

function withQuality(index: number, quality: number, blockingClean = true): CandidateRecord {
  return record({ index, scores: { quality, distinctness: 0, blockingClean } });
}

/** Deterministic shuffle so a failure is reproducible from the seed. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

function tmpRun(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bf-candidates-'));
}

/* ------------------------------------------------------------------ */
/* selectBest — the property                                           */
/* ------------------------------------------------------------------ */

test('selectBest is permutation-invariant', () => {
  const candidates = [
    withQuality(0, 68),
    withQuality(1, 55),
    withQuality(2, 51),
    withQuality(3, 68),
    withQuality(4, 12),
  ];
  const expected = selectBest(candidates)?.candidateId;

  for (let seed = 1; seed <= 200; seed += 1) {
    const permuted = shuffle(candidates, seed);
    assert.equal(selectBest(permuted)?.candidateId, expected, `permutation with seed ${seed} disagreed`);
  }
});

test('quality(best) never decreases as candidates are appended, in any order', () => {
  const qualities = [68, 55, 51, 71, 12, 71, 4, 90, 33];

  for (let seed = 1; seed <= 100; seed += 1) {
    const order = shuffle(
      qualities.map((q, i) => withQuality(i, q)),
      seed,
    );
    const accumulated: CandidateRecord[] = [];
    let previous = -Infinity;
    for (const candidate of order) {
      accumulated.push(candidate);
      const best = selectBest(accumulated);
      assert.ok(best !== null);
      assert.ok(
        best.scores.quality >= previous,
        `seed ${seed}: quality(best) fell from ${previous} to ${best.scores.quality}`,
      );
      previous = best.scores.quality;
    }
    assert.equal(previous, 90, `seed ${seed}: final best should be the maximum`);
  }
});

test('a worse candidate never displaces a better one', () => {
  const good = withQuality(0, 80);
  const worse = withQuality(1, 40);
  assert.equal(selectBest([good, worse])?.candidateId, good.candidateId);
  assert.equal(selectBest([worse, good])?.candidateId, good.candidateId);
  assert.equal(isBetter(worse, good), false);
});

test('blocking-clean beats a higher score that is not clean', () => {
  const brokenButPretty = withQuality(0, 95, false);
  const cleanButPlain = withQuality(1, 60, true);
  assert.equal(selectBest([brokenButPretty, cleanButPlain])?.candidateId, cleanButPlain.candidateId);
});

test('ties break on distinctness, then cost, then age', () => {
  const older = record({ index: 0, scores: { quality: 70, distinctness: 10, blockingClean: true } });
  const moreDistinct = record({ index: 1, scores: { quality: 70, distinctness: 40, blockingClean: true } });
  assert.equal(selectBest([older, moreDistinct])?.candidateId, moreDistinct.candidateId);

  const cheap = record({ index: 2, costUnits: 1, scores: { quality: 70, distinctness: 40, blockingClean: true } });
  assert.equal(selectBest([moreDistinct, cheap])?.candidateId, moreDistinct.candidateId, 'cost 0 beats cost 1');

  const sameAgain = record({ index: 3, scores: { quality: 70, distinctness: 40, blockingClean: true } });
  assert.equal(selectBest([moreDistinct, sameAgain])?.candidateId, moreDistinct.candidateId, 'the earlier one holds');
});

test('selectBest on an empty set is null, and null is not deliverable', () => {
  assert.equal(selectBest([]), null);
  assert.equal(isDeliverable(null), false);
  assert.equal(isDeliverable(withQuality(0, 90, false)), false);
  assert.equal(isDeliverable(withQuality(0, 10, true)), true);
});

/* ------------------------------------------------------------------ */
/* The regression the freeze names: 68 -> 55 -> 51                     */
/* ------------------------------------------------------------------ */

test('a declining run keeps the best attempt, not the last', async () => {
  const dir = tmpRun();

  for (const [iteration, quality] of [[0, 68], [1, 55], [2, 51]] as const) {
    fs.writeFileSync(path.join(dir, '5b-design.json'), JSON.stringify({ marker: quality }), 'utf8');
    fs.mkdirSync(path.join(dir, 'site'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'site', 'index.html'), `<!doctype html><title>${quality}</title>`, 'utf8');
    await recordCandidate({
      outputDir: dir,
      iteration,
      scores: { quality, distinctness: 0, blockingClean: true },
    });
  }

  const best = await bestCandidate(dir);
  assert.ok(best !== null);
  assert.equal(best.scores.quality, 68, 'the 68 must survive the 55 and the 51');
  assert.equal(best.candidateId, 'c000');

  // The losing attempts are still on disk, unmodified.
  const index = await loadIndex(dir);
  assert.equal(index.candidates.length, 3);
  assert.equal(index.bestId, 'c000');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, 'candidates', 'c002', '5b-design.json'), 'utf8')).marker,
    51,
  );

  // Finalising restores the run root from the winner, which is what every
  // downstream reader of `5b-design.json` and `site/` will see.
  const finalized = await finalizeBest(dir);
  assert.equal(finalized?.candidateId, 'c000');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '5b-design.json'), 'utf8')).marker, 68);
  assert.match(fs.readFileSync(path.join(dir, 'site', 'index.html'), 'utf8'), /<title>68<\/title>/);
});

/* ------------------------------------------------------------------ */
/* Write-once                                                          */
/* ------------------------------------------------------------------ */

test('candidates are write-once', async () => {
  const dir = tmpRun();
  fs.writeFileSync(path.join(dir, '5b-design.json'), '{}', 'utf8');

  await recordCandidate({ outputDir: dir, iteration: 0, scores: { quality: 1, distinctness: 0, blockingClean: true } });

  // Recreate the index as if a caller replayed the first append: the directory
  // for c000 already exists, so recording must refuse rather than overwrite.
  fs.rmSync(path.join(dir, 'candidates', 'index.json'));
  await assert.rejects(
    () => recordCandidate({ outputDir: dir, iteration: 0, scores: { quality: 9, distinctness: 0, blockingClean: true } }),
    /write-once/,
  );
});

test('finalizeBest on a run with no candidates changes nothing', async () => {
  const dir = tmpRun();
  fs.writeFileSync(path.join(dir, '5b-design.json'), '{"untouched":true}', 'utf8');
  assert.equal(await finalizeBest(dir), null);
  assert.equal(fs.readFileSync(path.join(dir, '5b-design.json'), 'utf8'), '{"untouched":true}');
});

/* ------------------------------------------------------------------ */
/* sourceDir — parallel candidate builds (scripts/n8n/stage.ts diverge) */
/* ------------------------------------------------------------------ */

test('recordCandidate copies from sourceDir when given, leaving outputDir\'s own 5b-design.json/site untouched', async () => {
  const dir = tmpRun();
  // The run root carries a DIFFERENT design than the one actually being
  // recorded — exactly the shape a parallel build's shadow directory takes:
  // its own 5b-design.json/site, never the shared root's.
  fs.writeFileSync(path.join(dir, '5b-design.json'), JSON.stringify({ marker: 'root, must stay untouched' }), 'utf8');

  const shadow = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-candidates-shadow-'));
  fs.writeFileSync(path.join(shadow, '5b-design.json'), JSON.stringify({ marker: 'from shadow' }), 'utf8');
  fs.mkdirSync(path.join(shadow, 'site'), { recursive: true });
  fs.writeFileSync(path.join(shadow, 'site', 'index.html'), '<!doctype html><title>shadow</title>', 'utf8');

  await recordCandidate({
    outputDir: dir,
    sourceDir: shadow,
    iteration: 0,
    scores: { quality: 50, distinctness: 0, blockingClean: true },
  });

  // The candidate directory holds the shadow's content...
  const recorded = JSON.parse(
    fs.readFileSync(path.join(dir, 'candidates', 'c000', '5b-design.json'), 'utf8'),
  ) as { marker: string };
  assert.equal(recorded.marker, 'from shadow');
  assert.match(
    fs.readFileSync(path.join(dir, 'candidates', 'c000', 'site', 'index.html'), 'utf8'),
    /<title>shadow<\/title>/,
  );

  // ...and the run root's own 5b-design.json — which a concurrently-building
  // sibling candidate might still be reading or about to overwrite — was
  // never touched by this call.
  const rootStill = JSON.parse(fs.readFileSync(path.join(dir, '5b-design.json'), 'utf8')) as { marker: string };
  assert.equal(rootStill.marker, 'root, must stay untouched');
});

/* ------------------------------------------------------------------ */
/* Concurrency — the race A3/G-RUNNER-01 named, and the fix for it     */
/* ------------------------------------------------------------------ */

/** A source directory for one simulated parallel candidate build. */
function fakeShadow(marker: number): string {
  const shadow = fs.mkdtempSync(path.join(os.tmpdir(), `bf-candidates-shadow-${marker}-`));
  fs.writeFileSync(path.join(shadow, '5b-design.json'), JSON.stringify({ marker }), 'utf8');
  return shadow;
}

test('regression: concurrent recordCandidate calls WITHOUT serialization can lose a candidate (the race this fix removes)', async () => {
  const dir = tmpRun();
  const shadows = [0, 1, 2, 3, 4].map(fakeShadow);

  // No SerializedWriter: every call reads the same (empty) index, computes
  // the same "position 0" candidate id, and races to write it back. This is
  // exactly the failure mode a naive parallel diverge loop would hit.
  await Promise.all(
    shadows.map((shadow, i) =>
      recordCandidate({
        outputDir: dir,
        sourceDir: shadow,
        iteration: 0,
        scores: { quality: i, distinctness: 0, blockingClean: true },
      }).catch(() => null), // a losing writer may also throw write-once; either loss counts
    ),
  );

  const index = await loadIndex(dir);
  assert.ok(
    index.candidates.length < shadows.length,
    'without serialization, concurrent candidates collide on id assignment and at least one is lost or rejected — ' +
      `got ${index.candidates.length}/${shadows.length}, proving the race is real`,
  );
});

test('fix: the same concurrent calls, serialized through SerializedWriter, record every candidate exactly once', async () => {
  const dir = tmpRun();
  const shadows = [0, 1, 2, 3, 4].map(fakeShadow);
  const writer = createSerializedWriter();

  await Promise.all(
    shadows.map((shadow, i) =>
      writer.withLock(() =>
        recordCandidate({
          outputDir: dir,
          sourceDir: shadow,
          iteration: 0,
          scores: { quality: i, distinctness: 0, blockingClean: true },
        }),
      ),
    ),
  );

  const index = await loadIndex(dir);
  assert.equal(index.candidates.length, shadows.length, 'every candidate must be recorded exactly once');

  // No two candidates collapsed onto the same id, and each candidate really
  // does hold its OWN shadow's design — not another one's.
  const ids = index.candidates.map((c) => c.candidateId);
  assert.equal(new Set(ids).size, ids.length, 'candidate ids must be unique');

  const markers = index.candidates
    .map((c) => JSON.parse(fs.readFileSync(path.join(dir, c.dir, '5b-design.json'), 'utf8')) as { marker: number })
    .map((d) => d.marker)
    .sort((a, b) => a - b);
  assert.deepEqual(markers, [0, 1, 2, 3, 4], 'each candidate carries its own shadow\'s content, not a sibling\'s');
});
