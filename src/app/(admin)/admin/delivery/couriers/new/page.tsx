import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { CourierForm } from "@/components/admin/courier-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { EMPTY_COURIER_VALUES } from "@/features/admin/queries/delivery-editor";

export const metadata: Metadata = { title: "Add courier" };

export default async function NewCourierPage() {
  await requireAdminAccess("delivery.manage");
  return (
    <>
      <BackLink href="/admin/delivery">Delivery & Courier</BackLink>
      <PageHeader title="Add courier" description="After you create the courier, add its services and give them rates for each zone." />
      <CourierForm courierId={null} values={EMPTY_COURIER_VALUES} savedSlug={null} updatedLabel={null} />
    </>
  );
}
