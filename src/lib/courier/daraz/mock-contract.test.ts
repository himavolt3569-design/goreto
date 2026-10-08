// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildConsignment, buildWarehouse, type BookingAccount, type BookingOrder } from "./payloads";
import { toProviderHistory } from "./status-map";

vi.mock("server-only", () => ({}));
const epis = await import("./epis");

/*
 * End to end against scripts/daraz/mock-server.ts, which checks signatures
 * the way Daraz does and answers in Daraz's envelope: proves the client's
 * signing, query/body split, JSON-string objects and response parsing fit
 * together through a whole parcel's life.
 */

const PORT = 4300 + Math.floor(Math.random() * 500);
const SECRET = "mock-secret";
const CONFIG = { appKey: "123456", appSecret: SECRET, apiUrl: `http://localhost:${PORT}` };
let server: ChildProcess;

const ACCOUNT: BookingAccount = {
  platformName: "Goreto",
  externalSellerId: "GORETO-STORE",
  pickupWarehouseCode: "WH_KTM",
  originName: "Goreto Store",
  originPhoneE164: "+9779801234567",
  originEmail: null,
  originAddressDetails: "Thamel, Kathmandu",
  originDarazAddressId: "R100",
  originLatitude: null,
  originLongitude: null,
  undeliverableOption: "RETURN",
  phoneFormat: "national",
  declareInsurance: false,
  defaultItemCategory: null,
};

const ORDER: BookingOrder = {
  orderNumber: "GT260101000009",
  createdAt: "2026-10-06T05:00:00.000Z",
  totalPaisa: 210_000,
  subtotalPaisa: 200_000,
  discountPaisa: 0,
  contactEmail: null,
  customerNote: null,
  address: {
    recipientName: "Sita Gurung",
    phoneE164: "+9779812345678",
    streetLandmark: "Lakeside",
    ward: 6,
    municipalityName: "Pokhara",
    districtName: "Kaski",
    provinceName: "Gandaki",
    latitude: null,
    longitude: null,
  },
  darazAddressId: null,
  items: [{ id: "i1", title: "Kurta", variant: null, sku: "KUR-1", quantity: 1, unitPricePaisa: 200_000, lineTotalPaisa: 200_000 }],
};

beforeAll(async () => {
  server = spawn(process.execPath, [resolve("scripts/daraz/mock-server.ts")], {
    env: { ...process.env, DARAZ_MOCK_PORT: String(PORT), DARAZ_APP_SECRET: SECRET },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((done, fail) => {
    const timer = setTimeout(() => fail(new Error("mock server didn't start")), 10_000);
    server.stdout!.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Daraz mock gateway")) {
        clearTimeout(timer);
        done();
      }
    });
    server.on("exit", (code) => fail(new Error(`mock server exited (${code})`)));
  });
}, 20_000);

afterAll(() => {
  server?.kill();
});

describe("Daraz client against the mock gateway", () => {
  it("rejects a wrong secret as a signature problem", async () => {
    const result = await epis.packageHistory({ ...CONFIG, appSecret: "wrong" }, "NPDEX1");
    expect(result.ok || result.error.code).toBe("SIGNATURE");
    const check = await epis.checkConnection(CONFIG);
    expect(check.ok).toBe(true);
  });

  it("links the account, saves a warehouse and estimates the fee", async () => {
    const link = await epis.linkCustomerAccount(CONFIG, { externalSellerId: "GORETO-STORE", platformName: "Goreto", otp: "L0000001" });
    expect(link.ok).toBe(true);
    const warehouse = await epis.saveWarehouse(
      CONFIG,
      buildWarehouse({
        platformName: "Goreto",
        externalSellerId: "GORETO-STORE",
        kind: "pickup",
        warehouseCode: "WH_KTM",
        warehouseName: "Thamel",
        contactName: "Asha",
        phoneE164: "+9779801234567",
        phoneFormat: "national",
        email: null,
        darazAddressId: "R100",
        addressDetails: "Thamel",
        solutionCodes: ["DARAZ_STANDARD_NP"],
      }),
    );
    expect(warehouse.ok && warehouse.data.convertedAddressId).toBe("R100");
    const fee = await epis.estimateShippingFee(CONFIG, { externalSellerId: "GORETO-STORE", platformName: "Goreto", chargeFactor: { paymentType: "COD", weight: "750" } });
    expect(fee.ok && fee.data.totalPaisa).toBe(15_500);
  });

  it("books, labels, ships and tracks a parcel to delivery, and dedupes the reference", async () => {
    const params = buildConsignment(ORDER, ACCOUNT, { deliveryOption: "standard", weightGrams: 750, lengthCm: 30, widthCm: 20, heightCm: 10, openBox: false, deliveryNote: null }, ORDER.orderNumber);
    const booked = await epis.bookPackage(CONFIG, "create", params);
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const again = await epis.bookPackage(CONFIG, "consign", params);
    expect(again.ok && again.data.packageCode).toBe(booked.data.packageCode);

    const label = await epis.printAwb(CONFIG, booked.data.packageCode, "pdf");
    expect(label.ok && label.data.url).toMatch(/\.pdf$/);
    if (label.ok) {
      const pdf = await fetch(label.data.url);
      expect((await pdf.text()).startsWith("%PDF-1.4")).toBe(true);
    }

    expect((await epis.markReadyToShip(CONFIG, booked.data.trackingNumber)).ok).toBe(true);

    const seen: (string | null)[] = [];
    for (let step = 0; step < 6; step += 1) {
      const history = await epis.packageHistory(CONFIG, booked.data.trackingNumber);
      expect(history.ok).toBe(true);
      if (history.ok) seen.push(toProviderHistory(history.data).status);
    }
    expect(seen).toEqual(["picked_up", "in_transit", "in_transit", "out_for_delivery", "delivered", "delivered"]);
  });

  it("reports Daraz field errors", async () => {
    const params = buildConsignment({ ...ORDER, orderNumber: "GT260101000010", address: { ...ORDER.address, phoneE164: "" } }, ACCOUNT, { deliveryOption: "standard", weightGrams: 750, lengthCm: 30, widthCm: 20, heightCm: 10, openBox: false, deliveryNote: null }, "GT260101000010");
    const result = await epis.bookPackage(CONFIG, "create", params);
    expect(result.ok || result.error.fieldErrors).toEqual([{ field: "$.destination.phone", message: "phone must not be blank" }]);
  });
});
