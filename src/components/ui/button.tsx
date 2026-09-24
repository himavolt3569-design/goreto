import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "text";
export type ButtonSize = "lg" | "md";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md [&_svg]:shrink-0 font-medium transition-colors disabled:pointer-events-none aria-disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-600 disabled:bg-primary-200 disabled:text-primary-100 aria-disabled:bg-primary-200 aria-disabled:text-primary-100",
  secondary:
    "border border-primary-500 bg-white text-primary-500 hover:bg-primary-100 active:bg-primary-100 disabled:border-neutral-200 disabled:text-neutral-300 aria-disabled:border-neutral-200 aria-disabled:text-neutral-300",
  tertiary:
    "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 active:bg-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-300 aria-disabled:bg-neutral-50 aria-disabled:text-neutral-300",
  text: "text-primary-500 hover:text-primary-600 hover:underline underline-offset-4 disabled:text-neutral-300 aria-disabled:text-neutral-300",
};

// Height is 44px for every container variant; padding differs by size.
const sizes: Record<ButtonSize, string> = {
  lg: "h-11 px-4 text-body-lg",
  md: "h-11 px-3 text-body",
};

/**
 * Class names for the Goreto button language. Use directly on a `next/link`
 * when a navigation needs to look like a button.
 */
export function buttonClasses({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
}: ButtonClassOptions = {}): string {
  return cn(
    base,
    variants[variant],
    variant === "text" ? "h-11 px-0 font-medium" : sizes[size],
    variant === "text" && (size === "md" ? "text-body" : "text-body-lg"),
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Shows a busy state; the button is disabled while loading. */
  loading?: boolean;
};

export function Button({
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
