/**
 * The experience shifts its ground colour continuously as the visitor scrolls.
 * That is the one thing about the design most likely to quietly produce
 * unreadable text, and the one thing least likely to be noticed while building
 * it — every scene looks fine in isolation.
 *
 * So the ink/ground pairs are asserted rather than eyeballed.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { compose } from '../lib/experience/compose.js';

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(n >> 16 & 255)
    + 0.7152 * channel(n >> 8 & 255)
    + 0.0722 * channel(n & 255);
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A profile with only the fields the composer reads. */
const PROFILE: Record<string, unknown> = {
  name: { value: 'Test Bakery' },
  address: {
    value: {
      formatted: '1 Test St, Testville, CA', street: '1 Test St',
      locality: 'Testville', region: 'CA',
    },
  },
  phones: [{ value: { e164: '+14155550123' } }],
  emails: [{ value: 'hi@example.com' }],
  website: { value: 'https://example.com' },
  rating: { value: 4.5 },
  socialProfiles: [],
  hours: [{ dayOfWeek: 4, opens: '07:30', closes: '18:00' }],
};

const ASSETS = ['gallery-fougasse-x.jpg', 'gallery-baguettes-y.jpg', 'logo-test.svg'];

test('every scene sets body text at 4.5:1 or better against its ground', () => {
  const { scenes } = compose({ profile: PROFILE, assetFiles: ASSETS });
  for (const scene of scenes) {
    const { base, ink, inkDim } = scene.ground;
    assert.ok(
      ratio(ink, base) >= 4.5,
      `${scene.id}: ink ${ink} on ${base} is ${ratio(ink, base).toFixed(2)}:1`,
    );
    assert.ok(
      ratio(inkDim, base) >= 4.5,
      `${scene.id}: dimmed ink ${inkDim} on ${base} is ${ratio(inkDim, base).toFixed(2)}:1`,
    );
  }
});

test('the accent reaches 3:1 against its ground, as a non-text signal', () => {
  const { scenes } = compose({ profile: PROFILE, assetFiles: ASSETS });
  for (const scene of scenes) {
    const { base, ember } = scene.ground;
    assert.ok(
      ratio(ember, base) >= 3,
      `${scene.id}: ember ${ember} on ${base} is ${ratio(ember, base).toFixed(2)}:1`,
    );
  }
});

test('the night-to-day flip is a transition no text is visible during', () => {
  // Blending night ink into day ink over a day ground passes through grey on
  // grey — the midpoint of rack → doors is about 1.05:1. The design's answer is
  // not to avoid the crossing but to make it happen while both scenes' copy is
  // at zero opacity, which is why the runtime blends grounds inside a narrow
  // band at the scene boundary instead of centre-to-centre.
  //
  // That coupling between opacity and colour cannot be asserted from the scene
  // model alone; `scripts/verify-experience.mjs` measures it in a real browser
  // by sampling computed colours against computed opacity while scrolling. What
  // this test pins down is the precondition: a crossing this severe exists, so
  // the band behaviour is load-bearing and must not be "simplified" away.
  const { scenes } = compose({ profile: PROFILE, assetFiles: ASSETS });
  const rack = scenes.find((s) => s.id === 'rack');
  const doors = scenes.find((s) => s.id === 'doors');
  assert.ok(rack !== undefined && doors !== undefined);

  assert.ok(luminance(rack.ground.base) < 0.1, 'rack should be a night ground');
  assert.ok(luminance(doors.ground.base) > 0.6, 'doors should be a daylight ground');
});

test('only verified opening hours reach the page', () => {
  const { practical } = compose({ profile: PROFILE, assetFiles: ASSETS });
  assert.equal(practical.hours.length, 1);
  assert.equal(practical.hours[0]?.day, 'Thursday');
  // One verified day is not a week, and the page has to say so.
  assert.notEqual(practical.hoursCaveat, null);
});

test('book covers and screenshots never enter the photography', () => {
  const { scenes } = compose({
    profile: PROFILE,
    assetFiles: [
      'gallery-ROBE_BreadBook_3D__1_.png',
      'gallery-Screenshot_2023.png',
      'gallery-Bread-on-amazon.jpg',
      'gallery-fougasse-ok.jpg',
    ],
  });
  const used = scenes.flatMap((s) => s.plates ?? []).map((p) => p.src);
  for (const src of used) {
    assert.match(src, /fougasse/, `product shot leaked into the page: ${src}`);
  }
});
