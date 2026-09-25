// @vitest-environment node
import { describe, expect, it } from "vitest";
import { areaPath, compactRupees, linePath, niceTicks, scaleLinear, seriesPoints } from "./charts";
import { formatNepalPhone, humanize, initials, relativeTime, shortName } from "./format";
import { describeChange, formatChange, percentChange } from "./metrics";
import { canAccess, isNavItemActive, visibleNav } from "./nav";
import { canAssignCourier, canCancel, canRefund, forwardTransition } from "./order-transitions";
import { containsPattern, orderNumberTerm, sanitizeSearch } from "./search-input";

describe("percentChange", () => {
  it("rounds to one decimal with a direction", () => {
    expect(percentChange(112500, 100000)).toEqual({ kind: "change", direction: "up", percent: 12.5 });
    expect(percentChange(90, 100)).toEqual({ kind: "change", direction: "down", percent: 10 });
  });

  it("reports new and flat without dividing by zero", () => {
    expect(percentChange(5, 0)).toEqual({ kind: "new" });
    expect(percentChange(0, 0)).toEqual({ kind: "flat" });
    expect(percentChange(100000, 100001)).toEqual({ kind: "flat" });
  });

  it("describes the change in words, not only colour", () => {
    expect(formatChange(percentChange(118.2, 100))).toBe("18.2%");
    expect(describeChange(percentChange(118.2, 100), "vs last month")).toBe("up 18.2% vs last month");
    expect(describeChange({ kind: "new" }, "vs last month")).toBe("new since last month");
  });
});

describe("chart geometry", () => {
  it("scales and draws paths", () => {
    expect(scaleLinear(5, [0, 10], [100, 0])).toBe(50);
    expect(scaleLinear(5, [5, 5], [0, 10])).toBe(5);
    expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 2.345 }])).toBe("M0 10 L5 2.35");
    expect(areaPath([{ x: 0, y: 10 }, { x: 5, y: 2 }], 20)).toBe("M0 10 L5 2 L5 20 L0 20 Z");
    expect(areaPath([], 20)).toBe("");
  });

  it("spreads points across the width and handles a single value", () => {
    expect(seriesPoints([0, 10], { width: 100, height: 50 })).toEqual([{ x: 0, y: 50 }, { x: 100, y: 0 }]);
    expect(seriesPoints([3], { width: 100, height: 50 })[0]!.x).toBe(50);
    expect(seriesPoints([], { width: 100, height: 50 })).toEqual([]);
  });

  it("picks clean ticks that cover the maximum", () => {
    expect(niceTicks(3_800_000)).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]);
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it("labels rupees in K / L / Cr from paisa", () => {
    expect(compactRupees(4_000_000)).toBe("40K");
    expect(compactRupees(12_000_000)).toBe("1.2L");
    expect(compactRupees(0)).toBe("0");
    expect(compactRupees(3_000_000_000)).toBe("3Cr");
  });
});

describe("formatting", () => {
  const now = new Date("2026-09-25T06:00:00Z");

  it("shows relative times", () => {
    expect(relativeTime("2026-09-25T05:59:30Z", now)).toBe("Just now");
    expect(relativeTime("2026-09-25T05:48:00Z", now)).toBe("12 min ago");
    expect(relativeTime("2026-09-25T05:00:00Z", now)).toBe("1 hour ago");
    expect(relativeTime("2026-09-24T05:00:00Z", now)).toBe("Yesterday");
    expect(relativeTime("2026-09-10T05:00:00Z", now)).toBe("Sep 10, 2026");
  });

  it("shortens names like the reference", () => {
    expect(shortName("Priya Shrestha")).toBe("Priya S.");
    expect(shortName("  Rahul  ")).toBe("Rahul");
    expect(shortName(null)).toBe("Guest");
    expect(initials("Asha Maya Shrestha")).toBe("AS");
  });

  it("formats Nepal mobiles and enum labels", () => {
    expect(formatNepalPhone("+9779812345678")).toBe("+977 981-2345678");
    expect(formatNepalPhone("+97714123456")).toBe("+97714123456");
    expect(humanize("out_for_delivery")).toBe("Out for delivery");
  });
});

describe("admin navigation", () => {
  const owner = { role: "owner", permissions: [] } as const;
  const fulfilment = { role: "staff", permissions: ["orders.read", "orders.write"] } as const;
  const customer = { role: "customer", permissions: ["orders.read"] } as const;

  it("shows the owner everything, grouped as in the reference", () => {
    const groups = visibleNav(owner);
    expect(groups.map((group) => group.label)).toEqual(["Overview", "Catalog", "Sales", "Customers", "Content", "System"]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(18);
  });

  it("shows staff only what they may open and drops empty groups", () => {
    const labels = visibleNav(fulfilment).flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(["Dashboard", "Orders", "Payments", "Support"]);
    expect(canAccess(fulfilment, "owner")).toBe(false);
  });

  it("gives customers nothing", () => {
    expect(visibleNav(customer)).toEqual([]);
    expect(canAccess(customer, "admin")).toBe(false);
  });

  it("matches the dashboard exactly and sections by prefix", () => {
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin/orders", "/admin")).toBe(false);
    expect(isNavItemActive("/admin/orders/GT2609241234", "/admin/orders")).toBe(true);
    expect(isNavItemActive("/admin/ordersx", "/admin/orders")).toBe(false);
  });
});

describe("order transitions", () => {
  it("offers the next step and cancel until the end", () => {
    expect(forwardTransition("pending_confirmation")).toBe("confirmed");
    expect(forwardTransition("shipped")).toBe("delivered");
    expect(forwardTransition("delivered")).toBeNull();
    expect(canCancel("shipped")).toBe(true);
    expect(canCancel("delivered")).toBe(false);
  });

  it("limits courier assignment and refunds", () => {
    expect(canAssignCourier("pending_confirmation")).toBe(false);
    expect(canAssignCourier("packed")).toBe(true);
    expect(canAssignCourier("shipped")).toBe(false);
    expect(canRefund("delivered", "collected")).toBe(true);
    expect(canRefund("delivered", "refunded")).toBe(false);
  });
});

describe("search input", () => {
  it("strips filter syntax and caps the length", () => {
    expect(sanitizeSearch("  pearl,drop(earrings)*  ")).toBe("pearl drop earrings");
    expect(sanitizeSearch("priya@example.com")).toBe("priya@example.com");
    expect(sanitizeSearch("x".repeat(100))).toHaveLength(64);
    expect(sanitizeSearch(["a", "b"])).toBe("a");
    expect(sanitizeSearch(42)).toBe("");
  });

  it("escapes LIKE wildcards", () => {
    expect(containsPattern("50_off")).toBe("%50\\_off%");
  });

  it("recognises order numbers with or without the prefix", () => {
    expect(orderNumberTerm("gt2609241234")).toBe("GT2609241234");
    expect(orderNumberTerm("2609241234")).toBe("2609241234");
    expect(orderNumberTerm("pearl")).toBeNull();
  });
});

describe("quotedFilterValue", () => {
  it("doubles backslashes so LIKE escapes survive PostgREST unquoting", async () => {
    const { quotedFilterValue } = await import("./search-input");
    expect(quotedFilterValue(String.raw`%50\_off%`)).toBe(String.raw`"%50\\_off%"`);
  });
});
