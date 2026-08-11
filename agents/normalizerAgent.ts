/**
 * Stage 3 of 5.
 *
 * Single responsibility: reconcile the Maps listing and the website into one
 * canonical `BusinessProfile`. It merges, deduplicates, normalises and
 * validates — it never fetches anything and never writes prose.
 *
 * Two rules govern every decision here. Nothing is invented: a value that
 * cannot be derived without guessing stays `null`. And nothing is silently
 * dropped: when two sources disagree the loser is kept as an alternative, so
 * a wrong pick is auditable rather than invisible.
 *
 * No browser, no network, no LLM.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { InvalidInputError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type {
  Agent,
  AgentContext,
  Attributed,
  AttributedValue,
  BusinessAttribute,
  BusinessProfile,
  CollectedBusiness,
  DiscoveryResult,
  FieldSource,
  GeoPoint,
  // (FieldSource already imported above; kept here as the anchor for the
  // description-authority ranking added by Instagram Research V1.)
  ImageAsset,
  NavigationLink,
  OpeningHours,
  PageText,
  PhoneNumber,
  PostalAddress,
  RankedImages,
  ServiceItem,
  SocialProfile,
  ValidationIssue,
  ValidationReport,
} from '../lib/types.js';

import type { CollectedSources } from '../lib/sources/collectedSources.js';

const NAME = 'normalizerAgent';

const ARTIFACT = 'business.json';

/**
 * Query parameters that identify a campaign or a visitor rather than a
 * resource. Removing them is what makes two links to the same page compare
 * equal — and keeps a client's Instagram URL from carrying our referral trail.
 */
const TRACKING_PARAM =
  /^(utm_[a-z_]*|gclid|dclid|gbraid|wbraid|fbclid|msclkid|yclid|twclid|igshid|igsh|si|mc_cid|mc_eid|_hsenc|_hsmi|hsa_[a-z]*|pk_[a-z]*|piwik_[a-z]*|matomo_[a-z]*|vero_[a-z]*|oly_[a-z_]*|spm|scid|trk|ref_src|ref_url|_ga|_gl|ttclid|li_fat_id|epik|s_kwcid|cmpid|campaignid|adgroupid)$/i;

/** Countries where a bare 10-digit number is unambiguously `+1`. */
const NANP_COUNTRY = /\b(united states|usa|u\.s\.a?\.?|canada)\b/i;

/** Regions of an address string that are a country rather than a state. */
const COUNTRY_HINT = /\b(united states|usa|canada|united kingdom|uk|australia|ireland|france|germany|spain|italy|netherlands|mexico|japan|new zealand)\b/i;

/** `name@2x.png` is a filename the email pattern happily matches. */
const NOT_AN_EMAIL_TLD = /\.(png|jpe?g|gif|webp|svg|avif|ico|css|js|json|html?|php|woff2?)$/i;

const EMAIL_SHAPE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}$/;

/* ------------------------------------------------------------------ */
/* Attribution                                                         */
/* ------------------------------------------------------------------ */

function candidate<T>(value: T, source: FieldSource, sourceUrl: string): AttributedValue<T> {
  return { value, source, sourceUrl };
}

/** Drops any nested alternatives, so the alternatives list stays one level deep. */
function plain<T>(item: AttributedValue<T>): AttributedValue<T> {
  return { value: item.value, source: item.source, sourceUrl: item.sourceUrl };
}

function nestedAlternatives<T>(item: AttributedValue<T>): readonly AttributedValue<T>[] {
  return (item as Attributed<T>).alternatives ?? [];
}

/**
 * Picks the highest-scoring candidate and keeps the rest as alternatives.
 * Ties go to the earlier candidate, so caller order encodes source preference.
 *
 * Candidates may already be `Attributed` — that is what `dedupeCandidates`
 * returns — so their own alternatives are carried through. Without this, a
 * value rejected inside a dedupe group would disappear from the record.
 */
function chooseBest<T>(
  candidates: readonly AttributedValue<T>[],
  score: (item: AttributedValue<T>) => number,
): Attributed<T> | null {
  if (candidates.length === 0) return null;

  const ranked = [...candidates]
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const winner = ranked[0]!.item;
  const alternatives: AttributedValue<T>[] = [
    ...nestedAlternatives(winner),
    ...ranked.slice(1).flatMap((entry) => [plain(entry.item), ...nestedAlternatives(entry.item)]),
  ];

  const seen = new Set<string>();
  const unique = alternatives.filter((item) => {
    const key = `${JSON.stringify(item.value)}|${item.sourceUrl}`;
    if (seen.has(key) || key === `${JSON.stringify(winner.value)}|${winner.sourceUrl}`) return false;
    seen.add(key);
    return true;
  });

  return { ...plain(winner), alternatives: unique };
}

/** Collapses candidates that mean the same thing before any choice is made. */
function dedupeCandidates<T>(
  candidates: readonly AttributedValue<T>[],
  key: (item: AttributedValue<T>) => string,
  score: (item: AttributedValue<T>) => number,
): Attributed<T>[] {
  const groups = new Map<string, AttributedValue<T>[]>();
  for (const item of candidates) {
    const id = key(item);
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }

  return [...groups.values()]
    .map((group) => chooseBest(group, score))
    .filter((entry): entry is Attributed<T> => entry !== null);
}

/* ------------------------------------------------------------------ */
/* URLs                                                                */
/* ------------------------------------------------------------------ */

/** Strips tracking parameters, the fragment, and default ports. */
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }

  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  // A bare host and a bare host with a slash are the same page.
  if (url.pathname === '/' && url.search === '') return `${url.protocol}//${url.host}`;
  return url.toString();
}

/** Identity for comparison: scheme, `www.` and trailing slash are noise. */
export function urlIdentity(raw: string): string {
  const normalized = normalizeUrl(raw) ?? raw;
  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '');
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${host}${pathname}${url.search}`.toLowerCase();
  } catch {
    return normalized.toLowerCase();
  }
}

/**
 * A profile URL is identified by its path alone.
 *
 * `instagram.com/acme` and `instagram.com/acme?hl=en` are one account, and the
 * query never carries meaning on these hosts — so it is dropped rather than
 * kept, which also makes the two compare equal.
 */
export function normalizeProfileUrl(raw: string): string | null {
  const normalized = normalizeUrl(raw);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return normalized;
  }
}

function urlScore(value: string): number {
  let score = 0;
  if (value.startsWith('https:')) score += 10;
  // Fewer query parameters means less residual noise.
  try {
    score -= [...new URL(value).searchParams.keys()].length;
  } catch {
    score -= 5;
  }
  return score;
}

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

export function normalizeEmail(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/^mailto:/i, '')
    .replace(/[.,;:)\]]+$/, '')
    .toLowerCase();

  if (!EMAIL_SHAPE.test(value) || NOT_AN_EMAIL_TLD.test(value)) return null;
  return value;
}

/* ------------------------------------------------------------------ */
/* Phones                                                              */
/* ------------------------------------------------------------------ */

/**
 * Normalises a published number.
 *
 * E.164 is only produced where it follows from the input: an explicit `+`, or
 * a NANP-length number on an address that is demonstrably US or Canadian.
 * Guessing a country code for anything else would invent a phone number.
 */
export function normalizePhone(raw: string, country: string | null): PhoneNumber | null {
  const formatted = raw.trim().replace(/\s+/g, ' ');
  if (!formatted) return null;

  const hasPlus = formatted.startsWith('+');
  const digits = formatted.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  let e164: string | null = null;
  if (hasPlus) {
    e164 = `+${digits}`;
  } else if (country && NANP_COUNTRY.test(country)) {
    if (digits.length === 10) e164 = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  }

  return { formatted, e164, digits };
}

/**
 * Compares on the last nine digits, so `+1 415-487-2600` and `(415) 487-2600`
 * are one number rather than two.
 */
function phoneIdentity(phone: PhoneNumber): string {
  return phone.digits.slice(-9);
}

/* ------------------------------------------------------------------ */
/* Addresses                                                           */
/* ------------------------------------------------------------------ */

/**
 * Splits a comma-separated address into components, best effort.
 *
 * `formatted` is always the string as published — the components are a
 * convenience, and any part that cannot be identified stays `null` rather than
 * being guessed at.
 */
export function normalizeAddress(raw: string): PostalAddress {
  const formatted = raw.replace(/\s+/g, ' ').trim();
  const parts = formatted.split(',').map((part) => part.trim()).filter(Boolean);

  const address = {
    formatted,
    street: null as string | null,
    locality: null as string | null,
    region: null as string | null,
    postalCode: null as string | null,
    country: null as string | null,
  };
  if (parts.length === 0) return address;

  const rest = [...parts];
  const last = rest[rest.length - 1];
  if (last && COUNTRY_HINT.test(last)) {
    address.country = last;
    rest.pop();
  }

  // The region segment is where a postal code travels: "CA 94110".
  const regionPart = rest.length > 1 ? rest[rest.length - 1] : null;
  if (regionPart) {
    const withPostal = /^(.*?)[\s,]+([A-Z0-9][A-Z0-9 -]{2,9})$/i.exec(regionPart);
    if (withPostal?.[1] && withPostal[2] && /\d/.test(withPostal[2])) {
      address.region = withPostal[1].trim();
      address.postalCode = withPostal[2].trim();
    } else {
      address.region = regionPart;
    }
    rest.pop();
  }

  if (rest.length > 1) address.locality = rest.pop() ?? null;
  if (rest.length > 0) address.street = rest.join(', ');

  return address;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * Image identity ignores the query string.
 *
 * CDNs serve one photograph at many widths — `?w=800` and `?w=2000` are the
 * same picture — so the path is the identity and the largest variant wins.
 */
function imageIdentity(image: ImageAsset): string {
  try {
    const url = new URL(image.url);
    return `${url.hostname.replace(/^www\./i, '')}${url.pathname}`.toLowerCase();
  } catch {
    return image.url.toLowerCase();
  }
}

function imageScore(image: ImageAsset): number {
  let score = 0;
  // A file on disk beats a reference that never resolved.
  if (image.localPath) score += 10_000;
  score += Math.min((image.width ?? 0) * (image.height ?? 0), 16_000_000) / 1_000;
  score += Math.min(image.bytes ?? 0, 4_000_000) / 100_000;
  if (image.alt) score += 5;
  return score;
}

/** Hashes downloaded bytes so the same picture under two URLs collapses to one. */
async function contentHashes(
  images: readonly ImageAsset[],
  outputDir: string,
  logger: Logger,
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();

  await Promise.all(
    images.map(async (image) => {
      if (!image.localPath) return;
      try {
        const bytes = await fs.readFile(path.join(outputDir, image.localPath));
        hashes.set(image.url, crypto.createHash('sha256').update(bytes).digest('hex'));
      } catch (error) {
        logger.debug('could not hash asset', {
          localPath: image.localPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return hashes;
}

function dedupeImages(
  images: readonly ImageAsset[],
  hashes: ReadonlyMap<string, string>,
): ImageAsset[] {
  const best = new Map<string, ImageAsset>();

  for (const image of images) {
    // Identical bytes are the same image whatever the URL says; fall back to
    // the path when the file never downloaded.
    const key = hashes.get(image.url) ?? imageIdentity(image);
    const existing = best.get(key);
    if (!existing || imageScore(image) > imageScore(existing)) best.set(key, image);
  }

  return [...best.values()];
}

function rankImages(images: readonly ImageAsset[]): RankedImages {
  const byRole = (role: ImageAsset['role']): ImageAsset[] =>
    images.filter((image) => image.role === role).sort((a, b) => imageScore(b) - imageScore(a));

  const logo = byRole('logo')[0] ?? null;
  const favicon = byRole('favicon')[0] ?? null;
  const heroCandidates = byRole('hero');
  const gallery = byRole('gallery');

  // Nothing was tagged as a hero, but a site with photographs has one: the
  // largest gallery image is the honest stand-in, and its `role` still records
  // that it was found as a gallery image.
  const hero = heroCandidates[0] ?? gallery[0] ?? null;

  return {
    logo,
    favicon,
    hero,
    gallery: gallery.filter((image) => image.url !== hero?.url),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validate(profile: Omit<BusinessProfile, 'validation'>): ValidationReport {
  const issues: ValidationIssue[] = [];

  const require = (field: string, present: boolean, message: string): void => {
    if (!present) issues.push({ field, severity: 'error', message });
  };
  const expect = (field: string, present: boolean, message: string): void => {
    if (!present) issues.push({ field, severity: 'warning', message });
  };

  // Errors are things a website cannot be built without.
  require('name', profile.name.value.trim().length > 0, 'Business name is empty');
  require(
    'location',
    profile.address !== null || profile.coordinates !== null,
    'No address and no coordinates: the site cannot say where the business is',
  );
  require(
    'contact',
    profile.phones.length > 0 || profile.emails.length > 0,
    'No phone and no email: visitors would have no way to get in touch',
  );

  // Warnings are things that make a weaker site, not an impossible one.
  expect('website', profile.website !== null, 'No website found on the listing');
  expect('category', profile.category !== null, 'No category, so the site has no stated trade');
  expect('hours', profile.hours.length > 0, 'No opening hours');
  expect('images.logo', profile.images.logo !== null, 'No logo found');
  expect('images.hero', profile.images.hero !== null, 'No hero image found');
  expect('images.gallery', profile.images.gallery.length > 0, 'No gallery images found');
  expect('pages', profile.pages.length > 0, 'No page text collected');
  expect('services', profile.services.length > 0, 'No services identified');

  return { ok: issues.every((issue) => issue.severity !== 'error'), issues };
}

/* ------------------------------------------------------------------ */
/* Merge                                                               */
/* ------------------------------------------------------------------ */

/** Identical copy served on two URLs is one page. */
function dedupePages(pages: readonly PageText[]): PageText[] {
  const seen = new Map<string, PageText>();
  for (const page of pages) {
    const key = crypto.createHash('sha1').update(page.text.trim()).digest('hex');
    if (!seen.has(key)) seen.set(key, page);
  }
  return [...seen.values()];
}

function dedupeNavigation(links: readonly NavigationLink[]): NavigationLink[] {
  const seen = new Map<string, NavigationLink>();
  for (const link of links) {
    const key = `${link.label.toLowerCase()}|${urlIdentity(link.href)}`;
    if (!seen.has(key)) {
      seen.set(key, { ...link, href: normalizeUrl(link.href) ?? link.href });
    }
  }
  return [...seen.values()];
}

/**
 * Collapses attributes that say the same thing, available ones first.
 *
 * Ordering matters downstream: the writer reads a truncated list, and the
 * facts a business *has* are worth more of that budget than the ones it has
 * not. Nothing is dropped for being unavailable — a writer needs to see
 * "Pool: no" in order not to write about the pool.
 */
function dedupeAttributes(attributes: readonly BusinessAttribute[]): BusinessAttribute[] {
  const seen = new Map<string, BusinessAttribute>();
  for (const attribute of attributes) {
    const key = attribute.label.trim().toLowerCase();
    const existing = seen.get(key);
    // Where a listing states both, the negative wins: claiming an amenity that
    // is not there is the more expensive mistake.
    if (!existing || (existing.available && !attribute.available)) seen.set(key, attribute);
  }
  return [...seen.values()].sort(
    (a, b) => Number(b.available) - Number(a.available) || a.group.localeCompare(b.group),
  );
}

/**
 * The first source that has an answer at all, attributed.
 *
 * Sources are passed in authority order and `null` means "did not know", which
 * is not the same as "said no" — a source with nothing to say must never
 * outrank one that answered. Collapses the repeated
 * `x !== null ? chooseBest([candidate(x, …)]) : null` shape that reading two
 * sources for one scalar would otherwise multiply across the assembly.
 */
function firstAttributed<T>(
  values: readonly (T | null)[],
  toCandidate: (value: T) => AttributedValue<T>,
): Attributed<T> | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return chooseBest([toCandidate(value)], () => 0);
  }
  return null;
}

/**
 * Opening hours from several sources, resolved day by day.
 *
 * Not "the longer list wins": a source that knows Sunday and a source that
 * knows Saturday should produce a business open on both, and picking one list
 * wholesale would silently discard a day the platform had been told about.
 *
 * The seven-day trust signal depends on this being a union rather than a
 * choice — seven distinct days is what "Open seven days a week" is allowed to
 * mean, and no single source has ever supplied seven.
 */
function mergeHours(...sources: readonly (readonly OpeningHours[])[]): readonly OpeningHours[] {
  const byDay = new Map<number, OpeningHours>();
  for (const source of sources) {
    for (const entry of source) {
      const day = canonicalDay(entry.dayOfWeek);
      if (day === null) continue;
      if (!byDay.has(day)) byDay.set(day, { ...entry, dayOfWeek: day });
    }
  }
  return [...byDay.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/**
 * Forces a weekday into the 0 = Sunday range `OpeningHours` documents.
 *
 * ISO-8601 numbers Sunday **7**, and a source that follows it reaches the
 * renderer as a day nothing recognises: `hourBullets` walks Monday–Saturday and
 * silently drops it, so a business open all week publishes "Monday to Saturday"
 * — while `trustSignals`, which only counts distinct days, prints "Open seven
 * days a week" in the same first screen. River Park Events shipped with exactly
 * that contradiction, and both halves were derived from the same true data.
 *
 * A day outside 0–7 is discarded rather than guessed: an unknown index is not a
 * day, and inventing one would publish a time the business never stated.
 */
function canonicalDay(dayOfWeek: number): number | null {
  if (!Number.isInteger(dayOfWeek)) return null;
  if (dayOfWeek === 7) return 0;
  return dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : null;
}

/**
 * Attribute labels that are really a statement of what kind of place this is.
 *
 * Deliberately narrow. A hotel listing carries no category button — which is
 * how "Add website" became the benchmark hotel's category — but its About tab
 * says "3-star hotel", which is the category, stated by the listing, in the
 * listing's own words.
 *
 * Anything that does not name a place type is left alone. The cost of missing
 * one is a `null` category, which every consumer already handles; the cost of a
 * false positive is a wrong trade on the front of a real business's website.
 */
const CATEGORY_ATTRIBUTE =
  /\b(hotel|motel|inn|hostel|resort|guest house|restaurant|cafe|café|bakery|bar|pub|shop|store|boutique|clinic|dentist|salon|spa|barber|gym|garage)\b/i;

/**
 * The business category, from the listing's category line or — when it has none
 * — from what the listing says about itself.
 */
function categoryFor(
  discovery: DiscoveryResult,
  collected: CollectedBusiness,
  mapsUrl: string,
): Attributed<string> | null {
  if (discovery.category) {
    return chooseBest([candidate(discovery.category, 'maps', mapsUrl)], () => 0);
  }

  const stated = collected.attributes.find(
    (attribute) => attribute.available && CATEGORY_ATTRIBUTE.test(attribute.label),
  );
  if (stated === undefined) return null;

  return chooseBest([candidate(stated.label, 'maps', stated.sourceUrl)], () => 0);
}

/** Punctuation and spacing removed, for comparing a label to a URL slug. */
function slugOf(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * True when a "service" is really the heading above the services.
 *
 * Paradise Dental Care's page opened its service grid with **"Services"** and
 * **"Dental Services"**, followed by the eight real treatments. Both are page
 * furniture that the harvester could not distinguish from content, and both
 * reached the finished page — the same failure class as the hotel whose
 * category was the Maps button "Add website".
 *
 * Two mechanical signals, and deliberately no vocabulary list. A hard-coded set
 * of banned words would have to guess at every trade in the world and would
 * eventually delete a real service called "Emergency Care":
 *
 * - **The name is the page it came from.** "Dental Services" was scraped from
 *   `/dental-services`. A list item that repeats the title of its own page is
 *   the heading of that list.
 * - **The name is a navigation label.** "Services" is in the site's own menu.
 *   A menu entry is a route, not something a customer can buy.
 *
 * Both compare stripped of punctuation, so "Dental Services" matches
 * `dental-services` and "Crowns & Bridges" matches nothing.
 */
function isSectionHeading(service: ServiceItem, navigation: readonly NavigationLink[]): boolean {
  const name = slugOf(service.name);
  if (name === '') return true;

  try {
    const path = new URL(service.sourceUrl).pathname;
    const last = path.split('/').filter((part) => part !== '').at(-1);
    if (last !== undefined && slugOf(last) === name) return true;
  } catch {
    // A source that is not a parseable URL simply contributes no signal.
  }

  return navigation.some((link) => slugOf(link.label) === name);
}

function dedupeServices(
  services: readonly ServiceItem[],
  navigation: readonly NavigationLink[],
): ServiceItem[] {
  const seen = new Map<string, ServiceItem>();
  for (const service of services) {
    if (isSectionHeading(service, navigation)) continue;
    const key = service.name.trim().toLowerCase();
    const existing = seen.get(key);
    // Prefer the entry that also carries a description.
    if (!existing || (!existing.description && service.description)) seen.set(key, service);
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

export interface NormalizerInput {
  readonly discovery: DiscoveryResult;
  readonly collected: CollectedBusiness;
  /**
   * Optional richer provenance gathered alongside the harvest. When present, the
   * normalizer lifts `provenance` and `blockedSources` onto the `BusinessProfile`.
   * Absent for legacy artifacts / resumable runs that predate this field.
   */
  readonly sources?: CollectedSources | undefined;
}

export interface NormalizerAgent extends Agent<NormalizerInput, BusinessProfile> {}

export const normalizerAgent: NormalizerAgent = {
  name: NAME,
  description: 'Merges the Maps listing and the website into one canonical profile.',

  async run(input: NormalizerInput, ctx: AgentContext): Promise<BusinessProfile> {
    const { logger, config } = ctx;
    const { discovery, collected } = input;

    const mapsUrl = discovery.canonicalUrl;
    const siteUrl = collected.siteUrl;

    const name = discovery.name.trim();
    if (!name) {
      throw new InvalidInputError('Discovery produced no business name to normalise', NAME);
    }

    logger.info('normalization started', { business: name, hasWebsite: siteUrl !== null });

    /* -- name ------------------------------------------------------- */
    // The listing is authoritative; a page title is a fallback and is kept as
    // an alternative either way, since titles carry taglines worth seeing.
    const nameCandidates: AttributedValue<string>[] = [candidate(name, 'maps', mapsUrl)];
    for (const page of collected.pages) {
      const title = page.title?.trim();
      if (title) nameCandidates.push(candidate(title, 'website', page.url));
    }
    // Every page of a site tends to carry the same title; keeping seven copies
    // of it as "alternatives" is noise, not provenance.
    const resolvedName = chooseBest(
      dedupeCandidates(nameCandidates, (item) => item.value.toLowerCase(), (item) =>
        item.source === 'maps' ? 100 : 0,
      ),
      (item) => (item.source === 'maps' ? 100 : 0),
    )!;

    /* -- website ---------------------------------------------------- */
    const websiteCandidates: AttributedValue<string>[] = [];
    // Strongest evidence first: the origin the homepage actually resolved to
    // after redirects. Both recorded URLs are what somebody typed — this one
    // is what the server answers on, which is why `http://www.example.com`
    // loses to the `https://example.com` it redirects to.
    const landedUrl = collected.pages[0]?.url;
    if (landedUrl) {
      const normalized = normalizeUrl(new URL(landedUrl).origin);
      if (normalized) websiteCandidates.push(candidate(normalized, 'website', landedUrl));
    }
    if (siteUrl) {
      const normalized = normalizeUrl(siteUrl);
      if (normalized) websiteCandidates.push(candidate(normalized, 'website', siteUrl));
    }
    if (discovery.website) {
      const normalized = normalizeUrl(discovery.website);
      if (normalized) websiteCandidates.push(candidate(normalized, 'maps', mapsUrl));
    }
    const website = chooseBest(
      dedupeCandidates(websiteCandidates, (item) => urlIdentity(item.value), (item) => urlScore(item.value)),
      (item) => urlScore(item.value) + (item.source === 'website' ? 5 : 0),
    );

    /* -- address & coordinates -------------------------------------- */
    const address = discovery.address
      ? chooseBest([candidate(normalizeAddress(discovery.address), 'maps', mapsUrl)], () => 0)
      : null;
    const coordinates = discovery.coordinates
      ? chooseBest<GeoPoint>([candidate(discovery.coordinates, 'maps', mapsUrl)], () => 0)
      : null;
    const country = address?.value.country ?? null;

    /* -- phones ----------------------------------------------------- */
    const phoneCandidates: AttributedValue<PhoneNumber>[] = [];
    if (discovery.phone) {
      const phone = normalizePhone(discovery.phone, country);
      if (phone) phoneCandidates.push(candidate(phone, 'maps', mapsUrl));
    }
    for (const entry of collected.phones) {
      const phone = normalizePhone(entry.value, country);
      if (phone) phoneCandidates.push(candidate(phone, 'website', entry.sourceUrl));
    }
    const phones = dedupeCandidates(
      phoneCandidates,
      (item) => phoneIdentity(item.value),
      // A dialable number beats a prettier one.
      (item) => (item.value.e164 ? 10 : 0) + (item.source === 'maps' ? 1 : 0),
    );

    /* -- emails ----------------------------------------------------- */
    const emailCandidates: AttributedValue<string>[] = [];
    for (const entry of collected.emails) {
      const email = normalizeEmail(entry.value);
      if (email) emailCandidates.push(candidate(email, 'website', entry.sourceUrl));
    }
    const emails = dedupeCandidates(emailCandidates, (item) => item.value, () => 0);

    /* -- socials ---------------------------------------------------- */
    const socialCandidates: AttributedValue<SocialProfile>[] = [];
    for (const [platform, url] of Object.entries(discovery.socialLinks)) {
      const normalized = url ? normalizeProfileUrl(url) : null;
      if (normalized) {
        socialCandidates.push(candidate({ platform, url: normalized, sourceUrl: mapsUrl }, 'maps', mapsUrl));
      }
    }
    for (const profile of collected.socialProfiles) {
      const normalized = normalizeProfileUrl(profile.url);
      if (normalized) {
        socialCandidates.push(
          candidate({ ...profile, url: normalized }, 'website', profile.sourceUrl),
        );
      }
    }
    const socialProfiles = dedupeCandidates(
      socialCandidates,
      (item) => urlIdentity(item.value.url),
      // A business linking its own profile is better evidence than a link
      // scraped off its listing.
      (item) => urlScore(item.value.url) + (item.source === 'website' ? 5 : 0),
    );

    /* -- images ----------------------------------------------------- */
    const allImages: ImageAsset[] = [
      ...(collected.logo ? [collected.logo] : []),
      ...(collected.favicon ? [collected.favicon] : []),
      ...(collected.hero ? [collected.hero] : []),
      ...collected.gallery,
    ];
    const hashes = await contentHashes(allImages, ctx.outputDir, logger);
    const uniqueImages = dedupeImages(allImages, hashes);
    const images = rankImages(uniqueImages);

    logger.debug('images normalized', {
      before: allImages.length,
      after: uniqueImages.length,
      gallery: images.gallery.length,
    });

    /* -- assemble --------------------------------------------------- */
    const draft: Omit<BusinessProfile, 'validation'> = {
      name: resolvedName,
      category: categoryFor(discovery, collected, mapsUrl),
      address,
      coordinates,
      website,
      phones,
      emails,
      socialProfiles,
      // Content sources first, per day. Discovery reads a signed-out pane that
      // renders roughly one day; an API that answers with the week is not a
      // better guess at the same fact, it is a different quality of fact.
      hours: mergeHours(collected.listingHours, discovery.hours),
      rating: firstAttributed(
        [collected.listingRating, discovery.rating],
        (value) => candidate(value, 'maps', mapsUrl),
      ),
      // The count is the field this actually changes. A signed-out pane serves a
      // rating with no total behind it, so `ratingLine` has never been able to
      // say "from 812 reviews" and the JSON-LD has never carried an
      // `AggregateRating` — schema.org requires the count, and the platform
      // does not emit a number it cannot prove.
      reviewCount: firstAttributed(
        [collected.listingReviewCount, discovery.reviewCount],
        (value) => candidate(value, 'maps', mapsUrl),
      ),
      reviews: collected.reviews,
      navigation: dedupeNavigation(collected.navigation),
      services: dedupeServices(collected.services, collected.navigation),
      pages: dedupePages(collected.pages),
      attributes: dedupeAttributes(collected.attributes),
      description:
        collected.listingDescription !== null
          ? chooseBest([candidate(collected.listingDescription, 'maps', mapsUrl)], () => 0)
          : null,
      images,
      sources: [...new Set([mapsUrl, ...(siteUrl ? [siteUrl] : []), ...collected.sources])],
      normalizedAt: new Date().toISOString(),
      // A1: lift richer provenance onto the profile when the collector supplied it.
      // Opt-in and additive — absent for legacy/resumable runs (backfilled by
      // ARTIFACT_DEFAULTS), so no existing artifact breaks.
      provenance: input.sources?.provenance ?? {},
      blockedSources: input.sources?.blockedSources ?? [],
    };

    const profile: BusinessProfile = { ...draft, validation: validate(draft) };

    const filePath = path.join(ctx.outputDir, ARTIFACT);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');

    for (const issue of profile.validation.issues) {
      const log = issue.severity === 'error' ? logger.error : logger.warn;
      log(`validation: ${issue.message}`, { field: issue.field, severity: issue.severity });
    }

    logger.info('normalization finished', {
      valid: profile.validation.ok,
      phones: profile.phones.length,
      emails: profile.emails.length,
      socialProfiles: profile.socialProfiles.length,
      images: uniqueImages.length,
      pages: profile.pages.length,
      artifact: filePath,
    });

    return profile;
  },
};
