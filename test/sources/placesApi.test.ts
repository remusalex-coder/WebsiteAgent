/**
 * The Places API read as a content source.
 *
 * These cover the decisions that would put something *wrong* on a paying
 * customer's page rather than something thin: a quotation that misrepresents
 * the person who wrote it, an amenity claimed because a boolean was read as
 * truthy, and a business shown as closed on the day it never closes.
 *
 * The wire shapes below follow the published `Place` resource — `reviews[]`
 * carrying `text`/`originalText` as `LocalizedText`, `authorAttribution`,
 * `googleMapsUri`; `regularOpeningHours.periods[]` carrying `open`/`close` with
 * `day` counted from Sunday.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { harvestPlacesApi, isFtid, parseAccessibility, parseHours, parseReviews } from '../../lib/sources/placesApi.js';
import { EMPTY_HARVEST } from '../../lib/sources/types.js';
import { createLogger } from '../../lib/logger.js';

const LISTING = 'https://www.google.com/maps/place/?q=place_id:ChIJtest';

/** A review long enough to clear the publishable floor. */
function wireReview(text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: { text, languageCode: 'en' },
    authorAttribution: { displayName: 'Marta S.' },
    rating: 5,
    relativePublishTimeDescription: '3 weeks ago',
    publishTime: '2026-07-18T09:12:00Z',
    googleMapsUri: 'https://maps.google.com/review/1',
    ...extra,
  };
}

const LONG_ENOUGH = 'The custard tarts come out of the oven at eleven and they are worth the wait.';

const silent = createLogger({ scope: 'test', level: 'silent' });

/** A `fetch` that answers from a script and records what it was asked. */
function stubFetch(routes: readonly { readonly match: RegExp; readonly body: unknown; readonly ok?: boolean }[]): {
  readonly fetchImpl: typeof fetch;
  readonly calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL) => {
    const href = String(url);
    calls.push(href);
    const route = routes.find((entry) => entry.match.test(href));
    return {
      ok: route?.ok ?? route !== undefined,
      status: route === undefined ? 404 : 200,
      json: async () => route?.body,
      text: async () => JSON.stringify(route?.body ?? {}),
    };
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

describe('isFtid', () => {
  it('recognises the identifier every Maps URL actually carries', () => {
    // Every run in the repository holds this form. A source that passed it
    // straight to /v1/places/{id} would 404 on every business ever collected.
    assert.equal(isFtid('0x8085808f5038d91f:0x38aa369224229222'), true);
  });

  it('leaves a real place id alone', () => {
    assert.equal(isFtid('ChIJN1t_tDeuEmsRUsoyG83frY4'), false);
  });
});

describe('harvestPlacesApi', () => {
  it('exchanges an ftid for a place id before asking for details', async () => {
    const { fetchImpl, calls } = stubFetch([
      { match: /:searchText/, body: { places: [{ id: 'ChIJreal' }] } },
      { match: /places\/ChIJreal/, body: { rating: 4.7, userRatingCount: 812, reviews: [wireReview(LONG_ENOUGH)] } },
    ]);

    const harvest = await harvestPlacesApi(
      {
        placeId: '0x8085808f5038d91f:0x38aa369224229222',
        businessName: 'Hotel Union Square',
        address: '114 Powell St, San Francisco',
        apiKey: 'test-key',
        fetchImpl,
      },
      silent,
    );

    assert.ok(calls.some((url) => url.includes(':searchText')), 'an ftid must be resolved first');
    assert.ok(calls.some((url) => url.includes('places/ChIJreal')), 'details must use the resolved id');
    assert.equal(harvest.reviewCount, 812);
    assert.equal(harvest.reviews.length, 1);
  });

  it('asks for details directly when discovery already had a place id', async () => {
    const { fetchImpl, calls } = stubFetch([{ match: /places\/ChIJreal/, body: { rating: 4.7 } }]);

    await harvestPlacesApi({ placeId: 'ChIJreal', apiKey: 'test-key', fetchImpl }, silent);

    assert.equal(calls.some((url) => url.includes(':searchText')), false, 'a resolved id must not be paid for twice');
  });

  it('never puts the API key in a photo URL', async () => {
    // The media endpoint takes the key as a query parameter. Pasting that URL
    // into a harvest would write a live credential into a committed artifact.
    const { fetchImpl } = stubFetch([
      {
        match: /places\/ChIJreal\?/,
        body: { photos: [{ name: 'places/ChIJreal/photos/abc', widthPx: 4000, heightPx: 3000 }] },
      },
      { match: /\/media\?/, body: { photoUri: 'https://lh3.googleusercontent.com/clean' } },
    ]);

    const harvest = await harvestPlacesApi({ placeId: 'ChIJreal', apiKey: 'secret-key', fetchImpl }, silent);

    assert.equal(harvest.photos.length, 1);
    assert.equal(harvest.photos[0]?.url, 'https://lh3.googleusercontent.com/clean');
    assert.equal(
      harvest.photos[0]?.url.includes('secret-key'),
      false,
      'a credential must never reach an artifact',
    );
  });

  it('is skipped, not failed, with no key configured', async () => {
    // The $0.00 baseline has to stay runnable: it is what a contributor with no
    // billing account gets.
    const harvest = await harvestPlacesApi({ placeId: 'ChIJreal', apiKey: '' }, silent);
    assert.deepEqual(harvest, EMPTY_HARVEST);
  });

  it('returns an empty harvest rather than throwing when the API refuses', async () => {
    const { fetchImpl } = stubFetch([]);
    const harvest = await harvestPlacesApi({ placeId: 'ChIJreal', apiKey: 'bad-key', fetchImpl }, silent);
    assert.deepEqual(harvest, EMPTY_HARVEST);
  });
});

describe('parseReviews', () => {
  it('quotes the review verbatim and keeps where it can be checked', () => {
    const [review] = parseReviews([wireReview(LONG_ENOUGH)], LISTING);

    assert.equal(review?.text, LONG_ENOUGH);
    assert.equal(review?.authorName, 'Marta S.');
    assert.equal(review?.rating, 5);
    assert.equal(review?.sourceUrl, 'https://maps.google.com/review/1');
  });

  it('prefers the reviewer\'s own words over Google\'s translation', () => {
    // `text` is machine-translated when the review was not written in the
    // requested language. Putting a translation in quotation marks under a real
    // name attributes words to someone who never wrote them.
    const [review] = parseReviews(
      [
        wireReview('Machine translated sentence that is quite long indeed.', {
          originalText: { text: 'Os pastéis de nata saem do forno às onze e valem bem a espera.', languageCode: 'pt' },
        }),
      ],
      LISTING,
    );

    assert.match(review?.text ?? '', /pastéis de nata/);
  });

  it('drops a review too short to be a testimonial', () => {
    assert.equal(parseReviews([wireReview('Great!')], LISTING).length, 0);
  });

  it('drops an over-long review rather than truncating it', () => {
    // Half a sentence in quotation marks misrepresents its author, so length is
    // a reason to omit a review and never a reason to edit one.
    const essay = `${'A very considered paragraph about the bakery. '.repeat(20)}`;
    assert.equal(parseReviews([wireReview(essay)], LISTING).length, 0);
  });

  it('falls back to the listing when a review has no permalink', () => {
    // `sourceUrl` is the only mandatory field: a quotation nobody can check is
    // indistinguishable from an invented one.
    const [review] = parseReviews([wireReview(LONG_ENOUGH, { googleMapsUri: undefined })], LISTING);
    assert.equal(review?.sourceUrl, LISTING);
  });

  it('survives a malformed entry instead of losing the response', () => {
    const reviews = parseReviews([null, 'not a review', {}, wireReview(LONG_ENOUGH)], LISTING);
    assert.equal(reviews.length, 1);
  });

  it('orders by substance rather than by star rating', () => {
    // Stacking a page with five-star one-liners is what makes a testimonial
    // wall read as fake. The average is already stated in the trust bar.
    const shorter = 'Lovely little bakery, the staff were kind to us.';
    const reviews = parseReviews(
      [wireReview(shorter, { rating: 5 }), wireReview(LONG_ENOUGH, { rating: 4 })],
      LISTING,
    );

    assert.equal(reviews[0]?.text, LONG_ENOUGH);
  });
});

describe('parseHours', () => {
  it('reads a period into the platform\'s day and times', () => {
    const hours = parseHours({
      periods: [{ open: { day: 1, hour: 8, minute: 30 }, close: { day: 1, hour: 17, minute: 0 } }],
    });

    assert.deepEqual(hours, [{ dayOfWeek: 1, opens: '08:30', closes: '17:00' }]);
  });

  it('renders a period with no close as open all day', () => {
    // Places encodes "open 24 hours" by omitting `close`. Dropping it would
    // blank the day the hours matter most.
    const hours = parseHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] });
    assert.deepEqual(hours, [{ dayOfWeek: 0, opens: '00:00', closes: '23:59' }]);
  });

  it('ignores a period with no usable day', () => {
    assert.equal(parseHours({ periods: [{ open: { hour: 9 } }, { close: {} }] }).length, 0);
  });

  it('is empty rather than throwing on a missing block', () => {
    assert.deepEqual(parseHours(undefined), []);
    assert.deepEqual(parseHours({}), []);
  });
});

describe('parseAccessibility', () => {
  it('keeps a stated false as a stated absence', () => {
    // The whole point of `BusinessAttribute.available`. A `false` here is
    // Google saying the business lacks the feature, which the writer needs in
    // order not to claim it.
    const attributes = parseAccessibility(
      { wheelchairAccessibleEntrance: true, wheelchairAccessibleRestroom: false },
      LISTING,
    );

    assert.equal(attributes.length, 2);
    assert.equal(attributes.find((a) => a.label.includes('entrance'))?.available, true);
    assert.equal(attributes.find((a) => a.label.includes('toilet'))?.available, false);
  });

  it('states nothing about a field the API did not answer', () => {
    // Absent is not false. A missing key must not become "no wheelchair access".
    assert.equal(parseAccessibility({ wheelchairAccessibleParking: null }, LISTING).length, 0);
    assert.equal(parseAccessibility(undefined, LISTING).length, 0);
  });
});
