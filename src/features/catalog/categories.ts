import { unstable_cache } from "next/cache";
import { cache } from "react";
import { sortProducts, type CategorySort } from "./category-sort";
import { indexCategories, toCategoryDetail, toCategorySummary, toProductSummary } from "./mappers";
import {
  fetchActiveCategories,
  fetchProductCards,
  fetchProductCountsByCategory,
  fetchRatings,
} from "./queries";
import { isValidSlug } from "./slug";
import type { CategoryDetail, CategorySummary, ProductSummary } from "./types";

/*
 * Category reads from Supabase. Top-level categories are the browsing units;
 * a category page includes its subcategories' products.
 */

/** Matches the ISR interval of the static catalog pages. */
const CATALOG_REVALIDATE_SECONDS = 60;
/** For on-demand `revalidateTag("catalog")` after admin edits. */
export const CATALOG_CACHE_TAG = "catalog";

type CategoryListing = { category: CategoryDetail; products: ProductSummary[] };

/**
 * `/categories/[slug]` reads `searchParams`, so the page renders per request
 * and route-level `revalidate` does not cache its data. The listing (header,
 * products, ratings) is cached here instead, keyed by slug (unstable_cache
 * adds the arguments to the key). Sorting happens after the cache, so every
 * `?sort=` shares one entry. Values are plain JSON: no Maps cross the cache.
 */
const loadCategoryListing = unstable_cache(
  async (slug: string): Promise<CategoryListing | null> => {
    const index = indexCategories(await fetchActiveCategories());
    const row = index.bySlug.get(slug);
    if (!row) return null;

    const cards = await fetchProductCards({ categoryIds: index.subtreeIds(row.id) });
    const ratings = await fetchRatings(cards.map((card) => card.id));
    return {
      category: toCategoryDetail(row, index),
      products: cards.map((card) => toProductSummary(card, index, ratings)),
    };
  },
  ["catalog:category-listing"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

/** Top-level categories for `/categories`, with product counts including subcategories. */
export async function getCategories(): Promise<CategorySummary[]> {
  const [rows, counts] = await Promise.all([fetchActiveCategories(), fetchProductCountsByCategory()]);
  const index = indexCategories(rows);
  return index.topLevel.map((row) => toCategorySummary(row, index, counts));
}

/** Deduplicated per request, so `generateMetadata` and the page share one read. */
export const getCategoryBySlug = cache(async (slug: string): Promise<CategoryDetail | null> => {
  if (!isValidSlug(slug)) return null;
  return (await loadCategoryListing(slug))?.category ?? null;
});

export async function getCategoryProducts(
  slug: string,
  sort: CategorySort,
): Promise<ProductSummary[]> {
  if (!isValidSlug(slug)) return [];
  const listing = await loadCategoryListing(slug);
  return listing ? sortProducts(listing.products, sort) : [];
}
