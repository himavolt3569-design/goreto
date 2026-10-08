import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/features/admin/format";
import { PARCEL_PROGRESS, parcelProgress, parcelStep, stepCopy, type ParcelContext, type ParcelStep } from "@/features/admin/parcels";
import type { ParcelRow } from "@/features/admin/queries/parcels";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { FailedDeliveryDialog } from "../daraz-shipment-panel";
import { PrintAndPickupButton, SendButton, WhatsappSendButton } from "./parcel-actions";

/*
 * Send & track rows (prompts/goreto-send-and-track.md): who, where, how far
 * the parcel has got, the latest tracking event, and one next step.
 */

type Tone = "todo" | "waiting" | "done" | "muted";

function stepTone(step: ParcelStep): Tone {
  switch (step.kind) {
    case "delivered":
      return "done";
    case "canceled":
      return "muted";
    case "daraz_offline":
    case "awaiting_pickup":
    case "sent":
    case "on_the_way":
    case "out_for_delivery":
      return "waiting";
    default:
      return "todo";
  }
}

const TONE_CLASSES: Record<Tone, string> = {
  todo: "bg-warning-100 text-warning-700",
  waiting: "bg-info-100 text-info-700",
  done: "bg-success-100 text-success-700",
  muted: "bg-neutral-100 text-neutral-700",
};

/** The courier, and that it books through Daraz when its name doesn't say so. */
export function courierLabel(courier: { name: string; daraz: boolean }): string {
  return courier.daraz && !/daraz/i.test(courier.name) ? `${courier.name} (Daraz Express)` : courier.name;
}

export function ParcelList({
  rows,
  context,
  canWrite,
  canManageDelivery,
}: {
  rows: readonly ParcelRow[];
  context: ParcelContext;
  canWrite: boolean;
  /** delivery.manage: may open the courier to add its WhatsApp number. */
  canManageDelivery: boolean;
}) {
  return (
    <ul className="flex flex-col" aria-label="Parcels">
      {rows.map((row) => {
        const step = parcelStep(row, context);
        const copy = stepCopy(step);
        const reached = parcelProgress(row);
        return (
          <li key={row.orderId} className="flex flex-col gap-4 border-b border-neutral-100 px-6 py-5 last:border-b-0 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-body">
                  <Link href={`/admin/orders/${row.orderNumber}`} className="rounded-xs font-semibold text-neutral-900 hover:text-primary-600">
                    #{row.orderNumber}
                  </Link>
                  <span className="text-neutral-900">{row.customer}</span>
                  {row.place ? <span className="text-neutral-500">· {row.place}</span> : null}
                </p>
                <p className="text-small text-neutral-500">
                  {[
                    `${formatNpr(row.totalPaisa)} COD`,
                    row.courier ? courierLabel(row.courier) : null,
                    row.trackingNumber ? `Tracking ${row.trackingNumber}` : null,
                    `Placed ${formatDateTime(row.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {row.orderStatus !== "canceled" ? (
                <ol className="grid max-w-xl grid-cols-4 gap-2" aria-label={`Progress of order ${row.orderNumber}`}>
                  {PARCEL_PROGRESS.map((label, index) => (
                    <li key={label} className="flex flex-col gap-1">
                      <span aria-hidden="true" className={cn("h-1.5 rounded-full", index <= reached ? "bg-primary-500" : "bg-neutral-200")} />
                      <span className={cn("text-small", index <= reached ? "font-medium text-neutral-900" : "text-neutral-500")}>
                        {label}
                        <span className="sr-only">{index <= reached ? " (done)" : " (not yet)"}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}

              <div className="flex flex-col gap-1">
                <span className={cn("w-fit rounded-full px-3 py-1 text-small font-medium", TONE_CLASSES[stepTone(step)])}>{copy.status}</span>
                {row.lastEvent ? (
                  <p className="text-small text-neutral-700">
                    {row.lastEvent.message} <span className="text-neutral-500">· {formatDateTime(row.lastEvent.at)}</span>
                  </p>
                ) : null}
                {row.estimatedTo && reached >= 1 && reached < 3 ? (
                  <p className="text-small text-neutral-500">Expected by {formatDate(`${row.estimatedTo}T06:00:00Z`)}</p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 lg:justify-end">
              <NextStep row={row} step={step} action={copy.action} canWrite={canWrite} canManageDelivery={canManageDelivery} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function NextStep({
  row,
  step,
  action,
  canWrite,
  canManageDelivery,
}: {
  row: ParcelRow;
  step: ParcelStep;
  action: string | null;
  canWrite: boolean;
  canManageDelivery: boolean;
}) {
  const orderHref = `/admin/orders/${row.orderNumber}`;
  const openOrder = (label: string) => (
    <Link href={orderHref} className={buttonClasses({ variant: "secondary", size: "md" })}>
      {label}
    </Link>
  );
  if (!action) {
    return step.kind === "awaiting_pickup" && canWrite ? (
      <a href={`/admin/daraz/labels?orders=${row.orderId}&type=pdf`} target="_blank" rel="noopener" className={buttonClasses({ variant: "text", size: "md" })}>
        Print label again
        <span className="sr-only"> (opens the label PDF in a new tab)</span>
      </a>
    ) : null;
  }
  if (!canWrite) return openOrder("View order");

  switch (step.kind) {
    case "accept":
      return step.courierName ? <SendButton orderId={row.orderId} label={action} /> : openOrder(action);
    case "book":
      return <SendButton orderId={row.orderId} label={action} booking />;
    case "print_and_ready":
      return <PrintAndPickupButton orderId={row.orderId} />;
    case "failed_delivery":
      return <FailedDeliveryDialog orderId={row.orderId} triggerLabel={action} />;
    case "send_whatsapp":
      return row.whatsappHref ? <WhatsappSendButton orderId={row.orderId} href={row.whatsappHref} courierName={step.courierName} /> : openOrder("Open the order");
    case "needs_courier_number": {
      const href = row.courierId && canManageDelivery ? `/admin/delivery/couriers/${row.courierId}/edit` : null;
      return href ? (
        <Link href={href} className={buttonClasses({ variant: "secondary", size: "md" })}>
          {action}
        </Link>
      ) : (
        <p className="max-w-xs text-small text-neutral-500">Ask someone with delivery access to add {step.courierName}&rsquo;s WhatsApp number.</p>
      );
    }
    default:
      return openOrder(action);
  }
}
