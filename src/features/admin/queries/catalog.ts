import "server-only";
import type { Database } from "@/types/database";
import { containsPattern, quotedFilterValue } from "../search-input";
import { stockStateFor, type StockState } from "../states";

export { stockStateFor, type StockState };
import { adminDb, fail, mediaUrl, PAGE_SIZE, pageRange, toPage, type Page } from "./shared";

/* Catalog, inventory, media and AR reads for the admin panel (RLS: catalog.read). */

export type ProductStatus = Database["public"]["Enums"]["product_status"];

export type AdminProductRow = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  categoryTitle: string | null;
  pricePaisa: number;
  totalStock: number;
  /** Worst state across active variants, against the product's low-stock threshold. */
  stockState: StockState;
  thumbnail: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  updatedAt: string;
};

const PRODUCT_ROW_SELECT =
  "id, title, slug, status, base_price_paisa, low_stock_threshold, is_featured, is_bestseller, updated_at, categories(title), product_variants(stock_quantity, is_active), product_media(storage_path, sort_order)";

type ProductRowData = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  base_price_paisa: number;
  low_stock_threshold: number;
  is_featured: boolean;
  is_bestseller: boolean;
  updated_at: string;
  categories: { title: string } | null;
  product_variants: { stock_quantity: number; is_active: boolean }[];
  product_media: { storage_path: string; sort_order: number }[];
};

function toProductRow(row: ProductRowData): AdminProductRow {
  const active = row.product_variants.filter((variant) => variant.is_active);
  const stocks = active.map((variant) => variant.stock_quantity);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    categoryTitle: row.categories?.title ?? null,
    pricePaisa: row.base_price_paisa,
    totalStock: stocks.reduce((sum, stock) => sum + stock, 0),
    stockState: stockStateFor(stocks, row.low_stock_threshold),
    thumbnail: mediaUrl(row.product_media[0]?.storage_path),
    isFeatured: row.is_featured,
    isBestseller: row.is_bestseller,
    updatedAt: row.updated_at,
  };
}

export type ProductFilter = { q: string; status: ProductStatus | null; categoryId: string | null; page: number };

export async function fetchAdminProducts(filter: ProductFilter): Promise<Page<AdminProductRow>> {
  let query = adminDb()
    .from("products")
    .select(PRODUCT_ROW_SELECT, { count: "exact" })
    .order("sort_order", { referencedTable: "product_media" })
    .limit(1, { referencedTable: "product_media" })
    .order("updated_at", { ascending: false })
    .order("id");
  if (filter.q) query = query.ilike("title", containsPattern(filter.q));
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  const { data, error, count } = await query.range(...pageRange(filter.page));
  if (error) fail("products", error);
  return toPage((data as ProductRowData[]).map(toProductRow), count, filter.page);
}

/** Dashboard "Product Management": most recently updated products. */
export async function fetchRecentProducts(limit = 5): Promise<AdminProductRow[]> {
  const { data, error } = await adminDb()
    .from("products")
    .select(PRODUCT_ROW_SELECT)
    .order("sort_order", { referencedTable: "product_media" })
    .limit(1, { referencedTable: "product_media" })
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) fail("recent products", error);
  return (data as ProductRowData[]).map(toProductRow);
}

export async function fetchProductDetail(productId: string) {
  const { data, error } = await adminDb()
    .from("products")
    .select(
      `id, title, slug, status, short_description, description, base_price_paisa, compare_at_price_paisa,
       low_stock_threshold, is_featured, is_bestseller, is_limited_edition, tags, specs, care_instructions,
       published_at, archived_at, created_at, updated_at, categories(title, slug),
       product_variants(id, sku, title, option_values, price_paisa, stock_quantity, is_active, sort_order),
       product_media(id, storage_path, alt_text, sort_order, kind, variant_id),
       product_ar_assets(id, mode, placement, asset_format, is_active)`,
    )
    .eq("id", productId)
    .order("sort_order", { referencedTable: "product_variants" })
    .order("sort_order", { referencedTable: "product_media" })
    .maybeSingle();
  if (error) fail("product detail", error);
  return data;
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof fetchProductDetail>>>;

export type CategoryOption = { id: string; title: string; parentId: string | null };

export async function fetchCategoryOptions(): Promise<CategoryOption[]> {
  const { data, error } = await adminDb().from("categories").select("id, title, parent_id, sort_order").order("sort_order").order("title");
  if (error) fail("category options", error);
  return data.map((row) => ({ id: row.id, title: row.title, parentId: row.parent_id }));
}

export type AdminCategory = {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  activeProductCount: number;
  image: string | null;
};

export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  const [categories, productCounts] = await Promise.all([
    adminDb().from("categories").select("id, title, slug, parent_id, is_active, sort_order, image_path").order("sort_order").order("title"),
    adminDb().rpc("admin_category_product_counts"),
  ]);
  if (categories.error) fail("categories", categories.error);
  if (productCounts.error) fail("category product counts", productCounts.error);

  const counts = new Map(productCounts.data.map((row) => [row.category_id, { all: row.product_count, active: row.active_product_count }]));
  return categories.data.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    parentId: row.parent_id,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    productCount: counts.get(row.id)?.all ?? 0,
    activeProductCount: counts.get(row.id)?.active ?? 0,
    image: mediaUrl(row.image_path),
  }));
}

export type InventoryRow = {
  variantId: string;
  sku: string;
  variantTitle: string | null;
  optionSummary: string;
  stock: number;
  threshold: number;
  stockState: StockState;
  variantActive: boolean;
  productId: string;
  productTitle: string;
  productStatus: ProductStatus;
  categoryTitle: string | null;
};

export type InventoryFilter = { q: string; stock: StockState | null; page: number };

function optionSummary(values: unknown): string {
  if (!values || typeof values !== "object" || Array.isArray(values)) return "";
  return Object.entries(values as Record<string, unknown>)
    .map(([name, value]) => `${name}: ${String(value)}`)
    .join(" · ");
}

export async function fetchInventory(filter: InventoryFilter): Promise<Page<InventoryRow>> {
  let query = adminDb()
    .from("admin_inventory")
    .select("*", { count: "exact" })
    .order("stock_quantity")
    .order("sku");
  if (filter.q) // Sanitised text (no commas, parentheses or quotes), quoted for the or() list.
    query = query.or(
      `product_title.ilike.${quotedFilterValue(containsPattern(filter.q))},sku.ilike.${quotedFilterValue(containsPattern(filter.q.toUpperCase()))}`,
    );
  if (filter.stock) query = query.eq("stock_state", filter.stock);
  const { data, error, count } = await query.range(...pageRange(filter.page));
  if (error) fail("inventory", error);
  const rows: InventoryRow[] = data.map((row) => ({
    variantId: row.variant_id!,
    sku: row.sku!,
    variantTitle: row.variant_title,
    optionSummary: optionSummary(row.option_values),
    stock: row.stock_quantity ?? 0,
    threshold: row.low_stock_threshold ?? 0,
    stockState: (row.stock_state as StockState | null) ?? "in_stock",
    variantActive: row.variant_active ?? false,
    productId: row.product_id!,
    productTitle: row.product_title ?? "",
    productStatus: row.product_status ?? "draft",
    categoryTitle: row.category_title,
  }));
  return toPage(rows, count, filter.page);
}

export type MediaRow = {
  id: string;
  url: string | null;
  altText: string;
  kind: Database["public"]["Enums"]["media_kind"];
  productId: string;
  productTitle: string;
  isVariantImage: boolean;
  createdAt: string;
};

export async function fetchMedia(filter: { missingAlt: boolean; page: number }): Promise<Page<MediaRow>> {
  const size = 24;
  let query = adminDb()
    .from("product_media")
    .select("id, storage_path, alt_text, kind, variant_id, created_at, products(id, title)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");
  if (filter.missingAlt) query = query.eq("alt_text", "");
  const { data, error, count } = await query.range(...pageRange(filter.page, size));
  if (error) fail("media", error);
  const rows = data.map((row) => ({
    id: row.id,
    url: mediaUrl(row.storage_path),
    altText: row.alt_text,
    kind: row.kind,
    productId: row.products?.id ?? "",
    productTitle: row.products?.title ?? "Unknown product",
    isVariantImage: row.variant_id !== null,
    createdAt: row.created_at,
  }));
  return toPage(rows, count, filter.page, size);
}

export async function countMissingAltText(): Promise<number> {
  const { count, error } = await adminDb().from("product_media").select("id", { count: "exact", head: true }).eq("alt_text", "");
  if (error) fail("missing alt text", error);
  return count ?? 0;
}

export type ArAssetRow = {
  id: string;
  productId: string;
  productTitle: string;
  productStatus: ProductStatus | null;
  mode: Database["public"]["Enums"]["ar_mode"];
  placement: Database["public"]["Enums"]["ar_placement"];
  format: string;
  isActive: boolean;
  variantSku: string | null;
  updatedAt: string;
};

export async function fetchArAssets(): Promise<ArAssetRow[]> {
  const { data, error } = await adminDb()
    .from("product_ar_assets")
    .select("id, mode, placement, asset_format, is_active, updated_at, product_id, products(title, status), product_variants(sku)")
    .order("updated_at", { ascending: false })
    .order("id");
  if (error) fail("ar assets", error);
  return data.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productTitle: row.products?.title ?? "Product not visible to you",
    productStatus: row.products?.status ?? null,
    mode: row.mode,
    placement: row.placement,
    format: row.asset_format,
    isActive: row.is_active,
    variantSku: row.product_variants?.sku ?? null,
    updatedAt: row.updated_at,
  }));
}

/** Content page: products flagged for homepage merchandising. */
export async function fetchMerchandisedProducts(): Promise<AdminProductRow[]> {
  const { data, error } = await adminDb()
    .from("products")
    .select(PRODUCT_ROW_SELECT)
    .or("is_featured.eq.true,is_bestseller.eq.true")
    .order("sort_order", { referencedTable: "product_media" })
    .limit(1, { referencedTable: "product_media" })
    .order("is_featured", { ascending: false })
    .order("title");
  if (error) fail("merchandised products", error);
  return (data as ProductRowData[]).map(toProductRow);
}

export const PRODUCT_PAGE_SIZE = PAGE_SIZE;

export type CategoryFormValues = {
  title: string;
  slug: string;
  parentId: string;
  description: string;
  imagePath: string;
  isActive: boolean;
  sortOrder: number;
};

export type CategoryEditorData = {
  id: string;
  values: CategoryFormValues;
  imageUrl: string | null;
  children: { id: string; title: string }[];
  productCount: number;
  updatedAt: string;
};

export function emptyCategoryValues(parentId: string | null): CategoryFormValues {
  return { title: "", slug: "", parentId: parentId ?? "", description: "", imagePath: "", isActive: true, sortOrder: 0 };
}

export async function fetchCategoryEditor(id: string): Promise<CategoryEditorData | null> {
  const db = adminDb();
  const [category, children, products] = await Promise.all([
    db.from("categories").select("id, title, slug, parent_id, description, image_path, is_active, sort_order, updated_at").eq("id", id).maybeSingle(),
    db.from("categories").select("id, title").eq("parent_id", id).order("sort_order").order("title"),
    db.from("products").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);
  if (category.error) fail("category editor", category.error);
  if (children.error) fail("subcategories", children.error);
  if (products.error) fail("category product count", products.error);
  const row = category.data;
  if (!row) return null;

  return {
    id: row.id,
    values: {
      title: row.title,
      slug: row.slug,
      parentId: row.parent_id ?? "",
      description: row.description,
      imagePath: row.image_path ?? "",
      isActive: row.is_active,
      sortOrder: row.sort_order,
    },
    imageUrl: mediaUrl(row.image_path),
    children: children.data,
    productCount: products.count ?? 0,
    updatedAt: row.updated_at,
  };
}
