/**
 * The trust engine.
 *
 * Trust scored lowest of the eight quality dimensions on every benchmark site
 * while every profile already carried a rating, a category and an address —
 * they were simply never shown. These tests hold the two properties that make
 * showing them safe: a signal exists only when the profile proved it, and a
 * signal is never assembled from half a fact.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isMapsActionLabel } from '../../agents/discoveryAgent.js';
import { trustSignals } from '../../agents/writerAgent.js';
import { attributeFixture, profileFixture } from '../fixtures/business.js';

import type { OpeningHours } from '../../lib/types.js';

/** Opening times for each of the given weekdays. */
function week(days: readonly number[]): OpeningHours[] {
  return days.map((dayOfWeek) => ({ dayOfWeek, opens: '09:00', closes: '17:00' }));
}

describe('trustSignals', () => {
  it('leads with the rating, named to its source', () => {
    const signals = trustSignals(profileFixture({ rating: 4.9 }));
    assert.equal(signals[0]?.kind, 'rating');
    assert.equal(signals[0]?.label, '4.9 on Google');
  });

  it('states the review count once a source can supply one', () => {
    // A signed-out pane serves a rating with no total behind it, so this line
    // read "4.9 on Google" on every page the platform had ever produced.
    // "from 812 reviews" is the half that persuades.
    const signals = trustSignals(profileFixture({ rating: 4.9, reviewCount: 812 }));
    assert.equal(signals[0]?.label, '4.9 on Google from 812 reviews');
  });

  it('does not promote a below-average rating to the first screen', () => {
    // Suppresses a claim rather than making one: the true value still reaches
    // the JSON-LD, and Google shows it beside the page regardless. This decides
    // only what the business leads with.
    const signals = trustSignals(profileFixture({ rating: 3.8, reviewCount: 1284 }));
    assert.equal(
      signals.some((signal) => signal.kind === 'rating'),
      false,
    );
  });

  it('promotes a rating exactly on the threshold', () => {
    const signals = trustSignals(profileFixture({ rating: 4 }));
    assert.equal(signals[0]?.kind, 'rating');
  });

  it('is empty when the profile proved nothing', () => {
    // A short bar is the correct output for a thin listing. A padded one is not.
    assert.deepEqual(trustSignals(profileFixture({ category: null })), []);
  });

  it('needs both halves of the trade-and-town signal', () => {
    // "Dentist" reassures nobody and a town with no trade is not a claim about
    // the business at all, so neither half is shown alone.
    const noTown = trustSignals(profileFixture({ category: 'Dentist' }));
    assert.equal(noTown.some((signal) => signal.kind === 'category'), false);
  });

  it('claims seven-day opening only when seven days are known', () => {
    const partial = trustSignals(profileFixture({ category: null, rating: null }));
    assert.equal(partial.some((signal) => signal.kind === 'hours'), false);

    // A closed day produces no entry, so seven distinct days really does mean
    // open every day. The reduced Maps pane usually yields one, so this is rare.
    const full = profileFixture({ category: null });
    const sevenDays = { ...full, hours: week([0, 1, 2, 3, 4, 5, 6]) };
    assert.equal(trustSignals(sevenDays)[0]?.label, 'Open seven days a week');

    const sixDays = { ...full, hours: week([1, 2, 3, 4, 5, 6]) };
    assert.deepEqual(trustSignals(sixDays), []);
  });

  it('promotes an ownership credential but not an amenity', () => {
    const withCredential = trustSignals(
      profileFixture({
        category: null,
        attributes: [attributeFixture('Free Wi-Fi'), attributeFixture('Identifies as women-owned')],
      }),
    );
    assert.deepEqual(
      withCredential.map((signal) => signal.label),
      ['Identifies as women-owned'],
      'an amenity says what you get; a credential says who you are dealing with',
    );
  });

  it('never promotes a credential the listing marked absent', () => {
    const signals = trustSignals(
      profileFixture({
        category: null,
        attributes: [attributeFixture('Identifies as women-owned', false)],
      }),
    );
    assert.deepEqual(signals, []);
  });

  it('shows at most three, because a fourth is not read', () => {
    const profile = profileFixture({
      name: 'Test',
      category: 'Hotel',
      rating: 4.2,
      attributes: [attributeFixture('Family-owned')],
    });
    const crowded = {
      ...profile,
      address: {
        value: { formatted: '1 High St, Bath', street: '1 High St', locality: 'Bath', region: null, postalCode: null, country: null },
        source: 'maps' as const,
        sourceUrl: 'https://maps.test',
        alternatives: [],
      },
      hours: week([0, 1, 2, 3, 4, 5, 6]),
    };
    assert.equal(trustSignals(crowded).length, 3);
  });
});

describe('isMapsActionLabel', () => {
  it('rejects the control that became a hotel category', () => {
    // Both benchmark hotel runs produced the category "Add website", which
    // reached the profile, the schema.org type and the top of the rendered page
    // as "Add website in San Francisco".
    assert.equal(isMapsActionLabel('Add website'), true);
    assert.equal(isMapsActionLabel('Add hours'), true);
    assert.equal(isMapsActionLabel('Claim this business'), true);
    assert.equal(isMapsActionLabel('Suggest an edit'), true);
  });

  it('rejects a pane tab', () => {
    assert.equal(isMapsActionLabel('Overview'), true);
    assert.equal(isMapsActionLabel('Photos'), true);
  });

  it('accepts a real trade', () => {
    assert.equal(isMapsActionLabel('Dentist'), false);
    assert.equal(isMapsActionLabel('Californian restaurant'), false);
    assert.equal(isMapsActionLabel('3-star hotel'), false);
    // Starts with a rejected verb only as a substring, not as a word.
    assert.equal(isMapsActionLabel('Addiction counselor'), false);
  });
});
