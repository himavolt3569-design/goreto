import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkTabs, PageHeader, Pagination, Panel } from "@/components/admin/admin-ui";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { Pill, ReviewStatusPill } from "@/components/admin/status-pills";
import { StarIcon } from "@/components/ui/icons";
import { Rating } from "@/components/ui/rating";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate, formatDateTime, shortName } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import { countReviewsByStatus, fetchReviews, REVIEW_STATUSES } from "@/features/admin/queries/engagement";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { hrefWith, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const profile = await requireAdminAccess("reviews.manage");
  const params = await searchParams;
  const status = pickEnum(params.status, REVIEW_STATUSES);
  const ratingParam = Number(param(params, "rating"));
  const rating = Number.isInteger(ratingParam) && ratingParam >= 1 && ratingParam <= 5 ? ratingParam : null;
  const page = pageNumber(params.page);
  const canSeeCustomers = canAccess(profile, "customers.read");

  const [reviews, counts] = await Promise.all([fetchReviews({ status, rating, page }), countReviewsByStatus()]);

  const tabs = [
    { label: "All", value: null, count: undefined },
    { label: "Pending", value: "pending", count: counts.pending },
    { label: "Published", value: "published", count: counts.published },
    { label: "Rejected", value: "rejected", count: counts.rejected },
  ].map((tab) => ({ label: tab.label, href: hrefWith("/admin/reviews", params, { status: tab.value }), active: status === tab.value, count: tab.count }));

  return (
    <>
      <PageHeader title="Reviews" description="Only published reviews appear on the storefront. Verified reviews come from delivered orders." />
      <LinkTabs label="Review status" tabs={tabs} />
      <LinkTabs
        label="Rating filter"
        tabs={[null, 5, 4, 3, 2, 1].map((value) => ({
          label: value === null ? "Any rating" : `${value} star${value === 1 ? "" : "s"}`,
          href: hrefWith("/admin/reviews", params, { rating: value }),
          active: rating === value,
        }))}
      />

      <Panel title={`${formatCount(reviews.total)} reviews`} bodyClassName="px-6">
        {reviews.rows.length === 0 ? (
          <EmptyState icon={StarIcon} title={status === "pending" ? "No reviews waiting" : "No reviews match"} description={status === "pending" ? "You're all caught up." : undefined} />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {reviews.rows.map((review) => (
              <li key={review.id} className="flex flex-col gap-3 py-6 first:pt-0 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReviewStatusPill status={review.status} />
                    {review.verifiedPurchase ? <Pill tone="info">Verified purchase</Pill> : null}
                    <Rating value={review.rating} variant="stars" />
                  </div>
                  <p className="text-body text-neutral-500">
                    <Link href={`/admin/products/${review.productId}`} className="rounded-xs font-medium text-neutral-900 hover:text-primary-600">
                      {review.productTitle}
                    </Link>
                    {" · "}
                    {canSeeCustomers && review.authorName ? (
                      <Link href={`/admin/customers/${review.authorId}`} className="rounded-xs hover:text-primary-600">
                        {shortName(review.authorName)}
                      </Link>
                    ) : (
                      "Customer"
                    )}
                    {" · "}
                    {formatDate(review.createdAt)}
                  </p>
                  {review.title ? <p className="text-body font-semibold text-neutral-900">{review.title}</p> : null}
                  <p className="whitespace-pre-line text-body text-neutral-700">{review.body}</p>
                  {review.moderatedAt ? (
                    <p className="text-small text-neutral-500">
                      Moderated {formatDateTime(review.moderatedAt)}
                      {review.moderationNote ? ` · Note: ${review.moderationNote}` : ""}
                    </p>
                  ) : null}
                </div>
                <ReviewModeration reviewId={review.id} status={review.status} productTitle={review.productTitle} />
              </li>
            ))}
          </ul>
        )}
        {reviews.rows.length > 0 ? (
          <div className="-mx-6">
            <Pagination pathname="/admin/reviews" params={params} page={reviews.page} pageCount={reviews.pageCount} total={reviews.total} noun="reviews" />
          </div>
        ) : null}
      </Panel>
    </>
  );
}
