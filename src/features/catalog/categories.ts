import { cache } from "react";
import { sortProducts, type CategorySort } from "./category-sort";
import { seedCategoryDetails, seedProductSummaries } from "./dev-seed";
import type { CategoryDetail, CategorySummary, ProductSummary } from "./types";

/*
 * Category reads. Until the Supabase catalog exists these serve the
 * development seed, and only outside production: the live store shows empty
 * states and 404s rather than fake categories. Replace the bodies with
 * Supabase reads; the return shapes are the contract the pages depend on.
 */

function seedAvailable(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function getCategories(): Promise<CategorySummary[]> {
  if (!seedAvailable()) return [];
  return seedCategoryDetails.map(({ slug, title, image }) => ({
    slug,
    title,
    image,
    productCount: seedProductSummaries.filter((product) => product.categorySlug === slug).length,
  }));
}

/** Deduplicated per request, so `generateMetadata` and the page share one read. */
export const getCategoryBySlug = cache(async (slug: string): Promise<CategoryDetail | null> => {
  if (!seedAvailable()) return null;
  const category = seedCategoryDetails.find((candidate) => candidate.slug === slug);
  if (!category) return null;
  return { slug: category.slug, title: category.title, description: category.description };
});

export async function getCategoryProducts(
  slug: string,
  sort: CategorySort,
): Promise<ProductSummary[]> {
  if (!seedAvailable()) return [];
  return sortProducts(
    seedProductSummaries.filter((product) => product.categorySlug === slug),
    sort,
  );
}
