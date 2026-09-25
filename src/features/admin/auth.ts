import "server-only";
import { notFound } from "next/navigation";
import { authorize, requireAdmin, type Authorization } from "@/lib/auth/profile";
import type { CurrentProfile } from "@/lib/auth/permissions";
import { canAccess, type AdminAccess } from "./nav";

/*
 * Admin access checks for pages and Server Actions, in the vocabulary of the
 * admin nav ("admin" | "owner" | a staff permission). RLS stays the final
 * enforcement; these fail early with a 404 (pages) or a clear message
 * (actions).
 */

/** For admin pages: 404 unless the signed-in owner/staff member has `access`. */
export async function requireAdminAccess(access: AdminAccess): Promise<CurrentProfile> {
  const profile = await requireAdmin();
  if (!canAccess(profile, access)) notFound();
  return profile;
}

/** For admin Server Actions. With several accesses, any one of them is enough. */
export async function authorizeAdmin(access: AdminAccess | readonly AdminAccess[]): Promise<Authorization> {
  const result = await authorize();
  if (!result.ok) return result;
  const accesses: readonly AdminAccess[] = typeof access === "string" ? [access] : access;
  if (!accesses.some((item) => canAccess(result.profile, item))) return { ok: false, reason: "forbidden" };
  return result;
}

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function deniedResult(reason: "unauthenticated" | "forbidden"): ActionResult {
  return {
    ok: false,
    message:
      reason === "unauthenticated"
        ? "Your session has ended. Sign in again to continue."
        : "You don't have permission to do that.",
  };
}

/**
 * Maps a Supabase/Postgres error to a message staff can act on. The admin
 * functions raise readable messages for invalid transitions (22023); other
 * failures get a generic message and are logged without request data.
 */
export function databaseErrorResult(error: { code?: string; message: string }, action: string): ActionResult {
  if (error.code === "22023" || error.code === "23514") return { ok: false, message: error.message };
  if (error.code === "42501") return { ok: false, message: "You don't have permission to do that." };
  if (error.code === "P0002") return { ok: false, message: "That record no longer exists. Refresh the page." };
  if (error.code === "23505") return { ok: false, message: "That change conflicts with an existing record." };
  console.error(`Admin action failed (${action}): ${error.code ?? "unknown"}`);
  return { ok: false, message: "Something went wrong. Please try again." };
}
