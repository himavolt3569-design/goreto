"use server";

import { refresh } from "next/cache";
import { databaseErrorResult, type ActionResult } from "../auth";
import { adminDb } from "../queries/shared";
import { productFlagSchema, productStatusSchema, stockAdjustSchema, toggleSchema } from "../schemas";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog } from "./helpers";

/* Catalog and inventory actions (RLS: catalog.write / inventory.write / ar.manage). */

const STATUS_MESSAGES = {
  active: "Product is live on the storefront.",
  draft: "Product moved to drafts and hidden from the storefront.",
  archived: "Product archived and hidden from the storefront.",
} as const;

export async function setProductStatusAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", productStatusSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { error } = await db.rpc("admin_set_product_status", { p_product_id: input.data.productId, p_status: input.data.status });
  if (error) return databaseErrorResult(error, "set product status");

  const { data } = await db.from("products").select("slug").eq("id", input.data.productId).maybeSingle();
  revalidateStorefrontCatalog(data?.slug);
  refresh();
  return { ok: true, message: STATUS_MESSAGES[input.data.status] };
}

export async function setProductFlagAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", productFlagSchema, formData);
  if (!input.ok) return input.result;

  const update = input.data.flag === "is_featured" ? { is_featured: input.data.value } : { is_bestseller: input.data.value };
  const { data, error } = await adminDb().from("products").update(update).eq("id", input.data.id).select("slug");
  if (error) return databaseErrorResult(error, "set product flag");
  if (data.length !== 1) return NOT_UPDATED;

  revalidateStorefrontCatalog(data[0]!.slug);
  refresh();
  return { ok: true };
}

export async function setCategoryActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", toggleSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().from("categories").update({ is_active: input.data.value }).eq("id", input.data.id).select("id");
  if (error) return databaseErrorResult(error, "set category active");
  if (data.length !== 1) return NOT_UPDATED;

  revalidateStorefrontCatalog();
  refresh();
  return { ok: true };
}

export async function adjustStockAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse(["inventory.write", "catalog.write"], stockAdjustSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().rpc("admin_adjust_stock", { p_variant_id: input.data.variantId, p_delta: input.data.delta });
  if (error) return databaseErrorResult(error, "adjust stock");

  // Product pages revalidate every 60s; checkout always reads stock from the database.
  refresh();
  return { ok: true, message: `Stock is now ${data}.` };
}

export async function setArAssetActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("ar.manage", toggleSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb()
    .from("product_ar_assets")
    .update({ is_active: input.data.value })
    .eq("id", input.data.id)
    .select("products(slug)");
  if (error) return databaseErrorResult(error, "set AR asset active");
  if (data.length !== 1) return NOT_UPDATED;

  revalidateStorefrontCatalog(data[0]!.products?.slug);
  refresh();
  return { ok: true };
}
