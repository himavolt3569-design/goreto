import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { CollectionForm } from "@/components/admin/collection-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { emptyCollectionValues } from "@/features/admin/queries/collection-editor";

export const metadata: Metadata = { title: "Add collection" };

export default async function NewCollectionPage() {
  await requireAdminAccess("content.manage");

  return (
    <>
      <BackLink href="/admin/promotions">Promotions</BackLink>
      <PageHeader title="Add collection" description="A seasonal edit or campaign. It shows in the homepage carousel while it's on and inside its schedule." />
      <CollectionForm collectionId={null} values={emptyCollectionValues()} heroImageUrl={null} products={[]} saved={null} stagingId={randomUUID()} />
    </>
  );
}
