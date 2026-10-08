"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { checkbox } from "../catalog-forms";
import { optionalGramsSchema } from "../daraz-forms";
import { insertManualOrder } from "../manual-order-create";
import { manualOrderSchema, type ManualOrderFailure, type ManualOrderValues } from "../manual-order-forms";
import { canAccess } from "../nav";
import { PROVIDER } from "../queries/daraz";
import { adminDb } from "../queries/shared";
import { fieldErrors, formValues } from "../schemas";
import { sendOrder, type SendResult } from "../send-parcel";
import { saveErrorResult } from "./helpers";

/*
 * Send & track (prompts/goreto-send-and-track.md). Save and send creates the
 * order and sends it in one click; a row's button sends an existing order.
 * Both need orders.write and run on the staff member's session, so every
 * RPC checks permission again. Autopilot writes the existing automation
 * switches and needs settings.manage and delivery.manage.
 */

export type SendOutcome = ({ ok: true; orderId: string; orderNumber: string } & SendResult) | ManualOrderFailure;

/** Creates the order from the form, then accepts, routes and books it. */
export async function sendNewOrderAction(input: ManualOrderValues, weight: string): Promise<SendOutcome> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };

  const parsed = manualOrderSchema.safeParse(input);
  const grams = optionalGramsSchema.safeParse(typeof weight === "string" ? weight : "");
  if (!parsed.success || !grams.success) {
    const errors: Record<string, string> = {
      ...(parsed.success ? {} : fieldErrors(parsed.error)),
      ...(grams.success ? {} : { weightGrams: grams.error.issues[0]?.message ?? "Check the weight" }),
    };
    return { ok: false, message: errors.items ?? "Check the highlighted fields.", fieldErrors: errors };
  }

  const created = await insertManualOrder(parsed.data);
  if (!created.ok) return created;
  const result = await sendOrder(created.orderId, { weightGrams: grams.data });
  refresh();
  return { ok: true, orderId: created.orderId, orderNumber: created.orderNumber, ...result };
}

const orderIdSchema = z.uuid();

/** A row's Accept & send or Book with Daraz. */
export async function sendOrderAction(orderId: string): Promise<SendResult | { kind: "error"; message: string }> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { kind: "error", message: deniedResult(auth.reason).message ?? "" };
  if (!orderIdSchema.safeParse(orderId).success) return { kind: "error", message: "That order isn't valid." };
  const result = await sendOrder(orderId);
  refresh();
  return result;
}

const autopilotSchema = z.object({ enabled: checkbox, usualWeightGrams: optionalGramsSchema });

/**
 * Turns every automatic step on or off together: accept website and
 * WhatsApp orders, pick the courier by rule, book Daraz. Off leaves the
 * courier mode on auto, which only pre-fills the Accept dialog.
 */
export async function setAutopilotAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const auth = await authorizeAdmin("settings.manage");
  if (!auth.ok || !canAccess(auth.profile, "delivery.manage")) return deniedResult(auth.ok ? "forbidden" : auth.reason);
  const parsed = autopilotSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, message: Object.values(errors)[0] ?? "Check the form and try again.", fieldErrors: errors };
  }
  const { enabled, usualWeightGrams } = parsed.data;

  const db = adminDb();
  const { data, error } = await db
    .from("store_settings")
    .update({
      auto_accept_website_orders: enabled,
      auto_accept_whatsapp_orders: enabled,
      ...(enabled ? { courier_assignment_mode: "auto" as const } : {}),
    })
    .eq("singleton", true)
    .select("id");
  if (error) return databaseErrorResult(error, "set autopilot");
  if (data.length !== 1) return { ok: false, message: "The store settings couldn't be changed. Refresh the page." };

  const { error: darazError } = await db.rpc("admin_update_provider_account", {
    p_provider: PROVIDER,
    p_patch: { auto_book: enabled, default_weight_grams: usualWeightGrams },
  });
  refresh();
  if (darazError) {
    const failure = saveErrorResult(darazError, "set Daraz auto-book");
    return { ok: false, message: `Orders are ${enabled ? "now" : "no longer"} accepted automatically, but Daraz didn't change: ${failure.ok ? "try again." : failure.message}`, fieldErrors: failure.ok ? undefined : failure.fieldErrors };
  }
  return { ok: true, message: enabled ? "Autopilot is on." : "Autopilot is off. New orders wait for you." };
}
