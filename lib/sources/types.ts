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

import type { BusinessAttribute } from '../types.js';

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

/** What a content source can supply, all of it optional. */
export interface ListingHarvest {
  /** Stated properties, both the present and the explicitly absent. */
  readonly attributes: readonly BusinessAttribute[];
  /** The source's own prose about the business, verbatim. */
  readonly description: string | null;
  readonly photos: readonly ListingPhoto[];
  /** Every URL that contributed, for provenance. */
  readonly sources: readonly string[];
}

export const EMPTY_HARVEST: ListingHarvest = {
  attributes: [],
  description: null,
  photos: [],
  sources: [],
};
