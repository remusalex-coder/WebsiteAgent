/**
 * Maps URL shapes, shared by the two stages that need them.
 *
 * Discovery navigates by place id to escape a search context; the listing
 * source navigates by the same id to reopen the pane it was told about. One
 * definition, because two would drift and the failure would be silent — a
 * slightly wrong listing URL still renders *a* business.
 */

/**
 * A bare listing URL for a resolved place.
 *
 * A Maps URL reached by clicking a search result keeps its search context, and
 * Maps then renders the results feed *and* the place pane in the same DOM —
 * two `role="main"` regions, where an unscoped selector can silently read the
 * wrong business. Re-navigating here yields a single-pane page.
 */
export function buildCleanPlaceUrl(placeId: string | null): string | null {
  if (!placeId) return null;
  const query = placeId.startsWith('0x')
    ? `ftid=${encodeURIComponent(placeId)}`
    : `q=place_id:${encodeURIComponent(placeId)}`;
  return `https://www.google.com/maps/place/?${query}&hl=en`;
}
