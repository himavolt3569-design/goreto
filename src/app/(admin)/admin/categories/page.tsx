import type { Metadata } from "next";
import Link from "next/link";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, Thumb, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { ActivePill } from "@/components/admin/status-pills";
import { CheckCircleIcon, CopyIcon, PencilSimpleIcon, PlusIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { setCategoryActiveAction } from "@/features/admin/actions/catalog";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { fetchAdminCategories, type AdminCategory } from "@/features/admin/queries/catalog";
import { param } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  const profile = await requireAdminAccess("catalog.read");
  const deleted = param(await searchParams, "deleted") === "1";
  const categories = await fetchAdminCategories();
  const canWrite = canAccess(profile, "catalog.write");

  // Top-level categories, each followed by its subcategories.
  const children = new Map<string, AdminCategory[]>();
  for (const category of categories) {
    if (category.parentId) children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
  }
  const ordered = categories
    .filter((category) => !category.parentId)
    .flatMap((parent) => [{ category: parent, depth: 0 }, ...(children.get(parent.id) ?? []).map((child) => ({ category: child, depth: 1 }))]);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Top-level categories are the storefront's browsing units. Inactive categories and their products are hidden from category pages."
        actions={
          canWrite ? (
            <Link href="/admin/categories/new" className={buttonClasses({ variant: "primary", size: "md" })}>
              <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              Add category
            </Link>
          ) : undefined
        }
      />
      {deleted ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Category deleted.
        </p>
      ) : null}
      <Panel title={`${formatCount(categories.length)} categories`}>
        {ordered.length === 0 ? (
          <EmptyState
            icon={CopyIcon}
            title="No categories yet"
            description={canWrite ? "Add a category so products can be filed and browsed." : undefined}
          />
        ) : (
          <TableScroll label="Categories">
            <table className={tableClasses}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Category</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Products</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Live</th>
                  <th scope="col" className={thClasses}>Status</th>
                  {canWrite ? <th scope="col" className={thClasses}>Active</th> : null}
                  {canWrite ? <th scope="col" className={thClasses}><span className="sr-only">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {ordered.map(({ category, depth }) => (
                  <tr key={category.id}>
                    <td className={tdClasses}>
                      <div className={cn("flex items-center gap-3", depth === 1 && "pl-8")}>
                        {depth === 0 ? <Thumb src={category.image} /> : null}
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/products?category=${category.id}`}
                            className={cn("rounded-xs hover:text-primary-600", depth === 0 ? "font-semibold" : "font-medium")}
                          >
                            {category.title}
                          </Link>
                          <span className="text-small text-neutral-500">/{category.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className={cn(tdClasses, numericClasses)}>{formatCount(category.productCount)}</td>
                    <td className={cn(tdClasses, numericClasses)}>{formatCount(category.activeProductCount)}</td>
                    <td className={tdClasses}>
                      <ActivePill active={category.isActive} activeLabel="Visible" inactiveLabel="Hidden" />
                    </td>
                    {canWrite ? (
                      <td className={tdClasses}>
                        <ToggleForm action={setCategoryActiveAction} id={category.id} checked={category.isActive} label={`Show ${category.title} on the storefront`} />
                      </td>
                    ) : null}
                    {canWrite ? (
                      <td className={tdClasses}>
                        <div className="flex justify-end gap-1">
                          {depth === 0 ? (
                            <Link href={`/admin/categories/new?parent=${category.id}`} className={buttonClasses({ variant: "text", size: "md" })}>
                              <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                              Subcategory<span className="sr-only"> in {category.title}</span>
                            </Link>
                          ) : null}
                          <Link href={`/admin/categories/${category.id}/edit`} className={buttonClasses({ variant: "tertiary", size: "md" })}>
                            <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                            Edit<span className="sr-only"> {category.title}</span>
                          </Link>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </>
  );
}
