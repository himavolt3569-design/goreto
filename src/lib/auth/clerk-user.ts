import { z } from "zod";

/*
 * Maps a Clerk user (the `UserJSON` shape sent by `user.*` webhooks, returned
 * by the Backend API, and exposed as `User.raw` by `currentUser()`) to the
 * fields Goreto keeps on `profiles`. Pure and dependency-light so the owner
 * bootstrap script can import it by relative path.
 *
 * Only a **verified** primary email is kept: later flows (guest-order
 * claiming, AGENTS §9.1) rely on `profiles.email` being proven.
 */

/** Matches the `profiles.phone_e164` check constraint. */
const E164 = /^\+[1-9][0-9]{7,14}$/;

const verificationSchema = z.object({ status: z.string() }).nullable().optional();

const clerkUserJsonSchema = z.object({
  id: z.string().min(1),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  primary_email_address_id: z.string().nullable().optional(),
  email_addresses: z
    .array(z.object({ id: z.string(), email_address: z.string(), verification: verificationSchema }))
    .default([]),
  primary_phone_number_id: z.string().nullable().optional(),
  phone_numbers: z
    .array(z.object({ id: z.string(), phone_number: z.string(), verification: verificationSchema }))
    .default([]),
  updated_at: z.number().int().nonnegative(),
});

export type ClerkProfileInput = {
  clerkUserId: string;
  email: string | null;
  fullName: string | null;
  phoneE164: string | null;
  /** Clerk's `updated_at`; older snapshots are ignored by the database. */
  clerkUpdatedAt: Date;
};

export type ClerkUserParseResult =
  | { ok: true; input: ClerkProfileInput }
  | { ok: false; error: string };

export function profileInputFromClerkUser(data: unknown): ClerkUserParseResult {
  const parsed = clerkUserJsonSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.path.join(".")).join(", ") };
  }
  const user = parsed.data;

  const primaryEmail = user.email_addresses.find((email) => email.id === user.primary_email_address_id);
  const email =
    primaryEmail?.verification?.status === "verified"
      ? primaryEmail.email_address.trim().toLowerCase()
      : null;

  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  const primaryPhone = user.phone_numbers.find((phone) => phone.id === user.primary_phone_number_id);
  const phone = primaryPhone?.phone_number.trim();

  return {
    ok: true,
    input: {
      clerkUserId: user.id,
      email: email || null,
      fullName: fullName || null,
      phoneE164: phone && E164.test(phone) ? phone : null,
      clerkUpdatedAt: new Date(user.updated_at),
    },
  };
}
