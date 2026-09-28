"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "@/types/database";

/*
 * Browser Supabase client for live updates (AGENTS §9.4): the public anon
 * key plus the signed-in user's Clerk session token, so RLS (and Realtime,
 * which applies the same RLS) sees exactly that user. The Realtime socket
 * asks `accessToken` again on every heartbeat, so the short-lived Clerk
 * token stays fresh. No service key, no Supabase auth session or cookies.
 *
 * The only client-side Supabase module (boundaries.test.ts). Reads and
 * writes still go through Server Components and Server Actions.
 */
export function useBrowserSupabase(): SupabaseClient<Database> | null {
  const { session } = useSession();

  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!session || !url || !anonKey) return null;
    return createClient<Database>(url, anonKey, {
      accessToken: async () => (await session.getToken()) ?? null,
    });
  }, [session]);
}
