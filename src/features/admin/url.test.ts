// @vitest-environment node
import { describe, expect, it } from "vitest";
import { collectionState, couponState, stockStateFor } from "./states";
import { hrefWith } from "./url";

describe("hrefWith", () => {
  it("keeps current params, applies updates and resets the page", () => {
    expect(hrefWith("/admin/orders", { status: "shipped", page: "3", q: "" }, { payment: "pending" })).toBe(
      "/admin/orders?status=shipped&payment=pending",
    );
  });

  it("removes keys set to null and keeps an explicit page", () => {
    expect(hrefWith("/admin/orders", { status: "shipped" }, { status: null, page: 2 })).toBe("/admin/orders?page=2");
    expect(hrefWith("/admin", {}, {})).toBe("/admin");
  });
});

describe("derived states", () => {
  const now = new Date("2026-09-25T06:00:00Z");

  it("rates stock against the threshold", () => {
    expect(stockStateFor([10, 12], 5)).toBe("in_stock");
    expect(stockStateFor([10, 3], 5)).toBe("low_stock");
    expect(stockStateFor([0, 0], 5)).toBe("sold_out");
    expect(stockStateFor([], 5)).toBe("sold_out");
  });

  it("orders coupon states: disabled, used up, scheduled, expired, active", () => {
    const coupon = { isActive: true, startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z", usageLimit: 10, timesUsed: 2 };
    expect(couponState(coupon, now)).toBe("active");
    expect(couponState({ ...coupon, isActive: false }, now)).toBe("disabled");
    expect(couponState({ ...coupon, timesUsed: 10 }, now)).toBe("exhausted");
    expect(couponState({ ...coupon, startsAt: "2026-10-01T00:00:00Z", endsAt: null }, now)).toBe("scheduled");
    expect(couponState({ ...coupon, endsAt: "2026-09-20T00:00:00Z" }, now)).toBe("expired");
  });

  it("derives collection schedule states", () => {
    expect(collectionState({ isActive: true, startsAt: null, endsAt: null }, now)).toBe("live");
    expect(collectionState({ isActive: false, startsAt: null, endsAt: null }, now)).toBe("inactive");
    expect(collectionState({ isActive: true, startsAt: "2026-10-01T00:00:00Z", endsAt: null }, now)).toBe("scheduled");
    expect(collectionState({ isActive: true, startsAt: null, endsAt: "2026-09-01T00:00:00Z" }, now)).toBe("ended");
  });
});
