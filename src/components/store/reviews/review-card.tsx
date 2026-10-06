import { ICON_SIZE_XS, ICON_WEIGHT_FILLED } from "@/components/ui/icon";
import { SealCheckIcon } from "@/components/ui/icons";
import { Rating } from "@/components/ui/rating";
import { formatNepalDate } from "@/features/orders/format";
import type { PublicReview } from "@/features/reviews/mappers";
import { cn } from "@/lib/utils/cn";

/** "Verified purchase": icon plus text, so the state never rests on colour alone. */
export function VerifiedPurchase({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-small font-medium text-success-700", className)}>
      <SealCheckIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_FILLED} />
      Verified purchase
    </span>
  );
}

/** One published review. The text is rendered as text (never HTML), keeping its line breaks. */
export function ReviewCard({ review, className }: { review: PublicReview; className?: string }) {
  return (
    <article className={cn("flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rating variant="stars" value={review.rating} />
        {review.verified ? <VerifiedPurchase /> : null}
      </div>
      {review.title ? <h3 className="text-h3 text-neutral-900">{review.title}</h3> : null}
      <p className="whitespace-pre-line break-words text-body text-neutral-700">{review.body}</p>
      <p className="text-small text-neutral-500">
        <span className="font-medium text-neutral-700">{review.authorName}</span>
        {" · "}
        <time dateTime={review.createdAt}>{formatNepalDate(review.createdAt)}</time>
      </p>
    </article>
  );
}
