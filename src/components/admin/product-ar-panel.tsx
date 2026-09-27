import Link from "next/link";
import { humanize } from "@/features/admin/format";
import { Panel } from "./admin-ui";
import { ActivePill } from "./status-pills";

type ProductArAsset = { id: string; mode: string; placement: string; format: string; isActive: boolean };

/** A product's try-on assets on its overview and editor; `canManage` (ar.manage) adds links to the AR editor. */
export function ProductArPanel({ productId, assets, canManage }: { productId: string; assets: ProductArAsset[]; canManage: boolean }) {
  return (
    <Panel
      title="AR Try-On"
      description={canManage ? "Overlays and 3D models shoppers try on." : "Try-on assets are managed by staff with AR access."}
      action={
        canManage ? (
          <Link href={`/admin/ar/new?product=${productId}`} className="shrink-0 rounded-xs text-body font-medium text-primary-600 hover:underline">
            Add AR asset
          </Link>
        ) : null
      }
      bodyClassName="px-6 pb-6"
    >
      {assets.length === 0 ? (
        <p className="text-body text-neutral-500">No AR assets. This product isn&apos;t offered for try-on.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {assets.map((asset) => {
            const label = `${humanize(asset.mode)} · ${humanize(asset.placement)} · ${asset.format.toUpperCase()}`;
            return (
              <li key={asset.id} className="flex items-center justify-between gap-2 text-body">
                {canManage ? (
                  <Link href={`/admin/ar/${asset.id}/edit`} className="rounded-xs hover:text-primary-600 hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span>{label}</span>
                )}
                <ActivePill active={asset.isActive} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
