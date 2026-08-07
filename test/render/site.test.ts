/**
 * `renderSite` end to end.
 *
 * Assertions are made against the markup as a string rather than through a DOM
 * library — the renderer's product *is* the string, and a parser would hide the
 * difference between an escaped `&amp;` and a raw `&`, which is the thing most
 * worth checking.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderSite } from '../../lib/render/index.js';
import { emptyContent, fullContent, minimalContent } from '../fixtures/content.js';

import type { WebsiteContent, WebsiteSection } from '../../lib/types.js';

/** The `index.html` of a render. */
function html(content: WebsiteContent): string {
  const file = renderSite(content).files.find((entry) => entry.path === 'index.html');
  assert.ok(file, 'index.html was not rendered');
  return file.contents;
}

function count(haystack: string, needle: RegExp): number {
  return haystack.match(needle)?.length ?? 0;
}

function section(overrides: Partial<WebsiteSection> = {}): WebsiteSection {
  return {
    kind: 'about',
    heading: 'About',
    subheading: null,
    body: '',
    bullets: [],
    images: [],
    callToAction: null,
    ...overrides,
  };
}

function withSections(sections: readonly WebsiteSection[]): WebsiteContent {
  return { ...minimalContent, sections };
}

/* ------------------------------------------------------------------ */
/* Output shape                                                        */
/* ------------------------------------------------------------------ */

describe('renderSite output', () => {
  it('produces index.html and styles.css, in that order', () => {
    const site = renderSite(fullContent);
    assert.deepEqual(site.files.map((file) => file.path), ['index.html', 'styles.css']);
  });

  it('honours renamed output files', () => {
    const site = renderSite(minimalContent, { htmlFileName: 'page.html', cssFileName: 'main.css' });
    assert.deepEqual(site.files.map((file) => file.path), ['page.html', 'main.css']);
    assert.ok(site.files[0]?.contents.includes('href="main.css"'));
  });

  it('refuses to let an output name escape the site root', () => {
    const site = renderSite(minimalContent, { htmlFileName: '../../evil.html' });
    assert.equal(site.files[0]?.path, 'evil.html');
  });

  it('lists every downloaded asset the page refers to, once', () => {
    const site = renderSite(fullContent);
    assert.deepEqual(site.assets, [
      { sourcePath: 'assets/hero-e5f6.jpg', path: 'assets/hero-e5f6.jpg' },
      { sourcePath: 'assets/logo-a1b2.png', path: 'assets/logo-a1b2.png' },
      { sourcePath: 'assets/favicon-c3d4.ico', path: 'assets/favicon-c3d4.ico' },
    ]);
  });

  it('reports what it had to work around instead of throwing', () => {
    const site = renderSite(fullContent);
    assert.equal(site.warnings.length, 1);
    assert.match(site.warnings[0] ?? '', /no usable location/);
  });
});

/* ------------------------------------------------------------------ */
/* Document structure                                                  */
/* ------------------------------------------------------------------ */

describe('document structure', () => {
  const page = html(fullContent);

  it('is a well-formed HTML5 document', () => {
    assert.ok(page.startsWith('<!doctype html>\n<html lang="en">'));
    assert.ok(page.trimEnd().endsWith('</html>'));
    assert.ok(page.includes('<meta charset="utf-8">'));
    assert.ok(page.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
  });

  it('uses the language it was given', () => {
    assert.ok(html({ ...minimalContent }).includes('lang="en"'));
    assert.ok(renderSite(minimalContent, { lang: 'pt-PT' }).files[0]?.contents.includes('lang="pt-PT"'));
  });

  it('has exactly one h1', () => {
    assert.equal(count(page, /<h1[\s>]/g), 1);
  });

  it('uses the landmark elements a screen reader navigates by', () => {
    for (const landmark of ['<header class="site-header">', '<nav ', '<main id="main"', '<footer class="site-footer">']) {
      assert.ok(page.includes(landmark), landmark);
    }
  });

  it('opens with a skip link pointing at main', () => {
    assert.ok(page.includes('<a class="skip-link" href="#main">Skip to content</a>'));
    assert.ok(page.includes('<main id="main" class="site-main" tabindex="-1">'));
  });

  it('names every section landmark with its own heading', () => {
    const labelled = page.match(/<section id="([^"]+)" class="[^"]*" aria-labelledby="([^"]+)"/g) ?? [];
    assert.equal(labelled.length, fullContent.sections.length);
    for (const match of labelled) {
      const [, id, headingId] = /id="([^"]+)".*aria-labelledby="([^"]+)"/.exec(match) ?? [];
      assert.equal(headingId, `${id}-heading`);
      assert.ok(page.includes(`id="${headingId}"`));
    }
  });

  it('links the stylesheet and no external resource', () => {
    assert.ok(page.includes('<link rel="stylesheet" href="styles.css">'));
    assert.ok(!/<(link|script)[^>]+https?:\/\//.test(page));
  });

  it('carries the JSON-LD the writer produced', () => {
    assert.ok(page.includes('<script type="application/ld+json">'));
    assert.ok(page.includes('"@type": "LocalBusiness"'));
  });

  it('gives the site a footer with no clock-dependent content', () => {
    assert.ok(page.includes('&copy; Padaria Ana &amp; Sons &lt;Lisboa&gt;'));
    assert.ok(!/©\s*\d{4}|20\d\d/.test(page.slice(page.indexOf('<footer'))));
  });
});

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

describe('sections', () => {
  const page = html(fullContent);

  it('renders every section in the spec, in order', () => {
    const kinds = [...page.matchAll(/<section id="[^"]*" class="section section--([a-z]+)/g)]
      .map((match) => match[1]);
    assert.deepEqual(kinds, fullContent.sections.map((entry) => entry.kind));
  });

  it('gives each section a fragment derived from its heading', () => {
    assert.ok(page.includes('id="bread-baked-before-dawn"'));
    assert.ok(page.includes('id="what-we-bake"'));
  });

  it('builds the navigation from the sections worth linking to', () => {
    const labels = [...page.matchAll(/class="site-nav__link" href="#[^"]+">([^<]+)</g)]
      .map((match) => match[1]);
    // The hero and the CTA banner are not navigation targets.
    assert.deepEqual(labels, [
      'About "the oven"',
      'What we bake',
      'Menu',
      'The shop',
      'What people say',
      'Opening hours',
      'Find us',
      'Contact',
      'Questions',
    ]);
  });

  it('shows the tagline above the hero heading', () => {
    assert.ok(page.includes('<p class="hero__tagline">Bread, coffee &amp; nothing else</p>'));
  });

  it('lays out service bullets as cards and testimonials as quotes', () => {
    assert.ok(page.includes('<ul class="card-grid" role="list">'));
    assert.ok(page.includes('<blockquote class="quote">'));
    assert.ok(page.includes('<ul class="plain-list" role="list">'));
  });

  it('renders a gallery as figures and omits the unusable image', () => {
    assert.ok(page.includes('<figcaption>The counter at opening time</figcaption>'));
    assert.equal(count(page, /<li class="gallery__item">/g), 1);
  });

  it('loads the hero image eagerly and everything else lazily', () => {
    assert.ok(page.includes('src="assets/hero-e5f6.jpg" alt="Loaves cooling on a rack" width="1600" height="900" loading="eager"'));
    assert.ok(page.includes('loading="lazy"'));
  });

  it('promotes the logo to the header and the favicon to head, not the hero', () => {
    assert.ok(page.includes('<link rel="icon" href="assets/favicon-c3d4.ico">'));
    assert.ok(page.includes('<img class="brand__logo" src="assets/logo-a1b2.png" alt="Padaria Ana &amp; Sons &lt;Lisboa&gt;"'));
    assert.equal(count(page, /assets\/logo-a1b2\.png/g), 1);
  });

  it('alternates section backgrounds without counting the hero or the banner', () => {
    const about = page.indexOf('class="section section--about');
    assert.ok(!page.slice(about, about + 80).includes('section--alt'));
    assert.ok(page.includes('class="section section--services section--alt"'));
  });
});

/* ------------------------------------------------------------------ */
/* Optional fields                                                     */
/* ------------------------------------------------------------------ */

describe('missing optional fields', () => {
  it('renders a spec whose every optional field is empty', () => {
    const page = html(minimalContent);
    assert.ok(page.includes('<h1 id="corner-shop-heading">Corner Shop</h1>'));
    assert.equal(count(page, /<h1[\s>]/g), 1);
  });

  it('omits the subheading, body, bullets, images and action entirely', () => {
    const page = html(minimalContent);
    for (const absent of ['section__subheading', 'section__body', 'plain-list', '<img', 'section__actions']) {
      assert.ok(!page.includes(absent), absent);
    }
  });

  it('omits the tagline paragraph when the tagline is empty', () => {
    assert.ok(!html(minimalContent).includes('hero__tagline'));
  });

  it('omits the keywords meta when there are no keywords', () => {
    assert.ok(!html(minimalContent).includes('name="keywords"'));
    // Blank entries are filtered rather than emitted as a trailing comma.
    assert.ok(html(fullContent).includes('content="bakery lisboa, pastel de nata"'));
  });

  it('omits the navigation when nothing is worth linking to', () => {
    assert.ok(!html(minimalContent).includes('site-nav'));
  });

  it('omits empty head metadata rather than emitting it blank, and says so', () => {
    const site = renderSite(minimalContent);
    const page = site.files[0]?.contents ?? '';

    assert.ok(!page.includes('name="description"'));
    assert.ok(!page.includes('og:description'));
    assert.ok(!page.includes('application/ld+json'));
    assert.deepEqual(site.warnings, [
      'seo.description is empty; no description meta was emitted',
      'seo.structuredData is empty; no JSON-LD was emitted',
    ]);
  });

  it('falls back to the business name when seo.title is empty', () => {
    const site = renderSite({ ...minimalContent, seo: { ...minimalContent.seo, title: '  ' } });
    assert.ok(site.files[0]?.contents.includes('<title>Corner Shop</title>'));
    assert.ok(site.warnings.some((warning) => /seo\.title is empty/.test(warning)));
  });

  it('still produces a titled document with one h1 when there are no sections', () => {
    const page = html(emptyContent);
    assert.ok(page.includes('<h1>Nothing Yet</h1>'));
    assert.ok(page.includes('A tagline and no sections'));
    assert.equal(count(page, /<h1[\s>]/g), 1);
  });

  it('gives a headingless section an accessible name it does not display', () => {
    const page = html(withSections([section({ heading: '  ', kind: 'contact' })]));
    assert.ok(page.includes('class="visually-hidden">contact</h1>'));
    assert.ok(!page.includes('class="site-nav__link"'));
  });

  it('falls back to a positional fragment when a heading yields no slug', () => {
    const page = html(withSections([section({ heading: '日本語', kind: 'about' })]));
    assert.ok(page.includes('id="about"'));
  });

  it('deduplicates fragments when two sections share a heading', () => {
    const page = html(withSections([section({ heading: 'Contact' }), section({ heading: 'Contact' })]));
    assert.ok(page.includes('id="contact"'));
    assert.ok(page.includes('id="contact-2"'));
    assert.ok(page.includes('href="#contact-2"'));
  });
});

/* ------------------------------------------------------------------ */
/* Escaping                                                            */
/* ------------------------------------------------------------------ */

describe('escaping', () => {
  it('escapes the business name everywhere it appears', () => {
    const page = html(fullContent);
    assert.ok(!page.includes('Ana & Sons <Lisboa>'));
    assert.equal(count(page, /Padaria Ana &amp; Sons &lt;Lisboa&gt;/g), 4);
  });

  it('leaves a quote mark alone in a text node but escapes it in an attribute', () => {
    const page = html(fullContent);
    // A quote needs no escaping between tags, and escaping it there would show
    // `&quot;` to the reader.
    assert.ok(page.includes('<h2 id="about-the-oven-heading">About "the oven"</h2>'));

    const page2 = html(withSections([section({ heading: 'x', callToAction: { label: 'go', href: 'https://a.test/?q="' } })]));
    assert.ok(page2.includes('href="https://a.test/?q=&quot;"'));
  });

  it('escapes angle brackets in bullet text', () => {
    assert.ok(html(fullContent).includes('Sourdough &lt;400g&gt;'));
  });

  it('cannot be made to emit a script element from content', () => {
    const page = html(withSections([
      section({
        heading: '<script>alert(1)</script>',
        subheading: '<img src=x onerror=alert(1)>',
        body: '</p><script>alert(2)</script>',
        bullets: ['<svg onload=alert(3)>'],
        callToAction: { label: '<b>go</b>', href: 'https://a.test' },
      }),
    ]));

    // This spec has no structured data, so the page should hold no script at all.
    assert.equal(count(page, /<script/g), 0);
    assert.ok(!page.includes('<img src=x'));
    assert.ok(!page.includes('<svg'));
    assert.ok(page.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  it('keeps a script payload inside JSON-LD from closing its own element', () => {
    const page = html(fullContent);
    assert.equal(count(page, /<\/script>/g), 1);
    assert.ok(page.includes('\\u003c/script\\u003e'));
  });

  it('escapes an attribute injection attempt in a call to action', () => {
    const page = html(withSections([
      section({ callToAction: { label: 'go', href: 'https://a.test/"><script>alert(1)</script>' } }),
    ]));
    assert.ok(!page.includes('"><script>'));
    assert.ok(page.includes('&quot;&gt;&lt;script&gt;'));
  });
});

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

describe('call to action links', () => {
  it('renders an allowed scheme as a button', () => {
    const page = html(withSections([
      section({ callToAction: { label: 'Call the shop', href: 'tel:+351210000000' } }),
    ]));
    assert.ok(page.includes('<a class="button button--ghost" href="tel:+351210000000">Call the shop</a>'));
  });

  it('keeps the label but drops the link when the scheme is refused', () => {
    const content = withSections([
      section({ callToAction: { label: 'Click me', href: 'javascript:alert(1)' } }),
    ]);
    const site = renderSite(content);
    const page = site.files[0]?.contents ?? '';

    assert.ok(page.includes('<p class="section__actions">Click me</p>'));
    assert.ok(!page.includes('javascript:'));
    assert.ok(site.warnings.some((warning) => /unsupported link/.test(warning)));
  });

  it('drops a call to action with no label', () => {
    const page = html(withSections([section({ callToAction: { label: '  ', href: 'https://a.test' } })]));
    assert.ok(!page.includes('section__actions'));
  });
});

/* ------------------------------------------------------------------ */
/* Determinism                                                         */
/* ------------------------------------------------------------------ */

describe('determinism', () => {
  it('renders the same spec to the same bytes', () => {
    const first = renderSite(fullContent);
    const second = renderSite(fullContent);
    assert.deepEqual(first, second);
  });

  it('renders the same bytes from a spec that round-tripped through JSON', () => {
    const clone = JSON.parse(JSON.stringify(fullContent)) as WebsiteContent;
    assert.deepEqual(renderSite(clone), renderSite(fullContent));
  });

  it('does not depend on the key order of structuredData', () => {
    const reordered: WebsiteContent = {
      ...minimalContent,
      seo: { ...minimalContent.seo, structuredData: { b: 1, a: { d: 2, c: 3 } } },
    };
    const same: WebsiteContent = {
      ...minimalContent,
      seo: { ...minimalContent.seo, structuredData: { a: { c: 3, d: 2 }, b: 1 } },
    };
    assert.equal(html(reordered), html(same));
  });

  it('embeds no timestamp, hostname or random value', () => {
    const page = html(fullContent);
    assert.ok(!/\b20\d\d-\d\d-\d\dT/.test(page));
    assert.ok(!/generated on/i.test(page));
  });
});
