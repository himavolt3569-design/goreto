import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/*
 * Anonymous Supabase client for public storefront reads (active catalog,
 * collections, delivery options, rating aggregates). It carries no session
 * and never calls Clerk `auth()`, so catalog pages stay cacheable; RLS limits
 * it to what any shopper may see. User-scoped reads need the Clerk-token
 * client (lib/supabase/server.ts, added with the account area).
 */

let client: SupabaseClient<Database> | null = null;

export function getPublicSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }

  client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
