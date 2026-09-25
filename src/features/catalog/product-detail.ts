import { cache } from "react";
import { indexCategories, toProductDetail, toProductSummary } from "./mappers";
import {
  fetchActiveCategories,
  fetchFeaturedSlugs,
  fetchProductCards,
  fetchProductDetail,
  fetchRatings,
} from "./queries";
import { isValidSlug } from "./slug";
import type { ProductDetail, ProductSummary } from "./types";

/* Product-detail reads from Supabase (active products only). */

/** Deduplicated per request, so `generateMetadata` and the page share one read. */
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!isValidSlug(slug)) return null;
  const [row, categories] = await Promise.all([fetchProductDetail(slug), fetchActiveCategories()]);
  if (!row) return null;
  const ratings = await fetchRatings([row.id]);
  return toProductDetail(row, indexCategories(categories), ratings.get(row.id), Date.now());
});

/** Slugs prerendered at build time; every other product renders on first request. */
export async function getProductSlugs(): Promise<string[]> {
  return fetchFeaturedSlugs();
}

/**
 * "You May Also Like": products from the same top-level category first, then
 * the rest of the catalog in its usual order. Never includes the product itself.
 */
export async function getRelatedProducts(
  product: Pick<ProductDetail, "slug" | "category">,
  limit = 8,
): Promise<ProductSummary[]> {
  const index = indexCategories(await fetchActiveCategories());
  const category = index.bySlug.get(product.category.slug);
  const root = category ? index.rootOf(category.id) : undefined;
  const familyIds = root ? index.subtreeIds(root.id) : [];

  const sameFamily = familyIds.length
    ? await fetchProductCards({ categoryIds: familyIds, limit: limit + 1 })
    : [];
  const related = sameFamily.filter((row) => row.slug !== product.slug).slice(0, limit);
  if (related.length < limit) {
    const others = await fetchProductCards({
      excludeCategoryIds: familyIds,
      limit: limit - related.length,
    });
    related.push(...others.filter((row) => row.slug !== product.slug));
  }

  const ratings = await fetchRatings(related.map((row) => row.id));
  return related.slice(0, limit).map((row) => toProductSummary(row, index, ratings));
}
