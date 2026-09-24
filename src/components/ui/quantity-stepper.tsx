"use client";

import { useState, type ChangeEvent } from "react";
import { MinusIcon, PlusIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "./icon";

export type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** Accessible name of the group and the number field. */
  label?: string;
  disabled?: boolean;
  className?: string;
};

const stepButton =
  "flex h-full w-11 items-center justify-center text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:text-neutral-300";

/** − / number / + control. Typed values are clamped to [min, max] on blur. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label = "Quantity",
  disabled = false,
  className,
}: QuantityStepperProps) {
  // Raw text while the shopper is typing; `null` shows the committed value.
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (next: number) => Math.min(Math.max(next, min), Math.max(min, max));

  /** Whole-number value of the typed text, or `null` for "", "2abc", "1.5", etc. */
  function parse(text: string): number | null {
    if (text.trim() === "") return null;
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDraft(text);
    const parsed = parse(text);
    if (parsed !== null && parsed >= min && parsed <= max) onChange(parsed);
  }

  function commit() {
    if (draft === null) return;
    const parsed = parse(draft);
    onChange(parsed !== null ? clamp(parsed) : value);
    setDraft(null);
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-11 shrink-0 items-stretch divide-x divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white focus-within:border-primary-500",
        disabled && "bg-neutral-50",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={stepButton}
      >
        <MinusIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={draft ?? String(value)}
        disabled={disabled}
        onChange={onInput}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className="w-12 bg-transparent [appearance:textfield] text-center text-body-lg font-medium text-neutral-900 outline-none disabled:text-neutral-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={stepButton}
      >
        <PlusIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
      </button>
    </div>
  );
}
