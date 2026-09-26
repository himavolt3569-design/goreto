import { formatNpr } from "@/lib/money/format";

/* One-line coupon summaries for the coupon list and the editor's live preview. */

export type CouponDiscount = {
  type: "percentage" | "fixed";
  percentOff: number | null;
  amountOffPaisa: number | null;
  maxDiscountPaisa: number | null;
};

/** "15% off (up to Rs. 1,500)" or "Rs. 200 off". */
export function couponDiscountLabel(coupon: CouponDiscount): string {
  if (coupon.type === "percentage") {
    const cap = coupon.maxDiscountPaisa ? ` (up to ${formatNpr(coupon.maxDiscountPaisa)})` : "";
    return `${coupon.percentOff ?? "?"}% off${cap}`;
  }
  return `${coupon.amountOffPaisa ? formatNpr(coupon.amountOffPaisa) : "Rs. ?"} off`;
}

/** Discount plus the minimum order, e.g. "15% off (up to Rs. 1,500) on orders from Rs. 3,000". */
export function couponSummary(coupon: CouponDiscount & { minOrderPaisa: number | null }): string {
  const minimum = coupon.minOrderPaisa ? ` on orders from ${formatNpr(coupon.minOrderPaisa)}` : " on any order";
  return `${couponDiscountLabel(coupon)}${minimum}`;
}
