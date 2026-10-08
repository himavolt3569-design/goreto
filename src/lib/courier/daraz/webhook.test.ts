// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractIdentifiers } from "./webhook";

describe("extractIdentifiers", () => {
  it("finds tracking numbers and package codes in any shape", () => {
    expect(
      extractIdentifiers({
        seller_id: "1",
        message_type: 14,
        data: { trade_order_id: "57244869716603", fulfillment_package_id: "FP018711048499663", status: "DELIVERED" },
      }),
    ).toEqual(["FP018711048499663"]);
    expect(
      extractIdentifiers({ data: [{ trackingNumber: "NPDEX1001" }, { package: { packageCode: "FU-MOCK-1001", tracking_number: "NPDEX1001" } }] }),
    ).toEqual(["NPDEX1001", "FU-MOCK-1001"]);
  });

  it("ignores values that can't be identifiers", () => {
    expect(extractIdentifiers({ trackingNumber: "x" })).toEqual([]);
    expect(extractIdentifiers({ trackingNumber: "drop table;--" })).toEqual([]);
    expect(extractIdentifiers({ trackingNumber: { nested: true } })).toEqual([]);
    expect(extractIdentifiers("NPDEX1001")).toEqual([]);
    expect(extractIdentifiers(null)).toEqual([]);
  });

  it("caps how many it returns", () => {
    const many = { items: Array.from({ length: 50 }, (_, index) => ({ trackingNumber: `NPDEX${1000 + index}` })) };
    expect(extractIdentifiers(many, 5)).toHaveLength(5);
  });
});
