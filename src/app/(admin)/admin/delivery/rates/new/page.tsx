import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { RateForm } from "@/components/admin/rate-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { emptyRateValues, fetchRateOptions } from "@/features/admin/queries/delivery-editor";
import { param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Add delivery rate" };

export default async function NewRatePage({ searchParams }: PageProps<"/admin/delivery/rates/new">) {
  await requireAdminAccess("delivery.manage");
  const [options, query] = await Promise.all([fetchRateOptions(), searchParams]);
  // "Add rate" on a zone links here with ?zone=<id>.
  const zone = param(query, "zone");
  const service = param(query, "service");
  const zoneId = options.zones.find((option) => option.id === zone)?.id ?? "";
  const serviceId = options.services.find((option) => option.id === service)?.id ?? "";

  return (
    <>
      <BackLink href="/admin/delivery/rates">Rates</BackLink>
      <PageHeader title="Add delivery rate" description="Checkout will recalculate the fee on the server and lock it into the order." />
      <RateForm rateId={null} values={emptyRateValues(zoneId, serviceId)} options={options} updatedLabel={null} />
    </>
  );
}
