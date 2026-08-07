/**
 * Stage 2 of 4.
 *
 * Single responsibility: gather raw facts from the business's own website.
 * It collects; it never interprets, summarises, or writes. Every string it
 * returns was present on a page verbatim, and every one carries the URL it
 * came from — a writer that cannot cite a fact must not use it.
 *
 * Playwright only, on the session the orchestrator already opened; no LLM.
 * Partial failure is normal: a dead page, a blocked image or a site with no
 * contact details thins the result rather than failing the run. Only a listing
 * with no website at all short-circuits, and that is not an error either.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { BrowserSession, PageHandle } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';
import type { CollectorConfig } from '../lib/config.js';
import type {
  Agent,
  AgentContext,
  CollectedBusiness,
  ContactPoint,
  DiscoveryResult,
  ImageAsset,
  ImageRole,
  NavigationLink,
  PageText,
  ServiceItem,
  SocialProfile,
} from '../lib/types.js';

const NAME = 'collectorAgent';

const ARTIFACT_JSON = 'collector.json';
const ARTIFACT_TEXT = 'content.md';

/** Recognised social hosts, longest-prefix first so `web.facebook` still matches. */
const SOCIAL_HOSTS: readonly (readonly [string, RegExp])[] = [
  ['instagram', /(^|\.)instagram\.com$/i],
  ['facebook', /(^|\.)facebook\.com$/i],
  ['tiktok', /(^|\.)tiktok\.com$/i],
  ['x', /(^|\.)(twitter|x)\.com$/i],
  ['linkedin', /(^|\.)linkedin\.com$/i],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/i],
  ['pinterest', /(^|\.)pinterest\.[a-z.]+$/i],
  ['yelp', /(^|\.)yelp\.[a-z.]+$/i],
];

/**
 * Paths on a social host that are not the business's profile.
 *
 * Cookie banners and footers link to `facebook.com/policy.php` and
 * `tiktok.com/legal/privacy-policy` on nearly every site; without this the
 * generated website would list a privacy policy as the client's Facebook page.
 */
const NON_PROFILE_PATH = /\b(legal|policy|policies|privacy|terms|cookies?|help|support|sharer?|share|dialog|plugins|intent|login|signup|business|developers?)\b/i;

/** Accessibility affordances that are markup, not navigation. */
const SKIP_LINK = /^(skip|jump)\s+(to|nav)/i;

/** Pages and headings that tend to enumerate what a business offers. */
const SERVICE_HINT = /\b(services?|treatments?|menu|products?|offerings?|what\s+we\s+(do|offer)|packages?|classes|courses)\b/i;

/** Substrings that mark an image as branding rather than content. */
const LOGO_HINT = /\b(logo|brand|wordmark)\b/i;
const HERO_HINT = /\b(hero|banner|masthead|jumbotron|slider|cover)\b/i;

/** File extensions worth downloading; anything else is markup or tracking. */
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)(\?|#|$)/i;

/** Non-content pages: crawling them wastes the page budget. */
const SKIP_PATH = /\b(privacy|terms|cookie|legal|login|signin|sign-in|register|cart|checkout|account|wp-admin|feed|rss)\b/i;

/**
 * Bot-check interstitials. These are recorded and skipped, never solved — the
 * point is to keep "Let's confirm you are human" out of the writer's input,
 * where it would become the business's website copy.
 */
const VERIFICATION_WALL =
  /\b(confirm you are (?:a )?human|verify you are (?:a )?human|human verification|checking your browser|attention required|enable javascript and cookies|complete the security check|unusual traffic|are you a robot)\b/i;

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Deliberately conservative: 9+ digits, so dates and order numbers do not match. */
const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/g;

/* ------------------------------------------------------------------ */
/* URLs                                                                */
/* ------------------------------------------------------------------ */

function toAbsolute(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Compares registrable-ish hosts so `www.x.com` and `x.com` count as one site. */
function sameSite(a: string, b: string): boolean {
  try {
    const strip = (value: string): string => new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
    return strip(a) === strip(b);
  } catch {
    return false;
  }
}

function normalizeSiteUrl(website: string): string | null {
  try {
    const url = new URL(website);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Trailing-slash and fragment differences are the same page. */
function dedupeKey(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

function tidy(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

/** Collapses runs of blank lines without touching the words themselves. */
function tidyBlock(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/* ------------------------------------------------------------------ */
/* Per-page harvest                                                    */
/* ------------------------------------------------------------------ */

interface RawImage {
  readonly url: string;
  readonly alt: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly role: ImageRole;
  readonly sourceUrl: string;
}

interface PageHarvest {
  readonly page: PageText;
  readonly images: readonly RawImage[];
  readonly navigation: readonly NavigationLink[];
  readonly links: readonly string[];
  readonly services: readonly ServiceItem[];
  readonly emails: readonly ContactPoint[];
  readonly phones: readonly ContactPoint[];
  readonly socialProfiles: readonly SocialProfile[];
}

function parseSize(value: string | null): number | null {
  if (!value) return null;
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : null;
}

/**
 * Assigns each image a role from where it sits and what it is called.
 *
 * These are hints, not certainties — `role` says why the image was picked, so
 * a wrong guess stays visible downstream instead of silently becoming the
 * site's logo.
 */
async function harvestImages(page: PageHandle, pageUrl: string): Promise<RawImage[]> {
  const seen = new Set<string>();
  const images: RawImage[] = [];

  const push = (
    rawUrl: string | null | undefined,
    role: ImageRole,
    record?: Record<string, string | null>,
  ): void => {
    const url = toAbsolute(rawUrl, pageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({
      url,
      alt: tidy(record?.['alt']),
      width: parseSize(record?.['naturalWidth'] ?? record?.['width'] ?? null),
      height: parseSize(record?.['naturalHeight'] ?? record?.['height'] ?? null),
      role,
      sourceUrl: pageUrl,
    });
  };

  /** Lazy images leave `src` empty or on a placeholder until they scroll in. */
  const bestSource = (record: Record<string, string | null>): string | null => {
    const src = record['src'];
    if (src && !src.startsWith('data:')) return src;
    const candidate = record['srcset'] ?? record['data-src'] ?? record['data-lazy-src'];
    return candidate?.split(',')[0]?.trim().split(/\s+/)[0] ?? null;
  };

  const imageFields = ['src', 'srcset', 'data-src', 'data-lazy-src', 'alt', 'naturalWidth', 'naturalHeight'];
  const addAll = async (selector: string, role: ImageRole): Promise<void> => {
    for (const record of await page.fieldsAll(selector, imageFields)) {
      push(bestSource(record), role, record);
    }
  };

  /** `background-image` can hold several layers and gradients; take the URLs. */
  const addBackgrounds = async (selector: string, role: ImageRole): Promise<void> => {
    for (const value of await page.computedStyleAll(selector, 'background-image')) {
      for (const match of value.matchAll(/url\((['"]?)(.*?)\1\)/g)) {
        push(match[2], role);
      }
    }
  };

  // Order matters: the first role an image matches is the one it keeps.
  for (const record of await page.fieldsAll(
    'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    ['href'],
  )) {
    push(record['href'], 'favicon');
  }

  await addAll(
    'header img[class*="logo" i], img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i], [class*="logo" i] img',
    'logo',
  );
  await addBackgrounds('header [class*="logo" i], [class*="logo" i]', 'logo');

  await addAll('[class*="hero" i] img, [class*="banner" i] img, [id*="hero" i] img, header img', 'hero');
  await addBackgrounds(
    'header, [class*="hero" i], [class*="banner" i], [class*="cover" i], [id*="hero" i]',
    'hero',
  );

  await addAll('img[src], img[srcset], img[data-src]', 'gallery');
  // Modern sites put most photography in CSS rather than <img>.
  await addBackgrounds('main div, section div, figure, li, a, div[class], section', 'gallery');

  return images;
}

async function harvestLinks(
  page: PageHandle,
  pageUrl: string,
  siteUrl: string,
): Promise<{ navigation: NavigationLink[]; links: string[]; socialProfiles: SocialProfile[] }> {
  const navigation: NavigationLink[] = [];
  const navSeen = new Set<string>();

  for (const record of await page.fieldsAll('nav a[href], header a[href], [role="navigation"] a[href]', ['href', 'textContent'])) {
    const href = toAbsolute(record['href'], pageUrl);
    const label = tidy(record['textContent']);
    if (!href || !label || navSeen.has(href) || SKIP_LINK.test(label)) continue;
    navSeen.add(href);
    navigation.push({ label, href, internal: sameSite(href, siteUrl), sourceUrl: pageUrl });
  }

  const links: string[] = [];
  const socialProfiles: SocialProfile[] = [];
  const socialSeen = new Set<string>();

  for (const record of await page.fieldsAll('a[href]', ['href'])) {
    const href = toAbsolute(record['href'], pageUrl);
    if (!href) continue;
    links.push(href);

    const { hostname, pathname } = new URL(href);
    const match = SOCIAL_HOSTS.find(([, pattern]) => pattern.test(hostname));
    // A profile has a path and is not the platform's own legal boilerplate.
    const isProfile = pathname.replace(/\/+$/, '').length > 1 && !NON_PROFILE_PATH.test(pathname);
    if (match && isProfile && !socialSeen.has(href)) {
      socialSeen.add(href);
      socialProfiles.push({ platform: match[0], url: href, sourceUrl: pageUrl });
    }
  }

  return { navigation, links, socialProfiles };
}

/**
 * Names of services, copied verbatim.
 *
 * On a page that is *about* services, its headings and list items are the
 * offering. Elsewhere only navigation entries that name a service page count,
 * which keeps generic body copy out of the list.
 */
async function harvestServices(
  page: PageHandle,
  pageUrl: string,
  navigation: readonly NavigationLink[],
): Promise<ServiceItem[]> {
  const headings = await page.textAll('h1, h2, h3, h4');
  const looksLikeServicePage =
    SERVICE_HINT.test(new URL(pageUrl).pathname) ||
    headings.slice(0, 4).some((heading) => SERVICE_HINT.test(heading));

  const navLabels = new Set(navigation.map((link) => link.label.toLowerCase()));
  const services: ServiceItem[] = [];
  const seen = new Set<string>();

  const add = (name: string | null, description: string | null): void => {
    const value = tidy(name);
    if (!value || value.length < 2 || value.length > 90) return;
    const key = value.toLowerCase();
    // Navigation labels repeat on every page; they are chrome, not services.
    if (seen.has(key) || (looksLikeServicePage && navLabels.has(key))) return;
    seen.add(key);
    services.push({ name: value, description: tidy(description), sourceUrl: pageUrl });
  };

  if (looksLikeServicePage) {
    for (const heading of await page.textAll('h2, h3')) add(heading, null);
    for (const item of await page.textAll('main li, section li, article li')) add(item, null);
    return services;
  }

  for (const link of navigation) {
    if (SERVICE_HINT.test(link.label) || SERVICE_HINT.test(link.href)) add(link.label, null);
  }
  return services;
}

async function harvestContacts(
  page: PageHandle,
  pageUrl: string,
  visibleText: string,
): Promise<{ emails: ContactPoint[]; phones: ContactPoint[] }> {
  const emails = new Map<string, ContactPoint>();
  const phones = new Map<string, ContactPoint>();

  for (const href of await page.attributeAll('a[href^="mailto:"]', 'href')) {
    const value = tidy(decodeURIComponent(href.slice('mailto:'.length).split('?')[0] ?? ''));
    if (value) emails.set(value.toLowerCase(), { value, sourceUrl: pageUrl });
  }
  for (const match of visibleText.match(EMAIL_PATTERN) ?? []) {
    emails.set(match.toLowerCase(), { value: match, sourceUrl: pageUrl });
  }

  // `tel:` links are declared by the site; body text is inference, so it only
  // fills gaps and is keyed on digits to avoid formatting duplicates.
  for (const href of await page.attributeAll('a[href^="tel:"]', 'href')) {
    const value = tidy(decodeURIComponent(href.slice('tel:'.length)));
    if (value) phones.set(digitsOf(value), { value, sourceUrl: pageUrl });
  }
  for (const match of visibleText.match(PHONE_PATTERN) ?? []) {
    const digits = digitsOf(match);
    if (digits.length < 9 || digits.length > 15 || phones.has(digits)) continue;
    phones.set(digits, { value: match.trim(), sourceUrl: pageUrl });
  }

  return { emails: [...emails.values()], phones: [...phones.values()] };
}

async function harvestPage(
  page: PageHandle,
  pageUrl: string,
  siteUrl: string,
  logger: Logger,
): Promise<PageHarvest | null> {
  const title = tidy(await page.text('title'));
  const visibleText = tidyBlock((await page.innerText('body')) ?? '');

  // The challenge page is not the business's site. Returning nothing here is
  // what stops it being written to content.md as though it were.
  if (VERIFICATION_WALL.test(`${title ?? ''}\n${visibleText.slice(0, 2_000)}`)) {
    logger.warn('page is behind a bot-verification wall, skipping', { url: pageUrl, title });
    return null;
  }

  const images = await harvestImages(page, pageUrl);
  const { navigation, links, socialProfiles } = await harvestLinks(page, pageUrl, siteUrl);
  const services = await harvestServices(page, pageUrl, navigation);
  const { emails, phones } = await harvestContacts(page, pageUrl, visibleText);

  logger.debug('page harvested', {
    url: pageUrl,
    textLength: visibleText.length,
    images: images.length,
    navigation: navigation.length,
    services: services.length,
    emails: emails.length,
    phones: phones.length,
  });

  return {
    page: { url: pageUrl, title, text: visibleText },
    images,
    navigation,
    links,
    services,
    emails,
    phones,
    socialProfiles,
  };
}

/* ------------------------------------------------------------------ */
/* Crawl                                                               */
/* ------------------------------------------------------------------ */

/** Ranks candidate pages so the page budget is spent on content, not boilerplate. */
function rankCandidate(url: string): number {
  const pathname = new URL(url).pathname.toLowerCase();
  if (SKIP_PATH.test(pathname)) return -1;
  if (SERVICE_HINT.test(pathname)) return 4;
  // Contact and location pages carry the phone, address and hours a local
  // business publishes nowhere else, so they outrank general narrative pages.
  if (/\b(contact|locations?|visit|hours|find-us)\b/.test(pathname)) return 3;
  if (/\b(gallery|portfolio|work)\b/.test(pathname)) return 2;
  if (/\b(about|team|story)\b/.test(pathname)) return 2;
  return 1;
}

function planCrawl(
  siteUrl: string,
  harvests: readonly PageHarvest[],
  visited: ReadonlySet<string>,
  budget: number,
): string[] {
  const candidates = new Map<string, number>();

  for (const harvest of harvests) {
    for (const link of [...harvest.navigation.map((entry) => entry.href), ...harvest.links]) {
      if (!sameSite(link, siteUrl)) continue;
      const key = dedupeKey(link);
      if (visited.has(key) || candidates.has(key)) continue;
      if (IMAGE_EXTENSION.test(link) || /\.(pdf|zip|docx?|xlsx?)($|\?)/i.test(link)) continue;

      const rank = rankCandidate(link);
      if (rank > 0) candidates.set(key, rank);
    }
  }

  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, budget))
    .map(([url]) => url);
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

function extensionFor(url: string, contentType: string | null): string {
  const fromUrl = IMAGE_EXTENSION.exec(url);
  if (fromUrl?.[1]) return `.${fromUrl[1].toLowerCase().replace('jpeg', 'jpg')}`;

  const subtype = contentType?.split(';')[0]?.split('/')[1]?.toLowerCase();
  if (!subtype) return '.img';
  if (subtype === 'svg+xml') return '.svg';
  if (subtype === 'x-icon' || subtype === 'vnd.microsoft.icon') return '.ico';
  if (subtype === 'jpeg') return '.jpg';
  return `.${subtype.replace(/[^a-z0-9]/g, '')}`;
}

/** Stable, collision-free, and still recognisable in a directory listing. */
function assetFileName(url: string, role: ImageRole, contentType: string | null): string {
  const base = path.basename(new URL(url).pathname).replace(IMAGE_EXTENSION, '');
  const slug = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const digest = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
  return `${role}-${slug || 'image'}-${digest}${extensionFor(url, contentType)}`;
}

/**
 * Downloads every discovered image, skipping what is not content.
 *
 * An image that cannot be fetched is kept in the result with `localPath: null`
 * — the reference is still a fact about the site, and losing it would hide
 * that the download failed.
 */
async function downloadImages(
  images: readonly RawImage[],
  session: BrowserSession,
  config: CollectorConfig,
  outputDir: string,
  logger: Logger,
): Promise<ImageAsset[]> {
  const assetDir = path.join(outputDir, config.assetDirName);
  await fs.mkdir(assetDir, { recursive: true });

  const assets: ImageAsset[] = [];
  let downloaded = 0;

  for (const image of images) {
    const base: ImageAsset = { ...image, localPath: null, bytes: null };

    if (downloaded >= config.maxImages) {
      assets.push(base);
      continue;
    }

    try {
      const response = await session.fetchBinary(image.url);
      if (response.status >= 400) {
        logger.debug('image download rejected', { url: image.url, status: response.status });
        assets.push(base);
        continue;
      }

      const bytes = response.body.byteLength;
      // The floor exists to drop tracking pixels and spacers from the gallery.
      // Favicons and SVG logos are legitimately tiny, so it must not apply to
      // them — that is what discarded a perfectly good 345-byte favicon.
      const tooSmall = image.role === 'gallery' && bytes < config.minAssetBytes;
      if (tooSmall || bytes > config.maxAssetBytes) {
        logger.debug('image skipped on size', { url: image.url, role: image.role, bytes });
        assets.push({ ...base, bytes });
        continue;
      }

      const fileName = assetFileName(image.url, image.role, response.contentType);
      await fs.writeFile(path.join(assetDir, fileName), response.body);
      downloaded += 1;

      assets.push({
        ...base,
        localPath: path.posix.join(config.assetDirName, fileName),
        bytes,
      });
    } catch (error) {
      logger.debug('image download failed', {
        url: image.url,
        error: error instanceof Error ? error.message : String(error),
      });
      assets.push(base);
    }
  }

  logger.info('images downloaded', { discovered: images.length, saved: downloaded, assetDir });
  return assets;
}

/* ------------------------------------------------------------------ */
/* Artifacts                                                           */
/* ------------------------------------------------------------------ */

/**
 * Writes the visible text, page by page, unmodified.
 *
 * Headings and source lines are structure around the text, never a rewrite of
 * it — the body of each section is exactly what the page rendered.
 */
async function writeContentMarkdown(
  result: CollectedBusiness,
  outputDir: string,
): Promise<string> {
  const lines: string[] = [
    `# ${result.identity.name}`,
    '',
    `- Source: ${result.siteUrl ?? '(no website on the listing)'}`,
    `- Collected: ${result.collectedAt}`,
    `- Pages: ${result.pages.length}`,
    '',
  ];

  for (const page of result.pages) {
    lines.push(`---`, '', `## ${page.title ?? page.url}`, '', `Source: ${page.url}`, '', page.text, '');
  }

  const filePath = path.join(outputDir, ARTIFACT_TEXT);
  await fs.writeFile(filePath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
  return filePath;
}

async function writeCollectorJson(result: CollectedBusiness, outputDir: string): Promise<string> {
  const filePath = path.join(outputDir, ARTIFACT_JSON);
  await fs.writeFile(filePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return filePath;
}

/* ------------------------------------------------------------------ */
/* Merge                                                               */
/* ------------------------------------------------------------------ */

function pickByRole(images: readonly ImageAsset[], role: ImageRole): ImageAsset | null {
  const candidates = images.filter((image) => image.role === role);
  if (candidates.length === 0) return null;

  // Prefer something that actually downloaded, then the largest of those: a
  // hero is the big one, and a logo that resolved beats one that 404'd.
  const usable = candidates.filter((image) => image.localPath !== null);
  const pool = usable.length > 0 ? usable : candidates;
  return pool.reduce((best, image) => ((image.width ?? 0) > (best.width ?? 0) ? image : best), pool[0]!);
}

/** Keeps the strongest role each image was seen with, and its first source. */
function mergeImages(harvests: readonly PageHarvest[]): RawImage[] {
  const order: Record<ImageRole, number> = { favicon: 0, logo: 1, hero: 2, gallery: 3 };
  const merged = new Map<string, RawImage>();

  for (const harvest of harvests) {
    for (const image of harvest.images) {
      const existing = merged.get(image.url);
      if (!existing) {
        merged.set(image.url, image);
        continue;
      }
      if (order[image.role] < order[existing.role]) {
        merged.set(image.url, { ...existing, role: image.role });
      }
    }
  }

  return [...merged.values()].filter(
    (image) => IMAGE_EXTENSION.test(image.url) || image.url.startsWith('data:') === false,
  );
}

function mergeUnique<T>(harvests: readonly PageHarvest[], pick: (harvest: PageHarvest) => readonly T[], key: (item: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const harvest of harvests) {
    for (const item of pick(harvest)) {
      const id = key(item);
      if (!merged.has(id)) merged.set(id, item);
    }
  }
  return [...merged.values()];
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

export interface CollectorAgent extends Agent<DiscoveryResult, CollectedBusiness> {}

export const collectorAgent: CollectorAgent = {
  name: NAME,
  description: 'Gathers raw facts, text and images from the business website.',

  async run(input: DiscoveryResult, ctx: AgentContext): Promise<CollectedBusiness> {
    const { logger, config } = ctx;
    const outputDir = ctx.outputDir;
    const siteUrl = input.website ? normalizeSiteUrl(input.website) : null;

    const empty: CollectedBusiness = {
      identity: input,
      siteUrl,
      pages: [],
      logo: null,
      favicon: null,
      hero: null,
      gallery: [],
      navigation: [],
      services: [],
      emails: [],
      phones: [],
      socialProfiles: [],
      sources: [],
      collectedAt: new Date().toISOString(),
    };

    // A listing with no website is a normal outcome, not a failure: the writer
    // still has the Maps identity to work from.
    if (!siteUrl) {
      logger.warn('listing has no website, nothing to collect', { business: input.name });
      await fs.mkdir(outputDir, { recursive: true });
      await writeContentMarkdown(empty, outputDir);
      await writeCollectorJson(empty, outputDir);
      return empty;
    }

    logger.info('collection started', { siteUrl, maxPages: config.collector.maxPages });

    const session = await ctx.getBrowser();
    const visited = new Set<string>();
    const harvests: PageHarvest[] = [];

    const visit = async (url: string): Promise<void> => {
      const key = dedupeKey(url);
      if (visited.has(key)) return;
      visited.add(key);

      try {
        await session.withPage(async (page) => {
          // `load`, not `domcontentloaded`: on a client-rendered site the
          // images and copy do not exist yet at DOMContentLoaded, and the
          // harvest would read an empty shell.
          await page.goto(url, { waitUntil: 'load' });
          await page.wait(1_200);
          // Scrolling makes lazy sections mount and deferred images resolve.
          await page.scrollPage(4);
          await page.wait(800);
          const harvest = await harvestPage(page, page.url(), siteUrl, logger);
          if (harvest) harvests.push(harvest);
        });
      } catch (error) {
        // One unreachable page must not end the crawl.
        logger.warn('page could not be read', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    await logger.time('crawl site', async () => {
      await visit(siteUrl);
      ctx.signal.throwIfAborted();

      if (harvests.length === 0) {
        logger.warn('homepage yielded nothing, no further pages attempted', { siteUrl });
        return;
      }

      for (const url of planCrawl(siteUrl, harvests, visited, config.collector.maxPages - 1)) {
        ctx.signal.throwIfAborted();
        await visit(url);
      }
    });

    const images = await downloadImages(
      mergeImages(harvests),
      session,
      config.collector,
      outputDir,
      logger,
    );

    const result: CollectedBusiness = {
      identity: input,
      siteUrl,
      pages: harvests.map((harvest) => harvest.page),
      favicon: pickByRole(images, 'favicon'),
      logo: pickByRole(images, 'logo'),
      hero: pickByRole(images, 'hero'),
      gallery: images.filter((image) => image.role === 'gallery'),
      navigation: mergeUnique(harvests, (h) => h.navigation, (link) => link.href),
      services: mergeUnique(harvests, (h) => h.services, (item) => item.name.toLowerCase()),
      emails: mergeUnique(harvests, (h) => h.emails, (item) => item.value.toLowerCase()),
      phones: mergeUnique(harvests, (h) => h.phones, (item) => digitsOf(item.value)),
      socialProfiles: mergeUnique(harvests, (h) => h.socialProfiles, (item) => item.url),
      sources: harvests.map((harvest) => harvest.page.url),
      collectedAt: new Date().toISOString(),
    };

    const textPath = await writeContentMarkdown(result, outputDir);
    const jsonPath = await writeCollectorJson(result, outputDir);

    const missing = (
      [
        ['logo', result.logo],
        ['favicon', result.favicon],
        ['hero', result.hero],
        ['gallery', result.gallery],
        ['navigation', result.navigation],
        ['services', result.services],
        ['emails', result.emails],
        ['phones', result.phones],
        ['socialProfiles', result.socialProfiles],
      ] as const
    )
      .filter(([, value]) => value === null || (Array.isArray(value) && value.length === 0))
      .map(([key]) => key);
    if (missing.length > 0) logger.warn('fields not found on site', { missing });

    logger.info('collection finished', {
      pages: result.pages.length,
      gallery: result.gallery.length,
      services: result.services.length,
      emails: result.emails.length,
      phones: result.phones.length,
      socialProfiles: result.socialProfiles.length,
      artifacts: [textPath, jsonPath],
    });

    return result;
  },
};
