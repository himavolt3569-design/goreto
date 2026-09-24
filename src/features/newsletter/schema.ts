import { z } from "zod";

export const newsletterSchema = z.object({
  email: z
    .string({ error: "Enter your email address." })
    .trim()
    .min(1, { error: "Enter your email address." })
    .max(254, { error: "That email address is too long." })
    .pipe(z.email({ error: "Enter a valid email address, like you@example.com." })),
});

export type NewsletterState =
  | { status: "idle" }
  | { status: "error"; message: string; email: string }
  | { status: "success"; message: string };

export const initialNewsletterState: NewsletterState = { status: "idle" };

export const NEWSLETTER_UNAVAILABLE_MESSAGE =
  "Thanks! Newsletter signups open soon — we haven't stored your email yet.";
