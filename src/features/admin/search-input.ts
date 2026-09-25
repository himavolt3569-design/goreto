/*
 * Admin search text (AGENTS §13): bounded and reduced to characters that can
 * appear in names, emails, SKUs and order numbers, so nothing typed can reach
 * PostgREST filter syntax. Queries still pass it as a parameter value.
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

/** `%term%` for ilike, with the LIKE wildcards in the term escaped. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** Order numbers are stored upper-case (GT2609241234); searches may be typed with a "#". */
export function orderNumberTerm(term: string): string | null {
  const candidate = term.replace(/^#/, "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{0,4}\d{3,14}$|^[A-Z]{2,4}\d{0,14}$/.test(candidate) ? candidate : null;
}

/**
 * A sanitised value as a double-quoted item in a PostgREST `or()` list.
 * Inside quotes PostgREST unescapes backslashes, so the LIKE escapes are doubled.
 */
export function quotedFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (character) => `\\${character}`)}"`;
}
