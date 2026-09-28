"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Thumb } from "@/components/admin/admin-ui";
import { FormSection } from "@/components/admin/product-form/fields";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { TrashIcon, WarningCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { searchOrderVariantsAction } from "@/features/admin/actions/manual-orders";
import { lineIssueMessage, MAX_ORDER_LINES, type ManualOrderValues } from "@/features/admin/manual-order-forms";
import type { OrderVariantOption } from "@/features/admin/queries/manual-orders";
import { MAX_QUANTITY_PER_LINE } from "@/features/catalog/variants";
import type { LineIssue } from "@/features/checkout/errors";
import type { QuoteLine } from "@/features/checkout/quote";
import { formatNpr } from "@/lib/money/format";
import { LookupSearch } from "./lookup-search";

/**
 * What the customer ordered: search active products, pick a variant, set the
 * quantity (at most 10 per line, as on the storefront). Prices and stock on
 * each line come from the server quote; the search result price is only a
 * hint while the quote loads.
 */
export function ItemsSection({
  variants,
  onVariantAdded,
  quoteLines,
  lineIssues,
}: {
  /** Details for each chosen variant, from the search result. */
  variants: Record<string, OrderVariantOption>;
  onVariantAdded: (variant: OrderVariantOption) => void;
  quoteLines: QuoteLine[];
  lineIssues: LineIssue[];
}) {
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<ManualOrderValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "items", keyName: "key" });
  const full = fields.length >= MAX_ORDER_LINES;

  function add(variant: OrderVariantOption) {
    onVariantAdded(variant);
    const index = getValues("items").findIndex((item) => item.variantId === variant.variantId);
    if (index >= 0) {
      // Already on the order: one more of it instead of a second line.
      const current = getValues(`items.${index}.quantity`);
      setValue(`items.${index}.quantity`, Math.min(current + 1, MAX_QUANTITY_PER_LINE), { shouldDirty: true });
      return;
    }
    append({ variantId: variant.variantId, quantity: 1 });
  }

  const itemsError = errors.items?.message ?? errors.items?.root?.message;

  return (
    <FormSection id="items" title="Items" description="Search the catalog for what the customer asked for. Only active products can be ordered.">
      <LookupSearch
        label="Add a product"
        hint={full ? `An order can have up to ${MAX_ORDER_LINES} different items.` : "Type at least 2 letters of the product name."}
        placeholder="Search products"
        noun="products"
        disabled={full}
        search={searchOrderVariantsAction}
        resultKey={(variant) => variant.variantId}
        chooseLabel={(variant) => [variant.productTitle, variant.variantTitle].filter(Boolean).join(", ")}
        onChoose={add}
        renderResult={(variant) => (
          <>
            <Thumb src={variant.thumbnail} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-medium text-neutral-900">{variant.productTitle}</span>
              <span className="truncate text-small text-neutral-500">
                {[variant.variantTitle, variant.sku, formatNpr(variant.pricePaisa), variant.stock > 0 ? `${variant.stock} in stock` : "Sold out"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </>
        )}
      />

      {fields.length === 0 ? (
        <p className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-500">No items yet.</p>
      ) : (
        <ul aria-label="Order items" className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
          {fields.map((field, index) => {
            const variant = variants[field.variantId];
            const line = quoteLines.find((candidate) => candidate.variantId === field.variantId);
            const issue = lineIssues.find((candidate) => candidate.variantId === field.variantId);
            const status = issue?.status ?? (line && line.status !== "ok" ? line.status : null);
            const available = issue?.availableQuantity ?? line?.availableQuantity ?? MAX_QUANTITY_PER_LINE;
            const title = line?.title ?? variant?.productTitle ?? "Item";
            const quantityError = errors.items?.[index]?.quantity?.message;
            return (
              <li key={field.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Thumb src={variant?.thumbnail ?? null} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-neutral-900">{title}</span>
                  <span className="truncate text-small text-neutral-500">
                    {[line?.variantTitle ?? variant?.variantTitle, line?.sku ?? variant?.sku].filter(Boolean).join(" · ")}
                  </span>
                  {status ? (
                    <span className="flex items-center gap-1 text-small text-error-700">
                      <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                      {lineIssueMessage(status, available)}
                    </span>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-small text-neutral-700">
                  Qty
                  <Input
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={MAX_QUANTITY_PER_LINE}
                    step={1}
                    className="w-20"
                    aria-invalid={quantityError ? true : undefined}
                    aria-label={`Quantity of ${title}`}
                  />
                </label>
                <span className="w-24 text-right text-body font-medium tabular-nums text-neutral-900">
                  {line && line.unitPricePaisa !== null ? formatNpr(line.lineTotalPaisa) : "—"}
                </span>
                <button type="button" onClick={() => remove(index)} className={iconButtonClasses({ variant: "ghost" })} aria-label={`Remove ${title}`}>
                  <TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                </button>
                {quantityError ? <p className="w-full text-small text-error-700">{quantityError}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      {itemsError ? <p className="text-small text-error-700">{itemsError}</p> : null}
    </FormSection>
  );
}
