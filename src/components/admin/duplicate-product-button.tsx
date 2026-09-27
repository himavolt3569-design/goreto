"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CopyIcon } from "@/components/ui/icons";
import { duplicateProductAction } from "@/features/admin/actions/products";
import { ActionMessage } from "./action-forms";

/** Header button: copy the product into a new draft and open it in the editor. */
export function DuplicateProductButton({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(duplicateProductAction, null);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" variant="tertiary" size="md" loading={pending} leadingIcon={<CopyIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />}>
        Duplicate
      </Button>
      {state && !state.ok ? <ActionMessage state={state} className="max-w-64 text-right" /> : null}
    </form>
  );
}
