/**
 * In-memory stand-in for `@/features/catalog/queries`, over the row fixtures.
 * Mirrors the real filters (category ids, exclusions, featured, limit) so the
 * read functions can be tested without a database.
 */
import type { CardFilter } from "@/features/catalog/queries";
import {
  cardRows,
  categoryRows,
  collectionRows,
  detailRow,
  ratingRows,
  testimonialRows,
} from "@/test/fixtures/catalog-rows";

const FEATURED = new Set(["p-pearl", "p-tote"]);

export async function fetchActiveCategories() {
  return categoryRows;
}

export async function fetchProductCountsByCategory() {
  const counts = new Map<string, number>();
  for (const row of cardRows) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  return counts;
}

export async function fetchProductCards(filter: CardFilter = {}) {
  let rows = cardRows.filter((row) => {
    if (filter.featuredOnly && !FEATURED.has(row.id)) return false;
    if (filter.categoryIds && !filter.categoryIds.includes(row.category_id)) return false;
    if (filter.excludeCategoryIds?.includes(row.category_id)) return false;
    if (filter.excludeProductId === row.id) return false;
    return true;
  });
  if (filter.limit !== undefined) rows = rows.slice(0, filter.limit);
  return rows;
}

export async function fetchRatings(productIds: readonly string[]) {
  return new Map(ratingRows.filter((row) => productIds.includes(row.product_id)).map((row) => [row.product_id, row]));
}

export async function fetchProductDetail(slug: string) {
  return slug === detailRow.slug ? detailRow : null;
}

export async function fetchFeaturedSlugs() {
  return cardRows.filter((row) => FEATURED.has(row.id)).map((row) => row.slug);
}

export async function fetchLiveCollections() {
  return collectionRows;
}

export async function fetchTestimonials(count: number) {
  return testimonialRows.slice(0, count);
}
