import "server-only";
import { cache } from "react";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { CardRow, CategoryRow, CollectionRow, DetailRow, RatingRow, TestimonialRow } from "./mappers";

/*
 * Storefront catalog queries (anon client, RLS: active rows only). Each read
 * is one request with nested embeds; the `.eq("status", "active")` filters
 * restate the RLS intent so a future privileged client can't leak drafts.
 */

const CARD_SELECT =
  "id, slug, title, category_id, base_price_paisa, is_bestseller, is_limited_edition, published_at, product_media(storage_path, alt_text)";

const DETAIL_SELECT = `
  id, slug, title, category_id, short_description, description, base_price_paisa,
  low_stock_threshold, is_bestseller, is_limited_edition, published_at, options, specs, care_instructions,
  product_variants(id, sku, option_values, price_paisa, stock_quantity, sort_order, is_active),
  product_media(id, storage_path, alt_text, sort_order, variant_id),
  product_ar_assets(mode, placement, is_active)
`;

function fail(what: string, error: { message: string }): never {
  throw new Error(`Catalog query failed (${what}): ${error.message}`);
}

/** All active categories, deduplicated per request (several reads need the tree). */
export const fetchActiveCategories = cache(async (): Promise<CategoryRow[]> => {
  const { data, error } = await getPublicSupabase()
    .from("categories")
    .select("id, parent_id, slug, title, description, image_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("title");
  if (error) fail("categories", error);
  return data;
});

/** Active product count per (leaf) category id. */
export const fetchProductCountsByCategory = cache(async (): Promise<Map<string, number>> => {
  const { data, error } = await getPublicSupabase()
    .from("products")
    .select("category_id")
    .eq("status", "active");
  if (error) fail("product counts", error);
  const counts = new Map<string, number>();
  for (const { category_id } of data) counts.set(category_id, (counts.get(category_id) ?? 0) + 1);
  return counts;
});

export type CardFilter = {
  categoryIds?: readonly string[];
  excludeCategoryIds?: readonly string[];
  excludeProductId?: string;
  featuredOnly?: boolean;
  limit?: number;
};

/**
 * Product cards in catalog order (featured first, then newest) with their
 * cover photo only.
 */
export async function fetchProductCards(filter: CardFilter = {}): Promise<CardRow[]> {
  let query = getPublicSupabase()
    .from("products")
    .select(CARD_SELECT)
    .eq("status", "active")
    .order("sort_order", { referencedTable: "product_media" })
    .limit(1, { referencedTable: "product_media" })
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false })
    .order("slug");

  if (filter.featuredOnly) query = query.eq("is_featured", true);
  if (filter.categoryIds) query = query.in("category_id", [...filter.categoryIds]);
  if (filter.excludeCategoryIds?.length) {
    query = query.not("category_id", "in", `(${filter.excludeCategoryIds.join(",")})`);
  }
  if (filter.excludeProductId) query = query.neq("id", filter.excludeProductId);
  if (filter.limit !== undefined) query = query.limit(filter.limit);

  const { data, error } = await query;
  if (error) fail("product cards", error);
  return data;
}

export async function fetchRatings(productIds: readonly string[]): Promise<Map<string, RatingRow>> {
  if (productIds.length === 0) return new Map();
  const { data, error } = await getPublicSupabase().rpc("product_rating_summaries", {
    product_ids: [...productIds],
  });
  if (error) fail("ratings", error);
  return new Map(data.map((row) => [row.product_id, row]));
}

export async function fetchProductDetail(slug: string): Promise<DetailRow | null> {
  const { data, error } = await getPublicSupabase()
    .from("products")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) fail("product detail", error);
  return data;
}

export async function fetchFeaturedSlugs(): Promise<string[]> {
  const { data, error } = await getPublicSupabase()
    .from("products")
    .select("slug")
    .eq("status", "active")
    .eq("is_featured", true);
  if (error) fail("featured slugs", error);
  return data.map((row) => row.slug);
}

/** Active collections inside their schedule window (enforced by RLS). */
export async function fetchLiveCollections(): Promise<CollectionRow[]> {
  const { data, error } = await getPublicSupabase()
    .from("collections")
    .select("slug, eyebrow, title, description, hero_image_path, hero_image_alt")
    .eq("is_active", true)
    .order("sort_order");
  if (error) fail("collections", error);
  return data;
}

export async function fetchTestimonials(count: number): Promise<TestimonialRow[]> {
  const { data, error } = await getPublicSupabase().rpc("storefront_testimonials", {
    max_count: count,
  });
  if (error) fail("testimonials", error);
  return data;
}
