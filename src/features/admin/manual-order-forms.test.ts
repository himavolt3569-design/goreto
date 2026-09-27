// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fieldErrors } from "./schemas";
import { emptyManualOrder, manualOrderFailure, manualOrderSchema, type ManualOrderValues } from "./manual-order-forms";

const VARIANT = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";
const SERVICE = "00000000-0000-4000-8000-000000000001";

const order = (overrides: Partial<ManualOrderValues> = {}): ManualOrderValues => ({
  ...emptyManualOrder(),
  fullName: " Sita Gurung ",
  phone: "9812345678",
  items: [{ variantId: VARIANT, quantity: 2 }],
  provinceCode: "gandaki",
  districtCode: "kaski",
  municipalityCode: "pokhara",
  ward: "6",
  streetLandmark: "Lakeside",
  courierServiceId: SERVICE,
  ...overrides,
});

const errorsOf = (values: ManualOrderValues) => {
  const result = manualOrderSchema.safeParse(values);
  return result.success ? {} : fieldErrors(result.error);
};

describe("manualOrderSchema", () => {
  it("normalises the customer and uses the phone as the WhatsApp number by default", () => {
    expect(manualOrderSchema.parse(order())).toMatchObject({
      customerId: null,
      fullName: "Sita Gurung",
      phone: "+9779812345678",
      whatsappE164: "+9779812345678",
      email: null,
      ward: 6,
      couponCode: "",
    });
  });

  it("takes a separate WhatsApp number and an optional email", () => {
    const parsed = manualOrderSchema.parse(order({ whatsappSameAsPhone: false, whatsapp: "+977 980-1234567", email: " Sita@Example.com " }));
    expect(parsed.whatsappE164).toBe("+9779801234567");
    expect(parsed.email).toBe("sita@example.com");
    expect(parsed).not.toHaveProperty("whatsapp");
    expect(parsed).not.toHaveProperty("whatsappSameAsPhone");
  });

  it("rejects bad numbers, emails, empty carts and missing address parts on the right field", () => {
    expect(errorsOf(order({ whatsappSameAsPhone: false, whatsapp: "+14155552671" })).whatsapp).toMatch(/Nepal WhatsApp/);
    expect(errorsOf(order({ phone: "12345" })).phone).toMatch(/Nepal/);
    expect(errorsOf(order({ email: "nope" })).email).toMatch(/valid email/);
    expect(errorsOf(order({ items: [] })).items).toBe("Your cart is empty.");
    expect(errorsOf(order({ ward: "" })).ward).toBe("Choose a ward");
    expect(errorsOf(order({ courierServiceId: "" })).courierServiceId).toBe("Choose a delivery option");
    expect(errorsOf(order({ customerId: "not-an-id" })).customerId).toBeDefined();
  });

  it("has no price fields for the browser to set", () => {
    const keys = Object.keys(manualOrderSchema.parse(order()));
    expect(keys.filter((key) => /price|total|fee|discount|paisa/i.test(key))).toEqual([]);
  });
});

describe("manualOrderFailure", () => {
  it("words database errors for staff and keeps line issues", () => {
    const stock = manualOrderFailure({
      code: "P0001",
      message: "checkout:stock_changed",
      details: JSON.stringify([{ variant_id: VARIANT, status: "insufficient_stock", available_quantity: 1 }]),
    });
    expect(stock.message).toMatch(/Stock changed/);
    expect(stock.lineIssues).toEqual([{ variantId: VARIANT, status: "insufficient_stock", availableQuantity: 1 }]);

    expect(manualOrderFailure({ code: "P0001", message: "checkout:cod_disabled" }).message).toMatch(/turned off in Settings/);
    expect(manualOrderFailure({ code: "22023", message: "checkout:invalid_contact", details: "whatsapp" }).message).toBe("Check the WhatsApp number.");
    expect(manualOrderFailure({ code: "42501", message: "customers.read required to link a customer" }).message).toMatch(/can't link/);
    expect(manualOrderFailure({ code: "22023", message: "That customer account isn't available.", details: "customerId" }).fieldErrors).toEqual({
      customerId: "That customer account isn't available.",
    });
  });
});
