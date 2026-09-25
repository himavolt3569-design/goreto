import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/*
 * User-context Supabase client (AGENTS §9.4, §10.8). Every request carries the
 * signed-in user's Clerk session token, which Supabase accepts through
 * third-party auth, so RLS resolves `auth.jwt()->>'sub'` to their profile.
 * Signed out, Clerk returns no token and the request runs as `anon`.
 *
 * Supabase is not the auth provider: no cookies, no @supabase/ssr, no stored
 * session. Clerk refreshes its token; `getToken()` runs per request.
 *
 * Calling this makes the route dynamic (it reads `auth()`); keep public
 * catalog reads on lib/supabase/public.ts.
 */
export const getUserSupabase = cache((): SupabaseClient<Database> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }

  return createClient<Database>(url, anonKey, {
    accessToken: async () => (await auth()).getToken(),
  });
});
