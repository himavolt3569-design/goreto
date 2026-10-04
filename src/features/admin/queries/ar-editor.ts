import "server-only";
import type { Database, Json } from "@/types/database";
import { arAssetUrl } from "@/lib/media/storage";
import { parseArAssetPath, readCalibration, type ArCalibration, type ArMode, type ArPlacement } from "../ar-forms";
import { adminDb, fail, mediaUrl } from "./shared";

/*
 * Reads for the AR asset editor (RLS: product_ar_assets for ar.manage;
 * products and variants as the caller may see them).
 */

type ProductStatus = Database["public"]["Enums"]["product_status"];

export type ArVariantOption = { id: string; label: string };

export type ArProduct = { id: string; title: string; status: ProductStatus; thumbnail: string | null; variants: ArVariantOption[] };

export type ArAssetFormValues = {
  productId: string;
  variantId: string;
  mode: ArMode;
  placement: ArPlacement;
  assetPath: string;
  calibration: ArCalibration;
  isActive: boolean;
};

export type ArAssetEditorData = {
  id: string;
  product: ArProduct | null;
  values: ArAssetFormValues;
  format: string;
  /** Public URL when the file was uploaded through the admin; seed rows have no file. */
  fileUrl: string | null;
  updatedAt: string;
};

function variantLabel(variant: { sku: string; title: string | null; option_values: Json }): string {
  const values =
    variant.option_values && typeof variant.option_values === "object" && !Array.isArray(variant.option_values)
      ? Object.values(variant.option_values).filter((value): value is string => typeof value === "string")
      : [];
  return `${variant.title || values.join(" / ") || "Default"} (${variant.sku})`;
}

const PRODUCT_COLUMNS = "id, title, status, product_media(storage_path, sort_order, kind), product_variants(id, sku, title, option_values, sort_order)";

type ProductRow = {
  id: string;
  title: string;
  status: ProductStatus;
  product_media: { storage_path: string; sort_order: number; kind: "image" | "video" }[];
  product_variants: { id: string; sku: string; title: string | null; option_values: Json; sort_order: number }[];
};

function toArProduct(row: ProductRow): ArProduct {
  const cover = row.product_media.filter((media) => media.kind === "image").sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    thumbnail: mediaUrl(cover?.storage_path),
    variants: [...row.product_variants].sort((a, b) => a.sort_order - b.sort_order).map((variant) => ({ id: variant.id, label: variantLabel(variant) })),
  };
}

/** A product to attach an asset to, with its variants; null when missing or hidden from the caller. */
export async function fetchArProduct(productId: string): Promise<ArProduct | null> {
  const { data, error } = await adminDb().from("products").select(PRODUCT_COLUMNS).eq("id", productId).maybeSingle();
  if (error) fail("AR product", error);
  return data ? toArProduct(data as ProductRow) : null;
}

/** The public URL of an admin-uploaded AR file, or null for seed keys that point at no file. */
export function uploadedArFileUrl(path: string): string | null {
  return parseArAssetPath(path) ? arAssetUrl(path) : null;
}

export async function fetchArAssetEditor(id: string): Promise<ArAssetEditorData | null> {
  const { data, error } = await adminDb()
    .from("product_ar_assets")
    .select(`id, product_id, variant_id, mode, placement, asset_path, asset_format, calibration, is_active, updated_at, products(${PRODUCT_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("AR asset", error);
  if (!data) return null;
  return {
    id: data.id,
    product: data.products ? toArProduct(data.products as ProductRow) : null,
    values: {
      productId: data.product_id,
      variantId: data.variant_id ?? "",
      mode: data.mode,
      placement: data.placement,
      assetPath: data.asset_path,
      calibration: readCalibration(data.placement, data.calibration),
      isActive: data.is_active,
    },
    format: data.asset_format,
    fileUrl: uploadedArFileUrl(data.asset_path),
    updatedAt: data.updated_at,
  };
}
