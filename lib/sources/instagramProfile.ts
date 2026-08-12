/**
 * A public Instagram profile, read as a content source. **Instagram Research
 * V1** — bio and highlight labels only, not a general Instagram scraper.
 *
 * Same contract as `mapsListing.ts`: a signed-out visitor sees a reduced
 * profile, this module reads exactly what that visitor sees and nothing more,
 * and it degrades to an empty harvest rather than failing the run. It exists
 * for the same reason `mapsListing.ts` does — the collector already found
 * that a business's own words about itself are often the only prose that
 * exists anywhere for it, and River Park's Maps listing (`77c15289`) had none
 * at all, while its Instagram bio names two halls and a 19-room hotel that no
 * source in the platform had ever recovered.
 *
 * ## Scope, deliberately
 *
 * V1 reads: username, display name, bio (verbatim, line breaks preserved),
 * and the *labels* of story highlights (never their contents — those are
 * private-adjacent and this module does not open one). It does **not** read
 * the photo grid: Instagram serves it only to an authenticated session,
 * verified live on this exact profile before writing a line of this file —
 * `get_page_text` returned the bio and highlight names but no post images,
 * the identical shape of wall `mapsListing.ts` already documented for Google
 * Maps. Code that hunted for photos here would report an honest zero on every
 * run, so it is not written.
 *
 * ## What it will never do
 *
 * No login, no session, no cookies carried over from a previous visit, no
 * CAPTCHA solving, no private API endpoints Instagram's own client uses
 * internally — only the same public profile page a logged-out human can
 * open. No link found *on* the page is ever followed: the only URL this
 * module ever navigates to is the one the caller supplied, host-validated
 * first. That is the module's entire SSRF posture — there is no second
 * request to defend.
 *
 * ## Selectors
 *
 * Instagram ships atomic, build-hashed class names (`x1lliihq`, …) that carry
 * no meaning across deploys — confirmed live, the same rotating-selector
 * problem `mapsListing.ts` documents for Maps. Every selector below is
 * structural instead: semantic tags (`header`, `h1`/`h2`), a stable URL shape
 * (`/stories/highlights/…`), and position relative to the one element on the
 * page whose meaning cannot rotate — the `<ul>` holding the follower/following
 * counts. `section:has(> ul) + section` reads "the identity block, which
 * comes right after the stats block" rather than "the fourth section", so it
 * survives Instagram adding or removing an unrelated section elsewhere in the
 * header. Verified against the live DOM of a real profile before being
 * written here, not guessed at.
 */

import type { PageHandle } from '../browser.js';
import type { Logger } from '../logger.js';
import type { BusinessAttribute } from '../types.js';
import { EMPTY_HARVEST, type ListingHarvest } from './types.js';

/** Only host this module will ever navigate to. No redirect is followed past it. */
const INSTAGRAM_HOST = /^(www\.)?instagram\.com$/i;

/**
 * A username is a path segment, not the bare host — `instagram.com/` and
 * `instagram.com/explore/` are not a profile and must not be treated as one.
 */
const RESERVED_PATH = /^(explore|accounts|about|legal|developer|directory|web|p|reel|stories|tv|legal)$/i;

const HEADER_SELECTOR = 'header';
const USERNAME_SELECTOR = 'header h1, header h2';
/** The section right after the one holding the follower/following `<ul>`. */
const IDENTITY_SECTION_SELECTOR = 'header section:has(> ul) + section > div';
const DISPLAY_NAME_SELECTOR = `${IDENTITY_SECTION_SELECTOR} > div:first-child`;
const BIO_SELECTOR = `${IDENTITY_SECTION_SELECTOR} > span`;
const HIGHLIGHT_SELECTOR = 'a[href^="/stories/highlights/"]';

/** Resource-limit guards. Nothing on a real profile approaches these; a
 * profile that does is not a bio, and truncating it is safer than carrying
 * an unbounded string into a downstream AI prompt. */
const MAX_BIO_CHARS = 600;
const MAX_HIGHLIGHTS = 20;
const MAX_HIGHLIGHT_CHARS = 80;

const NAV_TIMEOUT_MS = 15_000;
const SELECTOR_TIMEOUT_MS = 8_000;

/* ------------------------------------------------------------------ */
/* URL validation                                                      */
/* ------------------------------------------------------------------ */

/**
 * True for a URL this module is willing to navigate to.
 *
 * This is the entire SSRF defense: scheme must be `http(s)`, host must be
 * Instagram's own (no lookalike domain, no IP literal, no `localhost`, no
 * internal address — none of those can match this regex), and the path must
 * name a profile rather than a platform route. Called both by the caller
 * before it decides to invoke this source, and again inside `harvestInstagramProfile`
 * itself, so a caller cannot skip the check by mistake.
 */
export function isInstagramProfileUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (!INSTAGRAM_HOST.test(url.hostname)) return false;

  const segment = url.pathname.split('/').filter(Boolean)[0];
  if (!segment) return false;
  return !RESERVED_PATH.test(segment);
}

/** The `@handle` from a profile URL, for logging and for `sourceUrl` provenance. */
export function usernameFromProfileUrl(value: string): string | null {
  if (!isInstagramProfileUrl(value)) return null;
  const url = new URL(value.trim());
  return url.pathname.split('/').filter(Boolean)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Text shaping                                                        */
/* ------------------------------------------------------------------ */

/** Collapses horizontal whitespace on each line without merging the lines themselves. */
function normalizeBio(raw: string | null): string | null {
  if (!raw) return null;
  const lines = raw
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const joined = lines.join('\n');
  return joined.length > MAX_BIO_CHARS ? `${joined.slice(0, MAX_BIO_CHARS).trimEnd()}…` : joined;
}

function normalizeLabel(raw: string | null): string | null {
  const value = raw?.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  return value.length > MAX_HIGHLIGHT_CHARS ? value.slice(0, MAX_HIGHLIGHT_CHARS).trim() : value;
}

/* ------------------------------------------------------------------ */
/* Source                                                               */
/* ------------------------------------------------------------------ */

export interface InstagramProfileInput {
  /** A public profile URL, e.g. `https://www.instagram.com/river.park.events/`. */
  readonly profileUrl: string;
}

/**
 * Everything this module reads, before it is narrowed into `ListingHarvest`.
 *
 * Kept separate from `ListingHarvest` because `username` and `displayName`
 * are identity facts and `ListingHarvest` deliberately carries none — that is
 * `discoveryAgent`'s contract, not a content source's. Consumers that want
 * these two fields (a future name-resolution widening, a report) read this
 * type directly; `toListingHarvest` below is the seam-conformant projection.
 */
export interface InstagramProfileResult {
  readonly profileUrl: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly bio: string | null;
  /** Story highlight titles, verbatim, capped at `MAX_HIGHLIGHTS`. Never their contents. */
  readonly highlights: readonly string[];
  /** True only when the page rendered enough to read at all. */
  readonly accessible: boolean;
}

const EMPTY_RESULT = (profileUrl: string): InstagramProfileResult => ({
  profileUrl,
  username: null,
  displayName: null,
  bio: null,
  highlights: [],
  accessible: false,
});

/**
 * Reads one public Instagram profile.
 *
 * Takes an already-open page, exactly as `harvestMapsListing` does, so it
 * runs on the session the orchestrator already owns. Never throws: a wall, a
 * timeout, a redirect to a login page, or a profile that has gone private all
 * produce the same honest outcome — an inaccessible result — because none of
 * them is this run's problem to solve.
 */
export async function harvestInstagramProfile(
  page: PageHandle,
  input: InstagramProfileInput,
  logger: Logger,
): Promise<InstagramProfileResult> {
  const { profileUrl } = input;

  if (!isInstagramProfileUrl(profileUrl)) {
    logger.warn('instagram source refused a non-profile url', { profileUrl });
    return EMPTY_RESULT(profileUrl);
  }

  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeoutMs: NAV_TIMEOUT_MS });
    await page.waitForSelector(HEADER_SELECTOR, { timeoutMs: SELECTOR_TIMEOUT_MS });
    // The identity block and highlight tray hydrate after the bare header.
    await page.wait(1_500);
  } catch (error) {
    logger.warn('instagram profile did not render, no content harvested', {
      profileUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return EMPTY_RESULT(profileUrl);
  }

  const username = (await page.text(USERNAME_SELECTOR))?.trim() || usernameFromProfileUrl(profileUrl);
  const displayName = normalizeLabel(await page.text(DISPLAY_NAME_SELECTOR));
  const bio = normalizeBio(await page.innerText(BIO_SELECTOR));

  const highlightTexts = await page.textAll(HIGHLIGHT_SELECTOR);
  const highlights: string[] = [];
  const seen = new Set<string>();
  for (const raw of highlightTexts) {
    const label = normalizeLabel(raw);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    highlights.push(label);
    if (highlights.length >= MAX_HIGHLIGHTS) break;
  }

  const accessible = username !== null || bio !== null || highlights.length > 0;

  logger.info('instagram profile harvested', {
    profileUrl,
    username,
    hasDisplayName: displayName !== null,
    bioChars: bio?.length ?? 0,
    highlights: highlights.length,
    accessible,
  });

  return { profileUrl, username: username ?? null, displayName, bio, highlights, accessible };
}

/* ------------------------------------------------------------------ */
/* ListingHarvest projection                                           */
/* ------------------------------------------------------------------ */

/**
 * Narrows a profile read into the shape every content source shares.
 *
 * Only two of `ListingHarvest`'s fields have anything to receive from
 * Instagram V1: `description` (the bio, verbatim — the same "read, never
 * summarised" rule `mapsListing.ts`'s editorial description follows) and
 * `attributes` (the highlight labels, as a stated-but-unverified group — they
 * are the business's own chosen categories for its own content, which is a
 * real fact about the business, not a claim about amenities). `photos`,
 * `reviews`, `hours`, `rating` and `reviewCount` stay empty because this
 * module never reads them; a source is honest about what it does not know
 * rather than approximating it.
 *
 * `username`/`displayName` do not appear here — see `InstagramProfileResult`'s
 * doc comment for why.
 */
export function toListingHarvest(result: InstagramProfileResult): ListingHarvest {
  if (!result.accessible) return EMPTY_HARVEST;

  const attributes: BusinessAttribute[] = result.highlights.map((label) => ({
    group: 'Instagram highlights',
    label,
    available: true,
    sourceUrl: result.profileUrl,
  }));

  return {
    ...EMPTY_HARVEST,
    description: result.bio,
    attributes,
    sources: [result.profileUrl],
  };
}
