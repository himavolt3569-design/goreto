import "server-only";
import { getUserSupabase } from "@/lib/supabase/server";
import { productMediaUrl } from "@/lib/media/storage";

/*
 * Admin reads run through the Clerk-token client, so RLS scopes every row to
 * what the signed-in staff member may see. Queries throw on error; the admin
 * error boundary shows a retry state.
 */

export const PAGE_SIZE = 20;

export function adminDb() {
  return getUserSupabase();
}

export function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Admin query failed (${what}): ${error.code ?? ""} ${error.message}`.trim());
}

/** `?page=` as a 1-based page number (invalid or missing -> 1). */
export function pageNumber(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value >= 1 && value <= 10_000 ? value : 1;
}

/** Inclusive row range for `.range()`. */
export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  const start = (page - 1) * size;
  return [start, start + size - 1];
}

export type Page<T> = { rows: T[]; total: number; page: number; pageCount: number };

export function toPage<T>(rows: T[], total: number | null, page: number, size = PAGE_SIZE): Page<T> {
  const count = total ?? rows.length;
  return { rows, total: count, page, pageCount: Math.max(1, Math.ceil(count / size)) };
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
