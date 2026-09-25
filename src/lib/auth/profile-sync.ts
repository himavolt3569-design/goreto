import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { ClerkProfileInput } from "./clerk-user";

/*
 * Trusted writes to `profiles` from Clerk (AGENTS §9.4): the verified webhook
 * and the lazy upsert on a user's first request. The SQL functions own the
 * ordering, tombstone and role rules (migration clerk_profile_sync) and are
 * executable by the service role only.
 */

type SyncArgs = Database["public"]["Functions"]["sync_clerk_profile"]["Args"];
/** The generated types can't express nullable SQL arguments; these accept null. */
type NullableSyncArgs = {
  [Key in keyof SyncArgs]: Key extends "p_email" | "p_full_name" | "p_phone_e164" ? string | null : SyncArgs[Key];
};

/** Applies a Clerk user snapshot. Returns the active profile id, or null if the user was deleted. */
export async function syncClerkProfile(input: ClerkProfileInput): Promise<string | null> {
  const args: NullableSyncArgs = {
    p_clerk_user_id: input.clerkUserId,
    p_email: input.email,
    p_full_name: input.fullName,
    p_phone_e164: input.phoneE164,
    p_clerk_updated_at: input.clerkUpdatedAt.toISOString(),
  };
  const { data, error } = await getAdminSupabase().rpc("sync_clerk_profile", args as SyncArgs);
  if (error) throw new Error(`sync_clerk_profile failed: ${error.message}`);
  return data ?? null;
}

/** Anonymizes a deleted Clerk user's profile. Safe to repeat. */
export async function markClerkProfileDeleted(clerkUserId: string): Promise<void> {
  const { error } = await getAdminSupabase().rpc("mark_clerk_profile_deleted", {
    p_clerk_user_id: clerkUserId,
  });
  if (error) throw new Error(`mark_clerk_profile_deleted failed: ${error.message}`);
}
