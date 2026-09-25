import "server-only";
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

export type OrderListRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  contactName: string;
  contactEmail: string;
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
      "id, order_number, created_at, contact_name, contact_email, user_id, status, payment_status, total_paisa, delivery_snapshot, order_items(image_path, quantity, created_at)",
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
       order_items(id, product_id, product_title, variant_title, sku, image_path, unit_price_paisa, quantity, line_total_paisa, created_at),
       shipments(id, status, tracking_number, estimated_delivery_from, estimated_delivery_to, assigned_at, delivered_at, created_at,
         couriers(id, name, support_phone, website_url),
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

  return {
    ...data,
    address: data.shipping_address as AddressSnapshot,
    delivery: data.delivery_snapshot as DeliverySnapshot,
    items: data.order_items.map((item) => ({ ...item, thumbnail: mediaUrl(item.image_path) })),
    shipment,
    events,
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof fetchOrderDetail>>>;

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
