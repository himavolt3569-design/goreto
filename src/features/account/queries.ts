import "server-only";
import { cache } from "react";
import { isOrderNumber } from "@/features/checkout/tracking-access";
import { parseOrderTracking, type OrderStatus, type OrderTracking, type ShipmentStatus } from "@/features/orders/tracking-model";
import { pageRange, toPage, type Page } from "@/lib/pagination/page";
import { getUserSupabase } from "@/lib/supabase/server";
import type { PaymentStatus } from "./billing";

/*
 * Customer account reads (AGENTS §4.9, §10.8), through the Clerk-token client.
 * Every read is limited to the caller's own orders: explicitly here or in the
 * account_* SQL functions, since RLS alone would give owners and staff every
 * order. Totals are computed in SQL. Reads throw; the account error boundary
 * offers a retry.
 */

export const ACCOUNT_ORDERS_PAGE_SIZE = 10;

function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Account query failed (${what}): ${error.code ?? ""} ${error.message}`.trim());
}

export type AccountSummary = {
  orderCount: number;
  inProgressCount: number;
  billedPaisa: number;
  billedOrderCount: number;
  pendingPaisa: number;
  pendingOrderCount: number;
};

export const fetchAccountSummary = cache(async (): Promise<AccountSummary> => {
  const { data, error } = await getUserSupabase().rpc("account_summary");
  if (error) fail("summary", error);
  const row = data[0];
  return {
    orderCount: Number(row?.order_count ?? 0),
    inProgressCount: Number(row?.in_progress_count ?? 0),
    billedPaisa: Number(row?.billed_paisa ?? 0),
    billedOrderCount: Number(row?.billed_order_count ?? 0),
    pendingPaisa: Number(row?.pending_paisa ?? 0),
    pendingOrderCount: Number(row?.pending_order_count ?? 0),
  };
});

export type AccountOrderRow = {
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaisa: number;
  itemCount: number;
};

/** The profile's own orders, newest first. */
export async function fetchAccountOrders(
  profileId: string,
  page: number,
  size = ACCOUNT_ORDERS_PAGE_SIZE,
): Promise<Page<AccountOrderRow>> {
  const { data, error, count } = await getUserSupabase()
    .from("orders")
    .select("order_number, created_at, status, payment_status, total_paisa, order_items(quantity)", { count: "exact" })
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(...pageRange(page, size));
  if (error) fail("orders", error);

  const rows = data.map((order) => ({
    orderNumber: order.order_number,
    placedAt: order.created_at,
    status: order.status,
    paymentStatus: order.payment_status,
    totalPaisa: Number(order.total_paisa),
    itemCount: order.order_items.reduce((total, item) => total + item.quantity, 0),
  }));
  return toPage(rows, count, page, size);
}

export type AccountTrackingEvent = {
  orderNumber: string;
  status: ShipmentStatus;
  message: string;
  locationLabel: string | null;
  occurredAt: string;
};

/** Shipment events across the caller's orders, newest first. */
export async function fetchAccountTrackingEvents(limit = 50): Promise<AccountTrackingEvent[]> {
  const { data, error } = await getUserSupabase().rpc("account_tracking_events", { p_limit: limit });
  if (error) fail("tracking events", error);
  return data.map((event) => ({
    orderNumber: event.order_number,
    status: event.status,
    message: event.message,
    locationLabel: event.location_label ?? null,
    occurredAt: event.occurred_at,
  }));
}

/**
 * One of the caller's own orders for the account detail page, or null. The
 * tracking secret is deliberately not passed, so a guest order this browser
 * can track never shows up as an account order.
 */
export const loadAccountOrder = cache(async (orderNumber: string): Promise<OrderTracking | null> => {
  if (!isOrderNumber(orderNumber)) return null;
  const { data, error } = await getUserSupabase().rpc("get_order_tracking", { p_order_number: orderNumber });
  if (error) fail("order", error);
  return data === null ? null : parseOrderTracking(data);
});
