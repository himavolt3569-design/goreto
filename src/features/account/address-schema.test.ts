import { describe, expect, it } from "vitest";
import { addressFailureFromError, addressFormSchema, EMPTY_ADDRESS, type AddressFormValues } from "./address-schema";

const valid: AddressFormValues = {
  ...EMPTY_ADDRESS,
  label: "  Home ",
  recipientName: "Sita Sharma",
  phone: "9812345678",
  provinceCode: "bagmati",
  districtCode: "kathmandu",
  municipalityCode: "kathmandu-metropolitan-city",
  ward: "26",
  streetLandmark: "Thamel Chowk",
  postalCode: "44600",
};

describe("addressFormSchema", () => {
  it("trims text, normalises the phone to E.164 and turns the ward into a number", () => {
    const parsed = addressFormSchema.parse(valid);
    expect(parsed.label).toBe("Home");
    expect(parsed.phone).toBe("+9779812345678");
    expect(parsed.ward).toBe(26);
    expect(parsed.makeDefault).toBe(false);
  });

  it("allows an empty postal code but not a malformed one", () => {
    expect(addressFormSchema.safeParse({ ...valid, postalCode: "" }).success).toBe(true);
    expect(addressFormSchema.safeParse({ ...valid, postalCode: "4460" }).success).toBe(false);
  });

  it("reports each missing field with its own message", () => {
    const result = addressFormSchema.safeParse({ ...EMPTY_ADDRESS, label: "" });
    expect(result.success).toBe(false);
    const fields = new Set(result.error!.issues.map((issue) => issue.path[0]));
    for (const field of ["label", "recipientName", "phone", "provinceCode", "districtCode", "municipalityCode", "ward", "streetLandmark"]) {
      expect(fields.has(field)).toBe(true);
    }
  });

  it("rejects a non-Nepal phone and an over-long label", () => {
    expect(addressFormSchema.safeParse({ ...valid, phone: "+14155552671" }).success).toBe(false);
    expect(addressFormSchema.safeParse({ ...valid, label: "x".repeat(41) }).success).toBe(false);
  });
});

describe("addressFailureFromError", () => {
  it("maps the database codes to friendly messages", () => {
    expect(addressFailureFromError({ code: "54000", message: "" }).message).toMatch(/up to 10 addresses/);
    expect(addressFailureFromError({ code: "P0002", message: "" }).message).toMatch(/no longer exists/);
    expect(addressFailureFromError({ code: "23514", message: "" }).fieldErrors).toEqual({ ward: "Choose a ward in this municipality" });
    expect(addressFailureFromError({ code: "XX000", message: "boom" }).message).toMatch(/couldn't save/);
  });
});
