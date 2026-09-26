import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { CouponForm } from "@/components/admin/coupon-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { emptyCouponValues } from "@/features/admin/queries/coupon-editor";

export const metadata: Metadata = { title: "Add coupon" };

export default async function NewCouponPage() {
  await requireAdminAccess("promotions.manage");
  return (
    <>
      <BackLink href="/admin/coupons">Coupons</BackLink>
      <PageHeader title="Add coupon" description="Checkout checks the code, dates, minimum order and limits again when an order is placed." />
      <CouponForm couponId={null} values={emptyCouponValues()} orderCount={0} timesUsed={0} updatedLabel={null} />
    </>
  );
}
