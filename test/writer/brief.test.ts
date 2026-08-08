/**
 * What the writer is told.
 *
 * The brief is the whole contract between the profile and the model: a fact
 * that does not reach it cannot appear on the page, and a fact that reaches it
 * without its qualifier will. These tests exist because the second half of that
 * sentence is how a hotel with no swimming pool gets a swimming pool.
 *
 * `buildWriterBrief` is a pure function, so this is verifiable without a model
 * call — which matters, because the model stages need a provider key and these
 * guarantees should not.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildWriterBrief, contactBullets, ratingLine } from '../../agents/writerAgent.js';
import { attributeFixture, profileFixture, strategyFixture } from '../fixtures/business.js';

const LIMIT = 4_000;

describe('buildWriterBrief', () => {
  it('carries the listing description through verbatim', () => {
    // For a business with no website this is the only prose in existence. The
    // benchmark hotel's opening line, as the listing published it.
    const description = 'Built in 1913, this boutique hotel is a 5-minute walk from Union Square.';
    const brief = buildWriterBrief(
      profileFixture({ description }),
      strategyFixture(),
      LIMIT,
    );

    assert.match(brief, /How Google describes this business/);
    assert.ok(brief.includes(description), 'the description must not be summarised on the way in');
  });

  it('marks an unavailable attribute as unusable rather than omitting it', () => {
    // Omitting it would leave the model unable to tell "not listed" from
    // "listed as absent", and only one of those is safe to write around.
    const brief = buildWriterBrief(
      profileFixture({
        attributes: [attributeFixture('Free Wi-Fi'), attributeFixture('Pool', false)],
      }),
      strategyFixture(),
      LIMIT,
    );

    assert.match(brief, /Confirmed on the Google listing/);
    assert.match(brief, /- Free Wi-Fi \(Amenities\)/);
    assert.match(brief, /- Pool — NOT available, never mention this/);
  });

  it('says so plainly when there is nothing to state', () => {
    const brief = buildWriterBrief(profileFixture(), strategyFixture(), LIMIT);
    const heading = brief.indexOf('## Confirmed on the Google listing');

    assert.notEqual(heading, -1);
    assert.match(brief.slice(heading), /^## Confirmed on the Google listing\nnone found/);
  });
});

describe('ratingLine', () => {
  it('names the source, because a rating from nowhere is a claim', () => {
    assert.equal(ratingLine(profileFixture({ rating: 4.9 })), '4.9 on Google');
  });

  it('includes the review count when the listing gave one', () => {
    assert.equal(
      ratingLine(profileFixture({ rating: 4.5, reviewCount: 1_284 })),
      '4.5 on Google from 1284 reviews',
    );
  });

  it('does not print a lone review as plural', () => {
    assert.equal(ratingLine(profileFixture({ rating: 5, reviewCount: 1 })), '5 on Google from 1 review');
  });

  it('is absent for a listing with no rating', () => {
    assert.equal(ratingLine(profileFixture()), null);
  });
});

describe('contactBullets', () => {
  it('shows the rating, which no generated page did before', () => {
    // Every benchmark profile carried a rating and none rendered it; trust
    // scored lowest of the eight dimensions on all five sites.
    const bullets = contactBullets(profileFixture({ rating: 3.8 }));
    assert.ok(bullets.includes('Rating — 3.8 on Google'));
  });

  it('omits the row entirely when there is no rating to show', () => {
    const bullets = contactBullets(profileFixture());
    assert.equal(bullets.some((bullet) => bullet.startsWith('Rating')), false);
  });
});
