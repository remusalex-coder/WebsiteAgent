/**
 * The design vocabulary, and the gates that keep it honest.
 *
 * Two things are worth testing about a pattern library, and neither is that the
 * table has the right number of rows in it.
 *
 * The first is that a pattern cannot reach a page it has no content for. That
 * is the executable half of the truthfulness rule: the marquee is not allowed
 * to appear on a business with two facts and then be padded, and the statement
 * band is not allowed to appear on a business with no prose and then be
 * written. `requires` is what stops both, so `requires` is what is tested.
 *
 * The second is that selection stays deterministic and exclusive where it
 * claims to be — a page has one hero and one type system, and two runs over the
 * same business have to choose the same ones.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PATTERNS,
  eligible,
  patternById,
  selectPatterns,
} from '../../lib/design/patterns.js';

import type { PatternContext } from '../../lib/design/patterns.js';

/** A business with plenty of everything, so only the declared gates bite. */
function rich(overrides: Partial<PatternContext> = {}): PatternContext {
  return {
    industry: 'bakery',
    direction: 'friendly',
    images: 12,
    facts: 6,
    prose: 1200,
    sections: 7,
    ...overrides,
  };
}

describe('the pattern table', () => {
  it('has no duplicate ids', () => {
    const ids = PATTERNS.map((pattern) => pattern.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('gives every pattern the contract fields a reviewer needs', () => {
    for (const pattern of PATTERNS) {
      assert.ok(pattern.intent.length > 20, `${pattern.id} has no intent`);
      assert.ok(pattern.industries.length > 0, `${pattern.id} suits no industry`);
      assert.ok(pattern.directions.length > 0, `${pattern.id} suits no direction`);
      assert.ok(pattern.antiPatterns.length > 0, `${pattern.id} declares no anti-pattern`);
      assert.ok(pattern.sources.length > 0, `${pattern.id} cites no source`);
      assert.ok(pattern.accessibility.length > 0, `${pattern.id} declares no accessibility constraint`);
    }
  });

  it('is reachable by id', () => {
    assert.equal(patternById('hero-cinematic')?.family, 'hero');
    assert.equal(patternById('no-such-pattern'), undefined);
  });
});

describe('eligibility', () => {
  it('never selects a pattern the renderer cannot draw', () => {
    const declared = PATTERNS.filter((pattern) => pattern.status === 'declared');
    assert.ok(declared.length > 0, 'the fixture assumes at least one declared pattern');

    const chosen = selectPatterns(rich());
    for (const pattern of declared) {
      assert.ok(!chosen.includes(pattern.id), `${pattern.id} is declared but was selected`);
    }
  });

  it('withholds the marquee from a business with too few facts', () => {
    const marquee = patternById('marquee-verified-facts');
    assert.ok(marquee !== undefined);
    assert.ok(eligible(marquee, rich({ facts: 3 })));
    assert.ok(!eligible(marquee, rich({ facts: 2 })));
  });

  it('withholds the statement band from a business with no prose to quote', () => {
    const statement = patternById('editorial-statement-break');
    assert.ok(statement !== undefined);
    assert.ok(eligible(statement, rich({ prose: 400 })));
    assert.ok(!eligible(statement, rich({ prose: 40 })));
  });

  it('withholds the statement band from a page too short to interrupt', () => {
    const statement = patternById('editorial-statement-break');
    assert.ok(statement !== undefined);
    assert.ok(!eligible(statement, rich({ sections: 3 })));
  });

  it('withholds the edited gallery from a business with three photographs', () => {
    const gallery = patternById('gallery-edited-grid');
    assert.ok(gallery !== undefined);
    assert.ok(!eligible(gallery, rich({ images: 3 })));
  });

  it('keeps the cinematic hero away from a category that should not lead with a photograph', () => {
    const cinematic = patternById('hero-cinematic');
    assert.ok(cinematic !== undefined);
    assert.ok(eligible(cinematic, rich({ industry: 'hotel' })));
    assert.ok(!eligible(cinematic, rich({ industry: 'dental' })));
  });
});

describe('selection', () => {
  it('chooses exactly one hero and one type system', () => {
    for (const industry of ['bakery', 'dental', 'law', 'hotel', 'general'] as const) {
      const chosen = selectPatterns(rich({ industry }));
      const families = chosen.map((id) => patternById(id)?.family);
      assert.equal(families.filter((family) => family === 'hero').length, 1, industry);
      assert.equal(families.filter((family) => family === 'typography').length, 1, industry);
    }
  });

  it('gives different categories different vocabularies', () => {
    const bakery = selectPatterns(rich({ industry: 'bakery', direction: 'friendly' }));
    const dentist = selectPatterns(rich({ industry: 'dental', direction: 'corporate' }));

    assert.ok(bakery.includes('hero-cinematic'));
    assert.ok(bakery.includes('type-editorial-serif'));
    assert.ok(dentist.includes('hero-editorial-split'));
    assert.ok(dentist.includes('type-grotesque-authority'));
  });

  it('falls back to the typographic hero when there is no photograph', () => {
    const chosen = selectPatterns(rich({ images: 0 }));
    assert.ok(chosen.includes('hero-typographic'));
  });

  it('degrades a thin business to a plainer page rather than an invented one', () => {
    const thin = selectPatterns({
      industry: 'law',
      direction: 'corporate',
      images: 0,
      facts: 1,
      prose: 30,
      sections: 3,
    });

    // No marquee to pad, no statement to write, no gallery to fill.
    assert.ok(!thin.includes('marquee-verified-facts'));
    assert.ok(!thin.includes('editorial-statement-break'));
    assert.ok(!thin.includes('gallery-edited-grid'));
    // But the page is still composed: it has a hero, a type system and a close.
    assert.ok(thin.includes('hero-typographic'));
    assert.ok(thin.includes('closing-invitation'));
  });

  it('is deterministic', () => {
    assert.deepEqual(selectPatterns(rich()), selectPatterns(rich()));
  });
});
