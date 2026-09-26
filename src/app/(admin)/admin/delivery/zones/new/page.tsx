import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { ZoneForm } from "@/components/admin/zone-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { fetchDistrictGroups } from "@/features/admin/queries/delivery-editor";

export const metadata: Metadata = { title: "Add delivery zone" };

export default async function NewZonePage() {
  await requireAdminAccess("delivery.manage");
  const groups = await fetchDistrictGroups();
  return (
    <>
      <BackLink href="/admin/delivery/zones">Delivery zones</BackLink>
      <PageHeader title="Add delivery zone" description="After you create the zone, add a rate for each service it offers." />
      <ZoneForm
        zoneId={null}
        values={{ title: "", slug: "", description: "", sortOrder: 0, isActive: true, districtCodes: [] }}
        groups={groups}
        savedSlug={null}
        updatedLabel={null}
      />
    </>
  );
}
