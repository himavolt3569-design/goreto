import type { HTMLAttributes, ReactNode } from "react";
import { CubeIcon, PlayIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_XS, ICON_WEIGHT_FILLED, ICON_WEIGHT_OUTLINE } from "./icon";

export type StockStatus = "in_stock" | "low_stock" | "sold_out";
export type MediaStatus = "now_playing" | "ar_live";
export type IndicatorStatus = StockStatus | MediaStatus;

const indicatorConfig: Record<
  IndicatorStatus,
  { label: string; marker: ReactNode }
> = {
  in_stock: { label: "In Stock", marker: <Dot className="bg-success-500" /> },
  low_stock: { label: "Low Stock", marker: <Dot className="bg-warning-500" /> },
  sold_out: { label: "Sold Out", marker: <Dot className="bg-error-500" /> },
  now_playing: {
    label: "Now Playing",
    marker: (
      <span className="flex size-5 items-center justify-center rounded-full bg-primary-500 text-white">
        <PlayIcon size={10} weight={ICON_WEIGHT_FILLED} aria-hidden="true" />
      </span>
    ),
  },
  ar_live: {
    label: "AR Live",
    marker: (
      <CubeIcon
        size={ICON_SIZE_XS + 4}
        weight={ICON_WEIGHT_OUTLINE}
        className="text-primary-500"
        aria-hidden="true"
      />
    ),
  },
};

function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={cn("size-3 rounded-full", className)} />
  );
}

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement> & {
  status: IndicatorStatus;
  /** Override the default visible text (e.g. "Only 3 left"). */
  label?: string;
};

/** Marker + readable text. Colour is never the only signal. */
export function StatusIndicator({
  status,
  label,
  className,
  ...props
}: StatusIndicatorProps) {
  const config = indicatorConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-body text-neutral-700",
        className,
      )}
      {...props}
    >
      {config.marker}
      {label ?? config.label}
    </span>
  );
}

export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "canceled";

const orderStatusConfig: Record<OrderStatus, { label: string; tone: string }> = {
  pending_confirmation: {
    label: "Pending",
    tone: "bg-warning-100 text-warning-700",
  },
  confirmed: { label: "Confirmed", tone: "bg-info-100 text-info-700" },
  processing: { label: "Processing", tone: "bg-info-100 text-info-700" },
  packed: { label: "Packed", tone: "bg-limited-100 text-limited-700" },
  shipped: { label: "Shipped", tone: "bg-success-100 text-success-700" },
  delivered: { label: "Delivered", tone: "bg-success-100 text-success-700" },
  canceled: { label: "Canceled", tone: "bg-error-100 text-error-700" },
};

export type OrderStatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  status: OrderStatus;
};

/** Order status pill as used in the admin Recent Orders table. */
export function OrderStatusPill({
  status,
  className,
  ...props
}: OrderStatusPillProps) {
  const config = orderStatusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-sm px-3 text-body font-medium",
        config.tone,
        className,
      )}
      {...props}
    >
      {config.label}
    </span>
  );
}
