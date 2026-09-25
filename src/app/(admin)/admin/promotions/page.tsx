import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { CollectionStatePill } from "@/components/admin/status-pills";
import { MegaphoneIcon } from "@/components/ui/icons";
import { setCollectionActiveAction } from "@/features/admin/actions/engagement";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate } from "@/features/admin/format";
import { fetchCollections } from "@/features/admin/queries/engagement";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Promotions" };

/** Campaign collections (festive edits, lookbooks) shown in the homepage carousel while live. */
export default async function PromotionsPage() {
  await requireAdminAccess("content.manage");
  const collections = await fetchCollections();

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Collections and seasonal campaigns. A collection is live on the homepage while it's on and inside its schedule."
      />
      <Panel title={`${formatCount(collections.length)} collections`}>
        {collections.length === 0 ? (
          <EmptyState icon={MegaphoneIcon} title="No collections yet" />
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
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id}>
                    <td className={tdClasses}>
                      <span className="flex flex-col">
                        <span className="font-medium">{collection.title}</span>
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
