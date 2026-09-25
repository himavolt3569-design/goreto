// @vitest-environment node
import { describe, expect, it } from "vitest";
import { orderTransitionSchema, reviewModerationSchema, stockAdjustSchema, storeSettingsSchema, toggleSchema } from "./schemas";

const ID = "7803b1dc-7013-5377-9807-e7a9b6e97040";

const settings = {
  storeName: "Goreto.store",
  tagline: "",
  supportEmail: " Help@Goreto.Store ",
  supportPhone: "9812345678",
  codEnabled: "on",
  codMaxOrder: "25,000",
  returnsWindowDays: "7",
  lowStockThreshold: "5",
};

describe("storeSettingsSchema", () => {
  it("normalises email, Nepal phone and rupees", () => {
    expect(storeSettingsSchema.parse(settings)).toEqual({
      storeName: "Goreto.store",
      tagline: null,
      supportEmail: "help@goreto.store",
      supportPhone: "+9779812345678",
      codEnabled: true,
      codMaxOrder: 2_500_000,
      returnsWindowDays: 7,
      lowStockThreshold: 5,
    });
  });

  it("accepts a number typed with +977 and empty optional fields", () => {
    const parsed = storeSettingsSchema.parse({ ...settings, supportPhone: "+977 981-2345678", supportEmail: "", codMaxOrder: "" });
    expect(parsed.supportPhone).toBe("+9779812345678");
    expect(parsed.supportEmail).toBeNull();
    expect(parsed.codMaxOrder).toBeNull();
  });

  it("treats a missing checkbox as off", () => {
    const rest: Partial<typeof settings> = { ...settings };
    delete rest.codEnabled;
    expect(storeSettingsSchema.parse(rest).codEnabled).toBe(false);
  });

  it("rejects bad phone, email and numbers with field messages", () => {
    const result = storeSettingsSchema.safeParse({
      ...settings,
      supportPhone: "12345",
      supportEmail: "nope",
      returnsWindowDays: "-1",
      codMaxOrder: "12.5",
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["supportPhone", "supportEmail", "returnsWindowDays", "codMaxOrder"]));
  });

  it("rejects valid numbers from other countries", () => {
    const result = storeSettingsSchema.safeParse({ ...settings, supportPhone: "+14155552671" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]).toMatchObject({ path: ["supportPhone"], message: "Enter a valid Nepal phone number" });
  });
});

describe("action schemas", () => {
  it("requires a real uuid and a known status", () => {
    expect(orderTransitionSchema.safeParse({ orderId: "1; drop", status: "confirmed" }).success).toBe(false);
    expect(orderTransitionSchema.safeParse({ orderId: ID, status: "pending_confirmation" }).success).toBe(false);
    expect(orderTransitionSchema.parse({ orderId: ID, status: "canceled", reason: "  Out of stock " }).reason).toBe("Out of stock");
  });

  it("rejects a zero or fractional stock change", () => {
    expect(stockAdjustSchema.safeParse({ variantId: ID, delta: "0" }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ variantId: ID, delta: "1.5" }).success).toBe(false);
    expect(stockAdjustSchema.parse({ variantId: ID, delta: "-3" }).delta).toBe(-3);
  });

  it("needs a note to reject a review", () => {
    expect(reviewModerationSchema.safeParse({ reviewId: ID, decision: "rejected", note: " " }).success).toBe(false);
    expect(reviewModerationSchema.safeParse({ reviewId: ID, decision: "published", note: "" }).success).toBe(true);
  });

  it("reads the target state of a toggle from the form", () => {
    expect(toggleSchema.parse({ id: ID, value: "true" }).value).toBe(true);
    expect(toggleSchema.parse({ id: ID, value: "false" }).value).toBe(false);
  });
});
