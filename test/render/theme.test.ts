/**
 * Brand voice → tokens.
 *
 * The palette comes from a model, so the interesting cases are all the ones
 * where it is wrong: a colour that is really a CSS fragment, a typeface name
 * with a quote in it, an empty palette.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderStylesheet } from '../../lib/render/css.js';
import { fontStack, isSafeColor, readableForeground, resolveTheme } from '../../lib/render/theme.js';

import type { BrandVoice } from '../../lib/types.js';

function voice(overrides: Partial<BrandVoice> = {}): BrandVoice {
  return {
    tone: 'warm',
    palette: [],
    typography: { heading: '', body: '' },
    ...overrides,
  };
}

describe('isSafeColor', () => {
  it('accepts the hex forms', () => {
    for (const value of ['#abc', '#abcd', '#a1b2c3', '#a1b2c3ff']) {
      assert.ok(isSafeColor(value), value);
    }
  });

  it('accepts functional and named colours', () => {
    for (const value of ['rgb(1 2 3)', 'rgba(1,2,3,0.5)', 'hsl(210 40% 50%)', 'oklch(0.6 0.1 40)', 'teal']) {
      assert.ok(isSafeColor(value), value);
    }
  });

  it('rejects anything that could close a declaration', () => {
    for (const value of ['red; } body { display: none } .x {', 'url(evil.css)', 'expression(1)', '#ggg', '']) {
      assert.ok(!isSafeColor(value), value);
    }
  });
});

describe('resolveTheme', () => {
  it('maps the palette positionally', () => {
    const { theme, warnings } = resolveTheme(voice({ palette: ['#5B3A29', '#c98a3f', '#faf6f0'] }));
    assert.equal(theme.colors.primary, '#5b3a29');
    assert.equal(theme.colors.accent, '#c98a3f');
    assert.equal(theme.colors.surfaceAlt, '#faf6f0');
    assert.deepEqual(warnings, []);
  });

  it('publishes palette entries beyond the three that have a role', () => {
    const { theme } = resolveTheme(voice({ palette: ['#111', '#222', '#333', '#444', '#555'] }));
    assert.deepEqual(theme.extraColors, ['#444', '#555']);
  });

  it('falls back to defaults and warns rather than emitting an unsafe colour', () => {
    const { theme, warnings } = resolveTheme(voice({ palette: ['red; } html { display:none } .x {'] }));
    assert.equal(theme.colors.primary, '#14213d');
    assert.deepEqual(warnings, ['palette[0] is not a recognised CSS colour and was ignored: "red; } html { display:none } .x {"']);
  });

  it('leaves the stylesheet free of the rejected value', () => {
    const injection = '#fff; } * { visibility: hidden } .x {';
    const { theme } = resolveTheme(voice({ palette: [injection] }));
    const css = renderStylesheet(theme);

    assert.ok(!css.includes('visibility: hidden'));
    assert.ok(!css.includes(injection));
    assert.ok(css.includes('--color-primary: #14213d;'));
  });

  it('uses defaults for an empty palette without warning', () => {
    const { theme, warnings } = resolveTheme(voice());
    assert.equal(theme.colors.primary, '#14213d');
    assert.deepEqual(warnings.filter((entry) => entry.startsWith('palette')), []);
  });
});

describe('fontStack', () => {
  it('quotes the family and picks a matching fallback', () => {
    assert.equal(fontStack('Playfair Display').stack, '"Playfair Display", Georgia, "Times New Roman", Times, serif');
    assert.match(fontStack('Inter').stack, /^"Inter", system-ui/);
    assert.match(fontStack('IBM Plex Mono').stack, /ui-monospace/);
  });

  it('strips characters that could terminate the declaration', () => {
    const { stack } = fontStack('Evil", x: y; }');
    assert.ok(!stack.includes(';'));
    assert.ok(!stack.includes('}'));
    assert.equal(stack, '"Evil, x: y", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
  });

  it('falls back to the system stack instead of quoting nothing', () => {
    const { stack, safe } = fontStack('   ');
    assert.equal(safe, false);
    assert.match(stack, /^system-ui/);
  });

  it('warns about a name that was given and could not be used, but not about a blank one', () => {
    const { warnings } = resolveTheme(voice({ typography: { heading: '', body: '{}' } }));
    assert.deepEqual(warnings, ['typography.body is not a usable family name: "{}"']);
  });
});

describe('readableForeground', () => {
  it('picks light text on a dark brand colour and dark on a light one', () => {
    assert.equal(readableForeground('#14213d'), '#ffffff');
    assert.equal(readableForeground('#faf6f0'), '#1b1b1f');
  });

  it('expands shorthand hex', () => {
    assert.equal(readableForeground('#fff'), '#1b1b1f');
  });

  it('defaults to white when the colour cannot be read', () => {
    assert.equal(readableForeground('hsl(210 40% 50%)'), '#ffffff');
  });
});

describe('renderStylesheet', () => {
  it('is a pure function of the theme', () => {
    const { theme } = resolveTheme(voice({ palette: ['#123456'] }));
    assert.equal(renderStylesheet(theme), renderStylesheet(theme));
  });

  it('publishes every token the markup relies on', () => {
    const { theme } = resolveTheme(voice());
    const css = renderStylesheet(theme);
    for (const token of ['--color-primary', '--color-accent', '--font-heading', '--font-body']) {
      assert.ok(css.includes(token), token);
    }
  });

  it('makes no external request', () => {
    const { theme } = resolveTheme(voice());
    const css = renderStylesheet(theme);
    assert.ok(!css.includes('@import'));
    assert.ok(!/url\(\s*https?:/i.test(css));
  });
});
