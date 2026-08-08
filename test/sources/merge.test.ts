/**
 * Merging what several sources said about one business.
 *
 * The interesting cases are all disagreements. Two sources that agree need no
 * policy; the tests below are the ones where a wrong resolution puts a claimed
 * amenity, a duplicated endorsement or a missing day on the page.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeHarvests } from '../../lib/sources/merge.js';
import { EMPTY_HARVEST, type ListingHarvest, type ListingReview } from '../../lib/sources/types.js';

function harvest(overrides: Partial<ListingHarvest>): ListingHarvest {
  return { ...EMPTY_HARVEST, ...overrides };
}

function review(text: string, authorName: string | null = 'Marta S.'): ListingReview {
  return {
    text,
    authorName,
    rating: 5,
    relativeTime: null,
    publishedAt: null,
    sourceUrl: 'https://maps.google.com/review/1',
  };
}

describe('mergeHarvests', () => {
  it('is empty for no sources at all', () => {
    // A business whose every source failed is a thin profile, never an error.
    assert.deepEqual(mergeHarvests([]), EMPTY_HARVEST);
  });

  it('lets the more authoritative source settle a contradicted attribute', () => {
    // The API states accessibility as a boolean; the pane infers it from label
    // text. Rendering both would put "Wheelchair-accessible entrance" on the
    // page twice, once claimed and once denied.
    const merged = mergeHarvests([
      harvest({
        attributes: [{ group: 'Accessibility', label: 'Step-free entrance', available: false, sourceUrl: 'api' }],
      }),
      harvest({
        attributes: [{ group: 'Accessibility', label: 'Step-free entrance', available: true, sourceUrl: 'pane' }],
      }),
    ]);

    assert.equal(merged.attributes.length, 1);
    assert.equal(merged.attributes[0]?.available, false);
  });

  it('keeps an attribute only one source knows about', () => {
    // Authority is per field, not per source: answering first about access must
    // not cost the amenity list the other source alone carries.
    const merged = mergeHarvests([
      harvest({ attributes: [{ group: 'Accessibility', label: 'Step-free entrance', available: true, sourceUrl: 'api' }] }),
      harvest({ attributes: [{ group: 'Amenities', label: 'Free Wi-Fi', available: true, sourceUrl: 'pane' }] }),
    ]);

    assert.equal(merged.attributes.length, 2);
  });

  it('unions hours by day rather than picking one list', () => {
    // The seven-day trust signal depends on this: no single source has ever
    // supplied seven days.
    const merged = mergeHarvests([
      harvest({ hours: [{ dayOfWeek: 1, opens: '08:00', closes: '17:00' }] }),
      harvest({
        hours: [
          { dayOfWeek: 1, opens: '09:00', closes: '16:00' },
          { dayOfWeek: 6, opens: '10:00', closes: '14:00' },
        ],
      }),
    ]);

    assert.equal(merged.hours.length, 2);
    // Monday came from the first source, which is the authoritative one.
    assert.equal(merged.hours[0]?.opens, '08:00');
    assert.equal(merged.hours[1]?.dayOfWeek, 6);
  });

  it('shows one endorsement once, however many sources carried it', () => {
    // A repeated quotation is the most obvious way for a testimonial wall to
    // look fabricated, so the key is the words rather than the author.
    const merged = mergeHarvests([
      harvest({ reviews: [review('The tarts are worth the wait.')] }),
      harvest({ reviews: [review('  the tarts are WORTH the wait.  ', 'M. S.')] }),
    ]);

    assert.equal(merged.reviews.length, 1);
  });

  it('does not let a source that knows nothing outrank one that answered', () => {
    // `null` means "did not know", which is not "said no".
    const merged = mergeHarvests([
      harvest({ rating: null, reviewCount: null, description: null }),
      harvest({ rating: 4.7, reviewCount: 812, description: 'A Lisbon bakery.' }),
    ]);

    assert.equal(merged.rating, 4.7);
    assert.equal(merged.reviewCount, 812);
    assert.equal(merged.description, 'A Lisbon bakery.');
  });

  it('collects provenance from every source that contributed', () => {
    const merged = mergeHarvests([harvest({ sources: ['a'] }), harvest({ sources: ['a', 'b'] })]);
    assert.deepEqual(merged.sources, ['a', 'b']);
  });
});
