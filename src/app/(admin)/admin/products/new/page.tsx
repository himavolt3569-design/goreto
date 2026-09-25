import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form/product-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { canAccess } from "@/features/admin/nav";
import { emptyProductValues } from "@/features/admin/product-form/schema";
import { fetchCategoryOptions } from "@/features/admin/queries/catalog";
import { fetchCollectionOptions, fetchDefaultLowStockThreshold } from "@/features/admin/queries/product-editor";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const profile = await requireAdminAccess("catalog.write");
  const canLinkCollections = canAccess(profile, "content.manage");
  const [categories, lowStockThreshold, collections] = await Promise.all([
    fetchCategoryOptions(),
    fetchDefaultLowStockThreshold(),
    canLinkCollections ? fetchCollectionOptions() : Promise.resolve(null),
  ]);

  return (
    <>
      <BackLink href="/admin/products">Products</BackLink>
      <PageHeader title="Add product" description="Fill in the details and add photos, then create the product as a draft or publish it straight away." />
      <ProductForm
        productId={null}
        defaultValues={emptyProductValues(lowStockThreshold, canLinkCollections)}
        categories={categories}
        collections={collections}
        linkedCollections={[]}
        variantInfo={{}}
        saved={null}
        stagingId={randomUUID()}
      />
    </>
  );
}
