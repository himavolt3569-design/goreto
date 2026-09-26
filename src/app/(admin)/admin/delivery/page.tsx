import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { AddLink, EditLink, EmptyState, PageHeader, Panel, SuccessNotice, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { DeliveryTabs } from "@/components/admin/delivery-tabs";
import { ActivePill, Pill } from "@/components/admin/status-pills";
import { TruckIcon } from "@/components/ui/icons";
import { setCourierActiveAction, setCourierServiceActiveAction } from "@/features/admin/actions/system";
import { requireAdminAccess } from "@/features/admin/auth";
import { humanize } from "@/features/admin/format";
import { fetchCouriers } from "@/features/admin/queries/system";
import { param } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Delivery & Courier" };

/**
 * Couriers and their services. Checkout offers only active services with a
 * rate for the confirmed address's zone. Courier API keys are server secrets,
 * never stored here (AGENTS §11.7).
 */
export default async function DeliveryPage({ searchParams }: PageProps<"/admin/delivery">) {
  await requireAdminAccess("delivery.manage");
  const deleted = param(await searchParams, "deleted") === "1";
  const couriers = await fetchCouriers();

  return (
    <>
      <PageHeader
        title="Delivery & Courier"
        description="Couriers, the services customers choose at checkout, and where they deliver."
        actions={<AddLink href="/admin/delivery/couriers/new">Add courier</AddLink>}
      />
      <DeliveryTabs active="couriers" />
      {deleted ? <SuccessNotice>Courier deleted.</SuccessNotice> : null}

      {couriers.length === 0 ? (
        <Panel title="Couriers">
          <EmptyState icon={TruckIcon} title="No couriers yet" description="Add a courier and its services so checkout can offer delivery." />
        </Panel>
      ) : (
        couriers.map((courier) => (
          <Panel
            key={courier.id}
            title={courier.name}
            description={[
              courier.integrationMode === "manual" ? "Manual tracking: staff record each update" : "API integration",
              courier.supportPhone ? `Support ${courier.supportPhone}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            action={
              <div className="flex items-center gap-3">
                <ActivePill active={courier.isActive} />
                <ToggleForm action={setCourierActiveAction} id={courier.id} checked={courier.isActive} label={`${courier.name} active`} />
                <EditLink href={`/admin/delivery/couriers/${courier.id}/edit`} label={courier.name} />
              </div>
            }
          >
            {courier.services.length === 0 ? (
              <p className="px-6 pb-6 text-body text-neutral-500">No services. Edit the courier to add one.</p>
            ) : (
              <TableScroll label={`${courier.name} services`}>
                <table className={cn(tableClasses, "min-w-[640px]")}>
                  <thead>
                    <tr className={theadRowClasses}>
                      <th scope="col" className={thClasses}>Service</th>
                      <th scope="col" className={thClasses}>Level</th>
                      <th scope="col" className={thClasses}>Estimate</th>
                      <th scope="col" className={thClasses}>Status</th>
                      <th scope="col" className={thClasses}>On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courier.services.map((service) => (
                      <tr key={service.id}>
                        <td className={tdClasses}>
                          <span className="flex flex-col">
                            <span className="font-medium">{service.name}</span>
                            <span className="text-small text-neutral-500">{service.code}</span>
                          </span>
                        </td>
                        <td className={tdClasses}>
                          <Pill tone={service.level === "express" ? "primary" : service.level === "pickup" ? "limited" : "neutral"}>{humanize(service.level)}</Pill>
                        </td>
                        <td className={cn(tdClasses, "text-neutral-700")}>
                          {service.minDays}–{service.maxDays} days
                        </td>
                        <td className={tdClasses}>
                          <ActivePill active={service.isActive && courier.isActive} activeLabel="Offered" inactiveLabel="Not offered" />
                        </td>
                        <td className={tdClasses}>
                          <ToggleForm action={setCourierServiceActiveAction} id={service.id} checked={service.isActive} label={`${courier.name} ${service.name} active`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>
        ))
      )}
    </>
  );
}
