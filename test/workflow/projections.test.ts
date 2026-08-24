/**
 * P5-3 — K candidates with independent input views (N/A module; behavioral
 * requirement). Each concept agent receives a different projection of the
 * evidence: the three briefs differ in content, not only in ordering.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjections, projectionFor, PROJECTION_KINDS } from '../../lib/workflow/projections.js';
import type { BusinessProfile, BusinessStrategy, WebsiteContent } from '../../lib/types.js';

const PROFILE = {
  name: { value: 'Mara', source: 'x', confidence: 1 },
  category: { value: 'bakery', source: 'x', confidence: 1 },
  address: null,
  coordinates: null,
  website: null,
  phones: [],
  emails: [],
  socialProfiles: [],
  hours: [
    { dayOfWeek: 1, opens: '08:00', closes: '18:00' },
    { dayOfWeek: 2, opens: '08:00', closes: '18:00' },
  ],
  rating: { value: 4.8, source: 'x', confidence: 1 },
  reviewCount: { value: 132, source: 'x', confidence: 1 },
  navigation: [],
  services: [
    { name: 'Sourdough bread', description: 'slow-fermented, baked at dawn' },
    { name: 'Croissants', description: 'buttery laminated pastry' },
  ],
  pages: [],
  attributes: [
    { group: 'Amenities', label: 'Outdoor seating', available: true, source: 'x' },
    { group: 'Amenities', label: 'Wi-Fi', available: false, source: 'x' },
  ],
  description: { value: 'A neighbourhood bakery baking everything on site.', source: 'x', confidence: 1 },
  reviews: [],
  images: { logo: null, favicon: null, hero: null, gallery: [] },
  validation: { issues: [{ field: 'website', severity: 'warning', message: 'no site found' }] },
  sources: ['x'],
  normalizedAt: '2026-01-01T00:00:00.000Z',
} as unknown as BusinessProfile;

const STRATEGY = {
  businessName: 'Mara',
  category: { primary: 'bakery', secondary: [], rationale: 'r', basis: 'listing' },
  goals: [
    { title: 'Drive local foot traffic', rationale: 'walk-in neighbourhood', priority: 'high', evidence: [] },
  ],
  audience: {
    primary: { name: 'local residents', description: 'people who live within walking distance', needs: ['fresh daily bread'], rationale: 'r' },
    secondary: [],
  },
  pages: [{ path: '/', title: 'Home', sections: ['hero', 'menu', 'location'], rationale: 'r', priority: 'medium', evidence: [] }],
} as unknown as BusinessStrategy;

const CONTENT = {
  businessName: 'Mara',
  tagline: 'Fresh bread, every morning',
  voice: { tone: 'warm', palette: ['brown', 'cream'], typography: { heading: 'serif', body: 'sans' } },
  sections: [
    { kind: 'hero', heading: 'Mara', subheading: null, body: [], bullets: [], images: [] },
    { kind: 'menu', heading: 'What we bake', subheading: null, body: [], bullets: [], images: [] },
    { kind: 'hours', heading: 'Opening hours', subheading: null, body: [], bullets: [], images: [] },
  ],
  unresolvedGaps: ['confirm weekend hours'],
} as unknown as WebsiteContent;

test('the K projections differ in content, not only in ordering', () => {
  const projections = buildProjections(PROFILE, STRATEGY, CONTENT);
  assert.equal(projections.length, 3);
  assert.deepEqual(projections.map((p) => p.kind), [...PROJECTION_KINDS]);

  const [identity, audience, grounding] = projections;
  assert.ok(identity, 'identity view present');
  assert.ok(audience, 'audience view present');
  assert.ok(grounding, 'grounding view present');

  // Each view has a section the others do not: content differs, not order.
  assert.match(identity.brief, /Image content signals/);
  assert.match(audience.brief, /Target audience/);
  assert.match(grounding.brief, /Stated properties/);

  // The views are pairwise different strings.
  assert.notEqual(identity.brief, audience.brief);
  assert.notEqual(audience.brief, grounding.brief);
  assert.notEqual(identity.brief, grounding.brief);
});

test('no projection is empty', () => {
  for (const p of buildProjections(PROFILE, STRATEGY, CONTENT)) {
    assert.ok(p.brief.trim().length > 0, `${p.kind} has content`);
  }
});

test('projectionFor returns the requested view', () => {
  const grounding = projectionFor(PROFILE, STRATEGY, CONTENT, 'grounding');
  assert.match(grounding, /Stated properties/);
  assert.doesNotMatch(grounding, /Image content signals/);
});

test('the projections are deterministic across calls', () => {
  const a = buildProjections(PROFILE, STRATEGY, CONTENT);
  const b = buildProjections(PROFILE, STRATEGY, CONTENT);
  assert.deepEqual(a, b);
});