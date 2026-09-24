"use server";

import {
  NEWSLETTER_UNAVAILABLE_MESSAGE,
  newsletterSchema,
  type NewsletterState,
} from "./schema";

/**
 * Validates a newsletter signup. There is no subscribers table yet, so the
 * email is not persisted and the response says so honestly. Swap the success
 * branch for an insert once the table and its RLS exist.
 */
export async function subscribeToNewsletter(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const raw = formData.get("email");
  const parsed = newsletterSchema.safeParse({
    email: typeof raw === "string" ? raw : undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      email: typeof raw === "string" ? raw.slice(0, 254) : "",
    };
  }

  return { status: "success", message: NEWSLETTER_UNAVAILABLE_MESSAGE };
}
