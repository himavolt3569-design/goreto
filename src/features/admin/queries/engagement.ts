import "server-only";
import type { Database } from "@/types/database";
import { collectionState, couponState, type CollectionState, type CouponState } from "../states";
import { adminDb, fail, pageRange, toPage, type Page } from "./shared";

export type { CollectionState, CouponState };

/* Reviews (reviews.manage), coupons (promotions.manage), collections and newsletter (content.manage). */

export type ReviewStatus = Database["public"]["Enums"]["review_status"];
export const REVIEW_STATUSES: readonly ReviewStatus[] = ["pending", "published", "rejected"];

export type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  productId: string;
  productTitle: string;
  productSlug: string | null;
  /** Null when the viewer lacks customers.read (profiles are hidden by RLS). */
  authorName: string | null;
  authorId: string;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
};

export async function fetchReviews(filter: { status: ReviewStatus | null; rating: number | null; page: number }): Promise<Page<ReviewRow>> {
  let query = adminDb()
    .from("reviews")
    .select(
      "id, rating, title, body, status, order_item_id, moderation_note, moderated_at, created_at, user_id, products(id, title, slug), profiles!reviews_user_id_fkey(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id");
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.rating) query = query.eq("rating", filter.rating);
  const { data, error, count } = await query.range(...pageRange(filter.page));
  if (error) fail("reviews", error);
  const rows = data.map((row) => ({
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    verifiedPurchase: row.order_item_id !== null,
    productId: row.products?.id ?? "",
    productTitle: row.products?.title ?? "Unknown product",
    productSlug: row.products?.slug ?? null,
    authorName: row.profiles?.full_name ?? null,
    authorId: row.user_id,
    moderationNote: row.moderation_note,
    moderatedAt: row.moderated_at,
    createdAt: row.created_at,
  }));
  return toPage(rows, count, filter.page);
}

export async function countReviewsByStatus(): Promise<Record<ReviewStatus, number>> {
  const results = await Promise.all(
    REVIEW_STATUSES.map(async (status) => {
      const { count, error } = await adminDb().from("reviews").select("id", { count: "exact", head: true }).eq("status", status);
      if (error) fail("review counts", error);
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<ReviewStatus, number>;
}


export type CouponRow = {
  id: string;
  code: string;
  description: string;
  type: Database["public"]["Enums"]["coupon_type"];
  percentOff: number | null;
  amountOffPaisa: number | null;
  minOrderPaisa: number | null;
  maxDiscountPaisa: number | null;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  timesUsed: number;
  isActive: boolean;
  state: CouponState;
};

export async function fetchCoupons(): Promise<CouponRow[]> {
  const { data, error } = await adminDb().from("coupons").select("*").order("starts_at", { ascending: false }).order("code");
  if (error) fail("coupons", error);
  const now = new Date();
  return data.map((row) => {
    const base = {
      id: row.id,
      code: row.code,
      description: row.description,
      type: row.type,
      percentOff: row.percent_off,
      amountOffPaisa: row.amount_off_paisa,
      minOrderPaisa: row.min_order_paisa,
      maxDiscountPaisa: row.max_discount_paisa,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      usageLimit: row.usage_limit,
      timesUsed: row.times_used,
      isActive: row.is_active,
    };
    return { ...base, state: couponState(base, now) };
  });
}


export type CollectionRow = {
  id: string;
  title: string;
  slug: string;
  eyebrow: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  productCount: number;
  state: CollectionState;
};

export async function fetchCollections(): Promise<CollectionRow[]> {
  const { data, error } = await adminDb()
    .from("collections")
    .select("id, title, slug, eyebrow, starts_at, ends_at, is_active, sort_order, collection_products(count)")
    .order("sort_order")
    .order("title");
  if (error) fail("collections", error);
  const now = new Date();
  return data.map((row) => {
    const base = { isActive: row.is_active, startsAt: row.starts_at, endsAt: row.ends_at };
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      eyebrow: row.eyebrow,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      productCount: row.collection_products[0]?.count ?? 0,
      state: collectionState(base, now),
    };
  });
}

export type NewsletterSummary = {
  subscribed: number;
  unsubscribed: number;
  recent: { email: string; source: string; subscribedAt: string }[];
};

export async function fetchNewsletterSummary(): Promise<NewsletterSummary> {
  const counts = await Promise.all(
    (["subscribed", "unsubscribed"] as const).map(async (status) => {
      const { count, error } = await adminDb()
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) fail("newsletter counts", error);
      return count ?? 0;
    }),
  );
  const { data, error } = await adminDb()
    .from("newsletter_subscribers")
    .select("email, source, subscribed_at")
    .eq("status", "subscribed")
    .order("subscribed_at", { ascending: false })
    .limit(10);
  if (error) fail("newsletter", error);
  return {
    subscribed: counts[0]!,
    unsubscribed: counts[1]!,
    recent: data.map((row) => ({ email: row.email, source: row.source, subscribedAt: row.subscribed_at })),
  };
}
