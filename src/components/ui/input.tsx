import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Shared field chrome for inputs, search fields and selects (Design System §08). */
export const fieldControlClasses =
  "h-11 w-full rounded-md border border-neutral-200 bg-white px-4 text-body text-neutral-900 transition-colors placeholder:text-neutral-500 hover:border-neutral-300 focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 aria-invalid:border-error-500 aria-invalid:focus-visible:ring-error-500/30";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode;
  /** Trailing icon or small action (e.g. a filter IconButton). */
  trailing?: ReactNode;
};

export function Input({
  leadingIcon,
  trailing,
  className,
  type = "text",
  ...props
}: InputProps) {
  if (!leadingIcon && !trailing) {
    return (
      <input type={type} className={cn(fieldControlClasses, className)} {...props} />
    );
  }

  return (
    <div className="relative flex w-full items-center">
      {leadingIcon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 flex text-neutral-500"
        >
          {leadingIcon}
        </span>
      ) : null}
      <input
        type={type}
        className={cn(
          fieldControlClasses,
          leadingIcon && "pl-12",
          trailing && "pr-12",
          className,
        )}
        {...props}
      />
      {trailing ? (
        <span className="absolute right-1 flex items-center text-neutral-700">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
