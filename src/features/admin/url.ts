/** Search params as Next passes them to pages. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param. */
export function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `pathname` with the current params plus `updates` (null/"" removes a key).
 * Changing any filter drops `page` unless it is set explicitly.
 */
export function hrefWith(pathname: string, current: SearchParams, updates: Record<string, string | number | null | undefined>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first !== "") next.set(key, first);
  }
  if (!("page" in updates)) next.delete("page");
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are UUIDs; anything else is a 404 without a database round trip. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
