"use client";

import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { TrashIcon } from "@/components/ui/icons";
import { setProductStatusAction } from "@/features/admin/actions/catalog";
import { deleteProductAction } from "@/features/admin/actions/products";
import { ActionForm, FormDialog, SubmitButton } from "../action-forms";

/*
 * Deleting is only for products that were never ordered: order history keeps
 * its links (AGENTS §26.11). Ordered products are archived instead, which
 * hides them from the storefront. The database enforces the same rule.
 */
export function ProductDangerZone({
  productId,
  title,
  hasOrders,
  archived,
}: {
  productId: string;
  title: string;
  hasOrders: boolean;
  archived: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 border-error-100 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-neutral-900">Danger zone</h2>
        <p className="text-body text-neutral-500">
          {hasOrders
            ? "This product has orders, so it can't be deleted. Archive it to hide it from the storefront and keep its order history."
            : "Deleting removes the product for good."}
        </p>
      </div>
      {hasOrders ? (
        archived ? (
          <p className="text-body text-neutral-700">This product is archived.</p>
        ) : (
          <ActionForm action={setProductStatusAction} hidden={{ productId, status: "archived" }} className="flex flex-col items-start gap-2">
            <SubmitButton variant="tertiary">Archive product</SubmitButton>
          </ActionForm>
        )
      ) : (
        <FormDialog
          action={deleteProductAction}
          hidden={{ productId }}
          title={`Delete “${title}”?`}
          description="This can't be undone."
          triggerLabel="Delete product"
          triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          submitLabel="Delete product"
        >
          <div className="flex flex-col gap-2 text-body text-neutral-700">
            <p>These are removed with it:</p>
            <ul className="list-disc pl-6">
              <li>its photos, from the gallery and from storage;</li>
              <li>its variants and their stock;</li>
              <li>its AR try-on assets;</li>
              <li>its collection links;</li>
              <li>shoppers&apos; wishlist saves and reviews of it.</li>
            </ul>
          </div>
        </FormDialog>
      )}
    </Card>
  );
}
