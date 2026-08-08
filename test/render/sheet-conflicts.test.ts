/**
 * The two stylesheets must not silently disagree.
 *
 * `renderStylesheet` is emitted first and `designRules` second, so where both
 * declare the same property on the same selector at equal specificity the
 * second wins with no warning of any kind. That has now produced three separate
 * production defects:
 *
 * 1. **Colour tokens.** The variants sheet re-declared a semantic colour and
 *    the base sheet's contrast guarantee stopped applying.
 * 2. **The viewport cap on the hero headline.** The base sheet capped the
 *    display size at 11vw; the variants sheet did not, so a 390px phone
 *    rendered a 77px headline nine lines deep reading "Seaso / nal / organ /
 *    ic".
 * 3. **The column cap on the hero headline.** Same rule, same failure, six
 *    weeks later: the base sheet learned to cap the display size by the
 *    headline's longest word, the variants sheet did not, and Zuni Café shipped
 *    a hero reading "Californi / an / restauran / t".
 *
 * Each was found by a person looking at a screenshot. This test is the general
 * form of the problem: any property declared on the same selector in both
 * sheets is either deliberate — and belongs in the allow-list below, with a
 * reason — or is the next occurrence of INF-007.
 *
 * It deliberately does not try to parse CSS properly. A tolerant scan that
 * catches the failure mode is worth more than a correct parser nobody writes.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderStylesheet } from '../../lib/render/css.js';
import { designRules } from '../../lib/render/variants.js';
import { resolveTheme } from '../../lib/render/theme.js';
import { composeDesign } from '../../lib/design/compose.js';
import { fullContent } from '../fixtures/content.js';
import { profileFixture } from '../fixtures/business.js';

/**
 * What the guard actually protects, and why it is not "any disagreement".
 *
 * The first draft of this test flagged twenty-one overrides and twenty of them
 * were correct — the variants sheet replacing a hard-coded base fallback with
 * the design token that specialises it (`0.9375rem` becoming
 * `var(--text-small-size)`). That is the design layer's whole job, and a test
 * that fails on it would be deleted within a week.
 *
 * All three real defects share a narrower shape: the base sheet wrapped a value
 * in a **protective bound** — a `min()` against a viewport or container unit,
 * a `clamp()` — and the variants sheet restated the property without it. So the
 * rule is: a later sheet may change a value freely, and may not quietly discard
 * a bound the earlier sheet was relying on.
 *
 * This is deliberately not "CSS correctness". It is one specific way this
 * codebase has hurt itself three times.
 */
const BOUND = /\b(min|max|clamp)\s*\(/;

/** Viewport and container units, which only ever appear as caps here. */
const CAP_UNIT = /\d+(?:\.\d+)?(vw|vh|vmin|vmax|cqi|cqw|cqb)\b/g;

/**
 * Drops the fallback half of every `var(--token, fallback)`.
 *
 * A fallback is what applies when the design layer supplied nothing; a cap is
 * what applies when it did. The base sheet's display size carries
 * `clamp(2rem, 1.4rem + 3vw, 3.5rem)` as a fallback, and reading its `3vw` as a
 * bound made this test demand that the variants sheet restate a default it is
 * always overriding. That is the false positive that would have taught the next
 * engineer to ignore the test.
 */
function withoutFallbacks(value: string): string {
  // Scanned rather than matched: a fallback may itself contain parentheses —
  // the real one here is `clamp(2rem, 1.4rem + 3vw, 3.5rem)` — and no regex
  // over a balanced language gets that right.
  let out = '';
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf('var(', index);
    if (start === -1) {
      out += value.slice(index);
      break;
    }

    out += value.slice(index, start);

    let depth = 0;
    let comma = -1;
    let cursor = start + 3; // at the '('
    for (; cursor < value.length; cursor += 1) {
      const char = value[cursor];
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) break;
      } else if (char === ',' && depth === 1 && comma === -1) comma = cursor;
    }

    // Unbalanced: emit the remainder untouched rather than guessing.
    if (depth !== 0) {
      out += value.slice(start);
      break;
    }

    const token = value.slice(start + 4, comma === -1 ? cursor : comma).trim();
    out += `var(${token})`;
    index = cursor + 1;
  }

  return out;
}


/** Declarations as `selector` → `property` → value, tolerant of nesting. */
function declarations(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();

  // Strip comments first: they contain braces, colons and semicolons.
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Every `selector { body }` where the body has no nested block. At-rules keep
  // their inner blocks, which this skips — a media query is a different cascade
  // context and comparing across them would be noise.
  const RULE = /([^{}@]+)\{([^{}]*)\}/g;
  for (const match of cleaned.matchAll(RULE)) {
    const selectors = (match[1] ?? '').trim();
    const body = match[2] ?? '';
    if (selectors === '' || selectors.startsWith('@')) continue;

    for (const selector of selectors.split(',').map((entry) => entry.trim())) {
      if (selector === '') continue;
      const bucket = out.get(selector) ?? new Map<string, string>();

      for (const line of body.split(';')) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const property = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim().replace(/\s+/g, ' ');
        // Custom properties are the intended channel between the sheets.
        if (property === '' || property.startsWith('--')) continue;
        bucket.set(property, value);
      }

      out.set(selector, bucket);
    }
  }

  return out;
}

describe('the base and variant stylesheets', () => {
  it('never let the later sheet discard a bound the earlier one set', () => {
    const design = composeDesign({ profile: profileFixture(), content: fullContent });
    const base = declarations(renderStylesheet(resolveTheme(fullContent.voice).theme));
    const variants = declarations(designRules(design));

    const conflicts: string[] = [];

    for (const [selector, properties] of variants) {
      const inBase = base.get(selector);
      if (inBase === undefined) continue;

      for (const [property, value] of properties) {
        const baseValue = inBase.get(property);
        if (baseValue === undefined || baseValue === value) continue;

        const baseBounds = withoutFallbacks(baseValue);
        const dropped: string[] = [];
        if (BOUND.test(baseBounds) && !BOUND.test(value)) dropped.push('its min()/max()/clamp()');
        for (const unit of new Set(baseBounds.match(CAP_UNIT) ?? [])) {
          if (!value.includes(unit)) dropped.push(unit);
        }
        if (dropped.length === 0) continue;

        conflicts.push(
          `${selector} { ${property} } dropped ${dropped.join(' and ')}\n` +
            `      base:     ${baseValue}\n` +
            `      variants: ${value}`,
        );
      }
    }

    assert.deepEqual(
      conflicts,
      [],
      'A property declared on the same selector in both sheets: the variants sheet ' +
        'is emitted second and wins silently at equal specificity. Either make the ' +
        'two agree, or add the property to DELIBERATE_OVERRIDES with a reason. ' +
        'This is INF-007 and it has shipped three visual defects.',
    );
  });

  it('caps the hero headline by the viewport AND by its column, in both sheets', () => {
    // The specific instance of the rule above that shipped twice. Named
    // explicitly because the general test can be satisfied by deleting a cap
    // from both sheets, which would be the wrong repair.
    const design = composeDesign({ profile: profileFixture(), content: fullContent });

    for (const [name, css] of [
      ['base', renderStylesheet(resolveTheme(fullContent.voice).theme)],
      ['variants', designRules(design)],
    ] as const) {
      const rule = declarations(css).get('.section--hero h1');
      assert.ok(rule !== undefined, `${name} sheet should style the hero headline`);

      const fontSize = rule?.get('font-size') ?? '';
      assert.match(fontSize, /11vw/, `${name}: the viewport cap is missing`);
      assert.match(fontSize, /cqi/, `${name}: the column cap is missing`);
      assert.match(fontSize, /--headline-chars/, `${name}: the word-length cap is missing`);
    }
  });
});
