import "server-only";
import { defaultParcel, MISSING_WEIGHT_MESSAGE } from "@/lib/courier/daraz/booking";
import { darazConfig } from "@/lib/courier/daraz/config";
import { saveErrorResult } from "./actions/helpers";
import { bookOrder, prepare } from "./daraz-staff";
import { fetchBookingContext } from "./queries/daraz";
import { fetchAcceptPreview } from "./queries/orders";
import { fetchParcel } from "./queries/parcels";
import { adminDb } from "./queries/shared";

/*
 * "Send" in Send & track (prompts/goreto-send-and-track.md): accept the order
 * if it's still pending, with the courier the routing rule picks (the
 * purchased service's courier, then the fallback), then book Daraz Express
 * on the spot or hand back the prefilled WhatsApp message for any other
 * courier. Runs on the staff member's session; callers authorize
 * orders.write. A step that fails leaves the order saved and says which.
 */

export type SendResult =
  | { kind: "booked"; courierName: string; trackingNumber: string; message: string }
  | { kind: "whatsapp"; courierName: string; whatsappHref: string | null; message: string }
  | { kind: "attention"; message: string };

const DARAZ = "Daraz Express";

export async function sendOrder(orderId: string, options: { weightGrams?: number | null } = {}): Promise<SendResult> {
  const { data: order, error } = await adminDb().from("orders").select("status").eq("id", orderId).maybeSingle();
  if (error || !order) return { kind: "attention", message: "That order couldn't be read. Refresh the page." };
  if (order.status === "canceled") return { kind: "attention", message: "This order is canceled." };
  if (order.status === "delivered") return { kind: "attention", message: "This order is already delivered." };

  if (order.status === "pending_confirmation") {
    const preview = await fetchAcceptPreview(orderId);
    if (!preview.courier) {
      return { kind: "attention", message: "Saved, but no active courier matches this delivery option. Open the order to choose one." };
    }
    const { error: acceptError } = await adminDb().rpc("admin_accept_order", { p_order_id: orderId, p_courier_id: preview.courier.id });
    if (acceptError) {
      const failure = saveErrorResult(acceptError, "accept order");
      return { kind: "attention", message: `Saved, but not accepted: ${failure.ok ? "try again." : failure.message}` };
    }
  }

  const context = await fetchBookingContext(orderId);
  if (context?.shipment?.courierApiProvider === "daraz") {
    if (context.shipment.packageCode && context.shipment.trackingNumber) {
      return { kind: "booked", courierName: DARAZ, trackingNumber: context.shipment.trackingNumber, message: `Already booked with ${DARAZ}.` };
    }
    if (!darazConfig()) {
      return { kind: "attention", message: `Accepted for ${DARAZ}. It can be booked once Daraz is connected; it waits in the list below.` };
    }
    const prepared = await prepare(orderId);
    if (!prepared.ok) return { kind: "attention", message: `Accepted, but not booked: ${prepared.result.ok ? "try again." : prepared.result.message}` };
    const parcel = defaultParcel(prepared.value.settings, prepared.value.context, options.weightGrams);
    if (!parcel) return { kind: "attention", message: `Accepted, but not booked. ${MISSING_WEIGHT_MESSAGE}` };
    const booked = await bookOrder(prepared.value, parcel);
    if (!booked.ok || !booked.trackingNumber) {
      return { kind: "attention", message: `Accepted, but ${DARAZ} didn't book it: ${booked.ok ? "no tracking number came back." : booked.message}` };
    }
    return { kind: "booked", courierName: DARAZ, trackingNumber: booked.trackingNumber, message: booked.message ?? `Booked with ${DARAZ}.` };
  }

  const parcel = await fetchParcel(orderId);
  const courierName = parcel?.courier?.name;
  if (!parcel || !courierName) return { kind: "attention", message: "Saved and accepted. Open the order to choose a courier." };
  return {
    kind: "whatsapp",
    courierName,
    whatsappHref: parcel.whatsappHref,
    message: parcel.whatsappHref
      ? `Accepted for ${courierName}. Tap Send on WhatsApp to give them the order.`
      : parcel.handoffSent
        ? `Accepted and already sent to ${courierName}.`
        : `Accepted for ${courierName}, but they have no WhatsApp number. Add it under Delivery & Courier.`,
  };
}
