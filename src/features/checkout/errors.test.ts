import { describe, expect, it } from "vitest";
import { checkoutFailureFromError, couponErrorMessage, GENERIC_FAILURE } from "./errors";

describe("checkoutFailureFromError", () => {
  it("turns a stock change into cart fixes", () => {
    const failure = checkoutFailureFromError({
      message: "checkout:stock_changed",
      details: JSON.stringify([
        { variant_id: "a", status: "insufficient_stock", available_quantity: 1 },
        { variant_id: "b", status: "unavailable", available_quantity: 0 },
        { variant_id: "c", status: "ok", available_quantity: 3 },
      ]),
    });
    expect(failure.lineIssues).toEqual([
      { variantId: "a", status: "insufficient_stock", availableQuantity: 1 },
      { variantId: "b", status: "unavailable", availableQuantity: 0 },
    ]);
  });

  it("explains coupon and COD refusals", () => {
    expect(
      checkoutFailureFromError({ message: "checkout:coupon_invalid", details: '{"code":"X","error":"min_order","min_order_paisa":200000}' }),
    ).toMatchObject({ couponError: "min_order", message: "This coupon needs a subtotal of at least Rs. 2,000." });
    expect(checkoutFailureFromError({ message: "checkout:cod_limit", details: '{"cod_max_order_paisa":5000000}' }).message).toBe(
      "Cash on delivery orders can be up to Rs. 50,000. Please remove some items.",
    );
  });

  it("never exposes unknown database errors", () => {
    expect(checkoutFailureFromError({ message: 'relation "orders" does not exist' }).message).toBe(GENERIC_FAILURE);
    expect(checkoutFailureFromError({ message: "checkout:stock_changed", details: "not json" }).lineIssues).toEqual([]);
  });

  it("has a message for every coupon error", () => {
    for (const error of ["not_found", "not_started", "expired", "usage_limit", "customer_limit", "min_order"] as const) {
      expect(couponErrorMessage(error)).not.toBe("");
    }
  });
});
