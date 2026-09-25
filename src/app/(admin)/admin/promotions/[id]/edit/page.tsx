import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { CollectionDangerZone } from "@/components/admin/catalog-danger-zones";
import { CollectionForm } from "@/components/admin/collection-form";
import { CheckCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchCollectionEditor } from "@/features/admin/queries/collection-editor";
import { param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit collection" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCollectionPage({ params, searchParams }: PageProps<"/admin/promotions/[id]/edit">) {
  await requireAdminAccess("content.manage");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const collection = await fetchCollectionEditor(id);
  if (!collection) notFound();
  const created = param(await searchParams, "created") === "1";

  return (
    <>
      <BackLink href="/admin/promotions">Promotions</BackLink>
      <PageHeader title={`Edit ${collection.values.title}`} description="Changes show on the homepage when you save, while the collection is live." />
      {created ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Collection created.
        </p>
      ) : null}

      <CollectionForm
        collectionId={collection.id}
        values={collection.values}
        heroImageUrl={collection.heroImageUrl}
        products={collection.products}
        saved={{ slug: collection.values.slug, state: collection.state, updatedLabel: formatDateTime(collection.updatedAt) }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="hidden xl:block" />
        <CollectionDangerZone collectionId={collection.id} title={collection.values.title} productCount={collection.products.length} />
      </div>
    </>
  );
}
