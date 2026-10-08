/*
 * Daraz push messages (docs/couriers/daraz.md §5). Daraz documents only
 * marketplace message shapes, so Goreto doesn't trust any shape: it collects
 * every value under a tracking/package key and lets the history API say
 * what happened.
 */

const ID_KEYS = new Set([
  "trackingnumber",
  "tracking_number",
  "trackingno",
  "tracking_no",
  "packagecode",
  "package_code",
  "fulfillment_package_id",
  "fulfilment_package_id",
  "ofc_package_id",
]);

const ID_PATTERN = /^[A-Za-z0-9_-]{3,100}$/;

/** Tracking numbers and package codes anywhere in a pushed message, deduplicated. */
export function extractIdentifiers(payload: unknown, limit = 20): string[] {
  const found = new Set<string>();
  const visit = (value: unknown, depth: number) => {
    if (depth > 6 || found.size >= limit || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (ID_KEYS.has(key.toLowerCase()) && (typeof child === "string" || typeof child === "number")) {
        const id = String(child).trim();
        if (ID_PATTERN.test(id)) found.add(id);
      } else {
        visit(child, depth + 1);
      }
    }
  };
  visit(payload, 0);
  return [...found].slice(0, limit);
}

export const MAX_WEBHOOK_BYTES = 256 * 1024;
