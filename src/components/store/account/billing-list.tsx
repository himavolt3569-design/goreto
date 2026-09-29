import Link from "next/link";
import { Card } from "@/components/ui/card";
import { billingLine } from "@/features/account/billing";
import type { AccountOrderRow } from "@/features/account/queries";
import { formatOrderDateTime } from "@/features/orders/format";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { PaymentStatusPill } from "./account-ui";

const bucketNotes = {
  billed: "Counted in billed to date",
  pending: "Counted in pending COD",
  excluded: "Not counted",
} as const;

/**
 * Per-order billing breakdown. Each row says which total it counts toward;
 * canceled and refunded orders stay listed for transparency but aren't counted.
 */
export function BillingList({ orders }: { orders: AccountOrderRow[] }) {
  return (
    <Card>
      <ul aria-label="Billing by order" className="flex flex-col divide-y divide-neutral-200">
        {orders.map((order) => {
          const line = billingLine(order.status, order.paymentStatus);
          return (
            <li key={order.orderNumber} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="w-fit rounded-xs text-body-lg font-semibold text-neutral-900 hover:text-primary-600"
                >
                  Order #{order.orderNumber}
                </Link>
                <p className="text-body text-neutral-500">
                  <time dateTime={order.placedAt}>{formatOrderDateTime(order.placedAt)}</time>
                </p>
              </div>
              <PaymentStatusPill status={order.status} paymentStatus={order.paymentStatus} />
              <div className="flex w-36 flex-col items-end gap-1">
                <p
                  className={cn(
                    "text-body-lg font-semibold tabular-nums",
                    line.bucket === "excluded" ? "text-neutral-500 line-through" : "text-neutral-900",
                  )}
                >
                  {formatNpr(order.totalPaisa)}
                </p>
                <p className="text-small text-neutral-500">{bucketNotes[line.bucket]}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
