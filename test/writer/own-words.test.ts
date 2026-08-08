/**
 * The business's own words, and the photographs that are actually its own.
 *
 * Both defects here were found by looking at one generated page. Zuni Café —
 * five crawled pages, a James Beard award, a history page opening on "a huge
 * heart and exactly ten thousand dollars" — composed to a **47-word** site
 * whose gallery led with a domestic-violence crisis-hotline poster.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  composeBaseline,
  isUsablePhotograph,
  narrativeFrom,
  placeMidPageCta,
  publishableParagraphs,
} from '../../agents/writerAgent.js';
import { profileFixture } from '../fixtures/business.js';

import type { DraftSection } from '../../agents/writerAgent.js';
import type { ImageAsset, PageText } from '../../lib/types.js';

const SOURCE = 'https://example.test';

function page(title: string, text: string, url = SOURCE): PageText {
  return { url, title, text };
}

function image(url: string, width = 1200, height = 800): ImageAsset {
  return { url, role: 'gallery', alt: null, width, height, localPath: null, bytes: null, sourceUrl: SOURCE };
}

/** Zuni's history page, as the crawler actually returned it. */
const HISTORY = [
  'About',
  'Menus',
  'Reservations',
  '1658 Market Street San Francisco, CA 94102 | 415-552-2522',
  'History',
  'Zuni Café was founded in 1979, by Billy West – “with a huge heart and exactly ten thousand dollars.” In its early days, the restaurant occupied only one narrow storefront of the triangular 1913 building it fills today. The dramatic corner storefront was home to the eye-catching Red Desert cactus store, with giant saguaros in the twelve-foot windows and sand on the floor.',
  'Nevertheless, the restaurant was an instant, improbable success; Elizabeth David herself became a repeat customer. By 1987, it was expanding into the rest of the building and displacing the cactus shop on the corner.',
].join('\n\n');

describe('publishableParagraphs', () => {
  it('keeps prose and drops the navigation around it', () => {
    const kept = publishableParagraphs(HISTORY);
    assert.equal(kept.length, 2);
    assert.match(kept[0] ?? '', /^Zuni Café was founded in 1979/);
  });

  it('drops the line carrying the address and phone number', () => {
    // It is a fact, and it belongs in the contact section. In prose it would
    // also trip the grounding check downstream.
    const kept = publishableParagraphs(HISTORY);
    assert.equal(kept.some((block) => block.includes('415-552-2522')), false);
  });

  it('drops cookie and legal boilerplate', () => {
    const text =
      'We use cookies to improve your experience on this website and to show you relevant advertising from our partners across the internet.';
    assert.deepEqual(publishableParagraphs(text), []);
  });

  it('drops a block with no sentence in it', () => {
    // A navigation row is long enough to pass a length test and is not prose.
    const nav = 'Home Menus Reservations Private Events Gift Certificates Careers Cookbook Contact Us Directions';
    assert.deepEqual(publishableParagraphs(nav), []);
  });
});

describe('narrativeFrom', () => {
  it('opens on the paragraph that names the business, not the first one', () => {
    // "Nevertheless, the restaurant was an instant, improbable success" is a
    // fine sentence and a terrible opening line: it answers an objection the
    // page never raised. This shipped.
    const narrative = narrativeFrom([page('History', HISTORY)], 'Zuni Café');
    assert.match(narrative?.lead ?? '', /^Zuni Café was founded in 1979/);
  });

  it('prefers a history page over whatever the homepage is promoting', () => {
    // Zuni's homepage led with a cannabis-edible collaboration: true,
    // published, and the wrong thing to open a restaurant's website with.
    const home = page(
      'Zuni Café',
      'For more than a year our chef had been encouraging the team at Rose Los Angeles to turn the signature margarita into a cannabis edible, and the timing finally lined up this spring.',
      'https://example.test/',
    );
    const history = page('History', HISTORY, 'https://example.test/history/');

    const narrative = narrativeFrom([home, history], 'Zuni Café');
    assert.equal(narrative?.sourceUrl, 'https://example.test/history/');
  });

  it('takes every paragraph from one page, never two', () => {
    // Paragraphs from two pages under one heading would be an edit — a claim
    // that these things belong together.
    const a = page('About', HISTORY, 'https://example.test/about/');
    const b = page('Careers', HISTORY, 'https://example.test/careers/');
    const narrative = narrativeFrom([a, b], 'Zuni Café');
    assert.equal(narrative?.sourceUrl, 'https://example.test/about/');
  });

  it('is null when a site has pages but no prose on any of them', () => {
    const narrative = narrativeFrom([page('Home', 'Menus\n\nBook a table\n\nCall us')], 'Zuni');
    assert.equal(narrative, null);
  });
});

describe('isUsablePhotograph', () => {
  it('rejects a social feed widget cache', () => {
    // The Smash Balloon Instagram plugin. Nine of Zuni's twelve gallery
    // photographs came from here, among them a crisis-hotline poster and a
    // bookshop's magazine rack, published as a restaurant's own imagery.
    assert.equal(
      isUsablePhotograph(image('http://zunicafe.com/wp-content/uploads/sb-instagram-feed-images/682430689.jpg', 640, 1136)),
      false,
    );
  });

  it('rejects an image served straight from a social CDN', () => {
    assert.equal(isUsablePhotograph(image('https://scontent.cdninstagram.com/v/t51/123.jpg')), false);
  });

  it('rejects accessibility and consent widget chrome', () => {
    assert.equal(isUsablePhotograph(image('https://cdn.userway.org/widgetapp/images/body_wh.svg', 400, 400)), false);
  });

  it('keeps the business\'s own photography on the same domain', () => {
    assert.equal(isUsablePhotograph(image('http://zunicafe.com/wp-content/uploads/hero2-1400x940.jpg', 1400, 940)), true);
  });
});

describe('a composed page', () => {
  it('speaks the business\'s own words when the listing has none', () => {
    const content = composeBaseline(profileFixture({ description: null, pages: [page('History', HISTORY)] }));
    const hero = content.sections.find((section) => section.kind === 'hero');
    const about = content.sections.find((section) => section.kind === 'about');

    assert.match(hero?.body ?? '', /Billy West/);
    assert.ok(about !== undefined, 'the remaining paragraphs should carry an about section');
  });

  it('prefers the listing description where there is one', () => {
    // Google writes it as a summary, so it opens a page well, and it is the
    // only prose that exists for a business with no website.
    const content = composeBaseline(
      profileFixture({ description: 'A neighbourhood bakery on Guerrero Street.', pages: [page('History', HISTORY)] }),
    );
    assert.match(content.sections[0]?.body ?? '', /neighbourhood bakery/);
  });

  it('closes on an invitation rather than a contact table', () => {
    const content = composeBaseline(
      profileFixture({ description: 'A neighbourhood bakery.', phone: '+1 (415) 552-2522' }),
    );
    const last = content.sections.at(-1);

    assert.equal(last?.kind, 'cta');
    assert.ok((last?.callToAction?.href ?? '') !== '', 'the closing section needs a working button');
  });

  it('does not invite an action the profile cannot support', () => {
    // profileFixture has no phone and no email, so there is nothing to close
    // on and a button would point nowhere.
    const content = composeBaseline(profileFixture());
    assert.equal(content.sections.some((section) => section.kind === 'cta'), false);
  });
});

describe('mid-page conversion', () => {
  /** A gallery is most of a long page's height, and carries no button of its own. */
  function longPage(): readonly DraftSection[] {
    return [
      { kind: 'hero', heading: 'H', subheading: '', body: '', bullets: [], ctaLabel: 'Call us', ctaTarget: 'phone' },
      { kind: 'gallery', heading: 'Photographs', subheading: '', body: '', bullets: [], ctaLabel: '', ctaTarget: 'none' },
      { kind: 'about', heading: 'About', subheading: '', body: 'x'.repeat(2000), bullets: [], ctaLabel: '', ctaTarget: 'none' },
      { kind: 'contact', heading: 'Contact', subheading: '', body: '', bullets: [], ctaLabel: 'Call us', ctaTarget: 'phone' },
    ];
  }

  const phone = { ctaLabel: 'Call us', ctaTarget: 'phone' as const };

  it('adds a button when the reader would scroll screens without one', () => {
    // Zuni Café: three calls to action on a 7.6-screen page, none of them in
    // the 3.2 screens of gallery a reader crosses to reach the second.
    const placed = placeMidPageCta(longPage(), phone, new Map([[1, 12]]), () => {});
    const carriers = placed.filter((section) => section.ctaTarget !== 'none');
    assert.equal(carriers.length, 3);
  });

  it('measures scroll, not sections', () => {
    // The same four sections, but with no photographs and a short about, is a
    // page a reader crosses in a screen and a half. Counting sections cannot
    // tell it apart from the gallery page above — which is exactly why the
    // first attempt at this rule changed nothing on the benchmark.
    const short = longPage().map((section) =>
      section.kind === 'about' ? { ...section, body: 'A short paragraph about the business.' } : section,
    );
    const placed = placeMidPageCta(short, phone, new Map(), () => {});
    assert.equal(placed.filter((section) => section.ctaTarget !== 'none').length, 2);
  });

  it('never puts one on a section that is the destination', () => {
    const placed = placeMidPageCta(longPage(), phone, new Map([[1, 12]]), () => {});
    const added = placed.find((section, index) => section.ctaTarget !== 'none' && index !== 0 && index !== 3);
    assert.ok(added !== undefined);
    assert.ok(['gallery', 'about'].includes(added.kind));
  });

  it('adds nothing when the profile supports no action', () => {
    const placed = placeMidPageCta(longPage(), { ctaLabel: '', ctaTarget: 'none' }, new Map([[1, 12]]), () => {});
    assert.deepEqual(placed, longPage());
  });

  it('stops well short of a button in every section', () => {
    // Restraint is the point: a page with a call to action everywhere reads as
    // a funnel rather than as a business.
    const huge = Array.from({ length: 12 }, (_, index) => ({
      kind: 'about' as const, heading: `H${index}`, subheading: '', body: 'x'.repeat(3000),
      bullets: [], ctaLabel: '', ctaTarget: 'none' as const,
    }));
    const placed = placeMidPageCta(huge, phone, new Map(), () => {});
    assert.equal(placed.filter((section) => section.ctaTarget !== 'none').length, 2);
  });
});
