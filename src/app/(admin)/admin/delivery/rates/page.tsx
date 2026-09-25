import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { DeliveryTabs } from "@/components/admin/delivery-tabs";
import { ActivePill } from "@/components/admin/status-pills";
import { MoneyIcon } from "@/components/ui/icons";
import { setRateActiveAction } from "@/features/admin/actions/system";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount } from "@/features/admin/format";
import { fetchRates } from "@/features/admin/queries/system";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Delivery rates" };

/** The fee charged per zone and service. Checkout recalculates it on the server. */
export default async function DeliveryRatesPage() {
  await requireAdminAccess("delivery.manage");
  const rates = await fetchRates();

  return (
    <>
      <PageHeader title="Delivery & Courier" description="What each service costs in each zone. The fee on an order is locked in at checkout." />
      <DeliveryTabs active="rates" />
      <Panel title={`${formatCount(rates.length)} rates`}>
        {rates.length === 0 ? (
          <EmptyState icon={MoneyIcon} title="No rates yet" />
        ) : (
          <TableScroll label="Delivery rates">
            <table className={cn(tableClasses, "min-w-[880px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Zone</th>
                  <th scope="col" className={thClasses}>Service</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Fee</th>
                  <th scope="col" className={thClasses}>Estimate</th>
                  <th scope="col" className={thClasses}>Conditions</th>
                  <th scope="col" className={thClasses}>Status</th>
                  <th scope="col" className={thClasses}>On</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id}>
                    <td className={cn(tdClasses, "font-medium")}>{rate.zoneName}</td>
                    <td className={tdClasses}>
                      <span className="flex flex-col">
                        <span>{rate.serviceName}</span>
                        <span className="text-small text-neutral-500">{rate.courierName}</span>
                      </span>
                    </td>
                    <td className={cn(tdClasses, numericClasses, "font-medium")}>{formatNpr(rate.pricePaisa)}</td>
                    <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>
                      {rate.minDays}–{rate.maxDays} days
                    </td>
                    <td className={cn(tdClasses, "text-neutral-700")}>
                      {[rate.minOrderPaisa ? `Orders from ${formatNpr(rate.minOrderPaisa)}` : null, rate.weightRange].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className={tdClasses}>
                      <ActivePill active={rate.isActive} />
                    </td>
                    <td className={tdClasses}>
                      <ToggleForm action={setRateActiveAction} id={rate.id} checked={rate.isActive} label={`${rate.serviceName} in ${rate.zoneName} active`} />
                    </td>
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
