import type { Metadata } from "next";
import Link from "next/link";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { BulkProductsForm } from "@/components/admin/bulk-products/bulk-products-form";
import { buttonClasses } from "@/components/ui/button";
import { requireAdminAccess } from "@/features/admin/auth";
import { fetchCategoryOptions } from "@/features/admin/queries/catalog";
import { categoryOptions } from "@/features/catalog/category-options";

export const metadata: Metadata = { title: "Add products" };

export default async function BulkAddProductsPage() {
  await requireAdminAccess("catalog.write");
  const categories = await fetchCategoryOptions();

  return (
    <>
      <BackLink href="/admin/products">Products</BackLink>
      <PageHeader
        title="Add products"
        description="Add one or many products at once. Each needs a name, category and price; photos and videos are optional. Sizes, colours and details can be added later in the full editor."
        actions={
          <Link href="/admin/products/new" className={buttonClasses({ variant: "tertiary", size: "md" })}>
            Use the full form
          </Link>
        }
      />
      <BulkProductsForm categories={categoryOptions(categories)} />
    </>
  );
}
