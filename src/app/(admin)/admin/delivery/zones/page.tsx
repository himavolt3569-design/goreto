import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-ui";
import { DeliveryTabs } from "@/components/admin/delivery-tabs";
import { ActivePill } from "@/components/admin/status-pills";
import { MapPinIcon } from "@/components/ui/icons";
import { setZoneActiveAction } from "@/features/admin/actions/system";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount } from "@/features/admin/format";
import { fetchZones } from "@/features/admin/queries/system";

export const metadata: Metadata = { title: "Delivery zones" };

/** Zones match a confirmed address by district; each district belongs to one zone. */
export default async function DeliveryZonesPage() {
  await requireAdminAccess("delivery.manage");
  const zones = await fetchZones();

  return (
    <>
      <PageHeader title="Delivery & Courier" description="Zones group Nepal's districts so each address gets the right services and fees." />
      <DeliveryTabs active="zones" />
      {zones.length === 0 ? (
        <Panel title="Zones">
          <EmptyState icon={MapPinIcon} title="No delivery zones yet" description="Without zones, checkout can't offer any delivery service." />
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {zones.map((zone) => (
            <Panel
              key={zone.id}
              title={zone.name}
              description={`${formatCount(zone.districts.length)} districts · ${formatCount(zone.rateCount)} rates`}
              action={
                <div className="flex items-center gap-3">
                  <ActivePill active={zone.isActive} />
                  <ToggleForm action={setZoneActiveAction} id={zone.id} checked={zone.isActive} label={`${zone.name} active`} />
                </div>
              }
              bodyClassName="gap-3 px-6 pb-6"
            >
              {zone.description ? <p className="text-body text-neutral-700">{zone.description}</p> : null}
              <ul aria-label={`Districts in ${zone.name}`} className="flex flex-wrap gap-2">
                {zone.districts.map((district) => (
                  <li key={district} className="rounded-full bg-neutral-100 px-3 py-1 text-small text-neutral-700">
                    {district}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
