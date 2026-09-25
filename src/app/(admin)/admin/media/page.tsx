import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkTabs, PageHeader, Pagination, Panel, Thumb } from "@/components/admin/admin-ui";
import { ImageIcon } from "@/components/ui/icons";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount } from "@/features/admin/format";
import { countMissingAltText, fetchMedia } from "@/features/admin/queries/catalog";
import { pageNumber } from "@/features/admin/queries/shared";
import { hrefWith, param } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Media" };

/** Product media library. Uploads arrive with the product form task. */
export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  await requireAdminAccess("catalog.read");
  const params = await searchParams;
  const missingAlt = param(params, "filter") === "missing_alt";
  const page = pageNumber(params.page);
  const [media, missingCount] = await Promise.all([fetchMedia({ missingAlt, page }), countMissingAltText()]);

  return (
    <>
      <PageHeader title="Media" description="Product images in the storefront media bucket, newest first. Alt text describes each image for screen readers." />
      <LinkTabs
        label="Media filter"
        tabs={[
          { label: "All media", href: hrefWith("/admin/media", params, { filter: null }), active: !missingAlt },
          { label: "Missing alt text", href: hrefWith("/admin/media", params, { filter: "missing_alt" }), active: missingAlt, count: missingCount },
        ]}
      />
      <Panel title={`${formatCount(media.total)} ${missingAlt ? "images without alt text" : "images"}`}>
        {media.rows.length === 0 ? (
          <EmptyState icon={ImageIcon} title={missingAlt ? "Every image has alt text" : "No media yet"} />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-6 px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {media.rows.map((item) => (
                <li key={item.id} className="flex min-w-0 flex-col gap-2">
                  <Thumb src={item.url} sizes="(min-width: 1536px) 200px, (min-width: 640px) 30vw, 45vw" className="aspect-square size-auto w-full rounded-md" />
                  <Link href={`/admin/products/${item.productId}`} className="truncate rounded-xs text-body font-medium hover:text-primary-600">
                    {item.productTitle}
                  </Link>
                  <p className={cn("line-clamp-2 text-small", item.altText ? "text-neutral-500" : "font-medium text-warning-700")}>
                    {item.altText || "Missing alt text"}
                  </p>
                  {item.isVariantImage ? <p className="text-small text-neutral-500">Variant image</p> : null}
                </li>
              ))}
            </ul>
            <Pagination pathname="/admin/media" params={params} page={media.page} pageCount={media.pageCount} total={media.total} noun="images" />
          </>
        )}
      </Panel>
    </>
  );
}
