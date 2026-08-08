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
  ListingReview,
  PageText,
  SectionKind,
  TrustSignal,
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
- testimonials, or anything in quotation marks attributed to a customer
- opening hours or contact details in prose

Amenities, accessibility, parking, payment and booking are a special case. The brief has a section called "Confirmed on the Google listing" which is a verified list, and it is the ONLY place those may come from. Two rules, both absolute: copy the wording from that list rather than paraphrasing it, and never mention anything the list marks "NOT available" — a listing that says a hotel has no pool is telling you not to write about the pool, not inviting you to explain its absence. If it is not in that list, it does not exist for you.

If the page wants one of those and the brief does not have it, leave it out and put it in unresolvedGaps. A shorter honest page beats a fuller invented one. When the brief has thin material, write less rather than padding: two specific sentences drawn from what the business itself says are worth more than six general ones.

WRITE LIKE A PERSON, NOT LIKE A BROCHURE. What gives away machine-written copy is not grammar, it is a lack of anything specific. Reach for the concrete detail the brief actually gives you — a process, a material, a street, a name, a thing they make — and build the sentence around it. Avoid: "nestled", "passion", "commitment to excellence", "your journey", "we pride ourselves", "state-of-the-art", "unparalleled", "elevate", "curated", "we believe that", "whether you're X or Y". Avoid opening a section with the business name and a linking verb. Avoid rhetorical questions as headings. Do not use em dashes as a rhetorical flourish in prose — they are reserved in this system for the label separator inside bullets.

HEADINGS carry the page. Write headings that could only belong to this business, not labels that would fit any business of this kind. "Our Services" is a placeholder; a heading naming what they actually do is not.

STRUCTURE. Emit six to nine sections in reading order, always starting with hero and, where there is a reason to act, always ending with cta. Include a section only where the brief gives you real material for it:

- hero — the headline is the single most important line on the page. Say what they make or do, concretely.
- about — the story, drawn from what the site says about itself. Aim for at least two paragraphs where the material exists; this is the section that carries voice.
- services or menu — what a customer can get. Five to eight bullets is the target: at that length the layout engine gives the section its strongest treatment, and below five it renders as a plain list. Write each as "Name — one clause of detail". Only name things the brief names.
- gallery — REQUIRED whenever the brief reports four or more gallery photographs. Give it a short heading and at most one line of body; the photographs do the work and you do not need to describe them. Omitting a gallery when the business has photography is the single most damaging thing you can do to the finished page: it leaves the site looking like a text document about a business that clearly has pictures.
- hours, contact, testimonials — write the heading and, at most, one line of body. Leave bullets EMPTY. Verified data is inserted afterwards.
- location — where they are and what the building or street is like, if the brief says.
- testimonials — include it ONLY when the brief reports verified reviews, and then write the heading alone. You may never write a quotation or a customer's name: real reviews are inserted afterwards, and anything you put in these bullets is discarded unread. If the brief reports no reviews, omit the section — it will be removed anyway.
- faq — ONLY if the brief answers real questions. Write each bullet as "Question? Answer." Omit the section otherwise.
- cta — one instruction and a button.

Do not emit two sections of the same kind.

NEVER SAY THE SAME THING TWICE. The tagline, the hero heading, the hero subheading and the hero body are four different jobs, not four phrasings of one sentence. If the brief is thin you will be tempted to restate the trade and the street in all of them — a real page never does this. Given only a category and an address, one honest firm produced:

  eyebrow    "Legal counsel located at 100 Pine Street in San Francisco"
  heading    "WVBR LLP"
  subheading "Legal counsel at 100 Pine Street, San Francisco"
  body       "Located at 100 Pine Street, the firm provides legal counsel..."

Four slots, one fact, zero information after the first. Each slot must add something the previous did not. The heading should say what the business *does* or offers, never just its name — the name is already in the header and the browser tab.

WHEN THE BUSINESS HAS NO WEBSITE. This is the most important case in the system, because a business with no website is the one most likely to want the page you are writing. It is not a thin brief — it is a brief from different sources. Read them properly:

- "How Google describes this business" is editorial prose about a real place. It is the strongest material you have and it is usually the only prose that exists. Draw the about section from it. Do not copy it wholesale — it is source material, not the finished page — but every fact in it is available to you.
- "Confirmed on the Google listing" is a verified feature list. A services or facilities section built from it is honest and useful.
- The category, the street, the hours and the photographs are all real. Use them.

A page built from these is a real page, not a placeholder. Write it like one.

WHEN THE BRIEF IS GENUINELY THIN. Sometimes all you have is the category, the address, the phone and the hours — no website text, no description, no confirmed features, no photographs. That is common and it is not your failure. Handle it like this:

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

  // Verbatim, and the only prose that exists at all for a business with no
  // website. Labelled as Google's words rather than the business's, because the
  // difference matters to how the writer is allowed to use it.
  section('How Google describes this business (verbatim, from the listing)', profile.description?.value ?? '');

  // Both states, and the absent ones marked loudly. A model that sees only the
  // present ones cannot tell "not listed" from "listed as absent", and the
  // second is the one that turns into a claimed swimming pool.
  section(
    'Confirmed on the Google listing',
    profile.attributes
      .map((attribute) =>
        attribute.available
          ? `- ${attribute.label} (${attribute.group})`
          : `- ${attribute.label} — NOT available, never mention this`,
      )
      .join('\n'),
  );

  /*
   * A count, not the reviews themselves.
   *
   * The writer needs exactly one fact about them — whether a testimonials
   * section would have anything in it — and giving it the text would be handing
   * a model the raw material for the one thing it must never produce. It cannot
   * paraphrase a quotation it has not been shown, and it cannot attribute words
   * to a customer whose name it does not have.
   *
   * The quotations go straight from the profile to the page, by way of code,
   * never through the prompt.
   */
  section(
    'Verified customer reviews',
    profile.reviews.length === 0
      ? 'None. Do not emit a testimonials section.'
      : `${profile.reviews.length} verified review(s) are available and will be inserted into the testimonials section automatically. Write its heading only.`,
  );

  section('Navigation on the current site', profile.navigation.map((link) => `- ${link.label}`).join('\n'));

  // Counts, not URLs: the writer never chooses an image, so the only thing it
  // needs to know is whether a gallery section would have anything in it.
  section(
    'Photographs available',
    [
      `Logo: ${profile.images.logo ? 'yes' : 'none'}`,
      `Hero image: ${profile.images.hero ? 'yes' : 'none'}`,
      // The usable count, for the same reason the composer uses it: the writer
      // is told to emit a gallery at four or more, and it must be four or more
      // of the photographs that will actually survive to the page.
      `Gallery photographs: ${profile.images.gallery.filter(isUsablePhotograph).length}`,
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
export interface DraftSection {
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

  const rating = ratingLine(profile);
  if (rating !== null) bullets.push(`Rating — ${rating}`);

  return bullets;
}

/**
 * Ownership and community credentials, which read as reassurance rather than
 * as amenities.
 *
 * "Identifies as women-owned" is a different kind of fact from "Free Wi-Fi":
 * one tells a visitor who they are dealing with, the other what they get. Only
 * the first belongs in a trust bar, so this is an allowlist rather than a
 * ranking — an attribute nobody anticipated stays out of the hero instead of
 * appearing there unreviewed.
 */
const CREDENTIAL_ATTRIBUTE =
  /\b(identifies as|women-owned|woman-owned|veteran-owned|black-owned|latino-owned|lgbtq|family-owned|family-run)\b/i;

/** How many signals a visitor will actually read before the headline. */
const MAX_TRUST_SIGNALS = 3;

/**
 * The rating below which a star average stops being reassurance.
 *
 * The trust bar promotes a fact to the first screen because it argues *for* the
 * business. A 3.8 does not: on Google's distribution, where local businesses
 * average above four, it is a below-average score, and printing it under the
 * headline is the page making the visitor's counter-argument for them. The
 * benchmark hotel rendered exactly that, and it looked like reassurance because
 * the code could not tell the difference.
 *
 * **This suppresses a claim; it never makes one.** The true rating stays in the
 * JSON-LD, where `aggregateRating` carries the real value to every machine that
 * asks — Google's own panel will show it beside the page whatever this file
 * does. Nothing here rounds a number up, hides a review, or says anything that
 * is not so. It decides only what the business *leads with*, which is the same
 * editorial judgement any agency makes for a client, and the same one that
 * already keeps an unavailable amenity off the page.
 *
 * Four is the threshold because it is where Google's own review UI stops
 * reading as a warning. A business under it is better served by the other
 * signals — the trade, the town, the credential — and by the reviews
 * themselves, where a thoughtful four-star write-up persuades more than its
 * number does.
 */
const MIN_PROMOTABLE_RATING = 4;

/**
 * The verified reassurance for this business, best first.
 *
 * Built here rather than asked for, which is the same rule that governs hours,
 * contact details and the JSON-LD: a model that is never asked for a
 * certification cannot invent one. Every branch below is a fact the profile
 * already proved, and a fact it cannot prove produces no signal at all —
 * a shorter bar is the correct output, never a padded one.
 */
export function trustSignals(profile: BusinessProfile): readonly TrustSignal[] {
  const signals: TrustSignal[] = [];

  const rating = ratingLine(profile);
  if (
    rating !== null &&
    profile.rating !== null &&
    profile.rating.value >= MIN_PROMOTABLE_RATING
  ) {
    signals.push({ kind: 'rating', label: rating, source: profile.rating.source });
  }

  // Both halves or neither. "Dentist" alone reassures nobody, and a town with
  // no trade is not a claim about the business at all.
  const category = profile.category?.value;
  const locality = profile.address?.value.locality;
  if (category !== undefined && locality !== undefined && locality !== null) {
    signals.push({
      kind: 'category',
      label: `${category} in ${locality}`,
      source: profile.category?.source ?? 'maps',
    });
  }

  // Seven distinct days means seven days with opening times, because a closed
  // day produces no entry. Anything less is not a claim that can be made — and
  // the reduced Maps pane usually yields one day, so this rarely fires.
  const days = new Set(profile.hours.map((entry) => entry.dayOfWeek));
  if (days.size === 7) {
    signals.push({ kind: 'hours', label: 'Open seven days a week', source: 'maps' });
  }

  const credential = profile.attributes.find(
    (attribute) => attribute.available && CREDENTIAL_ATTRIBUTE.test(attribute.label),
  );
  if (credential !== undefined) {
    signals.push({ kind: 'credential', label: credential.label, source: 'maps' });
  }

  return signals.slice(0, MAX_TRUST_SIGNALS);
}

/**
 * The star rating as a line a visitor can read, or `null`.
 *
 * Every benchmark profile carries a rating and no generated page has ever shown
 * one, which is most of why trust scores lowest of the eight dimensions. It is
 * built here rather than asked for, like every other verified fact.
 *
 * The count is usually absent: a signed-out Maps session is served a rating
 * without a review total. That is why the source is named — "4.9 on Google"
 * is checkable, "rated 4.9" by itself is a claim from nowhere — and why this
 * string never reaches the JSON-LD, where schema.org requires the count.
 */
export function ratingLine(profile: BusinessProfile): string | null {
  const rating = profile.rating?.value;
  if (rating === undefined) return null;

  const count = profile.reviewCount?.value;
  const stars = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  return count === undefined
    ? `${stars} on Google`
    : `${stars} on Google from ${count} review${count === 1 ? '' : 's'}`;
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
 * A social feed embedded in the page, which is not the business's photography.
 *
 * ## What this caught
 *
 * Zuni Café's homepage runs the Smash Balloon Instagram plugin, which writes
 * its thumbnails to `/wp-content/uploads/sb-instagram-feed-images/`. Nine of
 * the twelve photographs on the generated page came from there, and among them
 * were a **domestic-violence crisis-hotline poster** — phone numbers and all —
 * and a photograph of a bookshop's magazine rack. Both were published as a
 * restaurant's own imagery, on the page selling the restaurant.
 *
 * ## Why a feed is not a portfolio
 *
 * The images are on the business's own domain, so nothing was stolen and
 * nothing was invented. They are still wrong, for three reasons that no amount
 * of ranking fixes:
 *
 * - **A feed is chronological, not curated.** It shows whatever was posted most
 *   recently. A designer choosing twelve photographs for a gallery would not
 *   choose "the last twelve things they posted".
 * - **The subject is frequently not the business.** A charity campaign, an
 *   event flyer, a book signing, a repost of someone else's picture. The
 *   restaurant is incidental.
 * - **The crops are phone crops.** 640×1136, 640×800, 1080×1080. Dropped into a
 *   designed grid they read as a scrapbook, which is exactly how the Zuni page
 *   read.
 *
 * There is a rights argument too: a business reposting a supplier's or a
 * customer's photograph to Instagram does not acquire the right to publish it
 * on a commercial website, and the platform cannot tell the difference.
 *
 * Matched on the URL, because every one of these widgets writes a recognisable
 * path or serves from a recognisable CDN. Same shape as `MAP_HOSTS`: a signal
 * that is mechanical, not a judgement about the picture.
 */
const SOCIAL_EMBED_MARKERS = [
  // Feed plugins, by the directory each writes its cache to.
  'sb-instagram-feed-images', 'instagram-feed', 'insta-feed', 'instagram_feed',
  'juicer.io', 'taggbox', 'elfsight', 'curator.io', 'sociablekit', 'lightwidget',
  // The networks' own CDNs, where a feed is embedded rather than cached.
  'cdninstagram.com', 'fbcdn.net', 'scontent.', 'pbs.twimg.com', 'tiktokcdn',
];

/**
 * Third-party widget chrome served from a vendor CDN.
 *
 * Accessibility toolbars, consent banners and chat bubbles all inject `<img>`
 * elements. Zuni's page contributed two from `cdn.userway.org`. They are
 * interface, not photography, and no business wants its accessibility widget's
 * logo in its gallery.
 */
const WIDGET_HOSTS = [
  'cdn.userway.org', 'accessibe.com', 'acsbapp.com', 'cookiebot.com',
  'onetrust.com', 'usercentrics.eu', 'widget.trustpilot', 'tawk.to',
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
 * Five signals, in increasing generality:
 *  - the host only ever serves maps;
 *  - the URL is a social feed widget's cache, or a social CDN;
 *  - the host serves accessibility, consent or chat widget chrome;
 *  - the dimensions are an exact power-of-two tile;
 *  - the image is too small to be photography at any layout size.
 *
 * Each was added because a generated page shipped with the thing it excludes:
 * six Google Maps tiles on the dentist, a crisis-hotline poster on the
 * restaurant. The list grows by evidence, never by speculation.
 */
export function isUsablePhotograph(image: ImageAsset): boolean {
  const url = image.url.toLowerCase();
  if (MAP_HOSTS.some((host) => url.includes(host))) return false;
  if (SOCIAL_EMBED_MARKERS.some((marker) => url.includes(marker))) return false;
  if (WIDGET_HOSTS.some((host) => url.includes(host))) return false;

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

    const content = assembleContent(written, profile, warn);

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

/* ------------------------------------------------------------------ */
/* Baseline composition                                                */
/* ------------------------------------------------------------------ */

/**
 * The first sentence of a passage, and the rest.
 *
 * Splitting rather than summarising: both halves are the source's own words, so
 * a hero line and the paragraphs under it can come from one description without
 * either being written.
 */
function splitLead(passage: string): { lead: string; rest: string } {
  const trimmed = passage.trim();
  // The closing quote or bracket is part of the sentence that ends inside it.
  // Without it, Zuni's opening line — which ends on `dollars."` — was not
  // recognised as a sentence at all, and the hero swallowed the whole
  // paragraph looking for the next full stop.
  const match = /^(.{40,200}?[.!?]["'”’)\]]?)\s+([\s\S]+)$/.exec(trimmed);
  const lead = match?.[1]?.trim();
  const rest = match?.[2]?.trim();
  return lead !== undefined && rest !== undefined ? { lead, rest } : { lead: trimmed, rest: '' };
}

/** Sentence case for a category Maps writes lower-case, e.g. "3-star hotel". */
function asHeading(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ------------------------------------------------------------------ */
/* The business's own words                                            */
/* ------------------------------------------------------------------ */

/**
 * Text that is on a page but is not the page's prose.
 *
 * Navigation, legal chrome, cookie notices and calls to subscribe. All of it is
 * `innerText` because all of it is visible, and none of it says anything about
 * the business.
 */
const BOILERPLATE =
  /\b(cookies?|privacy policy|terms of (use|service)|all rights reserved|©|subscribe|newsletter|sign ?up|follow us|skip to (main )?content|accessibility statement|powered by)\b/i;

/** A contact detail. It belongs in the contact section, never in prose. */
const CONTACT_IN_TEXT = /[\w.+-]+@[\w-]+\.\w+|\+?\d[\d\s().-]{7,}\d|\bhttps?:\/\//;

/**
 * Paragraphs from one crawled page that could be published as they stand.
 *
 * ## Why this exists
 *
 * Zuni Café has 8,752 characters of its own copy across five crawled pages —
 * including a history page opening "founded in 1979, by Billy West — with a
 * huge heart and exactly ten thousand dollars" — and the composed page for it
 * was **47 words**. The composer read the listing's editorial description and
 * nothing else, so a business *with* a website produced less than one without.
 *
 * ## Why quoting is still not writing
 *
 * The composer's guarantee is that nothing on the page was written, so nothing
 * on it can be wrong. Copying a paragraph the business published about itself
 * keeps that guarantee exactly: it is the same rule the listing description
 * already follows, applied to a better source. Nothing is summarised, joined,
 * paraphrased or trimmed mid-sentence.
 *
 * ## What gets rejected
 *
 * `innerText` includes the navigation, the address line and the cookie banner,
 * because a sighted visitor sees those too. A block survives only if it reads
 * like prose: long enough to be a paragraph, punctuated like one, not
 * boilerplate, and carrying no contact detail — a phone number belongs in the
 * contact section, and a paragraph containing one would also trip the
 * grounding check downstream.
 */
export function publishableParagraphs(text: string): readonly string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => {
      // A paragraph, not a heading and not a menu item.
      //
      // The upper bound is generous because a good opening paragraph is often
      // a long one: Zuni's history opens with a 640-character paragraph about
      // Billy West, ten thousand dollars and the cactus shop next door. A
      // 700-character cap rejected it and the composer fell through to the
      // paragraph after, so the page opened on the word "Nevertheless".
      // `splitLead` shortens a long passage at a sentence boundary later, which
      // is the honest way to do it.
      if (block.length < 100 || block.length > 1400) return false;
      // Punctuated like prose. A nav row of six links has no full stop in it.
      if (!/[.!?]["'”’)]?$/.test(block)) return false;
      if (block.split(/\s+/).length < 18) return false;
      if (BOILERPLATE.test(block)) return false;
      if (CONTACT_IN_TEXT.test(block)) return false;
      // A pipe or a bullet run is a layout artefact of a list, not a sentence.
      if (/[|•·]/.test(block)) return false;
      return true;
    });
}

/**
 * Page titles that promise the business's story rather than its latest news.
 *
 * Order matters and recency deliberately does not. A homepage's first prose
 * block is whatever was promoted this month — on Zuni's it is a collaboration
 * on a cannabis edible, which is true, published, and a poor thing to open a
 * restaurant's website with. A page a business titled "History" or "About" is
 * the page it wrote to be read first, and it stays right for longer.
 */
const NARRATIVE_TITLE = /\b(about|history|our story|story|who we are|the practice)\b/i;

/**
 * A paragraph that continues an argument the reader has not been shown.
 *
 * "Nevertheless, the restaurant was an instant, improbable success" is a fine
 * sentence in its place and a bad first line anywhere else — it answers an
 * objection the page never raised. A opening connective is the cheapest
 * available signal that a paragraph was written to sit in the middle, and it
 * disqualifies a paragraph from *leading* without disqualifying it from the
 * page.
 */
const CONTINUATION =
  /^(nevertheless|however|but|so|then|meanwhile|moreover|furthermore|additionally|also|yet|still|therefore|thus|consequently|in addition|as a result|that said|of course)\b/i;

export interface Narrative {
  /** The opening line, verbatim. */
  readonly lead: string;
  /** Further paragraphs, verbatim and in the source's order. */
  readonly body: readonly string[];
  /** The page every line above came from. */
  readonly sourceUrl: string;
}

/**
 * The best narrative the business has published about itself, or `null`.
 *
 * One page only. Paragraphs from two different pages placed under one heading
 * would be an edit — a claim that these things belong together, which is a
 * judgement the composer is not allowed to make.
 */
export function narrativeFrom(
  pages: readonly PageText[],
  businessName: string,
): Narrative | null {
  const ranked = [...pages].sort((a, b) => {
    const score = (page: PageText): number =>
      NARRATIVE_TITLE.test(`${page.title ?? ''} ${page.url}`) ? 1 : 0;
    return score(b) - score(a);
  });

  // The first word of the business's name, which is how a page refers to
  // itself. "Zuni" matches "Zuni Café was founded in 1979"; the full string
  // with its accent and suffix often does not.
  const firstWord = businessName.trim().split(/\s+/)[0] ?? '';

  for (const page of ranked) {
    const paragraphs = publishableParagraphs(page.text);
    if (paragraphs.length === 0) continue;

    // A paragraph that names the business and does not open mid-argument. That
    // is what an opening paragraph looks like, and picking it rather than the
    // first surviving block is the difference between "Zuni Café was founded in
    // 1979, by Billy West" and "Nevertheless, the restaurant was…".
    const opensWell = (block: string): boolean =>
      !CONTINUATION.test(block) && (firstWord === '' || block.includes(firstWord));

    const leadIndex = paragraphs.findIndex(opensWell);
    const chosen = leadIndex === -1 ? paragraphs.findIndex((b) => !CONTINUATION.test(b)) : leadIndex;
    if (chosen === -1) continue;

    const lead = paragraphs[chosen]!;
    const body = paragraphs.filter((_, index) => index !== chosen);

    return { lead, body: body.slice(0, 3), sourceUrl: page.url };
  }

  return null;
}

/**
 * A complete, truthful page composed from the profile alone — no model.
 *
 * ## Why this exists
 *
 * Three things, in order of how much they matter.
 *
 * **It is the floor.** Every string it emits was already in the profile: the
 * listing's own description, the attributes it states, the services the site
 * named, the photographs, the hours, the contact details. Nothing is written,
 * so nothing can be wrong. The model's job is to beat this page, and having a
 * floor is what makes "better" measurable.
 *
 * **It removes a single point of failure.** Until it existed, no provider meant
 * no output at all — not a worse website, *nothing*. A platform that sells
 * websites cannot have a dependency that turns an upstream rate limit into a
 * blank page. The Gemini free-tier quota blocked every model stage across two
 * sessions and four attempts, which is how the gap got noticed.
 *
 * **It is the shape of guided completion.** A deterministic draft plus an
 * honest list of what is missing is exactly the flow the product needs for a
 * business whose public information is exhausted: here is what we could build,
 * here is what we still need from you. `unresolvedGaps` is already that list.
 *
 * ## What it deliberately does not do
 *
 * Headings are functional rather than distinctive — "What this place offers",
 * not something only this business could say. That is the honest limit of
 * composition without writing, and it is precisely the gap the model fills. A
 * page from here is publishable in substance and plain in voice; it should read
 * as a solid draft, never as a finished premium site.
 */
export function composeBaseline(profile: BusinessProfile): WebsiteContent {
  const sections: DraftSection[] = [];
  const warnings: string[] = [];

  const category = profile.category?.value ?? null;
  const locality = profile.address?.value.locality ?? null;
  const description = profile.description?.value ?? '';
  const { lead, rest } = splitLead(description);
  const hasPhone = profile.phones.length > 0;

  /*
   * The business's own words, used where the listing has none.
   *
   * The listing description stays first: Google writes it as a summary, so it
   * opens a page well, and it exists for businesses that publish nothing else.
   * Where there is no listing description, the site's own prose is a strictly
   * better source than silence — and silence is what the composer produced for
   * Zuni Café, a restaurant with five crawled pages, a James Beard award and a
   * history page, whose generated site ran to 47 words.
   */
  const narrative = description === '' ? narrativeFrom(profile.pages, profile.name.value) : null;
  // Split the same way the listing description is: an opening sentence for the
  // hero, the remainder for about, so no passage is printed twice.
  const narrativeLead = narrative !== null ? splitLead(narrative.lead) : null;

  const primaryCta = primaryCtaFor(profile);

  // Hero. The heading says what the business is and where, which is the one
  // thing a stranger needs first and the one thing the profile always proves.
  const trade = category !== null ? asHeading(category) : profile.name.value;
  sections.push({
    kind: 'hero',
    heading: locality !== null ? `${trade} in ${locality}` : trade,
    subheading: '',
    // The lead sentence sits here and the remainder goes to `about`, so the
    // same passage is never printed twice.
    body: lead !== '' ? lead : (narrativeLead?.lead ?? ''),
    bullets: [],
    ...primaryCta,
  });

  // About, from whichever source had prose. The listing's remainder if there
  // was one, otherwise the paragraphs following the narrative's opening line —
  // never both, and never the two interleaved.
  const aboutBody =
    rest !== ''
      ? rest
      : [narrativeLead?.rest ?? '', ...(narrative?.body ?? [])]
          .filter((paragraph) => paragraph !== '')
          .join('\n\n');
  if (aboutBody !== '') {
    sections.push({
      kind: 'about',
      heading: `About ${profile.name.value}`,
      subheading: '',
      body: aboutBody,
      bullets: [],
      ctaLabel: '',
      ctaTarget: 'none',
    });
  }

  // What the business offers: its own service list where the site named one,
  // otherwise the attributes the listing states. Never both — they overlap.
  //
  // The category is excluded even when it arrived as an attribute. "3-star
  // hotel" is what this business *is*, and the normalizer may already have
  // promoted it to the category; listing it again under "what this place
  // offers" reads as a hotel offering hotels.
  const stated = profile.attributes.filter(
    (attribute) =>
      attribute.available && attribute.label.toLowerCase() !== (category ?? '').toLowerCase(),
  );
  if (profile.services.length > 0) {
    sections.push({
      kind: 'services',
      heading: 'What we offer',
      subheading: '',
      body: '',
      bullets: profile.services
        .slice(0, 8)
        .map((service) => (service.description ? `${service.name} — ${service.description}` : service.name)),
      ctaLabel: '',
      ctaTarget: 'none',
    });
  } else if (stated.length > 0) {
    sections.push({
      kind: 'services',
      heading: 'What this place offers',
      subheading: '',
      body: '',
      // Verbatim labels. The unavailable ones were filtered above and must
      // never reach a page, in either direction.
      bullets: stated.slice(0, 10).map((attribute) => attribute.label),
      ctaLabel: '',
      ctaTarget: 'none',
    });
  }

  // The gallery threshold matches the writer's: below four photographs a grid
  // reads as an accident rather than a gallery.
  // Counted after filtering, not before.
  //
  // `assignImages` drops map tiles, social-feed thumbnails and widget chrome,
  // so a business with five junk images used to get a gallery *section* that
  // then rendered one photograph or none. The decision to have a gallery and
  // the images that fill it must be the same set, or the page promises
  // something the renderer cannot deliver.
  if (profile.images.gallery.filter(isUsablePhotograph).length >= 4) {
    sections.push({
      kind: 'gallery',
      heading: 'Photographs',
      subheading: '',
      body: '',
      bullets: [],
      ctaLabel: '',
      ctaTarget: 'none',
    });
  }

  // Bullets left empty on purpose: `assembleContent` replaces them with the
  // profile's own values, the same way it does for the model's draft.
  if (profile.hours.length > 0) {
    sections.push({
      kind: 'hours',
      heading: 'Opening hours',
      subheading: '',
      body: '',
      bullets: [],
      ctaLabel: '',
      ctaTarget: 'none',
    });
  }

  if (profile.address !== null || hasPhone || profile.emails.length > 0) {
    sections.push({
      kind: 'contact',
      heading: 'Contact',
      subheading: '',
      body: '',
      bullets: [],
      ...primaryCta,
    });
  }

  /*
   * The closing moment.
   *
   * Every composed page used to end on the contact table and then a footer that
   * does nothing. A page that stops is not the same as a page that closes: a
   * premium site ends on a deliberate invitation — a line and one button — and
   * the difference is the last thing a visitor feels before they leave or act.
   *
   * The heading is a functional label, not a claim. "Visit", "Call" and "Get in
   * touch" say what the reader may do next; they assert nothing about the
   * business that the profile has not already proved, which is the same footing
   * "Contact" and "Opening hours" have always stood on. The verb is chosen from
   * the action the profile can actually support, so a business with no phone is
   * never invited to be called.
   *
   * `assembleContent` resolves the target and drops the button if the profile
   * cannot back it; the design layer already centres a `cta` and sorts it last.
   */
  if (primaryCta.ctaTarget !== 'none') {
    const invitation =
      profile.address !== null && locality !== null
        ? `Visit ${profile.name.value} in ${locality}`
        : `Get in touch with ${profile.name.value}`;

    sections.push({
      kind: 'cta',
      heading: invitation,
      subheading: '',
      // Deliberately empty. A closing section is a line and a button; a
      // paragraph here would be the composer writing marketing copy, and
      // repeating the address the contact block states two sections earlier.
      body: '',
      bullets: [],
      ...primaryCta,
    });
  }

  const seoTitle =[profile.name.value, category !== null && locality !== null ? `${category} in ${locality}` : null]
    .filter((part): part is string => part !== null)
    .join(' — ');

  const draft: Draft = {
    // Deliberately not a slogan. The eyebrow states the category, which is a
    // fact; a tagline would be the first thing this function invented.
    tagline: category !== null ? asHeading(category) : '',
    // Left blank for the design stage to decide. A composed page has no voice
    // to report, and guessing one would push the design somewhere the data
    // does not support.
    voice: { tone: '', headingFont: '', bodyFont: '', palette: [] },
    sections,
    seo: {
      title: seoTitle,
      // The listing's own first sentence is a better meta description than
      // anything assembled from field names, and it is already public.
      description: lead !== '' ? lead : seoTitle,
      keywords: [category, locality].filter((part): part is string => part !== null),
    },
    unresolvedGaps: [
      'This page was composed from verified data only, with no copywriting. Every line is a fact from the listing or the website; none of it was written for this business.',
      ...(description === ''
        ? ['No description of the business was available from any source, so the page has no narrative.']
        : []),
    ],
  };

  return assembleContent(draft, profile, (message) => warnings.push(message));
}

/**
 * Drops a trust signal the hero already says.
 *
 * The bar sits immediately under the hero, so a signal repeating the headline
 * is not reassurance — it is the same sentence twice, eight lines apart. The
 * benchmark hotel rendered `3-star hotel` as its eyebrow, its `h1` and its
 * trust bar, all in the first screen.
 *
 * Comparison is on the visible words rather than the exact string, so
 * "3-star hotel in San Francisco" is caught by a headline reading
 * "3-star hotel in San Francisco" whatever the punctuation and casing.
 */
function withoutEcho(
  signals: readonly TrustSignal[],
  sections: readonly WebsiteSection[],
): readonly TrustSignal[] {
  const hero = sections.find((section) => section.kind === 'hero');
  if (hero === undefined) return signals;

  const spoken = [hero.heading, hero.subheading ?? '']
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return signals.filter((signal) => {
    const said = signal.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return said === '' || !spoken.includes(said);
  });
}

/**
 * How many customer quotations a page carries.
 *
 * Three is a wall of praise; more is a page asking to be believed rather than
 * one being read. The rating in the trust bar already states the aggregate —
 * these exist to give it a voice, not to restate it louder.
 */
const MAX_TESTIMONIALS = 3;

/**
 * Verified reviews as the renderer's quote bullets.
 *
 * The format is the one `splitQuote` in the renderer parses — a quotation
 * closed by its own quote mark, an em dash, then the attribution. Wrapping the
 * text in typographic quotes is not decoration: it guarantees the closing
 * character the parser needs, whatever punctuation the reviewer ended on.
 *
 * A review with no author is attributed to the source rather than left bare.
 * "Google review" is checkable and modest; an unattributed quotation floating
 * on a page is exactly what a fabricated one looks like.
 */
export function testimonialBullets(reviews: readonly ListingReview[]): readonly string[] {
  return reviews.slice(0, MAX_TESTIMONIALS).map((review) => {
    // Any dash in the attribution would be read as the separator, splitting the
    // quotation in the wrong place and putting half a sentence in the mouth of
    // a name that is not there.
    const author = (review.authorName ?? '').replace(/[—–-]/g, ' ').trim();
    return `“${review.text.trim()}” — ${author === '' ? 'Google review' : author}`;
  });
}

/**
 * Replaces any testimonials section with one built from verified reviews.
 *
 * ## Why the model is not allowed to write this section
 *
 * Every other section it writes is prose about a business. A testimonial is a
 * claim attributed to a *named human being*, and the failure mode is not a
 * clumsy sentence — it is a fabricated endorsement under a real person's name,
 * published on a paying customer's website. That is unfixable after the fact
 * and it is the one defect that would end the product.
 *
 * The prompt has forbidden it since the writer was built: "testimonials — ONLY
 * if the brief contains actual customer words. It usually does not. Omit it."
 * That is an instruction, and an instruction is a request. This is the
 * structural version of the same rule, and it is the one that holds when a
 * model misreads the brief, when the provider changes, or when someone edits
 * the prompt in a hurry two years from now.
 *
 * So: the drafted section keeps its *position and heading* — where a page
 * should ask for social proof and how it should introduce it are genuine
 * editorial judgements, and the model is good at them. Its bullets are
 * discarded unread and replaced with quotations that came from a source. With
 * no verified reviews the section is removed entirely, because an empty
 * testimonials section is worse than none and an invented one is worse still.
 *
 * The same rule governs hours, contact rows and the JSON-LD, for the same
 * reason: a model that is never asked for a fact cannot invent one.
 */
export function groundTestimonials(
  sections: readonly DraftSection[],
  profile: BusinessProfile,
  warn: (message: string) => void,
): readonly DraftSection[] {
  const bullets = testimonialBullets(profile.reviews);
  const index = sections.findIndex((section) => section.kind === 'testimonials');

  if (bullets.length === 0) {
    if (index === -1) return sections;
    warn(
      'the writer emitted a testimonials section with no verified review behind it; the section was removed rather than published as written',
    );
    return sections.filter((section) => section.kind !== 'testimonials');
  }

  if (index !== -1) {
    const drafted = sections[index]!;
    if (drafted.bullets.length > 0) {
      warn(
        `the writer supplied ${drafted.bullets.length} testimonial bullet(s); they were replaced with verified reviews`,
      );
    }
    return sections.map((section, at) =>
      at === index ? { ...section, body: '', bullets: [...bullets] } : section,
    );
  }

  // Reviews exist and the model did not ask for the section. Insert it rather
  // than waste them: this is the case that holds for every page composed with
  // no model at all, which is the path a run with no provider takes.
  //
  // Placed before whichever of the closing sections comes first, so proof
  // arrives while a visitor is still deciding rather than after the page has
  // asked them to act. The design stage may reorder it by industry; this only
  // has to be a defensible default.
  const CLOSING: readonly SectionKind[] = ['hours', 'location', 'contact', 'cta'];
  const at = sections.findIndex((section) => CLOSING.includes(section.kind));
  const inserted: DraftSection = {
    kind: 'testimonials',
    heading: 'In their words',
    subheading: '',
    body: '',
    bullets: [...bullets],
    ctaLabel: '',
    ctaTarget: 'none',
  };

  return at === -1
    ? [...sections, inserted]
    : [...sections.slice(0, at), inserted, ...sections.slice(at)];
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sections that may carry a mid-page call to action, best first.
 *
 * Ordered by how ready a reader is to act after reading one. Someone who has
 * just read what a business *offers* is closer to calling than someone who has
 * just read where it came from, so `services` and `menu` outrank `about`.
 *
 * Deliberately absent: `hero` and `cta` already carry one; `contact` and
 * `hours` are the destination rather than a prompt toward it; `faq` ends on a
 * reader's unresolved question, which is the wrong moment to ask.
 */
const CONVERSION_CARRIERS: readonly SectionKind[] = [
  'services',
  'menu',
  'gallery',
  'testimonials',
  'about',
  'location',
];

/**
 * Roughly how many screens of scroll a section will occupy.
 *
 * Counting *sections* is the obvious rule and it measures the wrong thing.
 * Zuni Café's page is five sections and 7.6 screens tall, because one of those
 * sections is a gallery of twelve photographs occupying 3.2 screens on its own.
 * A reader scrolls through that entire stretch with no way to act, and a
 * section-based rule sees a tidy gap of two.
 *
 * So this estimates height from the content, in the same units the creative
 * review measures the rendered page in. It is an approximation and does not
 * need to be better than one: it is deciding whether a gap is *about* two
 * screens or *about* five. Calibrated against the rendered benchmark — the
 * estimate for Zuni totals 7.4 screens against a measured 7.6.
 */
function estimatedScreens(section: DraftSection, imageCount: number): number {
  return (
    0.35 +
    imageCount * 0.28 +
    section.bullets.length * 0.07 +
    section.body.length / 1500
  );
}

/**
 * The gap, in screens, that a reader may cross with no way to act.
 *
 * The creative review scores a page weak below one call to action per two
 * screens, so this sits just under that: closing the gap the reviewer measures
 * rather than a different quantity that happens to be easier to count.
 */
const MAX_SCREENS_BETWEEN_CTAS = 1.8;

/**
 * The most buttons this will ever add.
 *
 * Restraint is the point. A premium page is not a page with a button in every
 * section — that reads as a funnel, not as a business — so this closes the
 * worst gaps and stops, even if a very long page still falls slightly short.
 */
const MAX_INSERTED_CTAS = 2;

/**
 * The action this business can best support, as a label and an intent.
 *
 * Phone first: a local business is called, not emailed. Shared by the composer
 * and by the mid-page pass so a page never offers two different primary
 * actions, and returns `none` rather than inventing a route the profile cannot
 * back — `resolveCta` would drop the button anyway, and a heading promising an
 * action with no button under it is worse than neither.
 */
export function primaryCtaFor(
  profile: BusinessProfile,
): { readonly ctaLabel: string; readonly ctaTarget: CtaTarget } {
  if (profile.phones.length > 0) return { ctaLabel: 'Call us', ctaTarget: 'phone' };
  if (profile.emails.length > 0) return { ctaLabel: 'Email us', ctaTarget: 'email' };
  return { ctaLabel: '', ctaTarget: 'none' };
}

/**
 * Puts a call to action in the middle of a page that has none.
 *
 * ## Why this is code's job and not the writer's
 *
 * Conversion scored lowest of the eight dimensions across the benchmark, and
 * the cause was never that the model forgot to ask — it is that nobody was
 * counting. The hero opens with a button and the closing section ends with
 * one; on a 5,800px page that leaves the entire middle without a way to act,
 * and the middle is where a reader decides.
 *
 * Published guidance on local landing pages is consistent on the shape: one
 * call to action above the fold, one in the body because most readers never
 * reach the end, and one at the close. The platform had the first and the
 * third. This is the second.
 *
 * It is the same rule as the trust bar and the testimonials: a decision the
 * page's structure implies, made by code that can measure it, rather than an
 * instruction a model is asked to remember on every run.
 *
 * ## Restraint is the point
 *
 * At most **one** button is added, and only when more than
 * `MAX_SECTIONS_BETWEEN_CTAS` sections would otherwise pass without one. A
 * premium page is not a page with a button in every section — that reads as a
 * funnel, not as a business — so this closes the gap and stops.
 */
export function placeMidPageCta(
  sections: readonly DraftSection[],
  primary: { readonly ctaLabel: string; readonly ctaTarget: CtaTarget },
  imagesPerSection: ReadonlyMap<number, number>,
  warn: (message: string) => void,
): readonly DraftSection[] {
  if (primary.ctaTarget === 'none' || primary.ctaLabel.trim() === '') return sections;

  const hasCta = (section: DraftSection): boolean =>
    section.ctaTarget !== 'none' && section.ctaLabel.trim() !== '';

  let current = [...sections];

  for (let added = 0; added < MAX_INSERTED_CTAS; added += 1) {
    const heights = current.map((section, index) =>
      estimatedScreens(section, imagesPerSection.get(index) ?? 0),
    );

    // Walk the page accumulating scroll since the last button, and remember the
    // worst stretch and which sections fell inside it.
    let worstGap = 0;
    let worstRange: readonly number[] = [];
    let sinceCta = 0;
    let run: number[] = [];

    current.forEach((section, index) => {
      if (hasCta(section)) {
        sinceCta = 0;
        run = [];
        return;
      }
      sinceCta += heights[index] ?? 0;
      run.push(index);
      if (sinceCta > worstGap) {
        worstGap = sinceCta;
        worstRange = [...run];
      }
    });

    if (worstGap <= MAX_SCREENS_BETWEEN_CTAS) break;

    // Within that stretch, the section a reader is readiest to act after.
    const candidates = worstRange
      .map((index) => ({ index, kind: current[index]!.kind }))
      .filter((entry) => CONVERSION_CARRIERS.includes(entry.kind));
    if (candidates.length === 0) break;

    const chosen = candidates.reduce((best, entry) =>
      CONVERSION_CARRIERS.indexOf(entry.kind) < CONVERSION_CARRIERS.indexOf(best.kind) ? entry : best,
    );

    warn(
      `no call to action across ${worstGap.toFixed(1)} screens of scroll; one was added to "${chosen.kind}"`,
    );

    current = current.map((section, index) =>
      index === chosen.index ? { ...section, ...primary } : section,
    );
  }

  return current;
}

/**
 * A draft plus the profile, assembled into the finished spec.
 *
 * Everything here is the part of a page the model does not get to decide:
 * which photograph goes where, what the hours and contact rows say, where a
 * call to action points, the trust bar, the JSON-LD, and the gaps the data
 * itself proves. The model contributes prose and section order; this
 * contributes every fact.
 *
 * It is a free function rather than inline in `run` because the model is not
 * the only thing that can produce a draft — `composeBaseline` produces one from
 * the profile alone, and the two must yield identical page furniture or the
 * fallback would be a second, quietly different renderer.
 */
function assembleContent(
  written: Draft,
  profile: BusinessProfile,
  warn: (message: string) => void,
): WebsiteContent {
  // Testimonials are resolved before anything else reads the section list:
  // the section may be added or removed here, and images, anchors and ids all
  // key off position.
  // Testimonials first, because that pass is the only one that adds or removes
  // a section and everything below keys off position. Images next, because the
  // conversion pass estimates scroll height and a gallery's photographs are
  // most of it. The conversion pass itself only rewrites sections in place, so
  // the indices stay valid.
  const grounded = groundTestimonials(dedupeSections(written.sections, warn), profile, warn);
  const images = assignImages(grounded, profile);
  const drafted = placeMidPageCta(
    grounded,
    primaryCtaFor(profile),
    new Map([...images].map(([index, list]) => [index, list.length])),
    warn,
  );

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
      'The star rating is shown on the page but not marked up as structured data: the review count is missing and schema.org requires both.',
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
    trust: withoutEcho(trustSignals(profile), sections),
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

  return content;
}
