/**
 * The Maps listing read as a content source.
 *
 * These cover the three decisions that would silently produce a *wrong* website
 * rather than a thin one: mistaking a reviewer's avatar for the shopfront,
 * serving a thumbnail where the original was free, and — the expensive one —
 * reading "Pool unavailable" as a swimming pool.
 *
 * Every string here was taken from a live pane during the probe that preceded
 * the module, not invented to match the implementation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isListingPhoto, parseAttributeLabel, upgradePhotoUrl } from '../../lib/sources/mapsListing.js';

/** The benchmark dentist's listing photograph, as the pane served it. */
const PHOTO =
  'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWkULd_UsXWRO0H8lzO_hWGmb247XTATDcugZ5fO9vDVIHO86Q22TCWThC72o1MDCHxYNiYo2Yy78Et6gsLeu4TzGukYtkBWZAOEEkLKA0ljKt6YQ';

describe('upgradePhotoUrl', () => {
  it('asks for the original instead of the rendered thumbnail', () => {
    // Measured live: this rewrite took the same photograph from 45 KB at 408px
    // to 188 KB at its native 1500px.
    assert.equal(upgradePhotoUrl(`${PHOTO}=w408-h306-k-no`), `${PHOTO}=w1600-h1200-k-no`);
  });

  it('replaces every size directive form Maps emits', () => {
    assert.equal(upgradePhotoUrl(`${PHOTO}=s48-p-k-no-mo`), `${PHOTO}=w1600-h1200-k-no`);
    assert.equal(upgradePhotoUrl(`${PHOTO}=w32-h32-p-k-no`), `${PHOTO}=w1600-h1200-k-no`);
  });

  it('leaves a URL with no size directive alone', () => {
    // Appending one would break a link that currently works, and a served
    // thumbnail beats a broken original.
    assert.equal(upgradePhotoUrl(PHOTO), PHOTO);
  });

  it('never touches a URL that is not Google-served', () => {
    const foreign = 'https://example.test/photo.jpg=w100';
    assert.equal(upgradePhotoUrl(foreign), foreign);
  });
});

describe('isListingPhoto', () => {
  it('accepts business photography', () => {
    assert.equal(isListingPhoto(`${PHOTO}=w408-h306-k-no`, 408), true);
  });

  it('rejects a reviewer avatar served from the same host', () => {
    // `/a-/` is Google's account-avatar namespace; without this the generated
    // gallery fills with the faces of people who left reviews.
    assert.equal(
      isListingPhoto('https://lh3.googleusercontent.com/a-/ALV-UjU0RcZUjLouc3XOv1VKHILRRq1sQVm9=s48-p-k-no-mo', 48),
      false,
    );
  });

  it('rejects an icon-sized image', () => {
    assert.equal(isListingPhoto(`${PHOTO}=w32-h32-p-k-no`, 32), false);
  });

  it('rejects anything not served by Google', () => {
    assert.equal(isListingPhoto('https://example.test/logo.png', 800), false);
    assert.equal(isListingPhoto('data:image/png;base64,iVBORw0KGgo=', 800), false);
  });

  it('accepts a photo whose intrinsic size the pane never reported', () => {
    // A lazy image has no `naturalWidth` yet. Dropping it would lose real
    // photography to a timing accident.
    assert.equal(isListingPhoto(`${PHOTO}=w408-h306-k-no`, null), true);
  });
});

describe('parseAttributeLabel', () => {
  it('reads an available amenity', () => {
    assert.deepEqual(parseAttributeLabel('Free Wi-Fi available'), { label: 'Free Wi-Fi', available: true });
  });

  /*
   * Observed on River Park Events (run 77c15289), not invented: every available
   * chip's accessible name begins with `U+E5CA`, the Material Icons tick. It is
   * a Private Use Area codepoint, so it has no glyph in any font the generated
   * site ships — it reached the published page as a tofu box in front of
   * "Wheelchair-accessible entrance", in the hero marquee and on every service
   * card.
   */
  it('strips the Material Icons glyph Maps prefixes the label with', () => {
    const tick = String.fromCharCode(0xe5ca);
    assert.deepEqual(
      parseAttributeLabel(`${tick}Wheelchair-accessible entrance`),
      { label: 'Wheelchair-accessible entrance', available: true },
    );
  });

  it('strips any private-use glyph, not just the one observed', () => {
    for (const code of [0xe000, 0xe5ca, 0xf8ff]) {
      const parsed = parseAttributeLabel(`${String.fromCharCode(code)} Free parking available`);
      assert.deepEqual(parsed, { label: 'Free parking', available: true },
        `U+${code.toString(16).toUpperCase()} survived`);
    }
  });

  it('leaves ordinary non-ASCII alone', () => {
    // Drăgășani is not a rendering bug.
    assert.deepEqual(
      parseAttributeLabel('Terasă în grădină available'),
      { label: 'Terasă în grădină', available: true },
    );
  });

  it('reads an absent one as absent', () => {
    // The whole point of the type. "Pool unavailable" read as a label would
    // put a swimming pool on the website of a hotel that has none.
    assert.deepEqual(parseAttributeLabel('Pool unavailable'), { label: 'Pool', available: false });
    assert.deepEqual(parseAttributeLabel('Airport shuttle unavailable'), {
      label: 'Airport shuttle',
      available: false,
    });
  });

  it('does not mistake "unavailable" for "available" inside the label', () => {
    // `available` is a suffix of `unavailable`; a naive endsWith gets this
    // exactly backwards, which is the failure that matters most here.
    const parsed = parseAttributeLabel('Air-conditioned unavailable');
    assert.equal(parsed?.available, false);
    assert.equal(parsed?.label, 'Air-conditioned');
  });

  it('treats a bare label as stated rather than denied', () => {
    // Most categories render plain list items with no state suffix at all.
    assert.deepEqual(parseAttributeLabel('Wheelchair-accessible entrance'), {
      label: 'Wheelchair-accessible entrance',
      available: true,
    });
  });

  it('normalises the padding Maps puts in accessible names', () => {
    assert.deepEqual(parseAttributeLabel('  Free Wi-Fi   available '), {
      label: 'Free Wi-Fi',
      available: true,
    });
  });

  it('returns null for an empty name', () => {
    assert.equal(parseAttributeLabel('   '), null);
  });
});
