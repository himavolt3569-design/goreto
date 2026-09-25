import type { Metadata } from "next";
import { EmptyState, Panel, PageHeader, StatCard, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { BarList } from "@/components/admin/bar-list";
import { DateRangePicker } from "@/components/admin/range-controls";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { ChartBarIcon, HandbagIcon, ReceiptIcon, UsersIcon, PackageIcon } from "@/components/ui/icons";
import { requireAdminAccess } from "@/features/admin/auth";
import {
  daySpan,
  formatDayLong,
  formatDayShort,
  formatMonthShort,
  presetRange,
  RANGE_PRESETS,
  resolveRange,
  todayInKathmandu,
} from "@/features/admin/date-range";
import { formatCount, humanize } from "@/features/admin/format";
import { fetchAnalyticsBreakdown, fetchRevenueSeries } from "@/features/admin/queries/dashboard";
import { hrefWith } from "@/features/admin/url";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Analytics" };

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};

function percent(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%` : "—";
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdminAccess("analytics.read");
  const params = await searchParams;
  const today = todayInKathmandu();
  const range = resolveRange(params, today);
  const bucket = daySpan(range.from, range.to) > 92 ? "month" : "day";

  const [breakdown, revenue] = await Promise.all([
    fetchAnalyticsBreakdown(range),
    fetchRevenueSeries({ from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo, bucket }),
  ]);

  const presets = RANGE_PRESETS.map((preset) => {
    const { from, to } = presetRange(preset.value, today);
    return { label: preset.label, href: hrefWith("/admin/analytics", params, { from, to }), selected: range.preset === preset.value };
  });

  const collected = breakdown.payment_totals.find((row) => row.status === "collected");
  const liveOrders = breakdown.order_count - (breakdown.status_counts.find((row) => row.status === "canceled")?.count ?? 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Sales, orders and customers for ${range.label}. Sales exclude canceled and refunded orders.`}
        actions={<DateRangePicker label={range.label} presets={presets} from={range.from} to={range.to} preserved={{}} />}
      />

      <section aria-label="Summary" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales" value={formatNpr(breakdown.sales_paisa)} hint={`${formatNpr(revenue.previousTotalPaisa)} ${range.compareLabel.replace(/^vs /, "in the ")}`} icon={HandbagIcon} />
        <StatCard label="Average order value" value={formatNpr(breakdown.aov_paisa)} hint={`${formatCount(breakdown.sold_order_count)} orders counted`} icon={ReceiptIcon} />
        <StatCard label="Units sold" value={formatCount(breakdown.units_sold)} hint={`Discounts given: ${formatNpr(breakdown.discount_paisa)}`} icon={PackageIcon} />
        <StatCard
          label="Repeat buyers"
          value={percent(breakdown.repeat_buyer_count, breakdown.buyer_count)}
          hint={`${formatCount(breakdown.buyer_count)} signed-in buyers · ${formatCount(breakdown.guest_order_count)} guest orders`}
          icon={UsersIcon}
        />
      </section>

      <Panel title="Sales over time" description={`Per ${bucket}, Kathmandu time.`} bodyClassName="px-6 pb-6">
        <RevenueChart
          caption={`Sales per ${bucket}, ${range.label}`}
          points={revenue.points.map((point) => ({
            label: bucket === "day" ? formatDayShort(point.bucket) : formatMonthShort(point.bucket),
            longLabel: bucket === "day" ? formatDayLong(point.bucket) : `${formatMonthShort(point.bucket)} ${point.bucket.slice(0, 4)}`,
            salesPaisa: point.salesPaisa,
            orders: point.orders,
          }))}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Orders by status" description={`${formatCount(breakdown.order_count)} orders placed`} bodyClassName="px-6 pb-6">
          {breakdown.order_count === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No orders in this period" />
          ) : (
            <BarList
              label="Orders by status"
              items={breakdown.status_counts.map((row) => ({
                label: ORDER_STATUS_LABELS[row.status] ?? humanize(row.status),
                value: row.count,
                display: formatCount(row.count),
                hint: percent(row.count, breakdown.order_count),
              }))}
            />
          )}
        </Panel>

        <Panel
          title="Cash on delivery"
          description={`Collected ${formatNpr(collected?.total_paisa ?? 0)} · collection rate ${percent(collected?.count ?? 0, liveOrders)} of live orders`}
          bodyClassName="px-6 pb-6"
        >
          {breakdown.payment_totals.length === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No payments in this period" />
          ) : (
            <BarList
              label="Order value by payment status"
              items={breakdown.payment_totals.map((row) => ({
                label: { pending: "COD pending", collected: "Collected", failed: "Failed", refunded: "Refunded" }[row.status] ?? humanize(row.status),
                value: row.total_paisa,
                display: formatNpr(row.total_paisa),
                hint: `${formatCount(row.count)} orders`,
              }))}
            />
          )}
        </Panel>

        <Panel title="Sales by category" bodyClassName="px-6 pb-6">
          {breakdown.categories.length === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No sales in this period" />
          ) : (
            <BarList
              label="Sales by category"
              items={breakdown.categories.map((row) => ({ label: row.title, value: row.revenue_paisa, display: formatNpr(row.revenue_paisa), hint: `${formatCount(row.units)} units` }))}
            />
          )}
        </Panel>

        <Panel title="Sales by province" description="From the delivery address on each order." bodyClassName="px-6 pb-6">
          {breakdown.provinces.length === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No sales in this period" />
          ) : (
            <BarList
              label="Sales by province"
              items={breakdown.provinces.map((row) => ({ label: row.name, value: row.revenue_paisa, display: formatNpr(row.revenue_paisa), hint: `${formatCount(row.orders)} orders` }))}
            />
          )}
        </Panel>
      </div>

      <Panel title="Top products" description="By sales in this period, from order snapshots.">
        {breakdown.top_products.length === 0 ? (
          <EmptyState icon={PackageIcon} title="No products sold in this period" />
        ) : (
          <TableScroll label="Top products">
            <table className={tableClasses}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>
                    #
                  </th>
                  <th scope="col" className={thClasses}>
                    Product
                  </th>
                  <th scope="col" className={cn(thClasses, "text-right")}>
                    Units
                  </th>
                  <th scope="col" className={cn(thClasses, "text-right")}>
                    Sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.top_products.map((product, index) => (
                  <tr key={product.product_id ?? product.title}>
                    <td className={cn(tdClasses, "w-12 text-neutral-500")}>{index + 1}</td>
                    <td className={cn(tdClasses, "font-medium")}>{product.title}</td>
                    <td className={cn(tdClasses, numericClasses)}>{formatCount(product.units)}</td>
                    <td className={cn(tdClasses, numericClasses)}>{formatNpr(product.revenue_paisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </>
  );
}
