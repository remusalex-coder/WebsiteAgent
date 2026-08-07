/**
 * Industry classification and the theme library.
 *
 * Classification is the first decision the design layer makes and everything
 * else narrows from it, so a wrong industry is a wrong site. The ordering tests
 * are the ones that matter: overlapping keywords are why the rule list is
 * ordered rather than a map.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INDUSTRY_DEFAULTS, classifyIndustry, defaultsFor, emphasisFor } from '../../lib/design/industries.js';
import { THEMES, themeFor } from '../../lib/design/themes.js';
import { DESIGN_DIRECTIONS, INDUSTRIES, SECTION_VARIANTS } from '../../lib/design/types.js';

import type { ClassifyInput } from '../../lib/design/industries.js';

function input(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    listingCategory: null,
    strategyCategories: [],
    services: [],
    name: 'A Business',
    ...overrides,
  };
}

describe('classifyIndustry', () => {
  it('trusts the Maps category first', () => {
    const result = classifyIndustry(input({ listingCategory: 'Bakery', strategyCategories: ['Law firm'] }));
    assert.equal(result.id, 'bakery');
    assert.equal(result.basis, 'listing');
  });

  it('recognises the categories in the brief', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['Bakery', 'bakery'],
      ['Italian restaurant', 'restaurant'],
      ['Law firm', 'law'],
      ['Medical clinic', 'medical'],
      ['Dentist', 'dental'],
      ['Beauty salon', 'beauty'],
      ['Gym', 'gym'],
      ['Construction company', 'construction'],
      ['Auto repair shop', 'automotive'],
      ['Hotel', 'hotel'],
      ['Clothing store', 'retail'],
      ['Real estate agency', 'real-estate'],
    ];

    for (const [category, expected] of cases) {
      assert.equal(classifyIndustry(input({ listingCategory: category })).id, expected, category);
    }
  });

  it('resolves overlapping keywords by rule order', () => {
    // "dental clinic" contains "clinic"; dental is tested first on purpose.
    assert.equal(classifyIndustry(input({ listingCategory: 'Dental clinic' })).id, 'dental');
    // A bakery that sells coffee is a bakery.
    assert.equal(classifyIndustry(input({ listingCategory: 'Bakery and coffee shop' })).id, 'bakery');
    // A spa is more specific than a beauty salon.
    assert.equal(classifyIndustry(input({ listingCategory: 'Spa and beauty salon' })).id, 'spa');
  });

  it('falls back to the strategy category when the listing says nothing useful', () => {
    const result = classifyIndustry(input({
      listingCategory: 'Establishment',
      strategyCategories: ['Law firm'],
    }));
    assert.equal(result.id, 'law');
    assert.equal(result.basis, 'inferred');
  });

  it('infers from services when neither category helps', () => {
    const result = classifyIndustry(input({
      services: ['Teeth whitening', 'Root canal', 'Dental implants'],
    }));
    assert.equal(result.id, 'dental');
    assert.equal(result.basis, 'inferred');
    assert.ok(result.matchedOn.length >= 1);
  });

  it('breaks a service tie by rule order, not by which was listed first', () => {
    const a = classifyIndustry(input({ services: ['Legal advice', 'Dental care'] }));
    const b = classifyIndustry(input({ services: ['Dental care', 'Legal advice'] }));
    assert.equal(a.id, b.id);
  });

  it('uses the business name as a last resort', () => {
    const result = classifyIndustry(input({ name: "Joe's Bakery" }));
    assert.equal(result.id, 'bakery');
    assert.equal(result.basis, 'inferred');
  });

  it('returns general rather than guessing when nothing matches', () => {
    const result = classifyIndustry(input({ listingCategory: 'Establishment', name: 'Acme Ltd' }));
    assert.equal(result.id, 'general');
    assert.equal(result.basis, 'fallback');
    assert.deepEqual(result.matchedOn, []);
  });

  it('records what matched, so a bad classification is traceable', () => {
    const result = classifyIndustry(input({ listingCategory: 'Artisan Bakery' }));
    assert.deepEqual(result.matchedOn, ['category:bakery']);
    assert.match(result.rationale, /Artisan Bakery/);
  });

  it('is case and whitespace insensitive', () => {
    assert.equal(classifyIndustry(input({ listingCategory: '  LAW   FIRM  ' })).id, 'law');
  });

  it('is deterministic', () => {
    const args = input({ services: ['Haircut', 'Massage', 'Legal advice'] });
    assert.deepEqual(classifyIndustry(args), classifyIndustry(args));
  });
});

describe('industry defaults', () => {
  it('covers every declared industry', () => {
    for (const industry of INDUSTRIES) {
      assert.ok(INDUSTRY_DEFAULTS[industry], industry);
      assert.equal(INDUSTRY_DEFAULTS[industry].id, industry);
    }
  });

  it('names only real directions', () => {
    for (const industry of INDUSTRIES) {
      for (const direction of defaultsFor(industry).directions) {
        assert.ok(DESIGN_DIRECTIONS.includes(direction), `${industry} → ${direction}`);
      }
    }
  });

  it('names only real variants in its hints', () => {
    for (const industry of INDUSTRIES) {
      for (const variant of Object.values(defaultsFor(industry).variantHints)) {
        assert.ok(SECTION_VARIANTS.includes(variant), `${industry} → ${variant}`);
      }
    }
  });

  it('always offers at least one direction and leads with a hero', () => {
    for (const industry of INDUSTRIES) {
      const defaults = defaultsFor(industry);
      assert.ok(defaults.directions.length >= 1, industry);
      assert.equal(defaults.prioritySections[0], 'hero', industry);
    }
  });

  it('encodes the conventions the research found', () => {
    // Credibility-led categories should not lean on photography.
    assert.equal(defaultsFor('law').imageReliance, 'incidental');
    assert.equal(defaultsFor('law').density, 'airy');
    // Product-led categories must.
    assert.equal(defaultsFor('bakery').imageReliance, 'essential');
    assert.equal(defaultsFor('hotel').imageReliance, 'essential');
    // Energy categories run dense and loud.
    assert.equal(defaultsFor('gym').density, 'dense');
    assert.ok(defaultsFor('gym').directions.includes('bold'));
  });
});

describe('emphasisFor', () => {
  it('always leads with the first section', () => {
    assert.equal(emphasisFor('law', 'contact', 0), 'lead');
  });

  it('ranks by the industry priority list', () => {
    // A gym cares about testimonials; a law firm cares about services.
    assert.equal(emphasisFor('gym', 'services', 1), 'primary');
    assert.equal(emphasisFor('law', 'services', 1), 'primary');
  });

  it('quiets a section the industry has no opinion on', () => {
    assert.equal(emphasisFor('law', 'gallery', 3), 'quiet');
  });
});

describe('theme library', () => {
  it('defines all eleven directions', () => {
    assert.equal(DESIGN_DIRECTIONS.length, 11);
    for (const direction of DESIGN_DIRECTIONS) {
      assert.ok(THEMES[direction], direction);
      assert.equal(themeFor(direction).id, direction);
    }
  });

  it('keeps the numbers in every theme inside sane bounds', () => {
    for (const direction of DESIGN_DIRECTIONS) {
      const theme = themeFor(direction);
      assert.ok(theme.typeRatio >= 1.1 && theme.typeRatio <= 1.7, `${direction} ratio`);
      assert.ok(theme.chroma > 0 && theme.chroma <= 0.3, `${direction} chroma`);
      assert.ok(theme.neutralChroma >= 0 && theme.neutralChroma < theme.chroma, `${direction} neutral chroma`);
      assert.ok(theme.measureCh >= 55 && theme.measureCh <= 75, `${direction} measure`);
      assert.ok(theme.containerMaxRem >= 60 && theme.containerMaxRem <= 90, `${direction} container`);
      assert.ok(theme.heroPreference.length >= 1, `${direction} hero preference`);
    }
  });

  it('names only real variants in avoidVariants', () => {
    for (const direction of DESIGN_DIRECTIONS) {
      for (const variant of themeFor(direction).avoidVariants) {
        assert.ok(SECTION_VARIANTS.includes(variant), `${direction} → ${variant}`);
      }
    }
  });

  it('gives every theme at least two weights, so weight contrast is possible', () => {
    for (const direction of DESIGN_DIRECTIONS) {
      const theme = themeFor(direction);
      assert.ok(theme.headingFont.weights.length >= 2, `${direction} heading weights`);
      assert.ok(theme.bodyFont.weights.length >= 2, `${direction} body weights`);
    }
  });

  it('separates the directions rather than shading one into the next', () => {
    // If minimal and bold produced similar numbers the library would be
    // decorative. They should sit at opposite ends of chroma and scale.
    assert.ok(themeFor('bold').chroma > themeFor('minimal').chroma * 2);
    assert.ok(themeFor('editorial').typeRatio > themeFor('corporate').typeRatio);
    assert.equal(themeFor('editorial').elevation, 'flat');
    assert.equal(themeFor('luxury').radius, 'sharp');
  });

  it('keeps editorial away from bento, which fragments linear reading', () => {
    assert.ok(themeFor('editorial').avoidVariants.includes('bento'));
  });
});
