/**
 * The statement band and the facts rule, which are the two places the new
 * design vocabulary touches *content*.
 *
 * Both are where a page could most easily start lying. A band with room in it
 * is an invitation to write a strapline, and a sentence set at 90px is the most
 * prominent claim on the page. So the tests here are mostly about what must
 * *not* happen: nothing invented, nothing printed twice, and nothing enlarged
 * that was broken to begin with.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pullStatement, verifiedFacts } from '../../agents/writerAgent.js';

import type { BusinessProfile } from '../../lib/types.js';

/* ------------------------------------------------------------------ */
/* pullStatement                                                       */
/* ------------------------------------------------------------------ */

describe('pullStatement', () => {
  it('takes a sentence and removes it from the prose it came from', () => {
    const paragraphs = [
      'On the corner of 18th and Guerrero they spotted a baker sitting outside. He was ready to retire. It felt like fate.',
    ];
    const pulled = pullStatement(paragraphs);

    assert.ok(pulled !== null);
    assert.equal(pulled.statement, 'It felt like fate.');
    // The page must never print the same sentence twice.
    assert.ok(!pulled.remainder.join(' ').includes('It felt like fate.'));
    // What is left still begins where the author began.
    assert.ok(pulled.remainder[0]?.startsWith('On the corner'));
  });

  it('refuses a fragment that opens like a question and ends like a statement', () => {
    /*
     * The measured failure. Tartine's own about page carries "What made us we
     * make everyday." — a sentence that lost its middle in the CMS — and it
     * scored highest of every candidate because it is short and first person.
     * The first run set it at 90px across the middle of the page.
     */
    const paragraphs = [
      'What made us we make everyday. It is our job as bakers to make it count by making it good.',
    ];
    const pulled = pullStatement(paragraphs);

    assert.ok(pulled !== null);
    assert.notEqual(pulled.statement, 'What made us we make everyday.');
  });

  it('prefers the business speaking about itself', () => {
    // Both candidates sit at an edge, so the first-person bonus is what decides
    // between them rather than position.
    const paragraphs = [
      'The street has changed a great deal. It is a quiet corner now. We bake everything here every morning.',
    ];
    assert.equal(pullStatement(paragraphs)?.statement, 'We bake everything here every morning.');
  });

  it('never promotes a sentence carrying a figure', () => {
    // Prices, addresses and opening times are facts for a detail list. A fact
    // set at display size reads as a claim.
    const paragraphs = ['We open at 7am every day. Our bread is made by hand and nothing else.'];
    const pulled = pullStatement(paragraphs);
    assert.ok(pulled !== null);
    assert.ok(!/\d/.test(pulled.statement));
  });

  it('returns null rather than reaching for a weak sentence', () => {
    assert.equal(pullStatement([]), null);
    assert.equal(pullStatement(['One sentence only.']), null);
    // Everything present is either too short or too long to set large.
    assert.equal(pullStatement(['Hi. ' + 'x'.repeat(400) + '.']), null);
  });

  it('only ever takes a sentence from the edge of a paragraph', () => {
    const middle = 'First sentence here. We are the middle sentence. Last sentence here.';
    const pulled = pullStatement([middle]);
    assert.ok(pulled !== null);
    assert.notEqual(
      pulled.statement,
      'We are the middle sentence.',
      'lifting from the middle leaves a hole a reader can feel',
    );
  });
});

/* ------------------------------------------------------------------ */
/* verifiedFacts                                                       */
/* ------------------------------------------------------------------ */

function profile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  const sourced = <T>(value: T) => ({ value, source: 'maps' as const, sourceUrl: 'https://maps.test/', alternatives: [] });
  return {
    name: sourced('Test Business'),
    category: sourced('Bakery'),
    address: sourced({
      formatted: '1 Test St, Lisboa',
      street: '1 Test St',
      locality: 'Lisboa',
      region: null,
      postalCode: null,
      country: null,
    }),
    coordinates: null,
    website: null,
    phones: [],
    emails: [],
    socialProfiles: [],
    hours: [],
    rating: sourced(4.6),
    reviewCount: null,
    navigation: [],
    services: [],
    pages: [],
    attributes: [],
    description: null,
    reviews: [],
    images: { logo: null, favicon: null, hero: null, gallery: [] },
    sources: [],
    normalizedAt: '2026-01-01T00:00:00.000Z',
    validation: { valid: true, issues: [] },
    ...overrides,
  } as BusinessProfile;
}

describe('verifiedFacts', () => {
  it('states what the business is, where it is and how it is rated', () => {
    assert.deepEqual(verifiedFacts(profile()), ['Bakery', 'Lisboa', '4.6 on Google']);
  });

  it('does not promote a rating below four', () => {
    const low = verifiedFacts(profile({
      rating: { value: 3.2, source: 'maps', sourceUrl: 'https://maps.test/', alternatives: [] },
    } as Partial<BusinessProfile>));
    assert.ok(!low.some((fact) => fact.includes('3.2')));
  });

  it('never repeats the category as an offering', () => {
    const facts = verifiedFacts(profile({
      attributes: [
        { label: 'Bakery', group: 'Type', available: true, sourceUrl: 'https://maps.test/' },
        { label: 'Takeaway', group: 'Service', available: true, sourceUrl: 'https://maps.test/' },
      ],
    } as Partial<BusinessProfile>));

    assert.equal(facts.filter((fact) => fact.toLowerCase() === 'bakery').length, 1);
    assert.ok(facts.includes('Takeaway'));
  });

  it('never states something the listing says the business lacks', () => {
    const facts = verifiedFacts(profile({
      attributes: [
        { label: 'Outdoor seating', group: 'Amenity', available: false, sourceUrl: 'https://maps.test/' },
      ],
    } as Partial<BusinessProfile>));
    assert.ok(!facts.includes('Outdoor seating'));
  });

  it('stays short enough to scan', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      label: `Service ${String.fromCharCode(97 + i)}`,
      group: 'Service',
      available: true,
      sourceUrl: 'https://maps.test/',
    }));
    assert.ok(verifiedFacts(profile({ attributes: many } as Partial<BusinessProfile>)).length <= 8);
  });

  it('is empty for a business the pipeline knows nothing about', () => {
    const bare = verifiedFacts(profile({ category: null, address: null, rating: null } as Partial<BusinessProfile>));
    assert.deepEqual(bare, []);
  });
});
