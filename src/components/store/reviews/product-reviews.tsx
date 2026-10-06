import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowRightIcon, StarIcon } from "@/components/ui/icons";
import type { PublicReview, RatingBreakdown as Breakdown } from "@/features/reviews/mappers";
import { RatingBreakdown } from "./rating-breakdown";
import { ReviewCard } from "./review-card";
import { WriteReviewButton } from "./write-review-button";

export const REVIEWS_SECTION_ID = "reviews";

/**
 * "Customer reviews" on the product page (AGENTS §4.2): summary and breakdown
 * beside the latest published reviews, with a link to all of them.
 */
export function ProductReviews({
  productSlug,
  breakdown,
  latest,
}: {
  productSlug: string;
  breakdown: Breakdown;
  latest: PublicReview[];
}) {
  const hasMore = breakdown.count > latest.length;

  return (
    <section id={REVIEWS_SECTION_ID} aria-labelledby="reviews-title" className="flex scroll-mt-24 flex-col gap-6">
      <h2 id="reviews-title" className="text-h1 text-neutral-900">
        Customer reviews
      </h2>

      {breakdown.count === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
            <StarIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
          </span>
          <h3 className="text-h3 text-neutral-900">No reviews yet</h3>
          <p className="max-w-md text-body text-neutral-500">Bought this? Share how it went once your order is delivered.</p>
          <WriteReviewButton productSlug={productSlug} />
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
          <Card className="flex flex-col gap-6 p-6">
            <RatingBreakdown breakdown={breakdown} />
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-6">
              <p className="text-body text-neutral-500">Reviews come from customers whose order was delivered.</p>
              <WriteReviewButton productSlug={productSlug} />
            </div>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <ul aria-label="Latest reviews" className="grid gap-4 md:grid-cols-2">
              {latest.map((review) => (
                <li key={review.id} className="flex">
                  <ReviewCard review={review} className="w-full" />
                </li>
              ))}
            </ul>
            {hasMore ? (
              <Link href={`/products/${productSlug}/reviews`} className={buttonClasses({ variant: "text", size: "md", className: "w-fit" })}>
                See all {breakdown.count} reviews
                <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
