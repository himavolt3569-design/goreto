"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { CheckCircleIcon, WarningCircleIcon } from "@/components/ui/icons";
import { ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { SentOrder } from "../manual-order/manual-order-form";
import { PrintAndPickupButton, WhatsappSendButton } from "./parcel-actions";

/** What Save and send did on Send & track, with the one thing left to do. Focused so screen readers hear it. */
export function SendResultCard({ order, onDismiss }: { order: SentOrder; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [order]);
  const attention = order.kind === "attention";
  const Icon = attention ? WarningCircleIcon : CheckCircleIcon;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={attention ? "alert" : "status"}
      className={cn("flex flex-col gap-4 rounded-lg border p-6 shadow-sm outline-none", attention ? "border-warning-100 bg-warning-100" : "border-success-100 bg-success-100")}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" size={24} weight={ICON_WEIGHT_OUTLINE} className={cn("mt-0.5 shrink-0", attention ? "text-warning-700" : "text-success-700")} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-h3 text-neutral-900">
            {order.kind === "booked"
              ? `Order #${order.orderNumber} sent to ${order.courierName}`
              : order.kind === "whatsapp"
                ? `Order #${order.orderNumber} accepted for ${order.courierName}`
                : `Order #${order.orderNumber} saved`}
          </p>
          <p className="text-body text-neutral-700">
            {order.kind === "booked" ? `Tracking number ${order.trackingNumber}. Print the label, stick it on the parcel, and Daraz picks it up.` : order.message}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {order.kind === "booked" ? <PrintAndPickupButton orderId={order.orderId} /> : null}
        {order.kind === "whatsapp" && order.whatsappHref ? <WhatsappSendButton orderId={order.orderId} href={order.whatsappHref} courierName={order.courierName} /> : null}
        <Link href={`/admin/orders/${order.orderNumber}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
          Open the order
        </Link>
        <Button variant="text" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
