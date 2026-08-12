/**
 * Field-specific source authority — INTERPRETATION ONLY.
 *
 * This table is used *exclusively* by `foldProvenance` to interpret and rank
 * pre-merge provenance candidates (deciding confidence/status and which source's
 * note wins a conflict). It does NOT, and must not, control `mergeHarvests()`'s
 * winner selection — `mergeHarvests` keeps its own earlier-harvest-wins order and
 * is untouched by this file.
 *
 * Authority here means *how the source knows*, not how much it returns: a structured
 * API that states a fact (e.g. Places for hours/reviews) outranks a scraper that
 * infers it, even on a day where the guess is longer. The order is per field kind
 * because different sources are strongest at different facts.
 */

/** The kinds of field a provenance note can annotate. */
export type FieldKind =
  | 'identity'
  | 'contact'
  | 'address'
  | 'hours'
  | 'rating'
  | 'reviewCount'
  | 'attributes'
  | 'description'
  | 'socials'
  | 'photos'
  | 'services';

/**
 * Per-field authority order, most authoritative first.
 *
 * `hermes` appears where web research is demonstrably strong (services,
 * description, socials) and weaker where a structured API wins (hours, rating).
 * Edit this one table to re-rank a single field — never the merge logic.
 */
export const FIELD_AUTHORITY: Record<FieldKind, readonly string[]> = {
  identity: ['maps', 'places', 'website', 'hermes'],
  contact: ['website', 'maps', 'places', 'hermes'],
  address: ['maps', 'places', 'website', 'hermes', 'serp'],
  hours: ['places', 'maps', 'website', 'hermes'],
  rating: ['places', 'maps', 'hermes', 'website'],
  reviewCount: ['places', 'maps', 'hermes'],
  attributes: ['maps', 'website', 'places', 'hermes'],
  description: ['website', 'instagram', 'maps', 'hermes'],
  socials: ['website', 'maps', 'hermes', 'instagram'],
  photos: ['website', 'places', 'hermes', 'maps'],
  services: ['website', 'maps', 'hermes'],
};

/** Rank of a source class for a given field; lower = more authoritative. Unknown sources sort last. */
export function authorityRank(field: FieldKind, sourceClass: string): number {
  const order = FIELD_AUTHORITY[field];
  const idx = order.indexOf(sourceClass);
  return idx === -1 ? order.length : idx;
}
