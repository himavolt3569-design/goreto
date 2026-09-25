import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkTabs, PageHeader, Pagination, Panel, StatCard, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { DateRangePicker } from "@/components/admin/range-controls";
import { PaymentStatusPill } from "@/components/admin/status-pills";
import { ArrowCounterClockwiseIcon, CheckCircleIcon, ClockCounterClockwiseIcon, CreditCardIcon, WarningCircleIcon } from "@/components/ui/icons";
import { OrderStatusPill } from "@/components/ui/status";
import { requireAdminAccess } from "@/features/admin/auth";
import { presetRange, RANGE_PRESETS, resolveRange, todayInKathmandu } from "@/features/admin/date-range";
import { formatCount, formatDateTime } from "@/features/admin/format";
import { fetchOrders, fetchOutstandingCod, fetchPaymentSummary, PAYMENT_STATUSES } from "@/features/admin/queries/orders";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { hrefWith } from "@/features/admin/url";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Payments" };

/**
 * Cash on Delivery ledger. Goreto takes no online payments (AGENTS §4.4):
 * cash is recorded as collected when an order is marked delivered.
 */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdminAccess("orders.read");
  const params = await searchParams;
  const today = todayInKathmandu();
  const range = resolveRange(params, today);
  const payment = pickEnum(params.payment, PAYMENT_STATUSES);
  const page = pageNumber(params.page);

  const [summary, outstanding, orders] = await Promise.all([
    fetchPaymentSummary(range),
    fetchOutstandingCod(),
    fetchOrders({ q: "", status: null, payment, from: range.from, to: range.to, page }),
  ]);

  const presets = RANGE_PRESETS.map((preset) => {
    const { from, to } = presetRange(preset.value, today);
    return { label: preset.label, href: hrefWith("/admin/payments", params, { from, to }), selected: range.preset === preset.value };
  });

  const tabs = [
    { label: "All", value: null },
    { label: "COD pending", value: "pending" },
    { label: "Collected", value: "collected" },
    { label: "Failed", value: "failed" },
    { label: "Refunded", value: "refunded" },
  ].map((tab) => ({
    label: tab.label,
    href: hrefWith("/admin/payments", params, { payment: tab.value }),
    active: payment === tab.value,
    count: tab.value ? summary[tab.value as keyof typeof summary].count : undefined,
  }));

  return (
    <>
      <PageHeader
        title="Payments"
        description="Cash on Delivery only. Cash is recorded as collected when an order is marked delivered."
        actions={<DateRangePicker label={range.label} presets={presets} from={range.from} to={range.to} preserved={payment ? { payment } : {}} />}
      />

      <section aria-label="Payment summary" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected" value={formatNpr(summary.collected.totalPaisa)} hint={`${formatCount(summary.collected.count)} orders placed in this range`} icon={CheckCircleIcon} tone="success" />
        <StatCard
          label="Awaiting collection (all time)"
          value={formatNpr(outstanding.totalPaisa)}
          hint={`${formatCount(outstanding.count)} live orders not yet delivered`}
          icon={ClockCounterClockwiseIcon}
          tone="warning"
        />
        <StatCard label="Failed" value={formatNpr(summary.failed.totalPaisa)} hint={`${formatCount(summary.failed.count)} canceled or undelivered`} icon={WarningCircleIcon} tone="error" />
        <StatCard label="Refunded" value={formatNpr(summary.refunded.totalPaisa)} hint={`${formatCount(summary.refunded.count)} orders`} icon={ArrowCounterClockwiseIcon} tone="neutral" />
      </section>

      <LinkTabs label="Payment status" tabs={tabs} />

      <Panel title={`${formatCount(orders.total)} orders placed ${range.label}`}>
        {orders.rows.length === 0 ? (
          <EmptyState icon={CreditCardIcon} title="No orders match" description="Try another payment status or date range." />
        ) : (
          <>
            <TableScroll label="Payments">
              <table className={cn(tableClasses, "min-w-[800px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Order</th>
                    <th scope="col" className={thClasses}>Customer</th>
                    <th scope="col" className={thClasses}>Placed</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Amount</th>
                    <th scope="col" className={thClasses}>Payment</th>
                    <th scope="col" className={thClasses}>Order status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.rows.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className={tdClasses}>
                        <Link href={`/admin/orders/${order.orderNumber}`} className="rounded-xs font-medium hover:text-primary-600">
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className={tdClasses}>{order.contactName}</td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{formatDateTime(order.createdAt)}</td>
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
            <Pagination pathname="/admin/payments" params={params} page={orders.page} pageCount={orders.pageCount} total={orders.total} noun="orders" />
          </>
        )}
      </Panel>
    </>
  );
}
