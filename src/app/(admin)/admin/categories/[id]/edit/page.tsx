import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { CategoryDangerZone } from "@/components/admin/catalog-danger-zones";
import { CategoryForm } from "@/components/admin/category-form";
import { CheckCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime } from "@/features/admin/format";
import { fetchCategoryEditor, fetchCategoryOptions } from "@/features/admin/queries/catalog";
import { param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit category" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCategoryPage({ params, searchParams }: PageProps<"/admin/categories/[id]/edit">) {
  await requireAdminAccess("catalog.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [category, categories] = await Promise.all([fetchCategoryEditor(id), fetchCategoryOptions()]);
  if (!category) notFound();
  const created = param(await searchParams, "created") === "1";
  const parents = categories.filter((option) => option.parentId === null && option.id !== category.id);

  return (
    <>
      <BackLink href="/admin/categories">Categories</BackLink>
      <PageHeader title={`Edit ${category.values.title}`} description="Changes show on the storefront when you save." />
      {created ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Category created.
        </p>
      ) : null}

      <CategoryForm
        categoryId={category.id}
        values={category.values}
        imageUrl={category.imageUrl}
        parents={parents}
        hasChildren={category.children.length > 0}
        saved={{ slug: category.values.slug, isActive: category.values.isActive, updatedLabel: formatDateTime(category.updatedAt) }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="hidden xl:block" />
        <CategoryDangerZone
          categoryId={category.id}
          title={category.values.title}
          productCount={category.productCount}
          subcategories={category.children}
          isActive={category.values.isActive}
        />
      </div>
    </>
  );
}
