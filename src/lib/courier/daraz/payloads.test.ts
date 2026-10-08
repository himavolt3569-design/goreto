// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addressDetails,
  buildConsignment,
  buildDeliveryOptionsQuery,
  buildFeeEstimate,
  buildPackageUpdate,
  buildWarehouse,
  darazPhone,
  goodsValuePaisa,
  paidUnitPrices,
  rupees,
  type BookingAccount,
  type BookingOrder,
} from "./payloads";

const ACCOUNT: BookingAccount = {
  platformName: "Goreto",
  externalSellerId: "GORETO-STORE",
  pickupWarehouseCode: "WH_KTM",
  originName: "Goreto Store",
  originPhoneE164: "+9779801234567",
  originEmail: "store@example.com",
  originAddressDetails: "Thamel, Kathmandu",
  originDarazAddressId: "R100",
  originLatitude: 27.715,
  originLongitude: 85.312,
  undeliverableOption: "RETURN",
  phoneFormat: "national",
  declareInsurance: false,
  defaultItemCategory: "Fashion",
};

const ORDER: BookingOrder = {
  orderNumber: "GT260101000001",
  createdAt: "2026-10-06T05:00:00.000Z",
  totalPaisa: 310_000,
  subtotalPaisa: 300_000,
  discountPaisa: 10_000,
  contactEmail: null,
  customerNote: "Call first",
  address: {
    recipientName: "Sita Gurung",
    phoneE164: "+9779812345678",
    streetLandmark: "Lakeside, near the boat station",
    ward: 6,
    municipalityName: "Pokhara",
    districtName: "Kaski",
    provinceName: "Gandaki",
    latitude: null,
    longitude: null,
  },
  darazAddressId: null,
  items: [
    { id: "i1", title: "Kurta", variant: "M / Red", sku: "KUR-M-RED", quantity: 2, unitPricePaisa: 100_000, lineTotalPaisa: 200_000 },
    { id: "i2", title: "Shawl", variant: null, sku: null, quantity: 1, unitPricePaisa: 100_000, lineTotalPaisa: 100_000 },
  ],
};

const OPTIONS = { deliveryOption: "standard" as const, weightGrams: 750, lengthCm: 30, widthCm: 20, heightCm: 10, openBox: true, deliveryNote: "Fragile" };

describe("money and phones", () => {
  it("formats paisa as rupee strings", () => {
    expect(rupees(249_950)).toBe("2499.50");
    expect(rupees(310_000)).toBe("3100");
  });

  it("spreads the discount over items in whole paisa", () => {
    // 10,000 paisa off 300,000: 2/3 on the kurtas, the remainder on the shawl.
    expect(paidUnitPrices(ORDER)).toEqual([96_667, 96_666]);
    expect(paidUnitPrices({ ...ORDER, discountPaisa: 0 })).toEqual([100_000, 100_000]);
    expect(goodsValuePaisa(ORDER)).toBe(290_000);
  });

  it("formats Nepal phones the way the settings ask", () => {
    expect(darazPhone("+9779812345678")).toBe("9812345678");
    expect(darazPhone("+9779812345678", "e164")).toBe("+9779812345678");
  });
});

describe("buildConsignment", () => {
  it("builds the create/consign body from the snapshot, with the booking reference", () => {
    const body = buildConsignment(ORDER, ACCOUNT, OPTIONS, "GT260101000001-R2");
    expect(body).toMatchObject({
      packageType: "Sales_order",
      externalOrderId: "GT260101000001-R2",
      platformOrderCreationTime: Date.parse("2026-10-06T05:00:00.000Z"),
      dangerousGood: false,
      deliveryOption: "standard",
      shipper: { externalSellerId: "GORETO-STORE", platformName: "Goreto", externalWarehouseCode: "WH_KTM" },
      origin: { phone: "9801234567", address: { id: "R100", details: "Thamel, Kathmandu" }, geoLocation: { latitude: "27.715", longitude: "85.312" } },
      destination: {
        name: "Sita Gurung",
        phone: "9812345678",
        address: { city: "Pokhara", details: "Lakeside, near the boat station, Ward 6, Pokhara, Kaski, Gandaki", type: "home" },
      },
      payment: { totalAmount: "3100", currency: "NPR", paymentType: "COD" },
      dimWeight: { weight: "750", length: "30", width: "20", height: "10" },
      options: { openBox: true, deliveryNote: "Fragile · Call first", partnerOrderId: "GT260101000001", undeliverableOption: "RETURN" },
    });
    expect(body.items).toEqual([
      { id: "i1", name: "Kurta - M / Red", sku: "KUR-M-RED", category: "Fashion", quantity: 2, unitPrice: "1000", paidPrice: "966.67" },
      { id: "i2", name: "Shawl", sku: undefined, category: "Fashion", quantity: 1, unitPrice: "1000", paidPrice: "966.66" },
    ]);
    expect(body.payment.insuranceAmount).toBeUndefined();
    // No customer point and no R-code: those keys are left out of the JSON Daraz receives.
    expect(JSON.stringify(body.destination)).not.toMatch(/geoLocation|"id"/);
  });

  it("declares the goods value as insurance when the setting is on", () => {
    const body = buildConsignment(ORDER, { ...ACCOUNT, declareInsurance: true }, OPTIONS, ORDER.orderNumber);
    expect(body.payment.insuranceAmount).toBe("2900");
  });

  it("uses the mapped R-code and the customer's point when known", () => {
    const body = buildConsignment({ ...ORDER, darazAddressId: "R555", address: { ...ORDER.address, latitude: 28.2, longitude: 83.98 } }, ACCOUNT, OPTIONS, "X");
    expect(body.destination).toMatchObject({ address: { id: "R555" }, geoLocation: { latitude: "28.2", longitude: "83.98" } });
  });
});

describe("other builders", () => {
  it("formats addresses without empty parts", () => {
    expect(addressDetails({ ...ORDER.address, ward: null })).toBe("Lakeside, near the boat station, Pokhara, Kaski, Gandaki");
  });

  it("builds a receiver update", () => {
    expect(
      buildPackageUpdate({ packageCode: "FU1", receiverName: "Ram", receiverPhoneE164: "+9779800000001", details: "New Road", darazAddressId: null, deliveryNote: null, phoneFormat: "national" }),
    ).toEqual({ packageCode: "FU1", receiverName: "Ram", receiverPhone: "9800000001", deliveryNote: undefined, receiverAddress: { id: undefined, details: "New Road", type: "home" } });
  });

  it("builds a fee estimate and skips delivery options without both R-codes", () => {
    expect(
      buildFeeEstimate({ account: ACCOUNT, destinationAddressId: "R555", destinationLatitude: null, destinationLongitude: null, weightGrams: 750.4, deliveryOption: "economy", goodsValuePaisa: 1 }),
    ).toMatchObject({ fromAddressId: "R100", toAddressId: "R555", chargeFactor: { paymentType: "COD", weight: "750", deliveryOption: "economy" } });
    expect(buildDeliveryOptionsQuery({ account: ACCOUNT, order: ORDER, options: OPTIONS, reference: "X" })).toBeNull();
    expect(buildDeliveryOptionsQuery({ account: ACCOUNT, order: { ...ORDER, darazAddressId: "R555" }, options: OPTIONS, reference: "X" })).toMatchObject({
      origin: { id: "R100" },
      destination: { id: "R555" },
      payment: { totalAmount: "3100" },
    });
  });

  it("builds pickup and return warehouses", () => {
    const base = { platformName: "Goreto", externalSellerId: "GORETO-STORE", warehouseCode: "WH_KTM", warehouseName: "Thamel", contactName: "Asha", phoneE164: "+9779801234567", phoneFormat: "national" as const, email: null, darazAddressId: "R100", addressDetails: "Thamel", solutionCodes: ["DARAZ_STANDARD_NP"] };
    expect(buildWarehouse({ ...base, kind: "pickup" })).toMatchObject({ type: "NORMAL", phone: "9801234567", address: { id: "R100" }, solutionCodes: ["DARAZ_STANDARD_NP"] });
    expect(buildWarehouse({ ...base, kind: "return" }).type).toBe("RETURN");
  });
});
