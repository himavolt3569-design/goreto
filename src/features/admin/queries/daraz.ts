import "server-only";
import { z } from "zod";
import {
  bookingAccount,
  loadBookingContext,
  loadDarazSettings,
  PROVIDER,
  type BookingContext,
  type BoxPreset,
  type DarazSettings,
  type DarazShipment,
} from "@/lib/courier/daraz/booking";
import type { Database } from "@/types/database";
import { adminDb, fail, toPage, pageRange, type Page } from "./shared";

/*
 * Daraz Express reads for the order panel and Admin › Daraz Express
 * (prompts/goreto-daraz-courier.md). Through the staff member's own session:
 * RLS limits settings to delivery.manage / orders.write and the courier
 * tables to order staff.
 */

export { bookingAccount, PROVIDER, type BookingContext, type BoxPreset, type DarazSettings, type DarazShipment };

export function fetchDarazSettings(): Promise<DarazSettings | null> {
  return loadDarazSettings(adminDb());
}

export function fetchBookingContext(orderId: string): Promise<BookingContext | null> {
  return loadBookingContext(adminDb(), orderId);
}

const addressSchema = z
  .object({ municipality_name: z.string().catch("") })
  .partial()
  .catch({});

/* ---------- Dashboard ---------- */

const overviewSchema = z.object({
  to_book: z.coerce.number(),
  booked_not_ready: z.coerce.number(),
  awaiting_pickup: z.coerce.number(),
  in_transit: z.coerce.number(),
  out_for_delivery: z.coerce.number(),
  needs_action: z.coerce.number(),
  delivered_7d: z.coerce.number(),
  returned_30d: z.coerce.number(),
  cod_unsettled_count: z.coerce.number(),
  cod_unsettled_paisa: z.coerce.number(),
  fees_month_paisa: z.coerce.number(),
  last_synced_at: z.string().nullable(),
  last_webhook_at: z.string().nullable(),
  webhook_errors_24h: z.coerce.number(),
  api_calls_24h: z.coerce.number(),
  api_failures_24h: z.coerce.number(),
  mapped_municipalities: z.coerce.number(),
  total_municipalities: z.coerce.number(),
});
export type CourierOverview = z.infer<typeof overviewSchema>;

export async function fetchCourierOverview(): Promise<CourierOverview> {
  const { data, error } = await adminDb().rpc("admin_courier_overview", { p_provider: PROVIDER });
  if (error) fail("courier overview", error);
  return overviewSchema.parse(data);
}

export const SHIPMENT_VIEWS = ["to_book", "booked", "with_daraz", "needs_action", "delivered", "returned", "all"] as const;
export type ShipmentView = (typeof SHIPMENT_VIEWS)[number];

export type DarazShipmentRow = {
  shipmentId: string;
  orderId: string;
  orderNumber: string;
  orderStatus: Database["public"]["Enums"]["order_status"];
  paymentStatus: Database["public"]["Enums"]["payment_status"];
  customer: string;
  municipality: string | null;
  totalPaisa: number;
  status: Database["public"]["Enums"]["shipment_status"];
  trackingNumber: string | null;
  booked: boolean;
  providerStatus: string | null;
  needsAction: boolean;
  readyToShip: boolean;
  labelPrinted: boolean;
  syncedAt: string | null;
  estimatedTo: string | null;
  deliveredAt: string | null;
  settled: boolean;
  feePaisa: number | null;
};

export async function fetchDarazShipments(view: ShipmentView, page: number): Promise<Page<DarazShipmentRow>> {
  const [from, to] = pageRange(page);
  let query = adminDb()
    .from("shipments")
    .select(
      `id, status, tracking_number, provider_package_code, provider_status, provider_needs_action, ready_to_ship_at, awb_printed_at,
       provider_synced_at, estimated_delivery_to, delivered_at, created_at,
       couriers!inner(api_provider),
       orders!inner(id, order_number, status, payment_status, total_paisa, contact_name, shipping_address),
       shipment_courier_finance(actual_fee_paisa, estimated_fee_paisa, cod_remittance_id)`,
      { count: "exact" },
    )
    .eq("couriers.api_provider", PROVIDER);

  switch (view) {
    case "to_book":
      query = query.is("provider_package_code", null).in("orders.status", ["confirmed", "processing", "packed"]);
      break;
    case "booked":
      query = query.not("provider_package_code", "is", null).eq("status", "assigned");
      break;
    case "with_daraz":
      query = query.not("provider_package_code", "is", null).in("status", ["picked_up", "in_transit", "out_for_delivery"]);
      break;
    case "needs_action":
      query = query.not("provider_package_code", "is", null).or("provider_needs_action.eq.true,status.eq.exception");
      break;
    case "delivered":
      query = query.eq("status", "delivered");
      break;
    case "returned":
      query = query.eq("status", "returned");
      break;
    case "all":
      break;
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) fail("daraz shipments", error);

  const rows = data.map((row): DarazShipmentRow => {
    const address = addressSchema.parse(row.orders.shipping_address);
    const finance = row.shipment_courier_finance;
    return {
      shipmentId: row.id,
      orderId: row.orders.id,
      orderNumber: row.orders.order_number,
      orderStatus: row.orders.status,
      paymentStatus: row.orders.payment_status,
      customer: row.orders.contact_name,
      municipality: address.municipality_name || null,
      totalPaisa: row.orders.total_paisa,
      status: row.status,
      trackingNumber: row.tracking_number,
      booked: row.provider_package_code !== null,
      providerStatus: row.provider_status,
      needsAction: row.provider_needs_action,
      readyToShip: row.ready_to_ship_at !== null,
      labelPrinted: row.awb_printed_at !== null,
      syncedAt: row.provider_synced_at,
      estimatedTo: row.estimated_delivery_to,
      deliveredAt: row.delivered_at,
      settled: Boolean(finance?.cod_remittance_id),
      feePaisa: finance?.actual_fee_paisa ?? finance?.estimated_fee_paisa ?? null,
    };
  });
  return toPage(rows, count, page);
}

export type RemittanceRow = Database["public"]["Tables"]["courier_remittances"]["Row"];

export async function fetchRemittances(page: number): Promise<Page<RemittanceRow>> {
  const [from, to] = pageRange(page);
  const { data, error, count } = await adminDb()
    .from("courier_remittances")
    .select("*", { count: "exact" })
    .eq("provider", PROVIDER)
    .order("statement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) fail("remittances", error);
  return toPage(data, count, page);
}

export type UnsettledParcel = { trackingNumber: string; orderNumber: string; totalPaisa: number; deliveredAt: string | null };

/** Delivered, collected Daraz parcels not in any recorded payout (oldest first). */
export async function fetchUnsettledParcels(limit = 200): Promise<UnsettledParcel[]> {
  const { data, error } = await adminDb()
    .from("shipments")
    .select("tracking_number, delivered_at, orders!inner(order_number, total_paisa, payment_status), shipment_courier_finance(cod_remittance_id)")
    .eq("provider", PROVIDER)
    .eq("status", "delivered")
    .eq("orders.payment_status", "collected")
    .not("tracking_number", "is", null)
    .order("delivered_at", { ascending: true })
    .limit(limit);
  if (error) fail("unsettled parcels", error);
  return data
    .filter((row) => !row.shipment_courier_finance?.cod_remittance_id)
    .map((row) => ({ trackingNumber: row.tracking_number!, orderNumber: row.orders.order_number, totalPaisa: row.orders.total_paisa, deliveredAt: row.delivered_at }));
}

export type SupportCaseRow = Database["public"]["Tables"]["courier_support_cases"]["Row"] & { orderNumber: string | null };

export async function fetchSupportCases(page: number, orderId?: string): Promise<Page<SupportCaseRow>> {
  const [from, to] = pageRange(page);
  let query = adminDb()
    .from("courier_support_cases")
    .select("*, orders(order_number)", { count: "exact" })
    .eq("provider", PROVIDER);
  if (orderId) query = query.eq("order_id", orderId);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) fail("support cases", error);
  return toPage(
    data.map(({ orders, ...row }) => ({ ...row, orderNumber: orders?.order_number ?? null })),
    count,
    page,
  );
}

export type ApiLogRow = Database["public"]["Tables"]["courier_api_log"]["Row"] & { orderNumber: string | null; actorName: string | null };

export async function fetchApiLog(page: number, options: { orderId?: string; failuresOnly?: boolean } = {}): Promise<Page<ApiLogRow>> {
  const [from, to] = pageRange(page);
  let query = adminDb()
    .from("courier_api_log")
    .select("*, orders(order_number), profiles(full_name)", { count: "exact" })
    .eq("provider", PROVIDER);
  if (options.orderId) query = query.eq("order_id", options.orderId);
  if (options.failuresOnly) query = query.eq("success", false);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) fail("courier api log", error);
  return toPage(
    data.map(({ orders, profiles, ...row }) => ({ ...row, orderNumber: orders?.order_number ?? null, actorName: profiles?.full_name ?? null })),
    count,
    page,
  );
}
