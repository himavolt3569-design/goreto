import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterBar, FilterField, PageHeader, Pagination, Panel, TableScroll, Thumb, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { ProductActionsMenu } from "@/components/admin/product-actions-menu";
import { ProductStatusPill, productDisplayStatus } from "@/components/admin/status-pills";
import { CheckCircleIcon, CubeIcon, PlusIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { categoryOptions } from "@/features/catalog/category-options";
import { fetchAdminProducts, fetchCategoryOptions, type ProductStatus } from "@/features/admin/queries/catalog";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { sanitizeSearch } from "@/features/admin/search-input";
import { param } from "@/features/admin/url";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Products" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: readonly ProductStatus[] =["active", "draft", "archived"];
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const profile = await requireAdminAccess("catalog.read");
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const status = pickEnum(params.status, STATUSES);
  const categoryParam = param(params, "category");
  // Only a UUID can be a category id; anything else is ignored rather than sent to Postgres.
  const requestedCategoryId = categoryParam && UUID.test(categoryParam) ? categoryParam : null;
  const page = pageNumber(params.page);

  // One round trip: both reads start together.
  const [categories, filtered] = await Promise.all([
    fetchCategoryOptions(),
    fetchAdminProducts({ q, status, categoryId: requestedCategoryId, page }),
  ]);
  const categoryId = categories.some((category) => category.id === requestedCategoryId) ? requestedCategoryId : null;
  // An unknown category id (hand-edited URL) shows every category, matching the "All categories" filter.
  const products = requestedCategoryId && !categoryId ? await fetchAdminProducts({ q, status, categoryId: null, page }) : filtered;
  const canWrite = canAccess(profile, "catalog.write");

  return (
    <>
      <PageHeader
        title="Products"
        description="Every product in the catalog, including drafts and archived items. Newest changes first."
        actions={
          canWrite ? (
            <Link href="/admin/products/new" className={buttonClasses({ variant: "primary", size: "md" })}>
              <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              Add product
            </Link>
          ) : undefined
        }
      />
      {param(params, "deleted") === "1" ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Product deleted.
        </p>
      ) : null}

      <Panel title={`${formatCount(products.total)} products`}>
        <FilterBar resetHref="/admin/products" hasFilters={Boolean(q || status || categoryId)}>
          <FilterField label="Search by name" htmlFor="product-q" className="md:w-72">
            <Input id="product-q" type="search" name="q" defaultValue={q} placeholder="e.g. Pearl drop earrings" maxLength={64} />
          </FilterField>
          <FilterField label="Status" htmlFor="product-status">
            <Select id="product-status" name="status" defaultValue={status ?? ""} options={STATUS_OPTIONS} />
          </FilterField>
          <FilterField label="Category" htmlFor="product-category">
            <Select
              id="product-category"
              name="category"
              defaultValue={categoryId ?? ""}
              options={[{ value: "", label: "All categories" }, ...categoryOptions(categories)]}
            />
          </FilterField>
        </FilterBar>

        {products.rows.length === 0 ? (
          <EmptyState
            icon={CubeIcon}
            title="No products match"
            description="Try a different name, status or category."
            action={
              canWrite ? (
                <Link href="/admin/products/new" className={buttonClasses({ variant: "secondary", size: "md" })}>
                  Add product
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableScroll label="Products">
              <table className={cn(tableClasses, "min-w-[800px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Product</th>
                    <th scope="col" className={thClasses}>Category</th>
                    <th scope="col" className={thClasses}>Stock</th>
                    <th scope="col" className={thClasses}>Price</th>
                    <th scope="col" className={thClasses}>Status</th>
                    <th scope="col" className={thClasses}>Updated</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.rows.map((product) => (
                    <tr key={product.id} className="hover:bg-neutral-50">
                      <td className={tdClasses}>
                        <Link href={`/admin/products/${product.id}`} className="group flex items-center gap-3 rounded-sm">
                          <Thumb src={product.thumbnail} />
                          <span className="font-medium group-hover:text-primary-600">{product.title}</span>
                        </Link>
                      </td>
                      <td className={cn(tdClasses, "text-neutral-700")}>{product.categoryTitle ?? "—"}</td>
                      <td className={cn(tdClasses, "font-medium tabular-nums", product.stockState === "in_stock" ? "text-success-700" : "text-error-700")}>
                        {formatCount(product.totalStock)}
                      </td>
                      <td className={cn(tdClasses, "whitespace-nowrap tabular-nums")}>{formatNpr(product.pricePaisa)}</td>
                      <td className={tdClasses}>
                        <ProductStatusPill status={productDisplayStatus(product.status, product.stockState)} />
                      </td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-500")}>{formatDate(product.updatedAt)}</td>
                      <td className={cn(tdClasses, "text-right")}>
                        <ProductActionsMenu product={product} canWrite={canWrite} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pagination pathname="/admin/products" params={params} page={products.page} pageCount={products.pageCount} total={products.total} noun="products" />
          </>
        )}
      </Panel>
    </>
  );
}
