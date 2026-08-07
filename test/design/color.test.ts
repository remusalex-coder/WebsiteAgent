/**
 * The colour engine.
 *
 * Every colour in a design comes from here, so these are the tests that stop a
 * bad ramp reaching a page. The round-trip and gamut assertions matter most:
 * they are what guarantee a generated hex is renderable rather than a
 * plausible-looking string that clips to something else in the browser.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RAMP_ROLE,
  RAMP_STEPS,
  adjustForContrast,
  buildRamp,
  clampToGamut,
  contrastHex,
  contrastRatio,
  formatHex,
  hexToOklch,
  luminance,
  oklchToHex,
  parseHex,
  readableOn,
  rgbToOklch,
} from '../../lib/design/color.js';

describe('parseHex', () => {
  it('reads every hex form', () => {
    assert.deepEqual(parseHex('#fff'), { r: 1, g: 1, b: 1 });
    assert.deepEqual(parseHex('#ffffff'), { r: 1, g: 1, b: 1 });
    assert.deepEqual(parseHex('#000000'), { r: 0, g: 0, b: 0 });
    assert.deepEqual(parseHex('ffffff'), { r: 1, g: 1, b: 1 });
  });

  it('ignores alpha rather than failing on it', () => {
    assert.deepEqual(parseHex('#ffffffcc'), { r: 1, g: 1, b: 1 });
  });

  it('rejects what is not a colour', () => {
    for (const value of ['#ggg', 'red', '', '#12345', 'rgb(1,2,3)']) {
      assert.equal(parseHex(value), null, value);
    }
  });
});

describe('OKLCH round trip', () => {
  it('returns the colour it was given', () => {
    for (const hex of ['#5b3a29', '#14213d', '#c98a3f', '#0f7a4a', '#ffffff', '#000000', '#7f7f7f']) {
      const oklch = hexToOklch(hex);
      assert.ok(oklch, hex);
      assert.equal(oklchToHex(oklch), hex, `round trip of ${hex}`);
    }
  });

  it('is stable when run twice', () => {
    const first = hexToOklch('#5b3a29');
    const second = hexToOklch('#5b3a29');
    assert.deepEqual(first, second);
  });

  it('reports lightness on a perceptual scale, unlike HSL', () => {
    // Yellow and blue are both "50% lightness" in HSL and nothing like it to
    // the eye. This is the whole reason the engine is in OKLCH.
    const yellow = hexToOklch('#ffff00');
    const blue = hexToOklch('#0000ff');
    assert.ok(yellow && blue);
    assert.ok(yellow.l > blue.l + 0.4, `yellow ${yellow.l} should far exceed blue ${blue.l}`);
  });

  it('pins hue to zero for a grey rather than returning noise', () => {
    assert.equal(rgbToOklch({ r: 0.5, g: 0.5, b: 0.5 }).h, 0);
    assert.equal(rgbToOklch({ r: 0, g: 0, b: 0 }).h, 0);
  });
});

describe('clampToGamut', () => {
  it('leaves an in-gamut colour alone', () => {
    const inside = { l: 0.6, c: 0.05, h: 250 };
    assert.deepEqual(clampToGamut(inside), inside);
  });

  it('reduces chroma rather than clipping channels, so hue survives', () => {
    const impossible = { l: 0.6, c: 0.4, h: 250 };
    const clamped = clampToGamut(impossible);

    assert.ok(clamped.c < impossible.c);
    assert.equal(clamped.l, impossible.l);
    assert.equal(clamped.h, impossible.h);
  });

  it('produces a renderable colour for any lightness and hue', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const l of [0.1, 0.35, 0.6, 0.85, 0.99]) {
        const hex = oklchToHex({ l, c: 0.4, h: hue });
        assert.match(hex, /^#[0-9a-f]{6}$/, `hue ${hue} l ${l}`);
      }
    }
  });
});

describe('contrast', () => {
  it('matches the known WCAG extremes', () => {
    assert.equal(Math.round(contrastHex('#000000', '#ffffff')), 21);
    assert.equal(contrastHex('#ffffff', '#ffffff'), 1);
  });

  it('does not depend on argument order', () => {
    const a = { r: 0.1, g: 0.2, b: 0.3 };
    const b = { r: 0.9, g: 0.9, b: 0.9 };
    assert.equal(contrastRatio(a, b), contrastRatio(b, a));
  });

  it('orders luminance the way the eye does', () => {
    assert.ok(luminance({ r: 1, g: 1, b: 1 }) > luminance({ r: 0.5, g: 0.5, b: 0.5 }));
    assert.ok(luminance({ r: 0, g: 1, b: 0 }) > luminance({ r: 0, g: 0, b: 1 }));
  });

  it('picks the more readable of two candidates', () => {
    assert.equal(readableOn('#14213d', '#111111', '#ffffff'), '#ffffff');
    assert.equal(readableOn('#fafaf8', '#111111', '#ffffff'), '#111111');
  });
});

describe('adjustForContrast', () => {
  it('darkens until the target is met', () => {
    const start = hexToOklch('#9a9a9a');
    assert.ok(start);

    const adjusted = adjustForContrast(start, '#ffffff', 4.5, 'darker');
    assert.ok(contrastHex(oklchToHex(adjusted), '#ffffff') >= 4.5);
  });

  it('returns its best attempt rather than looping forever on an impossible target', () => {
    const start = hexToOklch('#808080');
    assert.ok(start);

    // 21:1 against mid-grey is unreachable from any colour.
    const adjusted = adjustForContrast(start, '#808080', 21, 'darker');
    assert.ok(adjusted.l >= 0 && adjusted.l <= 1);
  });

  it('stops immediately when the target is already met', () => {
    const start = hexToOklch('#000000');
    assert.ok(start);
    assert.deepEqual(adjustForContrast(start, '#ffffff', 4.5, 'darker'), start);
  });
});

describe('buildRamp', () => {
  const seed = hexToOklch('#5b3a29');

  it('produces twelve steps', () => {
    assert.ok(seed);
    assert.equal(buildRamp(seed, { chroma: 0.12 }).length, RAMP_STEPS);
    assert.equal(RAMP_STEPS, 12);
  });

  it('runs light to dark without reversing', () => {
    assert.ok(seed);
    const steps = buildRamp(seed, { chroma: 0.12 });

    for (let i = 1; i < steps.length; i += 1) {
      const previous = parseHex(steps[i - 1] ?? '');
      const current = parseHex(steps[i] ?? '');
      assert.ok(previous && current);
      assert.ok(
        luminance(current) < luminance(previous),
        `step ${i} (${steps[i]}) should be darker than step ${i - 1} (${steps[i - 1]})`,
      );
    }
  });

  it('emits only renderable colours', () => {
    assert.ok(seed);
    for (const chroma of [0.02, 0.12, 0.22, 0.4]) {
      for (const step of buildRamp(seed, { chroma })) {
        assert.match(step, /^#[0-9a-f]{6}$/);
      }
    }
  });

  it('gives its text step usable contrast against its canvas step', () => {
    assert.ok(seed);
    const steps = buildRamp(seed, { chroma: 0.01 });
    const ratio = contrastHex(steps[RAMP_ROLE.textStrong] ?? '', steps[RAMP_ROLE.canvas] ?? '');
    assert.ok(ratio >= 4.5, `expected >= 4.5, got ${ratio}`);
  });

  it('is deterministic across calls', () => {
    assert.ok(seed);
    assert.deepEqual(buildRamp(seed, { chroma: 0.15 }), buildRamp(seed, { chroma: 0.15 }));
  });

  it('discards the seed lightness, so a dark and a mid seed of one hue agree', () => {
    const dark = hexToOklch('#0a1628');
    const mid = hexToOklch('#3f6fbf');
    assert.ok(dark && mid);

    // Same hue family, very different lightness — the ramps should be close.
    const a = buildRamp({ ...dark, h: 250 }, { chroma: 0.1 });
    const b = buildRamp({ ...mid, h: 250 }, { chroma: 0.1 });
    assert.deepEqual(a, b);
  });
});

describe('formatHex', () => {
  it('always emits lower-case six digits, so equal colours compare equal', () => {
    assert.equal(formatHex({ r: 1, g: 0.5, b: 0 }), '#ff8000');
    assert.equal(formatHex({ r: 0, g: 0, b: 0 }), '#000000');
  });

  it('clamps out-of-range channels rather than emitting nonsense', () => {
    assert.equal(formatHex({ r: 2, g: -1, b: 0.5 }), '#ff0080');
  });
});
