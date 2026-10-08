import { Rating } from "@/components/ui/rating";
import type { RatingBreakdown as Breakdown } from "@/features/reviews/mappers";
import { cn } from "@/lib/utils/cn";

/**
 * Average, total and a 5 → 1 star breakdown. Every bar carries its star count
 * and review count as text; the bars themselves are decorative.
 */
export function RatingBreakdown({ breakdown, className }: { breakdown: Breakdown; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {breakdown.average !== null ? (
        <div className="flex flex-col gap-2">
          <p className="text-display-2 font-bold text-neutral-900">
            {breakdown.average.toFixed(1)}
            <span className="sr-only"> out of 5</span>
          </p>
          <Rating variant="stars" value={breakdown.average} count={breakdown.count} />
        </div>
      ) : null}

      <ul aria-label="Reviews by star rating" className="flex flex-col gap-2">
        {breakdown.bars.map((bar) => (
          <li key={bar.stars} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-body">
            <span className="text-neutral-700">
              {bar.stars} {bar.stars === 1 ? "star" : "stars"}
            </span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-neutral-200">
              <span className="block h-full rounded-full bg-warning-500" style={{ width: `${bar.percent}%` }} />
            </span>
            <span className="text-right text-neutral-500">
              {bar.count}
              <span className="sr-only"> {bar.count === 1 ? "review" : "reviews"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
