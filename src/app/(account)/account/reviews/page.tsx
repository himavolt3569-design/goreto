import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState, AccountPageHeader, AccountPagination } from "@/components/store/account/account-ui";
import { AccountReviewList } from "@/components/store/account/account-review-list";
import { ReviewableProducts } from "@/components/store/account/reviewable-products";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { StarIcon } from "@/components/ui/icons";
import { formatNepalDate } from "@/features/orders/format";
import { fetchOwnReviews, fetchReviewableProducts } from "@/features/reviews/queries";
import { requireProfile } from "@/lib/auth/profile";
import { pageNumber } from "@/lib/pagination/page";

export const metadata: Metadata = { title: "Reviews" };

const PATH = "/account/reviews";

/** Your reviews (AGENTS §4.9): what you can review next, and your reviews with their moderation state. */
export default async function AccountReviewsPage({ searchParams }: PageProps<"/account/reviews">) {
  const profile = await requireProfile();
  const page = pageNumber((await searchParams).page);
  const [reviews, reviewable] = await Promise.all([fetchOwnReviews(profile.id, page), fetchReviewableProducts()]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Reviews" }]} />
      <AccountPageHeader title="Reviews" description="Share how your delivered orders turned out. We check every review before it's published." />

      {reviewable.length ? (
        <section aria-labelledby="ready-title" className="flex flex-col gap-4">
          <h2 id="ready-title" className="text-h2 text-neutral-900">
            Ready to review
          </h2>
          <ReviewableProducts
            products={reviewable.map((product) => ({
              slug: product.slug,
              title: product.title,
              image: product.image,
              deliveredLabel: `Delivered ${formatNepalDate(product.deliveredAt)}`,
            }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="your-reviews-title" className="flex flex-col gap-4">
        <h2 id="your-reviews-title" className="text-h2 text-neutral-900">
          Your reviews
        </h2>
        {reviews.rows.length ? (
          <>
            <AccountReviewList
              reviews={reviews.rows.map((review) => ({
                id: review.id,
                rating: review.rating,
                title: review.title,
                body: review.body,
                status: review.status,
                // updated_at also moves when staff moderate, so it isn't shown as "edited".
                dateLabel: `Written ${formatNepalDate(review.createdAt)}`,
                product: review.product,
              }))}
            />
            <AccountPagination pathname={PATH} page={page} pageCount={reviews.pageCount} />
          </>
        ) : (
          <AccountEmptyState
            icon={StarIcon}
            title="No reviews yet"
            description={
              reviewable.length
                ? "Pick a product under Ready to review to write your first one."
                : "Once an order is delivered, you can review what you bought."
            }
            action={
              reviewable.length ? null : (
                <Link href="/account/orders" className={buttonClasses({ variant: "primary", size: "md" })}>
                  View orders
                </Link>
              )
            }
          />
        )}
      </section>
    </>
  );
}
