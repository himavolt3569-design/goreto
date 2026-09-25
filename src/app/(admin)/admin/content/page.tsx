import type { Metadata } from "next";
import Link from "next/link";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, StatCard, TableScroll, Thumb, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { ProductStatusPill, productDisplayStatus } from "@/components/admin/status-pills";
import { EnvelopeSimpleIcon, StarIcon } from "@/components/ui/icons";
import { setProductFlagAction } from "@/features/admin/actions/catalog";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate, humanize } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { fetchMerchandisedProducts } from "@/features/admin/queries/catalog";
import { fetchNewsletterSummary } from "@/features/admin/queries/engagement";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Content Management" };

/** Homepage merchandising (featured / bestseller flags) and newsletter sign-ups. */
export default async function ContentPage() {
  const profile = await requireAdminAccess("content.manage");
  const canCatalog = canAccess(profile, "catalog.read");
  const canWrite = canAccess(profile, "catalog.write");
  const [products, newsletter] = await Promise.all([canCatalog ? fetchMerchandisedProducts() : null, fetchNewsletterSummary()]);

  return (
    <>
      <PageHeader
        title="Content Management"
        description="What the homepage features, and who has signed up for offers. Collections and campaigns live under Promotions."
      />

      {products ? (
        <Panel
          title="Homepage merchandising"
          description="Featured products fill the homepage's Handpicked grid; Bestseller adds the badge. Only active products are shown to shoppers."
        >
          {products.length === 0 ? (
            <EmptyState icon={StarIcon} title="Nothing is featured yet" />
          ) : (
            <TableScroll label="Featured and bestseller products">
              <table className={tableClasses}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Product</th>
                    <th scope="col" className={thClasses}>Status</th>
                    <th scope="col" className={thClasses}>Featured</th>
                    <th scope="col" className={thClasses}>Bestseller</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className={tdClasses}>
                        <Link href={`/admin/products/${product.id}`} className="group flex items-center gap-3 rounded-sm">
                          <Thumb src={product.thumbnail} />
                          <span className="flex flex-col">
                            <span className="font-medium group-hover:text-primary-600">{product.title}</span>
                            <span className="text-small text-neutral-500">{product.categoryTitle}</span>
                          </span>
                        </Link>
                      </td>
                      <td className={tdClasses}>
                        <ProductStatusPill status={productDisplayStatus(product.status, product.stockState)} />
                      </td>
                      <td className={tdClasses}>
                        <ToggleForm
                          action={setProductFlagAction}
                          id={product.id}
                          checked={product.isFeatured}
                          label={`Feature ${product.title} on the homepage`}
                          disabled={!canWrite}
                          extra={{ flag: "is_featured" }}
                        />
                      </td>
                      <td className={tdClasses}>
                        <ToggleForm
                          action={setProductFlagAction}
                          id={product.id}
                          checked={product.isBestseller}
                          label={`Mark ${product.title} as a bestseller`}
                          disabled={!canWrite}
                          extra={{ flag: "is_bestseller" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          {!canWrite ? <p className="px-6 pb-6 text-small text-neutral-500">Changing these flags needs the catalog.write permission.</p> : null}
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <StatCard label="Newsletter subscribers" value={formatCount(newsletter.subscribed)} hint={`${formatCount(newsletter.unsubscribed)} unsubscribed`} icon={EnvelopeSimpleIcon} />
        </div>
        <Panel title="Latest sign-ups">
          {newsletter.recent.length === 0 ? (
            <EmptyState icon={EnvelopeSimpleIcon} title="No subscribers yet" />
          ) : (
            <TableScroll label="Latest newsletter sign-ups">
              <table className={cn(tableClasses, "min-w-[480px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Email</th>
                    <th scope="col" className={thClasses}>Source</th>
                    <th scope="col" className={thClasses}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {newsletter.recent.map((subscriber) => (
                    <tr key={subscriber.email}>
                      <td className={cn(tdClasses, "break-all")}>{subscriber.email}</td>
                      <td className={cn(tdClasses, "text-neutral-700")}>{humanize(subscriber.source)}</td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-500")}>{formatDate(subscriber.subscribedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
      </div>
    </>
  );
}
