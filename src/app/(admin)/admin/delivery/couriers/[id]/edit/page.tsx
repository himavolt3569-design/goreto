import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, SuccessNotice, editorGridClasses } from "@/components/admin/admin-ui";
import { CourierForm } from "@/components/admin/courier-form";
import { CourierServices } from "@/components/admin/courier-services";
import { CourierDangerZone } from "@/components/admin/delivery-danger-zones";
import { ActivePill } from "@/components/admin/status-pills";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchCourierEditor } from "@/features/admin/queries/delivery-editor";
import { isUuid, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit courier" };

export default async function EditCourierPage({ params, searchParams }: PageProps<"/admin/delivery/couriers/[id]/edit">) {
  await requireAdminAccess("delivery.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const courier = await fetchCourierEditor(id);
  if (!courier) notFound();
  const created = param(await searchParams, "created") === "1";

  return (
    <>
      <BackLink href="/admin/delivery">Delivery & Courier</BackLink>
      <PageHeader
        title={`Edit ${courier.values.title}`}
        eyebrow={<ActivePill active={courier.values.isActive} />}
        description="Changes apply to new orders. Past orders keep the service they chose."
      />
      {created ? <SuccessNotice>Courier created. Add its services below.</SuccessNotice> : null}
      <CourierForm courierId={courier.id} values={courier.values} savedSlug={courier.values.slug} updatedLabel={formatDateTime(courier.updatedAt)} />
      <div className={editorGridClasses}>
        <CourierServices courierId={courier.id} courierName={courier.values.title} services={courier.services} />
        <CourierDangerZone courierId={courier.id} name={courier.values.title} serviceCount={courier.services.length} shipmentCount={courier.shipmentCount} />
      </div>
    </>
  );
}
