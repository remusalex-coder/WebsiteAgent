/**
 * Content sources.
 *
 * A *source* is somewhere facts about a business can be read from. The website
 * crawl is one. The Maps listing, read as content rather than as identity, is
 * another. Instagram, a PDF menu, a Places API response and an owner
 * questionnaire are all the same shape of thing, and none of them should reach
 * the collector as a special case.
 *
 * So a source is a function with a contract, not a branch in an agent: it
 * returns `ListingHarvest` and says which URL every value came from. The
 * collector merges harvests; it does not know how any of them were obtained.
 *
 * That is what makes the Places API a drop-in rather than a rewrite — it
 * produces exactly this type, from an HTTP call instead of a browser, and every
 * stage downstream is unchanged.
 */

import type { BusinessAttribute, OpeningHours } from '../types.js';

/**
 * A photograph the source knows about.
 *
 * `width` and `height` are the intrinsic size *when the source can state one*.
 * A URL whose served size is decided by the host is honestly `null` rather than
 * the size that was asked for — the renderer omits the attributes it cannot
 * fill, which is better than reserving a box of the wrong shape.
 */
export interface ListingPhoto {
  readonly url: string;
  readonly alt: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

/**
 * One customer's words about the business, verbatim.
 *
 * This is the most dangerous fact type the platform handles, and the type is
 * shaped to make the danger structural rather than a matter of discipline.
 *
 * A testimonial is a claim attributed to a *named human being*. Every other
 * fact on a generated page is wrong at worst; a fabricated quotation under a
 * real person's name is a fabricated endorsement, and a platform that sells
 * trust cannot ship one even once. So:
 *
 * - `text` is copied, never summarised, never tidied, never truncated
 *   mid-sentence into something the author did not say.
 * - `sourceUrl` is mandatory, alone among the fields. A quotation nobody can
 *   check is indistinguishable from an invented one, so a review that cannot
 *   say where it is published cannot be constructed at all.
 * - No source may synthesise this from prose. A review is quoted from a
 *   reviews API or it does not exist.
 *
 * The model never sees a field it could fill. `WebsiteContent` gets its
 * testimonials from here, built by code, for the same reason hours and the
 * JSON-LD are.
 */
export interface ListingReview {
  /** The reviewer's words, exactly as published. */
  readonly text: string;
  /** Who wrote it, as the source attributes them. */
  readonly authorName: string | null;
  /** Stars out of five, when the source states them. */
  readonly rating: number | null;
  /** The source's own wording of when, e.g. "3 weeks ago". */
  readonly relativeTime: string | null;
  /** ISO 8601, when the source gives an absolute time. */
  readonly publishedAt: string | null;
  /** Where this review is published, so any visitor can verify it. */
  readonly sourceUrl: string;
}

/** What a content source can supply, all of it optional. */
export interface ListingHarvest {
  /** Stated properties, both the present and the explicitly absent. */
  readonly attributes: readonly BusinessAttribute[];
  /** The source's own prose about the business, verbatim. */
  readonly description: string | null;
  readonly photos: readonly ListingPhoto[];
  /**
   * Customer reviews, verbatim and attributed.
   *
   * Empty for any source that cannot quote them — which is every source the
   * platform had before the Places API, and is why the renderer's
   * `testimonials` section existed for five sessions without a single run ever
   * filling it.
   */
  readonly reviews: readonly ListingReview[];
  /**
   * The opening times the source states.
   *
   * A signed-out Maps pane yields roughly one day; a reviews API yields the
   * week. The collector merges by day, so the richer source wins per day
   * rather than wholesale.
   */
  readonly hours: readonly OpeningHours[];
  /** Aggregate rating out of five, when the source states one. */
  readonly rating: number | null;
  /**
   * How many reviews that rating averages.
   *
   * Kept beside the rating because schema.org's `AggregateRating` requires the
   * count, and because "4.9 on Google" and "4.9 from 812 reviews" are different
   * claims — the second is the one that persuades.
   */
  readonly reviewCount: number | null;
  /** Every URL that contributed, for provenance. */
  readonly sources: readonly string[];
}

export const EMPTY_HARVEST: ListingHarvest = {
  attributes: [],
  description: null,
  photos: [],
  reviews: [],
  hours: [],
  rating: null,
  reviewCount: null,
  sources: [],
};
