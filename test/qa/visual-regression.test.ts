/**
 * P4-6 — Visual regression (N-14): identical renders diff to 0; a perturbed
 * render diffs above threshold.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { diffPixels, isEffectivelySame } from '../../lib/qa/visual-regression.js';
import type { RgbaImage } from '../../lib/qa/visual-regression.js';

function solid(width: number, height: number, rgb: [number, number, number]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

test('identical renders diff to exactly 0', () => {
  const a = solid(100, 80, [200, 100, 50]);
  const b = solid(100, 80, [200, 100, 50]);
  const diff = diffPixels(a, b);
  assert.equal(diff.differingPixels, 0);
  assert.equal(diff.ratio, 0);
  assert.equal(diff.meanAbsDifference, 0);
  assert.equal(isEffectivelySame(diff), true);
});

test('a single different pixel is counted', () => {
  const a = solid(10, 10, [0, 0, 0]);
  const b = solid(10, 10, [0, 0, 0]);
  b.data[0] = 255; // change one pixel's red channel
  const diff = diffPixels(a, b);
  assert.equal(diff.differingPixels, 1);
  assert.equal(diff.totalPixels, 100);
  assert.equal(diff.ratio, 0.01);
});

test('a perturbed render diffs above the same-candidate threshold', () => {
  const a = solid(50, 50, [10, 10, 10]);
  const b = solid(50, 50, [250, 250, 250]);
  const diff = diffPixels(a, b);
  assert.equal(diff.differingPixels, 2500);
  assert.equal(isEffectivelySame(diff, 0.02), false, 'a fully repainted page is a genuinely different candidate');
});

test('small anti-aliasing noise is tolerated at tolerance 0 default and relaxed', () => {
  const a = solid(8, 8, [100, 100, 100]);
  const b = solid(8, 8, [100, 100, 100]);
  b.data[4] = 101; // sub-tolerance change
  const strict = diffPixels(a, b, 0);
  assert.equal(strict.differingPixels, 1);
  const tolerant = diffPixels(a, b, 1);
  assert.equal(tolerant.differingPixels, 0);
});

test('differing sizes throw rather than compare apples to oranges', () => {
  const a = solid(10, 10, [0, 0, 0]);
  const b = solid(11, 10, [0, 0, 0]);
  assert.throws(() => diffPixels(a, b), /resize first/);
});

test('mean absolute difference reflects channel delta', () => {
  const a = solid(1, 1, [10, 10, 10]);
  const b = solid(1, 1, [30, 20, 10]);
  const diff = diffPixels(a, b);
  // One pixel, four channels: (20 + 10 + 0 + 0) / 4 = 7.5
  assert.equal(diff.meanAbsDifference, 7.5);
});