"use client";

import Image from "next/image";
import { useId } from "react";
import type { ProductDetail, ProductOption, ProductVariant } from "@/features/catalog/types";
import { isOptionSoldOut, swatchImage } from "@/features/catalog/variants";
import { cn } from "@/lib/utils/cn";

export type OptionSelectorProps = {
  product: Pick<ProductDetail, "variants" | "media">;
  option: ProductOption;
  selected: ProductVariant;
  onSelect: (optionName: string, value: string) => void;
};

/** Shared by every swatch style: selected border and a visible keyboard focus ring. */
const swatchBase =
  "flex items-center justify-center rounded-md border-2 bg-white transition-colors peer-checked:border-primary-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-500 hover:border-primary-200";

/**
 * One option (Color, Size…) as a native radio group, so arrow keys move the
 * selection. Values show the variant's own photo when it has one, otherwise a
 * colour chip or a text pill. Sold-out values stay selectable and say so.
 */
export function OptionSelector({ product, option, selected, onSelect }: OptionSelectorProps) {
  const name = useId();
  const current = selected.optionValues[option.name];
  const currentLabel = option.values.find((value) => value.value === current)?.label;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-body font-medium text-neutral-900">
        {option.name}
        {currentLabel ? (
          <span className="font-normal text-neutral-500">: {currentLabel}</span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-3">
        {option.values.map((value) => {
          const image = swatchImage(product, option.name, value.value);
          const soldOut = isOptionSoldOut(product, selected, option.name, value.value);
          const accessibleLabel = soldOut ? `${value.label} (sold out)` : value.label;

          return (
            <label key={value.value} className="relative cursor-pointer" title={accessibleLabel}>
              <input
                type="radio"
                name={name}
                value={value.value}
                checked={current === value.value}
                onChange={() => onSelect(option.name, value.value)}
                aria-label={accessibleLabel}
                className="peer sr-only"
              />
              {image ? (
                <span
                  className={cn(
                    swatchBase,
                    "relative size-16 overflow-hidden border-neutral-200",
                    soldOut && "opacity-50",
                  )}
                >
                  <Image src={image.src} alt="" fill sizes="64px" className="object-cover" />
                </span>
              ) : (
                <span
                  className={cn(
                    swatchBase,
                    "h-11 min-w-11 gap-2 border-neutral-200 px-4 text-body font-medium text-neutral-900",
                    soldOut && "text-neutral-300 line-through",
                  )}
                >
                  {value.swatchHex ? (
                    <span
                      aria-hidden="true"
                      className="size-4 rounded-full border border-neutral-200"
                      style={{ backgroundColor: value.swatchHex }}
                    />
                  ) : null}
                  {value.label}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
