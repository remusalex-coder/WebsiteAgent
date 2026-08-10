/**
 * Tests for the V1 DesignDirective contract and the deterministic adapter.
 *
 * Test strategy:
 *   - The adapter is a pure function: same inputs → same outputs, always.
 *   - Operator overrides always take precedence over directive values.
 *   - Missing / invalid directive fields degrade gracefully (no throw).
 *   - A fully-empty directive is equivalent to no directive at all.
 *   - End-to-end: directive → adapter → composeDesign produces a valid design.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyDirective, applyExperienceIntent } from '../../lib/design/directive.js';
import { composeDesign } from '../../lib/design/index.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

import type { ComposeOptions } from '../../lib/design/compose.js';
import type { DesignDirective, ExperienceIntent } from '../../lib/design/directive.js';
import type { ComposeInput } from '../../lib/design/index.js';

function baseInput(): ComposeInput {
  return {
    profile: profileFixture(),
    strategy: strategyFixture(),
    content: fullContent,
  };
}

/* ------------------------------------------------------------------ */
/* applyDirective — determinism                                        */
/* ------------------------------------------------------------------ */

describe('applyDirective – determinism', () => {
  it('produces identical output for identical input', () => {
    const d: DesignDirective = {
      direction: 'luxury',
      visualIntent: 'refined and exclusive',
      density: 'airy',
      accessibilityTarget: 'AA',
      rationale: 'test',
      confidence: 0.9,
    };
    assert.deepEqual(applyDirective(d), applyDirective(d));
  });

  it('is a pure function — does not mutate the directive object', () => {
    const d: DesignDirective = { direction: 'modern', density: 'balanced' };
    const before = JSON.stringify(d);
    applyDirective(d);
    assert.equal(JSON.stringify(d), before, 'directive was mutated');
  });

  it('does not call console.warn or console.info', () => {
    const captured: string[] = [];
    const origWarn = console.warn.bind(console);
    const origInfo = console.info.bind(console);
    console.warn = (...args: unknown[]) => { captured.push(`warn: ${args.join(' ')}`); origWarn(...args); };
    console.info = (...args: unknown[]) => { captured.push(`info: ${args.join(' ')}`); origInfo(...args); };
    try {
      applyDirective({
        direction: 'luxury',
        visualIntent: 'refined',
        density: 'airy',
        heroIntent: { preference: 'full-bleed', intent: 'cinematic' },
        layoutIntent: 'editorial',
        colorStrategy: 'high-contrast',
        typographyIntent: { intent: 'elegant', preference: 'serif' },
        imageryIntent: { intent: 'warm', treatment: 'warm' },
        rationale: undefined,
        confidence: 0.1,
      });
      // @ts-expect-error — testing runtime guard
      applyDirective({ direction: 'galaxy-brain' });
      // @ts-expect-error — testing runtime guard
      applyDirective({ density: 'ridiculous' });
      applyDirective({ accessibilityTarget: 'AA' });
    } finally {
      console.warn = origWarn;
      console.info = origInfo;
    }
    assert.equal(captured.length, 0, `applyDirective called console: ${captured.join(', ')}`);
  });

  it('returns a new object, not a reference to the operator options', () => {
    const op: ComposeOptions = { direction: 'bold' };
    const result = applyDirective({ visualIntent: 'bold and energetic' }, op);
    assert.notEqual(result, op);
  });
});

/* ------------------------------------------------------------------ */
/* applyDirective — undefined / empty directive                        */
/* ------------------------------------------------------------------ */

describe('applyDirective – undefined / empty directive', () => {
  it('returns operator options unchanged when directive is undefined', () => {
    const op: ComposeOptions = { direction: 'minimal', accessibilityLevel: 'AAA' };
    const result = applyDirective(undefined, op);
    assert.deepEqual(result, op);
  });

  it('returns empty options when directive is undefined and no operator options given', () => {
    const result = applyDirective(undefined);
    assert.deepEqual(result, {});
  });

  it('returns empty-ish options for a completely empty directive', () => {
    const result = applyDirective({});
    // direction and accessibilityLevel should not be set
    assert.equal(result.direction, undefined);
    assert.equal(result.accessibilityLevel, undefined);
  });
});

/* ------------------------------------------------------------------ */
/* applyDirective — direction mapping                                  */
/* ------------------------------------------------------------------ */

describe('applyDirective – direction', () => {
  it('maps directive.direction to ComposeOptions.direction', () => {
    const result = applyDirective({ direction: 'luxury', rationale: 'test' });
    assert.equal(result.direction, 'luxury');
  });

  it('maps every valid DesignDirection', () => {
    const directions = [
      'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
      'creative', 'playful', 'bold', 'premium', 'friendly',
    ] as const;
    for (const direction of directions) {
      const result = applyDirective({ direction });
      assert.equal(result.direction, direction, direction);
    }
  });

  it('ignores an invalid direction value and does not set direction', () => {
    // @ts-expect-error — testing runtime guard
    const result = applyDirective({ direction: 'galaxy-brain' });
    assert.equal(result.direction, undefined);
  });

  it('operator direction overrides directive direction', () => {
    const result = applyDirective(
      { direction: 'luxury', rationale: 'AI says luxury' },
      { direction: 'minimal' },
    );
    assert.equal(result.direction, 'minimal');
  });

  it('operator direction wins even when directive direction is valid', () => {
    for (const [directiveDir, operatorDir] of [['bold', 'minimal'], ['elegant', 'corporate']] as const) {
      const result = applyDirective({ direction: directiveDir }, { direction: operatorDir });
      assert.equal(result.direction, operatorDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/* applyDirective — accessibility mapping                             */
/* ------------------------------------------------------------------ */

describe('applyDirective – accessibility', () => {
  it('maps accessibilityTarget AA to ComposeOptions.accessibilityLevel', () => {
    const result = applyDirective({ accessibilityTarget: 'AA' });
    assert.equal(result.accessibilityLevel, 'AA');
  });

  it('maps accessibilityTarget AAA to ComposeOptions.accessibilityLevel', () => {
    const result = applyDirective({ accessibilityTarget: 'AAA' });
    assert.equal(result.accessibilityLevel, 'AAA');
  });

  it('colorStrategy high-contrast forces AAA regardless of accessibilityTarget', () => {
    const result = applyDirective({
      colorStrategy: 'high-contrast',
      accessibilityTarget: 'AA',
    });
    assert.equal(result.accessibilityLevel, 'AAA');
  });

  it('colorStrategy high-contrast forces AAA when accessibilityTarget is absent', () => {
    const result = applyDirective({ colorStrategy: 'high-contrast' });
    assert.equal(result.accessibilityLevel, 'AAA');
  });

  it('operator accessibilityLevel overrides directive accessibilityTarget', () => {
    const result = applyDirective(
      { accessibilityTarget: 'AAA' },
      { accessibilityLevel: 'AA' },
    );
    assert.equal(result.accessibilityLevel, 'AA');
  });

  it('operator accessibilityLevel overrides high-contrast colorStrategy', () => {
    const result = applyDirective(
      { colorStrategy: 'high-contrast' },
      { accessibilityLevel: 'AA' },
    );
    assert.equal(result.accessibilityLevel, 'AA');
  });
});

/* ------------------------------------------------------------------ */
/* applyDirective — advisory fields (no crash)                        */
/* ------------------------------------------------------------------ */

describe('applyDirective – advisory fields', () => {
  it('accepts all advisory fields without throwing', () => {
    assert.doesNotThrow(() => {
      applyDirective({
        visualIntent: 'warm and welcoming',
        density: 'airy',
        heroIntent: { preference: 'full-bleed', intent: 'cinematic opener' },
        layoutIntent: 'editorial column with strong hierarchy',
        colorStrategy: 'brand-led',
        typographyIntent: { intent: 'elegant serif headlines', preference: 'serif' },
        imageryIntent: { intent: 'warm natural photography', treatment: 'warm' },
        rationale: 'The brand is warm and artisan; a welcoming feel matches the target audience.',
        confidence: 0.87,
      });
    });
  });

  it('advisory fields do not appear in ComposeOptions', () => {
    const result = applyDirective({
      visualIntent: 'editorial and calm',
      density: 'airy',
      heroIntent: { preference: 'editorial', intent: 'literary opener' },
      layoutIntent: 'structured grid',
      colorStrategy: 'neutral',
      typographyIntent: { intent: 'clean sans body', preference: 'sans' },
      imageryIntent: { intent: 'cool monochrome', treatment: 'cool' },
      rationale: 'test',
      confidence: 0.8,
    });
    // ComposeOptions only has direction and accessibilityLevel
    const keys = Object.keys(result);
    for (const key of keys) {
      assert.ok(
        key === 'direction' || key === 'accessibilityLevel',
        `unexpected key in ComposeOptions: "${key}"`,
      );
    }
  });

  it('accepts a low confidence value without throwing', () => {
    assert.doesNotThrow(() => applyDirective({ confidence: 0.2, rationale: 'uncertain' }));
  });

  it('accepts zero confidence without throwing', () => {
    assert.doesNotThrow(() => applyDirective({ confidence: 0 }));
  });

  it('accepts density balanced without throwing', () => {
    assert.doesNotThrow(() => applyDirective({ density: 'balanced' }));
  });

  it('accepts density dense without throwing', () => {
    assert.doesNotThrow(() => applyDirective({ density: 'dense' }));
  });

  it('accepts null heroIntent preference without throwing', () => {
    assert.doesNotThrow(() => {
      applyDirective({ heroIntent: { preference: null, intent: 'no strong preference' } });
    });
  });

  it('accepts null imageryIntent treatment without throwing', () => {
    assert.doesNotThrow(() => {
      applyDirective({ imageryIntent: { intent: 'authentic photography', treatment: null } });
    });
  });

  it('accepts null typographyIntent preference without throwing', () => {
    assert.doesNotThrow(() => {
      applyDirective({ typographyIntent: { intent: 'clear and legible', preference: null } });
    });
  });

  it('ignores an invalid density value without throwing', () => {
    // @ts-expect-error — testing runtime guard
    assert.doesNotThrow(() => applyDirective({ density: 'ridiculous' }));
  });
});

/* ------------------------------------------------------------------ */
/* applyDirective — operator option passthrough                       */
/* ------------------------------------------------------------------ */

describe('applyDirective – operator option passthrough', () => {
  it('preserves operator direction when directive has none', () => {
    const result = applyDirective({ visualIntent: 'bold' }, { direction: 'bold' });
    assert.equal(result.direction, 'bold');
  });

  it('preserves operator accessibilityLevel when directive has none', () => {
    const result = applyDirective({ visualIntent: 'accessible' }, { accessibilityLevel: 'AAA' });
    assert.equal(result.accessibilityLevel, 'AAA');
  });

  it('combines directive direction with operator accessibilityLevel', () => {
    const result = applyDirective({ direction: 'luxury' }, { accessibilityLevel: 'AAA' });
    assert.equal(result.direction, 'luxury');
    assert.equal(result.accessibilityLevel, 'AAA');
  });

  /*
   * `photographicSeed` is the option with no directive equivalent, and it is the
   * one that would be silently dropped by an adapter that built its result field
   * by field instead of spreading. Losing it means losing the brand colour read
   * off the business's own photographs — evidence beaten by a model's taste,
   * which is the wrong way round.
   */
  it('carries through options the directive says nothing about', () => {
    const result = applyDirective({ direction: 'luxury' }, { photographicSeed: '#5b3a29' });
    assert.equal(result.photographicSeed, '#5b3a29');
    assert.equal(result.direction, 'luxury');
  });

  it('does not invent a photographic seed', () => {
    const result = applyDirective({ direction: 'luxury', colorStrategy: 'brand-led' });
    assert.equal(result.photographicSeed, undefined);
  });
});

/* ------------------------------------------------------------------ */
/* End-to-end: directive → adapter → composeDesign                   */
/* ------------------------------------------------------------------ */

describe('end-to-end: DesignDirective → composeDesign', () => {
  it('produces a valid WebsiteDesign from a directive with direction', () => {
    const directive: DesignDirective = {
      direction: 'luxury',
      visualIntent: 'refined and exclusive experience',
      density: 'airy',
      rationale: 'The business targets high-income clients; luxury positioning matches.',
      confidence: 0.9,
    };
    const options = applyDirective(directive);
    const design = composeDesign(baseInput(), options);

    assert.equal(design.version, 1);
    assert.equal(design.personality.direction, 'luxury');
  });

  it('produces a valid design when directive is empty', () => {
    const options = applyDirective({});
    const design = composeDesign(baseInput(), options);
    assert.equal(design.version, 1);
  });

  it('produces a valid design when directive is undefined', () => {
    const options = applyDirective(undefined);
    const design = composeDesign(baseInput(), options);
    assert.equal(design.version, 1);
  });

  it('applies AAA accessibility from directive', () => {
    const options = applyDirective({ accessibilityTarget: 'AAA' });
    const design = composeDesign(baseInput(), options);
    assert.equal(design.accessibility.targetLevel, 'AAA');
    assert.equal(design.accessibility.minContrastBody, 7);
  });

  it('applies AAA accessibility from high-contrast colorStrategy', () => {
    const options = applyDirective({ colorStrategy: 'high-contrast' });
    const design = composeDesign(baseInput(), options);
    assert.equal(design.accessibility.targetLevel, 'AAA');
  });

  it('operator direction beats directive direction end-to-end', () => {
    const directive: DesignDirective = { direction: 'luxury' };
    const operatorOptions: ComposeOptions = { direction: 'playful' };
    const options = applyDirective(directive, operatorOptions);
    const design = composeDesign(baseInput(), options);
    assert.equal(design.personality.direction, 'playful');
  });

  it('operator accessibilityLevel beats directive end-to-end', () => {
    const directive: DesignDirective = { accessibilityTarget: 'AAA' };
    const operatorOptions: ComposeOptions = { accessibilityLevel: 'AA' };
    const options = applyDirective(directive, operatorOptions);
    const design = composeDesign(baseInput(), options);
    assert.equal(design.accessibility.targetLevel, 'AA');
  });

  it('produces identical output to no-options composeDesign when directive is empty', () => {
    const withEmpty = composeDesign(baseInput(), applyDirective({}));
    const withNone = composeDesign(baseInput());
    assert.deepEqual(withEmpty, withNone);
  });

  it('is deterministic across all eleven directions', () => {
    const directions = [
      'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
      'creative', 'playful', 'bold', 'premium', 'friendly',
    ] as const;

    for (const dir of directions) {
      const directive: DesignDirective = {
        direction: dir,
        rationale: `Test: ${dir} direction`,
        confidence: 0.95,
      };
      const a = composeDesign(baseInput(), applyDirective(directive));
      const b = composeDesign(baseInput(), applyDirective(directive));
      assert.deepEqual(a, b, `${dir} is not deterministic`);
      assert.equal(a.personality.direction, dir);
    }
  });

  it('preserves all existing behavior when no directive is provided', () => {
    const withDirective = composeDesign(
      { profile: profileFixture(), strategy: strategyFixture(), content: minimalContent },
      applyDirective(undefined),
    );
    const without = composeDesign(
      { profile: profileFixture(), strategy: strategyFixture(), content: minimalContent },
    );
    assert.deepEqual(withDirective, without);
  });
});

/* ------------------------------------------------------------------ */
/* applyExperienceIntent — Experience Intent V1 (ADR 0005)             */
/* ------------------------------------------------------------------ */

describe('applyExperienceIntent – absent / determinism', () => {
  it('returns no moment when experienceIntent is undefined', () => {
    const result = applyExperienceIntent(undefined);
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
  });

  it('produces identical output for identical input', () => {
    const intent: ExperienceIntent = {
      mode: 'moment-led', moment: 'gallery', momentIntent: 'test', transitionAtMoment: true,
    };
    assert.deepEqual(applyExperienceIntent(intent), applyExperienceIntent(intent));
  });

  it('is a pure function — does not mutate the intent object', () => {
    const intent: ExperienceIntent = {
      mode: 'moment-led', moment: 'menu', momentIntent: 'test', transitionAtMoment: false,
    };
    const before = JSON.stringify(intent);
    applyExperienceIntent(intent);
    assert.equal(JSON.stringify(intent), before, 'experienceIntent was mutated');
  });

  it('does not call console.warn or console.info', () => {
    const captured: string[] = [];
    const origWarn = console.warn.bind(console);
    const origInfo = console.info.bind(console);
    console.warn = (...args: unknown[]) => { captured.push(`warn: ${args.join(' ')}`); origWarn(...args); };
    console.info = (...args: unknown[]) => { captured.push(`info: ${args.join(' ')}`); origInfo(...args); };
    try {
      applyExperienceIntent({
        mode: 'moment-led', moment: 'testimonials', momentIntent: 'a real review', transitionAtMoment: true,
      });
      applyExperienceIntent({ mode: 'standard', moment: null, momentIntent: null, transitionAtMoment: false });
    } finally {
      console.warn = origWarn;
      console.info = origInfo;
    }
    assert.equal(captured.length, 0, `applyExperienceIntent called console: ${captured.join(', ')}`);
  });
});

describe('applyExperienceIntent – mode "standard"', () => {
  it('returns no moment for a well-formed standard intent', () => {
    const result = applyExperienceIntent({
      mode: 'standard', moment: null, momentIntent: null, transitionAtMoment: false,
    });
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
  });

  it('ignores moment/momentIntent/transitionAtMoment set alongside mode "standard"', () => {
    const { logger, warnings } = capturingLoggerForDirective();
    const result = applyExperienceIntent(
      { mode: 'standard', moment: 'gallery', momentIntent: 'inconsistent', transitionAtMoment: true },
      logger,
    );
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
    assert.ok(warnings.length > 0, 'expected a warning for the inconsistent combination');
  });
});

describe('applyExperienceIntent – mode "moment-led"', () => {
  it('maps a valid moment nomination to momentSection', () => {
    const result = applyExperienceIntent({
      mode: 'moment-led',
      moment: 'gallery',
      momentIntent: 'The photography is the whole reason to visit.',
      transitionAtMoment: true,
    });
    assert.deepEqual(result, { momentSection: 'gallery', momentTransition: true });
  });

  it('maps transitionAtMoment: false through unchanged', () => {
    const result = applyExperienceIntent({
      mode: 'moment-led', moment: 'menu', momentIntent: 'The dish is the draw.', transitionAtMoment: false,
    });
    assert.deepEqual(result, { momentSection: 'menu', momentTransition: false });
  });

  it('maps every SectionKind the schema allows', () => {
    const kinds = [
      'hero', 'statement', 'about', 'services', 'menu', 'gallery',
      'testimonials', 'hours', 'location', 'contact', 'cta', 'faq',
    ] as const;
    for (const moment of kinds) {
      const result = applyExperienceIntent({
        mode: 'moment-led', moment, momentIntent: 'test', transitionAtMoment: false,
      });
      assert.equal(result.momentSection, moment, moment);
    }
  });

  it('falls back to no moment when moment is null', () => {
    const { logger, warnings } = capturingLoggerForDirective();
    const result = applyExperienceIntent(
      { mode: 'moment-led', moment: null, momentIntent: 'test', transitionAtMoment: false },
      logger,
    );
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
    assert.ok(warnings.length > 0, 'expected a warning for a null moment');
  });

  it('falls back to no moment when momentIntent is null', () => {
    const { logger, warnings } = capturingLoggerForDirective();
    const result = applyExperienceIntent(
      { mode: 'moment-led', moment: 'gallery', momentIntent: null, transitionAtMoment: false },
      logger,
    );
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
    assert.ok(warnings.length > 0, 'expected a warning for a missing momentIntent');
  });

  it('falls back to no moment when momentIntent is blank', () => {
    const result = applyExperienceIntent({
      mode: 'moment-led', moment: 'gallery', momentIntent: '   ', transitionAtMoment: false,
    });
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
  });

  it('falls back to no moment for an invalid mode value', () => {
    const { logger, warnings } = capturingLoggerForDirective();
    const result = applyExperienceIntent(
      // @ts-expect-error — testing runtime guard
      { mode: 'cinematic', moment: 'gallery', momentIntent: 'test', transitionAtMoment: false },
      logger,
    );
    assert.deepEqual(result, { momentSection: undefined, momentTransition: false });
    assert.ok(warnings.length > 0, 'expected a warning for an invalid mode');
  });
});

/** Captures warn calls without depending on the designDirectorAgent test's private helper. */
function capturingLoggerForDirective(): {
  logger: import('../../lib/logger.js').Logger;
  warnings: string[];
} {
  const warnings: string[] = [];
  const logger: import('../../lib/logger.js').Logger = {
    debug: () => {},
    info: () => {},
    warn: (msg: string) => { warnings.push(msg); },
    error: () => {},
    child: () => logger,
    async time<T>(_label: string, fn: () => Promise<T>): Promise<T> { return fn(); },
  };
  return { logger, warnings };
}

/* ------------------------------------------------------------------ */
/* applyDirective — experienceIntent integration                       */
/* ------------------------------------------------------------------ */

describe('applyDirective – experienceIntent integration', () => {
  it('does not add momentSection when the directive has no experienceIntent', () => {
    const result = applyDirective({ direction: 'luxury' });
    assert.equal('momentSection' in result, false);
    assert.equal('momentTransition' in result, false);
  });

  it('maps a moment-led experienceIntent into ComposeOptions.momentSection', () => {
    const result = applyDirective({
      direction: 'elegant',
      experienceIntent: {
        mode: 'moment-led',
        moment: 'gallery',
        momentIntent: 'The room, empty before an event, is the draw.',
        transitionAtMoment: true,
      },
    });
    assert.equal(result.momentSection, 'gallery');
    assert.equal(result.momentTransition, true);
  });

  it('a standard experienceIntent does not add momentSection', () => {
    const result = applyDirective({
      direction: 'corporate',
      experienceIntent: { mode: 'standard', moment: null, momentIntent: null, transitionAtMoment: false },
    });
    assert.equal('momentSection' in result, false);
  });

  it('operator momentSection overrides the directive\'s nomination', () => {
    const result = applyDirective(
      {
        experienceIntent: {
          mode: 'moment-led', moment: 'gallery', momentIntent: 'test', transitionAtMoment: true,
        },
      },
      { momentSection: 'menu', momentTransition: false },
    );
    assert.equal(result.momentSection, 'menu');
    assert.equal(result.momentTransition, false);
  });

  it('preserves operator momentSection when the directive has no experienceIntent', () => {
    const result = applyDirective({ direction: 'friendly' }, { momentSection: 'testimonials' });
    assert.equal(result.momentSection, 'testimonials');
  });
});

/* ------------------------------------------------------------------ */
/* End-to-end: experienceIntent → composeDesign                       */
/* ------------------------------------------------------------------ */

describe('end-to-end: experienceIntent → composeDesign', () => {
  it('every section has momentTransition: false when no moment is nominated', () => {
    const design = composeDesign(baseInput(), applyDirective({}));
    for (const section of design.layout.sections) {
      assert.equal(section.momentTransition, false, `section ${section.kind} unexpectedly true`);
    }
  });

  it('raises emphasis on the nominated section relative to the same page with no moment', () => {
    const without = composeDesign(baseInput(), applyDirective({}));
    const withMoment = composeDesign(
      baseInput(),
      applyDirective({
        experienceIntent: {
          mode: 'moment-led', moment: 'gallery', momentIntent: 'test', transitionAtMoment: false,
        },
      }),
    );

    const baseline = without.layout.sections.find((s) => s.kind === 'gallery');
    const elevated = withMoment.layout.sections.find((s) => s.kind === 'gallery');
    assert.ok(baseline !== undefined && elevated !== undefined, 'fixture must contain a gallery section');

    const ladder = ['quiet', 'secondary', 'primary', 'lead'];
    assert.ok(
      ladder.indexOf(elevated!.emphasis) >= ladder.indexOf(baseline!.emphasis),
      `emphasis should not drop: ${baseline!.emphasis} → ${elevated!.emphasis}`,
    );
    // It must actually move for this fixture and this section, or the test proves nothing.
    assert.notEqual(elevated!.emphasis, baseline!.emphasis);
  });

  it('sets momentTransition only on the nominated section when transitionAtMoment is true', () => {
    const design = composeDesign(
      baseInput(),
      applyDirective({
        experienceIntent: {
          mode: 'moment-led', moment: 'menu', momentIntent: 'test', transitionAtMoment: true,
        },
      }),
    );
    for (const section of design.layout.sections) {
      assert.equal(section.momentTransition, section.kind === 'menu', `unexpected state for ${section.kind}`);
    }
  });

  it('does not set momentTransition when transitionAtMoment is false, even with a moment', () => {
    const design = composeDesign(
      baseInput(),
      applyDirective({
        experienceIntent: {
          mode: 'moment-led', moment: 'menu', momentIntent: 'test', transitionAtMoment: false,
        },
      }),
    );
    assert.ok(design.layout.sections.every((s) => s.momentTransition === false));
  });

  it('ignores a moment nomination for a section kind this business does not have', () => {
    const minimalInput: ComposeInput = {
      profile: profileFixture(), strategy: strategyFixture(), content: minimalContent,
    };
    const withoutMoment = composeDesign(minimalInput, applyDirective({}));
    const design = composeDesign(
      minimalInput,
      applyDirective({
        experienceIntent: {
          mode: 'moment-led', moment: 'gallery', momentIntent: 'test', transitionAtMoment: true,
        },
      }),
    );
    // minimalContent has only a hero section — no gallery exists to nominate.
    assert.ok(design.layout.sections.every((s) => s.momentTransition === false));
    assert.deepEqual(
      design.layout.sections.map((s) => s.emphasis),
      withoutMoment.layout.sections.map((s) => s.emphasis),
      'emphasis must be unaffected by a moment nomination this content cannot support',
    );
    assert.ok(
      design.notes.some((n) => n.includes('no section of that kind')),
      'expected a note explaining the moment was not honoured',
    );
  });

  it('is deterministic with a moment nominated', () => {
    const options = applyDirective({
      experienceIntent: {
        mode: 'moment-led', moment: 'testimonials', momentIntent: 'test', transitionAtMoment: true,
      },
    });
    const a = composeDesign(baseInput(), options);
    const b = composeDesign(baseInput(), options);
    assert.deepEqual(a, b);
  });
});
