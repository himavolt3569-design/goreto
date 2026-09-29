"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidSlug } from "@/features/catalog/slug";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getUserSupabase } from "@/lib/supabase/server";
import type { WishlistChange } from "./store";

/*
 * Wishlist Server Actions (AGENTS §4.9, §11.4). Each is a public POST
 * endpoint, so the input is validated here and ownership is enforced by RLS
 * (wishlist_items: own insert/delete) through the Clerk-token client. Saving
 * and removing are idempotent.
 */

const SIGNED_OUT: WishlistChange = { ok: false, message: "Sign in to save products to your wishlist." };
const FAILED: WishlistChange = { ok: false, message: "We couldn't update your wishlist. Please try again." };
const slugSchema = z.string().refine(isValidSlug);

async function activeProductId(slug: string): Promise<string | null> {
  const { data, error } = await getUserSupabase()
    .from("products")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`Wishlist product lookup failed: ${error.message}`);
  return data?.id ?? null;
}

export async function saveToWishlistAction(slug: string): Promise<WishlistChange> {
  if (!slugSchema.safeParse(slug).success) return FAILED;
  const profile = await getCurrentProfile();
  if (!profile) return SIGNED_OUT;

  const productId = await activeProductId(slug);
  if (!productId) return { ok: false, message: "This product is no longer available." };

  const { error } = await getUserSupabase().from("wishlist_items").insert({ user_id: profile.id, product_id: productId });
  if (!error || error.code === "23505") return { ok: true };
  if (error.code === "54000") return { ok: false, message: "Your wishlist is full. Remove something to save more." };
  console.error("wishlist save failed", error.code, error.message);
  return FAILED;
}

export async function removeFromWishlistAction(slug: string): Promise<WishlistChange> {
  if (!slugSchema.safeParse(slug).success) return FAILED;
  const profile = await getCurrentProfile();
  if (!profile) return SIGNED_OUT;

  const productId = await activeProductId(slug);
  if (!productId) return { ok: true };

  const { error } = await getUserSupabase()
    .from("wishlist_items")
    .delete()
    .eq("user_id", profile.id)
    .eq("product_id", productId);
  if (!error) return { ok: true };
  console.error("wishlist remove failed", error.code, error.message);
  return FAILED;
}

/** Removal from the wishlist page, by row id, so products no longer on sale can go too. */
export async function removeWishlistItemAction(itemId: string): Promise<WishlistChange> {
  if (!z.uuid().safeParse(itemId).success) return FAILED;
  const profile = await getCurrentProfile();
  if (!profile) return SIGNED_OUT;

  const { error } = await getUserSupabase().from("wishlist_items").delete().eq("id", itemId).eq("user_id", profile.id);
  if (error) {
    console.error("wishlist remove failed", error.code, error.message);
    return FAILED;
  }
  revalidatePath("/account/wishlist");
  return { ok: true };
}
