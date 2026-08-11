/**
 * The BusinessForge benchmark.
 *
 * Six businesses of genuinely different character, each run through the *real*
 * deterministic pipeline (`composeDesign`) with no manual edits, asserting that
 * they receive materially different experiences — the acceptance criterion for
 * the whole experience system. This is not a screenshot test; it reads the
 * design artifact and checks the decisions.
 *
 * Fixtures are synthetic but shaped like real research output. No business is
 * named in the platform code; divergence must come from character + evidence.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { composeDesign } from '../../lib/design/compose.js';
import { deriveCharacter } from '../../lib/design/character.js';
import { scoreExperience, genericityReport, narrativeCoherence } from '../../lib/design/quality.js';
import { planNarrative } from '../../lib/design/plan.js';
import { directContent } from '../../lib/content/director.js';
import { auditContent } from '../../lib/content/quality.js';
import type { BusinessProfile, WebsiteContent, ImageAsset, SectionKind } from '../../lib/types.js';
import type { WebsiteDesign } from '../../lib/design/types.js';

/* --- fixture factory: a full, valid profile + content from a compact spec --- */

interface Img { w: number; h: number; host: string; alt: string }
interface Spec {
  category: string;
  description: string;
  tagline: string;
  services: readonly string[];
  rating: number | null;
  phone: boolean;
  images: readonly Img[];
  sections: readonly SectionKind[];
}

function image(im: Img, i: number): ImageAsset {
  return {
    url: `https://${im.host}/img${i}.jpg`,
    role: 'gallery', alt: im.alt, width: im.w, height: im.h,
    localPath: `assets/g${i}.jpg`, bytes: 200000,
    sourceUrl: `https://${im.host}/page`,
  };
}

function make(spec: Spec): { profile: BusinessProfile; content: WebsiteContent } {
  const imgs = spec.images.map(image);
  const profile = {
    name: { value: 'Business', source: 'maps', sourceUrl: 's', alternatives: [] },
    category: { value: spec.category, source: 'maps', sourceUrl: 's', alternatives: [] },
    description: { value: spec.description, source: 'website', sourceUrl: 's', alternatives: [] },
    address: null, coordinates: null, website: null,
    phones: spec.phone ? [{ value: { formatted: '0700', e164: null, digits: '0700' }, source: 'maps', sourceUrl: 's', alternatives: [] }] : [],
    emails: [], socialProfiles: [], hours: [],
    rating: spec.rating === null ? null : { value: spec.rating, source: 'maps', sourceUrl: 's', alternatives: [] },
    reviewCount: null, navigation: [],
    services: spec.services.map((name) => ({ name, description: name, sourceUrl: 's' })),
    pages: [], attributes: [], reviews: [],
    images: { logo: null, favicon: null, hero: imgs[0] ?? null, gallery: imgs.slice(1) },
    validation: { ok: true, issues: [] }, sources: [], normalizedAt: '',
  } as unknown as BusinessProfile;

  const content = {
    businessName: 'Business', tagline: spec.tagline,
    voice: { tone: 'clear', palette: [], typography: { heading: '', body: '' } },
    sections: spec.sections.map((kind) => ({
      kind,
      heading: kind, subheading: null,
      body: kind === 'about' ? spec.description : kind === 'services' ? '' : '',
      bullets: kind === 'services' ? spec.services.map((s) => `${s} — ${s}`)
        : kind === 'menu' ? ['Item — desc', 'Item2 — desc']
          // An hours section with no rows is a heading over nothing, which the
          // content gate rightly rejects. `composeBaseline` never emits one —
          // it requires published hours — so the fixture must not either.
          : kind === 'hours' ? ['Monday to Friday — 09:00–17:00']
            : kind === 'location' ? ['Address — 1 High Street']
              // Likewise: `groundTestimonials` only emits this section when it
              // has verbatim reviews to put in it.
              : kind === 'testimonials' ? ['"A good evening." — A guest']
                : [],
      images: kind === 'gallery' ? imgs : [],
      callToAction: kind === 'cta' || kind === 'hero' || kind === 'contact' ? { label: 'Contact', href: 'tel:0700' } : null,
    })),
    trust: spec.rating !== null ? [{ kind: 'rating', label: `${spec.rating}`, source: 'maps' }] : [],
    facts: spec.services.slice(0, 4),
    seo: { title: 't', description: spec.description, keywords: [], structuredData: {} },
    unresolvedGaps: [],
  } as unknown as WebsiteContent;

  return { profile, content };
}

const OWN = 'mybusiness.example';         // own-domain host → usable/unknown rights
const SOCIAL = 'honeypot0.s3.amazonaws.com'; // directory-rehosted → reference-only

const BUSINESSES: Record<string, Spec> = {
  bakery: {
    category: 'Bakery', description: 'An artisan bakery: sourdough, pastries and cakes baked fresh every morning by hand.',
    tagline: 'Artisan bakery', services: ['Sourdough', 'Pastries', 'Celebration cakes'], rating: 4.8, phone: true,
    images: Array.from({ length: 6 }, (_, i) => ({ w: 1600, h: 1066, host: OWN, alt: `interior counter bread ${i}` })),
    sections: ['hero', 'about', 'menu', 'gallery', 'hours', 'contact', 'cta'],
  },
  restaurant: {
    category: 'Restaurant', description: 'A neighbourhood restaurant serving seasonal cuisine, a wine list and a warm dining room.',
    tagline: 'Seasonal dining', services: ['Lunch', 'Dinner'], rating: 4.5, phone: true,
    images: [{ w: 1600, h: 1066, host: OWN, alt: 'dining room interior' }, { w: 1200, h: 1600, host: OWN, alt: 'plated dish' }, { w: 1600, h: 1066, host: OWN, alt: 'terrace' }, { w: 1400, h: 1400, host: OWN, alt: 'bar counter' }],
    sections: ['hero', 'menu', 'gallery', 'testimonials', 'contact', 'cta'],
  },
  hotel: {
    category: 'Hotel', description: 'A boutique hotel with warm rooms, a spa and a restaurant for a restful stay.',
    tagline: 'Boutique stay', services: ['Rooms', 'Spa', 'Restaurant'], rating: 4.6, phone: true,
    images: [{ w: 1600, h: 1066, host: OWN, alt: 'lobby interior' }, { w: 1600, h: 1066, host: OWN, alt: 'room' }, { w: 1200, h: 1600, host: OWN, alt: 'spa detail' }, { w: 1600, h: 1066, host: OWN, alt: 'terrace exterior' }, { w: 1400, h: 1400, host: OWN, alt: 'breakfast' }],
    sections: ['hero', 'about', 'services', 'gallery', 'contact', 'cta'],
  },
  barber: {
    category: 'Barber shop', description: 'A classic barber: cuts, hot-towel shaves and beard trims. Walk-ins welcome.',
    tagline: 'Classic barbering', services: ['Cuts', 'Shaves', 'Beard trims'], rating: 4.9, phone: true,
    images: [{ w: 1200, h: 1200, host: OWN, alt: 'interior chair' }, { w: 1200, h: 1200, host: OWN, alt: 'cut detail' }],
    sections: ['hero', 'services', 'hours', 'contact', 'cta'],
  },
  mechanic: {
    category: 'Auto repair', description: 'Car servicing, MOT and repairs. Fast, honest and fairly priced.',
    tagline: 'Servicing and repairs', services: ['Servicing', 'MOT', 'Repairs', 'Diagnostics'], rating: 4.4, phone: true,
    images: [],
    sections: ['hero', 'services', 'hours', 'location', 'contact', 'cta'],
  },
  // A second hotel with materially thinner, more functional evidence — same
  // industry as `hotel`, different character, so its script must diverge.
  hotelThin: {
    category: 'Hotel', description: 'Budget hotel near the motorway. Clean rooms, free parking, 24h reception. Book by phone.',
    tagline: 'Rooms from £49', services: ['Rooms', 'Parking'], rating: 3.9, phone: true,
    images: [{ w: 1200, h: 800, host: OWN, alt: 'room' }],
    sections: ['hero', 'services', 'location', 'hours', 'contact', 'cta'],
  },
  eventVenue: {
    category: 'Event & wedding venue', description: 'Locație de nuntă și evenimente pe malul râului: sala mare cu candelabru floral, primul dans pe nori, grădină de ceremonie, pentru nunți, botezuri și celebrări. Cazare la hotel.',
    tagline: 'Nunți și evenimente', services: ['Nunți', 'Botezuri', 'Cununii', 'Corporate', 'Gastronomie', 'Cazare hotel'], rating: 4.7, phone: true,
    images: [
      { w: 2048, h: 1365, host: SOCIAL, alt: 'sala mare candelabru primul dans' },
      { w: 1290, h: 1716, host: SOCIAL, alt: 'prezidiu arcade' },
      { w: 1600, h: 1066, host: SOCIAL, alt: 'sala mare dans' },
      { w: 1440, h: 1440, host: SOCIAL, alt: 'sala calda banchet' },
      { w: 1066, h: 1600, host: SOCIAL, alt: 'detaliu aranjament meniu' },
      { w: 1600, h: 1066, host: SOCIAL, alt: 'runner floral' },
      { w: 1290, h: 1716, host: SOCIAL, alt: 'sala mare arcade verde' },
      { w: 1290, h: 1716, host: SOCIAL, alt: 'aranjament floral aperitive' },
    ],
    sections: ['hero', 'about', 'services', 'gallery', 'hours', 'contact', 'cta'],
  },
};

function designOf(name: string): { design: WebsiteDesign; profile: BusinessProfile; content: WebsiteContent } {
  const { profile, content } = make(BUSINESSES[name] as Spec);
  const design = composeDesign({ profile, content });
  return { design, profile, content };
}

const NAMES = Object.keys(BUSINESSES);

test('BENCHMARK: six businesses, printed decision table', () => {
  const rows: string[] = [];
  for (const name of NAMES) {
    const { design, profile, content } = designOf(name);
    const ch = deriveCharacter(profile, content, { ground: 'warm', imageReliance: 'essential' }); // note: illustrative; compose uses industry ground
    const score = scoreExperience(design, content, ch);
    rows.push(
      `${name.padEnd(11)} [${design.experience.mode.padEnd(9)}] score=${score.overall}\n`
      + `            arc: ${design.experienceScript.arc.join(' → ')}\n`
      + `            sections: ${design.layout.order.map((i) => design.layout.sections.find((s) => s.index === i)?.kind).join(' → ')}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('\n' + rows.join('\n') + '\n');
});

/** The narrative arc (roles) a business's script produces. */
function arcOf(name: string): readonly string[] {
  return designOf(name).design.experienceScript.arc;
}

test('narrative order is character-driven, not one fixed sequence', () => {
  // A functional trade: offering then contact, no signature, no reveal-led arc.
  const mech = arcOf('mechanic');
  assert.equal(mech[0], 'arrival', `mechanic opens on ${mech[0]}`);
  assert.ok(mech.includes('breadth'), 'mechanic shows its offering');
  assert.ok(!mech.includes('signature'), 'mechanic has no signature moment');
  // breadth (services) must come before the first contact/conversion.
  assert.ok(mech.indexOf('breadth') < mech.indexOf('conversion'), 'mechanic shows services before asking for contact');

  // An experiential venue: opens on emotion, builds to a signature, converts late.
  const venue = arcOf('eventVenue');
  assert.ok(venue[0] === 'emotion' || venue[0] === 'arrival', `venue opens on ${venue[0]}`);
  assert.ok(venue.includes('signature'), 'venue has a signature moment');
  assert.ok(venue.indexOf('signature') < venue.indexOf('conversion'), 'venue builds to the signature before converting');

  // A hotel narrative reaches booking after atmosphere/experience.
  const hotel = arcOf('hotel');
  assert.ok(hotel.includes('reveal') || hotel.includes('signature'), 'hotel reveals the place');
  assert.ok(hotel.lastIndexOf('conversion') === hotel.length - 1, 'hotel closes on conversion');
});

test('CRITICAL: two hotels with different evidence diverge in narrative', () => {
  const rich = arcOf('hotel').join('>');
  const thin = arcOf('hotelThin').join('>');
  assert.notEqual(rich, thin, `same-industry hotels must diverge:\n  rich: ${rich}\n  thin: ${thin}`);
  // The rich hotel earns a signature/reveal arc; the thin one is a plain brochure.
  assert.ok(arcOf('hotel').includes('signature') || arcOf('hotel').includes('reveal'), 'rich hotel has discovery');
  assert.equal(designOf('hotelThin').design.experience.mode, 'brochure', 'thin hotel is an honest brochure');
  assert.equal(arcOf('hotelThin').includes('signature'), false, 'thin hotel invents no signature');
});

test('every business passes the narrative-coherence check', () => {
  for (const name of NAMES) {
    const { design, profile, content } = designOf(name);
    const ch = deriveCharacter(profile, content, { ground: 'warm', imageReliance: 'essential' });
    const rep = narrativeCoherence(design, ch);
    assert.ok(rep.ok, `${name} narrative-coherence violations: ${rep.violations.join('; ')}`);
  }
});

test('the coherence check actually catches a bad narrative', () => {
  // Fabricate a design that buries a nominated signature and asks too early:
  const { design, profile, content } = designOf('eventVenue');
  const ch = deriveCharacter(profile, content, { ground: 'atmospheric', imageReliance: 'essential' });
  const broken = {
    ...design,
    conversion: { ...design.conversion, mode: 'editorial' as const },
    experienceScript: { ...design.experienceScript, conversionAt: 0 },
  };
  const rep = narrativeCoherence(broken as typeof design, ch);
  assert.equal(rep.ok, false, 'a conversion-at-position-0 editorial page must fail coherence');
});

test('A/D: the six businesses do not collapse to one template', () => {
  const entries = NAMES.map((name) => ({ name, design: designOf(name).design }));
  const report = genericityReport(entries);
  assert.equal(report.verdict, 'diverse', report.rationale);
  // Experience mode, hero and conversion must all vary across the set.
  assert.ok((report.distinct.experienceMode ?? 0) >= 3, `experienceMode distinct=${report.distinct.experienceMode}`);
  assert.ok((report.distinct.ctaPlacement ?? 0) >= 2, `ctaPlacement distinct=${report.distinct.ctaPlacement}`);
});

test('E: the event venue produces narrative, gallery-led behaviour', () => {
  const { design } = designOf('eventVenue');
  assert.equal(design.experience.mode, 'narrative');
  assert.equal(design.experience.galleryLead, true);
  assert.equal(design.experience.signatureMoment, 'gallery');
  const g = design.layout.sections.find((s) => s.kind === 'gallery');
  assert.equal(g?.emphasis, 'lead');
  assert.equal(g?.fullBleed, true);
});

test('F: a thin, image-less business still gets an intentional experience', () => {
  const { design, profile, content } = designOf('mechanic');
  // Not broken, not a thin brochure by accident: it is an intentional brochure.
  assert.equal(design.experience.mode, 'brochure');
  assert.equal(design.assets.reduceImagery, true);
  assert.equal(design.conversion.mode, 'high-intent');
  assert.equal(design.conversion.contactProminence, 'immediate');
  // still explainable and scored
  const ch = deriveCharacter(profile, content, { ground: 'clean', imageReliance: 'incidental' });
  const score = scoreExperience(design, content, ch);
  assert.ok(score.overall >= 60, `thin business scored ${score.overall}`);
  assert.equal(score.flags.includes('Page leads with imagery but no hero image was chosen.'), false);
});

test('G: rights are distinguished — social-sourced assets are reference-only', () => {
  const venue = designOf('eventVenue').design;
  const bakery = designOf('bakery').design;
  assert.ok(venue.assets.referenceOnly.length > 0, 'venue social images should be reference-only');
  assert.equal(bakery.assets.referenceOnly.length, 0, 'own-domain bakery images are not reference-only');
});

test('H: every business scores, and every design decision is explainable', () => {
  for (const name of NAMES) {
    const { design, profile, content } = designOf(name);
    const ch = deriveCharacter(profile, content, { ground: 'warm', imageReliance: 'essential' });
    const score = scoreExperience(design, content, ch);
    assert.equal(score.axes.explainability, 1, `${name} has an unexplained decision`);
    assert.ok(score.overall >= 55, `${name} scored ${score.overall}`);
  }
});

/* ------------------------------------------------------------------ */
/* Content — the same seven businesses, now read for what they *say*   */
/* ------------------------------------------------------------------ */

/** One business through the real content path: plan → direct → audit. */
function copyOf(name: string) {
  const { profile, content } = make(BUSINESSES[name] as Spec);
  const plan = planNarrative(profile, content);
  const directed = directContent(profile, content, plan);
  const audit = auditContent({
    content: directed.content,
    evidence: directed.evidence,
    roles: plan.roles,
    conversion: plan.conversion,
  });
  return { profile, baseline: content, plan, directed, audit };
}

test('BENCHMARK: seven businesses, printed copy table', () => {
  const rows: string[] = [];
  for (const name of NAMES) {
    const { directed, plan, audit } = copyOf(name);
    rows.push(
      `${name.padEnd(11)} [${plan.conversion.primaryCta.padEnd(7)}] content=${audit.score} specificity=${audit.specificity.toFixed(2)}\n`
      + `            ${directed.content.sections.map((section) => section.heading).join(' · ')}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('\n' + rows.join('\n') + '\n');
});

test('CONTENT: no two businesses receive the same set of headings', () => {
  const seen = new Map<string, string>();
  for (const name of NAMES) {
    const key = copyOf(name).directed.content.sections.map((section) => section.heading).join('|');
    const clash = seen.get(key);
    assert.equal(clash, undefined, `${name} and ${clash} have identical copy:\n  ${key}`);
    seen.set(key, name);
  }
});

test('CONTENT: two hotels with different evidence say different things', () => {
  const rich = copyOf('hotel');
  const thin = copyOf('hotelThin');
  const headings = (result: typeof rich): string =>
    result.directed.content.sections.map((section) => section.heading).join('|');
  assert.notEqual(headings(rich), headings(thin));
  // …and the divergence reaches the ask, not only the labels.
  assert.notEqual(
    `${rich.plan.conversion.mode}/${rich.plan.conversion.ctaPlacement}`,
    `${thin.plan.conversion.mode}/${thin.plan.conversion.ctaPlacement}`,
  );
});

test('CONTENT: the closing ask differs where the evidence and intent differ', () => {
  const asks = new Set(NAMES.map((name) => copyOf(name).plan.conversion.primaryCta));
  assert.ok(asks.size >= 3, `only ${asks.size} distinct primary actions across seven businesses: ${[...asks].join(', ')}`);

  for (const name of NAMES) {
    const { directed, plan } = copyOf(name);
    for (const section of directed.content.sections) {
      if (section.callToAction === null || section.kind === 'hours') continue;
      const label = section.callToAction.label;
      assert.ok(label.trim() !== '', `${name}: an empty button label`);
      // Every button on a page offers the same action, so a visitor is never
      // asked two different things by the same page.
      assert.equal(
        label,
        directed.content.sections.find((s) => s.callToAction !== null && s.kind !== 'hours')?.callToAction?.label,
        `${name}: "${label}" disagrees with the page's other buttons (strategy: ${plan.conversion.primaryCta})`,
      );
    }
  }
});

test('CONTENT: the quality gate passes every business', () => {
  for (const name of NAMES) {
    const { audit } = copyOf(name);
    const errors = audit.issues.filter((issue) => issue.severity === 'error');
    assert.equal(errors.length, 0, `${name}: ${errors.map((issue) => `${issue.kind} — ${issue.message}`).join('; ')}`);
  }
});

test('CONTENT: the quality gate rejects a fabricating page for every business', () => {
  // The same lie, told about seven different businesses. None of them proved it,
  // so all seven must be rejected — a gate that only catches one shape of
  // fabrication is a gate that has been fitted to its fixtures.
  for (const name of NAMES) {
    const { directed, plan, profile, baseline } = copyOf(name);
    const poisoned = {
      ...directed.content,
      sections: directed.content.sections.map((section, index) =>
        index === 1
          ? { ...section, body: 'Welcome to our award-winning rooms, certified since 1974 and trusted by 10,000 customers.' }
          : section),
    };
    const report = auditContent({
      content: poisoned,
      evidence: directContent(profile, baseline, plan).evidence,
      roles: plan.roles,
      conversion: plan.conversion,
    });
    assert.equal(report.ok, false, `${name}: the gate accepted a fabricated page`);
    const kinds = report.issues.map((issue) => issue.kind);
    assert.ok(kinds.includes('unsupported-claim'), `${name}: ${kinds.join(',')}`);
    assert.ok(kinds.includes('boilerplate'), `${name}: ${kinds.join(',')}`);
  }
});

test('CONTENT: directing the copy never changes the narrative plan', () => {
  // The guarantee that lets the design be composed from directed content: a page
  // must not read the platform's own adjectives back as evidence about the
  // business. See `lib/design/plan.ts`.
  for (const name of NAMES) {
    const { profile, plan, directed } = copyOf(name);
    const after = planNarrative(profile, directed.content);
    assert.deepEqual(after.character, plan.character, `${name} character moved`);
    assert.deepEqual(after.experience, plan.experience, `${name} experience moved`);
    assert.deepEqual(after.conversion, plan.conversion, `${name} conversion moved`);
    assert.deepEqual(after.order, plan.order, `${name} order moved`);
  }
});

test('CONTENT: the deterministic path needs no model and invents no fact', () => {
  for (const name of NAMES) {
    const { directed, baseline } = copyOf(name);
    // Structure is untouched…
    assert.deepEqual(
      directed.content.sections.map((section) => section.kind),
      baseline.sections.map((section) => section.kind),
      `${name} changed the page's structure`,
    );
    // …and every quotation is verbatim from what the business published.
    const corpus = [
      directed.evidence.name, directed.evidence.trade ?? '',
      ...directed.evidence.offerings, ...directed.evidence.amenities,
      ...directed.evidence.sentences.map((sentence) => sentence.text),
      ...directed.evidence.imageDescriptions,
    ].join(' \n ').toLowerCase();
    for (const decision of directed.decisions) {
      if (decision.basis !== 'quoted') continue;
      assert.ok(
        corpus.includes(decision.value.toLowerCase()),
        `${name}: "${decision.value}" is not verbatim in the evidence`,
      );
    }
  }
});
