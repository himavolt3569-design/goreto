import type { ReactNode } from "react";
import type { CollectionState, CouponState, StockState } from "@/features/admin/states";
import type { Database } from "@/types/database";

type ProductStatus = Database["public"]["Enums"]["product_status"];
type ReviewStatus = Database["public"]["Enums"]["review_status"];
import type { PaymentStatus, ShipmentStatus } from "@/features/admin/order-transitions";
import { cn } from "@/lib/utils/cn";

/*
 * Status pills in the admin reference's style (text on a tint, 32px, 8px
 * radius). The label is always readable text; colour is never the only signal.
 */

export type PillTone = "success" | "warning" | "error" | "info" | "limited" | "neutral" | "primary";

const TONES: Record<PillTone, string> = {
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  error: "bg-error-100 text-error-700",
  info: "bg-info-100 text-info-700",
  limited: "bg-limited-100 text-limited-700",
  neutral: "bg-neutral-100 text-neutral-700",
  primary: "bg-primary-100 text-primary-700",
};

export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-sm px-3 text-body font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export type ProductDisplayStatus = ProductStatus | "low_stock" | "sold_out";

/** Active products show their stock problem instead (Low Stock / Out of Stock), as in the reference. */
export function productDisplayStatus(status: ProductStatus, stock: StockState): ProductDisplayStatus {
  if (status !== "active") return status;
  if (stock === "sold_out") return "sold_out";
  if (stock === "low_stock") return "low_stock";
  return "active";
}

const PRODUCT: Record<ProductDisplayStatus, { label: string; tone: PillTone }> = {
  active: { label: "Active", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
  low_stock: { label: "Low Stock", tone: "warning" },
  sold_out: { label: "Out of Stock", tone: "error" },
};

export function ProductStatusPill({ status }: { status: ProductDisplayStatus }) {
  return <Pill tone={PRODUCT[status].tone}>{PRODUCT[status].label}</Pill>;
}

const STOCK: Record<StockState, { label: string; tone: PillTone }> = {
  in_stock: { label: "In Stock", tone: "success" },
  low_stock: { label: "Low Stock", tone: "warning" },
  sold_out: { label: "Sold Out", tone: "error" },
};

export function StockPill({ state }: { state: StockState }) {
  return <Pill tone={STOCK[state].tone}>{STOCK[state].label}</Pill>;
}

const PAYMENT: Record<PaymentStatus, { label: string; tone: PillTone }> = {
  pending: { label: "COD pending", tone: "warning" },
  collected: { label: "Collected", tone: "success" },
  failed: { label: "Failed", tone: "error" },
  refunded: { label: "Refunded", tone: "limited" },
};

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  return <Pill tone={PAYMENT[status].tone}>{PAYMENT[status].label}</Pill>;
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "COD pending",
  collected: "Collected",
  failed: "Failed",
  refunded: "Refunded",
};

const SHIPMENT: Record<ShipmentStatus, { label: string; tone: PillTone }> = {
  awaiting_assignment: { label: "Awaiting courier", tone: "warning" },
  assigned: { label: "Courier assigned", tone: "info" },
  picked_up: { label: "Picked up", tone: "info" },
  in_transit: { label: "In transit", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "primary" },
  delivered: { label: "Delivered", tone: "success" },
  exception: { label: "Delivery issue", tone: "error" },
  returned: { label: "Returned", tone: "neutral" },
};

export function ShipmentStatusPill({ status }: { status: ShipmentStatus }) {
  return <Pill tone={SHIPMENT[status].tone}>{SHIPMENT[status].label}</Pill>;
}

export const SHIPMENT_LABELS: Record<ShipmentStatus, string> = Object.fromEntries(
  Object.entries(SHIPMENT).map(([status, config]) => [status, config.label]),
) as Record<ShipmentStatus, string>;

const REVIEW: Record<ReviewStatus, { label: string; tone: PillTone }> = {
  pending: { label: "Pending", tone: "warning" },
  published: { label: "Published", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
};

export function ReviewStatusPill({ status }: { status: ReviewStatus }) {
  return <Pill tone={REVIEW[status].tone}>{REVIEW[status].label}</Pill>;
}

const COUPON: Record<CouponState, { label: string; tone: PillTone }> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  exhausted: { label: "Used up", tone: "warning" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export function CouponStatePill({ state }: { state: CouponState }) {
  return <Pill tone={COUPON[state].tone}>{COUPON[state].label}</Pill>;
}

const COLLECTION: Record<CollectionState, { label: string; tone: PillTone }> = {
  live: { label: "Live", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  ended: { label: "Ended", tone: "neutral" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export function CollectionStatePill({ state }: { state: CollectionState }) {
  return <Pill tone={COLLECTION[state].tone}>{COLLECTION[state].label}</Pill>;
}

export function ActivePill({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <Pill tone={active ? "success" : "neutral"}>{active ? activeLabel : inactiveLabel}</Pill>;
}
