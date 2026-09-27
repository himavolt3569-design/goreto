import { z } from "zod";
import type { MediaImage } from "@/components/ui/media-frame";
import { productMediaImage } from "@/lib/media/storage";

/*
 * get_order_tracking's JSON (migration checkout_place_order), validated and
 * shaped for the confirmation and tracking pages. Everything comes from the
 * order's snapshots and its append-only shipment events; nothing is inferred.
 */

export const ORDER_STATUSES = ["pending_confirmation", "confirmed", "processing", "packed", "shipped", "delivered", "canceled"] as const;
export const SHIPMENT_STATUSES = [
  "awaiting_assignment",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const money = z.number().int();
const timestamp = z.string().nullable();
const coordinate = z.union([z.number(), z.string().transform(Number)]).nullable().optional();

const trackingSchema = z.object({
  order_number: z.string(),
  created_at: z.string(),
  status: z.enum(ORDER_STATUSES),
  payment_status: z.enum(["pending", "collected", "failed", "refunded"]),
  shipping_address: z.object({
    recipient_name: z.string(),
    phone_e164: z.string(),
    province_name: z.string(),
    district_name: z.string(),
    municipality_name: z.string(),
    ward: z.number().int(),
    street_landmark: z.string(),
    postal_code: z.string().nullable().optional(),
    latitude: coordinate,
    longitude: coordinate,
  }),
  delivery_snapshot: z.object({
    service_name: z.string(),
    service_level: z.string(),
    courier_name: z.string(),
    price_paisa: money,
    estimated_min_days: z.number().int(),
    estimated_max_days: z.number().int(),
  }),
  subtotal_paisa: money,
  discount_paisa: money,
  delivery_fee_paisa: money,
  total_paisa: money,
  coupon_code: z.string().nullable(),
  customer_note: z.string().nullable(),
  confirmed_at: timestamp,
  packed_at: timestamp,
  shipped_at: timestamp,
  delivered_at: timestamp,
  canceled_at: timestamp,
  cancellation_reason: z.string().nullable(),
  items: z.array(
    z.object({
      product_title: z.string(),
      variant_title: z.string().nullable(),
      sku: z.string(),
      image_path: z.string().nullable(),
      unit_price_paisa: money,
      quantity: z.number().int(),
      line_total_paisa: money,
    }),
  ),
  shipment: z
    .object({
      status: z.enum(SHIPMENT_STATUSES),
      tracking_number: z.string().nullable(),
      estimated_delivery_from: z.string().nullable(),
      estimated_delivery_to: z.string().nullable(),
      assigned_at: timestamp,
      courier_name: z.string().nullable(),
      courier_phone: z.string().nullable(),
      courier_website: z.string().nullable(),
    })
    .nullable(),
  events: z.array(
    z.object({
      status: z.enum(SHIPMENT_STATUSES),
      message: z.string(),
      location_label: z.string().nullable(),
      occurred_at: z.string(),
    }),
  ),
});

export type OrderTrackingItem = {
  title: string;
  variantTitle: string | null;
  sku: string;
  image: MediaImage | null;
  unitPricePaisa: number;
  quantity: number;
  lineTotalPaisa: number;
};

export type OrderTrackingEvent = {
  status: ShipmentStatus;
  message: string;
  locationLabel: string | null;
  occurredAt: string;
};

export type OrderTracking = {
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: "pending" | "collected" | "failed" | "refunded";
  address: {
    recipientName: string;
    phoneE164: string;
    provinceName: string;
    districtName: string;
    municipalityName: string;
    ward: number;
    streetLandmark: string;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  delivery: {
    serviceName: string;
    serviceLevel: string;
    courierName: string;
    pricePaisa: number;
    estimatedMinDays: number;
    estimatedMaxDays: number;
  };
  subtotalPaisa: number;
  discountPaisa: number;
  deliveryFeePaisa: number;
  totalPaisa: number;
  couponCode: string | null;
  note: string | null;
  confirmedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  items: OrderTrackingItem[];
  shipment: {
    status: ShipmentStatus;
    trackingNumber: string | null;
    estimatedFrom: string | null;
    estimatedTo: string | null;
    /** Present only once staff assign a courier. */
    courier: { name: string; phone: string | null; website: string | null } | null;
  } | null;
  /** Newest first. */
  events: OrderTrackingEvent[];
};

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseOrderTracking(json: unknown): OrderTracking {
  const order = trackingSchema.parse(json);
  const address = order.shipping_address;
  const latitude = finiteOrNull(address.latitude);
  const longitude = finiteOrNull(address.longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  const shipment = order.shipment;

  return {
    orderNumber: order.order_number,
    placedAt: order.created_at,
    status: order.status,
    paymentStatus: order.payment_status,
    address: {
      recipientName: address.recipient_name,
      phoneE164: address.phone_e164,
      provinceName: address.province_name,
      districtName: address.district_name,
      municipalityName: address.municipality_name,
      ward: address.ward,
      streetLandmark: address.street_landmark,
      postalCode: address.postal_code ?? null,
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
    },
    delivery: {
      serviceName: order.delivery_snapshot.service_name,
      serviceLevel: order.delivery_snapshot.service_level,
      courierName: order.delivery_snapshot.courier_name,
      pricePaisa: order.delivery_snapshot.price_paisa,
      estimatedMinDays: order.delivery_snapshot.estimated_min_days,
      estimatedMaxDays: order.delivery_snapshot.estimated_max_days,
    },
    subtotalPaisa: order.subtotal_paisa,
    discountPaisa: order.discount_paisa,
    deliveryFeePaisa: order.delivery_fee_paisa,
    totalPaisa: order.total_paisa,
    couponCode: order.coupon_code,
    note: order.customer_note,
    confirmedAt: order.confirmed_at,
    packedAt: order.packed_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    canceledAt: order.canceled_at,
    cancellationReason: order.cancellation_reason,
    items: order.items.map((item) => ({
      title: item.product_title,
      variantTitle: item.variant_title,
      sku: item.sku,
      image: productMediaImage(item.image_path, item.product_title),
      unitPricePaisa: item.unit_price_paisa,
      quantity: item.quantity,
      lineTotalPaisa: item.line_total_paisa,
    })),
    shipment: shipment
      ? {
          status: shipment.status,
          trackingNumber: shipment.tracking_number,
          estimatedFrom: shipment.estimated_delivery_from,
          estimatedTo: shipment.estimated_delivery_to,
          courier:
            shipment.assigned_at && shipment.courier_name
              ? { name: shipment.courier_name, phone: shipment.courier_phone, website: shipment.courier_website }
              : null,
        }
      : null,
    events: order.events.map((event) => ({
      status: event.status,
      message: event.message,
      locationLabel: event.location_label,
      occurredAt: event.occurred_at,
    })),
  };
}
