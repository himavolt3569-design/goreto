import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterBar, FilterField, LinkTabs, PageHeader, Pagination, Panel, TableScroll, Thumb, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { PAYMENT_LABELS, PaymentStatusPill } from "@/components/admin/status-pills";
import { FileTextIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OrderStatusPill } from "@/components/ui/status";
import { requireAdminAccess } from "@/features/admin/auth";
import { isIsoDate } from "@/features/admin/date-range";
import { formatCount, formatDateTime } from "@/features/admin/format";
import { fetchOrders, ORDER_STATUSES, PAYMENT_STATUSES } from "@/features/admin/queries/orders";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { sanitizeSearch } from "@/features/admin/search-input";
import { hrefWith, param } from "@/features/admin/url";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Orders" };

const STATUS_TABS = [
  { label: "All", value: null },
  { label: "Pending", value: "pending_confirmation" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Packed", value: "packed" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Canceled", value: "canceled" },
] as const;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdminAccess("orders.read");
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const status = pickEnum(params.status, ORDER_STATUSES);
  const payment = pickEnum(params.payment, PAYMENT_STATUSES);
  const from = isIsoDate(param(params, "from")) ? param(params, "from") : undefined;
  const to = isIsoDate(param(params, "to")) ? param(params, "to") : undefined;
  const page = pageNumber(params.page);

  const orders = await fetchOrders({ q, status, payment, from, to, page });

  return (
    <>
      <PageHeader title="Orders" description="All orders, newest first. Payment is Cash on Delivery; times are Kathmandu time." />
      <LinkTabs
        label="Order status"
        tabs={STATUS_TABS.map((tab) => ({ label: tab.label, href: hrefWith("/admin/orders", params, { status: tab.value }), active: status === tab.value }))}
      />
      <Panel title={`${formatCount(orders.total)} orders`}>
        <FilterBar resetHref={hrefWith("/admin/orders", {}, { status })} hasFilters={Boolean(q || payment || from || to)}>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <FilterField label="Order number, name or email" htmlFor="order-q" className="md:w-72">
            <Input id="order-q" type="search" name="q" defaultValue={q} placeholder="e.g. GT2609241234" maxLength={64} />
          </FilterField>
          <FilterField label="Payment" htmlFor="order-payment">
            <Select id="order-payment" name="payment" defaultValue={payment ?? ""}>
              <option value="">Any payment status</option>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_LABELS[value]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Placed from" htmlFor="order-from" className="md:w-44">
            <Input id="order-from" type="date" name="from" defaultValue={from} />
          </FilterField>
          <FilterField label="Placed to" htmlFor="order-to" className="md:w-44">
            <Input id="order-to" type="date" name="to" defaultValue={to} />
          </FilterField>
        </FilterBar>

        {orders.rows.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="No orders match" description="Try another status, date or search." />
        ) : (
          <>
            <TableScroll label="Orders">
              <table className={cn(tableClasses, "min-w-[960px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Order</th>
                    <th scope="col" className={thClasses}>Customer</th>
                    <th scope="col" className={thClasses}>Placed</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Items</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Total</th>
                    <th scope="col" className={thClasses}>Payment</th>
                    <th scope="col" className={thClasses}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.rows.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className={tdClasses}>
                        <Link href={`/admin/orders/${order.orderNumber}`} className="group flex items-center gap-3 rounded-sm">
                          <Thumb src={order.thumbnail} />
                          <span className="flex flex-col">
                            <span className="font-medium group-hover:text-primary-600">#{order.orderNumber}</span>
                            {order.serviceName ? <span className="text-small text-neutral-500">{order.serviceName}</span> : null}
                          </span>
                        </Link>
                      </td>
                      <td className={tdClasses}>
                        <span className="flex flex-col">
                          <span>{order.contactName}</span>
                          <span className="text-small text-neutral-500">{order.isGuest ? "Guest checkout" : order.contactEmail}</span>
                        </span>
                      </td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{formatDateTime(order.createdAt)}</td>
                      <td className={cn(tdClasses, numericClasses)}>{formatCount(order.itemCount)}</td>
                      <td className={cn(tdClasses, numericClasses, "font-medium")}>{formatNpr(order.totalPaisa)}</td>
                      <td className={tdClasses}>
                        <PaymentStatusPill status={order.paymentStatus} />
                      </td>
                      <td className={tdClasses}>
                        <OrderStatusPill status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pagination pathname="/admin/orders" params={params} page={orders.page} pageCount={orders.pageCount} total={orders.total} noun="orders" />
          </>
        )}
      </Panel>
    </>
  );
}
