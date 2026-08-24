/**
 * P4-2 — Lexicographic verdict combination (N-15, F-06).
 *
 * The freeze's property: "a higher-distinctness/lower-quality candidate never
 * wins." Blocking dimensions first; then max quality; then distinctness as
 * tie-break; no weighted sum anywhere.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { combineVerdicts, isStrictlyBetter, selectBestVerdict, DIMENSIONS } from '../../lib/qa/verdict.js';
import type { VerdictableCandidate, DimensionVerdict } from '../../lib/qa/verdict.js';

function candidate(
  id: string,
  index: number,
  dims: DimensionVerdict[],
  distinctness = 0,
): VerdictableCandidate {
  return { id, index, dimensions: dims, distinctness };
}

const PASSING_DIMS: DimensionVerdict[] = [
  { name: 'layout', blocking: true, status: 'pass', score: 100 },
  { name: 'visual', blocking: true, status: 'pass', score: 90 },
  { name: 'accessibility', blocking: true, status: 'pass', score: 100 },
  { name: 'functional-security', blocking: true, status: 'pass', score: 100 },
  { name: 'experience', blocking: false, status: 'pass', score: 80 },
  { name: 'narrative', blocking: false, status: 'pass', score: 70 },
];

test('a candidate with no blocking failure passes', () => {
  const result = combineVerdicts(candidate('a', 0, PASSING_DIMS));
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.quality, 80, 'quality is the best non-blocking dimension');
  assert.equal(result.blockingFailure, null);
});

test('a blocking fail fails the gate regardless of quality', () => {
  const dims: DimensionVerdict[] = [
    ...PASSING_DIMS.slice(0, 2),
    { name: 'layout', blocking: true, status: 'fail', score: 10, reason: 'sections overlap' },
    ...PASSING_DIMS.slice(3),
  ];
  const result = combineVerdicts(candidate('a', 0, dims));
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.blockingFailure, 'layout');
});

test("a blocking 'uncertain' blocks delivery (F-07)", () => {
  const dims: DimensionVerdict[] = [
    { name: 'layout', blocking: true, status: 'pass', score: 100 },
    { name: 'visual', blocking: true, status: 'uncertain', score: 0, reason: 'no visual evidence' },
    ...PASSING_DIMS.slice(2),
  ];
  const result = combineVerdicts(candidate('a', 0, dims));
  assert.equal(result.verdict, 'FAIL', 'uncertain blocks');
  assert.equal(result.uncertain, 'visual');
});

test('a higher-distinctness/lower-quality candidate never wins', () => {
  const higherQuality = candidate('good', 0, [
    ...PASSING_DIMS,
    { name: 'distinctness', blocking: false, status: 'pass', score: 0 },
  ], 20);
  const weird = candidate('strange', 1, [
    ...PASSING_DIMS.map((d) => (d.name === 'experience' ? { ...d, score: 20 } : d)),
    { name: 'distinctness', blocking: false, status: 'pass', score: 0 },
  ], 99);

  assert.equal(isStrictlyBetter(higherQuality, weird), true, 'quality outranks distinctness');
  assert.equal(isStrictlyBetter(weird, higherQuality), false);
});

test('distinctness breaks a perfect quality tie', () => {
  const a = candidate('a', 0, PASSING_DIMS, 50);
  const b = candidate('b', 1, PASSING_DIMS, 90);
  assert.equal(isStrictlyBetter(b, a), true);
});

test('two failing candidates: neither is better', () => {
  const failing = (id: string, index: number): VerdictableCandidate =>
    candidate(id, index, [
      { name: 'layout', blocking: true, status: 'fail', score: 0 },
      ...PASSING_DIMS.slice(1),
    ]);
  assert.equal(isStrictlyBetter(failing('x', 0), failing('y', 1)), false);
  assert.equal(isStrictlyBetter(failing('y', 1), failing('x', 0)), false);
});

test('selectBestVerdict is order-independent', () => {
  const dims = PASSING_DIMS;
  const a = candidate('a', 0, dims, 10);
  const b = candidate('b', 1, dims, 40);
  const c = candidate('c', 2, [
    ...PASSING_DIMS.slice(0, 2),
    { name: 'layout', blocking: true, status: 'fail', score: 0 },
    ...PASSING_DIMS.slice(3),
  ]);
  assert.equal(selectBestVerdict([a, b, c])?.id, 'b');
  assert.equal(selectBestVerdict([c, a, b])?.id, 'b');
});

test('the nine dimensions are named in blocking-first order (F-03)', () => {
  assert.equal(DIMENSIONS.length, 9);
  assert.equal(DIMENSIONS[0]?.blocking, true, 'first dimensions block');
  assert.deepEqual(DIMENSIONS.map((d) => d.name), [
    'layout',
    'visual',
    'accessibility',
    'functional-security',
    'experience',
    'narrative',
    'explainability',
    'businessSpecificity',
    'distinctness',
  ]);
});

test('no weighted sum exists — quality is the best non-blocking score, not an average', () => {
  const dims: DimensionVerdict[] = [
    ...PASSING_DIMS.slice(0, 4),
    { name: 'experience', blocking: false, status: 'pass', score: 100 },
    { name: 'narrative', blocking: false, status: 'pass', score: 20 },
  ];
  const result = combineVerdicts(candidate('a', 0, dims));
  assert.equal(result.quality, 100, 'best non-blocking dimension, not a weighted average of the two');
});