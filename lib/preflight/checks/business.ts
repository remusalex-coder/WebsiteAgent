/**
 * Business-specific readiness: checks whose applicability turns on what kind
 * of business this is and what evidence the profile actually carries — never
 * on a fixed checklist. Every industry set here is imported from
 * `helpers.ts`, which is the single place that owns them.
 */

import {
  CASE_STUDY_INDUSTRIES,
  SERVICE_SLA_INDUSTRIES,
  TEAM_RELEVANT_INDUSTRIES,
  allProse,
  callsToAction,
  check,
  extractJsonLd,
  isGroundedInPages,
  sectionOf,
} from '../helpers.js';
import type { CheckFn } from '../types.js';

/** Strips a bullet's trailing `" — attribution"` back to the quoted claim. */
function testimonialClaim(bullet: string): string {
  return bullet.replace(/[—–]\s*[^—–]{2,60}$/, '').replace(/^["“]|["”]$/g, '').trim();
}

const realReviews: CheckFn = (ctx) => {
  const c = check('business.real-reviews', 'business-specific', 'Reviews are real, not generated', 'critical');
  const testimonials = sectionOf(ctx, 'testimonials');
  if (testimonials === null) return c.na('no testimonials section is in the content spec');

  if (testimonials.bullets.length === 0) {
    return c.fail(['a testimonials section exists with no quotes in it'], 'Remove the empty testimonials section, or populate it from real customer words found on the business\'s own site.');
  }

  const hasRatingEvidence = ctx.profile.rating !== null && ctx.profile.reviewCount !== null;
  const grounded = testimonials.bullets.filter((bullet) => isGroundedInPages(testimonialClaim(bullet), ctx.profile));
  const ungrounded = testimonials.bullets.filter((bullet) => !grounded.includes(bullet));

  if (grounded.length === 0 && !hasRatingEvidence) {
    return c.fail(
      [
        `${testimonials.bullets.length} testimonial quote(s), none of which appear in the pages the collector read`,
        'no Maps rating/review-count evidence backs the section either',
      ],
      'Never fabricate reviews. Use only quotes that appear verbatim on the business\'s own site, or remove the testimonials section.',
    );
  }
  if (ungrounded.length > 0) {
    return c.warn(
      [`${grounded.length} of ${testimonials.bullets.length} testimonial quote(s) are traceable to the collected pages`, `not traceable: ${ungrounded.join(' | ')}`],
      'Verify the ungrounded quote(s) actually appear on the business\'s site before shipping; remove any that do not.',
    );
  }
  return c.pass([`${grounded.length} of ${testimonials.bullets.length} testimonial quote(s) are traceable to the collected pages`]);
};

/** A conservative mapping of industry to the schema.org type family it belongs in. */
const SCHEMA_FAMILY: Readonly<Record<string, readonly string[]>> = {
  bakery: ['Bakery', 'FoodEstablishment', 'LocalBusiness'],
  restaurant: ['Restaurant', 'FoodEstablishment', 'LocalBusiness'],
  cafe: ['CafeOrCoffeeShop', 'FoodEstablishment', 'LocalBusiness'],
  bar: ['BarOrPub', 'FoodEstablishment', 'LocalBusiness'],
  law: ['LegalService', 'LocalBusiness'],
  medical: ['MedicalClinic', 'MedicalBusiness', 'LocalBusiness'],
  dental: ['Dentist', 'MedicalBusiness', 'LocalBusiness'],
  beauty: ['BeautySalon', 'HealthAndBeautyBusiness', 'LocalBusiness'],
  spa: ['DaySpa', 'HealthAndBeautyBusiness', 'LocalBusiness'],
  gym: ['ExerciseGym', 'SportsActivityLocation', 'LocalBusiness'],
  construction: ['HomeAndConstructionBusiness', 'LocalBusiness'],
  automotive: ['AutoRepair', 'AutomotiveBusiness', 'LocalBusiness'],
  hotel: ['Hotel', 'LodgingBusiness', 'LocalBusiness'],
  retail: ['Store', 'LocalBusiness'],
  'real-estate': ['RealEstateAgent', 'LocalBusiness'],
  'professional-services': ['ProfessionalService', 'LocalBusiness'],
  general: ['LocalBusiness'],
};

const localSchemaMatch: CheckFn = (ctx) => {
  const c = check('business.local-schema-match', 'business-specific', 'Schema type matches business type', 'medium');
  if (ctx.profile.address === null) {
    return c.na('no physical address is on record; LocalBusiness-family schema is for businesses with a location');
  }

  const parsed = extractJsonLd(ctx.html);
  const type = typeof parsed?.['@type'] === 'string' ? (parsed['@type'] as string) : null;
  if (type === null) {
    return c.fail(['profile has an address but the rendered page carries no JSON-LD @type'], 'Emit structured data with a schema.org @type appropriate to this business.');
  }

  const family = SCHEMA_FAMILY[ctx.design.industry.id] ?? SCHEMA_FAMILY.general ?? ['LocalBusiness'];
  const specific = family.filter((entry) => entry !== 'LocalBusiness');

  // The generic fallback is checked before the full family: every family ends
  // in "LocalBusiness" as its always-true fallback, so a plain `includes`
  // would accept the generic type even where a more specific one exists.
  if (type === 'LocalBusiness' && specific.length > 0) {
    return c.warn(
      [`@type is the generic "LocalBusiness"; a more specific type exists for "${ctx.design.industry.id}": ${specific.join(', ')}`],
      `Use a more specific @type — ${specific[0]} — so search engines can show category-specific rich results.`,
    );
  }
  if (family.includes(type)) {
    return c.pass([`@type "${type}" matches the "${ctx.design.industry.id}" schema family (${family.join(', ')})`]);
  }
  return c.fail(
    [`@type "${type}" does not match the "${ctx.design.industry.id}" schema family (expected one of: ${family.join(', ')})`],
    `Correct the schema @type to match this business's actual category.`,
  );
};

const TEAM_KEYWORDS = /\b(team|staff|founder|owner|meet the|our people)\b/i;

const teamPhotography: CheckFn = (ctx) => {
  const c = check('business.team-photography', 'business-specific', 'Real team photography', 'low');
  const about = sectionOf(ctx, 'about');
  const mentionsTeam = about !== null && TEAM_KEYWORDS.test(`${about.heading} ${about.body} ${about.bullets.join(' ')}`);
  const industryRelevant = TEAM_RELEVANT_INDUSTRIES.has(ctx.design.industry.id);

  if (!mentionsTeam && !industryRelevant) {
    return c.na(`"${ctx.design.industry.id}" is not a team-forward industry and no section mentions the team`);
  }

  const hasRealTeamImage = about !== null && about.images.length > 0;
  if (hasRealTeamImage) {
    return c.pass([`the about section carries ${about?.images.length} real image(s) sourced from the business's own site`]);
  }
  return c.warn(
    [`industry "${ctx.design.industry.id}" or the about copy suggests team presentation matters, but no photograph is placed`],
    'Add real team photography once it exists. Do not generate synthetic photos of people.',
  );
};

const BOOKING_LANGUAGE = /\b(book|reserve|reservation|schedule|appointment)\b/i;

const bookingFunctionality: CheckFn = (ctx) => {
  const c = check('business.booking-functionality', 'business-specific', 'Booking calls to action actually resolve', 'high');
  const bookingCtas = callsToAction(ctx).filter((cta) => BOOKING_LANGUAGE.test(cta.label));
  if (bookingCtas.length === 0) {
    return c.na('no call to action uses booking/reservation/appointment language');
  }
  const broken = bookingCtas.filter((cta) => cta.href.trim() === '');
  if (broken.length > 0) {
    return c.fail(broken.map((cta) => `"${cta.label}" in the "${cta.kind}" section has an empty href`), 'Point every booking-language CTA at a working channel (phone, email, or a real booking page) or remove the wording.');
  }
  return c.pass(bookingCtas.map((cta) => `"${cta.label}" in the "${cta.kind}" section resolves to ${cta.href}`));
};

const caseStudies: CheckFn = (ctx) => {
  const c = check('business.case-studies', 'business-specific', 'Case studies / past work', 'low');
  if (!CASE_STUDY_INDUSTRIES.has(ctx.design.industry.id)) {
    return c.na(`"${ctx.design.industry.id}" is not an industry where documented past work is a standard trust signal`);
  }
  // The renderer's closed set of section kinds has no case-study/portfolio
  // kind, so this can never be satisfied by the current architecture — a
  // real, honest gap rather than a check that quietly always passes.
  return c.warn(
    [`industry "${ctx.design.industry.id}" typically benefits from case studies, but the renderer has no case-study/portfolio section kind`],
    'Add a case-study section kind to WebsiteContent/the renderer once real project evidence (with client permission) exists. Never fabricate one.',
  );
};

const RESPONSE_TIME_CLAIM = /\b\d+\s*(minute|min|hour|hr|day)s?\b[^.?!]{0,40}\b(respond|response|reply|callback|turnaround)\b/i;

const responseTimePromise: CheckFn = (ctx) => {
  const c = check('business.response-time-promise', 'business-specific', 'Response-time promises are grounded', 'high');
  const claims = allProse(ctx).filter((text) => RESPONSE_TIME_CLAIM.test(text));
  if (claims.length === 0) {
    if (SERVICE_SLA_INDUSTRIES.has(ctx.design.industry.id)) {
      return c.na(`no response-time claim is made; "${ctx.design.industry.id}" can ship without one`);
    }
    return c.na('no response-time claim is made on the page');
  }
  const ungrounded = claims.filter((claim) => !isGroundedInPages(claim, ctx.profile));
  if (ungrounded.length > 0) {
    return c.fail(ungrounded.map((claim) => `unsupported claim: "${claim}"`), 'Remove or verify the response-time promise — it does not appear in the pages the collector read from the business\'s own site.');
  }
  return c.pass(claims.map((claim) => `grounded claim: "${claim}"`));
};

const mapsDirections: CheckFn = (ctx) => {
  const c = check('business.maps-directions', 'business-specific', 'Maps / directions', 'medium');
  if (ctx.profile.address === null) {
    return c.na('no physical address is on record; there is nowhere to direct a visitor to');
  }

  const mapsLink = callsToAction(ctx).find((cta) => /maps\.(google|apple)\.com|goo\.gl\/maps/i.test(cta.href));
  const parsed = extractJsonLd(ctx.html);
  const hasGeo = typeof parsed?.geo === 'object' && parsed?.geo !== null;

  if (mapsLink !== undefined && hasGeo) {
    return c.pass([`"${mapsLink.kind}" section links directly to a map`, 'JSON-LD carries geo coordinates']);
  }
  if (mapsLink !== undefined) {
    return c.pass([`"${mapsLink.kind}" section links directly to a map`]);
  }
  if (hasGeo) {
    return c.pass(['JSON-LD carries geo coordinates, which search and maps integrations can use for directions even with no on-page link']);
  }
  return c.fail(
    [`profile has an address (${ctx.profile.address.value.formatted}) but no map link and no geo coordinates in structured data`],
    'Link the location section to a maps URL, or ensure the verified coordinates reach structuredData.geo.',
  );
};

const faqEvidence: CheckFn = (ctx) => {
  const c = check('business.faq-evidence', 'business-specific', 'FAQ is evidence-driven, not filler', 'medium');
  const faq = sectionOf(ctx, 'faq');
  if (faq === null) return c.na('no faq section is in the content spec');
  if (faq.bullets.length === 0) {
    return c.fail(['a faq section exists with no bullets'], 'Remove the empty FAQ section.');
  }
  const wellFormed = faq.bullets.filter((bullet) => bullet.includes('?'));
  if (wellFormed.length < faq.bullets.length) {
    return c.warn(
      [`${faq.bullets.length - wellFormed.length} of ${faq.bullets.length} FAQ bullet(s) are not phrased as "Question? Answer."`],
      'Rewrite each bullet as a real question the brief answers, not a generic statement.',
    );
  }
  return c.pass([`${faq.bullets.length} FAQ entries, all phrased as questions`]);
};

export const businessChecks: readonly CheckFn[] = [
  realReviews,
  localSchemaMatch,
  teamPhotography,
  bookingFunctionality,
  caseStudies,
  responseTimePromise,
  mapsDirections,
  faqEvidence,
];
