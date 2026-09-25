import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, PageHeader, Panel } from "@/components/admin/admin-ui";
import { ActivePill } from "@/components/admin/status-pills";
import { ProductDangerZone } from "@/components/admin/product-form/delete-product";
import { MediaManager } from "@/components/admin/product-form/media-manager";
import { ProductForm } from "@/components/admin/product-form/product-form";
import { CheckCircleIcon, WarningCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDateTime, humanize } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { fetchCategoryOptions } from "@/features/admin/queries/catalog";
import { fetchCollectionOptions, fetchProductEditor } from "@/features/admin/queries/product-editor";
import { param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Edit product" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]/edit">) {
  const profile = await requireAdminAccess("catalog.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const canLinkCollections = canAccess(profile, "content.manage");
  const [product, categories, collections] = await Promise.all([
    fetchProductEditor(id),
    fetchCategoryOptions(),
    canLinkCollections ? fetchCollectionOptions() : Promise.resolve(null),
  ]);
  if (!product) notFound();
  const query = await searchParams;
  const created = param(query, "created") === "1";
  const addedPhotos = Number(param(query, "photos") ?? 0) || 0;
  const rejectedPhotos = Number(param(query, "rejected") ?? 0) || 0;

  const values = canLinkCollections ? product.values : { ...product.values, collectionIds: null };
  const optionLabels = new Map(product.values.options.map((option) => [option.name, new Map(option.values.map((value) => [value.value, value.label]))]));
  const variants = product.values.variants.flatMap((variant) => {
    if (!variant.id) return [];
    const label = Object.entries(variant.optionValues)
      .map(([name, value]) => optionLabels.get(name)?.get(value) ?? value)
      .join(" / ");
    return [{ id: variant.id, label: `${label || "Default"} (${variant.sku})` }];
  });

  return (
    <>
      <BackLink href={`/admin/products/${product.id}`}>Product overview</BackLink>
      <PageHeader title={`Edit ${product.values.title}`} description="Changes go live on the storefront when you save, if the product is active." />

      {created ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          {addedPhotos > 0 ? `Product created with ${addedPhotos} ${addedPhotos === 1 ? "photo" : "photos"}.` : "Product created."}
          <Link href="#media" className="font-medium underline underline-offset-4">
            {addedPhotos > 0 ? "Review photos" : "Add photos"}
          </Link>
        </p>
      ) : null}
      {created && rejectedPhotos > 0 ? (
        <p role="alert" className="flex items-center gap-2 rounded-md bg-error-100 px-4 py-3 text-body text-error-700">
          <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          {`${rejectedPhotos} ${rejectedPhotos === 1 ? "photo wasn't" : "photos weren't"} added because the file wasn't a valid image. Upload ${rejectedPhotos === 1 ? "it" : "them"} again below.`}
        </p>
      ) : null}

      <ProductForm
        productId={product.id}
        defaultValues={values}
        categories={categories}
        collections={collections}
        linkedCollections={product.linkedCollections}
        variantInfo={product.variantInfo}
        saved={{ slug: product.slug, status: product.status, version: product.updatedAt, updatedLabel: formatDateTime(product.updatedAt) }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <MediaManager productId={product.id} media={product.media} variants={variants} />
          <Panel
            title="AR Try-On"
            description="Try-on assets are managed on the AR page."
            action={
              <Link href="/admin/ar" className="text-body font-medium text-primary-600 hover:underline">
                Open AR Try-On
              </Link>
            }
            bodyClassName="px-6 pb-6"
          >
            {product.arAssets.length === 0 ? (
              <p className="text-body text-neutral-500">No AR assets. This product isn&apos;t offered for try-on.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {product.arAssets.map((asset) => (
                  <li key={asset.id} className="flex items-center justify-between gap-2 text-body">
                    <span>
                      {humanize(asset.mode)} · {humanize(asset.placement)} · {asset.format.toUpperCase()}
                    </span>
                    <ActivePill active={asset.isActive} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <ProductDangerZone productId={product.id} title={product.values.title} hasOrders={product.hasOrders} archived={product.status === "archived"} />
      </div>
    </>
  );
}
