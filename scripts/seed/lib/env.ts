import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Environment for the seed loader and purge. Run through npm scripts, which
 * pass `--env-file-if-exists=.env.local`. Values are never printed.
 *
 * These scripts use the service-role key: they are trusted, local, one-off
 * development tools. Nothing under `src/` may import this module.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  }
  return value;
}

/** Refuses to touch any database that isn't explicitly marked as development. */
export function assertDevelopmentTarget(): void {
  if (process.env.GORETO_DATA_ENV !== "development") {
    throw new Error(
      "Refusing to run: GORETO_DATA_ENV must be 'development'. " +
        "The seed is development data and must never reach production.",
    );
  }
}

export function createServiceClient(): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Host only, for log lines that confirm the target without leaking keys. */
export function targetHost(): string {
  return new URL(required("NEXT_PUBLIC_SUPABASE_URL")).host;
}

export const MEDIA_BUCKET = "product-media";
