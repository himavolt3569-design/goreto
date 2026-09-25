import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserSupabase } from "@/lib/supabase/server";
import { profileInputFromClerkUser } from "./clerk-user";
import { profileHasPermission, type CurrentProfile, type StaffPermission } from "./permissions";
import { syncClerkProfile } from "./profile-sync";

/*
 * The signed-in user's Goreto profile (AGENTS §9). Read through the
 * user-context client, so RLS itself proves the Clerk token reaches Postgres.
 * The proxy only authenticates; pages, Server Actions and route handlers use
 * these helpers to authorize against the database.
 */

async function readOwnProfile(clerkUserId: string): Promise<CurrentProfile | null> {
  const { data, error } = await getUserSupabase()
    .from("profiles")
    .select("id, clerk_user_id, full_name, email, role, staff_permissions!staff_permissions_profile_id_fkey(permission_key)")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the signed-in profile: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    clerkUserId: data.clerk_user_id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    permissions: data.staff_permissions.map((row) => row.permission_key),
  };
}

/**
 * The current user's profile, or null when signed out. Creates the profile on
 * first use if the Clerk webhook hasn't delivered yet, so a new customer is
 * never blocked on it. Memoized per request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await readOwnProfile(userId);
  if (existing) return existing;

  const user = await currentUser();
  if (!user) return null;
  const parsed = profileInputFromClerkUser(user.raw);
  if (!parsed.ok) throw new Error(`Unexpected Clerk user shape (${parsed.error})`);

  // Null means the profile was deleted; treat the session as having no profile.
  if (!(await syncClerkProfile(parsed.input))) return null;

  const synced = await readOwnProfile(userId);
  if (!synced) {
    // The row exists but RLS can't see it: the Clerk token isn't reaching
    // Postgres as this user (third-party auth or the role claim is missing).
    throw new Error("Profile synced but not visible to the signed-in session; check Supabase third-party auth for Clerk.");
  }
  return synced;
});

/**
 * For pages: the signed-in profile. Signed-out users go to sign-in; a
 * signed-in user without a profile (deleted account) gets a 404 rather than
 * a sign-in redirect that would bounce straight back.
 */
export async function requireProfile(): Promise<CurrentProfile> {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const profile = await getCurrentProfile();
  if (!profile) notFound();
  return profile;
}

export type Authorization =
  | { ok: true; profile: CurrentProfile }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * For Server Actions and route handlers: map `unauthenticated` to 401 and
 * `forbidden` to 403. Without a permission, any signed-in profile passes.
 */
export async function authorize(permission?: StaffPermission): Promise<Authorization> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, reason: "unauthenticated" };
  if (permission && !profileHasPermission(profile, permission)) return { ok: false, reason: "forbidden" };
  return { ok: true, profile };
}

/**
 * For pages: signed-out users go to sign-in; signed-in users without the
 * permission get a 404, so admin surfaces aren't revealed.
 */
export async function requirePermission(permission: StaffPermission): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!profileHasPermission(profile, permission)) notFound();
  return profile;
}

/**
 * For the admin area: the owner or any staff member. Customers get a 404 so
 * the admin surface isn't revealed; each page still checks its own permission.
 */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== "owner" && profile.role !== "staff") notFound();
  return profile;
}

/** For pages only the owner may open (e.g. staff management). */
export async function requireOwner(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== "owner") notFound();
  return profile;
}
