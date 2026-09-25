"use client";

import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { TrashIcon } from "@/components/ui/icons";
import { deleteCategoryAction } from "@/features/admin/actions/categories";
import { setCategoryActiveAction } from "@/features/admin/actions/catalog";
import { deleteCollectionAction } from "@/features/admin/actions/collections";
import { ActionForm, FormDialog, SubmitButton } from "./action-forms";

/*
 * Delete for categories and collections. A category can only go when it is
 * empty (the database checks too); otherwise it can be hidden. Deleting a
 * collection keeps its products.
 */

export function CategoryDangerZone({
  categoryId,
  title,
  productCount,
  subcategories,
  isActive,
}: {
  categoryId: string;
  title: string;
  productCount: number;
  subcategories: { id: string; title: string }[];
  isActive: boolean;
}) {
  const blockers = [
    productCount > 0 ? `${productCount === 1 ? "1 product" : `${productCount} products`} (move them to another category first)` : null,
    subcategories.length > 0 ? `subcategories: ${subcategories.map((child) => child.title).join(", ")}` : null,
  ].filter((item): item is string => item !== null);

  return (
    <Card className="flex flex-col gap-4 border-error-100 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-neutral-900">Danger zone</h2>
        <p className="text-body text-neutral-500">
          {blockers.length > 0 ? "This category can't be deleted while it has:" : "Deleting removes the category and its image for good."}
        </p>
        {blockers.length > 0 ? (
          <ul className="list-disc pl-6 text-body text-neutral-700">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {blockers.length > 0 ? (
        isActive ? (
          <ActionForm action={setCategoryActiveAction} hidden={{ id: categoryId }} className="flex flex-col items-start gap-2">
            <SubmitButton variant="tertiary">Hide from storefront</SubmitButton>
          </ActionForm>
        ) : (
          <p className="text-body text-neutral-700">This category is hidden from the storefront.</p>
        )
      ) : (
        <FormDialog
          action={deleteCategoryAction}
          hidden={{ categoryId }}
          title={`Delete “${title}”?`}
          description="This can't be undone. Links to the category page will stop working."
          triggerLabel="Delete category"
          triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          submitLabel="Delete category"
        >
          <p className="text-body text-neutral-700">The category has no products or subcategories.</p>
        </FormDialog>
      )}
    </Card>
  );
}

export function CollectionDangerZone({ collectionId, title, productCount }: { collectionId: string; title: string; productCount: number }) {
  return (
    <Card className="flex flex-col gap-4 border-error-100 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-neutral-900">Danger zone</h2>
        <p className="text-body text-neutral-500">Deleting removes the collection and its hero image. Its products stay in the catalog.</p>
      </div>
      <FormDialog
        action={deleteCollectionAction}
        hidden={{ collectionId }}
        title={`Delete “${title}”?`}
        description="This can't be undone."
        triggerLabel="Delete collection"
        triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
        submitLabel="Delete collection"
      >
        <p className="text-body text-neutral-700">
          {productCount === 0 ? "It has no products." : `${productCount === 1 ? "1 product is" : `${productCount} products are`} unlinked from it, not deleted.`}
        </p>
      </FormDialog>
    </Card>
  );
}
