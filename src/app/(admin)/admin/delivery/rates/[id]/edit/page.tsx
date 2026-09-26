import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, SuccessNotice, editorGridClasses } from "@/components/admin/admin-ui";
import { RateDangerZone } from "@/components/admin/delivery-danger-zones";
import { RateForm } from "@/components/admin/rate-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchRateEditor, fetchRateOptions } from "@/features/admin/queries/delivery-editor";
import { isUuid, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit delivery rate" };

export default async function EditRatePage({ params, searchParams }: PageProps<"/admin/delivery/rates/[id]/edit">) {
  await requireAdminAccess("delivery.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rate, options] = await Promise.all([fetchRateEditor(id), fetchRateOptions()]);
  if (!rate) notFound();
  const created = param(await searchParams, "created") === "1";
  const label = `${rate.serviceLabel} in ${rate.zoneName}`;

  return (
    <>
      <BackLink href="/admin/delivery/rates">Rates</BackLink>
      <PageHeader title="Edit delivery rate" description={label} />
      {created ? <SuccessNotice>Rate created.</SuccessNotice> : null}
      <RateForm rateId={rate.id} values={rate.values} options={options} updatedLabel={formatDateTime(rate.updatedAt)} />
      <div className={editorGridClasses}>
        <div className="hidden xl:block" />
        <RateDangerZone rateId={rate.id} label={label} />
      </div>
    </>
  );
}
