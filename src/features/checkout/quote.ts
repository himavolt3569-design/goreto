import { z } from "zod";
import type { MediaImage } from "@/components/ui/media-frame";
import { productMediaImage } from "@/lib/media/storage";

/*
 * checkout_quote's JSON, validated and turned into the view model the cart
 * and checkout render. Amounts are integer paisa computed by the database;
 * the browser only displays them.
 */

export const COUPON_ERRORS = ["not_found", "not_started", "expired", "usage_limit", "min_order", "customer_limit"] as const;
export type CouponError = (typeof COUPON_ERRORS)[number];

export const SERVICE_LEVELS = ["standard", "express", "pickup"] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

const money = z.number().int();

const lineSchema = z.object({
  variant_id: z.string(),
  product_slug: z.string().nullable(),
  product_title: z.string().nullable(),
  variant_title: z.string().nullable(),
  sku: z.string().nullable(),
  image_path: z.string().nullable(),
  unit_price_paisa: money.nullable(),
  quantity: z.number().int(),
  available_quantity: z.number().int(),
  line_total_paisa: money,
  status: z.enum(["ok", "unavailable", "insufficient_stock"]),
});

const optionSchema = z.object({
  courier_service_id: z.string(),
  service_name: z.string(),
  service_level: z.enum(SERVICE_LEVELS),
  description: z.string(),
  courier_name: z.string(),
  price_paisa: money,
  estimated_min_days: z.number().int(),
  estimated_max_days: z.number().int(),
});

const couponSchema = z.union([
  z.object({ code: z.string(), coupon_id: z.string(), description: z.string(), discount_paisa: money }),
  z.object({ code: z.string(), error: z.enum(COUPON_ERRORS), min_order_paisa: money.optional() }),
]);

const quoteSchema = z.object({
  lines: z.array(lineSchema),
  subtotal_paisa: money,
  zone: z.object({ id: z.string(), name: z.string() }).nullable(),
  delivery_options: z.array(optionSchema),
  selected_delivery: optionSchema.nullable(),
  coupon: couponSchema.nullable(),
  discount_paisa: money,
  delivery_fee_paisa: money,
  total_paisa: money,
  cod_enabled: z.boolean(),
  cod_max_order_paisa: money.nullable(),
});

export type QuoteLineStatus = z.infer<typeof lineSchema>["status"];

export type QuoteLine = {
  variantId: string;
  productSlug: string | null;
  title: string | null;
  variantTitle: string | null;
  sku: string | null;
  image: MediaImage | null;
  unitPricePaisa: number | null;
  quantity: number;
  availableQuantity: number;
  lineTotalPaisa: number;
  status: QuoteLineStatus;
};

export type DeliveryOption = {
  courierServiceId: string;
  serviceName: string;
  serviceLevel: ServiceLevel;
  description: string;
  courierName: string;
  pricePaisa: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
};

export type AppliedCoupon =
  | { status: "applied"; code: string; description: string; discountPaisa: number }
  | { status: "rejected"; code: string; error: CouponError; minOrderPaisa: number | null };

export type CheckoutQuote = {
  lines: QuoteLine[];
  subtotalPaisa: number;
  /** null until an address is chosen, or when no zone covers it. */
  zoneName: string | null;
  deliveryOptions: DeliveryOption[];
  selectedDelivery: DeliveryOption | null;
  coupon: AppliedCoupon | null;
  discountPaisa: number;
  deliveryFeePaisa: number;
  totalPaisa: number;
  codEnabled: boolean;
  codMaxOrderPaisa: number | null;
};

function toOption(option: z.infer<typeof optionSchema>): DeliveryOption {
  return {
    courierServiceId: option.courier_service_id,
    serviceName: option.service_name,
    serviceLevel: option.service_level,
    description: option.description,
    courierName: option.courier_name,
    pricePaisa: option.price_paisa,
    estimatedMinDays: option.estimated_min_days,
    estimatedMaxDays: option.estimated_max_days,
  };
}

/** Throws when the database returns an unexpected shape. */
export function parseCheckoutQuote(json: unknown): CheckoutQuote {
  const quote = quoteSchema.parse(json);
  const coupon = quote.coupon;
  return {
    lines: quote.lines.map((line) => ({
      variantId: line.variant_id,
      productSlug: line.product_slug,
      title: line.product_title,
      variantTitle: line.variant_title,
      sku: line.sku,
      image: productMediaImage(line.image_path, line.product_title ?? ""),
      unitPricePaisa: line.unit_price_paisa,
      quantity: line.quantity,
      availableQuantity: line.available_quantity,
      lineTotalPaisa: line.line_total_paisa,
      status: line.status,
    })),
    subtotalPaisa: quote.subtotal_paisa,
    zoneName: quote.zone?.name ?? null,
    // Reference order: Standard, Express, Pickup (cheapest first within a level).
    deliveryOptions: quote.delivery_options
      .map(toOption)
      .sort((a, b) => SERVICE_LEVELS.indexOf(a.serviceLevel) - SERVICE_LEVELS.indexOf(b.serviceLevel) || a.pricePaisa - b.pricePaisa),
    selectedDelivery: quote.selected_delivery ? toOption(quote.selected_delivery) : null,
    coupon:
      coupon === null
        ? null
        : "error" in coupon
          ? { status: "rejected", code: coupon.code, error: coupon.error, minOrderPaisa: coupon.min_order_paisa ?? null }
          : { status: "applied", code: coupon.code, description: coupon.description, discountPaisa: coupon.discount_paisa },
    discountPaisa: quote.discount_paisa,
    deliveryFeePaisa: quote.delivery_fee_paisa,
    totalPaisa: quote.total_paisa,
    codEnabled: quote.cod_enabled,
    codMaxOrderPaisa: quote.cod_max_order_paisa,
  };
}

/** "3–5 business days" / "1 business day". */
export function deliveryEstimate(minDays: number, maxDays: number): string {
  if (minDays === maxDays) return `${minDays} business ${minDays === 1 ? "day" : "days"}`;
  return `${minDays}–${maxDays} business days`;
}
