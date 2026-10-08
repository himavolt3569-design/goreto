// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { defaultParcel, parcelWeight, type BookingContext, type DarazSettings } from "./booking";

vi.mock("server-only", () => ({}));

const settings = (overrides: Partial<DarazSettings> = {}) =>
  ({
    default_weight_grams: null,
    default_delivery_option: "standard",
    default_open_box: false,
    default_length_cm: 30,
    default_width_cm: 20,
    default_height_cm: 10,
    box_presets: [{ name: "Small", length_cm: 20, width_cm: 15, height_cm: 5 }],
    ...overrides,
  }) as DarazSettings;

const context = (savedGrams: number | null, productGrams: number | null) =>
  ({
    suggestedWeightGrams: productGrams,
    shipment: savedGrams === null ? null : { serviceOption: "economy", package: { weightGrams: savedGrams, lengthCm: null, widthCm: null, heightCm: null } },
  }) as unknown as BookingContext;

describe("parcelWeight", () => {
  it("takes the typed weight, then the saved one, then the products', then the usual weight", () => {
    expect(parcelWeight(settings({ default_weight_grams: 500 }), context(900, 700), 1200)).toBe(1200);
    expect(parcelWeight(settings({ default_weight_grams: 500 }), context(900, 700))).toBe(900);
    expect(parcelWeight(settings({ default_weight_grams: 500 }), context(null, 700))).toBe(700);
    expect(parcelWeight(settings({ default_weight_grams: 500 }), context(null, null))).toBe(500);
    expect(parcelWeight(settings(), context(null, null), null)).toBeNull();
  });
});

describe("defaultParcel", () => {
  it("books products without a weight at the usual weight, in the first box", () => {
    expect(defaultParcel(settings({ default_weight_grams: 500 }), context(null, null))).toEqual({
      deliveryOption: "standard",
      weightGrams: 500,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 5,
      openBox: false,
      deliveryNote: null,
    });
  });

  it("keeps the purchased service's option and has nothing to book without any weight", () => {
    expect(defaultParcel(settings(), context(900, null))?.deliveryOption).toBe("economy");
    expect(defaultParcel(settings(), context(null, null))).toBeNull();
  });
});
