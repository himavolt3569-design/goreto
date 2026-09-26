import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, SuccessNotice, editorGridClasses } from "@/components/admin/admin-ui";
import { CouponForm } from "@/components/admin/coupon-form";
import { CouponDangerZone } from "@/components/admin/delivery-danger-zones";
import { CouponStatePill } from "@/components/admin/status-pills";

import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchCouponEditor } from "@/features/admin/queries/coupon-editor";
import { isUuid, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit coupon" };

export default async function EditCouponPage({ params, searchParams }: PageProps<"/admin/coupons/[id]/edit">) {
  await requireAdminAccess("promotions.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const coupon = await fetchCouponEditor(id);
  if (!coupon) notFound();
  const created = param(await searchParams, "created") === "1";

  return (
    <>
      <BackLink href="/admin/coupons">Coupons</BackLink>
      <PageHeader title={`Edit ${coupon.values.code}`} eyebrow={<CouponStatePill state={coupon.state} />} description="Changes apply to new orders. Past orders keep their discount." />
      {created ? <SuccessNotice>Coupon created.</SuccessNotice> : null}
      <CouponForm couponId={coupon.id} values={coupon.values} orderCount={coupon.orderCount} timesUsed={coupon.timesUsed} updatedLabel={formatDateTime(coupon.updatedAt)} />
      <div className={editorGridClasses}>
        <div className="hidden xl:block" />
        <CouponDangerZone couponId={coupon.id} code={coupon.values.code} orderCount={coupon.orderCount} />
      </div>
    </>
  );
}
