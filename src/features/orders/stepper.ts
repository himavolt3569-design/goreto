import { formatShortCalendarRange, formatShortDateTime } from "./format";
import type { OrderTracking } from "./tracking-model";

/*
 * Order progress stepper (AGENTS §3.9, §4.5): explicit labels with real
 * timestamps. Future steps show an expected date only when the shipment has
 * an estimate; nothing is invented.
 */

export type StepKey = "placed" | "confirmed" | "packed" | "shipped" | "out_for_delivery" | "delivered";
export type StepState = "done" | "current" | "upcoming";

export type OrderStep = {
  key: StepKey;
  label: string;
  state: StepState;
  /** "18 Mar, 10:24 AM" when done, "Expected 21 Mar" when estimated, else null. */
  detail: string | null;
};

const LABELS: Record<StepKey, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

function earliestEvent(order: OrderTracking, status: string): string | null {
  const times = order.events.filter((event) => event.status === status).map((event) => event.occurredAt);
  return times.length ? times.reduce((earliest, time) => (time < earliest ? time : earliest)) : null;
}

export function buildOrderSteps(order: OrderTracking): OrderStep[] {
  const outForDelivery = earliestEvent(order, "out_for_delivery");
  const reached: Record<StepKey, string | null | true> = {
    placed: order.placedAt,
    confirmed: order.confirmedAt,
    packed: order.packedAt,
    shipped: order.shippedAt,
    // Some deliveries skip an explicit "out for delivery" event.
    out_for_delivery: outForDelivery ?? (order.deliveredAt ? true : null),
    delivered: order.deliveredAt,
  };

  const keys = Object.keys(LABELS) as StepKey[];
  const firstOpen = keys.findIndex((key) => reached[key] === null);
  const estimate = order.shipment;
  const canceled = order.status === "canceled";

  return keys.map((key, index) => {
    const at = reached[key];
    if (at !== null) {
      return { key, label: LABELS[key], state: "done", detail: typeof at === "string" ? formatShortDateTime(at) : null };
    }

    let detail: string | null = null;
    if (!canceled && estimate?.estimatedFrom && estimate.estimatedTo) {
      if (key === "out_for_delivery") detail = `Expected ${formatShortCalendarRange(estimate.estimatedFrom, estimate.estimatedFrom)}`;
      if (key === "delivered") detail = `Expected ${formatShortCalendarRange(estimate.estimatedFrom, estimate.estimatedTo)}`;
    }
    return {
      key,
      label: LABELS[key],
      state: !canceled && index === firstOpen ? "current" : "upcoming",
      detail,
    };
  });
}
