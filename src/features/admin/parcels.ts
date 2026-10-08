import type { Database } from "@/types/database";

/*
 * Send & track (prompts/goreto-send-and-track.md): what each parcel needs
 * next, how far it has got, and whether Autopilot is on. Pure, so the page,
 * the actions and the tests share one set of rules.
 */

type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

export type ParcelState = {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  /** The courier on the shipment; null until the order is accepted. */
  courier: { name: string; daraz: boolean; whatsappE164: string | null } | null;
  /** Who the routing rule would pick for a pending order (purchased service, then fallback). */
  routedCourierName: string | null;
  shipment: {
    status: ShipmentStatus;
    booked: boolean;
    readyToShip: boolean;
    needsAction: boolean;
  } | null;
  /** The order details went to the current courier (WhatsApp tap, or a Daraz booking). */
  handoffSent: boolean;
  /** Every item has a weight saved, so Daraz can be booked without asking. */
  itemsWeighed: boolean;
};

export type ParcelContext = { darazConnected: boolean; usualWeightGrams: number | null };

export type ParcelStep =
  | { kind: "accept"; courierName: string | null }
  | { kind: "book" }
  | { kind: "needs_weight" }
  | { kind: "daraz_offline" }
  | { kind: "print_and_ready" }
  | { kind: "awaiting_pickup" }
  | { kind: "failed_delivery" }
  | { kind: "send_whatsapp"; courierName: string }
  | { kind: "needs_courier_number"; courierName: string }
  | { kind: "sent"; courierName: string }
  | { kind: "problem" }
  | { kind: "no_courier" }
  | { kind: "on_the_way"; courierName: string | null }
  | { kind: "out_for_delivery" }
  | { kind: "delivered"; cashCollected: boolean }
  | { kind: "returned" }
  | { kind: "canceled" };

const BEFORE_SHIPPING: readonly OrderStatus[] = ["confirmed", "processing", "packed"];

/** The one thing to do (or wait for) next. */
export function parcelStep(parcel: ParcelState, context: ParcelContext): ParcelStep {
  const shipmentStatus = parcel.shipment?.status ?? null;
  if (parcel.orderStatus === "canceled") return { kind: "canceled" };
  if (parcel.orderStatus === "pending_confirmation") return { kind: "accept", courierName: parcel.routedCourierName };
  if (shipmentStatus === "returned") return { kind: "returned" };
  if (parcel.orderStatus === "delivered" || shipmentStatus === "delivered") return { kind: "delivered", cashCollected: parcel.paymentStatus === "collected" };

  const courier = parcel.courier;
  if (!courier) return { kind: "no_courier" };

  if (courier.daraz) {
    if (!parcel.shipment?.booked) {
      if (!BEFORE_SHIPPING.includes(parcel.orderStatus)) return { kind: "on_the_way", courierName: courier.name };
      if (!context.darazConnected) return { kind: "daraz_offline" };
      if (!parcel.itemsWeighed && !context.usualWeightGrams) return { kind: "needs_weight" };
      return { kind: "book" };
    }
    if (parcel.shipment.needsAction || shipmentStatus === "exception") return { kind: "failed_delivery" };
    if (shipmentStatus === "out_for_delivery") return { kind: "out_for_delivery" };
    if (shipmentStatus === "picked_up" || shipmentStatus === "in_transit") return { kind: "on_the_way", courierName: courier.name };
    return parcel.shipment.readyToShip ? { kind: "awaiting_pickup" } : { kind: "print_and_ready" };
  }

  if (shipmentStatus === "exception") return { kind: "problem" };
  if (shipmentStatus === "out_for_delivery") return { kind: "out_for_delivery" };
  if (shipmentStatus === "picked_up" || shipmentStatus === "in_transit" || parcel.orderStatus === "shipped") return { kind: "on_the_way", courierName: courier.name };
  if (parcel.handoffSent) return { kind: "sent", courierName: courier.name };
  return courier.whatsappE164 ? { kind: "send_whatsapp", courierName: courier.name } : { kind: "needs_courier_number", courierName: courier.name };
}

/** Plain words for a step: what's happening, and what the button or hint says. */
export function stepCopy(step: ParcelStep): { status: string; action: string | null } {
  switch (step.kind) {
    case "accept":
      return { status: "New order, waiting for you", action: step.courierName ? `Accept & send to ${step.courierName}` : "Open to choose a courier" };
    case "book":
      return { status: "Accepted, not booked with Daraz yet", action: "Book with Daraz" };
    case "needs_weight":
      return { status: "Daraz needs the parcel weight", action: "Add the weight" };
    case "daraz_offline":
      return { status: "Waiting for the Daraz connection", action: null };
    case "print_and_ready":
      return { status: "Booked with Daraz", action: "Print label & call pickup" };
    case "awaiting_pickup":
      return { status: "Waiting for Daraz to pick it up", action: null };
    case "failed_delivery":
      return { status: "Daraz couldn't deliver it", action: "Try again or return" };
    case "send_whatsapp":
      return { status: `Accepted, not sent to ${step.courierName} yet`, action: "Send on WhatsApp" };
    case "needs_courier_number":
      return { status: `${step.courierName} has no WhatsApp number`, action: "Add the number" };
    case "sent":
      return { status: `Sent to ${step.courierName}`, action: null };
    case "problem":
      return { status: "The courier reported a problem", action: "Open the order" };
    case "no_courier":
      return { status: "No courier chosen", action: "Choose a courier" };
    case "on_the_way":
      return { status: step.courierName ? `On the way with ${step.courierName}` : "On the way", action: null };
    case "out_for_delivery":
      return { status: "Out for delivery", action: null };
    case "delivered":
      return { status: step.cashCollected ? "Delivered, cash collected" : "Delivered", action: null };
    case "returned":
      return { status: "Returned to the store", action: "Open the order" };
    case "canceled":
      return { status: "Canceled", action: null };
  }
}

export const PARCEL_PROGRESS = ["Accepted", "Sent to courier", "On the way", "Delivered"] as const;

/** Index of the last step reached in PARCEL_PROGRESS: -1 before acceptance or when canceled. */
export function parcelProgress(parcel: ParcelState): number {
  const status = parcel.shipment?.status ?? null;
  if (parcel.orderStatus === "canceled" || parcel.orderStatus === "pending_confirmation") return -1;
  if (parcel.orderStatus === "delivered" || status === "delivered") return 3;
  if (status === "picked_up" || status === "in_transit" || status === "out_for_delivery" || status === "returned" || parcel.orderStatus === "shipped") return 2;
  if (parcel.shipment?.booked || parcel.handoffSent) return 1;
  return 0;
}

/* ---------- Autopilot ---------- */

export type AutopilotSwitches = {
  autoAcceptWebsite: boolean;
  autoAcceptWhatsapp: boolean;
  courierModeAuto: boolean;
  /** Daraz auto-book; false when Daraz has no settings row. */
  darazAutoBook: boolean;
};

const SWITCH_LABELS: Record<keyof AutopilotSwitches, string> = {
  autoAcceptWebsite: "accept website orders",
  autoAcceptWhatsapp: "accept WhatsApp orders",
  courierModeAuto: "pick the courier",
  darazAutoBook: "book Daraz",
};

export type AutopilotState = { state: "on" | "off" | "partly"; on: string[]; off: string[] };

/** On only when every switch is on; off when none of the automatic steps is. */
export function autopilotState(switches: AutopilotSwitches): AutopilotState {
  const keys = Object.keys(SWITCH_LABELS) as (keyof AutopilotSwitches)[];
  const on = keys.filter((key) => switches[key]).map((key) => SWITCH_LABELS[key]);
  const off = keys.filter((key) => !switches[key]).map((key) => SWITCH_LABELS[key]);
  // Courier mode alone automates nothing: it only pre-fills the Accept dialog.
  const automating = switches.autoAcceptWebsite || switches.autoAcceptWhatsapp || switches.darazAutoBook;
  return { state: off.length === 0 ? "on" : automating ? "partly" : "off", on, off };
}
