import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton, ToggleForm } from "@/components/admin/action-forms";
import { BackLink, PageHeader, Panel, TableScroll, Thumb, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { ActivePill, ProductStatusPill, StockPill, productDisplayStatus } from "@/components/admin/status-pills";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";
import { ArrowSquareOutIcon } from "@/components/ui/icons";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setProductFlagAction, setProductStatusAction } from "@/features/admin/actions/catalog";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDateTime, humanize } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { fetchProductDetail, stockStateFor, type ProductStatus } from "@/features/admin/queries/catalog";
import { mediaUrl } from "@/features/admin/queries/shared";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Product" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_BUTTONS: { status: ProductStatus; label: string; variant: "primary" | "tertiary" }[] = [
  { status: "active", label: "Set active", variant: "primary" },
  { status: "draft", label: "Move to drafts", variant: "tertiary" },
  { status: "archived", label: "Archive", variant: "tertiary" },
];

/**
 * Product overview for staff. Editing details, variants and media comes with
 * the product form task; this page covers status, stock and what's live.
 */
export default async function ProductDetailPage({ params }: PageProps<"/admin/products/[id]">) {
  const profile = await requireAdminAccess("catalog.read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const product = await fetchProductDetail(id);
  if (!product) notFound();

  const canWrite = canAccess(profile, "catalog.write");
  const canAdjust = canAccess(profile, "inventory.write") || canWrite;
  const activeStocks = product.product_variants.filter((variant) => variant.is_active).map((variant) => variant.stock_quantity);
  const stockState = stockStateFor(activeStocks, product.low_stock_threshold);
  const arModes = [...new Set(product.product_ar_assets.filter((asset) => asset.is_active).map((asset) => asset.mode))];

  return (
    <>
      <BackLink href="/admin/products">Products</BackLink>
      <PageHeader
        title={product.title}
        description={product.short_description || undefined}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <ProductStatusPill status={productDisplayStatus(product.status, stockState)} />
            {product.is_featured ? <Badge size="sm" tone="new">Featured</Badge> : null}
            {product.is_bestseller ? <Badge size="sm" tone="bestseller">Bestseller</Badge> : null}
            {product.is_limited_edition ? <Badge size="sm" tone="limited">Limited</Badge> : null}
            {arModes.length > 0 ? <Badge size="sm" tone="ar-ready">AR Ready</Badge> : null}
          </div>
        }
        actions={
          product.status === "active" ? (
            <Link href={`/products/${product.slug}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
              View on store
              <ArrowSquareOutIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Variants" description={`Low-stock alert at ${product.low_stock_threshold} or fewer. Adjustments are relative, so they never overwrite a sale made at the same time.`}>
            <TableScroll label="Variants">
              <table className={cn(tableClasses, "min-w-[720px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>SKU</th>
                    <th scope="col" className={thClasses}>Options</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Price</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Stock</th>
                    <th scope="col" className={thClasses}>State</th>
                    {canAdjust ? <th scope="col" className={thClasses}>Adjust</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {product.product_variants.map((variant) => (
                    <tr key={variant.id}>
                      <td className={cn(tdClasses, "font-medium")}>{variant.sku}</td>
                      <td className={cn(tdClasses, "text-neutral-700")}>
                        {Object.entries((variant.option_values ?? {}) as Record<string, string>)
                          .map(([name, value]) => `${name}: ${value}`)
                          .join(" · ") || variant.title || "—"}
                      </td>
                      <td className={cn(tdClasses, numericClasses)}>{formatNpr(variant.price_paisa ?? product.base_price_paisa)}</td>
                      <td className={cn(tdClasses, numericClasses, "font-medium")}>{formatCount(variant.stock_quantity)}</td>
                      <td className={tdClasses}>
                        {variant.is_active ? <StockPill state={stockStateFor([variant.stock_quantity], product.low_stock_threshold)} /> : <ActivePill active={false} />}
                      </td>
                      {canAdjust ? (
                        <td className={tdClasses}>
                          <StockAdjustForm variantId={variant.id} sku={variant.sku} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          <Panel title="Media" description={`${product.product_media.length} images in gallery order.`} bodyClassName="px-6 pb-6">
            {product.product_media.length === 0 ? (
              <p className="text-body text-neutral-500">No media yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {product.product_media.map((media) => (
                  <li key={media.id} className="flex flex-col gap-2">
                    <Thumb src={mediaUrl(media.storage_path)} sizes="(min-width: 640px) 200px, 45vw" className="aspect-square size-auto w-full" />
                    <p className={cn("text-small", media.alt_text ? "text-neutral-700" : "text-warning-700")}>{media.alt_text || "Missing alt text"}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {product.description ? (
            <Panel title="Description" bodyClassName="px-6 pb-6">
              <p className="whitespace-pre-line text-body text-neutral-700">{product.description}</p>
            </Panel>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {canWrite ? (
            <Panel title="Status" description="Only active products appear on the storefront." bodyClassName="px-6 pb-6">
              <div className="flex flex-col gap-2">
                {STATUS_BUTTONS.filter((button) => button.status !== product.status).map((button) => (
                  <ActionForm key={button.status} action={setProductStatusAction} hidden={{ productId: product.id, status: button.status }} className="flex flex-col gap-2">
                    <SubmitButton variant={button.variant} className="w-full">
                      {button.label}
                    </SubmitButton>
                  </ActionForm>
                ))}
              </div>
            </Panel>
          ) : null}

          {canWrite ? (
            <Panel title="Homepage merchandising" bodyClassName="gap-4 px-6 pb-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-body text-neutral-900">Featured on the homepage</span>
                <ToggleForm action={setProductFlagAction} id={product.id} checked={product.is_featured} label="Featured on the homepage" extra={{ flag: "is_featured" }} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-body text-neutral-900">Bestseller badge</span>
                <ToggleForm action={setProductFlagAction} id={product.id} checked={product.is_bestseller} label="Bestseller badge" extra={{ flag: "is_bestseller" }} />
              </div>
            </Panel>
          ) : null}

          <Panel title="Details" bodyClassName="px-6 pb-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-body">
              <dt className="text-neutral-500">Category</dt>
              <dd className="text-neutral-900">{product.categories?.title ?? "—"}</dd>
              <dt className="text-neutral-500">Base price</dt>
              <dd className="text-neutral-900">{formatNpr(product.base_price_paisa)}</dd>
              <dt className="text-neutral-500">Compare at</dt>
              <dd className="text-neutral-900">{product.compare_at_price_paisa ? formatNpr(product.compare_at_price_paisa) : "—"}</dd>
              <dt className="text-neutral-500">Slug</dt>
              <dd className="break-all text-neutral-900">{product.slug}</dd>
              <dt className="text-neutral-500">Published</dt>
              <dd className="text-neutral-900">{formatDateTime(product.published_at)}</dd>
              {product.archived_at ? (
                <>
                  <dt className="text-neutral-500">Archived</dt>
                  <dd className="text-neutral-900">{formatDateTime(product.archived_at)}</dd>
                </>
              ) : null}
              <dt className="text-neutral-500">Updated</dt>
              <dd className="text-neutral-900">{formatDateTime(product.updated_at)}</dd>
              <dt className="text-neutral-500">Tags</dt>
              <dd className="text-neutral-900">{product.tags.length > 0 ? product.tags.join(", ") : "—"}</dd>
            </dl>
          </Panel>

          <Panel title="AR Try-On" bodyClassName="px-6 pb-6">
            {product.product_ar_assets.length === 0 ? (
              <p className="text-body text-neutral-500">No AR assets. This product isn&apos;t offered for try-on.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {product.product_ar_assets.map((asset) => (
                  <li key={asset.id} className="flex items-center justify-between gap-2 text-body">
                    <span>
                      {humanize(asset.mode)} · {humanize(asset.placement)} · {asset.asset_format.toUpperCase()}
                    </span>
                    <ActivePill active={asset.is_active} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
