"use server";

import { refresh, revalidatePath } from "next/cache";
import { databaseErrorResult, type ActionResult } from "../auth";
import { adminDb } from "../queries/shared";
import { reviewModerationSchema, toggleSchema } from "../schemas";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog } from "./helpers";

/* Review moderation (reviews.manage), coupons (promotions.manage), collections (content.manage). */

export async function moderateReviewAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("reviews.manage", reviewModerationSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb()
    .from("reviews")
    .update({
      status: input.data.decision,
      moderated_by: input.profileId,
      moderated_at: new Date().toISOString(),
      moderation_note: input.data.note,
    })
    .eq("id", input.data.reviewId)
    .select("products(slug)");
  if (error) return databaseErrorResult(error, "moderate review");
  if (data.length !== 1) return NOT_UPDATED;

  // Ratings and testimonials on the storefront come from published reviews.
  revalidateStorefrontCatalog(data[0]!.products?.slug);
  refresh();
  return { ok: true, message: input.data.decision === "published" ? "Review published." : "Review rejected." };
}

export async function setCouponActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("promotions.manage", toggleSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().from("coupons").update({ is_active: input.data.value }).eq("id", input.data.id).select("id");
  if (error) return databaseErrorResult(error, "set coupon active");
  if (data.length !== 1) return NOT_UPDATED;

  refresh();
  return { ok: true };
}

export async function setCollectionActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("content.manage", toggleSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().from("collections").update({ is_active: input.data.value }).eq("id", input.data.id).select("id");
  if (error) return databaseErrorResult(error, "set collection active");
  if (data.length !== 1) return NOT_UPDATED;

  // Collections appear in the homepage carousel.
  revalidatePath("/");
  refresh();
  return { ok: true };
}
