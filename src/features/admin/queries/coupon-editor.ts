import "server-only";
import { paisaToRupeesInput } from "@/lib/money/parse";
import { toKathmanduInput } from "../catalog-forms";
import { couponState, type CouponState } from "../states";
import { adminDb, fail } from "./shared";

/* Add/Edit coupon (promotions.manage). Form values are the strings the inputs hold. */

export type CouponFormValues = {
  code: string;
  description: string;
  type: "percentage" | "fixed";
  percentOff: string;
  maxDiscount: string;
  amountOff: string;
  minOrder: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
  isActive: boolean;
};

export function emptyCouponValues(now: Date = new Date()): CouponFormValues {
  return {
    code: "",
    description: "",
    type: "percentage",
    percentOff: "",
    maxDiscount: "",
    amountOff: "",
    minOrder: "",
    startsAt: toKathmanduInput(now.toISOString()),
    endsAt: "",
    usageLimit: "",
    usageLimitPerCustomer: "",
    isActive: true,
  };
}

export type CouponEditorData = {
  id: string;
  values: CouponFormValues;
  timesUsed: number;
  /** Orders that used the coupon: its code and type are locked, and it can't be deleted. */
  orderCount: number;
  state: CouponState;
  updatedAt: string;
};

const numberInput = (value: number | null) => (value === null ? "" : String(value));

export async function fetchCouponEditor(id: string): Promise<CouponEditorData | null> {
  const db = adminDb();
  const [coupon, counts] = await Promise.all([db.from("coupons").select("*").eq("id", id).maybeSingle(), fetchCouponOrderCounts()]);
  if (coupon.error) fail("coupon editor", coupon.error);
  const row = coupon.data;
  if (!row) return null;

  return {
    id: row.id,
    values: {
      code: row.code,
      description: row.description,
      type: row.type,
      percentOff: numberInput(row.percent_off),
      maxDiscount: paisaToRupeesInput(row.max_discount_paisa),
      amountOff: paisaToRupeesInput(row.amount_off_paisa),
      minOrder: paisaToRupeesInput(row.min_order_paisa),
      startsAt: toKathmanduInput(row.starts_at),
      endsAt: toKathmanduInput(row.ends_at),
      usageLimit: numberInput(row.usage_limit),
      usageLimitPerCustomer: numberInput(row.usage_limit_per_customer),
      isActive: row.is_active,
    },
    timesUsed: row.times_used,
    orderCount: counts.get(row.id) ?? 0,
    state: couponState({ isActive: row.is_active, startsAt: row.starts_at, endsAt: row.ends_at, usageLimit: row.usage_limit, timesUsed: row.times_used }),
    updatedAt: row.updated_at,
  };
}

/** Orders per coupon, from a definer function (the caller may not have orders.read). */
export async function fetchCouponOrderCounts(): Promise<Map<string, number>> {
  const { data, error } = await adminDb().rpc("admin_coupon_order_counts");
  if (error) fail("coupon order counts", error);
  return new Map(data.map((row) => [row.coupon_id, Number(row.order_count)]));
}
