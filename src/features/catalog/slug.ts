/** URL slugs as stored (lowercase words joined by single hyphens). Anything else 404s without a query. */
export function isValidSlug(value: string): boolean {
  return value.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}
