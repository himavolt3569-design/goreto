"use client";

import { startTransition, useActionState } from "react";
import { ArrowSquareOutIcon, DotsThreeIcon, EyeIcon, PencilSimpleIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { setProductStatusAction } from "@/features/admin/actions/catalog";
import type { ProductStatus } from "@/features/admin/queries/catalog";
import { ActionMessage } from "./action-forms";
import { Menu, MenuButton, MenuLink, MenuSeparator } from "./menu";

const STATUS_ACTIONS: { status: ProductStatus; label: string }[] = [
  { status: "active", label: "Set active" },
  { status: "draft", label: "Move to drafts" },
  { status: "archived", label: "Archive" },
];

/**
 * Row "⋯" menu for a product (dashboard + products list). Status changes run
 * the action directly, not from a form inside the menu, so closing the menu
 * can't cancel the submission.
 */
export function ProductActionsMenu({
  product,
  canWrite,
}: {
  product: { id: string; title: string; slug: string; status: ProductStatus };
  canWrite: boolean;
}) {
  const [state, dispatch, pending] = useActionState(setProductStatusAction, null);

  function setStatus(status: ProductStatus) {
    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("status", status);
    startTransition(() => dispatch(formData));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Menu
        triggerLabel={`Actions for ${product.title}`}
        triggerClassName={iconButtonClasses({ variant: "ghost", size: "sm" })}
        trigger={<DotsThreeIcon aria-hidden="true" size={ICON_SIZE} weight="bold" className={pending ? "animate-pulse" : undefined} />}
      >
        <MenuLink href={`/admin/products/${product.id}`}>
          <EyeIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
          View details
        </MenuLink>
        {canWrite ? (
          <MenuLink href={`/admin/products/${product.id}/edit`}>
            <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
            Edit
          </MenuLink>
        ) : null}
        {product.status === "active" ? (
          <MenuLink href={`/products/${product.slug}`}>
            <ArrowSquareOutIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
            View on store
          </MenuLink>
        ) : null}
        {canWrite ? (
          <>
            <MenuSeparator />
            {STATUS_ACTIONS.filter((action) => action.status !== product.status).map((action) => (
              <MenuButton key={action.status} onClick={() => setStatus(action.status)} disabled={pending}>
                {action.label}
              </MenuButton>
            ))}
          </>
        ) : null}
      </Menu>
      {state && !state.ok ? <ActionMessage state={state} className="max-w-48 text-right" /> : null}
    </div>
  );
}
