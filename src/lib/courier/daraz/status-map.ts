import { parseRupeesToPaisa } from "@/lib/money/parse";
import type { Database } from "@/types/database";
import type { PackageHistory } from "./epis";

/*
 * Daraz package statuses -> Goreto shipment statuses (docs/couriers/daraz.md
 * §7.1). The table holds the Lazada/Daraz logistics vocabulary (fulfilment
 * push list and EPIS history examples); keyword rules catch close variants.
 * A status that matches nothing returns null: the event is still recorded in
 * Daraz's own words, but the shipment and order don't move (AGENTS §26.3).
 */

export type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

/** Uppercase, separators as "_", and the INFO_ST_ / DOMESTIC_ prefixes removed. */
export function normaliseStatus(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^INFO_ST_/, "")
    .replace(/^DOMESTIC_/, "");
}

const TABLE: Readonly<Record<string, ShipmentStatus | null>> = {
  // Booked, waiting for pickup.
  PACKAGE_CREATED: "assigned",
  PENDING: "assigned",
  READY_TO_SHIP: "assigned",
  READY_TO_SHIP_PENDING: "assigned",
  PACKAGE_READY_TO_BE_SHIPPED: "assigned",
  TRANSIT_TO_SHIP: "assigned",
  REQUESTING_DRIVER: "assigned",
  DRIVER_ASSIGNED: "assigned",
  NEED_REVIEW: null,
  // Picked up.
  PICKUP_SIGN_IN_SUCCESS: "picked_up",
  PICKUP_SUCCESS: "picked_up",
  PICKED_UP: "picked_up",
  CB_PICKUP_SUCCESS: "picked_up",
  // Moving through the network.
  IB_SUCCESS_FIRST_MILE_HUB: "in_transit",
  OB_SUCCESS_FIRST_MILE_HUB: "in_transit",
  SC_SIGN_IN_SUCCESS: "in_transit",
  IB_SUCCESS_IN_SORT_CENTER: "in_transit",
  OB_SUCCESS_IN_SORT_CENTER: "in_transit",
  PACKAGE_STATIONED_IN: "in_transit",
  PACKAGE_STATIONED_OUT: "in_transit",
  LAST_MILE_3PL_SHIPPED_TO_STATION: "in_transit",
  LAST_MILE_CUSTOMER_STATION_INBOUND: "in_transit",
  REDELIVERY: "in_transit",
  IN_TRANSIT: "in_transit",
  SHIPPED: "in_transit",
  // Last mile.
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  // Needs attention.
  PICKUP_SIGN_IN_FAILURE: "exception",
  "1ST_ATTEMPT_FAILED": "exception",
  REATTEMPTS_FAILED: "exception",
  DELIVERY_FAILED: "exception",
  DELIVER_FAILED: "exception",
  LAST_MILE_STATION_CUSTOMER_FAILED_PICKUP: "exception",
  ON_HOLD: "exception",
  RETURN_AT_TRANSIT_HUB: "exception",
  ON_THE_WAY_BACK_TO_SHIPPER: "exception",
  PACKAGE_RETURNED_FAILED: "exception",
  PACKAGE_RETURN_ATTEMPT_FAILED: "exception",
  PACKAGE_RETURN_FAILED_PICKUP_PENDING: "exception",
  LOST_BY_3PL: "exception",
  DAMAGE_BY_3PL: "exception",
  PACKAGE_SCRAPPED: "exception",
  PACKAGE_INTERCEPTED: "exception",
  // Back with the store.
  BACK_TO_SHIPPER: "returned",
  WAREHOUSE_RETURNED: "returned",
  RETURNED: "returned",
  // Booking canceled: nothing moves.
  CANCELLED: null,
  CANCELED: null,
};

/** For statuses the table doesn't list. Most specific first. */
const RULES: readonly [RegExp, ShipmentStatus | null][] = [
  [/CANCEL/, null],
  [/RETURN.*FAIL|FAIL.*RETURN/, "exception"],
  [/BACK_TO_SHIPPER|RETURNED|DELIVERED_TO_(SELLER|SHIPPER|MERCHANT)/, "returned"],
  [/RETURN|BACK_TO/, "exception"],
  [/FAIL|UNDELIVER|EXCEPTION|LOST|DAMAGE|REJECT|REFUSE|HOLD|SCRAP|INTERCEPT/, "exception"],
  [/OUT_FOR_DELIVERY|^OFD|DELIVERING|WITH_RIDER/, "out_for_delivery"],
  [/(^|_)DELIVERED$|DELIVERY_SUCCESS/, "delivered"],
  [/PICKUP.*SUCCESS|PICKED_UP|PICKUP_SIGN_IN|COLLECTED/, "picked_up"],
  [/TRANSIT|HUB|SORT|STATION|LINE_?HAUL|ARRIV|DEPART|INBOUND|OUTBOUND|LAST_MILE|SHIPPED|REDELIVER|HANDOVER|^IB_|^OB_|^SC_/, "in_transit"],
  [/READY|PENDING|CREATED|CONSIGN|DRIVER|PACKED|AWAIT|BOOKED/, "assigned"],
];

export function mapDarazStatus(raw: string | null | undefined): ShipmentStatus | null {
  if (!raw) return null;
  const status = normaliseStatus(raw);
  if (status === "") return null;
  if (Object.hasOwn(TABLE, status)) return TABLE[status]!;
  for (const [pattern, mapped] of RULES) if (pattern.test(status)) return mapped;
  return null;
}

/** "domestic_out_for_delivery" -> "Out for delivery". */
export function humaniseStatus(raw: string): string {
  const words = normaliseStatus(raw).toLowerCase().replace(/_/g, " ");
  return words ? words[0]!.toUpperCase() + words.slice(1) : "Courier update";
}

const MESSAGES: Record<ShipmentStatus, string> = {
  awaiting_assignment: "Waiting for a courier.",
  assigned: "Booked with Daraz Express, waiting for pickup.",
  picked_up: "Picked up by Daraz Express.",
  in_transit: "In transit with Daraz Express.",
  out_for_delivery: "Out for delivery with Daraz Express.",
  delivered: "Delivered by Daraz Express.",
  exception: "Delivery attempt didn't succeed.",
  returned: "Returned to the store.",
};

/** Daraz's processTime: documented as milliseconds, but examples use seconds. */
export function toMilliseconds(value: number): number {
  return value < 1e12 ? value * 1000 : value;
}

/** "150", "150.00", '{"amount":"150"}', {amount: 150} -> paisa; anything else -> null. */
export function parseDarazFee(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    return parseDarazFee(record.amount ?? record.totalAmount ?? record.fee ?? record.value ?? null);
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (text.startsWith("{")) {
    try {
      return parseDarazFee(JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }
  const parsed = parseRupeesToPaisa(text.replace(/^(NPR|Rs\.?)\s*/i, "").replace(/(\.\d{2})\d+$/, "$1"));
  return parsed.ok ? parsed.paisa : null;
}

/** The p_history payload for provider_history_core (migrations daraz_courier, daraz_courier_ops). */
export type ProviderHistory = {
  provider_status: string | null;
  status: ShipmentStatus | null;
  fee_paisa: number | null;
  needs_action: boolean;
  last_mile_provider: string | null;
  events: { key: string; status: ShipmentStatus | null; message: string; location: string | null; occurred_at: string }[];
};

export function toProviderHistory(history: PackageHistory): ProviderHistory {
  const events = history.timeline
    .filter((entry) => entry.processTime !== null && entry.processTime > 0)
    .map((entry) => {
      const status = mapDarazStatus(entry.status);
      const reason = entry.reasonCode ? humaniseStatus(entry.reasonCode) : null;
      let message = status ? MESSAGES[status] : `Courier update: ${humaniseStatus(entry.status)}.`;
      if (status === "exception" && reason) message = `${message.replace(/\.$/, "")}: ${reason}.`;
      return {
        key: `${normaliseStatus(entry.status)}|${entry.processTime}`,
        status,
        message: message.slice(0, 300),
        location: entry.location?.slice(0, 120) ?? null,
        occurred_at: new Date(toMilliseconds(entry.processTime!)).toISOString(),
      };
    })
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  // The newest recognised timeline step wins: Daraz's own example pairs a stale
  // top-level status with a newer timeline.
  const latestKnown = [...events].reverse().find((event) => event.status !== null)?.status ?? null;

  return {
    provider_status: history.status,
    status: latestKnown ?? mapDarazStatus(history.status),
    fee_paisa: parseDarazFee(history.shippingFee),
    needs_action: history.notifyVasFdStorage,
    last_mile_provider: history.lastMileShippingProvider,
    events,
  };
}
