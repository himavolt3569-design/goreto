import { describe, expect, it } from "vitest";
import { billingLine } from "./billing";

describe("billingLine", () => {
  it("counts collected COD as billed", () => {
    expect(billingLine("delivered", "collected")).toMatchObject({ bucket: "billed", label: "Paid" });
  });

  it("counts COD on a live order as pending", () => {
    expect(billingLine("pending_confirmation", "pending")).toMatchObject({ bucket: "pending", label: "Pay on delivery" });
    expect(billingLine("shipped", "pending").bucket).toBe("pending");
  });

  it("excludes canceled, refunded and failed orders", () => {
    expect(billingLine("canceled", "pending")).toMatchObject({ bucket: "excluded", label: "Canceled" });
    expect(billingLine("delivered", "refunded")).toMatchObject({ bucket: "excluded", label: "Refunded" });
    expect(billingLine("delivered", "failed")).toMatchObject({ bucket: "excluded", label: "Not collected" });
  });
});
