import { cn } from "@/lib/utils/cn";
import { SealCheckIcon } from "./icons";

/** Storefront wording for a sponsored product (client decision 2026-10-04). Change it here only. */
export const PICK_LABEL = "Goreto Pick";

/**
 * Blue tick after a product title, like a verified checkmark. It marks
 * products staff flag as sponsored (`products.is_sponsored`). Not
 * colour-only: the icon carries an accessible name and a tooltip.
 */
export function PickBadge({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={PICK_LABEL}
      title={PICK_LABEL}
      className={cn("inline-flex shrink-0 align-[-0.15em] text-info-500", className)}
    >
      <SealCheckIcon aria-hidden="true" size={size} weight="fill" />
    </span>
  );
}
