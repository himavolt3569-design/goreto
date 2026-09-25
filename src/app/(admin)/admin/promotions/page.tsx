import type { Metadata } from "next";
import Link from "next/link";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { CollectionStatePill } from "@/components/admin/status-pills";
import { CheckCircleIcon, MegaphoneIcon, PencilSimpleIcon, PlusIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { setCollectionActiveAction } from "@/features/admin/actions/engagement";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate } from "@/features/admin/format";
import { fetchCollections } from "@/features/admin/queries/engagement";
import { param } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Promotions" };

/** Campaign collections (festive edits, lookbooks) shown in the homepage carousel while live. */
export default async function PromotionsPage({ searchParams }: PageProps<"/admin/promotions">) {
  await requireAdminAccess("content.manage");
  const deleted = param(await searchParams, "deleted") === "1";
  const collections = await fetchCollections();

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Collections and seasonal campaigns. A collection is live on the homepage while it's on and inside its schedule."
        actions={
          <Link href="/admin/promotions/new" className={buttonClasses({ variant: "primary", size: "md" })}>
            <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            Add collection
          </Link>
        }
      />
      {deleted ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Collection deleted.
        </p>
      ) : null}
      <Panel title={`${formatCount(collections.length)} collections`}>
        {collections.length === 0 ? (
          <EmptyState icon={MegaphoneIcon} title="No collections yet" description="Add a collection to feature a seasonal edit on the homepage." />
        ) : (
          <TableScroll label="Collections">
            <table className={cn(tableClasses, "min-w-[760px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Collection</th>
                  <th scope="col" className={thClasses}>Schedule</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Products</th>
                  <th scope="col" className={thClasses}>State</th>
                  <th scope="col" className={thClasses}>On</th>
                  <th scope="col" className={thClasses}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id}>
                    <td className={tdClasses}>
                      <span className="flex flex-col">
                        <Link href={`/admin/promotions/${collection.id}/edit`} className="rounded-xs font-medium hover:text-primary-600">
                          {collection.title}
                        </Link>
                        <span className="text-small text-neutral-500">{collection.eyebrow || `/${collection.slug}`}</span>
                      </span>
                    </td>
                    <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>
                      {collection.startsAt || collection.endsAt
                        ? `${collection.startsAt ? formatDate(collection.startsAt) : "Any time"} – ${collection.endsAt ? formatDate(collection.endsAt) : "no end"}`
                        : "Always"}
                    </td>
                    <td className={cn(tdClasses, numericClasses)}>{formatCount(collection.productCount)}</td>
                    <td className={tdClasses}>
                      <CollectionStatePill state={collection.state} />
                    </td>
                    <td className={tdClasses}>
                      <ToggleForm action={setCollectionActiveAction} id={collection.id} checked={collection.isActive} label={`${collection.title} enabled`} />
                    </td>
                    <td className={cn(tdClasses, "text-right")}>
                      <Link href={`/admin/promotions/${collection.id}/edit`} className={buttonClasses({ variant: "tertiary", size: "md" })}>
                        <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                        Edit<span className="sr-only"> {collection.title}</span>
                      </Link>
                    </td>
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
