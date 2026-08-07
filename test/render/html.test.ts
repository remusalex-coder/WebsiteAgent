/**
 * The escaping and serialisation primitives.
 *
 * These are the tests that matter most in the renderer: every other module
 * assumes that a string which went through `text()` or an attribute value can
 * no longer change the shape of the document.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  attributes,
  element,
  escapeAttribute,
  escapeText,
  join,
  jsonLd,
  paragraphs,
  raw,
  slug,
  text,
} from '../../lib/render/html.js';

describe('escapeText', () => {
  it('neutralises the characters that open a tag or an entity', () => {
    assert.equal(escapeText('<script>alert("x") & co</script>'),
      '&lt;script&gt;alert("x") &amp; co&lt;/script&gt;');
  });

  it('escapes the ampersand before anything else, so entities are not doubled', () => {
    assert.equal(escapeText('&lt;'), '&amp;lt;');
  });

  it('leaves text with nothing to escape byte-identical', () => {
    assert.equal(escapeText('Padaria Ana, Lisboa — 07:00'), 'Padaria Ana, Lisboa — 07:00');
  });
});

describe('escapeAttribute', () => {
  it('escapes both quote styles', () => {
    assert.equal(escapeAttribute(`" onload="alert(1)`), '&quot; onload=&quot;alert(1)');
    assert.equal(escapeAttribute("' onload='alert(1)"), '&#39; onload=&#39;alert(1)');
  });

  it('cannot break out of an attribute', () => {
    const html = element('a', { href: '#x', title: '"><img src=x onerror=alert(1)>' }, text('go'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&quot;&gt;&lt;img'));
  });
});

describe('attributes', () => {
  it('keeps declaration order, so output is stable', () => {
    assert.equal(attributes({ id: 'a', class: 'b', href: '#c' }), ' id="a" class="b" href="#c"');
  });

  it('omits null, undefined and false', () => {
    assert.equal(attributes({ a: null, b: undefined, c: false, d: 'kept' }), ' d="kept"');
  });

  it('writes a true value as a bare boolean attribute', () => {
    assert.equal(attributes({ hidden: true }), ' hidden');
  });

  it('accepts numbers', () => {
    assert.equal(attributes({ width: 240 }), ' width="240"');
  });
});

describe('element', () => {
  it('keeps a short single child inline', () => {
    assert.equal(element('p', {}, text('hello')), '<p>hello</p>');
  });

  it('indents multiple children one level', () => {
    assert.equal(
      element('ul', {}, [element('li', {}, text('a')), element('li', {}, text('b'))]),
      '<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>',
    );
  });

  it('omits the closing tag for a void element', () => {
    assert.equal(element('img', { src: 'a.png', alt: '' }), '<img src="a.png" alt="">');
  });

  it('renders an element with no children as an empty pair', () => {
    assert.equal(element('div', { class: 'x' }), '<div class="x"></div>');
  });

  it('drops null children so a caller can inline a conditional', () => {
    assert.equal(element('p', {}, [null, text('kept'), null]), '<p>kept</p>');
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and collapses soft wraps', () => {
    assert.equal(
      paragraphs('one\nstill one\n\ntwo'),
      '<p>one still one</p>\n<p>two</p>',
    );
  });

  it('produces nothing for whitespace-only prose', () => {
    assert.equal(paragraphs('   \n\n  '), '');
  });

  it('escapes each paragraph', () => {
    assert.equal(paragraphs('a & <b>'), '<p>a &amp; &lt;b&gt;</p>');
  });
});

describe('slug', () => {
  it('makes a readable fragment', () => {
    assert.equal(slug('What we bake!'), 'what-we-bake');
  });

  it('returns an empty string when there is no ASCII to work with', () => {
    assert.equal(slug('日本語'), '');
  });
});

describe('jsonLd', () => {
  it('cannot close the script element it sits in', () => {
    const payload = jsonLd({ description: '</script><script>alert(1)</script>' });
    assert.ok(!payload.includes('</script>'));
    assert.ok(payload.includes('\\u003c/script\\u003e'));
  });

  it('still parses back to the original value', () => {
    const value = { name: 'A & B', nested: { '@type': 'Thing' }, list: [1, 2] };
    const parsed: unknown = JSON.parse(jsonLd(value)
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>')
      .replace(/\\u0026/g, '&'));
    assert.deepEqual(parsed, value);
  });

  it('sorts keys, so two equal payloads serialise identically', () => {
    assert.equal(jsonLd({ b: 1, a: 2 }), jsonLd({ a: 2, b: 1 }));
  });

  it('preserves array order, which is meaningful', () => {
    assert.equal(jsonLd(['b', 'a']), '[\n  "b",\n  "a"\n]');
  });
});

describe('join and raw', () => {
  it('joins with a separator and drops nulls', () => {
    assert.equal(join([text('a'), null, text('b')], '-'), 'a-b');
  });

  it('lets a caller opt out of escaping explicitly', () => {
    assert.equal(join([raw('&copy; '), text('A & B')]), '&copy; A &amp; B');
  });
});
