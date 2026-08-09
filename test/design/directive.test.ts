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

import { applyDirective } from '../../lib/design/directive.js';
import { composeDesign } from '../../lib/design/index.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

import type { ComposeOptions } from '../../lib/design/compose.js';
import type { DesignDirective } from '../../lib/design/directive.js';
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

  it('is a pure function — no observable side effects beyond logging', () => {
    const d: DesignDirective = { direction: 'modern', density: 'balanced' };
    const before = JSON.stringify(d);
    applyDirective(d);
    assert.equal(JSON.stringify(d), before, 'directive was mutated');
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
