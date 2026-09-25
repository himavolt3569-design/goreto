/* Derived display states for admin rows. Pure, so they can be unit-tested. */

export type StockState = "in_stock" | "low_stock" | "sold_out";

/** Worst state across a product's active variants, against its low-stock threshold. */
export function stockStateFor(stocks: readonly number[], threshold: number): StockState {
  if (stocks.length === 0 || stocks.every((stock) => stock === 0)) return "sold_out";
  return stocks.some((stock) => stock <= threshold) ? "low_stock" : "in_stock";
}

export type CouponState = "active" | "scheduled" | "expired" | "exhausted" | "disabled";

export function couponState(
  coupon: { isActive: boolean; startsAt: string; endsAt: string | null; usageLimit: number | null; timesUsed: number },
  now: Date = new Date(),
): CouponState {
  if (!coupon.isActive) return "disabled";
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) return "exhausted";
  if (new Date(coupon.startsAt) > now) return "scheduled";
  if (coupon.endsAt && new Date(coupon.endsAt) <= now) return "expired";
  return "active";
}

export type CollectionState = "live" | "scheduled" | "ended" | "inactive";

export function collectionState(
  collection: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: Date = new Date(),
): CollectionState {
  if (!collection.isActive) return "inactive";
  if (collection.startsAt && new Date(collection.startsAt) > now) return "scheduled";
  if (collection.endsAt && new Date(collection.endsAt) <= now) return "ended";
  return "live";
}
