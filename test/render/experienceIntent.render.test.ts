/**
 * The craft register and signature-moment machinery, followed through to the
 * actual markup and CSS a business receives — not just the design artifact.
 *
 * `test/design/benchmark.test.ts` proves a craft business with real evidence
 * (`mechanicRich`) earns a showcase experience with a `gallery` signature at
 * `emphasis: 'lead'` / `fullBleed: true`. This file proves that decision
 * survives into HTML classes and CSS rules, and that the hero treatment
 * itself is driven by whether the business has a photograph to lead with —
 * not by which business it is.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeDesign } from '../../lib/design/compose.js';
import { renderSite } from '../../lib/render/index.js';
import { profileFixture } from '../fixtures/business.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

import type { BusinessProfile, ImageAsset, WebsiteContent } from '../../lib/types.js';

function craftImage(alt: string, i: number, w: number, h: number): ImageAsset {
  return {
    url: `https://workshop.example/img${i}.jpg`,
    role: 'gallery',
    alt,
    width: w,
    height: h,
    localPath: `assets/g${i}.jpg`,
    bytes: 200000,
    sourceUrl: 'https://workshop.example/page',
  };
}

/**
 * A workshop with real craft evidence: skilled-trade vocabulary, a broad
 * service list and a real photo set — the render-level counterpart of
 * `mechanicRich` in `test/design/benchmark.test.ts`.
 */
function craftBusiness(): { profile: BusinessProfile; content: WebsiteContent } {
  const specs: readonly [string, number, number][] = [
    ['engine bay', 1600, 1066],
    ['workshop lift', 1600, 1066],
    ['technician at work', 1200, 1600],
    ['tool wall', 1600, 1066],
    ['brake replacement', 1400, 1400],
  ];
  const images = specs.map(([alt, w, h], i) => craftImage(alt, i, w, h));

  const description =
    'A family-run workshop offering precision diagnostics and certified repairs: servicing, MOT, brakes '
    + 'and timing belts, carried out by qualified technicians on every car that comes through the garage.';

  const profile: BusinessProfile = {
    ...profileFixture({
      category: 'Auto repair',
      description,
      services: ['Servicing', 'MOT', 'Repairs', 'Diagnostics', 'Brakes', 'Timing belts'],
      rating: 4.6,
      phone: '0700 000 000',
    }),
    images: { logo: null, favicon: null, hero: images[0] ?? null, gallery: images.slice(1) },
  };

  const content: WebsiteContent = {
    ...minimalContent,
    businessName: 'Workshop',
    tagline: 'Precision workshop, certified technicians',
    sections: [
      {
        kind: 'hero', heading: 'Precision workshop, certified technicians', subheading: null,
        body: '', bullets: [], images: [], callToAction: { label: 'Call', href: 'tel:0700' },
      },
      {
        kind: 'about', heading: 'About', subheading: null,
        body: description, bullets: [], images: [], callToAction: null,
      },
      {
        kind: 'services', heading: 'Services', subheading: null, body: '',
        bullets: ['Servicing — full service', 'MOT — annual test', 'Repairs — all makes', 'Diagnostics — computerised', 'Brakes — pads and discs', 'Timing belts — replacement'],
        images: [], callToAction: null,
      },
      {
        kind: 'gallery', heading: 'Gallery', subheading: null, body: '',
        bullets: [], images, callToAction: null,
      },
      {
        kind: 'hours', heading: 'Hours', subheading: null, body: '',
        bullets: ['Monday to Friday — 08:00–18:00'], images: [], callToAction: null,
      },
      {
        kind: 'location', heading: 'Location', subheading: null, body: '',
        bullets: ['Address — 1 Workshop Lane'], images: [], callToAction: null,
      },
      {
        kind: 'contact', heading: 'Contact', subheading: null, body: '',
        bullets: [], images: [], callToAction: { label: 'Call', href: 'tel:0700' },
      },
      {
        kind: 'cta', heading: 'Book a service', subheading: null, body: '',
        bullets: [], images: [], callToAction: { label: 'Call', href: 'tel:0700' },
      },
    ],
    trust: [{ kind: 'rating', label: '4.6', source: 'maps' }],
    facts: ['Servicing', 'MOT', 'Repairs', 'Diagnostics'],
  };

  return { profile, content };
}

describe('the craft register reaches the rendered page', () => {
  const { profile, content } = craftBusiness();
  const design = composeDesign({ profile, content });

  it('earns a non-brochure experience with a gallery signature at lead emphasis and full bleed', () => {
    assert.notEqual(design.experience.mode, 'brochure');
    assert.equal(design.experience.signatureMoment, 'gallery');
    const gallery = design.layout.sections.find((s) => s.kind === 'gallery');
    assert.equal(gallery?.emphasis, 'lead');
    assert.equal(gallery?.fullBleed, true);
  });

  it('renders the signature section full-bleed, at lead emphasis, marked as the signature role', () => {
    const html = renderSite(content, { design }).files[0]?.contents ?? '';
    const match = /<section[^>]*class="[^"]*section--gallery[^"]*"[^>]*>/.exec(html);
    assert.ok(match !== null, 'gallery section not found in the markup');
    const openTag = match![0];

    assert.ok(openTag.includes('section--bleed'), 'gallery section should carry the full-bleed class');
    assert.ok(openTag.includes('data-emphasis="lead"'), 'gallery section should be lead emphasis');
    assert.ok(openTag.includes('data-role="signature"'), 'gallery section should carry the signature role');
  });

  it('emits a CSS rule that gives the signature beat a visibly larger type scale', () => {
    const stylesheet = renderSite(content, { design }).files[1]?.contents ?? '';
    assert.ok(stylesheet.includes('[data-role="signature"]'), 'the signature beat needs its own CSS rule');
    assert.ok(stylesheet.includes('.section.section--bleed'), 'a full-bleed section needs its own CSS rule');
  });

  it('gives each image a role and framing driven by what it shows, not a uniform grid cell', () => {
    const html = renderSite(content, { design }).files[0]?.contents ?? '';
    const tags = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length >= 4, 'expected the gallery images to render');

    const roleOf = (alt: string): string | null =>
      tags.find((t) => t.includes(`alt="${alt}"`))?.match(/data-role="([^"]+)"/)?.[1] ?? null;
    const framingOf = (alt: string): string | null =>
      tags.find((t) => t.includes(`alt="${alt}"`))?.match(/data-framing="([^"]+)"/)?.[1] ?? null;

    // The landscape lead image is the hero, the next-strongest landscape shot
    // is the narrative's signature moment, the portrait shot reads as a close
    // detail, and the square shot lands on a contrast beat as a process step —
    // four different roles, not one gallery grid.
    assert.equal(roleOf('engine bay'), 'hero');
    assert.equal(roleOf('workshop lift'), 'signature');
    assert.equal(roleOf('technician at work'), 'detail');
    assert.equal(roleOf('brake replacement'), 'process');

    const roles = new Set(tags.map((t) => t.match(/data-role="([^"]+)"/)?.[1]).filter(Boolean));
    assert.ok(roles.size >= 4, `expected at least 4 distinct image roles, got ${[...roles].join(', ')}`);

    // A role's aspect intent is a deviation from the page default, not a
    // repaint of it: the detail shot composes square, the process shot tall.
    assert.equal(framingOf('technician at work'), 'square');
    assert.equal(framingOf('brake replacement'), 'tall');
    assert.notEqual(framingOf('technician at work'), framingOf('brake replacement'));

    // The signature image gets the same dominant wide framing as the hero —
    // the two anchor images of the page, not gallery filler.
    assert.equal(framingOf('engine bay'), 'wide');
    assert.equal(framingOf('workshop lift'), 'wide');
  });
});

describe('adjacent sections read as different frames, not one repeated silhouette', () => {
  it('varies data-frame across the page rather than stamping every section the same', () => {
    const { profile, content } = craftBusiness();
    const design = composeDesign({ profile, content });
    const html = renderSite(content, { design }).files[0]?.contents ?? '';
    const frames = [...html.matchAll(/<section[^>]*\bdata-frame="([^"]+)"/g)].map((m) => m[1]!);
    assert.ok(frames.length >= 5, 'expected several sections to compare');

    // `statement` is content-forced and is the one frame allowed to repeat
    // (see `assignFrames` in lib/design/layout.ts) — every other adjacent
    // pair must differ, or the page's silhouette is not actually varying.
    for (let i = 1; i < frames.length; i += 1) {
      const prev = frames[i - 1]!;
      const current = frames[i]!;
      if (prev === 'statement' && current === 'statement') continue;
      assert.notEqual(current, prev, `sections ${i - 1} and ${i} both used frame "${current}"`);
    }

    const distinctFrames = new Set(frames);
    assert.ok(distinctFrames.size >= 4, `expected real variety of frames, got only ${[...distinctFrames].join(', ')}`);
  });
});

describe('the signature beat composes as a visible break, not just a bigger heading', () => {
  it('marks the signature section with its own composition class, distinct from an ordinary section', () => {
    const { profile, content } = craftBusiness();
    const design = composeDesign({ profile, content });
    const html = renderSite(content, { design }).files[0]?.contents ?? '';

    const signatureTag = /<section[^>]*data-role="signature"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(signatureTag.includes('section--signature-composition'),
      'the signature section should carry its own composition class beyond heading size and dark band');

    const ordinaryTag = /<section[^>]*class="[^"]*section--services[^"]*"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(!ordinaryTag.includes('section--signature-composition'),
      'an ordinary section must not carry the signature composition class');
  });

  it('keeps the type scale ladder hero > signature > ordinary section, each capped against a different token', () => {
    const { profile, content } = craftBusiness();
    const design = composeDesign({ profile, content });
    const stylesheet = renderSite(content, { design }).files[1]?.contents ?? '';

    // The hero's own heading is capped at the page's display token (with a
    // safe fallback so the headline never collapses if the token is absent).
    const heroRule = /\.section--hero h1 \{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(heroRule.includes('var(--text-display-size'), 'hero h1 should cap against the display token');

    // The signature beat is capped at a fraction of that same token, so it can
    // never out-scale the hero on any theme's scale, at any viewport — this is
    // the fix for the inverted ladder (signature ~86px against a ~49px hero).
    const signatureRule = /\.section\[data-role="signature"\]:not\(\.section--hero\) \.section__head h2 \{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(signatureRule.includes('calc(var(--text-display-size) * 0.82)'),
      'signature h2 should cap at a fraction of the hero display token, never the full value');

    // An ordinary section's heading is set from the page's h2 token, a
    // smaller, independent scale step — not a fraction of the display token.
    const ordinaryRule = /\.section:not\(\.section--hero\) \.section__head h2 \{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(ordinaryRule.includes('var(--text-h2-size)'), 'an ordinary section heading should use the h2 token');
    assert.ok(!ordinaryRule.includes('--text-display-size'),
      'an ordinary section heading must not reach into the display token the hero and signature reserve');
  });
});

describe('the hero treatment follows the evidence, not the business name', () => {
  it('gives a business with a hero photograph a materially different hero than the same business with none', () => {
    // Same category (`profileFixture` defaults to Bakery) both times — the
    // only thing that differs is whether the hero section has a photograph.
    const imaged = composeDesign({ profile: profileFixture(), content: fullContent });
    const textOnly = composeDesign({ profile: profileFixture(), content: minimalContent });

    assert.notEqual(imaged.layout.hero, textOnly.layout.hero,
      `expected different hero treatments, both landed on "${imaged.layout.hero}"`);

    const imageLedHeroes = ['split', 'image-first', 'full-bleed', 'magazine'];
    const typeLedHeroes = ['centered', 'minimal', 'editorial'];
    assert.ok(imageLedHeroes.includes(imaged.layout.hero), `expected an image-led hero, got ${imaged.layout.hero}`);
    assert.ok(typeLedHeroes.includes(textOnly.layout.hero), `expected a type-led hero, got ${textOnly.layout.hero}`);

    const imagedHtml = renderSite(fullContent, { design: imaged }).files[0]?.contents ?? '';
    const textHtml = renderSite(minimalContent, { design: textOnly }).files[0]?.contents ?? '';
    assert.ok(imagedHtml.includes(`section--hero-${imaged.layout.hero}`));
    assert.ok(textHtml.includes(`section--hero-${textOnly.layout.hero}`));
    // The text-led hero never invents a photograph it does not have.
    assert.ok(!textHtml.includes('<img'), 'a text-led hero with no photo must not render one');
  });
});

describe('section emphasis yields distinct CSS treatment', () => {
  it('gives lead and quiet emphasis visibly different rules', () => {
    const design = composeDesign({ profile: profileFixture({ category: 'Bakery' }), content: fullContent });
    const stylesheet = renderSite(fullContent, { design }).files[1]?.contents ?? '';

    assert.ok(stylesheet.includes('[data-emphasis="lead"]'));
    assert.ok(stylesheet.includes('[data-emphasis="quiet"]'));
    // They must not resolve to the same declarations.
    const lead = /\[data-emphasis="lead"\][^{]*\{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    const quiet = /\[data-emphasis="quiet"\][^{]*\{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.notEqual(lead, '');
    assert.notEqual(quiet, '');
    assert.notEqual(lead, quiet);
  });
});
