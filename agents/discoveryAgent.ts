/**
 * Stage 1 of 4.
 *
 * Single responsibility: turn a Google Maps URL into a resolved business
 * identity. It answers "who is this?" and nothing more — no reviews, no
 * photos, no prose. Everything downstream keys off what this returns.
 *
 * Playwright only; no LLM. Google Maps ships obfuscated class names that
 * rotate, so every field is read through an ordered list of strategies and
 * degrades to `null` rather than throwing. Only failing to resolve a listing
 * at all is fatal.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createBrowserSession, type BrowserSession, type PageHandle } from '../lib/browser.js';
import { createLogger } from '../lib/logger.js';
import { loadConfig, type AppConfig } from '../lib/config.js';
import { InvalidInputError, UpstreamError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type {
  Agent,
  AgentContext,
  DiscoveryInput,
  DiscoveryResult,
  GeoPoint,
  OpeningHours,
  SocialLinks,
} from '../lib/types.js';

const NAME = 'discoveryAgent';

/** Artifact filename written under `config.outputDir`. */
const ARTIFACT = 'discovery.json';

/** Hosts that legitimately serve a Maps listing. */
const MAPS_HOSTS = [
  /^maps\.google\.[a-z.]+$/i,
  /^(www\.)?google\.[a-z.]+$/i,
  /^maps\.app\.goo\.gl$/i,
  /^goo\.gl$/i,
  /^g\.co$/i,
];

/** Dropped from `relatedLinks` — Google's own chrome, not the business's links. */
const INTERNAL_HOST = /(^|\.)(google|gstatic|ggpht|googleusercontent|googleapis|schema)\.(com|org|[a-z.]+)$/i;

/* ------------------------------------------------------------------ */
/* URL handling                                                        */
/* ------------------------------------------------------------------ */

/**
 * Validates the input is a Maps link and pins the response language to
 * English, since every extraction strategy below matches English labels.
 */
export function normalizeMapsUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new InvalidInputError(`Not a valid URL: "${rawUrl}"`, NAME);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new InvalidInputError(`Unsupported protocol: "${url.protocol}"`, NAME);
  }

  const isMapsHost = MAPS_HOSTS.some((pattern) => pattern.test(url.hostname));
  const looksLikeMaps = isMapsHost && (url.pathname.startsWith('/maps') || url.hostname !== 'www.google.com');
  if (!looksLikeMaps) {
    throw new InvalidInputError(`Not a Google Maps URL: "${rawUrl}"`, NAME);
  }

  // Short links must be followed untouched — extra params break the redirect.
  if (url.hostname.endsWith('goo.gl') || url.hostname === 'g.co') return url.toString();

  url.searchParams.set('hl', 'en');
  return url.toString();
}

/**
 * A bare listing URL for a resolved place.
 *
 * A Maps URL reached by clicking a search result keeps its search context, and
 * Maps then renders the results feed *and* the place pane in the same DOM —
 * two `role="main"` regions, where an unscoped selector can silently read the
 * wrong business. Re-navigating here yields a single-pane page.
 */
export function buildCleanPlaceUrl(placeId: string | null): string | null {
  if (!placeId) return null;
  const query = placeId.startsWith('0x')
    ? `ftid=${encodeURIComponent(placeId)}`
    : `q=place_id:${encodeURIComponent(placeId)}`;
  return `https://www.google.com/maps/place/?${query}&hl=en`;
}

/**
 * Place coordinates. `!3d/!4d` is the marker itself; `@lat,lng` is only the
 * viewport centre, so it is a last resort.
 */
export function extractCoordinates(url: string, html: string): GeoPoint | null {
  const marker = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url) ?? /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(html);
  if (marker?.[1] && marker[2]) {
    return { lat: Number(marker[1]), lng: Number(marker[2]) };
  }

  const viewport = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url);
  if (viewport?.[1] && viewport[2]) {
    return { lat: Number(viewport[1]), lng: Number(viewport[2]) };
  }

  return null;
}

/**
 * Prefers the portable `ChIJ…` place id; falls back to the hex feature id
 * embedded in the URL, which still identifies the place uniquely.
 */
export function extractPlaceId(url: string, html: string): string | null {
  const params = new URL(url).searchParams;
  const fromQuery = params.get('place_id') ?? params.get('ftid');
  if (fromQuery) return fromQuery;

  const fromHtml = /"(ChI[A-Za-z0-9_-]{15,})"/.exec(html);
  if (fromHtml?.[1]) return fromHtml[1];

  const featureId = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(url) ?? /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(html);
  return featureId?.[1] ?? null;
}

/* ------------------------------------------------------------------ */
/* Value parsing                                                       */
/* ------------------------------------------------------------------ */

/** Maps pads labels with narrow/non-breaking spaces; normalise before parsing. */
function normalizeSpaces(value: string): string {
  return value.replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripLabelPrefix(value: string): string {
  return normalizeSpaces(value.replace(/^[A-Za-z ]+:\s*/, ''));
}

export function parseRating(value: string | null): number | null {
  if (!value) return null;
  const match = /(\d+[.,]\d+|\d+)/.exec(normalizeSpaces(value));
  if (!match?.[1]) return null;
  const rating = Number(match[1].replace(',', '.'));
  return Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : null;
}

export function parseReviewCount(value: string | null): number | null {
  if (!value) return null;
  const match = /([\d,.\s]+)/.exec(normalizeSpaces(value));
  if (!match?.[1]) return null;
  const count = Number(match[1].replace(/[,.\s]/g, ''));
  return Number.isFinite(count) && count >= 0 ? count : null;
}

/* ------------------------------------------------------------------ */
/* Opening hours                                                       */
/* ------------------------------------------------------------------ */

const DAY_INDEX: Readonly<Record<string, number>> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

interface Clock {
  readonly hour: number;
  readonly minute: number;
  readonly meridiem: 'am' | 'pm' | null;
}

function parseClock(token: string): Clock | null {
  const value = normalizeSpaces(token).toLowerCase();
  if (value === 'noon') return { hour: 12, minute: 0, meridiem: null };
  if (value === 'midnight') return { hour: 0, minute: 0, meridiem: null };

  const match = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(value);
  if (!match?.[1]) return null;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour > 24 || minute > 59) return null;

  const suffix = match[3]?.replace(/\./g, '');
  return {
    hour,
    minute,
    meridiem: suffix === 'am' || suffix === 'pm' ? suffix : null,
  };
}

function toHHmm(clock: Clock, inherited: 'am' | 'pm' | null): string {
  const meridiem = clock.meridiem ?? inherited;
  let hour = clock.hour;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  return `${String(hour % 24).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
}

/**
 * Parses one day's hours, e.g. `"9 AM to 5 PM"`, `"11 AM to 2 PM, 5 to 9 PM"`,
 * `"Open 24 hours"`, `"Closed"`.
 *
 * A missing meridiem on the opening time inherits the closing one — Google
 * only omits it when both halves share a meridiem (`"5 to 9 PM"`).
 */
export function parseDayHours(spec: string, dayOfWeek: number): OpeningHours[] {
  const value = normalizeSpaces(spec).toLowerCase();
  if (!value || value.includes('closed')) return [];
  if (value.includes('24 hours')) return [{ dayOfWeek, opens: '00:00', closes: '23:59' }];

  const ranges: OpeningHours[] = [];
  for (const chunk of value.split(',')) {
    // Maps writes both `9 AM to 5 PM` and `7:30 am–6 pm`; the dash carries no
    // surrounding spaces, so it cannot be matched the same way as the words.
    const halves = chunk.split(/\s+(?:to|until)\s+|\s*[–—]\s*|\s+-\s+/);
    if (halves.length !== 2) continue;

    const opensAt = parseClock(halves[0] ?? '');
    const closesAt = parseClock(halves[1] ?? '');
    if (!opensAt || !closesAt) continue;

    ranges.push({
      dayOfWeek,
      opens: toHHmm(opensAt, closesAt.meridiem),
      closes: toHHmm(closesAt, opensAt.meridiem),
    });
  }
  return ranges;
}

/**
 * Parses the week summary Maps exposes as an aria-label:
 * `"Sunday, Closed; Monday, 9 AM to 5 PM; …"`.
 */
export function parseWeekHours(label: string): OpeningHours[] {
  const hours: OpeningHours[] = [];
  for (const segment of normalizeSpaces(label).split(';')) {
    // Row labels carry a trailing action, e.g. "…, Copy open hours".
    const spec = segment.replace(/,\s*(?:copy|suggest)[^,]*$/i, '');
    const match = /^\s*([A-Za-z]+)\s*,\s*(.+)$/.exec(spec);
    if (!match?.[1] || !match[2]) continue;

    const dayOfWeek = DAY_INDEX[match[1].toLowerCase()];
    if (dayOfWeek === undefined) continue;

    hours.push(...parseDayHours(match[2], dayOfWeek));
  }
  return hours;
}

/** Collapses duplicates produced by overlapping extraction strategies. */
function dedupeHours(hours: readonly OpeningHours[]): OpeningHours[] {
  const seen = new Map<string, OpeningHours>();
  for (const entry of hours) {
    seen.set(`${entry.dayOfWeek}|${entry.opens}|${entry.closes}`, entry);
  }
  return [...seen.values()].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.opens.localeCompare(b.opens),
  );
}

/* ------------------------------------------------------------------ */
/* External links                                                      */
/* ------------------------------------------------------------------ */

/** Profile URLs only — share widgets, tracking pixels and posts are not profiles. */
const SOCIAL_PATTERNS: Readonly<Record<keyof SocialLinks, RegExp>> = {
  instagram: /^https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel|reels|explore|stories)[A-Za-z0-9_.]+\/?$/i,
  facebook: /^https?:\/\/(?:www\.|web\.|m\.|business\.)?facebook\.com\/(?!tr|sharer|share|dialog|plugins|profile\.php\?)[A-Za-z0-9_.\-]+\/?$/i,
  tiktok: /^https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+\/?$/i,
};

function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function detectSocialLinks(candidates: readonly string[]): SocialLinks {
  const found: Record<keyof SocialLinks, string | null> = {
    instagram: null,
    facebook: null,
    tiktok: null,
  };

  for (const candidate of candidates) {
    const cleaned = stripTracking(candidate);
    for (const platform of Object.keys(found) as (keyof SocialLinks)[]) {
      if (found[platform] === null && SOCIAL_PATTERNS[platform].test(cleaned)) {
        found[platform] = cleaned;
      }
    }
  }

  return found;
}

function isExternalLink(href: string): boolean {
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return !INTERNAL_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Page extraction                                                     */
/* ------------------------------------------------------------------ */

/** Returns the first non-empty result from an ordered list of strategies. */
async function firstOf(
  strategies: readonly (() => Promise<string | null>)[],
): Promise<string | null> {
  for (const strategy of strategies) {
    try {
      const value = await strategy();
      if (value) return value;
    } catch {
      // A selector that no longer exists is expected; fall through.
    }
  }
  return null;
}

async function extractName(page: PageHandle): Promise<string | null> {
  const name = await firstOf([
    () => page.text('h1.DUwDvf'),
    () => page.text('div[role="main"] h1'),
    () => page.attribute('div[role="main"]', 'aria-label'),
    () => page.text('h1'),
  ]);
  if (!name) return null;

  const cleaned = normalizeSpaces(name);
  // Maps renders a hidden "Results" heading on search pages.
  return cleaned && cleaned.toLowerCase() !== 'results' ? cleaned : null;
}

async function extractCategory(page: PageHandle): Promise<string | null> {
  const category = await firstOf([
    () => page.text('button[jsaction*="category"]'),
    () => page.text('button.DkEaL'),
    () => page.text('.DkEaL'),
  ]);
  return category ? normalizeSpaces(category) : null;
}

async function extractAddress(page: PageHandle): Promise<string | null> {
  const address = await firstOf([
    () => page.attribute('button[data-item-id="address"]', 'aria-label'),
    () => page.text('button[data-item-id="address"] div.Io6YTe'),
    () => page.text('button[data-item-id="address"]'),
  ]);
  return address ? stripLabelPrefix(address) : null;
}

async function extractPhone(page: PageHandle): Promise<string | null> {
  // The tel: URI is the machine-readable form; prefer it over the label.
  const itemId = await page.attribute('button[data-item-id^="phone:tel:"]', 'data-item-id');
  if (itemId?.includes('tel:')) {
    const [, number] = itemId.split('tel:');
    if (number) return normalizeSpaces(number);
  }

  const label = await firstOf([
    () => page.attribute('button[data-item-id^="phone"]', 'aria-label'),
    () => page.text('button[data-item-id^="phone"] div.Io6YTe'),
  ]);
  return label ? stripLabelPrefix(label) : null;
}

async function extractWebsite(page: PageHandle): Promise<string | null> {
  const href = await firstOf([
    () => page.attribute('a[data-item-id="authority"]', 'href'),
    () => page.attribute('a[aria-label^="Website"]', 'href'),
  ]);
  return href && isExternalLink(href) ? href : null;
}

async function extractRating(page: PageHandle): Promise<number | null> {
  return parseRating(
    await firstOf([
      () => page.attribute('div.F7nice span[role="img"]', 'aria-label'),
      () => page.attribute('span[role="img"][aria-label*="star"]', 'aria-label'),
      () => page.text('div.F7nice span[aria-hidden="true"]'),
      () => page.text('div.F7nice'),
    ]),
  );
}

async function extractReviewCount(page: PageHandle): Promise<number | null> {
  const label = await firstOf([
    () => page.attribute('div.F7nice span[aria-label*="review"]', 'aria-label'),
    () => page.attribute('[aria-label$="reviews"]', 'aria-label'),
    () => page.attribute('button[jsaction*="reviewChart"]', 'aria-label'),
  ]);
  if (label) return parseReviewCount(label);

  // Fallback: the rating summary reads "4.5(1,234)".
  const summary = await page.text('div.F7nice');
  const bracketed = summary ? /\(([\d,.\s]+)\)/.exec(normalizeSpaces(summary)) : null;
  return parseReviewCount(bracketed?.[1] ?? null);
}

/**
 * Reads the hours table.
 *
 * The pane opens showing today only, with the rest of the week behind a
 * toggle. The toggle is absent in some Maps variants, so expanding is
 * best-effort and whatever rows are present get read either way — a listing
 * that yields one day is a thin result, not a failure.
 */
async function extractHours(page: PageHandle): Promise<OpeningHours[]> {
  for (const selector of ['[aria-label*="Show open hours"]', 'div[jsaction*="openhours"]']) {
    try {
      if (await page.exists(selector)) {
        await page.click(selector, { timeoutMs: 5_000 });
        await page.wait(1_000);
        break;
      }
    } catch {
      // Not expandable in this variant; read what is rendered.
    }
  }

  const hours: OpeningHours[] = [];

  // Each row's copy button labels itself "Thursday, 7:30 am to 6 pm, Copy open
  // hours" — day and times in one string, and always with the "to" separator.
  for (const label of await page.attributeAll('button[aria-label*="Copy open hours"]', 'aria-label')) {
    hours.push(...parseWeekHours(label));
  }

  // Whole-week summary, where Maps renders one.
  if (hours.length === 0) {
    const summary = await firstOf([
      () => page.attribute('div.t39EBf[aria-label]', 'aria-label'),
      () => page.attribute('[aria-label*="Hide open hours"]', 'aria-label'),
    ]);
    if (summary) hours.push(...parseWeekHours(summary));
  }

  // Last resort: the table read as two parallel columns.
  if (hours.length === 0) {
    const days = await page.textAll('table tr.y0skZc td.ylH6lf');
    const times = await page.attributeAll('table tr.y0skZc td.mxowUb', 'aria-label');
    const fallbackTimes = times.length > 0 ? times : await page.textAll('table tr.y0skZc td.mxowUb');
    for (let i = 0; i < Math.min(days.length, fallbackTimes.length); i += 1) {
      const dayOfWeek = DAY_INDEX[normalizeSpaces(days[i] ?? '').toLowerCase()];
      if (dayOfWeek === undefined) continue;
      hours.push(...parseDayHours(fallbackTimes[i] ?? '', dayOfWeek));
    }
  }

  return dedupeHours(hours);
}

async function extractLinks(page: PageHandle): Promise<string[]> {
  const hrefs = await page.attributeAll('a[href]', 'href');
  return [...new Set(hrefs.filter(isExternalLink))];
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Declines the EU consent interstitial when it appears. Only ever rejects —
 * this agent does not accept terms on anybody's behalf.
 */
async function declineConsent(page: PageHandle, logger: Logger): Promise<void> {
  if (!page.url().includes('consent.google.')) return;

  logger.info('consent interstitial detected, declining non-essential cookies');
  const rejectSelectors = [
    'button[aria-label*="Reject all"]',
    'button:has-text("Reject all")',
    'form[action*="consent"] button:has-text("Reject")',
  ];

  for (const selector of rejectSelectors) {
    try {
      if (!(await page.exists(selector))) continue;
      await page.click(selector, { timeoutMs: 5_000 });

      // Rejecting submits a form and redirects back to the original URL. That
      // round trip has to complete before anything looks for the listing.
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (!page.url().includes('consent.google.')) return;
        await page.wait(500);
      }
    } catch {
      // Try the next selector.
    }
  }
  logger.warn('could not dismiss consent interstitial', { url: page.url() });
}

/**
 * Waits for the place pane. A Maps link can resolve to a result list rather
 * than a single place; in that case the first result is opened.
 */
async function openPlacePane(page: PageHandle, logger: Logger): Promise<void> {
  // A results feed renders its own <h1>, so the heading alone cannot tell the
  // two apart; the detail rows only ever exist on a place pane.
  const paneSelector = 'h1.DUwDvf, button[data-item-id]';
  const feedResultSelector = 'div[role="feed"] a[href*="/maps/place/"]';

  await page
    .waitForSelector(`${paneSelector}, ${feedResultSelector}`, { timeoutMs: 20_000 })
    .catch(() => undefined);

  if (!(await page.exists(paneSelector)) && (await page.exists(feedResultSelector))) {
    logger.info('url resolved to a result list, opening the first result');
    await page.click(feedResultSelector);
  }

  try {
    await page.waitForSelector(paneSelector, { timeoutMs: 20_000 });
  } catch {
    throw new UpstreamError('No Maps listing rendered for this URL', {
      source: NAME,
      status: undefined,
      retryable: true,
    });
  }

  // Detail rows hydrate after the heading; absence is fine, so failure is not.
  await page
    .waitForSelector('button[data-item-id], div.F7nice', { timeoutMs: 8_000 })
    .catch(() => undefined);
  await page.wait(750);
}

/**
 * Waits for Maps to rewrite the address bar to `/maps/place/…`.
 *
 * The rewrite lands after the pane renders, and it is what carries the place
 * id and the marker coordinates — reading the URL too early loses both.
 */
async function waitForPlaceUrl(page: PageHandle, logger: Logger): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (page.url().includes('/maps/place/')) return page.url();
    await page.wait(500);
  }
  logger.warn('url never resolved to a place path', { url: page.url() });
  return page.url();
}

/* ------------------------------------------------------------------ */
/* Artifact                                                            */
/* ------------------------------------------------------------------ */

async function writeArtifact(ctx: AgentContext, result: DiscoveryResult): Promise<string> {
  const filePath = path.join(ctx.config.outputDir, ARTIFACT);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return filePath;
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

export interface DiscoveryAgent extends Agent<DiscoveryInput, DiscoveryResult> {}

export const discoveryAgent: DiscoveryAgent = {
  name: NAME,
  description: 'Resolves a Google Maps URL into a canonical business identity.',

  async run(input: DiscoveryInput, ctx: AgentContext): Promise<DiscoveryResult> {
    const { logger } = ctx;
    const targetUrl = normalizeMapsUrl(input.mapsUrl);
    logger.info('discovery started', { mapsUrl: input.mapsUrl });

    const session = await ctx.getBrowser();

    const result = await session.withPage(async (page) => {
      const canonicalUrl = await logger.time('resolve listing', async () => {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await declineConsent(page, logger);

        try {
          await openPlacePane(page, logger);
        } catch (error) {
          // A URL carrying a stale or malformed `data=` payload renders an
          // empty pane. When it still names a place, the bare listing URL
          // resolves it.
          const fallbackUrl = buildCleanPlaceUrl(extractPlaceId(targetUrl, ''));
          if (!fallbackUrl) throw error;

          logger.warn('listing did not render, retrying via bare place url', { fallbackUrl });
          await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded' });
          await declineConsent(page, logger);
          await openPlacePane(page, logger);
        }

        return waitForPlaceUrl(page, logger);
      });

      ctx.signal.throwIfAborted();

      // The place id and coordinates live in the resolved URL, so they are read
      // before navigating away from it.
      const placeId = extractPlaceId(canonicalUrl, '');
      let coordinates = extractCoordinates(canonicalUrl, '') ?? extractCoordinates(targetUrl, '');

      const cleanUrl = buildCleanPlaceUrl(placeId);
      if (cleanUrl) {
        await logger.time('open canonical listing', async () => {
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded' });
          await openPlacePane(page, logger);
        });
      } else if (!page.url().includes('hl=en')) {
        // No place id to canonicalise through; at least pin the language, since
        // every extraction strategy below matches English labels.
        await page.goto(normalizeMapsUrl(page.url()), { waitUntil: 'domcontentloaded' });
        await openPlacePane(page, logger);
      }

      const html = await page.html();
      coordinates ??= extractCoordinates(page.url(), html);

      const [name, category, address, phone, website, rating, reviewCount, hours, links] =
        await Promise.all([
          extractName(page),
          extractCategory(page),
          extractAddress(page),
          extractPhone(page),
          extractWebsite(page),
          extractRating(page),
          extractReviewCount(page),
          extractHours(page),
          extractLinks(page),
        ]);

      if (!name) {
        throw new UpstreamError('Could not read a business name from the listing', {
          source: NAME,
          status: undefined,
          retryable: true,
        });
      }

      const socialLinks = detectSocialLinks(website ? [website, ...links] : links);
      const socialUrls = new Set(Object.values(socialLinks).filter((url): url is string => url !== null));

      const discovery: DiscoveryResult = {
        sourceUrl: input.mapsUrl,
        canonicalUrl,
        placeId: placeId ?? extractPlaceId(page.url(), html),
        name,
        category,
        address,
        phone,
        website,
        coordinates,
        rating,
        reviewCount,
        hours,
        socialLinks,
        relatedLinks: links.filter((url) => url !== website && !socialUrls.has(stripTracking(url))),
        discoveredAt: new Date().toISOString(),
      };

      // Missing fields are normal; surfacing which ones is what makes a thin
      // result debuggable without re-running the scrape.
      const missing = (Object.keys(discovery) as (keyof DiscoveryResult)[]).filter((key) => {
        const value = discovery[key];
        return value === null || (Array.isArray(value) && value.length === 0);
      });
      if (missing.length > 0) logger.warn('fields not found on listing', { missing });

      return discovery;
    });

    const artifactPath = await writeArtifact(ctx, result);
    logger.info('discovery finished', {
      name: result.name,
      placeId: result.placeId,
      rating: result.rating,
      reviewCount: result.reviewCount,
      hoursDays: new Set(result.hours.map((entry) => entry.dayOfWeek)).size,
      artifact: artifactPath,
    });

    return result;
  },
};

/* ------------------------------------------------------------------ */
/* Standalone entry point                                              */
/* ------------------------------------------------------------------ */

/**
 * Runs discovery on its own, owning the browser for the call: launches
 * Chromium, runs the agent, and closes the browser on every path.
 *
 * Used by `main.ts --discovery-only`. In the full pipeline the orchestrator
 * owns the session instead and the agent borrows it.
 */
export async function discoverStandalone(
  mapsUrl: string,
  config: AppConfig = loadConfig(),
): Promise<DiscoveryResult> {
  const runId = randomUUID().slice(0, 8);
  const logger = createLogger({
    level: config.logLevel,
    scope: `discovery.${runId}`,
    baseFields: { runId },
  });

  const controller = new AbortController();
  const onInterrupt = (): void => controller.abort();
  process.once('SIGINT', onInterrupt);

  // Opened on first use, so a rejected URL never costs a browser launch.
  const browser: { session: Promise<BrowserSession> | null } = { session: null };

  try {
    return await discoveryAgent.run(
      { mapsUrl },
      {
        runId,
        config,
        logger: logger.child(NAME),
        getBrowser: () => {
          browser.session ??= createBrowserSession({
            config: config.browser,
            logger: logger.child('browser'),
            signal: controller.signal,
          });
          return browser.session;
        },
        outputDir: config.outputDir,
        signal: controller.signal,
      },
    );
  } finally {
    if (browser.session) await (await browser.session).close();
    process.removeListener('SIGINT', onInterrupt);
  }
}
