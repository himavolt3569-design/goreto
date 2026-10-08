"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { scheduleAutoBooking } from "@/lib/courier/auto-book";
import type { Database } from "@/types/database";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { adminDb } from "../queries/shared";
import { acceptOrderSchema, assignCourierSchema, orderIdSchema, orderTransitionSchema, shipmentEventSchema } from "../schemas";
import { authorizeAndParse, saveErrorResult } from "./helpers";

/*
 * Fulfilment actions. The SQL functions (migrations admin_operations,
 * whatsapp_orders) own the state machine, acceptance, courier choice,
 * timestamps, shipment events, COD collection and restocking; these only
 * authorize, validate and report.
 */

type Functions = Database["public"]["Functions"];

const DONE_MESSAGES = {
  processing: "Order is now processing.",
  packed: "Order marked packed.",
  shipped: "Order marked shipped.",
  delivered: "Order delivered and cash on delivery recorded as collected.",
  canceled: "Order canceled. Its items are back in stock.",
} as const;

export async function transitionOrderAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", orderTransitionSchema, formData);
  if (!input.ok) return input.result;

  // p_reason is nullable in SQL; the generated type can't say so.
  const args = { p_order_id: input.data.orderId, p_status: input.data.status, p_reason: input.data.reason } as Functions["admin_transition_order"]["Args"];
  const { error } = await adminDb().rpc("admin_transition_order", args);
  if (error) return databaseErrorResult(error, "transition order");

  refresh();
  return { ok: true, message: DONE_MESSAGES[input.data.status] };
}

const acceptedSchema = z.object({ already_accepted: z.boolean(), courier_name: z.string().optional() });

/**
 * Accept a pending order. Without a courier the store's mode decides: auto
 * picks one by rule, manual (or no match) comes back asking for one.
 * Accepting twice is harmless.
 */
export async function acceptOrderAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", acceptOrderSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().rpc("admin_accept_order", {
    p_order_id: input.data.orderId,
    p_courier_id: input.data.courierId ?? undefined,
  });
  if (error) return saveErrorResult(error, "accept order");

  refresh();
  scheduleAutoBooking();
  const result = acceptedSchema.safeParse(data);
  if (result.success && result.data.already_accepted) return { ok: true, message: "This order was already accepted." };
  return {
    ok: true,
    message: result.success && result.data.courier_name ? `Order accepted and assigned to ${result.data.courier_name}.` : "Order accepted.",
  };
}

/**
 * Records that staff opened the courier's WhatsApp link (the app can't know
 * whether WhatsApp delivered it). The database refuses orders that aren't
 * accepted or have no courier, and counts resends without new events.
 */
export async function recordCourierHandoffAction(orderId: string): Promise<ActionResult> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return deniedResult(auth.reason);
  const parsed = orderIdSchema.safeParse({ orderId });
  if (!parsed.success) return { ok: false, message: "That order isn't valid." };

  const { error } = await adminDb().rpc("admin_record_courier_handoff", { p_order_id: parsed.data.orderId });
  if (error) return databaseErrorResult(error, "record courier handoff");

  refresh();
  return { ok: true, message: "Marked as sent to the courier." };
}

export async function assignCourierAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", assignCourierSchema, formData);
  if (!input.ok) return input.result;

  const args = {
    p_order_id: input.data.orderId,
    p_courier_id: input.data.courierId,
    p_tracking_number: input.data.trackingNumber,
  } as Functions["admin_assign_courier"]["Args"];
  const { error } = await adminDb().rpc("admin_assign_courier", args);
  if (error) return databaseErrorResult(error, "assign courier");

  refresh();
  return { ok: true, message: "Courier assigned." };
}

export async function addShipmentEventAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", shipmentEventSchema, formData);
  if (!input.ok) return input.result;

  const args = {
    p_order_id: input.data.orderId,
    p_status: input.data.status,
    p_message: input.data.message,
    p_location: input.data.location,
  } as Functions["admin_add_shipment_event"]["Args"];
  const { error } = await adminDb().rpc("admin_add_shipment_event", args);
  if (error) return databaseErrorResult(error, "add shipment event");

  refresh();
  return { ok: true, message: "Tracking update added." };
}

export async function markRefundedAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", orderIdSchema, formData);
  if (!input.ok) return input.result;

  const { error } = await adminDb().rpc("admin_mark_refunded", { p_order_id: input.data.orderId });
  if (error) return databaseErrorResult(error, "mark refunded");

  refresh();
  return { ok: true, message: "Payment marked refunded. Restock returned items from Inventory after inspection." };
}
