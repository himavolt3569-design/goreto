import { z } from "zod";

/*
 * Review form rules (AGENTS §11.4). Client-safe: the form and the Server
 * Action parse the same schema, and submit_review checks the same limits in
 * SQL (migration product_reviews).
 */

export const REVIEW_TITLE_MAX = 120;
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;

export const reviewFormSchema = z.object({
  /** Radio values are strings; "" means no star chosen yet. */
  rating: z
    .string()
    .regex(/^[1-5]$/, "Choose a star rating")
    .transform(Number),
  title: z.string().trim().max(REVIEW_TITLE_MAX, `Use up to ${REVIEW_TITLE_MAX} characters`),
  body: z
    .string()
    .trim()
    .min(REVIEW_BODY_MIN, `Write at least ${REVIEW_BODY_MIN} characters`)
    .max(REVIEW_BODY_MAX, `Use up to ${REVIEW_BODY_MAX} characters`),
});

export type ReviewFormValues = z.input<typeof reviewFormSchema>;
export type ReviewFormData = z.output<typeof reviewFormSchema>;

export type ReviewStatus = "pending" | "published" | "rejected";

export type ReviewFailure = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<keyof ReviewFormValues, string>>;
};

/** Maps a submit_review error (SQLSTATE + message) to what the customer sees. */
export function reviewFailureFromError(error: { code?: string; message: string }): ReviewFailure {
  if (error.code === "42501" && error.message.includes("not_a_verified_buyer")) {
    return { ok: false, message: "You can review this product once an order with it has been delivered to you." };
  }
  if (error.code === "42501") return { ok: false, message: "Your session has ended. Sign in again to write a review." };
  if (error.code === "P0002") return { ok: false, message: "This product is no longer available to review." };
  if (error.code === "22023") {
    if (error.message.includes("invalid_rating")) return { ok: false, message: "Check the highlighted fields.", fieldErrors: { rating: "Choose a star rating" } };
    if (error.message.includes("invalid_title")) {
      return { ok: false, message: "Check the highlighted fields.", fieldErrors: { title: `Use up to ${REVIEW_TITLE_MAX} characters` } };
    }
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { body: `Use ${REVIEW_BODY_MIN} to ${REVIEW_BODY_MAX} characters` },
    };
  }
  return { ok: false, message: "Your review couldn't be saved. Please try again." };
}

/** Customer-facing moderation state. The staff note is never shown. */
export const REVIEW_STATUS_DISPLAY: Record<ReviewStatus, { label: string; tone: "warning" | "success" | "error"; hint: string }> = {
  pending: { label: "Awaiting approval", tone: "warning", hint: "We check every review before it appears on the product page." },
  published: { label: "Published", tone: "success", hint: "Shown on the product page." },
  rejected: { label: "Not published", tone: "error", hint: "It didn't meet our review guidelines." },
};
