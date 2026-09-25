import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Panel, PageHeader, TableScroll, Thumb, ViewAllLink, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { KpiCard } from "@/components/admin/kpi-card";
import { ProductActionsMenu } from "@/components/admin/product-actions-menu";
import { DateRangePicker, WindowSelect } from "@/components/admin/range-controls";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { ProductStatusPill, productDisplayStatus } from "@/components/admin/status-pills";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretRightIcon,
  CoatHangerIcon,
  CubeIcon,
  FileTextIcon,
  HandbagIcon,
  LockSimpleIcon,
  MoneyIcon,
  ShieldCheckIcon,
  TruckIcon,
  UsersIcon,
  type Icon,
} from "@/components/ui/icons";
import { Card } from "@/components/ui/card";
import { OrderStatusPill } from "@/components/ui/status";
import { requireAdminAccess } from "@/features/admin/auth";
import {
  formatDayLong,
  formatDayShort,
  formatMonthShort,
  presetRange,
  RANGE_PRESETS,
  resolveRange,
  resolveRevenueWindow,
  REVENUE_WINDOWS,
  todayInKathmandu,
} from "@/features/admin/date-range";
import { formatCount, relativeTime, shortName } from "@/features/admin/format";
import { describeChange, formatChange, percentChange } from "@/features/admin/metrics";
import { canAccess, type AdminAccess } from "@/features/admin/nav";
import { fetchRecentProducts } from "@/features/admin/queries/catalog";
import { fetchDashboardKpis, fetchRecentOrders, fetchRevenueSeries } from "@/features/admin/queries/dashboard";
import { hrefWith, type SearchParams } from "@/features/admin/url";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Dashboard" };

type QuickSetting = { title: string; description: string; href: string; icon: Icon; access: AdminAccess };

/*
 * The reference's "Payment Gateways" card is replaced by Checkout & COD:
 * Goreto takes Cash on Delivery only (AGENTS §4.4, §26.1).
 */
const QUICK_SETTINGS: QuickSetting[] = [
  { title: "AR Configuration", description: "Manage AR try-on assets and which products are AR ready.", href: "/admin/ar", icon: CoatHangerIcon, access: "ar.manage" },
  { title: "Checkout & COD", description: "Cash on delivery limits, returns window and stock alerts.", href: "/admin/settings#checkout", icon: MoneyIcon, access: "settings.manage" },
  { title: "Delivery & Courier", description: "Manage couriers, delivery zones and rates.", href: "/admin/delivery", icon: TruckIcon, access: "delivery.manage" },
  { title: "Roles & Permissions", description: "Manage staff access and permissions.", href: "/admin/staff", icon: ShieldCheckIcon, access: "owner" },
];

/** Search params other than the ones a control sets, for GET forms. */
function preservedParams(params: SearchParams, omit: string[]): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && !omit.includes(key)) kept[key] = first;
  }
  return kept;
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const profile = await requireAdminAccess("admin");
  const params = await searchParams;
  const today = todayInKathmandu();
  const range = resolveRange(params, today);
  const revenueWindow = resolveRevenueWindow(params.revenue, today);

  const canAnalytics = canAccess(profile, "analytics.read");
  const canOrders = canAccess(profile, "orders.read");
  const canCatalog = canAccess(profile, "catalog.read");
  const canCatalogWrite = canAccess(profile, "catalog.write");
  const quickSettings = QUICK_SETTINGS.filter((setting) => canAccess(profile, setting.access));

  const [kpis, revenue, recentOrders, recentProducts] = await Promise.all([
    canAnalytics ? fetchDashboardKpis(range) : null,
    canAnalytics ? fetchRevenueSeries(revenueWindow) : null,
    canOrders ? fetchRecentOrders(5) : null,
    canCatalog ? fetchRecentProducts(5) : null,
  ]);

  const presets = RANGE_PRESETS.map((preset) => {
    const { from, to } = presetRange(preset.value, today);
    return { label: preset.label, href: hrefWith("/admin", params, { from, to }), selected: range.preset === preset.value };
  });

  const nothingVisible = !canAnalytics && !canOrders && !canCatalog && quickSettings.length === 0;

  return (
    <>
      <PageHeader
        display
        title="Admin Dashboard"
        description="Here's what's happening with your store today."
        actions={
          canAnalytics ? (
            <DateRangePicker label={range.label} presets={presets} from={range.from} to={range.to} preserved={preservedParams(params, ["from", "to"])} />
          ) : undefined
        }
      />

      {nothingVisible ? (
        <Card>
          <EmptyState
            icon={LockSimpleIcon}
            title="Ask the store owner for access"
            description="Your staff account doesn't have any admin permissions yet. The owner can grant them under Roles & Permissions."
          />
        </Card>
      ) : null}

      {kpis ? (
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="sr-only">
            Key metrics for {range.label}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Sales"
              value={formatNpr(kpis.current.sales_paisa)}
              icon={HandbagIcon}
              change={percentChange(kpis.current.sales_paisa, kpis.previous.sales_paisa)}
              compareLabel={range.compareLabel}
              trend={kpis.daily.map((day) => day.sales_paisa)}
            />
            <KpiCard
              label="Orders"
              value={formatCount(kpis.current.orders)}
              icon={FileTextIcon}
              change={percentChange(kpis.current.orders, kpis.previous.orders)}
              compareLabel={range.compareLabel}
              trend={kpis.daily.map((day) => day.orders)}
            />
            <KpiCard
              label="Active Products"
              value={formatCount(kpis.current.active_products)}
              icon={CubeIcon}
              change={percentChange(kpis.current.active_products, kpis.previous.active_products)}
              compareLabel={range.compareLabel}
              trend={kpis.daily.map((day) => day.active_products)}
            />
            <KpiCard
              label="Customers"
              value={formatCount(kpis.current.customers)}
              icon={UsersIcon}
              change={percentChange(kpis.current.customers, kpis.previous.customers)}
              compareLabel={range.compareLabel}
              trend={kpis.daily.map((day) => day.customers)}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {revenue ? (
          <Panel
            title="Revenue Overview"
            action={
              <WindowSelect
                name="revenue"
                value={revenueWindow.window}
                options={REVENUE_WINDOWS}
                preserved={preservedParams(params, ["revenue"])}
                label="Revenue period"
              />
            }
            bodyClassName="gap-4 px-6 pb-6"
          >
            <RevenueHeadline totalPaisa={revenue.totalPaisa} previousPaisa={revenue.previousTotalPaisa} compareLabel={revenueWindow.compareLabel} />
            <RevenueChart
              caption={`Sales per ${revenueWindow.bucket} for ${REVENUE_WINDOWS.find((option) => option.value === revenueWindow.window)!.label.toLowerCase()}`}
              points={revenue.points.map((point) => ({
                label: revenueWindow.bucket === "day" ? formatDayShort(point.bucket) : formatMonthShort(point.bucket),
                longLabel: revenueWindow.bucket === "day" ? formatDayLong(point.bucket) : `${formatMonthShort(point.bucket)} ${point.bucket.slice(0, 4)}`,
                salesPaisa: point.salesPaisa,
                orders: point.orders,
              }))}
            />
          </Panel>
        ) : null}

        {recentOrders ? (
          <Panel title="Recent Orders" action={<ViewAllLink href="/admin/orders" />}>
            {recentOrders.length === 0 ? (
              <EmptyState icon={FileTextIcon} title="No orders yet" description="New orders will appear here as soon as customers check out." />
            ) : (
              <TableScroll label="Recent orders">
                <table className={cn(tableClasses, "min-w-[560px]")}>
                  <thead>
                    <tr className={theadRowClasses}>
                      <th scope="col" className={thClasses}>
                        Order ID
                      </th>
                      <th scope="col" className={thClasses}>
                        Customer
                      </th>
                      <th scope="col" className={thClasses}>
                        Amount
                      </th>
                      <th scope="col" className={thClasses}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.orderNumber} className="hover:bg-neutral-50">
                        <td className={tdClasses}>
                          <Link href={`/admin/orders/${order.orderNumber}`} className="group flex items-center gap-3 rounded-sm">
                            <Thumb src={order.thumbnail} />
                            <span className="flex flex-col">
                              <span className="font-medium group-hover:text-primary-600">#{order.orderNumber}</span>
                              <span className="text-small text-neutral-500">{relativeTime(order.createdAt)}</span>
                            </span>
                          </Link>
                        </td>
                        <td className={tdClasses}>{shortName(order.contactName)}</td>
                        <td className={cn(tdClasses, "whitespace-nowrap tabular-nums")}>{formatNpr(order.totalPaisa)}</td>
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

        {recentProducts ? (
          <Panel title="Product Management" action={<ViewAllLink href="/admin/products" />}>
            {recentProducts.length === 0 ? (
              <EmptyState icon={CubeIcon} title="No products yet" />
            ) : (
              <TableScroll label="Recently updated products">
                <table className={tableClasses}>
                  <thead>
                    <tr className={theadRowClasses}>
                      <th scope="col" className={thClasses}>
                        Product
                      </th>
                      <th scope="col" className={thClasses}>
                        Category
                      </th>
                      <th scope="col" className={thClasses}>
                        Stock
                      </th>
                      <th scope="col" className={thClasses}>
                        Price
                      </th>
                      <th scope="col" className={thClasses}>
                        Status
                      </th>
                      <th scope="col" className={cn(thClasses, "text-right")}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-neutral-50">
                        <td className={tdClasses}>
                          <Link href={`/admin/products/${product.id}`} className="group flex items-center gap-3 rounded-sm">
                            <Thumb src={product.thumbnail} />
                            <span className="font-medium group-hover:text-primary-600">{product.title}</span>
                          </Link>
                        </td>
                        <td className={cn(tdClasses, "text-neutral-700")}>{product.categoryTitle ?? "—"}</td>
                        <td
                          className={cn(
                            tdClasses,
                            "font-medium tabular-nums",
                            product.stockState === "in_stock" ? "text-success-700" : "text-error-700",
                          )}
                        >
                          {formatCount(product.totalStock)}
                        </td>
                        <td className={cn(tdClasses, "whitespace-nowrap tabular-nums")}>{formatNpr(product.pricePaisa)}</td>
                        <td className={tdClasses}>
                          <ProductStatusPill status={productDisplayStatus(product.status, product.stockState)} />
                        </td>
                        <td className={cn(tdClasses, "text-right")}>
                          <ProductActionsMenu product={product} canWrite={canCatalogWrite} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>
        ) : null}

        {quickSettings.length > 0 ? (
          <Panel title="Quick Settings" bodyClassName="px-6 pb-6">
            <ul className="grid gap-4 sm:grid-cols-2">
              {quickSettings.map((setting) => (
                <li key={setting.href}>
                  <Link
                    href={setting.href}
                    className="group flex h-full items-center gap-4 rounded-md border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-500">
                      <setting.icon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-body font-semibold text-neutral-900">{setting.title}</span>
                      <span className="text-small text-neutral-500">{setting.description}</span>
                    </span>
                    <CaretRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="shrink-0 text-neutral-500 group-hover:text-primary-500" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </>
  );
}

function RevenueHeadline({ totalPaisa, previousPaisa, compareLabel }: { totalPaisa: number; previousPaisa: number; compareLabel: string }) {
  const change = percentChange(totalPaisa, previousPaisa);
  const up = change.kind === "change" && change.direction === "up";
  const down = change.kind === "change" && change.direction === "down";
  const ChangeIcon = down ? ArrowDownIcon : ArrowUpIcon;
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-display text-display-2 text-neutral-900">{formatNpr(totalPaisa)}</span>
      <span className="sr-only">{describeChange(change, compareLabel)}</span>
      <span aria-hidden="true" className={cn("inline-flex items-center gap-1 text-body font-semibold", up ? "text-success-700" : down ? "text-error-700" : "text-neutral-700")}>
        {change.kind === "change" ? <ChangeIcon size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} /> : null}
        {formatChange(change)}
      </span>
      <span aria-hidden="true" className="text-body text-neutral-500">
        {compareLabel}
      </span>
    </p>
  );
}
