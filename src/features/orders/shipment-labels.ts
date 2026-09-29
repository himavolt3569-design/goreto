import type { ShipmentStatus } from "./tracking-model";

/** Customer-facing names for shipment events (tracking page and account). */
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  awaiting_assignment: "Order received",
  assigned: "Courier assigned",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Delivery issue",
  returned: "Returned to store",
};
