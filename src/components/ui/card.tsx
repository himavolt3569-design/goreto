import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds hover elevation for clickable cards. */
  interactive?: boolean;
};

/** Base surface: white, subtle border, 16px radius, restrained shadow. */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-sm",
        interactive && "transition-shadow hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
