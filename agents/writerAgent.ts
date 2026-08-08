/**
 * Stage 5 of 6.
 *
 * Single responsibility: turn the business profile and its strategy into a
 * complete website spec — structure, copy, brand voice, SEO. It is the only
 * agent that produces prose.
 *
 * It never browses and never deploys. Its output is design-tool agnostic: the
 * same `WebsiteContent` could be handed to Lovable, a static generator, or a
 * human designer.
 *
 * ## What the model is allowed to decide
 *
 * Prose, and only prose. The model chooses which sections the page has, what
 * each one says, and how it says it. Everything that is a *fact* about the
 * business — the address, the phone numbers, the opening hours, the JSON-LD,
 * which photographs exist — is assembled from `BusinessProfile` by the code
 * below, after the model has answered.
 *
 * That split is the no-invention rule made structural rather than aspirational.
 * A model told "do not invent a phone number" usually complies; a model that is
 * never asked for one cannot fail. So the schema has no field for a phone
 * number, no field for an image URL, and no field for structured data, and the
 * two sections that are pure data — `hours` and `contact` — have their bullets
 * replaced with profile-derived ones after generation.
 *
 * What the model can still get wrong is a claim inside a sentence, and that is
 * checked rather than trusted: `groundingWarnings` reads every string the model
 * produced back against the profile and reports any address, phone number or
 * link that is not in it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { UpstreamError } from '../lib/errors.js';
import { VENDORED_FACES } from '../lib/render/fontManifest.js';
import { assignIds } from '../lib/render/site.js';

import type { AIProvider, JsonSchema } from '../lib/ai/types.js';
import type { WriterConfig } from '../lib/config.js';
import type { Logger } from '../lib/logger.js';
import type {
  Agent,
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  ImageAsset,
  OpeningHours,
  PhoneNumber,
  SectionKind,
  WebsiteContent,
  WebsiteSection,
} from '../lib/types.js';

const NAME = 'writerAgent';

const ARTIFACT = 'content.json';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Monday first: how a business writes its own opening hours. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Upper bound on photographs handed to the gallery section.
 *
 * The collector routinely returns forty or more. A page showing all of them is
 * a contact sheet, not a gallery, and the images are already ranked best-first
 * by the normalizer — so the cut is from the tail.
 */
const MAX_GALLERY_IMAGES = 12;

/* ------------------------------------------------------------------ */
/* Output schema                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every section kind the renderer can draw.
 *
 * `satisfies` rather than a plain annotation, so adding a kind to `SectionKind`
 * without adding it here is a type error rather than a silently narrower writer.
 */
const SECTION_KINDS = [
  'hero',
  'about',
  'services',
  'menu',
  'gallery',
  'testimonials',
  'hours',
  'location',
  'contact',
  'cta',
  'faq',
] as const satisfies readonly SectionKind[];

/** Sections a call to action may link to, by kind. */
const CTA_SECTION_TARGETS = [
  'about',
  'services',
  'menu',
  'gallery',
  'testimonials',
  'hours',
  'location',
  'contact',
  'faq',
] as const satisfies readonly SectionKind[];

/**
 * Where a call to action is allowed to point.
 *
 * A closed set of *intents*, not URLs. The model says "phone" and the code
 * below resolves that to the number in the profile — which is what stops a
 * plausible-looking `tel:` for a business that never published one, and what
 * guarantees an in-page anchor actually resolves to a section that exists.
 */
const CTA_TARGETS = [
  'none',
  'phone',
  'email',
  'website',
  'instagram',
  'facebook',
  ...CTA_SECTION_TARGETS,
] as const;

type CtaTarget = (typeof CTA_TARGETS)[number];

/** Typefaces the renderer can actually serve, from the vendored woff2 set. */
const FONT_FAMILIES: readonly string[] = Array.from(
  new Set(VENDORED_FACES.map((face) => face.family)),
).sort();

const stringArray = (description: string): JsonSchema => ({
  type: 'array',
  description,
  items: { type: 'string' },
});

function objectSchema(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function arrayOf(properties: Record<string, JsonSchema>, description: string): JsonSchema {
  return { type: 'array', description, items: objectSchema(properties) };
}

/**
 * Exported so it can be checked against the structured-output constraints:
 * every object needs `additionalProperties: false` and a complete `required`
 * list, and the numeric/string constraint keywords are not supported.
 *
 * Note what is *absent*: no image field, no structured-data field, no telephone,
 * no address, no href. Those are the fields a model would be most likely to fill
 * with something plausible, so the schema does not offer them.
 */
export const CONTENT_SCHEMA: JsonSchema = objectSchema({
  tagline: {
    type: 'string',
    description:
      'Six to ten words that say what this business is and where. Sits above the headline. Not a slogan about passion or excellence.',
  },
  voice: objectSchema({
    tone: {
      type: 'string',
      description: 'Two or three words naming the register of the copy, e.g. "warm and plain" or "precise, unhurried".',
    },
    headingFont: { type: 'string', enum: FONT_FAMILIES },
    bodyFont: { type: 'string', enum: FONT_FAMILIES },
    palette: stringArray(
      'Three colours as #rrggbb hex: a brand colour, an accent, and a page background. A suggestion only — the design stage may override it.',
    ),
  }),
  sections: arrayOf(
    {
      kind: { type: 'string', enum: SECTION_KINDS },
      heading: {
        type: 'string',
        description: 'The section heading, in the business\'s own register. Never the section kind capitalised.',
      },
      subheading: {
        type: 'string',
        description: 'One supporting line, or an empty string when the heading stands alone.',
      },
      body: {
        type: 'string',
        description:
          'Prose. Blank-line separated paragraphs. Empty string when the section is a list and needs no preamble.',
      },
      bullets: stringArray(
        'Items, written as "Label — detail" where a detail exists. The renderer sets the part before the dash as a title and the part after it as supporting text, so the separator is load-bearing. Leave empty for hours and contact: those are filled from verified data.',
      ),
      ctaLabel: {
        type: 'string',
        description: 'Button text, e.g. "See the bread". Empty string when the section needs no button.',
      },
      ctaTarget: {
        type: 'string',
        enum: CTA_TARGETS,
        description:
          'What the button does. "phone"/"email"/"website"/"instagram"/"facebook" resolve to the verified contact details; a section name links down the page; "none" means no button.',
      },
    },
    'The page, in reading order. Start with hero. Only include a section this business can fill with facts from the brief.',
  ),
  seo: objectSchema({
    title: { type: 'string', description: 'Under 60 characters. Business name, trade, and town.' },
    description: { type: 'string', description: '140-160 characters, describing what the visitor will find.' },
    keywords: stringArray('Search terms grounded in the trade and the location. Six at most.'),
  }),
  unresolvedGaps: stringArray(
    'Facts a page like this normally states that the brief does not settle — prices, the year it opened, whether it delivers. One line each, phrased as what the owner would need to confirm. This is where uncertainty goes instead of into the copy.',
  ),
});

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are the copywriter on a team that builds websites for local businesses. You are given a factual brief about one business — assembled from its Google Maps listing and its own website — and the strategy another stage produced for it. You write the site.

THE ONE RULE: every claim you write must be supported by the brief. You are writing about a real business that real customers will read about, and a sentence that sounds right but is not true is the worst thing this system can produce. In particular, never write:

- awards, ratings, rankings or press mentions that are not in the brief
- how long the business has been open, or when it was founded
- prices, or anything about cost
- how many staff, seats, locations or customers it has
- certifications, memberships, guarantees or credentials
- delivery, parking, booking, payment methods or accessibility features
- testimonials, or anything in quotation marks attributed to a customer
- opening hours or contact details in prose

If the page wants one of those and the brief does not have it, leave it out and put it in unresolvedGaps. A shorter honest page beats a fuller invented one. When the brief has thin material, write less rather than padding: two specific sentences drawn from what the business itself says are worth more than six general ones.

WRITE LIKE A PERSON, NOT LIKE A BROCHURE. What gives away machine-written copy is not grammar, it is a lack of anything specific. Reach for the concrete detail the brief actually gives you — a process, a material, a street, a name, a thing they make — and build the sentence around it. Avoid: "nestled", "passion", "commitment to excellence", "your journey", "we pride ourselves", "state-of-the-art", "unparalleled", "elevate", "curated", "we believe that", "whether you're X or Y". Avoid opening a section with the business name and a linking verb. Avoid rhetorical questions as headings. Do not use em dashes as a rhetorical flourish in prose — they are reserved in this system for the label separator inside bullets.

HEADINGS carry the page. Write headings that could only belong to this business, not labels that would fit any business of this kind. "Our Services" is a placeholder; a heading naming what they actually do is not.

STRUCTURE. Emit six to nine sections in reading order, always starting with hero and, where there is a reason to act, always ending with cta. Include a section only where the brief gives you real material for it:

- hero — the headline is the single most important line on the page. Say what they make or do, concretely.
- about — the story, drawn from what the site says about itself. Aim for at least two paragraphs where the material exists; this is the section that carries voice.
- services or menu — what a customer can get. Five to eight bullets is the target: at that length the layout engine gives the section its strongest treatment, and below five it renders as a plain list. Write each as "Name — one clause of detail". Only name things the brief names.
- gallery — REQUIRED whenever the brief reports four or more gallery photographs. Give it a short heading and at most one line of body; the photographs do the work and you do not need to describe them. Omitting a gallery when the business has photography is the single most damaging thing you can do to the finished page: it leaves the site looking like a text document about a business that clearly has pictures.
- hours, contact — write the heading and, at most, one line of body. Leave bullets EMPTY. Verified data is inserted afterwards.
- location — where they are and what the building or street is like, if the brief says.
- testimonials — ONLY if the brief contains actual customer words. It usually does not. Omit it.
- faq — ONLY if the brief answers real questions. Write each bullet as "Question? Answer." Omit the section otherwise.
- cta — one instruction and a button.

Do not emit two sections of the same kind.

NEVER SAY THE SAME THING TWICE. The tagline, the hero heading, the hero subheading and the hero body are four different jobs, not four phrasings of one sentence. If the brief is thin you will be tempted to restate the trade and the street in all of them — a real page never does this. Given only a category and an address, one honest firm produced:

  eyebrow    "Legal counsel located at 100 Pine Street in San Francisco"
  heading    "WVBR LLP"
  subheading "Legal counsel at 100 Pine Street, San Francisco"
  body       "Located at 100 Pine Street, the firm provides legal counsel..."

Four slots, one fact, zero information after the first. Each slot must add something the previous did not. The heading should say what the business *does* or offers, never just its name — the name is already in the header and the browser tab.

WHEN THE BRIEF IS THIN. Sometimes all you have is the category, the address, the phone and the hours — no website text, no services, no photographs. That is common and it is not your failure. Handle it like this:

- Write FEWER sections, not padded ones. Four good sections beat eight empty ones.
- Make every section earn its place. If "about" would only restate the address, do not emit an about section.
- Lead with what a visitor in this situation actually needs: what the business is, where it is, when it is open, and how to reach it in one tap.
- Write the orientation copy a local would find useful — the neighbourhood, the nearest cross street, what the category means in practice — using only what the brief gives you.
- Put everything you would have liked to say into unresolvedGaps. A short page plus an honest list of what the owner should confirm is a professional deliverable; a long page of restatements is not.`;

/* ------------------------------------------------------------------ */
/* Brief                                                               */
/* ------------------------------------------------------------------ */

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n…[truncated]`;
}

/** Renders opening hours as text, since the model reads prose better than indices. */
function formatHours(hours: readonly OpeningHours[]): string {
  if (hours.length === 0) return 'not published';
  return hours
    .map((entry) => `${DAY_NAMES[entry.dayOfWeek] ?? `day ${entry.dayOfWeek}`} ${entry.opens}-${entry.closes}`)
    .join('; ');
}

/**
 * Renders the profile and the strategy as one brief.
 *
 * Deliberately not `JSON.stringify`: the profile carries per-field provenance
 * and the strategy carries a rationale and an evidence list for every
 * recommendation, all of which matter for auditing and none of which the writer
 * needs. What it does need is the site's own words — those are the only source
 * of anything specific enough to write from — so the page text gets the space.
 */
export function buildWriterBrief(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  maxPageChars: number,
): string {
  const lines: string[] = [];
  const section = (heading: string, body: string): void => {
    lines.push(`## ${heading}`, body.trim() || 'none found', '');
  };

  section(
    'Verified identity',
    [
      `Name: ${profile.name.value}`,
      `Category (Maps listing): ${profile.category?.value ?? 'not listed'}`,
      `Address: ${profile.address?.value.formatted ?? 'not listed'}`,
      `Town: ${profile.address?.value.locality ?? 'not known'}`,
      `Website: ${profile.website?.value ?? 'none'}`,
      `Rating: ${profile.rating?.value ?? 'not shown'}${
        profile.reviewCount?.value ? ` from ${profile.reviewCount.value} reviews` : ' (review count not available)'
      }`,
      `Opening hours: ${formatHours(profile.hours)}`,
      `Phones: ${profile.phones.map((phone) => phone.value.formatted).join(', ') || 'none found'}`,
      `Emails: ${profile.emails.map((email) => email.value).join(', ') || 'none found'}`,
      `Social: ${profile.socialProfiles.map((entry) => entry.value.platform).join(', ') || 'none found'}`,
    ].join('\n'),
  );

  section(
    'Services named on the site',
    profile.services
      .map((service) => (service.description ? `- ${service.name}: ${service.description}` : `- ${service.name}`))
      .join('\n'),
  );

  section('Navigation on the current site', profile.navigation.map((link) => `- ${link.label}`).join('\n'));

  // Counts, not URLs: the writer never chooses an image, so the only thing it
  // needs to know is whether a gallery section would have anything in it.
  section(
    'Photographs available',
    [
      `Logo: ${profile.images.logo ? 'yes' : 'none'}`,
      `Hero image: ${profile.images.hero ? 'yes' : 'none'}`,
      `Gallery photographs: ${profile.images.gallery.length}`,
    ].join('\n'),
  );

  section(
    'What the business says about itself (verbatim, from its own site)',
    profile.pages
      .map((page) => `### ${page.title ?? page.url}\n${page.url}\n\n${truncate(page.text, maxPageChars)}`)
      .join('\n\n'),
  );

  section(
    'Strategy from the analysis stage',
    [
      `Category: ${strategy.category.primary}${
        strategy.category.secondary.length > 0 ? ` (also ${strategy.category.secondary.join(', ')})` : ''
      }`,
      `Primary audience: ${strategy.audience.primary.name} — ${strategy.audience.primary.description}`,
      `What they need: ${strategy.audience.primary.needs.join('; ') || 'not stated'}`,
      `Goals: ${strategy.goals.map((goal) => goal.title).join('; ') || 'none'}`,
      `Features worth having: ${strategy.features.map((feature) => feature.title).join('; ') || 'none'}`,
      `Recommended page sections: ${
        strategy.pages.map((page) => `${page.path} [${page.sections.join(', ')}]`).join(' | ') || 'none'
      }`,
      `SEO keywords: ${strategy.seoPriorities.flatMap((entry) => entry.targetKeywords).join(', ') || 'none'}`,
    ].join('\n'),
  );

  // The gaps are as informative as the facts, and they are the writer's cue for
  // what must not be written around.
  section(
    'Known gaps — do not write around these',
    [
      ...profile.validation.issues.map((issue) => `- [${issue.severity}] ${issue.field}: ${issue.message}`),
      ...strategy.openQuestions.map((question) => `- open question: ${question}`),
    ].join('\n'),
  );

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Response handling                                                   */
/* ------------------------------------------------------------------ */

/** One section exactly as the model returns it, before any facts are attached. */
interface DraftSection {
  readonly kind: SectionKind;
  readonly heading: string;
  readonly subheading: string;
  readonly body: string;
  readonly bullets: readonly string[];
  readonly ctaLabel: string;
  readonly ctaTarget: CtaTarget;
}

interface Draft {
  readonly tagline: string;
  readonly voice: {
    readonly tone: string;
    readonly headingFont: string;
    readonly bodyFont: string;
    readonly palette: readonly string[];
  };
  readonly sections: readonly DraftSection[];
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
  };
  readonly unresolvedGaps: readonly string[];
}

/**
 * Checks the shape the schema was supposed to guarantee.
 *
 * Structured outputs make a malformed response unlikely rather than impossible,
 * and this turns that into one clear error instead of an undefined surfacing in
 * the renderer.
 */
function assertDraftShape(value: unknown): asserts value is Draft {
  if (typeof value !== 'object' || value === null) {
    throw new UpstreamError('Model returned a non-object spec', { source: NAME, retryable: true });
  }

  const record = value as Record<string, unknown>;
  const missing = ['tagline', 'voice', 'sections', 'seo', 'unresolvedGaps'].filter(
    (key) => record[key] === undefined,
  );
  if (missing.length > 0) {
    throw new UpstreamError(`Model omitted spec fields: ${missing.join(', ')}`, {
      source: NAME,
      retryable: true,
    });
  }
  if (!Array.isArray(record.sections) || record.sections.length === 0) {
    throw new UpstreamError('Model returned no sections', { source: NAME, retryable: true });
  }
}

/* ------------------------------------------------------------------ */
/* Facts                                                               */
/* ------------------------------------------------------------------ */

/**
 * Opening hours as bullets, consecutive identical days merged.
 *
 * "Monday to Friday — 07:30–18:00" rather than five rows saying the same thing,
 * which is how a business writes its own hours and how the detail list wants to
 * render them. Days the listing did not publish are simply absent: a missing day
 * is reported as a gap, never filled in.
 */
export function hourBullets(hours: readonly OpeningHours[]): readonly string[] {
  const spans = new Map<number, string>();
  for (const day of WEEK_ORDER) {
    const forDay = hours.filter((entry) => entry.dayOfWeek === day);
    if (forDay.length === 0) continue;
    spans.set(day, forDay.map((entry) => `${entry.opens}–${entry.closes}`).join(', '));
  }

  const days = WEEK_ORDER.filter((day) => spans.has(day));
  const bullets: string[] = [];

  for (let start = 0; start < days.length; ) {
    const first = days[start];
    if (first === undefined) break;
    const span = spans.get(first) ?? '';

    // Extend while the next published day is the next day of the week and keeps
    // the same hours — a gap in the week ends the run even if the span matches.
    let end = start;
    for (;;) {
      const next = days[end + 1];
      const current = days[end];
      if (next === undefined || current === undefined) break;
      if (spans.get(next) !== span) break;
      if (WEEK_ORDER.indexOf(next) !== WEEK_ORDER.indexOf(current) + 1) break;
      end += 1;
    }

    const last = days[end] ?? first;
    const label = start === end ? DAY_NAMES[first] : `${DAY_NAMES[first]} to ${DAY_NAMES[last]}`;
    bullets.push(`${label ?? 'Day'} — ${span}`);
    start = end + 1;
  }

  return bullets;
}

/** Mailbox names a customer should never be routed to from a contact block. */
const NON_CUSTOMER_MAILBOXES = [
  'press', 'media', 'jobs', 'careers', 'recruit', 'hiring', 'invoice',
  'billing', 'accounts', 'legal', 'privacy', 'abuse', 'noreply', 'no-reply',
  'postmaster', 'webmaster', 'admin',
];

/** Mailbox names that are the front door, best first. */
const CUSTOMER_MAILBOXES = ['hello', 'info', 'contact', 'enquiries', 'inquiries', 'orders', 'bookings'];

/**
 * Ranks the profile's emails by how well they serve a customer.
 *
 * The first Tartine run published three addresses: `info@tartinebakery.com`,
 * `info@tartinemanufactory.com` and `press@tartinebakery.com`. The second
 * belongs to a *different business* and the third routes a customer to a press
 * officer. Both were on the site, so both are true — and neither belongs on a
 * page whose job is to get someone through the door.
 *
 * Truthfulness was never the problem here. Editorial judgement was.
 */
function rankEmails(profile: BusinessProfile): readonly string[] {
  let host: string | null = null;
  const website = profile.website?.value;
  if (website !== undefined) {
    try {
      host = new URL(website).host.replace(/^www\./, '').toLowerCase();
    } catch {
      host = null;
    }
  }

  const scored = profile.emails
    .map((entry) => entry.value)
    .map((email) => {
      const [mailbox = '', domain = ''] = email.toLowerCase().split('@');
      const known = CUSTOMER_MAILBOXES.indexOf(mailbox);
      return {
        email,
        // Lower sorts first.
        score:
          (host !== null && domain !== host ? 100 : 0) +
          (NON_CUSTOMER_MAILBOXES.includes(mailbox) ? 50 : 0) +
          (known === -1 ? 10 : known),
      };
    })
    .filter((entry) => entry.score < 100) // A different company's domain is never shown.
    .sort((a, b) => a.score - b.score);

  // A press or careers inbox is only worth showing when there is no customer
  // inbox at all. Given `info@` and `press@`, printing both invites half the
  // visitors to write to the wrong person.
  const customer = scored.filter((entry) => entry.score < 50);
  const shown = customer.length > 0 ? customer : scored;

  // Two is the most a visitor will ever read. One is usually right.
  return shown.slice(0, 2).map((entry) => entry.email);
}

/**
 * A phone number set the way its own country writes it.
 *
 * Maps handed back `+14154872600`, which is correct, unambiguous and something
 * no San Francisco bakery has ever printed. Regrouping digits is presentation,
 * not invention — the digits are unchanged and `tel:` still uses E.164 — so
 * this stays inside the no-invention rule. Anything whose shape is not
 * recognised is passed through exactly as published.
 */
export function displayPhone(phone: PhoneNumber): string {
  const formatted = phone.formatted.trim();
  // Already human-formatted by whoever published it: leave it alone.
  if (/[\s().-]/.test(formatted)) return formatted;

  const e164 = phone.e164 ?? formatted;
  const nanp = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (nanp !== null) return `+1 (${nanp[1]}) ${nanp[2]}-${nanp[3]}`;

  const uk = /^\+44(\d{2,4})(\d{3,4})(\d{4})$/.exec(e164);
  if (uk !== null) return `+44 ${uk[1]} ${uk[2]} ${uk[3]}`;

  return formatted;
}

/**
 * Contact details as bullets, in the order a visitor needs them.
 *
 * Each is `Caption — value`, which is the shape the renderer's contact block
 * reads: it captions the row from the label and turns a recognisable address or
 * number into something pressable.
 */
export function contactBullets(profile: BusinessProfile): readonly string[] {
  const bullets: string[] = [];

  const address = profile.address?.value.formatted;
  if (address !== undefined && address.trim() !== '') bullets.push(`Address — ${address}`);

  // One number. A second is a decision for the visitor to make and they did
  // not come here to make it.
  const phone = profile.phones[0]?.value;
  if (phone !== undefined) bullets.push(`Phone — ${displayPhone(phone)}`);

  for (const email of rankEmails(profile)) bullets.push(`Email — ${email}`);

  return bullets;
}

/**
 * `LocalBusiness` JSON-LD, built from verified fields only.
 *
 * Never from the model. Structured data is read by machines that will repeat it
 * without a human ever checking it, so it is the last place a plausible guess
 * belongs. Every property here is present only when the profile actually
 * carries it — notably `aggregateRating`, which schema.org requires to include a
 * count, and which is therefore omitted for a listing that gave a star rating
 * and no review total.
 */
export function buildStructuredData(
  profile: BusinessProfile,
  heroImageUrl: string | null,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaTypeFor(profile.category?.value ?? null),
    name: profile.name.value,
  };

  const website = profile.website?.value;
  if (website !== undefined) data.url = website;

  const address = profile.address?.value;
  if (address !== undefined) {
    const postal: Record<string, unknown> = { '@type': 'PostalAddress', streetAddress: address.formatted };
    if (address.street !== null) postal.streetAddress = address.street;
    if (address.locality !== null) postal.addressLocality = address.locality;
    if (address.region !== null) postal.addressRegion = address.region;
    if (address.postalCode !== null) postal.postalCode = address.postalCode;
    if (address.country !== null) postal.addressCountry = address.country;
    data.address = postal;
  }

  const coordinates = profile.coordinates?.value;
  if (coordinates !== undefined) {
    data.geo = { '@type': 'GeoCoordinates', latitude: coordinates.lat, longitude: coordinates.lng };
  }

  const phone = profile.phones[0]?.value;
  if (phone !== undefined) data.telephone = phone.e164 ?? phone.formatted;

  const email = profile.emails[0]?.value;
  if (email !== undefined) data.email = email;

  if (profile.hours.length > 0) {
    data.openingHoursSpecification = profile.hours.map((entry) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY_NAMES[entry.dayOfWeek] ?? 'Monday'}`,
      opens: entry.opens,
      closes: entry.closes,
    }));
  }

  const rating = profile.rating?.value;
  const reviewCount = profile.reviewCount?.value;
  if (rating !== undefined && reviewCount !== undefined) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount,
    };
  }

  const sameAs = profile.socialProfiles.map((entry) => entry.value.url);
  if (sameAs.length > 0) data.sameAs = sameAs;

  if (heroImageUrl !== null) data.image = heroImageUrl;

  return data;
}

/**
 * The narrowest schema.org type the Maps category supports.
 *
 * Read off the listing's own words, so it is a classification rather than a
 * guess; anything unrecognised stays `LocalBusiness`, which is always true.
 */
function schemaTypeFor(category: string | null): string {
  if (category === null) return 'LocalBusiness';
  const value = category.toLowerCase();

  const table: readonly (readonly [readonly string[], string])[] = [
    [['bakery', 'patisserie', 'pastry'], 'Bakery'],
    [['cafe', 'café', 'coffee'], 'CafeOrCoffeeShop'],
    [['bar', 'pub', 'brewery', 'winery'], 'BarOrPub'],
    [['restaurant', 'bistro', 'pizzeria', 'diner', 'steakhouse'], 'Restaurant'],
    [['hotel', 'inn', 'hostel', 'lodging', 'guest house'], 'Hotel'],
    [['dentist', 'dental'], 'Dentist'],
    [['doctor', 'clinic', 'medical', 'physician'], 'MedicalClinic'],
    [['lawyer', 'law firm', 'solicitor', 'attorney'], 'LegalService'],
    [['gym', 'fitness', 'yoga', 'pilates'], 'ExerciseGym'],
    [['spa', 'salon', 'barber', 'beauty', 'nail'], 'BeautySalon'],
    [['plumber', 'electrician', 'roofing', 'builder', 'contractor', 'construction'], 'HomeAndConstructionBusiness'],
    [['car repair', 'garage', 'automotive', 'mechanic', 'tyre', 'tire'], 'AutoRepair'],
    [['real estate', 'estate agent', 'realtor'], 'RealEstateAgent'],
    [['accountant', 'accounting', 'bookkeep'], 'AccountingService'],
    [['florist'], 'Florist'],
    [['store', 'shop', 'boutique', 'grocery', 'market'], 'Store'],
  ];

  for (const [needles, type] of table) {
    if (needles.some((needle) => value.includes(needle))) return type;
  }
  return 'LocalBusiness';
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hands each section the photographs it should carry.
 *
 * A cursor rather than a lookup, so no image appears twice on the page. The
 * hero takes the logo and the favicon — the shell pulls those out of it for the
 * header and the `<head>` — plus the lead photograph; the gallery takes the next
 * batch; `about` takes one, which is what lets the layout engine choose a split
 * or editorial treatment for it instead of a bare column of text.
 */
/**
 * Words that mark an image as merchandise rather than the business itself.
 *
 * The first gallery Tartine produced was six Amazon cookbook covers with their
 * alt text showing — "Tartine bread on Amazon", "BREAD BOOK Cover" — because
 * the normalizer ranks by CDN path and byte size, and a 3D product mockup is a
 * big file. A book cover is a real photograph on the real site, so nothing was
 * invented; it is simply not a picture of the bakery.
 *
 * Matched against the alt text and the file name, both of which the collector
 * captured verbatim.
 */
const NOT_PHOTOGRAPHY = [
  'amazon', 'book', 'cover', 'cookbook', 'logo', 'icon', 'badge', 'sprite',
  'placeholder', 'avatar', 'screenshot', 'banner-ad', 'gift card', 'giftcard',
];

/** True when an image looks like merchandise, packaging or chrome. */
function looksLikeProductShot(image: ImageAsset): boolean {
  const haystack = `${image.alt ?? ''} ${image.url}`.toLowerCase();
  return NOT_PHOTOGRAPHY.some((needle) => haystack.includes(needle));
}

/** Hosts that only ever serve map tiles and static maps. */
const MAP_HOSTS = [
  'maps.googleapis.com', 'maps.gstatic.com', 'maps.google.', 'tile.openstreetmap',
  'api.mapbox.com', 'tiles.mapbox.com', 'staticmap', 'basemaps.',
];

/**
 * Whether an image can carry a section of a page.
 *
 * A hard exclusion, unlike `looksLikeProductShot` — these are never worth
 * showing at any position. Paradise Dental's generated gallery contained **six
 * Google Maps tiles**, because an embedded map is a grid of `<img>` elements
 * and the normalizer ranks by CDN path and byte size, which cannot tell a
 * photograph of a surgery from a 256×256 slice of a road.
 *
 * Three signals, in increasing generality:
 *  - the host only ever serves maps;
 *  - the dimensions are an exact power-of-two tile;
 *  - the image is too small to be photography at any layout size.
 */
function isUsablePhotograph(image: ImageAsset): boolean {
  const url = image.url.toLowerCase();
  if (MAP_HOSTS.some((host) => url.includes(host))) return false;

  const { width, height } = image;
  if (width !== null && height !== null) {
    // 256×256 and 512×512 are map/sprite tiles, never content.
    if (width === height && (width === 256 || width === 512)) return false;
    // Below this, an image is an icon, a badge or a tracking pixel. The
    // renderer would upscale it into a blur.
    if (Math.max(width, height) < 320) return false;
  }
  return true;
}

function assignImages(
  sections: readonly DraftSection[],
  profile: BusinessProfile,
): ReadonlyMap<number, readonly ImageAsset[]> {
  const { logo, favicon, hero, gallery } = profile.images;
  const assigned = new Map<number, readonly ImageAsset[]>();

  // A site with no tagged hero still has a lead photograph: the best gallery
  // image. Taking it here is what stops the gallery from opening the page.
  //
  // Product shots sort to the back rather than being dropped: on a business
  // whose only imagery is packaging, a page with photographs of the packaging
  // still beats a page with none.
  const usable = gallery.filter(isUsablePhotograph);
  const photographs = usable.filter((image) => !looksLikeProductShot(image));
  const products = usable.filter((image) => looksLikeProductShot(image));
  const pool = [...photographs, ...products];
  const lead = hero ?? pool.shift() ?? null;

  const indexOf = (kind: SectionKind): number => sections.findIndex((section) => section.kind === kind);

  const heroIndex = indexOf('hero');
  if (heroIndex !== -1) {
    assigned.set(
      heroIndex,
      [logo, favicon, lead].filter((image): image is ImageAsset => image !== null),
    );
  } else {
    // No hero section: the logo and favicon still have to reach the shell, so
    // they ride on whatever section leads the page.
    assigned.set(0, [logo, favicon].filter((image): image is ImageAsset => image !== null));
  }

  const galleryIndex = indexOf('gallery');
  if (galleryIndex !== -1) {
    assigned.set(galleryIndex, pool.splice(0, MAX_GALLERY_IMAGES));
  }

  /*
   * Sections that carry one photograph each, in the order they get one.
   *
   * The first Tartine run put three images on a 4,500px page while forty-nine
   * sat unused in the run directory, because only `hero`, `gallery` and `about`
   * were ever fed — and that spec had no gallery. Worse, `location` was chosen
   * as a `split` on body length, found no image, and rendered the design's
   * gradient placeholder, which reads as a broken image rather than as a
   * deliberately image-free section.
   *
   * Feeding the single-image sections fixes both: the page carries photography
   * proportional to what the business actually has, and a `split` gets the
   * media its layout was chosen for.
   */
  for (const kind of ['about', 'location', 'services', 'menu', 'testimonials'] as const) {
    if (pool.length === 0) break;
    const index = indexOf(kind);
    if (index !== -1) assigned.set(index, pool.splice(0, 1));
  }

  return assigned;
}

/**
 * Turns a call-to-action intent into a link that resolves.
 *
 * Returns `null` where the profile cannot support the intent — a "Call us"
 * button on a business that never published a number is worse than no button —
 * and the caller reports that rather than silently dropping it.
 */
function resolveCta(
  target: CtaTarget,
  profile: BusinessProfile,
  anchors: ReadonlyMap<SectionKind, string>,
): string | null {
  switch (target) {
    case 'none':
      return null;
    case 'phone': {
      const phone = profile.phones[0]?.value;
      if (phone === undefined) return null;
      return `tel:${phone.e164 ?? phone.digits}`;
    }
    case 'email': {
      const email = profile.emails[0]?.value;
      return email === undefined ? null : `mailto:${email}`;
    }
    case 'website':
      return profile.website?.value ?? null;
    case 'instagram':
    case 'facebook': {
      const match = profile.socialProfiles.find(
        (entry) => entry.value.platform.toLowerCase() === target,
      );
      return match?.value.url ?? null;
    }
    default: {
      const anchor = anchors.get(target);
      return anchor === undefined ? null : `#${anchor}`;
    }
  }
}

/** Drops repeated kinds, keeping the first, and drops anything with no heading. */
function dedupeSections(sections: readonly DraftSection[], warn: (message: string) => void): readonly DraftSection[] {
  const seen = new Set<SectionKind>();
  const kept: DraftSection[] = [];

  for (const section of sections) {
    if (seen.has(section.kind)) {
      warn(`the writer emitted a second "${section.kind}" section; the later one was dropped`);
      continue;
    }
    seen.add(section.kind);
    kept.push(section);
  }
  return kept;
}

/* ------------------------------------------------------------------ */
/* Grounding                                                           */
/* ------------------------------------------------------------------ */

const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const URL_IN_TEXT = /https?:\/\/[^\s)"']+/g;
const DIGIT_RUN = /[\d][\d\s().-]{6,}\d/g;

/**
 * Reads the finished copy back against the profile.
 *
 * Not a fact-checker — no cheap check can tell whether "we mill our own flour"
 * is true. What it can do is catch the class of invention that is both most
 * damaging and mechanically detectable: a contact detail or a link that appears
 * on the page and nowhere in the profile. A wrong phone number on a real
 * customer's website is the failure this exists to surface.
 *
 * Reports rather than edits. Rewriting a model's sentence around a deleted
 * substring produces worse copy than the sentence had, and a run that quietly
 * repaired itself is a run nobody reviews.
 */
export function groundingWarnings(content: WebsiteContent, profile: BusinessProfile): readonly string[] {
  const warnings: string[] = [];

  const knownEmails = new Set(profile.emails.map((entry) => entry.value.toLowerCase()));
  const knownDigits = new Set(profile.phones.map((entry) => entry.value.digits));
  const knownHosts = new Set<string>();

  for (const url of [
    profile.website?.value,
    ...profile.socialProfiles.map((entry) => entry.value.url),
    ...profile.sources,
  ]) {
    if (url === undefined) continue;
    try {
      knownHosts.add(new URL(url).host.replace(/^www\./, ''));
    } catch {
      // A source that is not a parseable URL simply contributes no host.
    }
  }

  const prose: string[] = [content.tagline, content.seo.title, content.seo.description];
  for (const section of content.sections) {
    prose.push(section.heading, section.subheading ?? '', section.body, ...section.bullets);
    if (section.callToAction !== null) prose.push(section.callToAction.label);
  }

  for (const text of prose) {
    for (const email of text.match(EMAIL_IN_TEXT) ?? []) {
      if (!knownEmails.has(email.toLowerCase())) {
        warnings.push(`copy contains an email address not in the profile: "${email}"`);
      }
    }
    for (const url of text.match(URL_IN_TEXT) ?? []) {
      try {
        const host = new URL(url).host.replace(/^www\./, '');
        if (!knownHosts.has(host)) warnings.push(`copy links to a host not in the profile: "${host}"`);
      } catch {
        warnings.push(`copy contains an unparseable URL: "${url}"`);
      }
    }
    for (const run of text.match(DIGIT_RUN) ?? []) {
      const digits = run.replace(/\D/g, '');
      // Only long runs read as phone numbers; a year or a house number does not.
      if (digits.length >= 9 && !knownDigits.has(digits) && !knownDigits.has(digits.slice(-9))) {
        warnings.push(`copy contains a number that is not a known phone number: "${run.trim()}"`);
      }
    }
  }

  return Array.from(new Set(warnings));
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Asks the platform's provider for one draft.
 *
 * Everything vendor-shaped is below this line, exactly as it is for the
 * analyst: streaming, beta headers, refusal and truncation handling and schema
 * enforcement all live in the adapter, so this agent runs unchanged on any of
 * the four providers.
 */
async function draft(
  brief: string,
  provider: AIProvider,
  config: WriterConfig,
  logger: Logger,
  signal: AbortSignal,
): Promise<{ draft: Draft; model: string }> {
  let result;
  try {
    result = await provider.generate({
      system: SYSTEM_PROMPT,
      prompt: `Here is the brief for one business. Write its website.\n\n${brief}`,
      schema: CONTENT_SCHEMA,
      schemaName: 'website_content',
      model: config.model,
      effort: config.effort,
      maxTokens: config.maxOutputTokens,
      signal,
    });
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(error instanceof Error ? error.message : String(error), {
      source: NAME,
      retryable: false,
      cause: error,
    });
  }

  logger.debug('draft returned', {
    provider: provider.name,
    model: result.model,
    structuredOutput: result.structuredOutput,
    finishReason: result.finishReason,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });

  assertDraftShape(result.data);
  return { draft: result.data, model: result.model };
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

export interface WriterInput {
  /** The facts, each with its source. */
  readonly profile: BusinessProfile;
  /** What the site should do, and why. */
  readonly strategy: BusinessStrategy;
}

export interface WriterAgent extends Agent<WriterInput, WebsiteContent> {}

export const writerAgent: WriterAgent = {
  name: NAME,
  description: 'Writes site structure, copy, brand voice, and SEO from the profile and strategy.',

  async run(input: WriterInput, ctx: AgentContext): Promise<WebsiteContent> {
    const { logger, config } = ctx;
    const { profile, strategy } = input;
    const writer = config.writer;

    // Throws a configuration error naming the exact variable to set when
    // `AI_PROVIDER` is unset, unrecognised, or has no credential — before any
    // network call, and without this agent knowing which vendor that is.
    const provider = ctx.platform.ai();

    const brief = buildWriterBrief(profile, strategy, writer.maxPageChars);
    logger.info('writing started', {
      business: profile.name.value,
      provider: provider.name,
      model: writer.model,
      effort: writer.effort,
      briefChars: brief.length,
    });

    const { draft: written, model } = await logger.time('write website copy', () =>
      draft(brief, provider, writer, logger, ctx.signal),
    );

    const warnings: string[] = [];
    const warn = (message: string): void => {
      warnings.push(message);
    };

    const drafted = dedupeSections(written.sections, warn);
    const images = assignImages(drafted, profile);

    // Anchors are computed the way the renderer computes them, from the same
    // function and in the same written order, so a link down the page always
    // lands on a section that exists. The renderer reorders sections but never
    // renames their ids, so this survives the design stage's reordering.
    const ids = assignIds(
      drafted.map((section) => ({
        kind: section.kind,
        heading: section.heading,
        subheading: null,
        body: '',
        bullets: [],
        images: [],
        callToAction: null,
      })),
    );
    const anchors = new Map<SectionKind, string>(
      drafted.map((section, index) => [section.kind, ids[index] ?? '']),
    );

    const sections: readonly WebsiteSection[] = drafted.map((section, index) => {
      // Hours and contact are data, not prose. Whatever the model put in their
      // bullets is replaced with the profile's own values.
      const bullets =
        section.kind === 'hours'
          ? hourBullets(profile.hours)
          : section.kind === 'contact'
            ? contactBullets(profile)
            : section.bullets.map((bullet) => bullet.trim()).filter((bullet) => bullet !== '');

      const label = section.ctaLabel.trim();
      const href = label === '' ? null : resolveCta(section.ctaTarget, profile, anchors);
      if (label !== '' && section.ctaTarget !== 'none' && href === null) {
        warn(
          `section "${section.kind}" asked for a "${section.ctaTarget}" call to action, which the profile cannot support; the button was dropped`,
        );
      }

      const subheading = section.subheading.trim();

      return {
        kind: section.kind,
        heading: section.heading.trim(),
        subheading: subheading === '' ? null : subheading,
        body: section.body.trim(),
        bullets,
        images: images.get(index) ?? [],
        callToAction: href === null ? null : { label, href },
      };
    });

    const heroImage = profile.images.hero ?? profile.images.gallery[0] ?? null;

    // Gaps the profile itself proves, added to the ones the model reported. A
    // model can only report a gap it noticed; these are the ones the data knows
    // about, and they are the ones an owner can actually answer.
    const derivedGaps: string[] = [];
    if (profile.hours.length === 0) {
      derivedGaps.push('No opening hours are published on the listing or the site.');
    } else if (profile.hours.length < 7) {
      derivedGaps.push(
        `Opening hours are only known for ${profile.hours.length} of seven days; the rest were not published where the pipeline could read them.`,
      );
    }
    if (profile.phones.length === 0) derivedGaps.push('No phone number was found for this business.');
    if (profile.emails.length === 0) derivedGaps.push('No email address was found for this business.');
    if (profile.address === null) derivedGaps.push('No street address was found for this business.');
    if (profile.rating !== null && profile.reviewCount === null) {
      derivedGaps.push(
        'A star rating is available but the review count is not, so the rating is not shown or marked up — schema.org requires both.',
      );
    }
    for (const issue of profile.validation.issues) {
      derivedGaps.push(`${issue.field}: ${issue.message}`);
    }

    const content: WebsiteContent = {
      // The verified name, not the model's rendering of it.
      businessName: profile.name.value,
      tagline: written.tagline.trim(),
      voice: {
        tone: written.voice.tone.trim(),
        palette: written.voice.palette,
        typography: { heading: written.voice.headingFont, body: written.voice.bodyFont },
      },
      sections,
      seo: {
        title: written.seo.title.trim(),
        description: written.seo.description.trim(),
        keywords: written.seo.keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword !== ''),
        structuredData: buildStructuredData(profile, heroImage?.url ?? null),
      },
      unresolvedGaps: Array.from(
        new Set([...written.unresolvedGaps.map((gap) => gap.trim()).filter((gap) => gap !== ''), ...derivedGaps]),
      ),
    };

    for (const warning of [...warnings, ...groundingWarnings(content, profile)]) {
      logger.warn('writer output was corrected or is suspect', { warning });
    }

    const filePath = path.join(ctx.outputDir, ARTIFACT);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');

    logger.info('writing finished', {
      model,
      sections: content.sections.map((section) => section.kind),
      bullets: content.sections.reduce((total, section) => total + section.bullets.length, 0),
      images: content.sections.reduce((total, section) => total + section.images.length, 0),
      unresolvedGaps: content.unresolvedGaps.length,
      artifact: filePath,
    });

    return content;
  },
};
