"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LockSimpleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { unlockOrderAction, type UnlockOrderState } from "@/features/checkout/actions";

/**
 * Shown when this browser can't open the order: the shopper pastes the
 * tracking code (or the whole tracking link) from their confirmation page.
 */
export function UnlockOrderForm({ orderNumber }: { orderNumber: string }) {
  const [state, formAction, pending] = useActionState<UnlockOrderState, FormData>(unlockOrderAction, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <Field
        label="Tracking code"
        required
        hint="It's in the tracking link on your order confirmation page. You can paste the whole link."
        error={state.error ?? undefined}
      >
        {(control) => <Input {...control} name="code" autoComplete="off" spellCheck={false} placeholder="Paste your code or tracking link" />}
      </Field>
      <Button
        type="submit"
        loading={pending}
        className="self-start"
        leadingIcon={<LockSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      >
        Show my order
      </Button>
    </form>
  );
}
