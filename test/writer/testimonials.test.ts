/**
 * Testimonials, which the model is not allowed to write.
 *
 * Every other section is prose about a business; this one is a claim attributed
 * to a named human being. A fabricated quotation under a real person's name is
 * a fabricated endorsement published on a paying customer's website, and it is
 * unfixable after the fact.
 *
 * The prompt has forbidden it since the writer was built. These tests are about
 * the structural rule, which is the one that still holds when a model misreads
 * the brief or when someone edits the prompt in a hurry.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeBaseline, groundTestimonials, testimonialBullets } from '../../agents/writerAgent.js';
import type { DraftSection } from '../../agents/writerAgent.js';
import { profileFixture, reviewFixture } from '../fixtures/business.js';

const QUOTE = 'The custard tarts come out of the oven at eleven and they are worth the wait.';

function draftSection(overrides: Partial<DraftSection> = {}): DraftSection {
  return {
    kind: 'testimonials',
    heading: 'What our customers say',
    subheading: '',
    body: '',
    bullets: [],
    ctaLabel: '',
    ctaTarget: 'none',
    ...overrides,
  };
}

/** The failure this whole mechanism exists to prevent. */
const FABRICATED = '“Best bakery in Lisbon, hands down!” — Sarah Johnson';

describe('groundTestimonials', () => {
  it('discards a quotation the model invented and publishes a real one instead', () => {
    const warnings: string[] = [];
    const sections = groundTestimonials(
      [draftSection({ bullets: [FABRICATED] })],
      profileFixture({ reviews: [reviewFixture({ text: QUOTE, authorName: 'Marta S.' })] }),
      (message) => warnings.push(message),
    );

    const bullets = sections[0]?.bullets ?? [];
    assert.equal(bullets.length, 1);
    assert.equal(
      bullets[0]?.includes('Sarah Johnson'),
      false,
      'a name the model invented must never survive into the page',
    );
    assert.match(bullets[0] ?? '', /Marta S\./);
    assert.equal(warnings.length, 1, 'replacing invented copy must be reported, not silent');
  });

  it('removes the section entirely when the model invented the whole thing', () => {
    // No verified review exists, so there is nothing to replace the fabrication
    // with. The section goes; an invented endorsement never ships.
    const warnings: string[] = [];
    const sections = groundTestimonials(
      [draftSection({ bullets: [FABRICATED] }), draftSection({ kind: 'contact' })],
      profileFixture(),
      (message) => warnings.push(message),
    );

    assert.deepEqual(
      sections.map((section) => section.kind),
      ['contact'],
    );
    assert.equal(warnings.length, 1);
  });

  it('discards prose the model wrote around the quotations', () => {
    // "Our customers rave about our award-winning service" is a claim, and it
    // is exactly the kind that arrives attached to a testimonials section.
    const sections = groundTestimonials(
      [draftSection({ body: 'Our customers rave about our award-winning service.' })],
      profileFixture({ reviews: [reviewFixture({ text: QUOTE })] }),
      () => {},
    );

    assert.equal(sections[0]?.body, '');
  });

  it('keeps the heading, which is an editorial judgement and not a claim', () => {
    const sections = groundTestimonials(
      [draftSection({ heading: 'What the neighbourhood says' })],
      profileFixture({ reviews: [reviewFixture({ text: QUOTE })] }),
      () => {},
    );

    assert.equal(sections[0]?.heading, 'What the neighbourhood says');
  });

  it('leaves a page alone when there is neither a section nor a review', () => {
    const warnings: string[] = [];
    const sections = groundTestimonials(
      [draftSection({ kind: 'hero' })],
      profileFixture(),
      (message) => warnings.push(message),
    );

    assert.equal(sections.length, 1);
    assert.equal(warnings.length, 0);
  });
});

describe('testimonialBullets', () => {
  it('formats a review as the quote the renderer can split', () => {
    // The renderer parses `"…" — Name`. The typographic quotes are not
    // decoration: they guarantee the closing character the parser needs,
    // whatever punctuation the reviewer happened to end on.
    const [bullet] = testimonialBullets([reviewFixture({ text: QUOTE, authorName: 'Marta S.' })]);
    assert.equal(bullet, `“${QUOTE}” — Marta S.`);
  });

  it('attributes an anonymous review to its source rather than to nobody', () => {
    const [bullet] = testimonialBullets([reviewFixture({ authorName: null })]);
    assert.match(bullet ?? '', /— Google review$/);
  });

  it('strips a dash from a name so the quotation cannot be split in the wrong place', () => {
    // The renderer splits on the last em dash. A dash inside the attribution
    // would put half a sentence in the mouth of a name that is not there.
    const [bullet] = testimonialBullets([reviewFixture({ text: QUOTE, authorName: 'Jean-Luc P.' })]);
    assert.equal(bullet, `“${QUOTE}” — Jean Luc P.`);
  });

  it('shows at most three, because a fourth reads as a wall rather than proof', () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      reviewFixture({ text: `${QUOTE} Number ${index}.` }),
    );
    assert.equal(testimonialBullets(many).length, 3);
  });
});

describe('testimonials in an assembled page', () => {
  it('renders a verified review, which no generated page did before', () => {
    // The renderer has drawn this section since the design layer landed, the
    // industry tables rank it above `about` for most industries, and until the
    // Places API no run had ever filled it.
    const content = composeBaseline(
      profileFixture({ description: 'A Lisbon bakery.', reviews: [reviewFixture({ text: QUOTE })] }),
    );

    const section = content.sections.find((entry) => entry.kind === 'testimonials');
    assert.ok(section, 'a profile carrying a review should produce a testimonials section');
    assert.equal(section?.bullets.length, 1);
    assert.match(section?.bullets[0] ?? '', /worth the wait/);
  });

  it('emits no testimonials section when nothing can be quoted', () => {
    // The normal case for every source the platform had before the Places API.
    // An empty testimonials section is worse than none.
    const content = composeBaseline(profileFixture({ description: 'A Lisbon bakery.' }));
    assert.equal(
      content.sections.some((entry) => entry.kind === 'testimonials'),
      false,
    );
  });

  it('places proof before the page asks the visitor to act', () => {
    const content = composeBaseline(
      profileFixture({ description: 'A Lisbon bakery.', reviews: [reviewFixture({ text: QUOTE })] }),
    );

    const kinds = content.sections.map((entry) => entry.kind);
    const testimonials = kinds.indexOf('testimonials');
    const contact = kinds.indexOf('contact');

    assert.notEqual(testimonials, -1);
    if (contact !== -1) assert.ok(testimonials < contact, 'testimonials should precede contact');
  });

  it('quotes only the words a source proved, however many exist', () => {
    const content = composeBaseline(
      profileFixture({
        description: 'A Lisbon bakery.',
        reviews: [
          reviewFixture({ text: QUOTE, authorName: 'Marta S.' }),
          reviewFixture({ text: 'A second considered sentence about the bakery.', authorName: 'Nuno' }),
        ],
      }),
    );

    const section = content.sections.find((entry) => entry.kind === 'testimonials');
    for (const bullet of section?.bullets ?? []) {
      assert.match(bullet, /^“.+” — .+$/, 'every bullet must be an attributed quotation');
    }
    assert.equal(section?.bullets.length, 2);
  });
});
