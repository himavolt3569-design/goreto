import "server-only";
import { containsPattern, quotedFilterValue, sanitizeSearch } from "../search-input";
import { adminDb, mediaUrl } from "./shared";

/*
 * Lookups for manual WhatsApp order entry. The calling actions check the
 * permission first; RLS decides what the caller sees (customers need
 * customers.read; only active products and variants are orderable).
 */

export type OrderCustomerOption = { id: string; name: string; email: string | null; phone: string | null };

export type OrderVariantOption = {
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string;
  /** A preview for picking; the order is always priced by the database. */
  pricePaisa: number;
  stock: number;
  thumbnail: string | null;
};

export type LookupResult<T> = { ok: true; results: T[] } | { ok: false; message: string };

const SEARCH_FAILED = "Search didn't work. Please try again.";

export async function searchOrderCustomers(query: unknown): Promise<LookupResult<OrderCustomerOption>> {
  const term = sanitizeSearch(query);
  if (term.length < 2) return { ok: true, results: [] };
  const pattern = quotedFilterValue(containsPattern(term));
  const digits = term.replace(/\D/g, "");
  const clauses = [`full_name.ilike.${pattern}`, `email.ilike.${quotedFilterValue(containsPattern(term.toLowerCase()))}`];
  if (digits.length >= 4) clauses.push(`phone_e164.ilike.${quotedFilterValue(containsPattern(digits))}`);

  const { data, error } = await adminDb()
    .from("profiles")
    .select("id, full_name, email, phone_e164")
    .eq("role", "customer")
    .is("deleted_at", null)
    .or(clauses.join(","))
    .order("full_name")
    .limit(8);
  if (error) {
    console.error(`Admin action failed (search order customers): ${error.code ?? "unknown"}`);
    return { ok: false, message: SEARCH_FAILED };
  }
  return {
    ok: true,
    results: data.map((row) => ({ id: row.id, name: row.full_name ?? row.email ?? "Customer", email: row.email, phone: row.phone_e164 })),
  };
}

export async function searchOrderVariants(query: unknown): Promise<LookupResult<OrderVariantOption>> {
  const term = sanitizeSearch(query);
  if (term.length < 2) return { ok: true, results: [] };

  const { data, error } = await adminDb()
    .from("products")
    .select(
      "id, title, base_price_paisa, product_media(storage_path, sort_order), product_variants(id, title, sku, price_paisa, stock_quantity, is_active)",
    )
    .eq("status", "active")
    .ilike("title", containsPattern(term))
    .order("title")
    .order("sort_order", { referencedTable: "product_media" })
    .eq("product_media.kind", "image")
    .limit(1, { referencedTable: "product_media" })
    .order("sku", { referencedTable: "product_variants" })
    .limit(10);
  if (error) {
    console.error(`Admin action failed (search order variants): ${error.code ?? "unknown"}`);
    return { ok: false, message: SEARCH_FAILED };
  }

  return {
    ok: true,
    results: data.flatMap((product) =>
      product.product_variants
        .filter((variant) => variant.is_active)
        .map((variant) => ({
          variantId: variant.id,
          productTitle: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
          pricePaisa: variant.price_paisa ?? product.base_price_paisa,
          stock: variant.stock_quantity,
          thumbnail: mediaUrl(product.product_media[0]?.storage_path),
        })),
    ),
  };
}
