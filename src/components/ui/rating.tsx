import { StarIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_XS, ICON_WEIGHT_FILLED } from "./icon";

export type RatingProps = {
  /** Average rating, 0–5. */
  value: number;
  count?: number;
  className?: string;
};

export function Rating({ value, count, className }: RatingProps) {
  const rounded = value.toFixed(1);
  const accessibleLabel =
    count === undefined
      ? `Rated ${rounded} out of 5`
      : `Rated ${rounded} out of 5 from ${count} reviews`;

  return (
    <span
      role="img"
      aria-label={accessibleLabel}
      className={cn("inline-flex items-center gap-1 text-body", className)}
    >
      <StarIcon
        aria-hidden="true"
        size={ICON_SIZE_XS}
        weight={ICON_WEIGHT_FILLED}
        className="text-warning-500"
      />
      <span aria-hidden="true" className="font-medium text-neutral-900">
        {rounded}
      </span>
      {count === undefined ? null : (
        <span aria-hidden="true" className="text-neutral-500">
          ({count})
        </span>
      )}
    </span>
  );
}
