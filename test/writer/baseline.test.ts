/**
 * The baseline composer.
 *
 * It exists so that a business which has been collected always has a page, even
 * with no provider. Its whole claim is that nothing on that page was written —
 * so these tests are about what it refuses to say.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeBaseline } from '../../agents/writerAgent.js';
import { attributeFixture, profileFixture } from '../fixtures/business.js';

const DESCRIPTION =
  'Built in 1913, this boutique hotel is a 5-minute walk from Union Square. Sleek rooms offer free Wi-Fi and ceiling fans.';

describe('composeBaseline', () => {
  it('needs no model, no strategy and no network', () => {
    const content = composeBaseline(profileFixture({ description: DESCRIPTION }));
    assert.ok(content.sections.length > 0);
    assert.equal(content.businessName, 'Padaria Ana');
  });

  it('splits the description rather than printing it twice', () => {
    const content = composeBaseline(
      profileFixture({ category: '3-star hotel', description: DESCRIPTION }),
    );
    const hero = content.sections.find((section) => section.kind === 'hero');
    const about = content.sections.find((section) => section.kind === 'about');

    assert.match(hero?.body ?? '', /^Built in 1913/);
    assert.match(about?.body ?? '', /^Sleek rooms/);
    assert.equal(
      about?.body.includes('Built in 1913'),
      false,
      'the lead sentence belongs to the hero and must not repeat in about',
    );
  });

  it('never states an attribute the listing marked absent', () => {
    const content = composeBaseline(
      profileFixture({
        attributes: [attributeFixture('Free Wi-Fi'), attributeFixture('Pool', false)],
      }),
    );
    const page = JSON.stringify(content);
    assert.ok(page.includes('Free Wi-Fi'));
    assert.equal(page.includes('Pool'), false, 'an absent amenity must not reach the page at all');
  });

  it('does not offer the category back as an amenity', () => {
    // The benchmark hotel rendered a "3-star hotel" card under "what this place
    // offers", because the normalizer promotes that attribute to the category.
    const content = composeBaseline(
      profileFixture({
        category: '3-star hotel',
        attributes: [attributeFixture('3-star hotel', true, 'General'), attributeFixture('Parking')],
      }),
    );
    const offers = content.sections.find((section) => section.kind === 'services');
    assert.deepEqual(offers?.bullets, ['Parking']);
  });

  it('drops a trust signal the hero headline already says', () => {
    // Eyebrow, headline and trust bar all read "3-star hotel in San Francisco"
    // in the first screen before this.
    const profile = profileFixture({ category: '3-star hotel', rating: 3.8 });
    const withTown = {
      ...profile,
      address: {
        value: {
          formatted: '114 Powell St, San Francisco',
          street: '114 Powell St',
          locality: 'San Francisco',
          region: null,
          postalCode: null,
          country: null,
        },
        source: 'maps' as const,
        sourceUrl: 'https://maps.test',
        alternatives: [],
      },
    };

    const content = composeBaseline(withTown);
    assert.deepEqual(
      content.trust.map((signal) => signal.kind),
      ['rating'],
      'the category signal repeats the headline and is dropped; the rating is new information',
    );
  });

  it('says plainly that nothing was written', () => {
    const content = composeBaseline(profileFixture());
    assert.match(content.unresolvedGaps.join(' '), /composed from verified data only/);
  });

  it('produces a page even for a profile that proved almost nothing', () => {
    // WVBR LLP: no website, no hours, no rating, no photos, no description.
    const content = composeBaseline(profileFixture({ category: null, description: null }));
    assert.ok(content.sections.some((section) => section.kind === 'hero'));
    assert.ok(
      content.unresolvedGaps.some((gap) => gap.includes('No description')),
      'the gap list is what turns a thin page into a question for the owner',
    );
  });
});
