/**
 * The Content Director.
 *
 * These tests assert *behaviour*, not that the module exists. The three that
 * matter most:
 *
 *   1. Direction never changes the page's structure or its facts.
 *   2. Direction never changes the narrative plan — no feedback loop.
 *   3. The same section kind is written differently for a different business,
 *      because the evidence and the beat differ.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { directContent } from '../../lib/content/director.js';
import { indexEvidence } from '../../lib/content/evidence.js';
import { planNarrative } from '../../lib/design/plan.js';
import { deriveCharacter } from '../../lib/design/character.js';
import { profileFrom, baselineFrom, VENUE, GARAGE, BAKERY } from './fixtures.js';

import type { SectionKind } from '../../lib/types.js';

const VENUE_KINDS: readonly SectionKind[] = ['hero', 'about', 'services', 'gallery', 'hours', 'contact', 'cta'];
const GARAGE_KINDS: readonly SectionKind[] = ['hero', 'about', 'services', 'hours', 'contact', 'cta'];
const BAKERY_KINDS: readonly SectionKind[] = ['hero', 'about', 'services', 'gallery', 'hours', 'contact', 'cta'];

function direct(spec: typeof VENUE, kinds: readonly SectionKind[]) {
  const profile = profileFrom(spec);
  const baseline = baselineFrom(spec, kinds);
  const plan = planNarrative(profile, baseline);
  const directed = directContent(profile, baseline, plan);
  return { profile, baseline, plan, directed };
}

const venue = direct(VENUE, VENUE_KINDS);
const garage = direct(GARAGE, GARAGE_KINDS);
const bakery = direct(BAKERY, BAKERY_KINDS);

const headingOf = (result: typeof venue, kind: SectionKind): string =>
  result.directed.content.sections.find((section) => section.kind === kind)?.heading ?? '';

describe('the director changes the words and nothing else', () => {
  for (const [name, result] of [['venue', venue], ['garage', garage], ['bakery', bakery]] as const) {
    test(`${name}: same sections, same kinds, same order`, () => {
      const before = result.baseline.sections.map((section) => section.kind);
      const after = result.directed.content.sections.map((section) => section.kind);
      assert.deepEqual(after, before);
    });

    test(`${name}: same images on the same sections`, () => {
      result.baseline.sections.forEach((section, index) => {
        const directedSection = result.directed.content.sections[index];
        assert.deepEqual(directedSection?.images, section.images, `section ${index} images changed`);
      });
    });

    test(`${name}: no call to action points anywhere new`, () => {
      result.baseline.sections.forEach((section, index) => {
        const after = result.directed.content.sections[index]?.callToAction ?? null;
        assert.equal(after?.href ?? null, section.callToAction?.href ?? null, `section ${index} href changed`);
      });
    });

    test(`${name}: the business's prose is never duplicated across the page`, () => {
      const seen = new Set<string>();
      for (const section of result.directed.content.sections) {
        for (const sentence of section.body.split(/(?<=[.!?])\s+/u)) {
          const key = sentence.trim().toLowerCase();
          if (key.length < 30) continue;
          assert.equal(seen.has(key), false, `printed twice: ${key.slice(0, 60)}`);
          seen.add(key);
        }
      }
    });
  }
});

describe('the director cannot feed its own copy back as evidence', () => {
  for (const [name, result] of [['venue', venue], ['garage', garage], ['bakery', bakery]] as const) {
    test(`${name}: the character is identical before and after direction`, () => {
      const ctx = { ground: 'warm' as const, imageReliance: 'essential' as const };
      const before = deriveCharacter(result.profile, result.baseline, ctx);
      const after = deriveCharacter(result.profile, result.directed.content, ctx);
      assert.deepEqual(after, before);
    });

    test(`${name}: the whole narrative plan is identical before and after direction`, () => {
      const before = result.plan;
      const after = planNarrative(result.profile, result.directed.content);
      assert.deepEqual(after.experience, before.experience);
      assert.deepEqual(after.conversion, before.conversion);
      assert.deepEqual(after.order, before.order);
      assert.deepEqual([...after.roles.entries()], [...before.roles.entries()]);
    });
  }
});

describe('the page is written in the language of the evidence', () => {
  test('a Romanian venue gets Romanian scaffolding and keeps its own words verbatim', () => {
    assert.equal(venue.directed.content.language, 'ro');
    assert.equal(headingOf(venue, 'hours'), 'Program');
    assert.equal(headingOf(venue, 'contact'), 'Contact');
    // Its own words, untranslated.
    const services = venue.directed.content.sections.find((s) => s.kind === 'services');
    assert.ok(services?.bullets[0]?.startsWith('Nunți'), services?.bullets[0]);
  });

  test('the contact captions are translated but the values are not', () => {
    const contact = venue.directed.content.sections.find((section) => section.kind === 'contact');
    assert.ok(contact?.bullets.some((bullet) => bullet.startsWith('Adresă — 1 Main Street')), contact?.bullets.join(' | '));
    assert.ok(contact?.bullets.some((bullet) => bullet.startsWith('Telefon — 0700 900 900')), contact?.bullets.join(' | '));
  });

  test('an English business is untouched by the language layer', () => {
    assert.equal(garage.directed.content.language, 'en');
    const contact = garage.directed.content.sections.find((section) => section.kind === 'contact');
    assert.ok(contact?.bullets.some((bullet) => bullet.startsWith('Address — ')), contact?.bullets.join(' | '));
  });
});

describe('the heading is decided by the beat, not by the section kind', () => {
  test('a hero states the trade in the business\'s own words where it published them', () => {
    // "Casa Florilor este o locație de evenimente…" → the venue's own phrase,
    // not Google's English classification.
    assert.equal(headingOf(venue, 'hero'), 'Locație de evenimente în Târgoviște');
    assert.match(headingOf(garage, 'hero'), /^Independent garage in Bristol$|^Auto repair shop in Bristol$/);
  });

  test('the signature beat names what its photograph shows', () => {
    // The bakery's evidence — six usable images across three framings, a warm
    // register, a gallery to build to — earns a narrative with the gallery as
    // its signature.
    assert.equal(bakery.plan.experience.signatureMoment, 'gallery');
    const heading = headingOf(bakery, 'gallery');
    assert.notEqual(heading, 'Photographs');
    const gallery = bakery.directed.content.sections.find((section) => section.kind === 'gallery');
    assert.ok(
      gallery?.images.some((image) => (image.alt ?? '').startsWith(heading)),
      `"${heading}" is not the opening of any alt on the section`,
    );
  });

  test('the same section kind is written differently for a different beat', () => {
    // A gallery that is the page's peak is named for the photograph it shows;
    // a gallery that merely reveals the place is too — but the two businesses
    // must not converge on one label, and neither may be "Photographs".
    assert.equal(bakery.plan.roles.get(bakery.baseline.sections.findIndex((s) => s.kind === 'gallery')), 'signature');
    assert.notEqual(venue.plan.roles.get(venue.baseline.sections.findIndex((s) => s.kind === 'gallery')), 'signature');
    assert.notEqual(headingOf(bakery, 'gallery'), headingOf(venue, 'gallery'));
    for (const heading of [headingOf(bakery, 'gallery'), headingOf(venue, 'gallery')]) {
      assert.ok(heading !== 'Photographs' && heading !== 'Fotografii', heading);
    }
  });

  test('a breadth beat names the offerings when naming them is the whole range', () => {
    // Three services: naming them is complete and specific.
    assert.equal(headingOf(bakery, 'services'), 'Sourdough, Pastries and Celebration cakes');
    // Six services: a list heading would be a partial claim, so the label stands
    // and the grid below does the enumerating.
    assert.equal(headingOf(venue, 'services'), 'Ce oferim');
  });

  test('the closing beat states the action the conversion strategy chose', () => {
    assert.equal(venue.plan.conversion.primaryCta, 'book');
    assert.equal(headingOf(venue, 'cta'), 'Rezervă la Casa Florilor');
    assert.equal(garage.plan.conversion.primaryCta, 'call');
    assert.equal(headingOf(garage, 'cta'), 'Call Fairfield Motors');
  });

  test('two businesses never receive the same set of headings', () => {
    const a = venue.directed.content.sections.map((section) => section.heading).join('|');
    const b = bakery.directed.content.sections.map((section) => section.heading).join('|');
    const c = garage.directed.content.sections.map((section) => section.heading).join('|');
    assert.notEqual(a, b);
    assert.notEqual(b, c);
    assert.notEqual(a, c);
  });

  test('no heading is repeated on one page', () => {
    for (const result of [venue, garage, bakery]) {
      const headings = result.directed.content.sections.map((section) => section.heading.toLowerCase()).filter((h) => h !== '');
      assert.equal(new Set(headings).size, headings.length, headings.join(' | '));
    }
  });
});

describe('the button follows the conversion strategy, not the phone number', () => {
  test('a venue that should be booked says so, on the number it can be booked on', () => {
    for (const section of venue.directed.content.sections) {
      if (section.callToAction === null || section.kind === 'hours') continue;
      assert.equal(section.callToAction.label, 'Rezervă', `${section.kind} button`);
      assert.ok(section.callToAction.href.startsWith('tel:'));
    }
  });

  test('a garage that should be called says "Call us"', () => {
    const cta = garage.directed.content.sections.find((section) => section.kind === 'cta');
    assert.equal(cta?.callToAction?.label, 'Call us');
  });
});

describe('the signature beat is given words to carry', () => {
  test('the strongest sentence moves to the peak and leaves its source', () => {
    const gallery = bakery.directed.content.sections.find((section) => section.kind === 'gallery');
    const about = bakery.directed.content.sections.find((section) => section.kind === 'about');
    assert.ok((gallery?.body ?? '').length > 40, 'the signature beat has no copy');
    // Moved, not copied.
    assert.equal(about?.body.includes(gallery?.body ?? '###'), false, 'the sentence is printed twice');
    // And it is verbatim evidence, not something written.
    const ev = indexEvidence(bakery.profile, bakery.baseline);
    assert.ok(
      ev.sentences.some((sentence) => sentence.text === gallery?.body),
      'the signature copy is not a sentence the business published',
    );
  });

  test('a business with no signature beat keeps all its prose where it was', () => {
    const about = garage.directed.content.sections.find((section) => section.kind === 'about');
    const baselineAbout = garage.baseline.sections.find((section) => section.kind === 'about');
    assert.equal(about?.body, baselineAbout?.body);
  });
});

describe('nothing on the page is invented', () => {
  test('every authored string declares which of the three bases it stands on', () => {
    for (const [name, result] of [['venue', venue], ['garage', garage], ['bakery', bakery]] as const) {
      for (const decision of result.directed.decisions) {
        assert.ok(
          ['quoted', 'composed', 'framing'].includes(decision.basis),
          `${name}: ${decision.field} has basis "${decision.basis}"`,
        );
        assert.ok(decision.source.trim() !== '', `${name}: ${decision.field} cites no source`);
      }
    }
  });

  test('a quoted string appears verbatim in the business\'s own material', () => {
    for (const [name, result] of [['venue', venue], ['garage', garage], ['bakery', bakery]] as const) {
      const ev = indexEvidence(result.profile, result.baseline);
      const corpus = [
        ev.name, ev.trade ?? '', ...ev.offerings, ...ev.amenities,
        ...ev.sentences.map((sentence) => sentence.text), ...ev.imageDescriptions,
      ].join(' \n ').toLowerCase();

      for (const decision of result.directed.decisions) {
        if (decision.basis !== 'quoted') continue;
        // Case-folded containment: the only edit the director may make to a
        // quotation is where it cuts and whether the first letter is capital.
        assert.ok(
          corpus.includes(decision.value.toLowerCase()),
          `${name}: "${decision.value}" (${decision.source}) is not verbatim in the evidence`,
        );
      }
    }
  });

  test('a composed string introduces no word the evidence and the lexicon do not both know', () => {
    for (const [name, result] of [['venue', venue], ['garage', garage], ['bakery', bakery]] as const) {
      const ev = indexEvidence(result.profile, result.baseline);
      // Every word the business itself uses, plus every word the closed lexicon
      // is allowed to supply. A composed string may contain nothing else — that
      // is the difference between joining facts and inventing one.
      const lex = ev.lexicon;
      const known = new Set<string>();
      const learn = (value: string): void => {
        for (const word of value.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) ?? []) known.add(word);
      };
      [
        ev.name, ev.trade ?? '', ev.selfDescription ?? '', ev.place ?? '',
        ...ev.offerings, ...ev.amenities, ...ev.imageDescriptions,
        ...ev.sentences.map((sentence) => sentence.text),
        ...Object.values(lex.label), ...Object.values(lex.cta), ...Object.values(lex.furniture),
        ...Object.values(lex.kind), ...lex.days,
        // The frames themselves, exercised with a placeholder so their joining
        // words ("in", "at", "la", "din") are counted as lexicon vocabulary.
        ...Object.values(lex.frame).map((frame) => frame('x', 'y')),
        lex.list(['x', 'y']),
      ].forEach(learn);

      for (const decision of result.directed.decisions) {
        if (decision.basis !== 'composed') continue;
        for (const word of decision.value.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) ?? []) {
          assert.ok(
            known.has(word),
            `${name}: composed string "${decision.value}" introduces "${word}", which is neither evidence nor lexicon`,
          );
        }
      }
    }
  });

  test('a business with no description and no photographs still gets an honest page', () => {
    const thin = {
      name: 'Corner Locksmith', category: 'Locksmith', locality: 'Leeds',
      description: '', services: [], rating: null, photos: [],
    } as const;
    const profile = profileFrom(thin);
    const baseline = baselineFrom(thin, ['hero', 'contact', 'cta']);
    const plan = planNarrative(profile, baseline);
    const directed = directContent(profile, baseline, plan);

    assert.equal(directed.content.sections.length, 3);
    assert.equal(directed.content.sections[0]?.heading, 'Locksmith in Leeds');
    // No signature invented, no prose invented.
    for (const section of directed.content.sections) {
      assert.equal(section.body.trim(), baseline.sections.find((s) => s.kind === section.kind)?.body.trim());
    }
  });
});
