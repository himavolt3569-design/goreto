import type { Metadata } from "next";
import Link from "next/link";
import { ToggleForm } from "@/components/admin/action-forms";
import { AddLink, EditLink, EmptyState, PageHeader, Panel, StatCard, SuccessNotice, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { ActivePill, Pill } from "@/components/admin/status-pills";
import { StorageCleanup } from "@/components/admin/storage-cleanup";
import { CameraIcon, CoatHangerIcon, CubeIcon, ScanSmileyIcon } from "@/components/ui/icons";
import { setArAssetActiveAction } from "@/features/admin/actions/catalog";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate, humanize } from "@/features/admin/format";
import { AR_MODE_LABELS as MODE_LABELS } from "@/features/admin/ar-forms";
import { fetchArAssets, fetchUnusedUploads } from "@/features/admin/queries/catalog";
import { param } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "AR Try-On" };

/**
 * AR capabilities are truthful (AGENTS §14, §26.2): a product shows AR READY
 * only while it has an active asset. Staff upload overlays and models here;
 * photo try-on also needs a provider configured on the server.
 */
export default async function ArPage({ searchParams }: PageProps<"/admin/ar">) {
  await requireAdminAccess("ar.manage");
  const [assets, unused, params] = await Promise.all([fetchArAssets(), fetchUnusedUploads("ar-assets"), searchParams]);
  const deleted = param(params, "deleted") === "1";
  const photoProviderConfigured = Boolean(process.env.AR_PROVIDER);

  const liveProducts = new Set(assets.filter((asset) => asset.isActive && asset.productStatus === "active").map((asset) => asset.productId));
  const byMode = (mode: keyof typeof MODE_LABELS) => assets.filter((asset) => asset.mode === mode && asset.isActive).length;

  return (
    <>
      <PageHeader
        title="AR Try-On"
        description="Try-on assets per product. Turning an asset off removes the AR READY badge when no other active asset remains."
        actions={<AddLink href="/admin/ar/new">Add AR asset</AddLink>}
      />
      {deleted ? <SuccessNotice>AR asset deleted.</SuccessNotice> : null}

      <section aria-label="AR summary" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="AR ready products" value={formatCount(liveProducts.size)} hint="Live products with an active asset" icon={CoatHangerIcon} />
        <StatCard label="Live 2D overlays" value={formatCount(byMode("live_2d"))} hint="Active assets" icon={ScanSmileyIcon} />
        <StatCard label="Live 3D models" value={formatCount(byMode("live_3d"))} hint="Active assets" icon={CubeIcon} />
        <StatCard
          label="Photo try-on"
          value={photoProviderConfigured ? "Configured" : "Not configured"}
          hint={photoProviderConfigured ? "Provider set on the server" : "Set AR_PROVIDER on the server to enable"}
          icon={CameraIcon}
          tone={photoProviderConfigured ? "success" : "neutral"}
        />
      </section>

      <Panel title={`${formatCount(assets.length)} assets`}>
        {assets.length === 0 ? (
          <EmptyState
            icon={CoatHangerIcon}
            title="No AR assets yet"
            description="Products without assets simply aren't offered for try-on."
            action={<AddLink href="/admin/ar/new">Add AR asset</AddLink>}
          />
        ) : (
          <TableScroll label="AR assets">
            <table className={cn(tableClasses, "min-w-[880px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Product</th>
                  <th scope="col" className={thClasses}>Mode</th>
                  <th scope="col" className={thClasses}>Placement</th>
                  <th scope="col" className={thClasses}>Format</th>
                  <th scope="col" className={thClasses}>Updated</th>
                  <th scope="col" className={thClasses}>Status</th>
                  <th scope="col" className={thClasses}>On</th>
                  <th scope="col" className={thClasses}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className={tdClasses}>
                      <span className="flex flex-col">
                        <Link href={`/admin/products/${asset.productId}`} className="rounded-xs font-medium hover:text-primary-600">
                          {asset.productTitle}
                        </Link>
                        <span className="text-small text-neutral-500">
                          {[asset.variantSku, asset.productStatus && asset.productStatus !== "active" ? `Product ${asset.productStatus}` : null].filter(Boolean).join(" · ") || "All variants"}
                        </span>
                      </span>
                    </td>
                    <td className={tdClasses}>
                      <Pill tone="info">{MODE_LABELS[asset.mode]}</Pill>
                    </td>
                    <td className={cn(tdClasses, "text-neutral-700")}>{humanize(asset.placement)}</td>
                    <td className={tdClasses}>
                      <span className="flex flex-col items-start gap-1">
                        <span className="text-neutral-700">{asset.format.toUpperCase()}</span>
                        {asset.hasFile ? null : <Pill tone="warning">No file uploaded</Pill>}
                      </span>
                    </td>
                    <td className={cn(tdClasses, "whitespace-nowrap text-neutral-500")}>{formatDate(asset.updatedAt)}</td>
                    <td className={tdClasses}>
                      <ActivePill active={asset.isActive} />
                    </td>
                    <td className={tdClasses}>
                      <ToggleForm action={setArAssetActiveAction} id={asset.id} checked={asset.isActive} label={`${MODE_LABELS[asset.mode]} for ${asset.productTitle} active`} />
                    </td>
                    <td className={tdClasses}>
                      <EditLink href={`/admin/ar/${asset.id}/edit`} label={`${MODE_LABELS[asset.mode]} for ${asset.productTitle}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <StorageCleanup bucket="ar-assets" count={unused.count} bytes={unused.bytes} noun="AR files" />
    </>
  );
}
