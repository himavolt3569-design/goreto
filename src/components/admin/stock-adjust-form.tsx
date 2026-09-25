"use client";

import { useActionState, useId } from "react";
import { fieldControlClasses } from "@/components/ui/input";
import { adjustStockAction } from "@/features/admin/actions/catalog";
import { cn } from "@/lib/utils/cn";
import { ActionMessage, SubmitButton } from "./action-forms";

/**
 * Relative stock change for one variant ("+5" received, "-2" damaged). The
 * database applies it atomically and refuses to go below zero.
 */
export function StockAdjustForm({ variantId, sku }: { variantId: string; sku: string }) {
  const [state, formAction] = useActionState(adjustStockAction, null);
  const inputId = useId();
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Change stock for {sku} by
        </label>
        <input
          id={inputId}
          name="delta"
          type="number"
          inputMode="numeric"
          step={1}
          min={-100000}
          max={100000}
          required
          placeholder="±0"
          aria-invalid={state && !state.ok ? true : undefined}
          className={cn(fieldControlClasses, "w-24 px-3 tabular-nums")}
        />
        <SubmitButton variant="tertiary">Apply</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
