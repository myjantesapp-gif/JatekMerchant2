/**
 * Select a bounded, diverse slice of the already-filtered public catalog.
 *
 * Availability, merchant verification/account status, open status, active
 * product categories and image presence are enforced by the route query. This
 * helper deliberately does not look at `isPopular`, ratings, click counts or
 * order history: Home recommendations must reflect the live catalog rather
 * than a fabricated popularity ranking.
 */
export type AvailableProductCandidate = {
  id: number;
  restaurantId: number;
  imageUrl: string | null | undefined;
  [key: string]: unknown;
};

export function selectAvailableRecommendations<T extends AvailableProductCandidate>(
  candidates: readonly T[],
  requestedLimit: number,
): T[] {
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 12)
    : 6;
  const selected: T[] = [];
  const selectedIds = new Set<number>();
  const selectedRestaurantIds = new Set<number>();

  // First pass: show one real product per merchant where possible. The query
  // order (category sortOrder/id, then product sortOrder/id) is the merchant's
  // saved catalog order, not a popularity score.
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selectedIds.has(candidate.id) || selectedRestaurantIds.has(candidate.restaurantId)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.id);
    selectedRestaurantIds.add(candidate.restaurantId);
  }

  // If there are fewer merchants than slots, fill the remaining cards from
  // the same bounded result set while retaining the original catalog order.
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selectedIds.has(candidate.id)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.id);
  }

  // The diversity pass decides membership, not presentation order. Re-sort the
  // chosen set by its API/catalog position so filling a skipped product cannot
  // move it behind a later merchant's product.
  const sourceIndex = new Map(candidates.map((candidate, index) => [candidate.id, index]));
  return selected.sort(
    (left, right) => (sourceIndex.get(left.id) ?? 0) - (sourceIndex.get(right.id) ?? 0),
  );
}

/**
 * Newest must be a real recency sort, rather than the catalog diversity pass:
 * a second product from a merchant can be newer than the first product from a
 * different merchant. The route query has already applied all public
 * eligibility predicates, so taking this prefix preserves those predicates.
 */
export function selectNewestRecommendations<T extends AvailableProductCandidate>(
  candidates: readonly T[],
  requestedLimit: number,
): T[] {
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 12)
    : 6;
  return candidates.slice(0, limit);
}