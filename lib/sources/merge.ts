/**
 * Combining what several sources said about the same business.
 *
 * The collector's job is to gather, not to adjudicate. This is where the
 * adjudication lives, as a pure function over `ListingHarvest` values, so that
 * adding a third source is an entry in an array at the call site rather than a
 * branch inside an agent.
 *
 * ## The one rule
 *
 * **Earlier harvests win.** Callers pass sources in order of authority, and
 * every field below resolves a conflict the same way. That keeps the policy in
 * one readable place instead of distributed across per-field heuristics that
 * drift apart.
 *
 * Authority here means *how the source knows*, not how much it returns. The
 * Places API states accessibility as explicit booleans and hours as structured
 * periods; the scraped pane recovers the same facts from label text and is
 * right most of the time. A source that parses beats a source that guesses,
 * even on a day where the guess is longer.
 *
 * ## Why "win" is per field and not per source
 *
 * A merge that took the best *source* would throw away the Maps listing's
 * amenity list because Places answered first with four accessibility booleans.
 * So the resolution is per field, and for the collection-valued fields it is
 * per *item*: hours resolve day by day, attributes label by label. A business
 * whose API knows Sunday and whose pane knows Saturday ends up with both.
 */

import { EMPTY_HARVEST, type ListingHarvest, type ListingPhoto, type ListingReview } from './types.js';

import type { BusinessAttribute, OpeningHours } from '../types.js';

/** Case- and space-insensitive identity, for the dedupe keys below. */
function fold(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Merges harvests, most authoritative first.
 *
 * Empty in, empty out: a business whose every source failed is a thin profile,
 * which the pipeline already handles, and never an error.
 */
export function mergeHarvests(harvests: readonly ListingHarvest[]): ListingHarvest {
  if (harvests.length === 0) return EMPTY_HARVEST;
  if (harvests.length === 1) return harvests[0] ?? EMPTY_HARVEST;

  const attributes: BusinessAttribute[] = [];
  const seenAttribute = new Set<string>();

  const photos: ListingPhoto[] = [];
  const seenPhoto = new Set<string>();

  const reviews: ListingReview[] = [];
  const seenReview = new Set<string>();

  // Keyed by day rather than appended: two sources both stating Monday is one
  // Monday, and a page that lists it twice reads like a bug because it is one.
  const hoursByDay = new Map<number, OpeningHours>();

  const sources: string[] = [];
  const seenSource = new Set<string>();

  let description: string | null = null;
  let rating: number | null = null;
  let reviewCount: number | null = null;

  for (const harvest of harvests) {
    for (const attribute of harvest.attributes) {
      // Availability is deliberately outside the key. "Free Wi-Fi: yes" and
      // "Free Wi-Fi: no" are the same property disagreeing, and the more
      // authoritative source has to settle it — keying on both states would
      // render the contradiction instead.
      const key = `${fold(attribute.group)}|${fold(attribute.label)}`;
      if (seenAttribute.has(key)) continue;
      seenAttribute.add(key);
      attributes.push(attribute);
    }

    for (const photo of harvest.photos) {
      if (seenPhoto.has(photo.url)) continue;
      seenPhoto.add(photo.url);
      photos.push(photo);
    }

    for (const review of harvest.reviews) {
      // Keyed on the words, not the author: the same review reached through two
      // sources is one endorsement, and showing it twice is the single most
      // obvious way for a testimonial wall to look fabricated.
      const key = fold(review.text);
      if (seenReview.has(key)) continue;
      seenReview.add(key);
      reviews.push(review);
    }

    for (const entry of harvest.hours) {
      if (!hoursByDay.has(entry.dayOfWeek)) hoursByDay.set(entry.dayOfWeek, entry);
    }

    for (const source of harvest.sources) {
      if (seenSource.has(source)) continue;
      seenSource.add(source);
      sources.push(source);
    }

    description ??= harvest.description;
    rating ??= harvest.rating;
    reviewCount ??= harvest.reviewCount;
  }

  return {
    attributes,
    description,
    photos,
    reviews,
    hours: [...hoursByDay.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    rating,
    reviewCount,
    sources,
  };
}
