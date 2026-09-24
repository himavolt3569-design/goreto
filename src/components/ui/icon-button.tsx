import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type IconButtonVariant = "ghost" | "outline" | "soft" | "primary";
export type IconButtonSize = "md" | "sm";

const variants: Record<IconButtonVariant, string> = {
  ghost: "text-neutral-900 hover:bg-neutral-100",
  outline: "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100",
  soft: "bg-primary-100 text-primary-500 hover:bg-primary-200",
  primary: "bg-primary-500 text-white hover:bg-primary-600",
};

// md = 44px (control standard). sm = 40px for dense surfaces such as product cards.
const sizes: Record<IconButtonSize, string> = {
  md: "size-11 rounded-md",
  sm: "size-10 rounded-sm",
};

export function iconButtonClasses({
  variant = "ghost",
  size = "md",
  className,
}: {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

export function IconButton({
  label,
  icon,
  variant,
  size,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={iconButtonClasses({ variant, size, className })}
      {...props}
    >
      {icon}
    </button>
  );
}
