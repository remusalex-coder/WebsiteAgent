/**
 * The Google Places API, read as a content source.
 *
 * Same contract as the Maps listing, different transport: one HTTPS request
 * instead of a browser, and it returns the two things a signed-out pane
 * provably cannot serve — **customer reviews** and the **full week's hours**.
 *
 * ## Why this exists
 *
 * The scraped listing was measured against two browser fingerprints, including
 * a realistic user agent with the automation flag deleted. Signed-out Maps
 * serves a reduced pane and says so in its own markup: no Reviews tab, no photo
 * grid, `div[data-review-id]` matching nothing. That is a wall, not a selector
 * problem, and the platform stopped pushing on it.
 *
 * The consequence was visible in every generated page. The renderer has drawn a
 * `testimonials` section since the design layer landed, the industry tables rank
 * it above `about` for six of the nine benchmark industries, and **no run has
 * ever filled it** — because nothing upstream could quote a customer. Trust
 * scored lowest of the eight quality dimensions on all five benchmark sites.
 *
 * ## Why it is a drop-in
 *
 * `harvestPlacesApi` returns `ListingHarvest`, exactly as `harvestMapsListing`
 * does. The collector merges harvests without knowing how any of them were
 * obtained, so nothing downstream of `lib/sources/` changed to gain reviews.
 * That was the point of defining the contract before there was a second source
 * to satisfy it.
 *
 * ## Two decisions worth knowing about
 *
 * **Photo URLs never carry the key.** The media endpoint takes the API key as a
 * query parameter, so pasting that URL into a harvest would write a live
 * credential into `2-raw.json`, into the image provenance, and into any page
 * that referenced it before download. `skipHttpRedirect=true` asks the endpoint
 * for the resolved `photoUri` as JSON instead, which is an ordinary
 * `googleusercontent` URL that anyone may fetch. One extra request per photo
 * buys a guarantee that no artifact in this repository can leak a key.
 *
 * **A failure here is never fatal.** Places is a bonus source. A missing key, a
 * revoked key, a quota wall and a network fault all produce the same outcome as
 * a business with no reviews: an empty harvest, a warning in the log, and a run
 * that completes. The platform's baseline is $0.00 and must stay runnable at it.
 */

import { withDeadline } from '../ai/http.js';
import { EMPTY_HARVEST, type ListingHarvest, type ListingPhoto, type ListingReview } from './types.js';

import type { Logger } from '../logger.js';
import type { BusinessAttribute, OpeningHours } from '../types.js';

const NAME = 'places-api';

const ENDPOINT = 'https://places.googleapis.com/v1/places';

/**
 * What to ask the API for.
 *
 * Billed per field group, so this is a cost decision as much as a data one.
 * `reviews`, `rating`, `userRatingCount` and `editorialSummary` fall in the
 * Enterprise + Atmosphere tier — they are the expensive half and the entire
 * reason for the call. Everything else here is cheap and already useful.
 *
 * Deliberately absent: `id`, `location`, `nationalPhoneNumber`, `websiteUri`
 * and the rest of the identity set. Discovery established those in stage 1, and
 * paying a second time for a fact the pipeline already holds is waste — this is
 * a *content* source, and it asks only for content.
 */
const FIELD_MASK = [
  'displayName',
  'primaryTypeDisplayName',
  'editorialSummary',
  'rating',
  'userRatingCount',
  'reviews',
  'photos',
  'regularOpeningHours',
  'accessibilityOptions',
].join(',');

/**
 * How many photographs to resolve.
 *
 * The API returns up to ten and each costs a media request to turn into a
 * usable URL. The renderer's largest gallery draws twelve, the collector caps
 * downloads at forty per run, and past that a visitor is scrolling rather than
 * looking.
 */
const MAX_PHOTOS = 10;

/** Long edge requested for each photograph. Above the largest hero the renderer draws. */
const PHOTO_MAX_PX = 1600;

/**
 * The shortest quotation worth putting a stranger's name under.
 *
 * "Great!" is a rating, not a testimonial. It contributes to the average the
 * trust bar already states, and rendering it as a pull quote makes a page look
 * padded rather than praised.
 */
const MIN_REVIEW_CHARS = 40;

/**
 * The longest quotation the page will carry.
 *
 * Reviews are never truncated — a half-sentence in quotation marks under a real
 * name misrepresents its author. A review longer than this is dropped in favour
 * of a shorter one that can be shown whole.
 */
const MAX_REVIEW_CHARS = 400;

export interface PlacesApiInput {
  /**
   * Google's place identifier, from discovery.
   *
   * May be either form. See `resolvePlaceId` — this is not the trivial field it
   * looks like, and assuming it was would have made the source fail on every
   * run in the repository.
   */
  readonly placeId: string;
  /** Used to resolve an `ftid` to a place id. Both improve the match. */
  readonly businessName?: string;
  readonly address?: string | null;
  readonly apiKey: string;
  /** Language for the editorial summary and Google-translated review text. */
  readonly languageCode?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  /** Injectable for tests; defaults to the global. */
  readonly fetchImpl?: typeof fetch;
}

/* ------------------------------------------------------------------ */
/* Wire shapes                                                         */
/* ------------------------------------------------------------------ */

/**
 * The response, typed as what it is: unvalidated JSON.
 *
 * Every field is optional and every reader below re-checks its type. A remote
 * service is not a compiler, and a field mask is a request rather than a
 * guarantee — Places omits anything it has no data for, so the difference
 * between "absent" and "wrong shape" has to be handled at the same place.
 */
interface PlaceResponse {
  readonly editorialSummary?: { readonly text?: unknown };
  readonly rating?: unknown;
  readonly userRatingCount?: unknown;
  readonly reviews?: unknown;
  readonly photos?: unknown;
  readonly regularOpeningHours?: { readonly periods?: unknown };
  readonly accessibilityOptions?: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

/**
 * Turns the API's review objects into quotable ones, best first.
 *
 * "Best" is not "highest rated". A five-star review reading "good" persuades
 * nobody, and stacking a page with five-star quotes is what makes a testimonial
 * wall read as fake. Length within the publishable band is the better proxy for
 * a review that says something, so ordering is by substance and the rating is
 * shown rather than selected on.
 *
 * `originalText` is preferred over `text` wherever both exist: `text` may be
 * Google's machine translation, and a translated sentence in quotation marks
 * under a customer's name is not that customer's words.
 */
export function parseReviews(value: unknown, fallbackUrl: string): readonly ListingReview[] {
  if (!Array.isArray(value)) return [];

  const reviews: ListingReview[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) continue;

    const original = isRecord(entry.originalText) ? stringOrNull(entry.originalText.text) : null;
    const translated = isRecord(entry.text) ? stringOrNull(entry.text.text) : null;
    const text = original ?? translated;
    if (text === null) continue;

    // A quotation is shown whole or not at all, so both bounds reject rather
    // than trim. The count the trust bar states is unaffected either way — it
    // comes from `userRatingCount`, which counts every rating including the
    // ones with no words at all.
    if (text.length < MIN_REVIEW_CHARS || text.length > MAX_REVIEW_CHARS) continue;

    const author = isRecord(entry.authorAttribution)
      ? stringOrNull(entry.authorAttribution.displayName)
      : null;

    // `googleMapsUri` points at this specific review. Falling back to the
    // listing keeps `sourceUrl` mandatory and still lands a reader somewhere
    // the quotation can be found.
    const sourceUrl = stringOrNull(entry.googleMapsUri) ?? fallbackUrl;

    reviews.push({
      text,
      authorName: author,
      rating: numberOrNull(entry.rating),
      relativeTime: stringOrNull(entry.relativePublishTimeDescription),
      publishedAt: stringOrNull(entry.publishTime),
      sourceUrl,
    });
  }

  return reviews.sort((a, b) => b.text.length - a.text.length);
}

/* ------------------------------------------------------------------ */
/* Hours                                                               */
/* ------------------------------------------------------------------ */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Reads `regularOpeningHours.periods` into the platform's `OpeningHours`.
 *
 * Both use 0 = Sunday, so the day index passes through unmapped.
 *
 * A period with an `open` and no `close` is Places' encoding of "open 24
 * hours". It becomes `00:00`–`23:59` rather than being dropped: a business that
 * never closes is exactly the business whose hours are worth stating, and the
 * alternative renders a blank line on the day it matters most.
 */
export function parseHours(value: unknown): readonly OpeningHours[] {
  if (!isRecord(value) || !Array.isArray(value.periods)) return [];

  const hours: OpeningHours[] = [];

  for (const period of value.periods) {
    if (!isRecord(period) || !isRecord(period.open)) continue;

    const day = numberOrNull(period.open.day);
    if (day === null || day < 0 || day > 6) continue;

    const openHour = numberOrNull(period.open.hour) ?? 0;
    const openMinute = numberOrNull(period.open.minute) ?? 0;

    const close = isRecord(period.close) ? period.close : null;
    const closes =
      close === null
        ? '23:59'
        : `${pad(numberOrNull(close.hour) ?? 0)}:${pad(numberOrNull(close.minute) ?? 0)}`;

    hours.push({
      dayOfWeek: day,
      opens: `${pad(openHour)}:${pad(openMinute)}`,
      closes,
    });
  }

  return hours;
}

/* ------------------------------------------------------------------ */
/* Attributes                                                          */
/* ------------------------------------------------------------------ */

/**
 * `accessibilityOptions` as stated properties.
 *
 * The API returns these as explicit booleans, which is strictly better than the
 * scraped pane: a `false` here is Google stating the business *lacks* the
 * feature, and that is a fact the writer needs in order not to claim it. The
 * availability distinction that `BusinessAttribute` exists to preserve arrives
 * already made, rather than being recovered from the phrasing of a label.
 */
export function parseAccessibility(
  value: Readonly<Record<string, unknown>> | undefined,
  sourceUrl: string,
): readonly BusinessAttribute[] {
  if (value === undefined) return [];

  const labels: Readonly<Record<string, string>> = {
    wheelchairAccessibleParking: 'Wheelchair-accessible car park',
    wheelchairAccessibleEntrance: 'Wheelchair-accessible entrance',
    wheelchairAccessibleRestroom: 'Wheelchair-accessible toilet',
    wheelchairAccessibleSeating: 'Wheelchair-accessible seating',
  };

  const attributes: BusinessAttribute[] = [];

  for (const [key, label] of Object.entries(labels)) {
    const stated = value[key];
    if (typeof stated !== 'boolean') continue;
    attributes.push({ group: 'Accessibility', label, available: stated, sourceUrl });
  }

  return attributes;
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Resolves one photo resource name to a URL that carries no credential.
 *
 * Returns `null` rather than throwing: one unresolvable photograph out of ten
 * is not a reason to lose the reviews in the same response.
 */
async function resolvePhoto(
  name: string,
  input: Required<Pick<PlacesApiInput, 'apiKey'>> & PlacesApiInput,
  widthPx: number | null,
  heightPx: number | null,
  doFetch: typeof fetch,
  signal: AbortSignal,
): Promise<ListingPhoto | null> {
  const url =
    `${ENDPOINT.replace(/\/places$/, '')}/${encodeURI(name)}/media` +
    `?maxWidthPx=${PHOTO_MAX_PX}&skipHttpRedirect=true`;

  const response = await doFetch(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': input.apiKey },
    signal,
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  const photoUri = isRecord(body) ? stringOrNull(body.photoUri) : null;
  if (photoUri === null) return null;

  return {
    url: photoUri,
    // The API attributes photographs to their contributor, not to their
    // subject. There is no caption to copy, so alt text is honestly absent and
    // the renderer writes one from the business name rather than inventing a
    // description of a picture nobody has looked at.
    alt: null,
    width: widthPx,
    height: heightPx,
  };
}

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

/**
 * True for the identifier Maps URLs actually carry.
 *
 * Google publishes two identifiers for the same place and they are not
 * interchangeable. A Maps URL carries an **ftid** — `0x8085808f5038d91f:0x38aa369224229222`,
 * a pair of hex CIDs — while the Places API is keyed by **place id**, the
 * `ChIJ…` form. Discovery reads whichever the URL gave it, so `placeId` on a
 * `DiscoveryResult` is honestly either.
 *
 * This is worth stating plainly because it is invisible until it fails: every
 * run currently in the repository carries the hex form, so a source that passed
 * the field straight to `/v1/places/{id}` would have returned `404 NOT_FOUND`
 * on every business the platform has ever collected, and the empty harvest that
 * followed would have looked exactly like a business with no reviews.
 */
export function isFtid(value: string): boolean {
  return /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(value.trim());
}

/**
 * Resolves whatever discovery captured into a place id the API accepts.
 *
 * A `ChIJ…` identifier is already one and costs nothing. An ftid is exchanged
 * for one through Text Search, on name and address — the two facts discovery is
 * most confident about — with the field mask holding the response to `places.id`
 * so the lookup bills at the cheapest tier.
 *
 * Returns `null` when the exchange finds nothing, which is a legitimate answer:
 * a listing can exist on Maps and not be served by the API.
 */
export async function resolvePlaceId(
  input: PlacesApiInput,
  doFetch: typeof fetch,
  signal: AbortSignal,
  logger: Logger,
): Promise<string | null> {
  const raw = input.placeId.trim();
  if (!isFtid(raw)) return raw;

  const query = [input.businessName, input.address].filter((part) => part && part.trim() !== '').join(', ');
  if (query === '') {
    logger.warn('places api cannot resolve an ftid with no name or address', { ftid: raw });
    return null;
  }

  const response = await doFetch(`${ENDPOINT}:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': input.apiKey,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.warn('places api text search failed', {
      status: response.status,
      detail: detail.slice(0, 300),
    });
    return null;
  }

  const body: unknown = await response.json();
  const places = isRecord(body) && Array.isArray(body.places) ? body.places : [];
  const first = places[0];
  const id = isRecord(first) ? stringOrNull(first.id) : null;

  if (id === null) logger.warn('places api text search matched nothing', { query });
  else logger.debug('ftid resolved to a place id', { ftid: raw, placeId: id });

  return id;
}

/* ------------------------------------------------------------------ */
/* The source                                                          */
/* ------------------------------------------------------------------ */

/**
 * Reads a place's content from the Places API.
 *
 * Never throws. Every failure path — no key, bad key, quota exhausted, network
 * fault, malformed body — logs and returns `EMPTY_HARVEST`, because this source
 * is additive and the pipeline ran without it for five sessions.
 */
export async function harvestPlacesApi(
  input: PlacesApiInput,
  logger: Logger,
): Promise<ListingHarvest> {
  const { placeId, apiKey, languageCode = 'en', timeoutMs = 15_000 } = input;

  if (apiKey.trim() === '' || placeId.trim() === '') {
    logger.debug('places api source skipped', {
      reason: apiKey.trim() === '' ? 'no PLACES_API_KEY' : 'no place id',
    });
    return EMPTY_HARVEST;
  }

  const doFetch = input.fetchImpl ?? fetch;
  const { signal, release } = withDeadline(input.signal, timeoutMs);

  try {
    const resolved = await resolvePlaceId(input, doFetch, signal, logger);
    if (resolved === null) return EMPTY_HARVEST;

    const detailsUrl = `${ENDPOINT}/${encodeURIComponent(resolved)}?languageCode=${encodeURIComponent(languageCode)}`;
    const response = await doFetch(detailsUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      signal,
    });

    if (!response.ok) {
      // The body carries Google's own explanation — "API key not valid",
      // "This API project is not authorized" — and printing it is the
      // difference between a five-minute fix and an afternoon.
      const detail = await response.text().catch(() => '');
      logger.warn('places api request failed', {
        status: response.status,
        detail: detail.slice(0, 300),
      });
      return EMPTY_HARVEST;
    }

    const place = (await response.json()) as PlaceResponse;

    // Provenance points at the human-readable listing, not the API endpoint:
    // `sourceUrl` is what a reader follows to check a claim, and nobody can
    // check a URL that needs a key.
    const listingUrl = `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(resolved)}`;

    const reviews = parseReviews(place.reviews, listingUrl);
    const hours = parseHours(place.regularOpeningHours);
    const attributes = parseAccessibility(place.accessibilityOptions, listingUrl);
    const description = isRecord(place.editorialSummary)
      ? stringOrNull(place.editorialSummary.text)
      : null;

    const photos: ListingPhoto[] = [];
    if (Array.isArray(place.photos)) {
      for (const entry of place.photos.slice(0, MAX_PHOTOS)) {
        if (!isRecord(entry)) continue;
        const name = stringOrNull(entry.name);
        if (name === null) continue;

        try {
          const photo = await resolvePhoto(
            name,
            { ...input, apiKey },
            numberOrNull(entry.widthPx),
            numberOrNull(entry.heightPx),
            doFetch,
            signal,
          );
          if (photo !== null) photos.push(photo);
        } catch (error) {
          logger.debug('photo could not be resolved', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    logger.info('places api harvested', {
      placeId,
      reviews: reviews.length,
      photos: photos.length,
      hoursDays: new Set(hours.map((entry) => entry.dayOfWeek)).size,
      attributes: attributes.length,
      descriptionChars: description?.length ?? 0,
      rating: numberOrNull(place.rating),
      reviewCount: numberOrNull(place.userRatingCount),
    });

    return {
      attributes,
      description,
      photos,
      reviews,
      hours,
      rating: numberOrNull(place.rating),
      reviewCount: numberOrNull(place.userRatingCount),
      sources: [listingUrl],
    };
  } catch (error) {
    logger.warn('places api source failed', {
      source: NAME,
      error: error instanceof Error ? error.message : String(error),
    });
    return EMPTY_HARVEST;
  } finally {
    release();
  }
}
