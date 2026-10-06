import "server-only";
import type { MediaImage } from "@/components/ui/media-frame";
import { isValidSlug } from "@/features/catalog/slug";
import { productMediaImage } from "@/lib/media/storage";
import { pageRange, toPage, type Page } from "@/lib/pagination/page";
import { getPublicSupabase } from "@/lib/supabase/public";
import { getUserSupabase } from "@/lib/supabase/server";
import { toRatingBreakdown, toPublicReview, type PublicReview, type RatingBreakdown } from "./mappers";
import type { ReviewStatus } from "./schema";

/*
 * Review reads (AGENTS §4.2, §4.9).
 * - Storefront: the anon client and the product_reviews / product_rating_breakdown
 *   functions, so product pages stay cacheable and expose no ids.
 * - Account: the Clerk-token client, filtered to the caller's own profile.
 * Reads throw; the page error boundaries offer a retry.
 */

export const PRODUCT_PAGE_REVIEWS = 4;
export const REVIEWS_PAGE_SIZE = 10;
export const ACCOUNT_REVIEWS_PAGE_SIZE = 10;

function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Review query failed (${what}): ${error.code ?? ""} ${error.message}`.trim());
}

export async function fetchRatingBreakdown(productSlug: string): Promise<RatingBreakdown> {
  const { data, error } = await getPublicSupabase().rpc("product_rating_breakdown", { p_product_slug: productSlug });
  if (error) fail("breakdown", error);
  return toRatingBreakdown(data);
}

/** Published reviews, newest first. */
export async function fetchPublishedReviews(productSlug: string, limit: number, offset = 0): Promise<PublicReview[]> {
  const { data, error } = await getPublicSupabase().rpc("product_reviews", {
    p_product_slug: productSlug,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) fail("reviews", error);
  return data.map(toPublicReview);
}

/** The product page's summary plus its latest reviews. */
export async function fetchProductReviewSummary(
  productSlug: string,
): Promise<{ breakdown: RatingBreakdown; latest: PublicReview[] }> {
  const [breakdown, latest] = await Promise.all([
    fetchRatingBreakdown(productSlug),
    fetchPublishedReviews(productSlug, PRODUCT_PAGE_REVIEWS),
  ]);
  return { breakdown, latest };
}

export async function fetchReviewPage(productSlug: string, page: number): Promise<{ breakdown: RatingBreakdown; reviews: Page<PublicReview> }> {
  const [from] = pageRange(page, REVIEWS_PAGE_SIZE);
  const [breakdown, rows] = await Promise.all([
    fetchRatingBreakdown(productSlug),
    fetchPublishedReviews(productSlug, REVIEWS_PAGE_SIZE, from),
  ]);
  return { breakdown, reviews: toPage(rows, breakdown.count, page, REVIEWS_PAGE_SIZE) };
}

/* ---------- Account ---------- */

export type OwnReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  product: { title: string; slug: string; isActive: boolean };
};

/** The caller's own reviews, most recently changed first. */
export async function fetchOwnReviews(profileId: string, page: number): Promise<Page<OwnReview>> {
  const { data, error, count } = await getUserSupabase()
    .from("reviews")
    .select("id, rating, title, body, status, created_at, updated_at, products(title, slug, status)", { count: "exact" })
    .eq("user_id", profileId)
    .order("updated_at", { ascending: false })
    .order("id")
    .range(...pageRange(page, ACCOUNT_REVIEWS_PAGE_SIZE));
  if (error) fail("own reviews", error);

  const rows = data.map((row) => ({
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    product: {
      title: row.products?.title ?? "Product no longer available",
      slug: row.products?.slug ?? "",
      isActive: row.products?.status === "active",
    },
  }));
  return toPage(rows, count, page, ACCOUNT_REVIEWS_PAGE_SIZE);
}

export type ReviewableProduct = { slug: string; title: string; image: MediaImage | null; deliveredAt: string };

/** Delivered products the caller hasn't reviewed yet (at most 20). */
export async function fetchReviewableProducts(): Promise<ReviewableProduct[]> {
  const { data, error } = await getUserSupabase().rpc("account_reviewable_products");
  if (error) fail("reviewable products", error);
  return data.map((row) => ({
    slug: row.slug,
    title: row.title,
    image: productMediaImage(row.image_path, ""),
    deliveredAt: row.delivered_at,
  }));
}

export type ReviewTarget = {
  product: { id: string; slug: string; title: string; image: MediaImage | null };
  /** True when the caller has a delivered order containing the product. */
  isVerifiedBuyer: boolean;
  existing: Pick<OwnReview, "id" | "rating" | "title" | "body" | "status"> | null;
};

/**
 * What the write/edit page needs: the active product, whether the caller may
 * review it (the same rule submit_review enforces) and their current review.
 * Null for an unknown or inactive product.
 */
export async function fetchReviewTarget(profileId: string, productSlug: string): Promise<ReviewTarget | null> {
  if (!isValidSlug(productSlug)) return null;
  const db = getUserSupabase();
  const { data: product, error } = await db
    .from("products")
    .select("id, slug, title, product_media(storage_path, alt_text, sort_order, kind)")
    .eq("slug", productSlug)
    .eq("status", "active")
    .maybeSingle();
  if (error) fail("review product", error);
  if (!product) return null;

  const [purchase, review] = await Promise.all([
    db
      .from("order_items")
      .select("id, orders!inner(user_id, status)")
      .eq("product_id", product.id)
      .eq("orders.user_id", profileId)
      .eq("orders.status", "delivered")
      .limit(1),
    db
      .from("reviews")
      .select("id, rating, title, body, status")
      .eq("user_id", profileId)
      .eq("product_id", product.id)
      .maybeSingle(),
  ]);
  if (purchase.error) fail("review eligibility", purchase.error);
  if (review.error) fail("existing review", review.error);

  const cover = product.product_media
    .filter((media) => media.kind === "image")
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      image: cover ? productMediaImage(cover.storage_path, cover.alt_text ?? "") : null,
    },
    isVerifiedBuyer: purchase.data.length > 0,
    existing: review.data,
  };
}
