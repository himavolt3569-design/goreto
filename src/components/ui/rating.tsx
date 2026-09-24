import { StarIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_FILLED } from "./icon";

export type RatingProps = {
  /** Average rating, 0–5. */
  value: number;
  count?: number;
  /**
   * `compact`: one star + value + (count), for cards.
   * `stars`: five stars with a partial fill + value + (count reviews), for product pages.
   */
  variant?: "compact" | "stars";
  className?: string;
};

const STAR_COUNT = 5;

export function Rating({ value, count, variant = "compact", className }: RatingProps) {
  const rounded = value.toFixed(1);
  const accessibleLabel =
    count === undefined
      ? `Rated ${rounded} out of 5`
      : `Rated ${rounded} out of 5 from ${count} reviews`;

  if (variant === "stars") {
    return (
      <span
        role="img"
        aria-label={accessibleLabel}
        className={cn("inline-flex items-center gap-2 text-body", className)}
      >
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: STAR_COUNT }, (_, index) => (
            <PartialStar key={index} fill={Math.min(1, Math.max(0, value - index))} />
          ))}
        </span>
        {/* primary-700: the reference's orange, at readable contrast on white. */}
        <span aria-hidden="true" className="font-semibold text-primary-700">
          {rounded}
        </span>
        {count === undefined ? null : (
          <span aria-hidden="true" className="text-neutral-500">
            ({count} {count === 1 ? "review" : "reviews"})
          </span>
        )}
      </span>
    );
  }

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

/** A star filled from the left by `fill` (0–1): a neutral star under a clipped amber one. */
function PartialStar({ fill }: { fill: number }) {
  return (
    <span className="relative inline-flex">
      <StarIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_FILLED} className="text-neutral-200" />
      <span
        data-fill={fill.toFixed(2)}
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${fill * 100}%` }}
      >
        <StarIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_FILLED} className="text-warning-500" />
      </span>
    </span>
  );
}
