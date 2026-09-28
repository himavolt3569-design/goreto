/*
 * Admin search helpers. The text itself is bounded by the shared
 * sanitizeSearch (lib/validation/search.ts); these build LIKE patterns and
 * PostgREST filter values from it.
 */

export { SEARCH_MAX_LENGTH, sanitizeSearch } from "@/lib/validation/search";

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
