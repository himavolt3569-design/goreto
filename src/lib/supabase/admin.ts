import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/*
 * Service-role client: bypasses RLS. Only for trusted work no user token can
 * do, currently the Clerk -> profiles sync (lib/auth/profile-sync.ts, which is
 * the only allowed importer; boundaries.test.ts enforces it). Never use it to
 * read data on a user's behalf; use lib/supabase/server.ts for that.
 */

let client: SupabaseClient<Database> | null = null;

export function getAdminSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin access is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
  }

  client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
