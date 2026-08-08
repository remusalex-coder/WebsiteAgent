/**
 * Content sources: everywhere facts about a business can be read from.
 *
 * One contract, `ListingHarvest`, and two implementations — the Maps listing
 * read through a browser, and the Places API read over HTTP. Adding the second
 * changed nothing above this line, which is what the contract was for.
 *
 * Instagram, a PDF menu and an owner questionnaire are the same shape of thing
 * and enter the same way.
 */

export { EMPTY_HARVEST } from './types.js';
export type { ListingHarvest, ListingPhoto, ListingReview } from './types.js';
export { buildCleanPlaceUrl } from './mapsUrl.js';
export {
  harvestMapsListing,
  isListingPhoto,
  parseAttributeLabel,
  upgradePhotoUrl,
  type MapsListingInput,
} from './mapsListing.js';
export {
  harvestPlacesApi,
  parseAccessibility,
  parseHours,
  parseReviews,
  type PlacesApiInput,
} from './placesApi.js';
export { mergeHarvests } from './merge.js';
