import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, SuccessNotice, editorGridClasses } from "@/components/admin/admin-ui";
import { ArAssetDangerZone } from "@/components/admin/ar-danger-zone";
import { ArAssetForm } from "@/components/admin/ar-asset-form";
import { ActivePill } from "@/components/admin/status-pills";
import { AR_MODE_LABELS } from "@/features/admin/ar-forms";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchArAssetEditor } from "@/features/admin/queries/ar-editor";
import { isUuid, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit AR asset" };

export default async function EditArAssetPage({ params, searchParams }: PageProps<"/admin/ar/[id]/edit">) {
  await requireAdminAccess("ar.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const asset = await fetchArAssetEditor(id);
  if (!asset) notFound();
  const created = param(await searchParams, "created") === "1";
  const name = `${AR_MODE_LABELS[asset.values.mode]}${asset.product ? ` for ${asset.product.title}` : ""}`;

  return (
    <>
      <BackLink href="/admin/ar">AR Try-On</BackLink>
      <PageHeader title={`Edit ${name}`} eyebrow={<ActivePill active={asset.values.isActive} />} description="Changes reach the store straight away." />
      {created ? <SuccessNotice>AR asset added.</SuccessNotice> : null}
      <ArAssetForm
        assetId={asset.id}
        initialProduct={asset.product}
        values={asset.values}
        format={asset.format}
        fileUrl={asset.fileUrl}
        updatedLabel={formatDateTime(asset.updatedAt)}
      />
      <div className={editorGridClasses}>
        <ArAssetDangerZone assetId={asset.id} name={name} />
      </div>
    </>
  );
}
