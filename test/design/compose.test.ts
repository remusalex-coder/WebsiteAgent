/**
 * The composer, end to end.
 *
 * The determinism suite is the important one — it is the property the whole
 * layer is built around, and the one that silently breaks the first time
 * somebody reaches for `Date.now()` or iterates a `Set`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeDesign } from '../../lib/design/index.js';
import { DESIGN_DIRECTIONS, HERO_VARIANTS, SECTION_VARIANTS } from '../../lib/design/types.js';
import { contrastHex } from '../../lib/design/color.js';
import { pageWithColor, profileFixture, strategyFixture } from '../fixtures/business.js';
import { emptyContent, fullContent, minimalContent } from '../fixtures/content.js';

import type { ComposeInput } from '../../lib/design/index.js';
import type { WebsiteContent } from '../../lib/types.js';

function inputFor(
  content: WebsiteContent = fullContent,
  profileOverrides = {},
  strategyOverrides = {},
): ComposeInput {
  return {
    profile: profileFixture(profileOverrides),
    strategy: strategyFixture(strategyOverrides),
    content,
  };
}

/* ------------------------------------------------------------------ */
/* Determinism                                                         */
/* ------------------------------------------------------------------ */

describe('determinism', () => {
  it('produces an identical design from identical input', () => {
    const input = inputFor();
    assert.deepEqual(composeDesign(input), composeDesign(input));
  });

  it('serialises identically, so a design can be snapshot-tested', () => {
    const input = inputFor();
    assert.equal(
      JSON.stringify(composeDesign(input)),
      JSON.stringify(composeDesign(input)),
    );
  });

  it('survives a JSON round trip of its inputs', () => {
    const input = inputFor();
    const clone = JSON.parse(JSON.stringify(input)) as ComposeInput;
    assert.deepEqual(composeDesign(clone), composeDesign(input));
  });

  it('carries no timestamp, run id or other moving value', () => {
    const serialised = JSON.stringify(composeDesign(inputFor()));
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(serialised), 'design contains an ISO timestamp');
    assert.ok(!/generatedAt|composedAt|runId/.test(serialised));
  });

  it('does not depend on the order services were listed in', () => {
    const a = composeDesign(inputFor(fullContent, { services: ['Sourdough', 'Cakes', 'Coffee'] }));
    const b = composeDesign(inputFor(fullContent, { services: ['Coffee', 'Cakes', 'Sourdough'] }));
    assert.equal(a.personality.direction, b.personality.direction);
    assert.deepEqual(a.tokens.color.semantic, b.tokens.color.semantic);
  });

  it('composes every industry and direction without throwing', () => {
    for (const direction of DESIGN_DIRECTIONS) {
      const design = composeDesign(inputFor(), { direction });
      assert.equal(design.personality.direction, direction);
      assert.equal(design.version, 1);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Independence from content                                           */
/* ------------------------------------------------------------------ */

describe('content independence', () => {
  it('never copies content strings into the design', () => {
    const serialised = JSON.stringify(composeDesign(inputFor()));

    // Copy belongs to WebsiteContent. A design that embedded it would make the
    // two artifacts impossible to vary independently.
    assert.ok(!serialised.includes('Bread baked before dawn'));
    assert.ok(!serialised.includes('Pastel de nata'));
    assert.ok(!serialised.includes('Rua da Prata'));
  });

  it('gives the same content two genuinely different looks under two directions', () => {
    // A short page, so density is free to differ. On an eleven-section page it
    // legitimately converges — see the page-length test below.
    const minimal = composeDesign(inputFor(minimalContent), { direction: 'minimal' });
    const bold = composeDesign(inputFor(minimalContent), { direction: 'bold' });

    assert.notEqual(minimal.tokens.color.semantic.brand, bold.tokens.color.semantic.brand);
    assert.notEqual(minimal.tokens.typography.ratio, bold.tokens.typography.ratio);
    assert.notEqual(minimal.tokens.radius.style, bold.tokens.radius.style);
    assert.notEqual(minimal.tokens.spacing.sectionMaxRem, bold.tokens.spacing.sectionMaxRem);
    assert.notEqual(minimal.personality.density, bold.personality.density);
  });

  it('lets page length override density on a long page', () => {
    // Eleven sections at `airy` would be a scroll marathon, so both directions
    // land on balanced however airy or dense they would prefer to be.
    const minimal = composeDesign(inputFor(fullContent), { direction: 'minimal' });
    const bold = composeDesign(inputFor(fullContent), { direction: 'bold' });

    assert.equal(minimal.personality.density, 'balanced');
    assert.equal(bold.personality.density, 'balanced');
    // The look still differs — density is one signal of many.
    assert.notEqual(minimal.tokens.typography.ratio, bold.tokens.typography.ratio);
  });
});

/* ------------------------------------------------------------------ */
/* Industry inference                                                  */
/* ------------------------------------------------------------------ */

describe('industry inference', () => {
  it('classifies from the profile and records the basis', () => {
    const design = composeDesign(inputFor(fullContent, { category: 'Bakery' }));
    assert.equal(design.industry.id, 'bakery');
    assert.equal(design.industry.basis, 'listing');
  });

  it('drives the direction from the industry', () => {
    const law = composeDesign(inputFor(minimalContent, { category: 'Law firm' }));
    const gym = composeDesign(inputFor(minimalContent, { category: 'Gym' }));

    assert.equal(law.industry.id, 'law');
    assert.equal(gym.industry.id, 'gym');
    assert.notEqual(law.personality.direction, gym.personality.direction);
    // Credibility categories get air; energy categories do not.
    assert.equal(law.personality.density, 'airy');
  });

  it('notes the fallback when nothing identifies the business', () => {
    const design = composeDesign(inputFor(
      minimalContent,
      { category: null, name: 'Acme Ltd' },
      { primary: 'Establishment', secondary: [] },
    ));
    assert.equal(design.industry.id, 'general');
    assert.equal(design.industry.basis, 'fallback');
    assert.ok(design.notes.some((note) => /Industry could not be determined/.test(note)));
  });

  it('lets the copy steer the direction within what the industry allows', () => {
    const luxurious: WebsiteContent = {
      ...minimalContent,
      tagline: 'A luxury bespoke experience, exclusive to our guests',
    };
    const design = composeDesign(inputFor(luxurious, { category: 'Beauty salon' }));

    assert.equal(design.industry.id, 'beauty');
    assert.equal(design.personality.direction, 'luxury');
    assert.ok(design.personality.evidence.some((entry) => entry.startsWith('copy:')));
  });

  it('does not let copy push a category somewhere inappropriate', () => {
    const silly: WebsiteContent = { ...minimalContent, tagline: 'fun playful vibrant fun fun' };
    const design = composeDesign(inputFor(silly, { category: 'Law firm' }));

    // "playful" is not in the law preference list and must not win.
    assert.ok(['corporate', 'editorial', 'premium'].includes(design.personality.direction));
  });
});

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

describe('tokens', () => {
  const design = composeDesign(inputFor());

  it('builds a full ramp for every colour role', () => {
    for (const role of ['primary', 'secondary', 'accent', 'neutral', 'success', 'warning', 'danger'] as const) {
      const ramp = design.tokens.color.ramps[role];
      assert.equal(ramp.steps.length, 12, role);
      for (const step of ramp.steps) assert.match(step, /^#[0-9a-f]{6}$/, `${role} ${step}`);
    }
  });

  it('emits a valid hex for every semantic slot', () => {
    for (const [name, value] of Object.entries(design.tokens.color.semantic)) {
      assert.match(value, /^#[0-9a-f]{6}$/, name);
    }
  });

  it('meets its own contrast target for body text', () => {
    const { semantic } = design.tokens.color;
    const measured = contrastHex(semantic.text, semantic.canvas);
    assert.ok(
      measured >= design.accessibility.minContrastBody,
      `body text ${measured}:1 below ${design.accessibility.minContrastBody}:1`,
    );
  });

  it('meets the contrast target across every direction', () => {
    for (const direction of DESIGN_DIRECTIONS) {
      const candidate = composeDesign(inputFor(), { direction });
      const { semantic, contrast } = candidate.tokens.color;

      assert.ok(
        contrastHex(semantic.text, semantic.canvas) >= candidate.accessibility.minContrastBody,
        `${direction} body text`,
      );
      assert.ok(contrast.onBrandOnBrand >= 3, `${direction} on-brand ${contrast.onBrandOnBrand}`);
    }
  });

  it('honours an AAA request', () => {
    const strict = composeDesign(inputFor(), { accessibilityLevel: 'AAA' });
    assert.equal(strict.accessibility.minContrastBody, 7);
    assert.ok(contrastHex(strict.tokens.color.semantic.text, strict.tokens.color.semantic.canvas) >= 7);
  });

  it('orders the type scale from caption up to display', () => {
    const { scale } = design.tokens.typography;
    assert.ok(scale.display.maxRem > scale.h1.maxRem);
    assert.ok(scale.h1.maxRem > scale.h2.maxRem);
    assert.ok(scale.h2.maxRem > scale.h3.maxRem);
    assert.ok(scale.h3.maxRem > scale.body.maxRem);
    assert.ok(scale.body.maxRem > scale.caption.maxRem);
  });

  it('compresses the scale at the narrow anchor, so display type still fits a phone', () => {
    const { scale } = design.tokens.typography;
    assert.ok(scale.display.minRem < scale.display.maxRem);
    assert.ok(scale.display.minRem < 3.5, `narrow display ${scale.display.minRem}rem is too large for a phone`);
  });

  it('tightens line height as size rises', () => {
    const { scale } = design.tokens.typography;
    assert.ok(scale.display.lineHeight < scale.body.lineHeight);
    assert.ok(scale.h2.lineHeight < scale.body.lineHeight);
  });

  it('gives display type negative tracking and eyebrows positive', () => {
    const { scale } = design.tokens.typography;
    assert.ok(scale.display.letterSpacing <= 0 || design.personality.direction === 'luxury');
    assert.ok(scale.eyebrow.letterSpacing > 0);
  });

  it('emits a rising spacing scale', () => {
    const { scale } = design.tokens.spacing;
    assert.ok(scale.xs.maxRem < scale.md.maxRem);
    assert.ok(scale.md.maxRem < scale.xl.maxRem);
    assert.ok(scale['4xl'].maxRem > scale['3xl'].maxRem);
  });

  it('never emits a shadow on a flat direction', () => {
    const editorial = composeDesign(inputFor(), { direction: 'editorial' });
    assert.equal(editorial.tokens.elevation.style, 'flat');
    assert.equal(editorial.tokens.elevation.levels.md.shadow, 'none');
    assert.equal(editorial.tokens.elevation.prefersBorders, true);
  });

  it('always promises to respect reduced motion', () => {
    for (const direction of DESIGN_DIRECTIONS) {
      const candidate = composeDesign(inputFor(), { direction });
      assert.equal(candidate.tokens.motion.respectReducedMotion, true, direction);
    }
  });

  it('takes the brand colour from the page text when the voice has none', () => {
    const design = composeDesign(inputFor(minimalContent, { pages: [pageWithColor('#7d2fe0')] }));
    // The hue should follow the found colour rather than the industry default.
    assert.notEqual(design.tokens.color.semantic.brand, '#000000');
    assert.ok(!design.notes.some((note) => /No brand colour was found/.test(note)));
  });

  it('notes that it invented a hue when no brand colour exists anywhere', () => {
    const design = composeDesign(inputFor(minimalContent));
    assert.ok(design.notes.some((note) => /No brand colour was found/.test(note)));
  });
});

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

describe('layout', () => {
  it('names a real hero and real variants', () => {
    const design = composeDesign(inputFor());
    assert.ok(HERO_VARIANTS.includes(design.layout.hero));
    for (const section of design.layout.sections) {
      assert.ok(SECTION_VARIANTS.includes(section.variant), section.variant);
    }
  });

  it('covers every content section exactly once', () => {
    const design = composeDesign(inputFor());
    const indices = design.layout.order.slice().sort((a, b) => a - b);
    assert.deepEqual(indices, fullContent.sections.map((_, index) => index));
    assert.equal(design.layout.sections.length, fullContent.sections.length);
  });

  it('echoes the kind at each index, so the renderer can assert alignment', () => {
    const design = composeDesign(inputFor());
    for (const section of design.layout.sections) {
      assert.equal(section.kind, fullContent.sections[section.index]?.kind);
    }
  });

  it('leads with the hero and closes with the CTA whatever the writer emitted', () => {
    const design = composeDesign(inputFor());
    const first = design.layout.sections[0];
    const last = design.layout.sections[design.layout.sections.length - 1];

    assert.equal(first?.kind, 'hero');
    assert.equal(first?.emphasis, 'lead');
    assert.equal(last?.kind, 'cta');
  });

  it('refuses a variant the content cannot fill', () => {
    // The fixture's services section has three bullets; bento needs five.
    const design = composeDesign(inputFor());
    const services = design.layout.sections.find((section) => section.kind === 'services');
    assert.ok(services);
    assert.notEqual(services.variant, 'bento');
  });

  it('refuses a variant the direction forbids', () => {
    const editorial = composeDesign(inputFor(), { direction: 'editorial' });
    for (const section of editorial.layout.sections) {
      assert.notEqual(section.variant, 'bento', 'editorial must never use bento');
      assert.notEqual(section.variant, 'carousel');
    }
  });

  it('separates adjacent sections by ground', () => {
    const design = composeDesign(inputFor());
    const backgrounds = design.layout.sections.map((section) => section.background);

    for (let i = 1; i < backgrounds.length; i += 1) {
      if (backgrounds[i - 1] === 'brand' || backgrounds[i] === 'brand') continue;
      assert.notEqual(backgrounds[i], backgrounds[i - 1], `sections ${i - 1} and ${i} share a ground`);
    }
  });

  it('inverts the CTA band', () => {
    const design = composeDesign(inputFor());
    const cta = design.layout.sections.find((section) => section.kind === 'cta');
    assert.equal(cta?.background, 'brand');
  });

  it('falls back to a type-led hero when the industry wants imagery and there is none', () => {
    const design = composeDesign(inputFor(minimalContent, { category: 'Hotel' }));
    assert.ok(['centered', 'minimal', 'editorial'].includes(design.layout.hero));
    assert.match(design.layout.rationale, /hero/i);
  });

  it('hides navigation on a page too short to need it', () => {
    const design = composeDesign(inputFor(minimalContent));
    assert.equal(design.layout.showNavigation, false);
    assert.equal(design.layout.stickyHeader, false);
  });

  it('records why each section got its variant', () => {
    const design = composeDesign(inputFor());
    for (const section of design.layout.sections) {
      assert.ok(section.rationale.length > 10, `${section.kind} has no rationale`);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Degenerate input                                                    */
/* ------------------------------------------------------------------ */

describe('degenerate input', () => {
  it('composes a design for a spec with no sections at all', () => {
    const design = composeDesign(inputFor(emptyContent));
    assert.equal(design.layout.sections.length, 0);
    assert.deepEqual(design.layout.order, []);
    assert.ok(HERO_VARIANTS.includes(design.layout.hero));
  });

  it('composes a design for a profile with nothing in it', () => {
    const design = composeDesign({
      profile: profileFixture({ category: null, name: '', services: [] }),
      strategy: strategyFixture({ primary: '', secondary: [] }),
      content: minimalContent,
    });
    assert.equal(design.version, 1);
    assert.equal(design.industry.id, 'general');
  });

  it('reports its compromises rather than throwing', () => {
    const design = composeDesign(inputFor(minimalContent, { category: null, name: 'Acme' }));
    assert.ok(Array.isArray(design.notes));
    assert.ok(design.notes.length > 0);
  });
});
