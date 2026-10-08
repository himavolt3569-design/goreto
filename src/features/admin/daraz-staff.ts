import "server-only";
import { bookWithDaraz, type BookingOps } from "@/lib/courier/daraz/booking";
import { describeDarazError, type DarazResult } from "@/lib/courier/daraz/client";
import { darazConfig, type DarazConfig } from "@/lib/courier/daraz/config";
import { markReadyToShip, packageHistory } from "@/lib/courier/daraz/epis";
import { toProviderHistory } from "@/lib/courier/daraz/status-map";
import type { Json } from "@/types/database";
import { databaseErrorResult, type ActionResult } from "./auth";
import type { DarazBookingInput } from "./daraz-forms";
import { logDarazCall } from "./daraz-log";
import { saveErrorResult } from "./actions/helpers";
import { fetchBookingContext, fetchDarazSettings, PROVIDER, type BookingContext, type DarazSettings } from "./queries/daraz";
import { adminDb } from "./queries/shared";

/*
 * Daraz Express steps staff run on their own session, shared by the Daraz
 * actions and Send & track (prompts/goreto-send-and-track.md). Not a "use
 * server" module: callers authorize first, and none of these is a public
 * Server Function.
 */

export const NOT_CONFIGURED: ActionResult = { ok: false, message: "Daraz Express isn't connected yet. Add the app key and secret (Admin › Daraz Express › Setup)." };

export const NOT_BOOKED: ActionResult = { ok: false, message: "This order isn't booked with Daraz Express." };

export function darazFailure(result: Extract<DarazResult<unknown>, { ok: false }>): ActionResult {
  const trace = result.error.traceId ? ` (Daraz trace ${result.error.traceId})` : "";
  return { ok: false, message: `${describeDarazError(result.error)}${trace}` };
}

export type Prepared = { config: DarazConfig; settings: DarazSettings; context: BookingContext };

/** Config, settings and the order, or the message to show. */
export async function prepare(orderId: string): Promise<{ ok: true; value: Prepared } | { ok: false; result: ActionResult }> {
  const config = darazConfig();
  if (!config) return { ok: false, result: NOT_CONFIGURED };
  const [settings, context] = await Promise.all([fetchDarazSettings(), fetchBookingContext(orderId)]);
  if (!context) return { ok: false, result: { ok: false, message: "That order no longer exists. Refresh the page." } };
  if (!settings) return { ok: false, result: { ok: false, message: "Daraz settings aren't readable with your access." } };
  return { ok: true, value: { config, settings, context } };
}

export function bookedPackage(context: BookingContext): { packageCode: string; trackingNumber: string } | null {
  const shipment = context.shipment;
  return shipment?.packageCode && shipment.trackingNumber ? { packageCode: shipment.packageCode, trackingNumber: shipment.trackingNumber } : null;
}

/** Staff booking: reference, record and log through the staff member's own session. */
const STAFF_OPS: BookingOps = {
  async reference(orderId) {
    const { data, error } = await adminDb().rpc("admin_provider_booking_reference", { p_order_id: orderId, p_provider: PROVIDER });
    if (error || !data) {
      const result = error ? saveErrorResult(error, "booking reference") : NOT_BOOKED;
      return { ok: false, message: result.ok ? "" : result.message };
    }
    return { ok: true, value: data };
  },
  async record(orderId, booking) {
    const { error } = await adminDb().rpc("admin_record_provider_booking", { p_order_id: orderId, p_provider: PROVIDER, p_booking: booking });
    return error ? { ok: false, message: error.message } : { ok: true };
  },
  log: logDarazCall,
};

export type BookResult = ActionResult & { trackingNumber?: string };

/** Books one prepared order. Shared by the Book dialog, bulk booking and Send & track. */
export async function bookOrder({ config, settings, context }: Prepared, parcel: Omit<DarazBookingInput, "orderId">): Promise<BookResult> {
  const outcome = await bookWithDaraz(config, settings, context, parcel, STAFF_OPS);
  return outcome.ok ? { ok: true, message: outcome.message, trackingNumber: outcome.trackingNumber } : { ok: false, message: outcome.message };
}

export async function readyOrder({ config, context }: Prepared): Promise<ActionResult> {
  const booked = bookedPackage(context);
  if (!booked) return NOT_BOOKED;
  if (context.shipment?.readyToShipAt) return { ok: true, message: "Already marked ready to ship." };
  const result = await markReadyToShip(config, booked.trackingNumber);
  await logDarazCall("ready_to_ship", context.orderId, result);
  if (!result.ok) return darazFailure(result);
  const { error } = await adminDb().rpc("admin_mark_provider_ready", { p_order_id: context.orderId, p_provider: PROVIDER });
  if (error) return databaseErrorResult(error, "mark ready to ship");
  return { ok: true, message: "Marked ready to ship. Daraz Express will pick it up." };
}

/** Fetches Daraz history and applies it. Safe to call often. */
export async function refreshOrder({ config, context }: Prepared): Promise<ActionResult> {
  const booked = bookedPackage(context);
  if (!booked) return NOT_BOOKED;
  const result = await packageHistory(config, booked.trackingNumber);
  await logDarazCall("history", context.orderId, result);
  if (!result.ok) return darazFailure(result);
  const { data, error } = await adminDb().rpc("admin_apply_provider_history", {
    p_order_id: context.orderId,
    p_history: toProviderHistory(result.data) as unknown as Json,
  });
  if (error) return databaseErrorResult(error, "apply tracking");
  const inserted = Number((data as { inserted?: number } | null)?.inserted ?? 0);
  return { ok: true, message: inserted > 0 ? `Tracking updated: ${inserted} new update${inserted === 1 ? "" : "s"}.` : "Tracking is up to date." };
}
