/**
 * Industry palette calibration.
 *
 * `industries.ts` names a fallback hue per category, and a hue in OKLCH is not
 * reviewable by reading it — the number that means navy in HSL means a medical
 * cyan here. This suite is what makes those numbers reviewable: it states the
 * intended read for every category in words, then asserts the colour the
 * pipeline actually produces sits in the band that read occupies.
 *
 * It asserts on the *rendered* colour rather than on the declared hue, which is
 * the whole point. The declared hue is an input; what a visitor sees is the
 * solid ramp step after the theme's chroma ceiling and a gamut clamp have had
 * their say, and those can move a hue several degrees. A test on the input
 * would have passed happily through every miscalibration this file exists to
 * catch.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INDUSTRY_DEFAULTS, defaultsFor } from '../../lib/design/industries.js';
import { themeFor } from '../../lib/design/themes.js';
import { buildColorSystem } from '../../lib/design/tokens.js';
import { contrastHex, hexToOklch } from '../../lib/design/color.js';
import { DESIGN_DIRECTIONS, INDUSTRIES } from '../../lib/design/types.js';

import type { AccessibilityPreferences, Industry } from '../../lib/design/types.js';

const ACCESSIBILITY: AccessibilityPreferences = {
  targetLevel: 'AA',
  minContrastBody: 4.5,
  minContrastLarge: 3,
  minTapTargetPx: 44,
  respectReducedMotion: true,
  focusStyle: 'outline',
  semanticLandmarks: true,
};

/** The colour system an industry gets on a given direction, from its fallback hue. */
function systemFor(industry: Industry, direction = defaultsFor(industry).directions[0]) {
  return buildColorSystem({
    seedHex: null,
    fallbackHue: defaultsFor(industry).fallbackHue,
    theme: themeFor(direction ?? 'friendly'),
    accessibility: ACCESSIBILITY,
  }).system;
}

/** Rendered hue of a hex, in degrees. */
function hueOf(hex: string): number {
  const oklch = hexToOklch(hex);
  assert.ok(oklch !== null, `${hex} is not a colour`);
  return oklch.h;
}

/** Shortest angular distance between two hues, 0–180. */
function hueDistance(a: number, b: number): number {
  const delta = Math.abs(((a - b) % 360) + 360) % 360;
  return delta > 180 ? 360 - delta : delta;
}

/**
 * The intended read for every category, as a hue band on the rendered brand
 * colour. Bands are wide because a theme's chroma ceiling moves the result and
 * because the claim being made is "this is the right family", not "this is the
 * right degree" — narrower than the band, the assertion would break on a
 * legitimate chroma change and stop being about identity at all.
 */
const INTENT: Readonly<Record<Industry, { readonly read: string; readonly band: readonly [number, number] }>> = {
  bakery: { read: 'honey / baked gold', band: [62, 95] },
  restaurant: { read: 'brick / wine red', band: [10, 42] },
  cafe: { read: 'roasted coffee / sienna', band: [40, 66] },
  bar: { read: 'wine / evening crimson', band: [2, 34] },
  law: { read: 'navy', band: [252, 280] },
  medical: { read: 'clinical blue', band: [230, 258] },
  dental: { read: 'fresh aqua', band: [195, 222] },
  beauty: { read: 'rose', band: [338, 366] },
  spa: { read: 'sage / eucalyptus', band: [128, 158] },
  gym: { read: 'electric orange', band: [26, 52] },
  construction: { read: 'hard-hat amber', band: [74, 102] },
  automotive: { read: 'steel blue', band: [234, 260] },
  hotel: { read: 'heritage petrol teal', band: [172, 200] },
  retail: { read: 'boutique violet', band: [286, 312] },
  'real-estate': { read: 'slate indigo', band: [270, 296] },
  'professional-services': { read: 'deep emerald', band: [156, 184] },
  general: { read: 'plain unloaded blue', band: [246, 272] },
};

describe('industry palette calibration', () => {
  it('states an intended read for every industry', () => {
    for (const industry of INDUSTRIES) {
      assert.ok(INTENT[industry], `no intended read declared for ${industry}`);
    }
  });

  it('renders each industry into the band its intended read occupies', () => {
    for (const industry of INDUSTRIES) {
      const intent = INTENT[industry];
      const brand = systemFor(industry).semantic.brand;
      const hue = hueOf(brand);

      // Bands are written in a continuous run and may cross 360.
      const [low, high] = intent.band;
      const wrapped = hue < low ? hue + 360 : hue;
      assert.ok(
        wrapped >= low && wrapped <= high,
        `${industry} should read as ${intent.read} (${low}–${high}°) but rendered ${brand} at ${hue.toFixed(1)}°`,
      );
    }
  });

  it('holds the intended read across every direction the industry can take', () => {
    // The direction is chosen from the business's own copy, so an industry's
    // colour must survive all of its options — a bakery that lands on `elegant`
    // rather than `friendly` still has to look like a bakery.
    for (const industry of INDUSTRIES) {
      const intent = INTENT[industry];
      for (const direction of defaultsFor(industry).directions) {
        const hue = hueOf(systemFor(industry, direction).semantic.brand);
        const [low, high] = intent.band;
        const wrapped = hue < low ? hue + 360 : hue;
        assert.ok(
          wrapped >= low && wrapped <= high,
          `${industry} on ${direction} left its band at ${hue.toFixed(1)}°`,
        );
      }
    }
  });

  it('gives the brand colour enough chroma to read as a colour at all', () => {
    // A hue is worthless if the result is grey. The floor is low because
    // `minimal` and `luxury` are deliberately restrained directions.
    for (const industry of INDUSTRIES) {
      const oklch = hexToOklch(systemFor(industry).semantic.brand);
      assert.ok(oklch !== null);
      assert.ok(oklch.c >= 0.045, `${industry} brand is near-grey at chroma ${oklch.c.toFixed(3)}`);
    }
  });

  it('separates industries that share a first direction', () => {
    // Two categories on the same theme have nothing but colour to tell them
    // apart, so their hues have to do that work.
    const byDirection = new Map<string, Industry[]>();
    for (const industry of INDUSTRIES) {
      const direction = defaultsFor(industry).directions[0] ?? 'friendly';
      byDirection.set(direction, [...(byDirection.get(direction) ?? []), industry]);
    }

    for (const [direction, group] of byDirection) {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const a = group[i] as Industry;
          const b = group[j] as Industry;
          const distance = hueDistance(
            defaultsFor(a).fallbackHue,
            defaultsFor(b).fallbackHue,
          );
          assert.ok(
            distance >= 20,
            `${a} and ${b} both lead with ${direction} and sit ${distance.toFixed(0)}° apart`,
          );
        }
      }
    }
  });

  it('keeps every declared hue a plain number of degrees', () => {
    for (const industry of INDUSTRIES) {
      const hue = INDUSTRY_DEFAULTS[industry].fallbackHue;
      assert.ok(Number.isFinite(hue), `${industry} hue is not finite`);
      assert.ok(hue >= 0 && hue < 360, `${industry} hue ${hue} is outside 0–360`);
      assert.equal(hue, Math.round(hue), `${industry} hue ${hue} is not a whole degree`);
    }
  });

  it('meets its contrast targets for every industry on every direction', () => {
    for (const industry of INDUSTRIES) {
      for (const direction of DESIGN_DIRECTIONS) {
        const { semantic } = systemFor(industry, direction);
        const body = contrastHex(semantic.text, semantic.canvas);
        const muted = contrastHex(semantic.textMuted, semantic.canvas);
        const onBrand = contrastHex(semantic.onBrand, semantic.brand);

        assert.ok(body >= 4.5, `${industry}/${direction} body text ${body.toFixed(2)}:1`);
        assert.ok(muted >= 4.5, `${industry}/${direction} muted text ${muted.toFixed(2)}:1`);
        // The body target, not the 3:1 large-text one — a button label is
        // normal-sized type however large the block of colour behind it is.
        assert.ok(onBrand >= 4.5, `${industry}/${direction} text on brand ${onBrand.toFixed(2)}:1`);
      }
    }
  });

  it('gives every fill a foreground that clears the body target', () => {
    // `onAccent` and `onInverted` are the same promise as `onBrand` against the
    // other two blocks of colour a page paints.
    for (const industry of INDUSTRIES) {
      for (const direction of DESIGN_DIRECTIONS) {
        const { semantic } = systemFor(industry, direction);
        const onAccent = contrastHex(semantic.onAccent, semantic.accent);
        const onInverted = contrastHex(semantic.onInverted, semantic.inverted);

        assert.ok(onAccent >= 4.5, `${industry}/${direction} text on accent ${onAccent.toFixed(2)}:1`);
        assert.ok(onInverted >= 4.5, `${industry}/${direction} text on inverted ${onInverted.toFixed(2)}:1`);
      }
    }
  });

  it('keeps the brand legible as text, not only as a fill', () => {
    // The failure this pins: links and eyebrows take the brand colour, and a
    // colour tuned to carry a label on top of it measured ~3.4:1 as 14px type
    // on the page — under AA on every industry and every direction.
    for (const industry of INDUSTRIES) {
      for (const direction of DESIGN_DIRECTIONS) {
        const { semantic } = systemFor(industry, direction);
        // Every light ground the renderer paints text on, not just the
        // lightest — a link inside a card is the case that used to miss.
        for (const [name, ground] of [
          ['canvas', semantic.canvas],
          ['canvasSubtle', semantic.canvasSubtle],
          ['surface', semantic.surface],
        ] as const) {
          const ratio = contrastHex(semantic.brandText, ground);
          assert.ok(ratio >= 4.5, `${industry}/${direction} brand text ${ratio.toFixed(2)}:1 on ${name}`);
        }

        // It has to still read as the brand. A slot that resolved to the same
        // near-black as body copy would pass the contrast check and lose the
        // thing it exists for.
        const brandHue = hexToOklch(semantic.brand);
        const textHue = hexToOklch(semantic.brandText);
        assert.ok(brandHue !== null && textHue !== null);
        assert.ok(
          textHue.c >= 0.02,
          `${industry}/${direction} brand text went grey at chroma ${textHue.c.toFixed(3)}`,
        );
        assert.ok(
          hueDistance(brandHue.h, textHue.h) <= 12,
          `${industry}/${direction} brand text drifted ${hueDistance(brandHue.h, textHue.h).toFixed(0)}° off the brand hue`,
        );
      }
    }
  });

  it('is deterministic', () => {
    for (const industry of INDUSTRIES) {
      assert.deepEqual(systemFor(industry), systemFor(industry), industry);
    }
  });
});
