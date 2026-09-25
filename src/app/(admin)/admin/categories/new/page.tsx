import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { CategoryForm } from "@/components/admin/category-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { emptyCategoryValues, fetchCategoryOptions } from "@/features/admin/queries/catalog";
import { param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Add category" };

export default async function NewCategoryPage({ searchParams }: PageProps<"/admin/categories/new">) {
  await requireAdminAccess("catalog.write");
  const categories = await fetchCategoryOptions();
  const parents = categories.filter((category) => category.parentId === null);
  // "Add subcategory" links here with ?parent=<top-level id>.
  const requested = param(await searchParams, "parent");
  const parent = parents.find((category) => category.id === requested) ?? null;

  return (
    <>
      <BackLink href="/admin/categories">Categories</BackLink>
      <PageHeader
        title={parent ? `Add subcategory to ${parent.title}` : "Add category"}
        description="New categories are visible on the storefront once they have active products, unless you hide them."
      />
      <CategoryForm
        categoryId={null}
        values={emptyCategoryValues(parent?.id ?? null)}
        imageUrl={null}
        parents={parents}
        hasChildren={false}
        saved={null}
        stagingId={randomUUID()}
      />
    </>
  );
}
