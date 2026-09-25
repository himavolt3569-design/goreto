import "server-only";
import type { Database, Json } from "@/types/database";
import { parseOptions, parseSpecs } from "@/features/catalog/mappers";
import { paisaToRupeesInput } from "@/lib/money/parse";
import type { ProductFormValues } from "../product-form/schema";
import { adminDb, fail, mediaUrl } from "./shared";

/* Reads for the product editor (RLS: catalog.read; order history via the catalog.write helpers). */

export type EditorVariantInfo = {
  /** Current stock, shown read-only; the form never sets it. */
  stock: number;
  /** Kept (inactive) instead of deleted when removed. */
  ordered: boolean;
};

export type EditorMedia = {
  id: string;
  url: string | null;
  altText: string;
  variantId: string | null;
};

export type EditorArAsset = {
  id: string;
  mode: Database["public"]["Enums"]["ar_mode"];
  placement: Database["public"]["Enums"]["ar_placement"];
  format: string;
  isActive: boolean;
};

export type ProductEditorData = {
  id: string;
  slug: string;
  status: Database["public"]["Enums"]["product_status"];
  updatedAt: string;
  values: ProductFormValues;
  variantInfo: Record<string, EditorVariantInfo>;
  media: EditorMedia[];
  arAssets: EditorArAsset[];
  linkedCollections: { id: string; title: string }[];
  hasOrders: boolean;
};

function optionValuesOf(json: Json): Record<string, string> {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(Object.entries(json).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export async function fetchProductEditor(productId: string): Promise<ProductEditorData | null> {
  const db = adminDb();
  const { data, error } = await db
    .from("products")
    .select(
      `id, title, slug, category_id, short_description, description, base_price_paisa, compare_at_price_paisa,
       status, is_featured, is_bestseller, is_limited_edition, low_stock_threshold, options, specs,
       care_instructions, tags, updated_at,
       product_variants(id, sku, title, option_values, price_paisa, stock_quantity, weight_grams, is_active, sort_order),
       product_media(id, storage_path, alt_text, variant_id, sort_order),
       product_ar_assets(id, mode, placement, asset_format, is_active),
       collection_products(collection_id, collections(id, title))`,
    )
    .eq("id", productId)
    .order("sort_order", { referencedTable: "product_variants" })
    .order("sort_order", { referencedTable: "product_media" })
    .maybeSingle();
  if (error) fail("product editor", error);
  if (!data) return null;

  const [ordered, hasOrders] = await Promise.all([
    db.rpc("admin_ordered_variant_ids", { p_product_id: productId }),
    db.rpc("admin_product_has_orders", { p_product_id: productId }),
  ]);
  if (ordered.error) fail("ordered variants", ordered.error);
  if (hasOrders.error) fail("product orders", hasOrders.error);
  const orderedIds = new Set<string>(ordered.data ?? []);

  const options = parseOptions(data.options);
  return {
    id: data.id,
    slug: data.slug,
    status: data.status,
    updatedAt: data.updated_at,
    values: {
      title: data.title,
      slug: data.slug,
      categoryId: data.category_id,
      shortDescription: data.short_description,
      description: data.description,
      basePrice: paisaToRupeesInput(data.base_price_paisa),
      compareAtPrice: paisaToRupeesInput(data.compare_at_price_paisa),
      status: data.status,
      isFeatured: data.is_featured,
      isBestseller: data.is_bestseller,
      isLimitedEdition: data.is_limited_edition,
      lowStockThreshold: String(data.low_stock_threshold),
      options: options.map((option) => ({
        name: option.name,
        values: option.values.map((value) => ({ value: value.value, label: value.label, swatchHex: value.swatchHex ?? "", locked: true })),
      })),
      variants: data.product_variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        title: variant.title ?? "",
        optionValues: optionValuesOf(variant.option_values),
        price: paisaToRupeesInput(variant.price_paisa),
        weightGrams: variant.weight_grams === null ? "" : String(variant.weight_grams),
        isActive: variant.is_active,
        initialStock: "0",
      })),
      specs: parseSpecs(data.specs),
      careInstructions: data.care_instructions,
      tags: data.tags,
      collectionIds: data.collection_products.map((link) => link.collection_id),
    },
    variantInfo: Object.fromEntries(
      data.product_variants.map((variant) => [variant.id, { stock: variant.stock_quantity, ordered: orderedIds.has(variant.id) }]),
    ),
    media: data.product_media.map((media) => ({
      id: media.id,
      url: mediaUrl(media.storage_path),
      altText: media.alt_text,
      variantId: media.variant_id,
    })),
    arAssets: data.product_ar_assets.map((asset) => ({
      id: asset.id,
      mode: asset.mode,
      placement: asset.placement,
      format: asset.asset_format,
      isActive: asset.is_active,
    })),
    linkedCollections: data.collection_products.flatMap((link) => (link.collections ? [{ id: link.collections.id, title: link.collections.title }] : [])),
    hasOrders: hasOrders.data === true,
  };
}

export type CollectionOption = { id: string; title: string; isActive: boolean; isLive: boolean };

/** Every collection, for the links checklist (content.manage sees inactive ones). */
export async function fetchCollectionOptions(now = Date.now()): Promise<CollectionOption[]> {
  const { data, error } = await adminDb()
    .from("collections")
    .select("id, title, is_active, starts_at, ends_at, sort_order")
    .order("sort_order")
    .order("title");
  if (error) fail("collection options", error);
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    isActive: row.is_active,
    isLive:
      row.is_active &&
      (row.starts_at === null || Date.parse(row.starts_at) <= now) &&
      (row.ends_at === null || Date.parse(row.ends_at) > now),
  }));
}

/** Store default for new products' low-stock alert. */
export async function fetchDefaultLowStockThreshold(): Promise<number> {
  const { data, error } = await adminDb().from("store_settings").select("default_low_stock_threshold").eq("singleton", true).maybeSingle();
  if (error) fail("store settings", error);
  return data?.default_low_stock_threshold ?? 5;
}

/** Whether a product exists and is visible to the caller, with its slug (for revalidation). */
export async function fetchProductSlug(productId: string): Promise<string | null> {
  const { data, error } = await adminDb().from("products").select("slug").eq("id", productId).maybeSingle();
  if (error) fail("product slug", error);
  return data?.slug ?? null;
}

/** Whether the product was ever ordered (decides Delete vs Archive). Needs catalog.write. */
export async function fetchProductHasOrders(productId: string): Promise<boolean> {
  const { data, error } = await adminDb().rpc("admin_product_has_orders", { p_product_id: productId });
  if (error) fail("product orders", error);
  return data === true;
}
