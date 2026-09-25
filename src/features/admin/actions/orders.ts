"use server";

import { refresh } from "next/cache";
import type { Database } from "@/types/database";
import { databaseErrorResult, type ActionResult } from "../auth";
import { adminDb } from "../queries/shared";
import { assignCourierSchema, orderIdSchema, orderTransitionSchema, shipmentEventSchema } from "../schemas";
import { authorizeAndParse } from "./helpers";

/*
 * Fulfilment actions. The SQL functions (migration admin_operations) own the
 * state machine, timestamps, shipment events, COD collection and restocking;
 * these only authorize, validate and report.
 */

type Functions = Database["public"]["Functions"];

const DONE_MESSAGES = {
  confirmed: "Order confirmed.",
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
