import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone =
  | "new"
  | "bestseller"
  | "limited"
  | "cod"
  | "ar-ready"
  | "neutral";

const tones: Record<BadgeTone, string> = {
  new: "bg-primary-100 text-primary-700",
  bestseller: "bg-primary-200 text-primary-700",
  limited: "bg-limited-100 text-limited-700",
  cod: "bg-success-100 text-success-700",
  "ar-ready": "bg-info-100 text-info-700",
  neutral: "bg-neutral-100 text-neutral-700",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: "md" | "sm";
};

/** Uppercase merchandising tag: NEW, BESTSELLER, LIMITED, COD, AR READY. */
export function Badge({
  tone = "neutral",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wide",
        // md: standalone tag pill. sm: compact tag inside product cards.
        size === "md" ? "h-8 px-3 text-small" : "h-6 rounded-xs px-2 text-small",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
