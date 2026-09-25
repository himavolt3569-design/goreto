import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, Panel, TableScroll, Thumb, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { OrderActions } from "@/components/admin/order-actions";
import { PaymentStatusPill, SHIPMENT_LABELS, ShipmentStatusPill } from "@/components/admin/status-pills";
import { CheckIcon } from "@/components/ui/icons";
import { OrderStatusPill } from "@/components/ui/status";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate, formatDateTime, formatNepalPhone } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { ORDER_PROGRESS } from "@/features/admin/order-transitions";
import { fetchActiveCouriers, fetchOrderDetail, type OrderDetail } from "@/features/admin/queries/orders";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[orderNumber]">): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order #${orderNumber}` };
}

const ORDER_NUMBER = /^[A-Z]{2,4}[0-9]{6,14}$/;

const STEP_LABELS: Record<(typeof ORDER_PROGRESS)[number], string> = {
  pending_confirmation: "Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

function stepTime(order: OrderDetail, step: (typeof ORDER_PROGRESS)[number]): string | null {
  switch (step) {
    case "pending_confirmation":
      return order.created_at;
    case "confirmed":
      return order.confirmed_at;
    case "processing":
      return null;
    case "packed":
      return order.packed_at;
    case "shipped":
      return order.shipped_at;
    case "delivered":
      return order.delivered_at;
  }
}

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[orderNumber]">) {
  const profile = await requireAdminAccess("orders.read");
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw).toUpperCase();
  if (!ORDER_NUMBER.test(orderNumber)) notFound();

  const canWrite = canAccess(profile, "orders.write");
  const [order, couriers] = await Promise.all([fetchOrderDetail(orderNumber), canWrite ? fetchActiveCouriers() : Promise.resolve([])]);
  if (!order) notFound();

  const canViewCustomer = canAccess(profile, "customers.read") && order.user_id !== null;
  const reachedIndex = order.status === "canceled" ? -1 : ORDER_PROGRESS.indexOf(order.status);
  const shipment = order.shipment;
  const address = order.address;

  return (
    <>
      <BackLink href="/admin/orders">Orders</BackLink>
      <PageHeader
        title={`Order #${order.order_number}`}
        description={`Placed ${formatDateTime(order.created_at)} · Cash on Delivery`}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusPill status={order.status} />
            <PaymentStatusPill status={order.payment_status} />
            {shipment ? <ShipmentStatusPill status={shipment.status} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Progress" bodyClassName="px-6 pb-6">
            {order.status === "canceled" ? (
              <div className="flex flex-col gap-1 rounded-md bg-error-100 p-4">
                <p className="text-body font-semibold text-error-700">Canceled {formatDateTime(order.canceled_at)}</p>
                {order.cancellation_reason ? <p className="text-body text-error-700">{order.cancellation_reason}</p> : null}
              </div>
            ) : (
              <ol className="grid gap-4 sm:grid-cols-6">
                {ORDER_PROGRESS.map((step, index) => {
                  const done = index <= reachedIndex;
                  const time = stepTime(order, step);
                  return (
                    <li key={step} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                          done ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 bg-white text-neutral-500",
                        )}
                      >
                        {done ? <CheckIcon aria-hidden="true" size={16} weight="bold" /> : <span className="text-small font-semibold">{index + 1}</span>}
                      </span>
                      <span className="flex flex-col">
                        <span className={cn("text-body font-medium", done ? "text-neutral-900" : "text-neutral-500")}>
                          {STEP_LABELS[step]}
                          <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
                        </span>
                        <span className="text-small text-neutral-500">{done && time ? formatDateTime(time) : done ? "Done" : "Pending"}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="Items" description="As purchased. Titles and prices are snapshots from the time of the order.">
            <TableScroll label="Order items">
              <table className={tableClasses}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Item</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Unit price</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Qty</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className={tdClasses}>
                        <div className="flex items-center gap-3">
                          <Thumb src={item.thumbnail} />
                          <div className="flex flex-col">
                            {item.product_id && canAccess(profile, "catalog.read") ? (
                              <Link href={`/admin/products/${item.product_id}`} className="rounded-xs font-medium hover:text-primary-600">
                                {item.product_title}
                              </Link>
                            ) : (
                              <span className="font-medium">{item.product_title}</span>
                            )}
                            <span className="text-small text-neutral-500">{[item.variant_title, item.sku].filter(Boolean).join(" · ")}</span>
                          </div>
                        </div>
                      </td>
                      <td className={cn(tdClasses, numericClasses)}>{formatNpr(item.unit_price_paisa)}</td>
                      <td className={cn(tdClasses, numericClasses)}>{formatCount(item.quantity)}</td>
                      <td className={cn(tdClasses, numericClasses, "font-medium")}>{formatNpr(item.line_total_paisa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-2 px-6 pb-6 pt-2 text-body">
              <dt className="text-neutral-500">Subtotal</dt>
              <dd className="text-right tabular-nums">{formatNpr(order.subtotal_paisa)}</dd>
              {order.discount_paisa > 0 ? (
                <>
                  <dt className="text-neutral-500">Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
                  <dd className="text-right tabular-nums text-success-700">−{formatNpr(order.discount_paisa)}</dd>
                </>
              ) : null}
              <dt className="text-neutral-500">Delivery</dt>
              <dd className="text-right tabular-nums">{formatNpr(order.delivery_fee_paisa)}</dd>
              <dt className="border-t border-neutral-200 pt-2 font-semibold">Total (COD)</dt>
              <dd className="border-t border-neutral-200 pt-2 text-right font-semibold tabular-nums">{formatNpr(order.total_paisa)}</dd>
            </dl>
          </Panel>

          <Panel title="Tracking history" description="Newest first. Only events recorded by staff or reported by the courier.">
            {order.events.length === 0 ? (
              <p className="px-6 pb-6 text-body text-neutral-500">No tracking events yet.</p>
            ) : (
              <ol className="flex flex-col px-6 pb-6">
                {order.events.map((event, index) => (
                  <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < order.events.length - 1 ? <span aria-hidden="true" className="absolute left-[7px] top-5 h-full w-0.5 bg-neutral-200" /> : null}
                    <span aria-hidden="true" className={cn("relative mt-1 size-4 shrink-0 rounded-full border-2 border-white", index === 0 ? "bg-primary-500" : "bg-neutral-300")} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-body font-medium text-neutral-900">{SHIPMENT_LABELS[event.status]}</p>
                      <p className="text-body text-neutral-700">{event.message}</p>
                      <p className="text-small text-neutral-500">
                        {[formatDateTime(event.occurredAt), event.locationLabel, event.source === "system" ? "System" : event.source === "staff" ? "Staff" : "Courier"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {canWrite ? (
            <Panel title="Next steps" bodyClassName="px-6 pb-6">
              <OrderActions
                orderId={order.id}
                status={order.status}
                paymentStatus={order.payment_status}
                hasCourier={Boolean(shipment?.couriers)}
                couriers={couriers}
                currentCourierId={shipment?.couriers?.id ?? null}
                currentTracking={shipment?.tracking_number ?? null}
              />
            </Panel>
          ) : null}

          <Panel title="Customer" bodyClassName="px-6 pb-6">
            <dl className="flex flex-col gap-3 text-body">
              <div>
                <dt className="text-small text-neutral-500">Name</dt>
                <dd className="text-neutral-900">
                  {canViewCustomer ? (
                    <Link href={`/admin/customers/${order.user_id}`} className="rounded-xs font-medium hover:text-primary-600">
                      {order.contact_name}
                    </Link>
                  ) : (
                    order.contact_name
                  )}
                  {order.user_id === null ? <span className="ml-2 text-small text-neutral-500">Guest checkout</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-small text-neutral-500">Email</dt>
                <dd className="break-all text-neutral-900">{order.contact_email}</dd>
              </div>
              <div>
                <dt className="text-small text-neutral-500">Phone</dt>
                <dd className="text-neutral-900">
                  <a href={`tel:${order.contact_phone_e164}`} className="rounded-xs hover:text-primary-600">
                    {formatNepalPhone(order.contact_phone_e164)}
                  </a>
                </dd>
              </div>
              {order.customer_note ? (
                <div>
                  <dt className="text-small text-neutral-500">Order note</dt>
                  <dd className="whitespace-pre-line text-neutral-900">{order.customer_note}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Delivery address" description="Snapshot at checkout." bodyClassName="px-6 pb-6">
            <address className="flex flex-col gap-1 text-body not-italic text-neutral-900">
              <span className="font-medium">{address.recipient_name}</span>
              <span>{address.street_landmark}</span>
              <span>
                {address.municipality_name}
                {address.ward ? `, Ward ${address.ward}` : ""}
              </span>
              <span>
                {[address.district_name, address.province_name].filter(Boolean).join(", ")}
                {address.postal_code ? ` ${address.postal_code}` : ""}
              </span>
              {address.phone_e164 ? <span className="text-neutral-500">{formatNepalPhone(address.phone_e164)}</span> : null}
            </address>
          </Panel>

          <Panel title="Delivery" bodyClassName="px-6 pb-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-body">
              <dt className="text-neutral-500">Purchased</dt>
              <dd className="text-neutral-900">
                {[order.delivery.courier_name, order.delivery.service_name].filter(Boolean).join(" · ") || "—"}
                {order.delivery.zone_name ? <span className="block text-small text-neutral-500">{order.delivery.zone_name}</span> : null}
              </dd>
              <dt className="text-neutral-500">Courier</dt>
              <dd className="text-neutral-900">{shipment?.couriers?.name ?? "Not assigned yet"}</dd>
              <dt className="text-neutral-500">Tracking</dt>
              <dd className="break-all text-neutral-900">{shipment?.tracking_number ?? "—"}</dd>
              <dt className="text-neutral-500">Estimate</dt>
              <dd className="text-neutral-900">
                {shipment?.estimated_delivery_from && shipment.estimated_delivery_to
                  ? `${formatDate(`${shipment.estimated_delivery_from}T06:00:00Z`)} – ${formatDate(`${shipment.estimated_delivery_to}T06:00:00Z`)}`
                  : order.delivery.estimated_min_days !== undefined
                    ? `${order.delivery.estimated_min_days}–${order.delivery.estimated_max_days} days`
                    : "—"}
              </dd>
              {order.payment_collected_at ? (
                <>
                  <dt className="text-neutral-500">Collected</dt>
                  <dd className="text-neutral-900">{formatDateTime(order.payment_collected_at)}</dd>
                </>
              ) : null}
              {order.refunded_at ? (
                <>
                  <dt className="text-neutral-500">Refunded</dt>
                  <dd className="text-neutral-900">{formatDateTime(order.refunded_at)}</dd>
                </>
              ) : null}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
