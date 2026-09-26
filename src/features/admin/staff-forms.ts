import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { z } from "zod";
import { STAFF_PERMISSION_KEYS } from "./staff-permissions";

/*
 * Inputs for the staff actions (admin phase 4). The permission checkboxes
 * share one name, so the action joins `getAll("permissions")` with commas
 * before parsing (formValues keeps only the last value per name).
 */

const id = z.uuid();

export const staffInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter an email address")
    .max(254, "Use at most 254 characters")
    .pipe(z.email("Enter a valid email address")),
  permissions: z
    .string()
    .default("")
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(z.enum(STAFF_PERMISSION_KEYS, "Unknown permission")))
    .transform((keys) => [...new Set(keys)]),
});

export type StaffInviteInput = z.infer<typeof staffInviteSchema>;

export const invitationIdSchema = z.object({ invitationId: id });
export const staffMemberIdSchema = z.object({ profileId: id });

/** FormData with the repeated `permissions` checkboxes joined into one value. */
export function withJoinedPermissions(formData: FormData): FormData {
  const joined = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key !== "permissions" && typeof value === "string") joined.append(key, value);
  }
  joined.set(
    "permissions",
    formData
      .getAll("permissions")
      .filter((value): value is string => typeof value === "string")
      .join(","),
  );
  return joined;
}

/**
 * The invitation's sign-up URL. In production only the configured site
 * origin is trusted; the request Origin is a fallback for development only.
 * Null when no usable origin exists.
 */
export function invitationSignUpUrl({
  configured,
  requestOrigin,
  isProduction,
}: {
  configured: string | undefined;
  requestOrigin: string | null;
  isProduction: boolean;
}): string | null {
  const origin = configured?.trim() || (isProduction ? null : requestOrigin);
  if (!origin) return null;
  try {
    return new URL("/sign-up", origin).toString();
  } catch {
    return null;
  }
}

export type ClerkInviteFailure = "exists" | "rate_limited" | "unknown";

/**
 * Classifies a Clerk Backend API error from createInvitation. Clerk refuses
 * an email that already has an account or an open invitation.
 */
export function classifyClerkInviteError(error: unknown): ClerkInviteFailure {
  if (!isClerkAPIResponseError(error)) return "unknown";
  if (error.status === 429) return "rate_limited";
  const codes = error.errors.map((item) => item.code);
  if (codes.some((code) => code === "form_identifier_exists" || code === "duplicate_record")) return "exists";
  return "unknown";
}

export const CLERK_INVITE_MESSAGES: Record<ClerkInviteFailure, string> = {
  exists:
    "This email already has an account (or an open invitation in Clerk) that isn't verified here yet. Ask them to sign in and verify their email, then invite them again.",
  rate_limited: "Too many invitations were sent in the last hour. Try again later.",
  unknown: "The invitation email couldn't be sent. Please try again.",
};
