import type { Database } from "@/types/database";

/*
 * Mirror of the order state machine in admin_transition_order (migration
 * admin_operations). The database is the authority; this only decides which
 * buttons the order page offers.
 */

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

export const NEXT_ORDER_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_confirmation: ["confirmed", "canceled"],
  confirmed: ["processing", "canceled"],
  processing: ["packed", "canceled"],
  packed: ["shipped", "canceled"],
  shipped: ["delivered", "canceled"],
  delivered: [],
  canceled: [],
};

export const TRANSITION_LABELS: Record<Exclude<OrderStatus, "pending_confirmation">, string> = {
  confirmed: "Confirm order",
  processing: "Start processing",
  packed: "Mark packed",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  canceled: "Cancel order",
};

export function forwardTransition(status: OrderStatus): Exclude<OrderStatus, "pending_confirmation" | "canceled"> | null {
  const next = NEXT_ORDER_STATUSES[status].find((candidate) => candidate !== "canceled");
  return (next as Exclude<OrderStatus, "pending_confirmation" | "canceled"> | undefined) ?? null;
}

export function canCancel(status: OrderStatus): boolean {
  return NEXT_ORDER_STATUSES[status].includes("canceled");
}

/** Couriers are assigned after confirmation and before the parcel leaves. */
export function canAssignCourier(status: OrderStatus): boolean {
  return status === "confirmed" || status === "processing" || status === "packed";
}

export function canAddTrackingEvent(status: OrderStatus): boolean {
  return status === "shipped";
}

export function canRefund(status: OrderStatus, payment: PaymentStatus): boolean {
  return status === "delivered" && payment === "collected";
}

/** Staff may add only these updates by hand; the rest follow order transitions. */
export const MANUAL_TRACKING_STATUSES = ["in_transit", "out_for_delivery", "exception"] as const satisfies readonly ShipmentStatus[];

/** Stepper order for the order page's progress display. */
export const ORDER_PROGRESS: readonly Exclude<OrderStatus, "canceled">[] = [
  "pending_confirmation",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
];
