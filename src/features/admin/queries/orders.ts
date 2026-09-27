import "server-only";
import { z } from "zod";
import type { Database } from "@/types/database";
import type { ResolvedRange } from "../date-range";
import type { OrderStatus, PaymentStatus, ShipmentStatus } from "../order-transitions";
import { containsPattern, orderNumberTerm, quotedFilterValue } from "../search-input";
import { adminDb, fail, mediaUrl, pageRange, toPage, type Page } from "./shared";

/* Orders, fulfilment and the COD payments ledger (RLS: orders.read). */

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "canceled",
];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "collected", "failed", "refunded"];

export type OrderChannel = Database["public"]["Enums"]["order_channel"];
export const ORDER_CHANNELS: readonly OrderChannel[] = ["website", "whatsapp"];

export type OrderListRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  contactName: string;
  /** WhatsApp orders may have no email. */
  contactEmail: string | null;
  contactPhone: string;
  channel: OrderChannel;
  isGuest: boolean;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaisa: number;
  itemCount: number;
  thumbnail: string | null;
  serviceName: string | null;
};

export type OrderFilter = {
  q: string;
  status: OrderStatus | null;
  payment: PaymentStatus | null;
  channel?: OrderChannel | null;
  /** Kathmandu dates, inclusive. */
  from?: string;
  to?: string;
  page: number;
};

/** Kathmandu midnight at the start of `day` (the dev DB and app agree on +05:45). */
function nptStart(day: string): string {
  return `${day}T00:00:00+05:45`;
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function fetchOrders(filter: OrderFilter): Promise<Page<OrderListRow>> {
  let query = adminDb()
    .from("orders")
    .select(
      "id, order_number, created_at, contact_name, contact_email, contact_phone_e164, channel, user_id, status, payment_status, total_paisa, delivery_snapshot, order_items(image_path, quantity, created_at)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "order_items" });

  if (filter.q) {
    const number = orderNumberTerm(filter.q);
    const pattern = containsPattern(filter.q);
    const clauses = [`contact_name.ilike.${quotedFilterValue(pattern)}`, `contact_email.ilike.${quotedFilterValue(pattern.toLowerCase())}`];
    if (number) clauses.push(`order_number.ilike.${quotedFilterValue(containsPattern(number))}`);
    query = query.or(clauses.join(","));
  }
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.payment) query = query.eq("payment_status", filter.payment);
  if (filter.channel) query = query.eq("channel", filter.channel);
  if (filter.from) query = query.gte("created_at", nptStart(filter.from));
  if (filter.to) query = query.lt("created_at", nptStart(nextDay(filter.to)));

  const { data, error, count } = await query.range(...pageRange(filter.page));
  if (error) fail("orders", error);

  const rows = data.map((row) => {
    const snapshot = row.delivery_snapshot as { service_name?: unknown; courier_name?: unknown } | null;
    return {
      id: row.id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone_e164,
      channel: row.channel,
      isGuest: row.user_id === null,
      status: row.status,
      paymentStatus: row.payment_status,
      totalPaisa: row.total_paisa,
      itemCount: row.order_items.reduce((sum, item) => sum + item.quantity, 0),
      thumbnail: mediaUrl(row.order_items[0]?.image_path),
      serviceName:
        typeof snapshot?.courier_name === "string" && typeof snapshot.service_name === "string"
          ? `${snapshot.courier_name} · ${snapshot.service_name}`
          : null,
    };
  });
  return toPage(rows, count, filter.page);
}

export type AddressSnapshot = {
  recipient_name?: string;
  phone_e164?: string;
  province_name?: string;
  district_name?: string;
  municipality_name?: string;
  ward?: number;
  street_landmark?: string;
  postal_code?: string | null;
};

export type DeliverySnapshot = {
  zone_name?: string;
  courier_name?: string;
  service_name?: string;
  service_level?: string;
  price_paisa?: number;
  estimated_min_days?: number;
  estimated_max_days?: number;
};

export type ShipmentEventView = {
  id: string;
  status: ShipmentStatus;
  message: string;
  locationLabel: string | null;
  source: string;
  occurredAt: string;
};

export async function fetchOrderDetail(orderNumber: string) {
  const { data, error } = await adminDb()
    .from("orders")
    .select(
      `id, order_number, user_id, contact_name, contact_email, contact_phone_e164, shipping_address,
       status, payment_method, payment_status, subtotal_paisa, discount_paisa, delivery_fee_paisa, total_paisa,
       delivery_snapshot, coupon_code, customer_note, confirmed_at, packed_at, shipped_at, delivered_at,
       canceled_at, cancellation_reason, payment_collected_at, refunded_at, created_at, updated_at,
       channel, whatsapp_e164, created_by, accepted_at, accepted_by, accepted_via, canceled_by,
       order_items(id, product_id, product_title, variant_title, sku, image_path, unit_price_paisa, quantity, line_total_paisa, created_at),
       courier_handoffs(id, courier_id, status, attempts, first_sent_at, last_sent_at, last_sent_by, created_at),
       shipments(id, status, tracking_number, estimated_delivery_from, estimated_delivery_to, assigned_at, delivered_at, created_at,
         couriers(id, name, support_phone, website_url, dispatch_whatsapp_e164),
         courier_services(name),
         shipment_events(id, status, message, location_label, source, occurred_at, created_at))`,
    )
    .eq("order_number", orderNumber)
    .order("created_at", { referencedTable: "order_items" })
    .order("created_at", { referencedTable: "shipments" })
    .maybeSingle();
  if (error) fail("order detail", error);
  if (!data) return null;

  const shipment = data.shipments[0] ?? null;
  const events: ShipmentEventView[] = (shipment?.shipment_events ?? [])
    .map((event) => ({
      id: event.id,
      status: event.status,
      message: event.message,
      locationLabel: event.location_label,
      source: event.source,
      occurredAt: event.occurred_at,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  // One live handoff at most (courier_handoffs_one_active_idx); superseded ones are history.
  const handoff = data.courier_handoffs.find((row) => row.status !== "superseded") ?? null;

  return {
    ...data,
    address: data.shipping_address as AddressSnapshot,
    delivery: data.delivery_snapshot as DeliverySnapshot,
    items: data.order_items.map((item) => ({ ...item, thumbnail: mediaUrl(item.image_path) })),
    shipment,
    events,
    handoff,
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof fetchOrderDetail>>>;
export type CourierHandoff = NonNullable<OrderDetail["handoff"]>;

const acceptPreviewSchema = z.object({
  mode: z.enum(["auto", "manual"]),
  courier_id: z.string().nullable(),
  courier_name: z.string().nullable(),
  source: z.enum(["service", "default"]).nullable(),
});

export type AcceptPreview = {
  mode: "auto" | "manual";
  /** What the automatic rule would pick right now; null when nothing matches. */
  courier: { id: string; name: string; source: "service" | "default" } | null;
};

/** The store's courier mode and the courier Accept would pick for this order (orders.read). */
export async function fetchAcceptPreview(orderId: string): Promise<AcceptPreview> {
  const { data, error } = await adminDb().rpc("admin_accept_preview", { p_order_id: orderId });
  if (error) fail("accept preview", error);
  const preview = acceptPreviewSchema.parse(data);
  return {
    mode: preview.mode,
    courier:
      preview.courier_id && preview.courier_name && preview.source
        ? { id: preview.courier_id, name: preview.courier_name, source: preview.source }
        : null,
  };
}

/**
 * Names for "Entered by", "Accepted by" and "Sent by". Staff without
 * customers.read can't read profiles, so this goes through a function that
 * only ever names owner and staff profiles.
 */
export async function fetchStaffNames(ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const { data, error } = await adminDb().rpc("admin_staff_names", { p_ids: unique });
  if (error) fail("staff names", error);
  return new Map(data.map((row) => [row.id, row.full_name]));
}

export async function fetchStoreName(): Promise<string> {
  const { data, error } = await adminDb().from("store_settings").select("store_name").eq("singleton", true).maybeSingle();
  if (error) fail("store name", error);
  return data?.store_name ?? "Goreto.store";
}

export type CourierOption = { id: string; name: string };

export async function fetchActiveCouriers(): Promise<CourierOption[]> {
  const { data, error } = await adminDb().from("couriers").select("id, name").eq("is_active", true).order("name");
  if (error) fail("couriers", error);
  return data;
}

export type PaymentSummary = Record<PaymentStatus, { count: number; totalPaisa: number }>;

export async function fetchPaymentSummary(range: Pick<ResolvedRange, "from" | "to">): Promise<PaymentSummary> {
  const { data, error } = await adminDb().rpc("admin_payment_summary", { p_from: range.from, p_to: range.to });
  if (error) fail("payment summary", error);
  const summary = Object.fromEntries(PAYMENT_STATUSES.map((status) => [status, { count: 0, totalPaisa: 0 }])) as PaymentSummary;
  for (const row of data) summary[row.payment_status] = { count: row.order_count, totalPaisa: Number(row.total_paisa) };
  return summary;
}

/** Outstanding COD across all time: live orders whose cash hasn't been collected. */
export async function fetchOutstandingCod(): Promise<{ count: number; totalPaisa: number }> {
  const { data, error } = await adminDb().rpc("admin_outstanding_cod").single();
  if (error) fail("outstanding cod", error);
  return { count: data.order_count, totalPaisa: Number(data.total_paisa) };
}
