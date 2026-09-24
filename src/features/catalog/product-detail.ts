import { cache } from "react";
import { seedProducts, seedProductSummaries } from "./dev-seed";
import type { ProductDetail, ProductSummary } from "./types";

/*
 * Product-detail reads. Until the Supabase catalog exists these serve the
 * development seed, and only outside production: the live store 404s rather
 * than showing fake products. Replace the bodies with Supabase reads; the
 * return shapes are the contract the page depends on.
 */

function seedAvailable(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Deduplicated per request, so `generateMetadata` and the page share one read. */
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!seedAvailable()) return null;
  return seedProducts.find((product) => product.slug === slug) ?? null;
});

export async function getProductSlugs(): Promise<string[]> {
  if (!seedAvailable()) return [];
  return seedProducts.map((product) => product.slug);
}

/**
 * "You May Also Like": products from the same category first, then the rest
 * of the catalog in its usual order. Never includes the product itself.
 */
export async function getRelatedProducts(
  product: Pick<ProductDetail, "slug" | "category">,
  limit = 8,
): Promise<ProductSummary[]> {
  if (!seedAvailable()) return [];
  const others = seedProductSummaries.filter((summary) => summary.slug !== product.slug);
  const sameCategory = others.filter((summary) => summary.categorySlug === product.category.slug);
  const rest = others.filter((summary) => summary.categorySlug !== product.category.slug);
  return [...sameCategory, ...rest].slice(0, limit);
}
