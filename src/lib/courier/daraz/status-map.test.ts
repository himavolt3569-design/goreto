// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PackageHistory } from "./epis";
import { humaniseStatus, mapDarazStatus, normaliseStatus, parseDarazFee, toMilliseconds, toProviderHistory, type ShipmentStatus } from "./status-map";

describe("mapDarazStatus", () => {
  // The Lazada/Daraz fulfilment status list (docs/couriers/daraz.md §7.1).
  const OFFICIAL: [string, ShipmentStatus | null][] = [
    ["CANCELLED", null],
    ["READY_TO_SHIP", "assigned"],
    ["TRANSIT_TO_SHIP", "assigned"],
    ["READY_TO_SHIP_PENDING", "assigned"],
    ["INFO_ST_REQUESTING_DRIVER", "assigned"],
    ["INFO_ST_DRIVER_ASSIGNED", "assigned"],
    ["INFO_ST_NEED_REVIEW", null],
    ["INFO_ST_DOMESTIC_PICKUP_SIGN_IN_SUCCESS", "picked_up"],
    ["INFO_ST_DOMESTIC_PICKUP_SIGN_IN_FAILURE", "exception"],
    ["INFO_ST_DOMESTIC_SC_SIGN_IN_SUCCESS", "in_transit"],
    ["INFO_ST_DOMESTIC_IB_SUCCESS_FIRST_MILE_HUB", "in_transit"],
    ["INFO_ST_DOMESTIC_OB_SUCCESS_FIRST_MILE_HUB", "in_transit"],
    ["INFO_ST_DOMESTIC_IB_SUCCESS_IN_SORT_CENTER", "in_transit"],
    ["INFO_ST_DOMESTIC_OB_SUCCESS_IN_SORT_CENTER", "in_transit"],
    ["INFO_ST_DOMESTIC_PACKAGE_STATIONED_IN", "in_transit"],
    ["INFO_ST_DOMESTIC_PACKAGE_STATIONED_OUT", "in_transit"],
    ["INFO_ST_DOMESTIC_ON_HOLD", "exception"],
    ["INFO_ST_DOMESTIC_LAST_MILE_CUSTOMER_STATION_INBOUND", "in_transit"],
    ["DELIVERED", "delivered"],
    ["INFO_ST_DOMESTIC_LAST_MILE_STATION_CUSTOMER_FAILED_PICKUP", "exception"],
    ["INFO_ST_DOMESTIC_LAST_MILE_3PL_SHIPPED_TO_STATION", "in_transit"],
    ["INFO_ST_DOMESTIC_OUT_FOR_DELIVERY", "out_for_delivery"],
    ["INFO_ST_DOMESTIC_1ST_ATTEMPT_FAILED", "exception"],
    ["INFO_ST_DOMESTIC_REDELIVERY", "in_transit"],
    ["INFO_ST_DOMESTIC_REATTEMPTS_FAILED", "exception"],
    ["INFO_ST_DOMESTIC_DELIVERY_FAILED", "exception"],
    ["INFO_ST_DOMESTIC_RETURN_AT_TRANSIT_HUB", "exception"],
    ["ON_THE_WAY_BACK_TO_SHIPPER", "exception"],
    ["INFO_ST_DOMESTIC_BACK_TO_SHIPPER", "returned"],
    ["INFO_ST_DOMESTIC_WAREHOUSE_RETURNED", "returned"],
    ["DELIVER_FAILED", "exception"],
    ["INFO_ST_DOMESTIC_PACKAGE_RETURNED_FAILED", "exception"],
    ["INFO_ST_DOMESTIC_PACKAGE_RETURN_ATTEMPT_FAILED", "exception"],
    ["INFO_ST_DOMESTIC_PACKAGE_RETURN_FAILED_PICKUP_PENDING", "exception"],
    ["LOST_BY_3PL", "exception"],
    ["DAMAGE_BY_3PL", "exception"],
    ["INFO_ST_PACKAGE_INTERCEPTED", "exception"],
    ["PACKAGE_SCRAPPED", "exception"],
  ];

  it.each(OFFICIAL)("maps %s to %s", (raw, expected) => {
    expect(mapDarazStatus(raw)).toBe(expected);
  });

  it("reads the lowercase EPIS history forms the same way", () => {
    expect(mapDarazStatus("package_ready_to_be_shipped")).toBe("assigned");
    expect(mapDarazStatus("domestic_delivered")).toBe("delivered");
    expect(mapDarazStatus("domestic_out_for_delivery")).toBe("out_for_delivery");
    expect(mapDarazStatus("domestic_1st_attempt_failed")).toBe("exception");
    expect(mapDarazStatus("domestic back to shipper")).toBe("returned");
  });

  it("falls back to keywords for close variants and leaves the unknown alone", () => {
    expect(mapDarazStatus("domestic_arrived_at_hub")).toBe("in_transit");
    expect(mapDarazStatus("rider_delivered")).toBe("delivered");
    expect(mapDarazStatus("customer_refused")).toBe("exception");
    expect(mapDarazStatus("something_new")).toBeNull();
    expect(mapDarazStatus("")).toBeNull();
    expect(mapDarazStatus(null)).toBeNull();
  });

  it("normalises and humanises", () => {
    expect(normaliseStatus(" info_st_domestic_out-for delivery ")).toBe("OUT_FOR_DELIVERY");
    expect(humaniseStatus("customer_reject_at_door_step")).toBe("Customer reject at door step");
  });
});

describe("timestamps and fees", () => {
  it("treats Daraz times below 1e12 as seconds", () => {
    expect(toMilliseconds(1_600_000_000)).toBe(1_600_000_000_000);
    expect(toMilliseconds(1_701_104_399_000)).toBe(1_701_104_399_000);
  });

  it("parses every fee shape Daraz has shown", () => {
    expect(parseDarazFee("150")).toBe(15000);
    expect(parseDarazFee("150.5")).toBe(15050);
    expect(parseDarazFee("100000.0")).toBe(10000000);
    expect(parseDarazFee("NPR 85.255")).toBe(8525);
    expect(parseDarazFee(120)).toBe(12000);
    expect(parseDarazFee('{"amount":"99.00"}')).toBe(9900);
    expect(parseDarazFee({ totalAmount: 45 })).toBe(4500);
    expect(parseDarazFee("{}")).toBeNull();
    expect(parseDarazFee("free")).toBeNull();
    expect(parseDarazFee(undefined)).toBeNull();
  });
});

describe("toProviderHistory", () => {
  const history = (overrides: Partial<PackageHistory> = {}): PackageHistory => ({
    packageCode: "FU1",
    trackingNumber: "NPD1",
    status: "package_ready_to_be_shipped",
    lastMileShippingProvider: "NP-DEX",
    timeline: [],
    shippingFee: "{}",
    notifyVasFdStorage: false,
    ...overrides,
  });
  const entry = (status: string, processTime: number, extra: Record<string, string | null> = {}) => ({
    status,
    processTime,
    shippingProvider: null,
    reasonCode: null,
    location: "Kathmandu hub",
    epod: "https://epod",
    photos: "https://photo",
    driverName: "Rider",
    trackingUrl: null,
    ...extra,
  });

  it("orders events, keys them, and lets the newest timeline step win over a stale top-level status", () => {
    const result = toProviderHistory(
      history({
        timeline: [entry("domestic_delivered", 1_600_100_000), entry("domestic_pickup_sign_in_success", 1_600_000_000)],
      }),
    );
    expect(result.status).toBe("delivered");
    expect(result.events.map((event) => [event.key, event.status, event.occurred_at])).toEqual([
      ["PICKUP_SIGN_IN_SUCCESS|1600000000", "picked_up", "2020-09-13T12:26:40.000Z"],
      ["DELIVERED|1600100000", "delivered", "2020-09-14T16:13:20.000Z"],
    ]);
    expect(result.fee_paisa).toBeNull();
    expect(result.last_mile_provider).toBe("NP-DEX");
  });

  it("explains failures with the reason code and never copies rider details", () => {
    const result = toProviderHistory(
      history({
        notifyVasFdStorage: true,
        shippingFee: "120.00",
        timeline: [entry("domestic_1st_attempt_failed", 1_701_104_399_000, { reasonCode: "customer_reject_at_door_step" })],
      }),
    );
    expect(result.events[0]!.message).toBe("Delivery attempt didn't succeed: Customer reject at door step.");
    expect(JSON.stringify(result)).not.toMatch(/Rider|epod|photo/);
    expect(result.needs_action).toBe(true);
    expect(result.fee_paisa).toBe(12000);
  });

  it("records unknown statuses in Daraz's words without moving the parcel", () => {
    const result = toProviderHistory(history({ status: null, timeline: [entry("weather_delay", 1_600_000_000)] }));
    expect(result.status).toBeNull();
    expect(result.events[0]).toMatchObject({ status: null, message: "Courier update: Weather delay." });
  });

  it("skips entries without a time", () => {
    const result = toProviderHistory(history({ timeline: [{ ...entry("DELIVERED", 0), processTime: null }] }));
    expect(result.events).toEqual([]);
  });
});
