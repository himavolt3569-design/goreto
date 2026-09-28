/*
 * Search text (AGENTS §13), shared by the storefront and the admin: bounded
 * and reduced to characters that can appear in names, emails, SKUs and order
 * numbers, so nothing typed can reach PostgREST filter syntax. Queries still
 * pass it as a parameter value.
 */

export const SEARCH_MAX_LENGTH = 64;

export function sanitizeSearch(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@._+'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim();
}
