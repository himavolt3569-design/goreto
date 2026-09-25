import "server-only";
import type { OrderStatus } from "../order-transitions";
import { containsPattern, orderNumberTerm, quotedFilterValue } from "../search-input";
import { adminDb, fail, mediaUrl } from "./shared";

/*
 * Header search (/admin/search). Each group runs only when the viewer has its
 * permission; the term is already sanitised (search-input.ts).
 */

const LIMIT = 8;

export type ProductHit = { id: string; title: string; status: string; thumbnail: string | null; matchedSku: string | null };
export type OrderHit = { orderNumber: string; contactName: string; status: OrderStatus; totalPaisa: number; createdAt: string };
export type CustomerHit = { id: string; fullName: string | null; email: string | null };

export async function searchProducts(term: string): Promise<ProductHit[]> {
  const pattern = containsPattern(term);
  const [byTitle, bySku] = await Promise.all([
    adminDb()
      .from("products")
      .select("id, title, status, product_media(storage_path, sort_order)")
      .ilike("title", pattern)
      .order("sort_order", { referencedTable: "product_media" })
      .limit(1, { referencedTable: "product_media" })
      .order("title")
      .limit(LIMIT),
    adminDb()
      .from("product_variants")
      .select("sku, products(id, title, status)")
      .ilike("sku", containsPattern(term.toUpperCase()))
      .order("sku")
      .limit(LIMIT),
  ]);
  if (byTitle.error) fail("product search", byTitle.error);
  if (bySku.error) fail("sku search", bySku.error);

  const hits = new Map<string, ProductHit>();
  for (const row of byTitle.data) {
    hits.set(row.id, { id: row.id, title: row.title, status: row.status, thumbnail: mediaUrl(row.product_media[0]?.storage_path), matchedSku: null });
  }
  for (const row of bySku.data) {
    if (row.products && !hits.has(row.products.id)) {
      hits.set(row.products.id, { id: row.products.id, title: row.products.title, status: row.products.status, thumbnail: null, matchedSku: row.sku });
    }
  }
  return [...hits.values()].slice(0, LIMIT);
}

export async function searchOrders(term: string): Promise<OrderHit[]> {
  const number = orderNumberTerm(term);
  const pattern = containsPattern(term);
  const clauses = [`contact_name.ilike.${quotedFilterValue(pattern)}`, `contact_email.ilike.${quotedFilterValue(pattern.toLowerCase())}`];
  if (number) clauses.push(`order_number.ilike.${quotedFilterValue(containsPattern(number))}`);
  const { data, error } = await adminDb()
    .from("orders")
    .select("order_number, contact_name, status, total_paisa, created_at")
    .or(clauses.join(","))
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) fail("order search", error);
  return data.map((row) => ({
    orderNumber: row.order_number,
    contactName: row.contact_name,
    status: row.status,
    totalPaisa: row.total_paisa,
    createdAt: row.created_at,
  }));
}

export async function searchCustomers(term: string): Promise<CustomerHit[]> {
  const pattern = containsPattern(term);
  const { data, error } = await adminDb()
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "customer")
    .is("deleted_at", null)
    .or(`full_name.ilike.${quotedFilterValue(pattern)},email.ilike.${quotedFilterValue(pattern.toLowerCase())}`)
    .order("full_name")
    .limit(LIMIT);
  if (error) fail("customer search", error);
  return data.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email }));
}
