import "server-only";
import { getUserSupabase } from "@/lib/supabase/server";
import { toWishlistEntry, type WishlistEntry } from "./mappers";

/*
 * Wishlist reads through the Clerk-token client (AGENTS §10.8). RLS limits
 * wishlist_items to the caller's own rows; the explicit user filter restates
 * it. Products the shopper can no longer see come back as null.
 */

function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Wishlist query failed (${what}): ${error.code ?? ""} ${error.message}`.trim());
}

const ITEM_SELECT = `
  id, created_at,
  product:products(
    slug, title, status, base_price_paisa, low_stock_threshold, options,
    product_variants(id, sku, option_values, price_paisa, stock_quantity, sort_order, is_active),
    product_media(storage_path, alt_text, sort_order, variant_id)
  )
`;

/** The profile's saved products, newest first. */
export async function fetchWishlist(profileId: string): Promise<WishlistEntry[]> {
  const { data, error } = await getUserSupabase()
    .from("wishlist_items")
    .select(ITEM_SELECT)
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) fail("items", error);
  return data.map(toWishlistEntry);
}

/** Slugs of the profile's saved products that are on sale, for the storefront hearts. */
export async function fetchWishlistSlugs(profileId: string): Promise<string[]> {
  const { data, error } = await getUserSupabase()
    .from("wishlist_items")
    .select("product:products(slug, status)")
    .eq("user_id", profileId);
  if (error) fail("slugs", error);
  return data.flatMap(({ product }) => (product?.status === "active" ? [product.slug] : []));
}
