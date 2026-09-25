import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, Panel, StatCard, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { PaymentStatusPill, ReviewStatusPill } from "@/components/admin/status-pills";
import { ClockCounterClockwiseIcon, FileTextIcon, MoneyIcon } from "@/components/ui/icons";
import { Rating } from "@/components/ui/rating";
import { OrderStatusPill } from "@/components/ui/status";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate, formatDateTime, formatNepalPhone } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { fetchCustomerAddresses, fetchCustomerOrders, fetchCustomerProfile, fetchCustomerReviews } from "@/features/admin/queries/customers";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Customer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const profile = await requireAdminAccess("customers.read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const canOrders = canAccess(profile, "orders.read");
  const canReviews = canAccess(profile, "reviews.manage");
  const [customer, addresses, orders, reviews] = await Promise.all([
    fetchCustomerProfile(id),
    fetchCustomerAddresses(id),
    canOrders ? fetchCustomerOrders(id) : null,
    canReviews ? fetchCustomerReviews(id) : null,
  ]);
  if (!customer || customer.role !== "customer") notFound();

  // Server-side integer sums over all of this customer's orders (AGENTS §4.9 billing rules).
  const billed = orders?.filter((order) => order.paymentStatus === "collected").reduce((sum, order) => sum + order.totalPaisa, 0) ?? 0;
  const pending = orders?.filter((order) => order.paymentStatus === "pending" && order.status !== "canceled").reduce((sum, order) => sum + order.totalPaisa, 0) ?? 0;

  return (
    <>
      <BackLink href="/admin/customers">Customers</BackLink>
      <PageHeader
        title={customer.full_name ?? "Name not set"}
        description={`Customer since ${formatDate(customer.created_at)}${customer.deleted_at ? " · Account deleted" : ""}`}
      />

      {orders ? (
        <section aria-label="Customer summary" className="grid gap-6 sm:grid-cols-3">
          <StatCard label="Orders" value={formatCount(orders.length)} icon={FileTextIcon} />
          <StatCard label="Billed to date" value={formatNpr(billed)} hint="Cash collected on delivery" icon={MoneyIcon} tone="success" />
          <StatCard label="COD pending" value={formatNpr(pending)} hint="Live orders not yet delivered" icon={ClockCounterClockwiseIcon} tone="warning" />
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {orders ? (
            <Panel title="Orders">
              {orders.length === 0 ? (
                <p className="px-6 pb-6 text-body text-neutral-500">No orders yet.</p>
              ) : (
                <TableScroll label="Customer orders">
                  <table className={tableClasses}>
                    <thead>
                      <tr className={theadRowClasses}>
                        <th scope="col" className={thClasses}>Order</th>
                        <th scope="col" className={thClasses}>Placed</th>
                        <th scope="col" className={cn(thClasses, "text-right")}>Total</th>
                        <th scope="col" className={thClasses}>Payment</th>
                        <th scope="col" className={thClasses}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.orderNumber}>
                          <td className={tdClasses}>
                            <Link href={`/admin/orders/${order.orderNumber}`} className="rounded-xs font-medium hover:text-primary-600">
                              #{order.orderNumber}
                            </Link>
                          </td>
                          <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{formatDateTime(order.createdAt)}</td>
                          <td className={cn(tdClasses, numericClasses)}>{formatNpr(order.totalPaisa)}</td>
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
              )}
            </Panel>
          ) : null}

          {reviews ? (
            <Panel title="Reviews" action={<Link href="/admin/reviews" className="text-body font-medium text-primary-600 hover:underline">Moderate</Link>} bodyClassName="px-6 pb-6">
              {reviews.length === 0 ? (
                <p className="text-body text-neutral-500">No reviews yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-100">
                  {reviews.map((review) => (
                    <li key={review.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-neutral-900">{review.productTitle}</span>
                        <ReviewStatusPill status={review.status} />
                      </div>
                      <Rating value={review.rating} />
                      <p className="text-body text-neutral-700">{review.body}</p>
                      <p className="text-small text-neutral-500">{formatDate(review.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Contact" bodyClassName="px-6 pb-6">
            <dl className="flex flex-col gap-3 text-body">
              <div>
                <dt className="text-small text-neutral-500">Email</dt>
                <dd className="break-all text-neutral-900">{customer.email ?? "No verified email"}</dd>
              </div>
              <div>
                <dt className="text-small text-neutral-500">Phone</dt>
                <dd className="text-neutral-900">{formatNepalPhone(customer.phone_e164)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Saved addresses" bodyClassName="px-6 pb-6">
            {addresses.length === 0 ? (
              <p className="text-body text-neutral-500">No saved addresses.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {addresses.map((address) => (
                  <li key={address.id} className="flex flex-col gap-1 text-body">
                    <span className="font-medium text-neutral-900">
                      {address.label}
                      {address.isDefault ? <span className="ml-2 text-small font-normal text-primary-700">Default</span> : null}
                    </span>
                    <span className="text-neutral-700">{address.recipientName}</span>
                    <span className="text-neutral-700">{address.line}</span>
                    <span className="text-neutral-500">{formatNepalPhone(address.phone)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
