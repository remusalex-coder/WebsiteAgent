/**
 * P5-1 — L1 fingerprint equality: fingerprint(directive) ===
 * fingerprint(built design) for 20 fixtures (N-16, F-09).
 *
 * Equality holds when the directive *fully specifies the decision surface*:
 * every closed-set decision it names is recorded verbatim on the built design.
 * That is the contract P5-1 asserts — a directive that determines a design is
 * the same design whatever text accompanies it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fingerprintDirective, fingerprintDesign, decisionsFromDirective, sameDecisionSurface, hashParts } from '../../lib/design/fingerprint.js';
import type { DesignDirective } from '../../lib/design/directive.js';
import type { WebsiteDesign } from '../../lib/design/types.js';
import type { SectionKind } from '../../lib/types.js';

/** A built design whose decision surface is exactly what the directive set. */
function designFrom(d: DesignDirective): WebsiteDesign {
  const moment = resolvedMoment(d);
  return {
    version: 1,
    personality: {
      direction: d.direction ?? 'modern',
      mood: { temperature: 'neutral', energy: 'steady', formality: 'neutral' },
      density: 'balanced',
      contrast: 'medium',
      rationale: 'fixture',
      evidence: [],
    },
    industry: { id: 'general', basis: 'fallback', matchedOn: [], rationale: '' },
    patterns: [],
    world: 'modern',
    tokens: undefined as never,
    layout: {
      hero: 'centered' as WebsiteDesign['layout']['hero'],
      footer: 'minimal',
      sections: [],
      order: [],
      stickyHeader: false,
      showNavigation: true,
      rationale: '',
    },
    imagery: undefined as never,
    icons: undefined as never,
    responsive: undefined as never,
    accessibility: {
      targetLevel: resolvedAccessibility(d),
      minContrastBody: 4.5,
      minContrastLarge: 3,
      minTapTargetPx: 44,
      respectReducedMotion: true,
      focusStyle: 'outline',
      semanticLandmarks: true,
    },
    experience: {
      mode: d.experienceMode ?? 'brochure',
      signatureMoment: moment,
      transition: 'none',
      momentTransition: false,
      galleryLead: false,
    } as WebsiteDesign['experience'],
    conversion: { mode: d.conversionStrategy ?? 'balanced' } as WebsiteDesign['conversion'],
    interaction: { level: d.interactionStrategy ?? 'static' } as WebsiteDesign['interaction'],
    assets: undefined as never,
    experienceScript: undefined as never,
    notes: [],
  };
}

function resolvedMoment(d: DesignDirective): SectionKind | null {
  if (d.signatureMoment !== undefined && d.signatureMoment !== null) return d.signatureMoment;
  if (d.experienceIntent?.mode === 'moment-led' && d.experienceIntent.moment !== null) {
    return d.experienceIntent.moment;
  }
  return null;
}

function resolvedAccessibility(d: DesignDirective): 'AA' | 'AAA' {
  if (d.colorStrategy === 'high-contrast') return 'AAA';
  return d.accessibilityTarget ?? 'AA';
}

/** Full decision-surface directives — the only kind P5-1 can assert equality for. */
const FIXTURES: readonly { readonly name: string; readonly directive: DesignDirective }[] = [
  { name: 'minimal-brochure', directive: { direction: 'minimal', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r1', confidence: 0.8 } },
  { name: 'luxury-showcase', directive: { direction: 'luxury', experienceMode: 'showcase', conversionStrategy: 'high-intent', interactionStrategy: 'subtle', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r2' } },
  { name: 'editorial-narrative', directive: { direction: 'editorial', experienceMode: 'narrative', conversionStrategy: 'editorial', interactionStrategy: 'subtle', signatureMoment: 'about', accessibilityTarget: 'AA', rationale: 'r3' } },
  { name: 'playful-immersive', directive: { direction: 'playful', experienceMode: 'immersive', conversionStrategy: 'direct', interactionStrategy: 'immersive', signatureMoment: 'gallery', accessibilityTarget: 'AA', rationale: 'r4' } },
  { name: 'corporate-aaa', directive: { direction: 'corporate', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AAA', rationale: 'r5' } },
  { name: 'bold-showcase', directive: { direction: 'bold', experienceMode: 'showcase', conversionStrategy: 'high-intent', interactionStrategy: 'guided', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r6' } },
  { name: 'elegant-narrative', directive: { direction: 'elegant', experienceMode: 'narrative', conversionStrategy: 'editorial', interactionStrategy: 'subtle', signatureMoment: 'services', accessibilityTarget: 'AA', rationale: 'r7' } },
  { name: 'creative-immersive', directive: { direction: 'creative', experienceMode: 'immersive', conversionStrategy: 'direct', interactionStrategy: 'immersive', signatureMoment: 'cta', accessibilityTarget: 'AAA', rationale: 'r8' } },
  { name: 'modern-brochure', directive: { direction: 'modern', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r9' } },
  { name: 'premium-showcase', directive: { direction: 'premium', experienceMode: 'showcase', conversionStrategy: 'high-intent', interactionStrategy: 'subtle', signatureMoment: 'testimonials', accessibilityTarget: 'AA', rationale: 'r10' } },
  { name: 'friendly-brochure', directive: { direction: 'friendly', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r11' } },
  { name: 'minimal-airy', directive: { direction: 'minimal', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AA', density: 'airy', rationale: 'r12' } },
  { name: 'editorial-dense', directive: { direction: 'editorial', experienceMode: 'narrative', conversionStrategy: 'editorial', interactionStrategy: 'subtle', signatureMoment: null, accessibilityTarget: 'AA', density: 'dense', rationale: 'r13' } },
  { name: 'modern-hero', directive: { direction: 'modern', experienceMode: 'showcase', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AA', heroIntent: { preference: 'image-first', intent: 'i' }, rationale: 'r14' } },
  { name: 'luxury-hero', directive: { direction: 'luxury', experienceMode: 'showcase', conversionStrategy: 'high-intent', interactionStrategy: 'subtle', signatureMoment: null, accessibilityTarget: 'AA', heroIntent: { preference: 'split', intent: 'i' }, rationale: 'r15' } },
  { name: 'bold-guided', directive: { direction: 'bold', experienceMode: 'immersive', conversionStrategy: 'direct', interactionStrategy: 'guided', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r16' } },
  { name: 'creative-direct', directive: { direction: 'creative', experienceMode: 'showcase', conversionStrategy: 'direct', interactionStrategy: 'subtle', signatureMoment: null, accessibilityTarget: 'AA', rationale: 'r17' } },
  { name: 'editorial-gallery', directive: { direction: 'editorial', experienceMode: 'narrative', conversionStrategy: 'editorial', interactionStrategy: 'subtle', signatureMoment: 'gallery', accessibilityTarget: 'AA', rationale: 'r18' } },
  { name: 'minimal-statement', directive: { direction: 'minimal', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: 'statement', accessibilityTarget: 'AA', rationale: 'r19' } },
  { name: 'corporate-contrast', directive: { direction: 'corporate', experienceMode: 'brochure', conversionStrategy: 'balanced', interactionStrategy: 'static', signatureMoment: null, accessibilityTarget: 'AA', colorStrategy: 'high-contrast', rationale: 'r20' } },
];

test('fingerprint(directive) === fingerprint(built design) for all 20 fixtures', () => {
  for (const fixture of FIXTURES) {
    const design = designFrom(fixture.directive);
    const fromDirective = fingerprintDirective(fixture.directive);
    const fromDesign = fingerprintDesign(design);
    assert.equal(fromDirective, fromDesign, `${fixture.name}: directive and design share a fingerprint`);
  }
});

test('rationale and confidence do not change the L1 fingerprint', () => {
  const a = fingerprintDirective({ direction: 'minimal', rationale: 'one reason' });
  const b = fingerprintDirective({ direction: 'minimal', rationale: 'a completely different reason', confidence: 0.2 });
  assert.equal(a, b, 'reconcepting on new feedback must not change L1 unless a decision changes');
});

test('creative prose and intent text do not change the L1 fingerprint', () => {
  const a = fingerprintDirective({ direction: 'minimal' });
  const b = fingerprintDirective({ direction: 'minimal', creativeThesis: 'a new controlling idea', visualMetaphor: 'something vivid', emotionalJourney: 'an arc' });
  assert.equal(a, b, 'free-text creative intent is not part of the closed decision surface');
});

test('a changed decision changes the L1 fingerprint', () => {
  const a = fingerprintDirective({ direction: 'minimal' });
  const b = fingerprintDirective({ direction: 'luxury' });
  assert.notEqual(a, b);
});

test('high-contrast color strategy resolves to AAA in the decision surface', () => {
  const decisions = decisionsFromDirective({ colorStrategy: 'high-contrast' });
  assert.equal(decisions.accessibilityTarget, 'AAA');
});

test('signatureMoment outranks experienceIntent.moment in the decision surface', () => {
  const decisions = decisionsFromDirective({
    signatureMoment: 'about',
    experienceIntent: { mode: 'moment-led', moment: 'gallery', momentIntent: 'm', transitionAtMoment: true },
  });
  assert.equal(decisions.moment, 'about');
});

test('decisionsFromDirective projects exactly the decision surface', () => {
  const decisions = decisionsFromDirective({
    direction: 'minimal',
    experienceMode: 'narrative',
    conversionStrategy: 'direct',
    interactionStrategy: 'guided',
    signatureMoment: 'about',
    accessibilityTarget: 'AAA',
    density: 'airy',
    heroIntent: { preference: 'split', intent: 'i' },
    experienceIntent: { mode: 'moment-led', moment: 'gallery', momentIntent: 'm', transitionAtMoment: true },
  });
  assert.deepEqual(decisions, {
    direction: 'minimal',
    experienceMode: 'narrative',
    conversionMode: 'direct',
    interactionLevel: 'guided',
    moment: 'about',
    accessibilityTarget: 'AAA',
  });
});

test('sameDecisionSurface detects two directives that would render the same page', () => {
  assert.equal(sameDecisionSurface({ direction: 'minimal' }, { direction: 'minimal', rationale: 'different prose' }), true);
  assert.equal(sameDecisionSurface({ direction: 'minimal' }, { direction: 'luxury' }), false);
});

test('hashParts is stable and deterministic', () => {
  const a = hashParts([{ x: 1 }, 'two', 3]);
  const b = hashParts([{ x: 1 }, 'two', 3]);
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(hashParts([{ x: 1 }, 'two']), a);
});