import "server-only";
import { getUserSupabase } from "@/lib/supabase/server";
import { productMediaUrl } from "@/lib/media/storage";

/*
 * Admin reads run through the Clerk-token client, so RLS scopes every row to
 * what the signed-in staff member may see. Queries throw on error; the admin
 * error boundary shows a retry state.
 */

export { DEFAULT_PAGE_SIZE as PAGE_SIZE, pageNumber, pageRange, toPage, type Page } from "@/lib/pagination/page";

export function adminDb() {
  return getUserSupabase();
}

export function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Admin query failed (${what}): ${error.code ?? ""} ${error.message}`.trim());
}

/** One of `allowed`, or null. For enum filters from search params. */
export function pickEnum<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return allowed.includes(value as T) ? (value as T) : null;
}

/** Public product-media URL for a stored key, or null. Never throws on bad keys. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    return productMediaUrl(path);
  } catch {
    return null;
  }
}
