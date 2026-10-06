"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { PencilSimpleIcon, TrashIcon } from "@/components/ui/icons";
import { Rating } from "@/components/ui/rating";
import { deleteReviewAction, type ReviewActionResult } from "@/features/reviews/actions";
import { REVIEW_STATUS_DISPLAY, type ReviewStatus } from "@/features/reviews/schema";
import { ReviewStatusPill } from "./account-ui";

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;
const FAILED: ReviewActionResult = { ok: false, message: "Something went wrong. Check your connection and try again." };

/** One of the customer's own reviews, ready for display (dates formatted on the server). */
export type AccountReviewView = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  dateLabel: string;
  product: { title: string; slug: string; isActive: boolean };
};

export function AccountReviewList({ reviews }: { reviews: AccountReviewView[] }) {
  return (
    <ul aria-label="Your reviews" className="flex flex-col gap-4">
      {reviews.map((review) => (
        <li key={review.id}>
          <AccountReviewItem review={review} />
        </li>
      ))}
    </ul>
  );
}

/** A review with its moderation state, Edit and Delete (confirmed in a dialog). Staff notes are never shown. */
function AccountReviewItem({ review }: { review: AccountReviewView }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const productHref = `/products/${review.product.slug}`;

  function remove() {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteReviewAction(review.id).catch(() => FAILED);
      dialogRef.current?.close();
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h3 text-neutral-900">
            {review.product.isActive ? (
              <Link href={productHref} className="rounded-xs hover:text-primary-600">
                {review.product.title}
              </Link>
            ) : (
              review.product.title
            )}
          </h2>
          <p className="text-small text-neutral-500">{review.dateLabel}</p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <ReviewStatusPill status={review.status} />
          <p className="text-small text-neutral-500">{REVIEW_STATUS_DISPLAY[review.status].hint}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rating variant="stars" value={review.rating} />
        {review.title ? <p className="text-body font-semibold text-neutral-900">{review.title}</p> : null}
        <p className="whitespace-pre-line break-words text-body text-neutral-700">{review.body}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {review.product.isActive ? (
          <Link
            href={`/account/reviews/${review.product.slug}`}
            aria-label={`Edit your review of ${review.product.title}`}
            className={buttonClasses({ variant: "tertiary", size: "md" })}
          >
            <PencilSimpleIcon {...iconProps} />
            Edit
          </Link>
        ) : null}
        <Button
          type="button"
          variant="tertiary"
          size="md"
          leadingIcon={<TrashIcon {...iconProps} />}
          aria-label={`Delete your review of ${review.product.title}`}
          onClick={() => dialogRef.current?.showModal()}
        >
          Delete
        </Button>
      </div>

      {message ? (
        <p role="alert" className="text-small text-error-700">
          {message}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/50"
      >
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-h2 text-neutral-900">
              Delete this review?
            </h2>
            <p className="text-body text-neutral-500">
              Your review of {review.product.title} will be removed{review.status === "published" ? " from the product page" : ""}.
              {review.product.isActive ? " You can write a new one later." : null}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className={buttonClasses({ variant: "tertiary", size: "md" })}>
              Keep it
            </button>
            <Button type="button" variant="primary" size="md" loading={pending} onClick={remove}>
              Delete review
            </Button>
          </div>
        </div>
      </dialog>
    </Card>
  );
}
