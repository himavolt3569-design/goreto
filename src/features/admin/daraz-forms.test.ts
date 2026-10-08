import { describe, expect, it } from "vitest";
import {
  boxPresetsSchema,
  boxPresetsText,
  darazBookingSchema,
  darazFeedbackSchema,
  darazLabelSchema,
  darazSettingsSchema,
  remittanceSchema,
} from "./daraz-forms";

const ORDER = "e63365dd-2c34-5efa-88d6-f4c99a6badf0";

describe("box sizes", () => {
  it("reads 'Name: L x W x H' lines and writes them back", () => {
    const parsed = boxPresetsSchema.safeParse("Small: 20 x 15 x 5\nMedium : 30×20×10.5\n\n");
    expect(parsed.success && parsed.data).toEqual([
      { name: "Small", length_cm: 20, width_cm: 15, height_cm: 5 },
      { name: "Medium", length_cm: 30, width_cm: 20, height_cm: 10.5 },
    ]);
    expect(boxPresetsText(parsed.success ? parsed.data : [])).toBe("Small: 20 x 15 x 5\nMedium: 30 x 20 x 10.5");
  });

  it("names the line that's wrong", () => {
    const parsed = boxPresetsSchema.safeParse("Small: 20 x 15 x 5\nHuge: 500 x 1 x 1");
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toMatch(/^Line 2:/);
  });
});

describe("booking", () => {
  const valid = { orderId: ORDER, deliveryOption: "standard", weightGrams: "750", lengthCm: "30", widthCm: "20", heightCm: "10.5", openBox: "on", deliveryNote: "" };

  it("parses the dialog", () => {
    expect(darazBookingSchema.parse(valid)).toEqual({ orderId: ORDER, deliveryOption: "standard", weightGrams: 750, lengthCm: 30, widthCm: 20, heightCm: 10.5, openBox: true, deliveryNote: null });
  });

  it("refuses impossible parcels", () => {
    expect(darazBookingSchema.safeParse({ ...valid, weightGrams: "0" }).success).toBe(false);
    expect(darazBookingSchema.safeParse({ ...valid, lengthCm: "400" }).success).toBe(false);
    expect(darazBookingSchema.safeParse({ ...valid, deliveryOption: "drone" }).success).toBe(false);
  });

  it("needs a date to re-attempt but not to return", () => {
    expect(darazFeedbackSchema.safeParse({ orderId: ORDER, feedback: "REATTEMPT", reattemptOn: "", note: "" }).success).toBe(false);
    expect(darazFeedbackSchema.safeParse({ orderId: ORDER, feedback: "RETURN", reattemptOn: "", note: "" }).success).toBe(true);
  });

  it("limits label batches", () => {
    expect(darazLabelSchema.parse({ orders: `${ORDER},${ORDER}`, type: "pdf" }).orders).toEqual([ORDER]);
    expect(darazLabelSchema.safeParse({ orders: "nope", type: "pdf" }).success).toBe(false);
  });
});

describe("payouts", () => {
  it("parses rupees, splits tracking numbers and checks deductions", () => {
    const parsed = remittanceSchema.parse({
      reference: "DEX-PAY-1",
      statementDate: "2026-10-06",
      grossAmount: "12,500.50",
      deductions: "",
      note: "",
      trackingNumbers: "npdex1001, NPDEX1002\nNPDEX1001",
    });
    expect(parsed).toMatchObject({ grossAmount: 1_250_050, deductions: 0, trackingNumbers: ["NPDEX1001", "NPDEX1002"] });
    expect(remittanceSchema.safeParse({ reference: "x", statementDate: "2026-10-06", grossAmount: "100", deductions: "200", note: "", trackingNumbers: "A1B" }).success).toBe(false);
  });
});

describe("settings", () => {
  const base = {
    platformName: "Goreto",
    externalSellerId: "GORETO-STORE",
    originName: "Goreto Store",
    originPhone: "9801234567",
    originEmail: "",
    originAddressDetails: "Thamel",
    originDarazAddressId: "R100",
    originLatitude: "",
    originLongitude: "",
    pickupWarehouseCode: "WH_KTM",
    returnWarehouseCode: "",
    solutionCodes: "DARAZ_STANDARD_NP, DARAZ_STANDARD_NP",
    bookingEndpoint: "create",
    defaultDeliveryOption: "standard",
    phoneFormat: "national",
    undeliverableOption: "RETURN",
    autoBook: "on",
    defaultWeightGrams: "",
    defaultItemCategory: "",
    boxPresets: "Small: 20 x 15 x 5",
    xspaceCaseTemplateId: "",
    xspaceCategoryId: "",
  };

  it("normalises the phone, dedupes solution codes and reads the switches", () => {
    expect(darazSettingsSchema.parse(base)).toMatchObject({
      originPhone: "+9779801234567",
      solutionCodes: ["DARAZ_STANDARD_NP"],
      autoBook: true,
      defaultOpenBox: false,
      returnWarehouseCode: null,
      originLatitude: null,
      defaultWeightGrams: null,
    });
    expect(darazSettingsSchema.parse({ ...base, defaultWeightGrams: " 500 " }).defaultWeightGrams).toBe(500);
  });

  it("takes the usual parcel weight in whole grams from 1 to 100,000", () => {
    for (const value of ["0", "100001", "12.5", "500g", "-1"]) expect(darazSettingsSchema.safeParse({ ...base, defaultWeightGrams: value }).success).toBe(false);
    expect(darazSettingsSchema.parse({ ...base, defaultWeightGrams: "100000" }).defaultWeightGrams).toBe(100_000);
  });

  it("wants both coordinates or neither, and clean codes", () => {
    expect(darazSettingsSchema.safeParse({ ...base, originLatitude: "27.7" }).success).toBe(false);
    expect(darazSettingsSchema.safeParse({ ...base, originLatitude: "27.7", originLongitude: "85.3" }).success).toBe(true);
    expect(darazSettingsSchema.safeParse({ ...base, pickupWarehouseCode: "WH KTM" }).success).toBe(false);
  });
});
