"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { databaseErrorResult, type ActionResult } from "../auth";
import { adminDb } from "../queries/shared";
import {
  CLERK_INVITE_MESSAGES,
  classifyClerkInviteError,
  invitationIdSchema,
  staffInviteSchema,
  staffMemberIdSchema,
  withJoinedPermissions,
} from "../staff-forms";
import { authorizeAndParse, NOT_UPDATED } from "./helpers";

/*
 * Staff invitations and role changes (admin phase 4, owner only, AGENTS §9.2).
 * Postgres is the authority: a Clerk invitation only delivers the sign-up
 * link, and the profile sync grants staff access from `staff_invitations`
 * once Clerk has verified the email. CLERK_SECRET_KEY stays in this server
 * module; no service-role key is used.
 */

const INVITE_EXPIRY_DAYS = 7;

/** Where the invitation link lands: the configured site, else this request's origin. */
async function signUpUrl(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = configured || (await headers()).get("origin");
  if (!origin) return null;
  try {
    return new URL("/sign-up", origin).toString();
  } catch {
    return null;
  }
}

export async function inviteStaffAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("owner", staffInviteSchema, withJoinedPermissions(formData));
  if (!input.ok) return input.result;
  const { email, permissions } = input.data;
  const db = adminDb();

  // profiles.email holds only Clerk-verified addresses, so a match is proven.
  const { data: existing, error: existingError } = await db
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existingError) return databaseErrorResult(existingError, "look up invitee");

  if (existing) {
    if (existing.role !== "customer") {
      return { ok: false, message: "Already on the team.", fieldErrors: { email: "Already on the team." } };
    }
    const { error } = await db.rpc("admin_set_staff_role", { p_profile_id: existing.id, p_role: "staff", p_permissions: permissions });
    if (error) return databaseErrorResult(error, "promote customer");
    refresh();
    return { ok: true, message: `${email} already had an account, so they have staff access now.` };
  }

  const redirectUrl = await signUpUrl();
  if (!redirectUrl) {
    console.error("Staff invite: no NEXT_PUBLIC_SITE_URL and no request origin");
    return { ok: false, message: CLERK_INVITE_MESSAGES.unknown };
  }

  const { data: invitation, error: insertError } = await db
    .from("staff_invitations")
    .insert({ email, permissions, invited_by: input.profileId })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const message = "An invitation is already pending for this email.";
      return { ok: false, message, fieldErrors: { email: message } };
    }
    return databaseErrorResult(insertError, "create staff invitation");
  }

  let clerkInvitationId: string;
  try {
    const clerk = await clerkClient();
    const sent = await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl,
      expiresInDays: INVITE_EXPIRY_DAYS,
      notify: true,
    });
    clerkInvitationId = sent.id;
  } catch (error) {
    const failure = classifyClerkInviteError(error);
    if (failure === "unknown") console.error("Staff invite: Clerk createInvitation failed");
    // Never sent, so the pending slot is freed (RLS allows deleting unsent rows only).
    await db.from("staff_invitations").delete().eq("id", invitation.id);
    const message = CLERK_INVITE_MESSAGES[failure];
    return { ok: false, message, fieldErrors: failure === "exists" ? { email: message } : undefined };
  }

  const { error: attachError } = await db
    .from("staff_invitations")
    .update({ clerk_invitation_id: clerkInvitationId })
    .eq("id", invitation.id);
  // The email is already out and the row still grants access; only revoking in Clerk needs the id.
  if (attachError) console.error(`Staff invite: couldn't store the Clerk invitation id (${attachError.code ?? "unknown"})`);

  refresh();
  return { ok: true, message: `Invitation sent to ${email}. It expires in ${INVITE_EXPIRY_DAYS} days.` };
}

export async function revokeInvitationAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("owner", invitationIdSchema, formData);
  if (!input.ok) return input.result;

  // The database first: once revoked here, the invitation grants nothing.
  const { data, error } = await adminDb()
    .from("staff_invitations")
    .update({ status: "revoked" })
    .eq("id", input.data.invitationId)
    .eq("status", "pending")
    .select("clerk_invitation_id");
  if (error) return databaseErrorResult(error, "revoke staff invitation");
  if (data.length !== 1) return NOT_UPDATED;

  const clerkInvitationId = data[0]!.clerk_invitation_id;
  refresh();
  if (!clerkInvitationId) return { ok: true, message: "Invitation revoked." };

  try {
    const clerk = await clerkClient();
    await clerk.invitations.revokeInvitation(clerkInvitationId);
  } catch {
    console.error("Staff invite: Clerk revokeInvitation failed");
    return { ok: true, message: "Invitation revoked. The email link may still open, but it won't give staff access." };
  }
  return { ok: true, message: "Invitation revoked." };
}

export async function removeStaffAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("owner", staffMemberIdSchema, formData);
  if (!input.ok) return input.result;

  const { error } = await adminDb().rpc("admin_set_staff_role", { p_profile_id: input.data.profileId, p_role: "customer" });
  if (error) return databaseErrorResult(error, "remove staff member");

  refresh();
  return { ok: true };
}
