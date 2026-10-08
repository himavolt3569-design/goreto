"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { GENERIC_FAILURE } from "@/features/checkout/errors";
import { parseCheckoutQuote, type CheckoutQuote } from "@/features/checkout/quote";
import { cartItemsSchema } from "@/features/checkout/schemas";
import { scheduleAutoBooking } from "@/lib/courier/auto-book";
import { authorizeAdmin, deniedResult } from "../auth";
import { insertManualOrder } from "../manual-order-create";
import { manualOrderFailure, manualOrderSchema, type ManualOrderFailure, type ManualOrderValues } from "../manual-order-forms";
import { fieldErrors } from "../schemas";
import {
  searchOrderCustomers,
  searchOrderVariants,
  type LookupResult,
  type OrderCustomerOption,
  type OrderVariantOption,
} from "../queries/manual-orders";
import { adminDb } from "../queries/shared";

/*
 * Manual WhatsApp order entry (worklog §4.0). Each action is a public POST
 * endpoint, so it authorizes (orders.write, plus customers.read to link a
 * customer) and validates here; admin_create_order and admin_order_quote
 * check both again in SQL and price everything themselves.
 */

export async function searchOrderCustomersAction(query: string): Promise<LookupResult<OrderCustomerOption>> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };
  if (!(await authorizeAdmin("customers.read")).ok) return { ok: false, message: "You can't look up customer accounts." };
  return searchOrderCustomers(query);
}

export async function searchOrderVariantsAction(query: string): Promise<LookupResult<OrderVariantOption>> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };
  return searchOrderVariants(query);
}

const quoteRequestSchema = z.object({
  items: cartItemsSchema,
  municipalityCode: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  courierServiceId: z.uuid().optional(),
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  email: z.string().trim().toLowerCase().max(254).optional(),
  customerId: z.uuid().optional(),
});

export type ManualQuoteRequest = z.input<typeof quoteRequestSchema>;

export async function quoteManualOrderAction(request: ManualQuoteRequest): Promise<{ ok: true; quote: CheckoutQuote } | { ok: false; message: string }> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };
  const parsed = quoteRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: "Add at least one item to see prices." };
  const { items, municipalityCode, courierServiceId, couponCode, email, customerId } = parsed.data;

  const { data, error } = await adminDb().rpc("admin_order_quote", {
    p_items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    p_municipality_code: municipalityCode,
    p_courier_service_id: courierServiceId,
    p_coupon_code: couponCode || undefined,
    p_contact_email: email || undefined,
    p_customer_id: customerId,
  });
  if (error) {
    const failure = manualOrderFailure(error);
    if (failure.message === GENERIC_FAILURE) console.error("admin_order_quote failed", error.code);
    return { ok: false, message: failure.message === GENERIC_FAILURE ? "Prices couldn't be loaded. Please try again." : failure.message };
  }
  return { ok: true, quote: parseCheckoutQuote(data) };
}

/** Creates the order (pending, or accepted when WhatsApp auto-accept is on) and opens it. */
export async function createManualOrderAction(input: ManualOrderValues): Promise<ManualOrderFailure> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };

  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, message: errors.items ?? "Check the highlighted fields.", fieldErrors: errors };
  }
  const created = await insertManualOrder(parsed.data);
  if (!created.ok) return created;
  scheduleAutoBooking();
  redirect(`/admin/orders/${created.orderNumber}`);
}
