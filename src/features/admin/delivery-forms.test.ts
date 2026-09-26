import { describe, expect, it } from "vitest";
import { couponDiscountLabel, couponSummary } from "./coupon-label";
import { couponFormSchema, couponRow, courierFormSchema, courierServiceFormSchema, rateFormSchema, zoneFormSchema } from "./delivery-forms";
import { fieldErrors } from "./schemas";

const ID = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";
const OTHER = "00000000-0000-4000-8000-000000000001";

function errorsOf(result: { success: boolean; error?: unknown }) {
  return result.success ? {} : fieldErrors(result.error as Parameters<typeof fieldErrors>[0]);
}

const coupon = (values: Record<string, string>) =>
  couponFormSchema.safeParse({ code: "tihar15", description: "", type: "percentage", percentOff: "15", startsAt: "2026-10-20T09:00", endsAt: "", ...values });

describe("coupon form", () => {
  it("normalises the code and converts rupees and Nepal time", () => {
    const parsed = coupon({ maxDiscount: "1,000", minOrder: "2000", usageLimit: "500", isActive: "on" });
    expect(parsed.success).toBe(true);
    const row = couponRow(parsed.data!);
    expect(row).toMatchObject({
      code: "TIHAR15",
      type: "percentage",
      percent_off: 15,
      max_discount_paisa: 100_000,
      amount_off_paisa: null,
      min_order_paisa: 200_000,
      starts_at: "2026-10-20T03:15:00.000Z",
      ends_at: null,
      usage_limit: 500,
      usage_limit_per_customer: null,
      is_active: true,
    });
  });

  it("keeps only the chosen type's amount", () => {
    const parsed = coupon({ type: "fixed", percentOff: "", amountOff: "200.50" });
    expect(couponRow(parsed.data!)).toMatchObject({ type: "fixed", amount_off_paisa: 20_050, percent_off: null, max_discount_paisa: null });
  });

  it("reports each invalid field", () => {
    expect(errorsOf(coupon({ code: "no spaces!" })).code).toMatch(/letters and digits/);
    expect(errorsOf(coupon({ percentOff: "0" })).percentOff).toMatch(/1–100/);
    expect(errorsOf(coupon({ percentOff: "101" })).percentOff).toMatch(/1–100/);
    expect(errorsOf(coupon({ percentOff: "" })).percentOff).toMatch(/percentage off/);
    expect(errorsOf(coupon({ type: "fixed", percentOff: "" })).amountOff).toMatch(/amount off/);
    expect(errorsOf(coupon({ startsAt: "" })).startsAt).toMatch(/starts/);
    expect(errorsOf(coupon({ endsAt: "2026-10-19T09:00" })).endsAt).toMatch(/after the start/);
    expect(errorsOf(coupon({ usageLimit: "5", usageLimitPerCustomer: "6" })).usageLimitPerCustomer).toMatch(/total uses/);
    expect(errorsOf(coupon({ minOrder: "12.345" })).minOrder).toMatch(/rupees/);
  });

  it("labels the discount", () => {
    expect(couponDiscountLabel({ type: "percentage", percentOff: 15, amountOffPaisa: null, maxDiscountPaisa: 150_000 })).toBe("15% off (up to Rs. 1,500)");
    expect(couponSummary({ type: "fixed", percentOff: null, amountOffPaisa: 20_000, maxDiscountPaisa: null, minOrderPaisa: null })).toBe("Rs. 200 off on any order");
  });
});

describe("courier forms", () => {
  it("stores the phone as E.164 and requires https", () => {
    const parsed = courierFormSchema.safeParse({ title: "Nepal Express", slug: "nepal-express", supportPhone: "9801234567", websiteUrl: "https://example.com" });
    expect(parsed.data).toMatchObject({ supportPhone: "+9779801234567", websiteUrl: "https://example.com", isActive: false });
    const bad = courierFormSchema.safeParse({ title: "X", slug: "x", supportPhone: "12345", websiteUrl: "http://example.com" });
    expect(errorsOf(bad)).toMatchObject({ slug: expect.any(String), supportPhone: expect.stringMatching(/Nepal/), websiteUrl: expect.stringMatching(/https/) });
  });

  it("upper-cases service codes and checks the day range", () => {
    const base = { courierId: ID, name: "Standard", serviceCode: "net-std", level: "standard", description: "", minDays: "2", maxDays: "4" };
    expect(courierServiceFormSchema.safeParse(base).data).toMatchObject({ serviceId: null, serviceCode: "NET-STD", minDays: 2, maxDays: 4 });
    expect(errorsOf(courierServiceFormSchema.safeParse({ ...base, maxDays: "1" })).maxDays).toMatch(/less than the minimum/);
    expect(errorsOf(courierServiceFormSchema.safeParse({ ...base, serviceCode: "NET--STD" })).serviceCode).toMatch(/single dashes/);
    expect(errorsOf(courierServiceFormSchema.safeParse({ ...base, level: "overnight" })).level).toBeDefined();
  });
});

describe("zone form", () => {
  it("splits and de-duplicates district codes", () => {
    const parsed = zoneFormSchema.safeParse({ title: "Valley", slug: "valley", description: "", sortOrder: "10", districtCodes: "kathmandu,lalitpur,kathmandu" });
    expect(parsed.data?.districtCodes).toEqual(["kathmandu", "lalitpur"]);
    expect(zoneFormSchema.safeParse({ title: "Empty", slug: "empty", description: "", sortOrder: "0", districtCodes: "" }).data?.districtCodes).toEqual([]);
    expect(zoneFormSchema.safeParse({ title: "Bad", slug: "bad", description: "", sortOrder: "0", districtCodes: "Kath mandu" }).success).toBe(false);
  });
});

describe("rate form", () => {
  const base = { zoneId: ID, serviceId: OTHER, price: "150" };

  it("allows a free rate and optional conditions", () => {
    expect(rateFormSchema.safeParse({ ...base, price: "0" }).data).toMatchObject({ price: 0, minDays: null, maxDays: null, minOrder: null, minWeight: null });
    expect(rateFormSchema.safeParse({ ...base, minDays: "1", maxDays: "2", minWeight: "0", maxWeight: "5000" }).data).toMatchObject({
      price: 15_000,
      minDays: 1,
      maxDays: 2,
      minWeight: 0,
      maxWeight: 5000,
    });
  });

  it("reports invalid fees, ranges and choices", () => {
    expect(errorsOf(rateFormSchema.safeParse({ ...base, price: "" })).price).toMatch(/free delivery/);
    expect(errorsOf(rateFormSchema.safeParse({ ...base, price: "-5" })).price).toBeDefined();
    expect(errorsOf(rateFormSchema.safeParse({ ...base, minDays: "3" })).maxDays).toMatch(/Fill both/);
    expect(errorsOf(rateFormSchema.safeParse({ ...base, minDays: "3", maxDays: "2" })).maxDays).toMatch(/less than the minimum/);
    expect(errorsOf(rateFormSchema.safeParse({ ...base, minWeight: "500", maxWeight: "100" })).maxWeight).toMatch(/less than the minimum/);
    expect(errorsOf(rateFormSchema.safeParse({ ...base, zoneId: "" })).zoneId).toMatch(/Choose a zone/);
  });
});
