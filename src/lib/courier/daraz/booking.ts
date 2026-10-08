import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/types/database";
import { describeDarazError, type DarazResult } from "./client";
import type { DarazConfig } from "./config";
import { bookPackage, deliveryOptions, estimateShippingFee } from "./epis";
import { buildConsignment, buildDeliveryOptionsQuery, buildFeeEstimate, goodsValuePaisa, type BookingAccount, type BookingOptions, type BookingOrder, type DeliveryOption } from "./payloads";
import { toMilliseconds } from "./status-map";

/*
 * Booking an order with Daraz Express, shared by staff (their own session,
 * admin_* RPCs) and the courier sync (service role, courier_* RPCs) for
 * automatic booking. The order, prices and COD come from the database; the
 * caller supplies only the parcel (box, weight, option, note).
 */

export const PROVIDER = "daraz";

export type CourierDb = SupabaseClient<Database>;

type AccountRow = Database["public"]["Tables"]["courier_provider_accounts"]["Row"];

export type BoxPreset = { name: string; length_cm: number; width_cm: number; height_cm: number };

const boxPresetsSchema = z.array(z.object({ name: z.string(), length_cm: z.coerce.number(), width_cm: z.coerce.number(), height_cm: z.coerce.number() })).catch([]);

export type DarazSettings = Omit<AccountRow, "box_presets"> & { box_presets: BoxPreset[] };

export async function loadDarazSettings(db: CourierDb): Promise<DarazSettings | null> {
  const { data, error } = await db.from("courier_provider_accounts").select("*").eq("provider", PROVIDER).maybeSingle();
  if (error) throw new Error(`daraz settings: ${error.code ?? ""} ${error.message}`);
  return data ? { ...data, box_presets: boxPresetsSchema.parse(data.box_presets) } : null;
}

/** What booking needs from Setup, or the labels of what's missing. */
export function bookingAccount(settings: DarazSettings | null): { ok: true; account: BookingAccount } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!settings?.platform_name) missing.push("platform name");
  if (!settings?.external_seller_id) missing.push("external seller ID");
  if (!settings?.origin_name) missing.push("pickup contact name");
  if (!settings?.origin_phone_e164) missing.push("pickup phone");
  if (!settings?.origin_address_details) missing.push("pickup address");
  if (!settings || missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    account: {
      platformName: settings.platform_name!,
      externalSellerId: settings.external_seller_id!,
      pickupWarehouseCode: settings.pickup_warehouse_code,
      originName: settings.origin_name!,
      originPhoneE164: settings.origin_phone_e164!,
      originEmail: settings.origin_email,
      originAddressDetails: settings.origin_address_details!,
      originDarazAddressId: settings.origin_daraz_address_id,
      originLatitude: settings.origin_latitude,
      originLongitude: settings.origin_longitude,
      undeliverableOption: settings.undeliverable_option === "SCRAP" ? "SCRAP" : "RETURN",
      phoneFormat: settings.phone_format === "e164" ? "e164" : "national",
      declareInsurance: settings.declare_insurance,
      defaultItemCategory: settings.default_item_category,
    },
  };
}

/* ---------- One order ---------- */

const addressSchema = z
  .object({
    recipient_name: z.string().catch(""),
    phone_e164: z.string().catch(""),
    street_landmark: z.string().catch(""),
    ward: z.coerce.number().int().nullable().catch(null),
    municipality_code: z.string().nullable().catch(null),
    municipality_name: z.string().catch(""),
    district_name: z.string().catch(""),
    province_name: z.string().catch(""),
    latitude: z.coerce.number().nullable().catch(null),
    longitude: z.coerce.number().nullable().catch(null),
  })
  .partial()
  .catch({});

export type DarazShipment = {
  id: string;
  status: Database["public"]["Enums"]["shipment_status"];
  courierApiProvider: string | null;
  serviceOption: DeliveryOption | null;
  trackingNumber: string | null;
  packageCode: string | null;
  reference: string | null;
  bookingAttempts: number;
  providerStatus: string | null;
  needsAction: boolean;
  lastMileProvider: string | null;
  deliveryOption: string | null;
  firstMileType: string | null;
  pickupCutoffAt: string | null;
  bookedAt: string | null;
  awbPrintedAt: string | null;
  readyToShipAt: string | null;
  canceledAt: string | null;
  syncedAt: string | null;
  estimatedFrom: string | null;
  estimatedTo: string | null;
  package: { weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null };
  receiver: { name: string; phoneE164: string; details: string | null } | null;
  estimatedFeePaisa: number | null;
  actualFeePaisa: number | null;
  remittanceId: string | null;
};

export type BookingContext = {
  orderId: string;
  orderNumber: string;
  orderStatus: Database["public"]["Enums"]["order_status"];
  order: BookingOrder;
  shipment: DarazShipment | null;
  /** Sum of variant weights × quantity; null when any item has no weight. */
  suggestedWeightGrams: number | null;
  municipalityCode: string | null;
};

export async function loadBookingContext(db: CourierDb, orderId: string): Promise<BookingContext | null> {
  const { data, error } = await db
    .from("orders")
    .select(
      `id, order_number, status, created_at, total_paisa, subtotal_paisa, discount_paisa, contact_email, customer_note, shipping_address,
       order_items(id, product_title, variant_title, sku, quantity, unit_price_paisa, line_total_paisa, created_at, product_variants(weight_grams)),
       shipments(id, status, tracking_number, provider_package_code, provider_reference, provider_booking_attempts, provider_status,
         provider_needs_action, last_mile_provider, delivery_option, first_mile_type, pickup_cutoff_at, booked_at, awb_printed_at,
         ready_to_ship_at, provider_canceled_at, provider_synced_at, estimated_delivery_from, estimated_delivery_to,
         package_weight_grams, package_length_cm, package_width_cm, package_height_cm, provider_receiver, created_at,
         couriers(api_provider), courier_services(provider_option),
         shipment_courier_finance(estimated_fee_paisa, actual_fee_paisa, cod_remittance_id))`,
    )
    .eq("id", orderId)
    .order("created_at", { referencedTable: "order_items" })
    .order("created_at", { referencedTable: "shipments" })
    .maybeSingle();
  if (error) throw new Error(`daraz booking context: ${error.code ?? ""} ${error.message}`);
  if (!data) return null;

  const address = addressSchema.parse(data.shipping_address);
  let darazAddressId: string | null = null;
  if (address.municipality_code) {
    const { data: location } = await db.from("daraz_locations").select("daraz_address_id").eq("municipality_code", address.municipality_code).maybeSingle();
    darazAddressId = location?.daraz_address_id ?? null;
  }

  const weights = data.order_items.map((item) => (item.product_variants?.weight_grams ? item.product_variants.weight_grams * item.quantity : null));
  const row = data.shipments[0] ?? null;
  const finance = row?.shipment_courier_finance ?? null;
  const receiver = z
    .object({ name: z.string(), phone_e164: z.string(), details: z.string().nullable() })
    .nullable()
    .catch(null)
    .parse(row?.provider_receiver ?? null);

  return {
    orderId: data.id,
    orderNumber: data.order_number,
    orderStatus: data.status,
    municipalityCode: address.municipality_code ?? null,
    suggestedWeightGrams: weights.length > 0 && weights.every((weight) => weight !== null) ? weights.reduce<number>((sum, weight) => sum + weight!, 0) : null,
    order: {
      orderNumber: data.order_number,
      createdAt: data.created_at,
      totalPaisa: data.total_paisa,
      subtotalPaisa: data.subtotal_paisa,
      discountPaisa: data.discount_paisa,
      contactEmail: data.contact_email,
      customerNote: data.customer_note,
      address: {
        recipientName: address.recipient_name ?? "",
        phoneE164: address.phone_e164 ?? "",
        streetLandmark: address.street_landmark ?? "",
        ward: address.ward ?? null,
        municipalityName: address.municipality_name ?? "",
        districtName: address.district_name ?? "",
        provinceName: address.province_name ?? "",
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
      },
      darazAddressId,
      items: data.order_items.map((item) => ({
        id: item.id,
        title: item.product_title,
        variant: item.variant_title,
        sku: item.sku,
        quantity: item.quantity,
        unitPricePaisa: item.unit_price_paisa,
        lineTotalPaisa: item.line_total_paisa,
      })),
    },
    shipment: row
      ? {
          id: row.id,
          status: row.status,
          courierApiProvider: row.couriers?.api_provider ?? null,
          serviceOption: row.courier_services?.provider_option === "economy" ? "economy" : row.courier_services?.provider_option === "standard" ? "standard" : null,
          trackingNumber: row.tracking_number,
          packageCode: row.provider_package_code,
          reference: row.provider_reference,
          bookingAttempts: row.provider_booking_attempts,
          providerStatus: row.provider_status,
          needsAction: row.provider_needs_action,
          lastMileProvider: row.last_mile_provider,
          deliveryOption: row.delivery_option,
          firstMileType: row.first_mile_type,
          pickupCutoffAt: row.pickup_cutoff_at,
          bookedAt: row.booked_at,
          awbPrintedAt: row.awb_printed_at,
          readyToShipAt: row.ready_to_ship_at,
          canceledAt: row.provider_canceled_at,
          syncedAt: row.provider_synced_at,
          estimatedFrom: row.estimated_delivery_from,
          estimatedTo: row.estimated_delivery_to,
          package: {
            weightGrams: row.package_weight_grams,
            lengthCm: row.package_length_cm,
            widthCm: row.package_width_cm,
            heightCm: row.package_height_cm,
          },
          receiver: receiver ? { name: receiver.name, phoneE164: receiver.phone_e164, details: receiver.details } : null,
          estimatedFeePaisa: finance?.estimated_fee_paisa ?? null,
          actualFeePaisa: finance?.actual_fee_paisa ?? null,
          remittanceId: finance?.cod_remittance_id ?? null,
        }
      : null,
  };
}


/* ---------- Booking ---------- */

/** How a caller reserves the reference, records the booking and logs calls. */
export type BookingOps = {
  reference(orderId: string): Promise<{ ok: true; value: string } | { ok: false; message: string }>;
  record(orderId: string, booking: Record<string, Json>): Promise<{ ok: true } | { ok: false; message: string }>;
  log(action: string, orderId: string | null, result: DarazResult<unknown>): Promise<void>;
};

export type BookingOutcome = { ok: true; message: string; trackingNumber: string } | { ok: false; message: string };

/**
 * The weight to book with: the one staff typed, the shipment's saved one,
 * the products' total, then the store's usual parcel weight. Null when none.
 */
export function parcelWeight(settings: Pick<DarazSettings, "default_weight_grams">, context: BookingContext, typedGrams?: number | null): number | null {
  return typedGrams || context.shipment?.package.weightGrams || context.suggestedWeightGrams || settings.default_weight_grams || null;
}

export const MISSING_WEIGHT_MESSAGE = "Some items have no weight saved and there's no usual parcel weight. Add the weight and book it again.";

/** The parcel for one-click and automatic booking: first box size, the weight above, the service's option. */
export function defaultParcel(settings: DarazSettings, context: BookingContext, typedGrams?: number | null): BookingOptions | null {
  const weight = parcelWeight(settings, context, typedGrams);
  if (!weight) return null;
  const box = settings.box_presets[0];
  return {
    deliveryOption: context.shipment?.serviceOption ?? (settings.default_delivery_option === "economy" ? "economy" : "standard"),
    weightGrams: weight,
    lengthCm: box?.length_cm ?? Number(settings.default_length_cm),
    widthCm: box?.width_cm ?? Number(settings.default_width_cm),
    heightCm: box?.height_cm ?? Number(settings.default_height_cm),
    openBox: settings.default_open_box,
    deliveryNote: null,
  };
}

export async function bookWithDaraz(
  config: DarazConfig,
  settings: DarazSettings,
  context: BookingContext,
  parcel: BookingOptions,
  ops: BookingOps,
): Promise<BookingOutcome> {
  const account = bookingAccount(settings);
  if (!account.ok) return { ok: false, message: `Finish Daraz setup first: ${account.missing.join(", ")}.` };
  if (context.shipment?.courierApiProvider !== PROVIDER) return { ok: false, message: "This order's courier isn't Daraz Express. Assign Daraz Express first." };
  const existing = context.shipment.packageCode && context.shipment.trackingNumber ? context.shipment.trackingNumber : null;
  if (existing) return { ok: true, message: `Already booked. Tracking number ${existing}.`, trackingNumber: existing };
  if (!context.order.address.phoneE164 || !context.order.address.streetLandmark) {
    return { ok: false, message: "The delivery address or phone on this order is incomplete." };
  }

  const reference = await ops.reference(context.orderId);
  if (!reference.ok) return reference;

  const [fee, options] = await Promise.all([
    account.account.originDarazAddressId
      ? estimateShippingFee(
          config,
          buildFeeEstimate({
            account: account.account,
            destinationAddressId: context.order.darazAddressId,
            destinationLatitude: context.order.address.latitude,
            destinationLongitude: context.order.address.longitude,
            weightGrams: parcel.weightGrams,
            deliveryOption: parcel.deliveryOption,
            goodsValuePaisa: goodsValuePaisa(context.order),
          }),
        )
      : Promise.resolve(null),
    (() => {
      const query = buildDeliveryOptionsQuery({ account: account.account, order: context.order, options: parcel, reference: reference.value });
      return query ? deliveryOptions(config, query) : Promise.resolve(null);
    })(),
  ]);
  if (fee) await ops.log("estimate_fee", context.orderId, fee);
  if (options) await ops.log("delivery_options", context.orderId, options);
  const chosen = options?.ok ? options.data.find((item) => item.deliveryOption === parcel.deliveryOption) : undefined;

  const endpoint = settings.booking_endpoint === "consign" ? "consign" : "create";
  const booking = await bookPackage(config, endpoint, buildConsignment(context.order, account.account, parcel, reference.value));
  await ops.log(endpoint === "consign" ? "consign" : "create_package", context.orderId, booking);
  if (!booking.ok) {
    const trace = booking.error.traceId ? ` (Daraz trace ${booking.error.traceId})` : "";
    return { ok: false, message: `${describeDarazError(booking.error)}${trace}` };
  }

  const recorded = await ops.record(context.orderId, {
    package_code: booking.data.packageCode,
    tracking_number: booking.data.trackingNumber,
    reference: reference.value,
    delivery_option: parcel.deliveryOption,
    weight_grams: parcel.weightGrams,
    length_cm: parcel.lengthCm,
    width_cm: parcel.widthCm,
    height_cm: parcel.heightCm,
    last_mile_provider: booking.data.lastMileShippingProvider,
    min_eta_ms: booking.data.minEta ? String(toMilliseconds(booking.data.minEta)) : null,
    max_eta_ms: booking.data.maxEta ? String(toMilliseconds(booking.data.maxEta)) : null,
    estimated_fee_paisa: fee?.ok ? fee.data.totalPaisa : null,
    first_mile_type: chosen?.firstMileDeliveryType ?? null,
    pickup_cutoff_ms: chosen?.pickupTargetCutoffTime ? String(toMilliseconds(chosen.pickupTargetCutoffTime)) : null,
  });
  if (!recorded.ok) {
    console.error(`[daraz] booked ${booking.data.trackingNumber} but couldn't save it: ${recorded.message}`);
    return {
      ok: false,
      message: `Daraz booked the parcel (tracking ${booking.data.trackingNumber}) but Goreto couldn't save it. Book again: Daraz returns the same booking.`,
    };
  }
  return { ok: true, message: `Booked with Daraz Express. Tracking number ${booking.data.trackingNumber}.`, trackingNumber: booking.data.trackingNumber };
}

export type { DeliveryOption };
