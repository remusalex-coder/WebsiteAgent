/**
 * Recovery audit — the three recovered capabilities (spatial depth, signature
 * veil, cinematic/kinetic motion) must reach the rendered CSS as *behaviour*,
 * not as decoration that a screenshot could miss. These assert the CSS the
 * deterministic renderer emits for a business that already earned a hero photo
 * and a signature moment.
 *
 * Every rule added is gated by `prefers-reduced-motion` / `(hover: hover)`, so a
 * parallel assertion checks the motion is absent under reduced motion. That is
 * the accessibility contract the recovery was required to preserve.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeDesign } from '../../lib/design/compose.js';
import { renderSite } from '../../lib/render/index.js';
import { profileFixture } from '../fixtures/business.js';
import { minimalContent, fullContent } from '../fixtures/content.js';

function craftImage(alt: string, i: number, w: number, h: number) {
  return {
    url: `https://workshop.example/img${i}.jpg`,
    role: 'gallery' as const,
    alt,
    width: w,
    height: h,
    localPath: `assets/g${i}.jpg`,
    bytes: 200000,
    sourceUrl: 'https://workshop.example/page',
  };
}

// An image-led, narrative business — exactly the evidence that should earn
// depth + motion + a signature veil in the recovered renderer.
function richBusiness() {
  const specs: [string, number, number][] = [
    ['engine bay', 1600, 1066],
    ['workshop lift', 1600, 1066],
    ['technician at work', 1200, 1600],
    ['tool wall', 1600, 1066],
    ['brake replacement', 1400, 1400],
  ];
  const images = specs.map(([alt, w, h], i) => craftImage(alt, i, w, h));
  const description =
    'A family-run workshop offering precision diagnostics and certified repairs: servicing, MOT, brakes ' +
    'and timing belts, carried out by qualified technicians on every car that comes through the garage.';
  const profile = {
    ...profileFixture({
      category: 'Auto repair',
      description,
      services: ['Servicing', 'MOT', 'Repairs', 'Diagnostics', 'Brakes', 'Timing belts'],
      rating: 4.6,
      phone: '0700 000 000',
    }),
    images: { logo: null, favicon: null, hero: images[0] ?? null, gallery: images.slice(1) },
  };
  const content = {
    ...fullContent,
    businessName: 'Ridgeway Motors',
    tagline: 'Precision workshop, certified technicians',
    sections: [
      { kind: 'hero' as const, heading: 'Precision workshop, certified technicians', subheading: null, body: '', bullets: [], images: [], callToAction: { label: 'Call', href: 'tel:0700' } },
      { kind: 'about' as const, heading: 'About', subheading: null, body: description, bullets: [], images: [], callToAction: null },
      { kind: 'services' as const, heading: 'Services', subheading: null, body: '', bullets: ['Servicing', 'MOT', 'Repairs', 'Diagnostics'], images: [], callToAction: null },
      { kind: 'gallery' as const, heading: 'Gallery', subheading: null, body: '', bullets: [], images, callToAction: null },
      { kind: 'contact' as const, heading: 'Contact', subheading: null, body: '', bullets: [], images: [], callToAction: { label: 'Call', href: 'tel:0700' } },
    ],
  };
  return { profile, content };
}

describe('recovered capability: spatial depth on the image-led peaks', () => {
  const { profile, content } = richBusiness();
  const design = composeDesign({ profile, content });
  const stylesheet = renderSite(content, { design }).files[1]?.contents ?? '';

  it('gives the hero a perspective stage (a third dimension, no JS)', () => {
    const heroRule = /\.section--hero \{[^}]*perspective[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(heroRule.includes('perspective'), 'hero should establish a perspective stage for depth');
  });

  it('adds a layered ground band behind the hero and signature (layering)', () => {
    const after = /\.section--hero::after[^}]*\{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(after.includes('radial-gradient'), 'hero should carry a layered radial ground band');
    assert.ok(after.includes('blur('), 'the layered band should be softened with blur (depth, not a hard edge)');
  });

  it('lifts the signature image off the page (translateZ/rotateX depth)', () => {
    const depth = /forge-signature-rise \{[^}]*\}/.test(stylesheet)
      || /section--signature-composition \.gallery__item\[data-role="signature"\][^{]*\{[^}]*transform/.test(stylesheet);
    assert.ok(depth, 'signature image should carry a 3D tilt / entrance transform');
  });
});

describe('recovered capability: a genuine veil at the signature moment', () => {
  const { profile, content } = richBusiness();
  const design = composeDesign({ profile, content });
  const stylesheet = renderSite(content, { design }).files[1]?.contents ?? '';

  it('emits a veil keyframe that works without scroll-timeline support', () => {
    assert.ok(/@keyframes forge-veil \{/.test(stylesheet), 'a load-time veil keyframe must exist');
    const veil = /@keyframes forge-veil \{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(veil.includes('opacity: 0.85') || veil.includes('opacity:0.85'), 'the veil must start near-opaque and wash to nothing');
  });

  it('applies the veil to the signature moment as a rhythm break', () => {
    // The veil is now kind-aware: it rides on the moment beat that carries
    // data-transition="veil" (the signature composition is also .section--moment).
    assert.ok(/\.section--moment\[data-transition="veil"\]::before/.test(stylesheet), 'the signature moment must carry a veil ::before layer keyed on data-transition="veil"');
    assert.ok(/forge-veil/.test(stylesheet), 'the signature peak must wash in via the veil keyframe');
  });
});

describe('recovered capability: cinematic entrance + kinetic hover', () => {
  const { profile, content } = richBusiness();
  const design = composeDesign({ profile, content });
  const stylesheet = renderSite(content, { design }).files[1]?.contents ?? '';

  it('lifts and scales interactive items on hover (kinetic, not just colour)', () => {
    const hover = /@media \(hover: hover\)[^{]*\{[^}]*\.gallery__item:hover \{[^}]*\}/.exec(stylesheet)?.[0] ?? '';
    assert.ok(/transform: translateY/.test(hover) && /scale\(/.test(hover), 'hover must move and scale the item');
    assert.ok(hover.includes('box-shadow'), 'hover should add a lift shadow');
  });

  it('gives the signature a one-shot entrance so the page arrives as a sequence', () => {
    assert.ok(/@keyframes forge-signature-rise \{/.test(stylesheet), 'a signature entrance keyframe must exist');
  });
});

describe('recovered capability: reduced motion disables the stagecraft', () => {
  it('wraps every recovered motion rule in a prefers-reduced-motion guard', () => {
    const { profile, content } = richBusiness();
    const design = composeDesign({ profile, content });
    const stylesheet = renderSite(content, { design }).files[1]?.contents ?? '';
    const guarded = (stylesheet.match(/@media \(prefers-reduced-motion: no-preference\)/g) ?? []).length;
    assert.ok(guarded >= 3, `recovered motion should be gated (found ${guarded} reduced-motion guards)`);
    // The hero perspective must live inside such a guard: a guard block that
    // contains `.section--hero {` with `perspective`.
    const insideGuard = /@media \(prefers-reduced-motion: no-preference\) \{[^}]*\.section--hero \{[^}]*perspective/.test(stylesheet);
    assert.ok(insideGuard, 'hero perspective must be inside the reduced-motion guard, never at top level');
  });
});
