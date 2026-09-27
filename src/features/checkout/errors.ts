import { formatNpr } from "@/lib/money/format";
import { COUPON_ERRORS, type CouponError, type QuoteLineStatus } from "./quote";

/*
 * place_order raises `checkout:<reason>` with an optional JSON DETAIL
 * (migration checkout_place_order). This turns those into messages a shopper
 * can act on, and into cart fixes for stock changes.
 */

export type LineIssue = { variantId: string; status: Exclude<QuoteLineStatus, "ok">; availableQuantity: number };

export type CheckoutFailure = {
  ok: false;
  message: string;
  /** Present when stock changed: the checkout fixes these cart lines. */
  lineIssues?: LineIssue[];
  /** Present when the coupon no longer applies. */
  couponError?: CouponError;
};

type DatabaseError = { code?: string; message: string; details?: string | null };

export const GENERIC_FAILURE = "We couldn't place your order. Please try again in a moment.";

export function couponErrorMessage(error: CouponError, minOrderPaisa?: number | null): string {
  switch (error) {
    case "not_found":
      return "This coupon code isn't valid.";
    case "not_started":
      return "This coupon isn't active yet.";
    case "expired":
      return "This coupon has expired.";
    case "usage_limit":
      return "This coupon has reached its usage limit.";
    case "customer_limit":
      return "You've already used this coupon.";
    case "min_order":
      return minOrderPaisa
        ? `This coupon needs a subtotal of at least ${formatNpr(minOrderPaisa)}.`
        : "Your subtotal is too low for this coupon.";
  }
}

function parseDetail(details: string | null | undefined): unknown {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function lineIssues(detail: unknown): LineIssue[] {
  if (!Array.isArray(detail)) return [];
  return detail.flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { variant_id, status, available_quantity } = entry as Record<string, unknown>;
    if (typeof variant_id !== "string" || (status !== "unavailable" && status !== "insufficient_stock")) return [];
    return [{ variantId: variant_id, status, availableQuantity: typeof available_quantity === "number" ? available_quantity : 0 }];
  });
}

export function checkoutFailureFromError(error: DatabaseError): CheckoutFailure {
  const reason = /^checkout:([a-z_]+)$/.exec(error.message)?.[1];
  const detail = parseDetail(error.details);

  switch (reason) {
    case "stock_changed":
      return {
        ok: false,
        message: "Some items in your cart just changed. We've updated them. Please review and place your order again.",
        lineIssues: lineIssues(detail),
      };
    case "delivery_unavailable":
      return { ok: false, message: "That delivery option isn't available for this address anymore. Please choose another." };
    case "coupon_invalid": {
      const record = (detail ?? {}) as Record<string, unknown>;
      const couponError = COUPON_ERRORS.find((value) => value === record.error) ?? "not_found";
      const minOrder = typeof record.min_order_paisa === "number" ? record.min_order_paisa : null;
      return { ok: false, message: couponErrorMessage(couponError, minOrder), couponError };
    }
    case "cod_disabled":
      return { ok: false, message: "Cash on delivery is paused right now, so we can't take orders. Please try again later." };
    case "cod_limit": {
      const record = (detail ?? {}) as Record<string, unknown>;
      const limit = typeof record.cod_max_order_paisa === "number" ? record.cod_max_order_paisa : null;
      return {
        ok: false,
        message: limit
          ? `Cash on delivery orders can be up to ${formatNpr(limit)}. Please remove some items.`
          : "This order is above the cash on delivery limit. Please remove some items.",
      };
    }
    case "invalid_contact":
      return { ok: false, message: "Please check your name, email and phone number." };
    case "invalid_address":
      return { ok: false, message: "Please check your address. The ward must exist in the chosen municipality." };
    case "invalid_items":
      return { ok: false, message: "Your cart has an item we can't order. Please review your cart." };
    default:
      return { ok: false, message: GENERIC_FAILURE };
  }
}
