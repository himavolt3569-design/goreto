import type { SelectHTMLAttributes } from "react";
import { CaretDownIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "./icon";
import { fieldControlClasses } from "./input";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Styled native select: keeps platform keyboard/screen-reader behaviour. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative flex w-full items-center">
      <select
        className={cn(
          fieldControlClasses,
          "cursor-pointer appearance-none pr-12 font-medium",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDownIcon
        aria-hidden="true"
        size={ICON_SIZE_SM}
        weight={ICON_WEIGHT_OUTLINE}
        className="pointer-events-none absolute right-4 text-neutral-700"
      />
    </div>
  );
}
