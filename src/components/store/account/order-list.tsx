import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CaretRightIcon } from "@/components/ui/icons";
import { OrderStatusPill } from "@/components/ui/status";
import type { AccountOrderRow } from "@/features/account/queries";
import { formatOrderDateTime } from "@/features/orders/format";
import { formatNpr } from "@/lib/money/format";

function itemLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

/**
 * The customer's orders as a list card. Each row links to the order detail;
 * the order number link stretches over the whole row.
 */
export function OrderList({ orders, label = "Your orders" }: { orders: AccountOrderRow[]; label?: string }) {
  return (
    <Card>
      <ul aria-label={label} className="flex flex-col divide-y divide-neutral-200">
        {orders.map((order) => (
          <li key={order.orderNumber} className="relative flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 hover:bg-neutral-50 sm:px-6">
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="w-fit rounded-xs text-body-lg font-semibold text-neutral-900 after:absolute after:inset-0 hover:text-primary-600"
              >
                Order #{order.orderNumber}
              </Link>
              <p className="text-body text-neutral-500">
                <time dateTime={order.placedAt}>{formatOrderDateTime(order.placedAt)}</time> · {itemLabel(order.itemCount)}
              </p>
            </div>
            <OrderStatusPill status={order.status} />
            <p className="w-28 text-right text-body-lg font-semibold tabular-nums text-neutral-900">{formatNpr(order.totalPaisa)}</p>
            <CaretRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="hidden text-neutral-500 sm:block" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
