/**
 * The Google Maps listing, read as a *content* source.
 *
 * Discovery already reads the listing for identity — who this is, where, and
 * how to reach them. This reads the same pane for the things a website would
 * otherwise have supplied: what the business states about itself, the prose
 * Google publishes about it, and its photography.
 *
 * It exists because of the sharpest finding in the platform's benchmark: a
 * business with no website is the ideal customer and the worst-served case.
 * Everything here is public, verbatim and attributed. Nothing is inferred.
 *
 * ## What a signed-out session can actually see
 *
 * Maps serves an unauthenticated visitor a reduced pane, and says so in the
 * markup: "You're seeing a limited view of Google Maps." Measured against two
 * fingerprints, including a realistic user agent with the automation flag
 * removed, that view has **no Reviews tab and no photo grid** — `data-review-id`
 * matches nothing and the pane carries a single photograph.
 *
 * So this module deliberately does not try to scrape reviews. They are not
 * there to scrape, and code that hunted for them would be a maintenance burden
 * that reported an honest zero on every run. Reviews and the full photo set
 * come from the Places API, which returns them under a licence, and which
 * implements this same `ListingHarvest` contract when it lands.
 *
 * ## What it does read
 *
 * - **Attributes** from the About tab, grouped under their headings and
 *   carrying the availability state. Maps lists what a business *lacks*
 *   alongside what it has, and losing that distinction would turn "Pool
 *   unavailable" into a swimming pool.
 * - **The editorial description**, where Google publishes one.
 * - **The listing photograph** at native resolution rather than as the
 *   thumbnail the pane renders.
 *
 * Class names on Maps rotate. Every read is an ordered list of strategies that
 * degrades to nothing, exactly as discovery does — a thin harvest is a normal
 * outcome and never fails a run.
 */

import type { PageHandle } from '../browser.js';
import type { Logger } from '../logger.js';
import type { BusinessAttribute } from '../types.js';
import { EMPTY_HARVEST, type ListingHarvest, type ListingPhoto } from './types.js';

/** Google's own hosts for user and owner photography. */
const PHOTO_HOST = /(googleusercontent|ggpht)\.com/i;

/**
 * Profile pictures, not business photography.
 *
 * A reviewer's avatar is served from the same host as a shopfront. The `/a/`
 * and `/a-/` path prefixes are Google's account-avatar namespace, and `-mo` is
 * the monogram fallback rendered for an account with no picture at all.
 */
const AVATAR_PATH = /\/a-?\/|-mo(-|$)/i;

/**
 * The size directive Google appends to a photo URL: `=w408-h306-k-no`, `=s48`.
 *
 * It is a request, not a property of the file — the same photo serves at any
 * size, so the thumbnail the pane happens to render is not the resolution the
 * generated website has to live with.
 */
const SIZE_DIRECTIVE = /=[-a-z0-9]+$/i;

/**
 * What to ask for instead.
 *
 * Google caps at the native size rather than upscaling, so this is an upper
 * bound and not a promise. On the benchmark dentist it took a 408px, 45 KB
 * thumbnail to the full 1500px, 188 KB original.
 */
const FULL_SIZE = '=w1600-h1200-k-no';

/** Below this the image is an icon, a spacer or a badge — never photography. */
const MIN_PHOTO_WIDTH = 120;

/** Google's own furniture, not the business's words. */
const CHROME_TEXT =
  /limited view of Google Maps|Get the most out of Google Maps|Sign in|About this data|Suggest an edit|Add missing information|Claim this business|Write a review|Add photos|See photos/i;

/**
 * Attribute rows that are a control rather than a property.
 *
 * The About tab mixes the two: "Wheelchair-accessible entrance" is a fact about
 * the building, "Add missing information" is a button.
 */
const NOT_AN_ATTRIBUTE = /^(add|suggest|claim|write|see|show|hide|more|learn)\b/i;

/** Longer than a label, shorter than a page: the editorial paragraph shape. */
const MIN_DESCRIPTION_CHARS = 80;

function normalizeSpaces(value: string | null | undefined): string {
  return (value ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Rewrites a Maps photo URL to ask for the original rather than the thumbnail.
 *
 * A URL with no size directive is returned untouched: appending one to
 * something that is not a Google photo service would break the link, and a
 * working thumbnail beats a broken original.
 */
export function upgradePhotoUrl(url: string): string {
  if (!PHOTO_HOST.test(url)) return url;
  return SIZE_DIRECTIVE.test(url) ? url.replace(SIZE_DIRECTIVE, FULL_SIZE) : url;
}

/** True for a URL that is business photography rather than chrome or an avatar. */
export function isListingPhoto(url: string, naturalWidth: number | null): boolean {
  if (!PHOTO_HOST.test(url) || url.startsWith('data:')) return false;
  if (AVATAR_PATH.test(url)) return false;
  // A thumbnail is legitimately small on screen; an icon is small intrinsically.
  return naturalWidth === null || naturalWidth >= MIN_PHOTO_WIDTH;
}

function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : null;
}

/** Escapes a value for use inside a CSS attribute selector's quoted string. */
function cssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Photographs, scoped to *this* business by name.
 *
 * The scoping is the entire substance of this function, and it was learned the
 * expensive way. Taking every Google-hosted image on the pane gave the
 * benchmark hotel eleven photographs — of which **ten were other hotels**.
 * Maps renders a "Similar hotels nearby" rail in the same pane, each card an
 * `img` on the same CDN, and the generated website showed four named
 * competitors in its gallery.
 *
 * The pane does distinguish them: the business's own photograph sits under a
 * control labelled `"Photo of <business name>"`, while every rail card sits
 * under a container naming a different place. So the rule is positive rather
 * than exclusionary — an image counts only when the listing says whose it is.
 *
 * This yields fewer photographs, and that is the correct trade: a gallery of
 * one real building beats a gallery containing four competitors, and a website
 * that shows a rival's front door is not a truthful website. A fuller set comes
 * from the Places API, which returns a place's own photographs by construction.
 */
async function harvestPhotos(
  page: PageHandle,
  listingUrl: string,
  businessName: string,
): Promise<ListingPhoto[]> {
  const owner = `[aria-label^="Photo of ${cssAttributeValue(businessName)}"]`;
  const records = await page.fieldsAll(
    `${owner} img[src], ${owner} img[srcset]`,
    ['src', 'alt', 'naturalWidth', 'naturalHeight'],
  );

  const seen = new Set<string>();
  const photos: ListingPhoto[] = [];

  for (const record of records) {
    const src = record['src'];
    if (!src) continue;

    const naturalWidth = parseNumber(record['naturalWidth']);
    if (!isListingPhoto(src, naturalWidth)) continue;

    // The same photograph appears as a thumbnail and as a hero; both collapse
    // to one entry once the size directive is off the end.
    const url = upgradePhotoUrl(src);
    if (seen.has(url)) continue;
    seen.add(url);

    photos.push({
      url,
      // Maps gives its photographs no accessible name. Inventing one would be
      // writing copy, so the renderer is left to handle a null.
      alt: normalizeSpaces(record['alt']) || null,
      // The upgraded URL serves at a size neither this code nor the pane knows.
      width: null,
      height: null,
    });
  }

  void listingUrl;
  return photos;
}

/* ------------------------------------------------------------------ */
/* Attributes                                                          */
/* ------------------------------------------------------------------ */

/**
 * Splits an amenity chip's accessible name into its label and its state.
 *
 * Maps writes these as `"Free Wi-Fi available"` and `"Pool unavailable"` — the
 * state is a suffix on the same string, and a reader that took the label
 * whole would advertise a pool the hotel does not have.
 */
export function parseAttributeLabel(ariaLabel: string): { label: string; available: boolean } | null {
  const value = normalizeSpaces(ariaLabel);
  if (!value) return null;

  const unavailable = /^(.*?)\s+unavailable$/i.exec(value);
  if (unavailable?.[1]) return { label: unavailable[1].trim(), available: false };

  const available = /^(.*?)\s+available$/i.exec(value);
  if (available?.[1]) return { label: available[1].trim(), available: true };

  return { label: value, available: true };
}

/** True for a string that is a stated property rather than a button or chrome. */
function isAttributeText(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 80 &&
    !CHROME_TEXT.test(value) &&
    !NOT_AN_ATTRIBUTE.test(value)
  );
}

/**
 * Reads the About tab.
 *
 * Two shapes, both live: most categories render headed lists (`Accessibility`
 * followed by list items), while hotels render availability chips carrying
 * their state in an accessible name. Both are read, because a hotel is exactly
 * the case this whole module exists for.
 */
async function harvestAttributes(page: PageHandle, sourceUrl: string): Promise<BusinessAttribute[]> {
  const attributes: BusinessAttribute[] = [];
  const seen = new Set<string>();

  const add = (group: string, label: string, available: boolean): void => {
    const value = normalizeSpaces(label);
    if (!isAttributeText(value)) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    attributes.push({ group, label: value, available, sourceUrl });
  };

  // Headed lists. `fieldsAll` preserves document order, which is the only thing
  // that ties a list item to the heading above it.
  let group = 'General';
  for (const record of await page.fieldsAll('div[role="main"] h2, div[role="main"] li', [
    'tagName',
    'textContent',
  ])) {
    const text = normalizeSpaces(record['textContent']);
    if (record['tagName'] === 'H2') {
      if (text && !CHROME_TEXT.test(text)) group = text;
      continue;
    }
    add(group, text, true);
  }

  // Availability chips.
  for (const record of await page.fieldsAll('div[role="main"] [role="img"][aria-label]', [
    'aria-label',
    'aria-disabled',
  ])) {
    const parsed = parseAttributeLabel(record['aria-label'] ?? '');
    if (!parsed) continue;
    // The chip is styled as disabled *and* named "unavailable"; either is enough.
    const available = parsed.available && record['aria-disabled'] !== 'true';
    add('Amenities', parsed.label, available);
  }

  return attributes;
}

/* ------------------------------------------------------------------ */
/* Description                                                         */
/* ------------------------------------------------------------------ */

/**
 * The listing's editorial prose.
 *
 * Google writes a factual summary for some categories — hotels reliably, others
 * sometimes — and for a business with no website it is the only prose that
 * exists anywhere. Paragraphs are joined in document order and returned
 * verbatim; this function does not summarise, and neither may anything
 * downstream of it.
 */
async function harvestDescription(page: PageHandle): Promise<string | null> {
  const paragraphs: string[] = [];
  const seen = new Set<string>();

  const collect = async (selector: string): Promise<void> => {
    for (const value of await page.textAll(selector)) {
      const text = normalizeSpaces(value);
      if (text.length < MIN_DESCRIPTION_CHARS || CHROME_TEXT.test(text) || seen.has(text)) continue;
      seen.add(text);
      paragraphs.push(text);
    }
  };

  // Known containers first; they are precise while they last.
  await collect('div[role="main"] div.P1LL5e');
  await collect('div[role="main"] div.PYvSYb, div[role="main"] div.WeS02d');

  // Structural fallback for when the class names rotate: a leaf element on the
  // pane holding a paragraph's worth of text is either editorial prose or it is
  // nothing, and the chrome filter has already removed the "nothing".
  if (paragraphs.length === 0) {
    await collect('div[role="main"] div:not(:has(div)):not(:has(button)):not(:has(a))');
  }

  return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

/** Opens a pane tab by the word its accessible name starts with. */
async function openTab(page: PageHandle, word: string): Promise<boolean> {
  const selector = `button[role="tab"][aria-label^="${word}"]`;
  try {
    if (!(await page.exists(selector))) return false;
    await page.click(selector, { timeoutMs: 5_000 });
    await page.wait(2_000);
    return true;
  } catch {
    // A tab that will not open is a thin harvest, not a failed run.
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Source                                                              */
/* ------------------------------------------------------------------ */

export interface MapsListingInput {
  /** A bare place URL, as built by `buildCleanPlaceUrl`. */
  readonly listingUrl: string;
  /**
   * The resolved business name. Not decoration: it is how a photograph is
   * proved to belong to *this* business rather than to the "similar places"
   * rail rendered in the same pane.
   */
  readonly businessName: string;
}

/**
 * Reads one Maps listing for content.
 *
 * Takes an already-open page so it runs on the session the orchestrator owns,
 * and returns an empty harvest rather than throwing on anything short of the
 * pane never rendering at all.
 */
export async function harvestMapsListing(
  page: PageHandle,
  input: MapsListingInput,
  logger: Logger,
): Promise<ListingHarvest> {
  const { listingUrl, businessName } = input;

  try {
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1.DUwDvf, button[data-item-id]', { timeoutMs: 20_000 });
    // Detail rows and the hero photograph hydrate after the heading.
    await page.wait(1_500);
  } catch (error) {
    logger.warn('listing pane did not render, no content harvested', {
      listingUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return EMPTY_HARVEST;
  }

  // Photographs are on the overview, so they are read before navigating away.
  const photos = await harvestPhotos(page, listingUrl, businessName);

  let attributes: readonly BusinessAttribute[] = [];
  let description: string | null = null;

  if (await openTab(page, 'About')) {
    attributes = await harvestAttributes(page, listingUrl);
    description = await harvestDescription(page);
  } else {
    logger.debug('listing has no About tab', { listingUrl });
    // Some categories put the editorial summary on the overview instead.
    description = await harvestDescription(page);
  }

  const stated = attributes.filter((attribute) => attribute.available).length;
  logger.info('listing content harvested', {
    listingUrl,
    photos: photos.length,
    attributes: attributes.length,
    attributesAvailable: stated,
    descriptionChars: description?.length ?? 0,
  });

  return { attributes, description, photos, sources: [listingUrl] };
}
