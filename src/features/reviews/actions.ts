"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidSlug } from "@/features/catalog/slug";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getUserSupabase } from "@/lib/supabase/server";
import { reviewFailureFromError, reviewFormSchema, type ReviewFailure, type ReviewFormValues } from "./schema";

/*
 * Review Server Actions (AGENTS §4.9, §11.4). Public POST endpoints: input is
 * parsed here; submit_review derives the reviewer and their delivered order
 * item in SQL, and deletes are limited to own rows by RLS.
 */

const ACCOUNT_REVIEWS_PATH = "/account/reviews";
const SIGNED_OUT: ReviewFailure = { ok: false, message: "Your session has ended. Sign in again to manage your reviews." };

export type ReviewActionResult = { ok: true } | ReviewFailure;

/** Published reviews show on the product page and its all-reviews page. */
function revalidateProductReviews(slug: string): void {
  revalidatePath(`/products/${slug}`);
  revalidatePath(`/products/${slug}/reviews`);
}

/** Writes or edits the caller's review of a product, then returns to their reviews. */
export async function submitReviewAction(productSlug: string, values: ReviewFormValues): Promise<ReviewActionResult> {
  if (!isValidSlug(productSlug)) return reviewFailureFromError({ code: "P0002", message: "" });
  const parsed = reviewFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: ReviewFailure["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ReviewFormValues;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }
  if (!(await getCurrentProfile())) return SIGNED_OUT;

  const { error } = await getUserSupabase().rpc("submit_review", {
    p_product_slug: productSlug,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
  });
  if (error) {
    if (!["42501", "P0002", "22023"].includes(error.code ?? "")) console.error("submit_review failed", error.code, error.message);
    return reviewFailureFromError(error);
  }

  // An edit takes a published review off the storefront until it's re-approved.
  revalidateProductReviews(productSlug);
  revalidatePath(ACCOUNT_REVIEWS_PATH);
  redirect(ACCOUNT_REVIEWS_PATH);
}

/** Deletes one of the caller's own reviews. Unknown or someone else's ids delete nothing. */
export async function deleteReviewAction(reviewId: string): Promise<ReviewActionResult> {
  if (!z.uuid().safeParse(reviewId).success) return { ok: false, message: "That review wasn't found." };
  const profile = await getCurrentProfile();
  if (!profile) return SIGNED_OUT;

  const { data, error } = await getUserSupabase()
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", profile.id)
    .select("products(slug)");
  if (error) {
    console.error("review delete failed", error.code, error.message);
    return { ok: false, message: "Your review couldn't be deleted. Please try again." };
  }
  if (data.length !== 1) return { ok: false, message: "That review wasn't found." };

  const slug = data[0]!.products?.slug;
  if (slug) revalidateProductReviews(slug);
  revalidatePath(ACCOUNT_REVIEWS_PATH);
  return { ok: true };
}
