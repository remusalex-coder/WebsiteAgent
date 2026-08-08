/**
 * Layouts that need media, and what happens when there is none.
 *
 * Both of these were found by looking at a rendered page rather than by any
 * assertion, which is why they now have assertions.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeDesign } from '../../lib/design/index.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent } from '../fixtures/content.js';

import type { WebsiteContent, WebsiteSection } from '../../lib/types.js';

/** A long text section carrying no photograph — the shape that broke. */
const TEXT_ONLY_ABOUT: WebsiteSection = {
  kind: 'about',
  heading: 'About Hotel Union Square',
  subheading: null,
  body:
    'Sleek rooms offer free Wi-Fi, 32-inch flat-screen TVs, and ceiling fans. Upgraded rooms add ' +
    'lounge chairs, iPod docks, rainfall showerheads and coffeemakers. Some have soaking tubs; ' +
    'others have desks. Suites feature exposed brick walls and pull-out sofas.',
  bullets: [],
  images: [],
  callToAction: null,
};

const CONTENT: WebsiteContent = {
  ...fullContent,
  sections: [
    { kind: 'hero', heading: 'A hotel', subheading: null, body: 'Somewhere to stay.', bullets: [], images: [], callToAction: null },
    TEXT_ONLY_ABOUT,
  ],
};

describe('a media layout is never chosen without media', () => {
  it('gives a text-only section an editorial layout, not a split', () => {
    // `split` used to accept `bodyChars >= 120` with no image, and the renderer
    // then filled half the row with `imagery.fallback` — a teal gradient panel
    // the size of the copy, which reads as a broken image.
    const design = composeDesign({
      profile: profileFixture(),
      strategy: strategyFixture(),
      content: CONTENT,
    });

    const about = design.layout.sections.find((section) => section.kind === 'about');
    assert.notEqual(about?.variant, 'split');
    assert.equal(about?.variant, 'editorial');
  });
});

describe('the design layer without a strategy', () => {
  it('classifies from the profile when no strategy is supplied', () => {
    // Requiring a whole BusinessStrategy for the two category strings the layer
    // reads made design unreachable without a model call, and a page shipped
    // with the design layer switched off entirely.
    const design = composeDesign({
      profile: profileFixture({ category: '3-star hotel' }),
      content: CONTENT,
    });

    assert.equal(design.industry.id, 'hotel');
    assert.equal(design.industry.basis, 'listing');
  });

  it('agrees with the strategy path when both name the same trade', () => {
    const profile = profileFixture({ category: 'Bakery' });
    const withStrategy = composeDesign({ profile, strategy: strategyFixture(), content: CONTENT });
    const without = composeDesign({ profile, content: CONTENT });

    assert.equal(without.industry.id, withStrategy.industry.id);
  });

  it('still produces a design for a business with no category at all', () => {
    const design = composeDesign({ profile: profileFixture({ category: null }), content: CONTENT });
    assert.ok(design.layout.sections.length > 0);
  });
});
