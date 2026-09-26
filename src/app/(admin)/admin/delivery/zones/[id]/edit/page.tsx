import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddLink, BackLink, PageHeader, SuccessNotice, editorGridClasses } from "@/components/admin/admin-ui";
import { ZoneDangerZone } from "@/components/admin/delivery-danger-zones";
import { ActivePill } from "@/components/admin/status-pills";
import { ZoneForm } from "@/components/admin/zone-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchDistrictGroups, fetchZoneEditor } from "@/features/admin/queries/delivery-editor";
import { isUuid, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit delivery zone" };

export default async function EditZonePage({ params, searchParams }: PageProps<"/admin/delivery/zones/[id]/edit">) {
  await requireAdminAccess("delivery.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [zone, groups] = await Promise.all([fetchZoneEditor(id), fetchDistrictGroups()]);
  if (!zone) notFound();
  const created = param(await searchParams, "created") === "1";

  return (
    <>
      <BackLink href="/admin/delivery/zones">Delivery zones</BackLink>
      <PageHeader
        title={`Edit ${zone.values.title}`}
        eyebrow={<ActivePill active={zone.values.isActive} />}
        description={`${zone.rateCount === 1 ? "1 rate" : `${zone.rateCount} rates`} in this zone.`}
        actions={<AddLink href={`/admin/delivery/rates/new?zone=${zone.id}`}>Add rate</AddLink>}
      />
      {created ? <SuccessNotice>Zone created. Add a rate for each service it offers.</SuccessNotice> : null}
      <ZoneForm zoneId={zone.id} values={zone.values} groups={groups} savedSlug={zone.values.slug} updatedLabel={formatDateTime(zone.updatedAt)} />
      <div className={editorGridClasses}>
        <div className="hidden xl:block" />
        <ZoneDangerZone zoneId={zone.id} name={zone.values.title} rateCount={zone.rateCount} districtCount={zone.values.districtCodes.length} />
      </div>
    </>
  );
}
