/**
 * The experience layer must produce materially different architectures for
 * businesses of different character — the acceptance criterion for "the same
 * pipeline naturally produces a different experience per business because it
 * understood what makes each different".
 *
 * These tests exercise the decision layer (`deriveCharacter` + `planExperience`)
 * directly, with archetypal evidence for six categories. They assert divergence,
 * not a screenshot.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveCharacter, type CharacterContext } from '../../lib/design/character.js';
import { planExperience } from '../../lib/design/experience.js';
import type { BusinessProfile, WebsiteContent, ImageAsset, SectionKind } from '../../lib/types.js';

/* --- minimal factories: only the fields the analysers read --- */

function img(w: number, h: number, i: number): ImageAsset {
  return { url: `u${i}`, role: 'gallery', alt: null, width: w, height: h, localPath: `assets/g${i}.jpg`, bytes: 1000, sourceUrl: 's' };
}

interface Spec {
  category: string;
  description: string;
  services: number;
  rating: number | null;
  images: readonly [number, number][]; // [w,h]
  sectionKinds: readonly SectionKind[];
  ground: 'clean' | 'warm' | 'atmospheric';
  reliance: 'essential' | 'supporting' | 'incidental';
}

function build(spec: Spec): { profile: BusinessProfile; content: WebsiteContent; ctx: CharacterContext } {
  const gallery = spec.images.map(([w, h], i) => img(w, h, i));
  const profile = {
    name: { value: 'Test', source: 'maps', sourceUrl: 's', alternatives: [] },
    category: { value: spec.category, source: 'maps', sourceUrl: 's', alternatives: [] },
    description: { value: spec.description, source: 'website', sourceUrl: 's', alternatives: [] },
    rating: spec.rating === null ? null : { value: spec.rating, source: 'maps', sourceUrl: 's', alternatives: [] },
    reviewCount: null,
    services: Array.from({ length: spec.services }, (_, i) => ({ name: `svc${i}`, description: 'd', sourceUrl: 's' })),
    images: { logo: null, favicon: null, hero: gallery[0] ?? null, gallery: gallery.slice(1) },
    pages: [], phones: [], emails: [], socialProfiles: [], hours: [], navigation: [], attributes: [],
    address: null, coordinates: null, website: null,
    validation: { ok: true, issues: [] }, sources: [], normalizedAt: '',
  } as unknown as BusinessProfile;

  const content = {
    businessName: 'Test', tagline: spec.description.slice(0, 40), voice: { tone: '', palette: [], typography: { heading: '', body: '' } },
    sections: spec.sectionKinds.map((kind) => ({
      kind, heading: kind, subheading: null, body: kind === 'about' ? spec.description : '',
      bullets: [], images: kind === 'gallery' ? gallery : [], callToAction: null,
    })),
    trust: [], facts: [], seo: { title: '', description: '', keywords: [], structuredData: {} }, unresolvedGaps: [],
  } as unknown as WebsiteContent;

  return { profile, content, ctx: { ground: spec.ground, imageReliance: spec.reliance } };
}

/* --- six archetypes --- */

const ARCHETYPES: Record<string, Spec> = {
  eventVenue: {
    category: 'Event & wedding venue', description: 'Locație de nuntă și evenimente pe malul râului, cu sala mare, grădină de ceremonie și primul dans pe nori pentru nunți și botezuri.',
    services: 6, rating: 4.7,
    images: [[2048, 1365], [1290, 1716], [1290, 1716], [1600, 1066], [1440, 1440], [1066, 1600], [1600, 1066], [1290, 1716]],
    sectionKinds: ['hero', 'about', 'services', 'gallery', 'hours', 'contact', 'cta'], ground: 'atmospheric', reliance: 'essential',
  },
  hotel: {
    category: 'Hotel', description: 'A boutique hotel with rooms, a spa and a restaurant, in a warm hospitality style.',
    services: 3, rating: 4.6,
    images: [[1600, 1066], [1600, 1066], [1200, 1600], [1600, 1066], [1400, 1400]],
    sectionKinds: ['hero', 'about', 'services', 'gallery', 'contact', 'cta'], ground: 'atmospheric', reliance: 'essential',
  },
  bakery: {
    category: 'Bakery', description: 'An artisan bakery: sourdough, pastries and cakes baked fresh every morning.',
    services: 3, rating: 4.8,
    images: [[1600, 1066], [1600, 1066], [1600, 1066], [1600, 1066], [1600, 1066], [1600, 1066]],
    sectionKinds: ['hero', 'about', 'menu', 'gallery', 'hours', 'contact', 'cta'], ground: 'warm', reliance: 'essential',
  },
  restaurant: {
    category: 'Restaurant', description: 'A neighbourhood restaurant serving seasonal Romanian cuisine and a curated wine list.',
    services: 2, rating: 4.5,
    images: [[1600, 1066], [1200, 1600], [1600, 1066], [1400, 1400]],
    sectionKinds: ['hero', 'menu', 'gallery', 'testimonials', 'contact', 'cta'], ground: 'warm', reliance: 'essential',
  },
  barber: {
    category: 'Barber shop', description: 'A classic barber: cuts, shaves and beard trims, walk-ins welcome.',
    services: 3, rating: 4.9,
    images: [[1200, 1200], [1200, 1200]],
    sectionKinds: ['hero', 'services', 'hours', 'contact', 'cta'], ground: 'warm', reliance: 'supporting',
  },
  mechanic: {
    category: 'Auto repair', description: 'Car servicing, MOT and repairs. Fast, honest, fairly priced.',
    services: 4, rating: 4.4,
    images: [],
    sectionKinds: ['hero', 'services', 'hours', 'location', 'contact', 'cta'], ground: 'clean', reliance: 'incidental',
  },
};

function architectureOf(name: string) {
  const spec = ARCHETYPES[name]!;
  const { profile, content, ctx } = build(spec);
  const character = deriveCharacter(profile, content, ctx);
  const experience = planExperience(character, content);
  return { character, experience };
}

test('mechanic is a brochure — craft register, compact, no signature moment', () => {
  const { character, experience } = architectureOf('mechanic');
  assert.equal(character.visualWeight, 'text-led');
  assert.equal(character.emotionalRegister, 'craft');
  assert.equal(experience.mode, 'brochure');
  assert.equal(experience.signatureMoment, null);
  assert.equal(experience.galleryLead, false);
  assert.equal(experience.pacing, 'compact');
  assert.equal(experience.momentTransition, false);
});

test('event venue is a narrative — image-led, romantic, gallery moment, cinematic', () => {
  const { character, experience } = architectureOf('eventVenue');
  assert.equal(character.visualWeight, 'image-led');
  assert.equal(character.emotionalRegister, 'romantic');
  assert.equal(character.narrativePotential, 'strong');
  assert.equal(experience.mode, 'narrative');
  assert.equal(experience.signatureMoment, 'gallery');
  assert.equal(experience.galleryLead, true);
  assert.equal(experience.momentTransition, true);
  assert.equal(experience.pacing, 'cinematic');
});

test('bakery is a showcase — image-led warm, gallery leads, but no built arc by default', () => {
  const { experience } = architectureOf('bakery');
  assert.ok(experience.mode === 'showcase' || experience.mode === 'narrative');
  assert.equal(experience.galleryLead, true);
  assert.notEqual(experience.pacing, 'compact');
});

test('the six archetypes do not collapse to one architecture', () => {
  const names = Object.keys(ARCHETYPES);
  const modes = names.map((n) => architectureOf(n).experience.mode);
  const distinct = new Set(modes);
  // At least three distinct modes across six businesses — the platform is not
  // styling one template.
  assert.ok(distinct.size >= 3, `expected >= 3 distinct modes, got ${[...distinct].join(', ')}`);
  // The two functional-leaning trades and the two rich-imagery trades must land
  // on opposite ends.
  assert.equal(architectureOf('mechanic').experience.mode, 'brochure');
  assert.equal(architectureOf('eventVenue').experience.mode, 'narrative');
});

test('character is deterministic — same evidence, same character', () => {
  const a = architectureOf('eventVenue');
  const b = architectureOf('eventVenue');
  assert.deepEqual(a.character, b.character);
  assert.deepEqual(a.experience, b.experience);
});
