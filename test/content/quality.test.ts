/**
 * The content quality gate.
 *
 * A gate that only a well-behaved generator passes is worth nothing, so most of
 * this file is *broken* content: a fabricated award, a page of boilerplate, a
 * button that contradicts the strategy, a beat that does not do its job. Each
 * one must be rejected, and the honest page must pass.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { auditContent } from '../../lib/content/quality.js';
import { directContent } from '../../lib/content/director.js';
import { indexEvidence } from '../../lib/content/evidence.js';
import { planNarrative } from '../../lib/design/plan.js';
import { profileFrom, baselineFrom, VENUE, GARAGE, BAKERY } from './fixtures.js';

import type { ContentIssueKind } from '../../lib/content/quality.js';
import type { SectionKind, WebsiteContent, WebsiteSection } from '../../lib/types.js';

const KINDS: Readonly<Record<string, readonly SectionKind[]>> = {
  venue: ['hero', 'about', 'services', 'gallery', 'hours', 'contact', 'cta'],
  garage: ['hero', 'about', 'services', 'hours', 'contact', 'cta'],
  bakery: ['hero', 'about', 'services', 'gallery', 'hours', 'contact', 'cta'],
};

function audited(spec: typeof VENUE, kinds: readonly SectionKind[]) {
  const profile = profileFrom(spec);
  const baseline = baselineFrom(spec, kinds);
  const plan = planNarrative(profile, baseline);
  const directed = directContent(profile, baseline, plan);
  const run = (content: WebsiteContent = directed.content) =>
    auditContent({ content, evidence: indexEvidence(profile, baseline), roles: plan.roles, conversion: plan.conversion });
  return { profile, baseline, plan, directed, run };
}

const venue = audited(VENUE, KINDS.venue as readonly SectionKind[]);
const garage = audited(GARAGE, KINDS.garage as readonly SectionKind[]);
const bakery = audited(BAKERY, KINDS.bakery as readonly SectionKind[]);

/** Replaces one section, leaving the rest of the page alone. */
function withSection(
  content: WebsiteContent,
  kind: SectionKind,
  patch: Partial<WebsiteSection>,
): WebsiteContent {
  return {
    ...content,
    sections: content.sections.map((section) => (section.kind === kind ? { ...section, ...patch } : section)),
  };
}

const kinds = (issues: readonly { kind: ContentIssueKind }[]): readonly ContentIssueKind[] =>
  issues.map((issue) => issue.kind);

describe('an honestly directed page passes', () => {
  for (const [name, result] of [['venue', venue], ['garage', garage], ['bakery', bakery]] as const) {
    test(`${name} has no errors`, () => {
      const report = result.run();
      const errors = report.issues.filter((issue) => issue.severity === 'error');
      assert.equal(errors.length, 0, errors.map((issue) => `${issue.kind}: ${issue.message}`).join('\n'));
      assert.equal(report.ok, true);
    });

    test(`${name} scores, and most of its headings are built from its own words`, () => {
      const report = result.run();
      assert.ok(report.score >= 80, `${name} scored ${report.score}`);
      assert.ok(report.specificity > 0, `${name} specificity ${report.specificity}`);
    });
  }
});

describe('the gate rejects fabricated facts', () => {
  test('an award nobody proved', () => {
    const broken = withSection(venue.directed.content, 'about', {
      body: 'The award-winning team has hosted celebrations here for years.',
    });
    assert.ok(kinds(venue.run(broken).issues).includes('unsupported-claim'));
    assert.equal(venue.run(broken).ok, false);
  });

  test('a founding year the profile never stated', () => {
    const broken = withSection(garage.directed.content, 'about', {
      body: 'Serving the city since 1974, with the same family behind the counter.',
    });
    assert.ok(kinds(garage.run(broken).issues).includes('unsupported-claim'));
  });

  test('a certification, a guarantee and a superlative', () => {
    for (const body of [
      'Every technician here is certified to the highest standard.',
      'All work carries a lifetime guarantee.',
      'The best in Bristol, three years running.',
    ]) {
      const broken = withSection(garage.directed.content, 'about', { body });
      assert.ok(kinds(garage.run(broken).issues).includes('unsupported-claim'), body);
    }
  });

  test('a price the listing never published', () => {
    const broken = withSection(bakery.directed.content, 'services', {
      body: 'Sourdough from £4.50 a loaf.',
    });
    assert.ok(kinds(bakery.run(broken).issues).includes('unsupported-claim'));
  });

  test('but a claim the evidence *does* support is allowed through', () => {
    // The garage's own description says it is open six days a week; a page
    // repeating a published fact is not fabricating one.
    const fine = withSection(garage.directed.content, 'about', {
      body: 'Fairfield Motors is an independent garage in Bristol.',
    });
    const report = garage.run(fine);
    assert.equal(kinds(report.issues).includes('unsupported-claim'), false,
      report.issues.map((issue) => issue.message).join('\n'));
  });
});

describe('the gate rejects empty marketing language', () => {
  for (const line of [
    'Welcome to our little corner of the world.',
    'We are passionate about what we do.',
    'Whether you are looking for a quick fix or a full rebuild.',
    'Discover our range of services.',
    'Your trusted partner in the city.',
    'Where quality meets craftsmanship.',
    'Something for everyone, every day.',
    'A state-of-the-art workshop.',
  ]) {
    test(`"${line.slice(0, 34)}…"`, () => {
      const broken = withSection(garage.directed.content, 'about', { body: line });
      const report = garage.run(broken);
      assert.ok(kinds(report.issues).includes('boilerplate'), report.issues.map((i) => i.kind).join(','));
      assert.equal(report.ok, false);
    });
  }
});

describe('the gate rejects a page that does not do its job', () => {
  test('a button that contradicts the conversion strategy', () => {
    const broken = withSection(venue.directed.content, 'cta', {
      callToAction: { label: 'Comandă', href: 'tel:+447009009000' },
    });
    assert.ok(kinds(venue.run(broken).issues).includes('cta-mismatch'));
  });

  test('a breadth beat that lists nothing', () => {
    const broken = withSection(venue.directed.content, 'services', { bullets: [], body: '' });
    const report = venue.run(broken);
    assert.ok(kinds(report.issues).includes('role-mismatch'), report.issues.map((i) => i.kind).join(','));
  });

  test('a conversion beat with no action', () => {
    const broken = withSection(garage.directed.content, 'cta', { callToAction: null, bullets: [] });
    assert.ok(kinds(garage.run(broken).issues).includes('role-mismatch'));
  });

  test('a signature beat carrying neither imagery nor words', () => {
    const broken = withSection(bakery.directed.content, 'gallery', { images: [], body: '', bullets: [] });
    assert.ok(kinds(bakery.run(broken).issues).includes('role-mismatch'));
  });

  test('the same sentence printed in two sections', () => {
    const sentence = 'Everything is mixed by hand the evening before and baked from four in the morning.';
    const broken: WebsiteContent = {
      ...bakery.directed.content,
      sections: bakery.directed.content.sections.map((section) =>
        section.kind === 'about' || section.kind === 'services' ? { ...section, body: sentence } : section),
    };
    assert.ok(kinds(bakery.run(broken).issues).includes('repeated-phrase'));
  });

  test('the same proposition made twice', () => {
    const broken: WebsiteContent = {
      ...garage.directed.content,
      sections: garage.directed.content.sections.map((section) =>
        section.kind === 'about' || section.kind === 'services'
          ? { ...section, heading: 'Servicing and repairs in Bristol' }
          : section),
    };
    assert.ok(kinds(garage.run(broken).issues).includes('duplicate-value-proposition'));
  });

  test('a page whose headings say nothing about this business at all', () => {
    const generic: WebsiteContent = {
      ...garage.directed.content,
      sections: garage.directed.content.sections.map((section, index) => ({
        ...section,
        heading: ['Home', 'Overview', 'More', 'Info', 'Details', 'Welcome'][index] ?? 'More',
      })),
    };
    const report = garage.run(generic);
    assert.ok(kinds(report.issues).includes('no-business-evidence'), report.issues.map((i) => i.kind).join(','));
    assert.ok(kinds(report.issues).includes('weak-heading'));
    assert.equal(report.ok, false);
    assert.ok(report.score < 60, `a wholly generic page scored ${report.score}`);
  });

  test('a beat that runs far past what it can hold', () => {
    const broken = withSection(garage.directed.content, 'hero', {
      body: 'A garage in Bristol. '.repeat(40),
    });
    assert.ok(kinds(garage.run(broken).issues).includes('verbose'));
  });
});

describe('the score separates an honest page from a broken one', () => {
  test('errors cost far more than warnings', () => {
    const good = garage.run().score;
    const broken = garage.run(withSection(garage.directed.content, 'about', {
      body: 'Welcome to our award-winning garage, serving the city since 1974.',
    })).score;
    assert.ok(broken < good - 40, `good ${good}, broken ${broken}`);
  });
});
