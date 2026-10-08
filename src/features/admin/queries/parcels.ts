import "server-only";
import { z } from "zod";
import { buildCourierMessage, whatsappLink } from "@/features/orders/courier-handoff";
import { darazConfig } from "@/lib/courier/daraz/config";
import { bookingAccount } from "@/lib/courier/daraz/booking";
import type { Database } from "@/types/database";
import type { ParcelState } from "../parcels";
import { containsPattern, orderNumberTerm, quotedFilterValue, sanitizeSearch } from "../search-input";
import { fetchDarazSettings } from "./daraz";
import { adminDb, fail, pageRange, toPage, type Page } from "./shared";

/*
 * Send & track (prompts/goreto-send-and-track.md): every parcel with what it
 * needs next, for every courier. RLS scopes it to staff with orders.read.
 * One read for the page's orders, one for the items the WhatsApp message and
 * the weight check need, plus a tracking-number lookup when searching.
 */

export const PARCEL_VIEWS = ["open", "delivered", "all"] as const;
export type ParcelView = (typeof PARCEL_VIEWS)[number];

const OPEN_STATUSES = ["pending_confirmation", "confirmed", "processing", "packed", "shipped"] as const;
const STALE_MS = 15 * 60_000;

export type ParcelRow = ParcelState & {
  orderId: string;
  orderNumber: string;
  channel: Database["public"]["Enums"]["order_channel"];
  createdAt: string;
  customer: string;
  phoneE164: string;
  place: string | null;
  totalPaisa: number;
  courierId: string | null;
  trackingNumber: string | null;
  estimatedTo: string | null;
  lastEvent: { message: string; at: string } | null;
  /** Booked with Daraz, not finished, and not synced in the last 15 minutes. */
  stale: boolean;
  /** The prefilled courier message, for accepted orders not sent to a WhatsApp courier yet. */
  whatsappHref: string | null;
};

const addressSchema = z
  .object({
    recipient_name: z.string().optional().catch(undefined),
    phone_e164: z.string().optional().catch(undefined),
    street_landmark: z.string().optional().catch(undefined),
    municipality_name: z.string().optional().catch(undefined),
    ward: z.coerce.number().int().optional().catch(undefined),
    district_name: z.string().optional().catch(undefined),
    province_name: z.string().optional().catch(undefined),
    postal_code: z.string().nullable().optional().catch(undefined),
  })
  .catch({});

const deliverySchema = z.object({ courier_name: z.string().optional().catch(undefined), service_name: z.string().optional().catch(undefined) }).catch({});

const SELECT = `id, order_number, status, payment_status, channel, created_at, contact_name, contact_phone_e164, total_paisa,
  shipping_address, delivery_snapshot,
  courier_services(couriers(name, is_active)),
  courier_handoffs(courier_id, status),
  shipments(id, status, tracking_number, provider_package_code, provider_needs_action, ready_to_ship_at, provider_synced_at,
    estimated_delivery_to, created_at,
    couriers(id, name, api_provider, dispatch_whatsapp_e164),
    shipment_events(message, occurred_at))`;

export type ParcelQuery = { view: ParcelView; q: string; page: number };

/** One page of parcels, newest first, each with its shipment's latest event. A search looks across every status. */
export async function fetchParcels({ view, q, page }: ParcelQuery): Promise<Page<ParcelRow>> {
  const [from, to] = pageRange(page);
  let query = adminDb().from("orders").select(SELECT, { count: "exact" });

  const term = sanitizeSearch(q);
  if (term.length >= 2) {
    const filter = await searchFilter(term);
    query = query.or(filter);
  } else if (view === "open") {
    query = query.in("status", [...OPEN_STATUSES]);
  } else if (view === "delivered") {
    query = query.eq("status", "delivered");
  }

  const { data, error, count } = await query
    .order("created_at", { referencedTable: "shipments" })
    .order("occurred_at", { referencedTable: "shipments.shipment_events", ascending: false })
    .limit(1, { referencedTable: "shipments.shipment_events" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) fail("parcels", error);
  return toPage(await toRows(data), count, page);
}

/** One parcel, for the card shown after Save and send. */
export async function fetchParcel(orderId: string): Promise<ParcelRow | null> {
  const { data, error } = await adminDb()
    .from("orders")
    .select(SELECT)
    .eq("id", orderId)
    .order("created_at", { referencedTable: "shipments" })
    .order("occurred_at", { referencedTable: "shipments.shipment_events", ascending: false })
    .limit(1, { referencedTable: "shipments.shipment_events" })
    .limit(1);
  if (error) fail("parcel", error);
  return (await toRows(data))[0] ?? null;
}

/** Order number, name, phone digits or a tracking number. */
async function searchFilter(term: string): Promise<string> {
  const clauses = [`contact_name.ilike.${quotedFilterValue(containsPattern(term))}`];
  const number = orderNumberTerm(term);
  if (number) clauses.push(`order_number.ilike.${quotedFilterValue(containsPattern(number))}`);
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 4) clauses.push(`contact_phone_e164.ilike.${quotedFilterValue(containsPattern(digits))}`);

  const tracking = term.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z0-9-]{4,100}$/.test(tracking)) {
    const { data, error } = await adminDb()
      .from("shipments")
      .select("order_id")
      .ilike("tracking_number", containsPattern(tracking))
      .limit(20);
    if (error) fail("parcel tracking search", error);
    if (data.length > 0) clauses.push(`id.in.(${data.map((row) => row.order_id).join(",")})`);
  }
  return clauses.join(",");
}

type OrderRecord = {
  id: string;
  order_number: string;
  status: Database["public"]["Enums"]["order_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
  channel: Database["public"]["Enums"]["order_channel"];
  created_at: string;
  contact_name: string;
  contact_phone_e164: string;
  total_paisa: number;
  shipping_address: unknown;
  delivery_snapshot: unknown;
  courier_services: { couriers: { name: string; is_active: boolean } | null } | null;
  courier_handoffs: { courier_id: string | null; status: Database["public"]["Enums"]["courier_handoff_status"] }[];
  shipments: {
    id: string;
    status: Database["public"]["Enums"]["shipment_status"];
    tracking_number: string | null;
    provider_package_code: string | null;
    provider_needs_action: boolean;
    ready_to_ship_at: string | null;
    provider_synced_at: string | null;
    estimated_delivery_to: string | null;
    couriers: { id: string; name: string; api_provider: string | null; dispatch_whatsapp_e164: string | null } | null;
    shipment_events: { message: string; occurred_at: string }[];
  }[];
};

type ItemRecord = { order_id: string; product_title: string; variant_title: string | null; quantity: number; product_variants: { weight_grams: number | null } | null };

async function toRows(data: readonly OrderRecord[]): Promise<ParcelRow[]> {
  if (data.length === 0) return [];
  // Items matter only before the parcel leaves: the weight check and the courier message.
  const waiting = data.filter((order) => ["confirmed", "processing", "packed"].includes(order.status)).map((order) => order.id);
  const [items, fallback, storeName] = await Promise.all([fetchItems(waiting), fetchFallbackCourier(), waiting.length > 0 ? fetchStoreName() : Promise.resolve("")]);
  const now = Date.now();

  return data.map((order): ParcelRow => {
    const address = addressSchema.parse(order.shipping_address);
    const delivery = deliverySchema.parse(order.delivery_snapshot);
    const shipment = order.shipments[0] ?? null;
    const courier = shipment?.couriers ?? null;
    const daraz = courier?.api_provider === "daraz";
    const orderItems = items.get(order.id) ?? [];
    const handoffSent = order.courier_handoffs.some((handoff) => handoff.status === "sent" && handoff.courier_id === courier?.id);
    const purchased = order.courier_services?.couriers;
    const booked = Boolean(shipment?.provider_package_code);
    const finished = shipment?.status === "delivered" || shipment?.status === "returned";
    const lastEvent = shipment?.shipment_events[0];

    const needsMessage = courier && !daraz && courier.dispatch_whatsapp_e164 && !handoffSent && orderItems.length > 0;
    const whatsappHref = needsMessage
      ? whatsappLink(
          courier.dispatch_whatsapp_e164!,
          buildCourierMessage({
            storeName,
            orderNumber: order.order_number,
            recipientName: address.recipient_name ?? order.contact_name,
            phoneE164: address.phone_e164 ?? order.contact_phone_e164,
            address: { ...address, postal_code: address.postal_code ?? null },
            serviceName: [delivery.courier_name, delivery.service_name].filter(Boolean).join(" · ") || null,
            codAmountPaisa: order.total_paisa,
            items: orderItems.map((item) => ({ title: item.product_title, variant: item.variant_title, quantity: item.quantity })),
          }),
        )
      : null;

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: order.status,
      paymentStatus: order.payment_status,
      channel: order.channel,
      createdAt: order.created_at,
      customer: order.contact_name,
      phoneE164: order.contact_phone_e164,
      place: [address.municipality_name, address.ward ? `Ward ${address.ward}` : null].filter(Boolean).join(", ") || null,
      totalPaisa: order.total_paisa,
      courierId: courier?.id ?? null,
      courier: courier ? { name: courier.name, daraz, whatsappE164: courier.dispatch_whatsapp_e164 } : null,
      routedCourierName: purchased?.is_active ? purchased.name : fallback,
      shipment: shipment
        ? { status: shipment.status, booked, readyToShip: shipment.ready_to_ship_at !== null, needsAction: shipment.provider_needs_action }
        : null,
      handoffSent,
      itemsWeighed: orderItems.length > 0 && orderItems.every((item) => item.product_variants?.weight_grams),
      trackingNumber: shipment?.tracking_number ?? null,
      estimatedTo: shipment?.estimated_delivery_to ?? null,
      lastEvent: lastEvent ? { message: lastEvent.message, at: lastEvent.occurred_at } : null,
      stale: daraz && booked && !finished && (!shipment?.provider_synced_at || now - Date.parse(shipment.provider_synced_at) > STALE_MS),
      whatsappHref,
    };
  });
}

async function fetchItems(orderIds: readonly string[]): Promise<Map<string, ItemRecord[]>> {
  const byOrder = new Map<string, ItemRecord[]>();
  if (orderIds.length === 0) return byOrder;
  const { data, error } = await adminDb()
    .from("order_items")
    .select("order_id, product_title, variant_title, quantity, created_at, product_variants(weight_grams)")
    .in("order_id", [...orderIds])
    .order("created_at");
  if (error) fail("parcel items", error);
  for (const item of data) byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item]);
  return byOrder;
}

/** The store's fallback courier when it's active: the routing rule's second choice. */
async function fetchFallbackCourier(): Promise<string | null> {
  const { data, error } = await adminDb().from("store_settings").select("couriers(name, is_active)").eq("singleton", true).maybeSingle();
  if (error) fail("fallback courier", error);
  return data?.couriers?.is_active ? data.couriers.name : null;
}

async function fetchStoreName(): Promise<string> {
  const { data, error } = await adminDb().from("store_settings").select("store_name").eq("singleton", true).maybeSingle();
  if (error) fail("store name", error);
  return data?.store_name ?? "Goreto.store";
}

/* ---------- Page context and Autopilot ---------- */

export type ParcelDeskContext = {
  darazConnected: boolean;
  usualWeightGrams: number | null;
};

export async function fetchParcelDeskContext(): Promise<ParcelDeskContext> {
  const settings = await fetchDarazSettings();
  return { darazConnected: darazConfig() !== null, usualWeightGrams: settings?.default_weight_grams ?? null };
}

export type AutopilotStatus = {
  autoAcceptWebsite: boolean;
  autoAcceptWhatsapp: boolean;
  courierModeAuto: boolean;
  darazAutoBook: boolean;
  codEnabled: boolean;
  fallbackCourier: string | null;
  darazConnected: boolean;
  darazCourier: boolean;
  darazSetupMissing: string[];
  usualWeightGrams: number | null;
  unweighedVariants: number;
};

/** What Autopilot switches and what would stop it (settings.manage + delivery.manage readers). */
export async function fetchAutopilotStatus(): Promise<AutopilotStatus> {
  const db = adminDb();
  const [store, daraz, darazCouriers, unweighed] = await Promise.all([
    db
      .from("store_settings")
      .select("auto_accept_website_orders, auto_accept_whatsapp_orders, courier_assignment_mode, cod_enabled, couriers(name, is_active)")
      .eq("singleton", true)
      .maybeSingle(),
    fetchDarazSettings(),
    db.from("couriers").select("id", { count: "exact", head: true }).eq("api_provider", "daraz").eq("is_active", true),
    db.from("product_variants").select("id, products!inner(status)", { count: "exact", head: true }).eq("is_active", true).eq("products.status", "active").is("weight_grams", null),
  ]);
  if (store.error) fail("autopilot settings", store.error);
  if (darazCouriers.error) fail("daraz couriers", darazCouriers.error);
  if (unweighed.error) fail("unweighed variants", unweighed.error);

  const account = bookingAccount(daraz);
  return {
    autoAcceptWebsite: store.data?.auto_accept_website_orders ?? false,
    autoAcceptWhatsapp: store.data?.auto_accept_whatsapp_orders ?? false,
    courierModeAuto: store.data?.courier_assignment_mode === "auto",
    darazAutoBook: daraz?.auto_book ?? false,
    codEnabled: store.data?.cod_enabled ?? false,
    fallbackCourier: store.data?.couriers?.is_active ? store.data.couriers.name : null,
    darazConnected: darazConfig() !== null,
    darazCourier: (darazCouriers.count ?? 0) > 0,
    darazSetupMissing: account.ok ? [] : account.missing,
    usualWeightGrams: daraz?.default_weight_grams ?? null,
    unweighedVariants: unweighed.count ?? 0,
  };
}

/** Delivery services whose courier books through Daraz, so the form can ask for a weight. */
export async function fetchDarazServiceIds(): Promise<string[]> {
  const { data, error } = await adminDb().from("courier_services").select("id, couriers!inner(api_provider)").eq("couriers.api_provider", "daraz");
  if (error) fail("daraz services", error);
  return data.map((row) => row.id);
}
