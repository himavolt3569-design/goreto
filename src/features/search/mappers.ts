import type { CardRow } from "@/features/catalog/mappers";
import type { Database } from "@/types/database";

export type SearchRow = Database["public"]["Functions"]["search_products"]["Returns"][number];

/**
 * A `search_products` row in the catalog's card shape, so search results go
 * through the same card mapping as category pages. The cover comes from a
 * left join, so it can be null despite the generated type.
 */
export function toCardRow(row: SearchRow): CardRow {
  const coverPath = row.cover_path as string | null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category_id: row.category_id,
    base_price_paisa: row.base_price_paisa,
    is_bestseller: row.is_bestseller,
    is_limited_edition: row.is_limited_edition,
    published_at: row.published_at,
    product_media: coverPath ? [{ storage_path: coverPath, alt_text: row.cover_alt ?? "" }] : [],
  };
}
