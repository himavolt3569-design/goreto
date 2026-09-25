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

/** Top-level categories for `/categories`, with product counts including subcategories. */
export async function getCategories(): Promise<CategorySummary[]> {
  const [rows, counts] = await Promise.all([fetchActiveCategories(), fetchProductCountsByCategory()]);
  const index = indexCategories(rows);
  return index.topLevel.map((row) => toCategorySummary(row, index, counts));
}

/** Deduplicated per request, so `generateMetadata` and the page share one read. */
export const getCategoryBySlug = cache(async (slug: string): Promise<CategoryDetail | null> => {
  if (!isValidSlug(slug)) return null;
  const index = indexCategories(await fetchActiveCategories());
  const row = index.bySlug.get(slug);
  return row ? toCategoryDetail(row, index) : null;
});

export async function getCategoryProducts(
  slug: string,
  sort: CategorySort,
): Promise<ProductSummary[]> {
  if (!isValidSlug(slug)) return [];
  const index = indexCategories(await fetchActiveCategories());
  const category = index.bySlug.get(slug);
  if (!category) return [];

  const rows = await fetchProductCards({ categoryIds: index.subtreeIds(category.id) });
  const ratings = await fetchRatings(rows.map((row) => row.id));
  return sortProducts(
    rows.map((row) => toProductSummary(row, index, ratings)),
    sort,
  );
}
