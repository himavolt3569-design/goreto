import { describe, expect, it } from "vitest";
import { cartItemsSchema, checkoutFormSchema, type CheckoutFormValues } from "./schemas";

const valid: CheckoutFormValues = {
  fullName: " Aarushi Shrestha ",
  email: "Aarushi@Example.com",
  phone: "9841234567",
  provinceCode: "bagmati",
  districtCode: "kathmandu",
  municipalityCode: "kathmandu-metro",
  ward: "26",
  streetLandmark: "Thamel, near Garden of Dreams",
  postalCode: "44600",
  latitude: null,
  longitude: null,
  courierServiceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  couponCode: " save10 ",
  note: "",
};

describe("checkoutFormSchema", () => {
  it("normalizes contact details and the ward", () => {
    const parsed = checkoutFormSchema.parse(valid);
    expect(parsed).toMatchObject({
      fullName: "Aarushi Shrestha",
      email: "aarushi@example.com",
      phone: "+9779841234567",
      ward: 26,
      couponCode: "SAVE10",
    });
  });

  it("accepts a number typed with +977", () => {
    expect(checkoutFormSchema.parse({ ...valid, phone: "+977 984-1234567" }).phone).toBe("+9779841234567");
  });

  it("gives field messages for missing or invalid values", () => {
    const result = checkoutFormSchema.safeParse({ ...valid, phone: "12345", ward: "", courierServiceId: "", postalCode: "446" });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]));
    expect(messages).toMatchObject({
      phone: "Enter a valid Nepal mobile or landline number",
      ward: "Choose a ward",
      courierServiceId: "Choose a delivery option",
      postalCode: "Postal codes have 5 digits",
    });
  });
});

describe("cartItemsSchema", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("rejects empty, duplicate and out-of-range items", () => {
    expect(cartItemsSchema.safeParse([]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ variantId: id, quantity: 1 }, { variantId: id, quantity: 2 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ variantId: id, quantity: 11 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ variantId: "not-a-uuid", quantity: 1 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ variantId: id, quantity: 10 }]).success).toBe(true);
  });
});
