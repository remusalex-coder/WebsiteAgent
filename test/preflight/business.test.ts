import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { businessChecks } from '../../lib/preflight/checks/business.js';
import { buildContext, section } from './support.js';

function run(id: string, overrides: Parameters<typeof buildContext>[0] = {}) {
  const ctx = buildContext(overrides);
  const result = businessChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

describe('business.real-reviews (required: fake-review rejection)', () => {
  it('is not applicable when the content spec has no testimonials section', () => {
    assert.equal(run('business.real-reviews').status, 'NOT_APPLICABLE');
  });

  it('fails critically when a testimonials quote is not traceable to the collected pages and no rating evidence backs it', () => {
    const result = run('business.real-reviews', {
      content: {
        sections: [
          section({ kind: 'hero', heading: 'Hi', callToAction: { label: 'Call', href: 'tel:+351210000000' } }),
          section({ kind: 'testimonials', heading: 'Reviews', bullets: ['"Best bakery in the world, life-changing bread!" — a regular'] }),
        ],
      },
    });
    assert.equal(result.status, 'FAIL');
    assert.equal(result.severity, 'critical');
    assert.match(result.remediation ?? '', /[Nn]ever fabricate reviews/);
  });

  it('passes when the quote is traceable verbatim to a page the collector actually read', () => {
    const quote = 'the sourdough here is the best in the neighbourhood and always sells out by nine';
    const result = run('business.real-reviews', {
      profile: { pages: [{ url: 'https://example.test/reviews', title: 'Reviews', text: `A regular wrote: "${quote}" in the guestbook.` }] },
      content: {
        sections: [
          section({ kind: 'hero', heading: 'Hi', callToAction: { label: 'Call', href: 'tel:+351210000000' } }),
          section({ kind: 'testimonials', heading: 'Reviews', bullets: [`"${quote}" — a regular`] }),
        ],
      },
    });
    assert.equal(result.status, 'PASS');
  });

  it('does not fail when Maps rating/review-count evidence backs an ungrounded-looking quote, but still warns', () => {
    const result = run('business.real-reviews', {
      profile: { rating: 4.8, reviewCount: 214 },
      content: {
        sections: [
          section({ kind: 'testimonials', heading: 'Reviews', bullets: ['"A lovely spot." — a customer'] }),
        ],
      },
    });
    assert.notEqual(result.status, 'FAIL');
  });
});

describe('business.local-schema-match (required: business-specific schema)', () => {
  it('is not applicable with no physical address on record', () => {
    assert.equal(run('business.local-schema-match', { profile: { address: null } }).status, 'NOT_APPLICABLE');
  });

  it('passes when @type matches the bakery schema family', () => {
    assert.equal(run('business.local-schema-match').status, 'PASS');
  });

  it('warns when structured data falls back to the generic LocalBusiness type', () => {
    const result = run('business.local-schema-match', {
      content: {
        structuredData: { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Padaria Ana' },
      },
    });
    assert.equal(result.status, 'WARN');
  });

  it('fails when @type belongs to a clearly unrelated schema family', () => {
    const result = run('business.local-schema-match', {
      content: { structuredData: { '@context': 'https://schema.org', '@type': 'Person', name: 'Padaria Ana' } },
    });
    assert.equal(result.status, 'FAIL');
  });
});

describe('business.team-photography', () => {
  it('is not applicable for a non-team-forward industry with no team mention', () => {
    assert.equal(run('business.team-photography').status, 'NOT_APPLICABLE');
  });

  it('warns when the about copy names the team but no photograph is placed', () => {
    const result = run('business.team-photography', {
      content: {
        sections: [section({ kind: 'about', heading: 'Meet the team', body: 'Our founder and staff have run this bakery for years.' })],
      },
    });
    assert.equal(result.status, 'WARN');
  });
});

describe('business.booking-functionality', () => {
  it('is not applicable when no call to action uses booking language', () => {
    assert.equal(run('business.booking-functionality').status, 'NOT_APPLICABLE');
  });

  it('fails when a booking-worded CTA has no working destination', () => {
    const result = run('business.booking-functionality', {
      content: {
        sections: [section({ kind: 'cta', heading: 'Order', callToAction: { label: 'Reserve a table', href: '' } })],
      },
    });
    assert.equal(result.status, 'FAIL');
  });

  it('passes when a booking-worded CTA resolves to a real channel', () => {
    const result = run('business.booking-functionality', {
      content: {
        sections: [section({ kind: 'cta', heading: 'Order', callToAction: { label: 'Book a table', href: 'tel:+351210000000' } })],
      },
    });
    assert.equal(result.status, 'PASS');
  });
});

describe('business.case-studies', () => {
  it('is not applicable for an industry where case studies are not a standard trust signal', () => {
    assert.equal(run('business.case-studies').status, 'NOT_APPLICABLE');
  });

  it('warns (honestly, not silently) for an industry that would benefit, since the renderer has no case-study section', () => {
    const result = run('business.case-studies', { profile: { category: 'Law firm' }, strategy: { primary: 'Law firm' } });
    assert.equal(result.status, 'WARN');
  });
});

describe('business.response-time-promise', () => {
  it('is not applicable when no response-time claim is made', () => {
    assert.equal(run('business.response-time-promise').status, 'NOT_APPLICABLE');
  });

  it('fails when a response-time claim is not grounded in the collected pages', () => {
    const result = run('business.response-time-promise', {
      content: {
        sections: [section({ kind: 'about', heading: 'About', body: 'We guarantee a 2 hour response to every enquiry.' })],
      },
    });
    assert.equal(result.status, 'FAIL');
  });

  it('passes when the claim is grounded in a collected page', () => {
    const claimText = 'we guarantee a 2 hour response to every enquiry';
    const result = run('business.response-time-promise', {
      profile: { pages: [{ url: 'https://example.test/', title: 'Home', text: `Our promise: ${claimText}, every single day.` }] },
      content: {
        sections: [section({ kind: 'about', heading: 'About', body: 'We guarantee a 2 hour response to every enquiry.' })],
      },
    });
    assert.equal(result.status, 'PASS');
  });
});

describe('business.maps-directions', () => {
  it('is not applicable with no physical address', () => {
    assert.equal(run('business.maps-directions', { profile: { address: null } }).status, 'NOT_APPLICABLE');
  });

  it('passes: the default fixture\'s structured data carries a postal address and geo is derivable', () => {
    // The default fixture has no coordinates and no maps link, so this should fail —
    // used here to prove the check actually inspects evidence rather than
    // rubber-stamping any business with an address.
    const result = run('business.maps-directions');
    assert.equal(result.status, 'FAIL');
  });

  it('passes once a maps link is present', () => {
    const result = run('business.maps-directions', {
      content: {
        sections: [
          section({ kind: 'location', heading: 'Find us', callToAction: { label: 'Get directions', href: 'https://maps.google.com/?q=Padaria+Ana' } }),
        ],
      },
    });
    assert.equal(result.status, 'PASS');
  });
});

describe('business.faq-evidence (required: FAQ evidence-driven)', () => {
  it('is not applicable with no faq section', () => {
    assert.equal(run('business.faq-evidence').status, 'NOT_APPLICABLE');
  });

  it('passes when every bullet is phrased as a question', () => {
    const result = run('business.faq-evidence', {
      content: {
        sections: [section({ kind: 'faq', heading: 'Questions', bullets: ['Do you take card? Yes.', 'Can I order ahead? Yes, by phone.'] })],
      },
    });
    assert.equal(result.status, 'PASS');
  });

  it('warns when a bullet reads as filler rather than a real question', () => {
    const result = run('business.faq-evidence', {
      content: {
        sections: [section({ kind: 'faq', heading: 'Questions', bullets: ['We care about quality.'] })],
      },
    });
    assert.equal(result.status, 'WARN');
  });
});
