import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { AddLink, EditLink, EmptyState, PageHeader, Panel, SuccessNotice } from "@/components/admin/admin-ui";
import { DeliveryTabs } from "@/components/admin/delivery-tabs";
import { ActivePill } from "@/components/admin/status-pills";
import { MapPinIcon, WarningCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { setZoneActiveAction } from "@/features/admin/actions/system";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount } from "@/features/admin/format";
import { fetchDistrictGroups } from "@/features/admin/queries/delivery-editor";
import { fetchZones } from "@/features/admin/queries/system";
import { param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Delivery zones" };

/** Zones match a confirmed address by district; each district belongs to one zone. */
export default async function DeliveryZonesPage({ searchParams }: PageProps<"/admin/delivery/zones">) {
  await requireAdminAccess("delivery.manage");
  const deleted = param(await searchParams, "deleted") === "1";
  const [zones, groups] = await Promise.all([fetchZones(), fetchDistrictGroups()]);
  const unzoned = groups.flatMap((province) => province.districts.filter((district) => district.zone === null).map((district) => district.name));

  return (
    <>
      <PageHeader
        title="Delivery & Courier"
        description="Zones group Nepal's districts so each address gets the right services and fees."
        actions={<AddLink href="/admin/delivery/zones/new">Add zone</AddLink>}
      />
      <DeliveryTabs active="zones" />
      {deleted ? <SuccessNotice>Zone deleted.</SuccessNotice> : null}
      {unzoned.length > 0 ? (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-warning-700">
          <p className="flex items-center gap-2 font-medium">
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            {unzoned.length === 1 ? "1 district isn't in any zone" : `${formatCount(unzoned.length)} districts aren't in any zone`}
          </p>
          <p>Checkout can&apos;t deliver to addresses there: {unzoned.join(", ")}.</p>
        </div>
      ) : null}
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
                  <EditLink href={`/admin/delivery/zones/${zone.id}/edit`} label={zone.name} />
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
