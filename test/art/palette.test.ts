/**
 * Reading a brand colour off photographs.
 *
 * The interesting cases are the ones that produced a wrong answer on real
 * images, and both are pinned here:
 *
 * - **The sky.** A photograph of a subject under an open sky returned the sky,
 *   because it is large, evenly lit and sits at a lightness the scoring liked.
 *   Tartine's first extraction was a pale blue.
 * - **The shadow.** Weighting by prevalence alone returns a near-black or a
 *   dead grey on almost any set of photographs.
 *
 * Synthetic images rather than fixtures: the rules under test are about area,
 * position and chroma, and a hand-built frame states those exactly. A JPEG
 * would test the decoder, which is Chromium's job and not this file's.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { quantize, seedFrom } from '../../lib/art/palette.js';

import type { Pixels } from '../../lib/art/palette.js';

type Rgb = readonly [number, number, number];

/**
 * A frame built from horizontal bands, top to bottom.
 *
 * Position is the whole point of the sky test, so bands rather than a bag of
 * colours: the first band is the top of the picture.
 */
function frame(width: number, height: number, bands: readonly (readonly [Rgb, number])[]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  let y = 0;
  for (const [[r, g, b], rows] of bands) {
    for (let row = 0; row < rows && y < height; row += 1, y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

const SKY: Rgb = [0xb5, 0xcb, 0xe2];
const CRUST: Rgb = [0x9b, 0x6a, 0x4a];
const SHADOW: Rgb = [0x22, 0x20, 0x1f];

describe('quantize', () => {
  it('returns nothing for a greyscale image', () => {
    const grey = frame(32, 32, [[[0x80, 0x80, 0x80], 32]]);
    assert.deepEqual(quantize([grey]), []);
  });

  it('ignores paper white and deep shadow', () => {
    const extremes = frame(32, 32, [
      [[0xfe, 0xfd, 0xfc], 16],
      [[0x03, 0x02, 0x01], 16],
    ]);
    assert.deepEqual(quantize([extremes]), []);
  });

  it('gives every image one vote regardless of its size', () => {
    // A wide panorama of one colour must not outvote two small frames of another.
    const panorama = frame(256, 64, [[SKY, 64]]);
    const smallA = frame(16, 16, [[CRUST, 16]]);
    const smallB = frame(16, 16, [[CRUST, 16]]);

    const swatches = quantize([panorama, smallA, smallB]);
    const top = swatches[0];
    assert.ok(top !== undefined);
    // Two votes of crust against one of sky.
    assert.ok(top.hex.startsWith('#9'), `expected a crust tone, got ${top.hex}`);
  });
});

describe('seedFrom', () => {
  it('is null when the photographs carry no colour', () => {
    assert.equal(seedFrom([frame(32, 32, [[[0x77, 0x77, 0x77], 32]])]), null);
  });

  it('is null when there are no photographs at all', () => {
    assert.equal(seedFrom([]), null);
  });

  it('does not return the sky', () => {
    /*
     * The measured failure, reduced. The sky covers more of the frame than the
     * subject does and is perfectly saturated; it is still not the brand.
     * Two rules have to combine to get this right — the subject is central, and
     * a seed wants to sit near the middle of the lightness range.
     */
    const outdoor = frame(48, 48, [
      [SKY, 26],
      [CRUST, 14],
      [SHADOW, 8],
    ]);

    const seed = seedFrom([outdoor]);
    assert.ok(seed !== null);
    assert.notEqual(seed, '#b5cbe2');

    // Warm, not blue: red must lead.
    const [r, , b] = [
      Number.parseInt(seed.slice(1, 3), 16),
      Number.parseInt(seed.slice(3, 5), 16),
      Number.parseInt(seed.slice(5, 7), 16),
    ];
    assert.ok(r > b, `expected a warm seed, got ${seed}`);
  });

  it('does not return the shadow, however much of the frame it covers', () => {
    const dim = frame(48, 48, [
      [SHADOW, 36],
      [CRUST, 12],
    ]);
    const seed = seedFrom([dim]);
    assert.ok(seed !== null);
    assert.notEqual(seed, '#22201f');
  });

  it('is deterministic', () => {
    const images = [frame(32, 32, [[SKY, 12], [CRUST, 20]])];
    assert.equal(seedFrom(images), seedFrom(images));
  });
});
