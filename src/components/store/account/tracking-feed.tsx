import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { AccountTrackingEvent } from "@/features/account/queries";
import { formatOrderDateTime } from "@/features/orders/format";
import { SHIPMENT_STATUS_LABELS } from "@/features/orders/shipment-labels";

/**
 * Shipment events across the customer's orders, newest first. Each event
 * names its order and links to it. Only recorded events are shown.
 */
export function TrackingFeed({ events }: { events: AccountTrackingEvent[] }) {
  return (
    <Card className="p-4 sm:p-6">
      <ol aria-label="Tracking updates" className="flex flex-col gap-6 border-l-2 border-neutral-200 pl-4">
        {events.map((event, index) => (
          <li key={`${event.orderNumber}-${event.occurredAt}-${index}`} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-body-lg font-semibold text-neutral-900">{SHIPMENT_STATUS_LABELS[event.status]}</span>
              <Link
                href={`/account/orders/${event.orderNumber}`}
                className="rounded-xs text-body font-medium text-primary-600 underline-offset-4 hover:underline"
              >
                Order #{event.orderNumber}
              </Link>
            </div>
            <span className="text-body text-neutral-700">
              {event.message}
              {event.locationLabel ? ` · ${event.locationLabel}` : ""}
            </span>
            <time dateTime={event.occurredAt} className="text-small text-neutral-500">
              {formatOrderDateTime(event.occurredAt)}
            </time>
          </li>
        ))}
      </ol>
    </Card>
  );
}
