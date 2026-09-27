"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AR_ASSETS_BUCKET } from "@/lib/media/storage";
import { AR_MODE_LABELS, arAssetFormSchema, formatSuitsMode, parseArAssetPath, toCalibration } from "../ar-forms";
import { AR_CONTENT_TYPES, arFormatForContentType, MAX_AR_BYTES } from "../asset-signature";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { verifyStoredArAsset } from "../media-verify";
import { fetchArProduct, type ArProduct } from "../queries/ar-editor";
import { searchPickerProducts, type ProductSearchResult } from "../queries/collection-editor";
import { adminDb } from "../queries/shared";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog, saveErrorResult } from "./helpers";
import type { UploadTicket } from "./products";

/*
 * AR asset create/edit/delete (prompts/goreto-admin-media-ar.md; RLS and
 * Storage: ar.manage). Files upload straight from the browser to the
 * ar-assets bucket on a server-chosen path (AGENTS §18.3); the save checks the
 * stored bytes and that the format suits the mode before a row points at it.
 */

const recordId = z.uuid();

function denied(reason: "unauthenticated" | "forbidden"): { ok: false; message: string } {
  const result = deniedResult(reason);
  return { ok: false, message: result.ok ? "" : result.message };
}

export async function searchArProductsAction(query: unknown): Promise<ProductSearchResult> {
  const auth = await authorizeAdmin("ar.manage");
  if (!auth.ok) return denied(auth.reason);
  return searchPickerProducts(query, "search AR products");
}

/** The chosen product with its variants, for the variant select. */
export async function fetchArProductAction(productId: unknown): Promise<{ ok: true; product: ArProduct } | { ok: false; message: string }> {
  const auth = await authorizeAdmin("ar.manage");
  if (!auth.ok) return denied(auth.reason);
  const parsed = recordId.safeParse(productId);
  if (!parsed.success) return { ok: false, message: "Choose a product." };
  const product = await fetchArProduct(parsed.data);
  return product ? { ok: true, product } : { ok: false, message: "That product no longer exists, or you can't see it." };
}

const uploadRequestSchema = z.object({
  productId: recordId,
  contentType: z.enum(Object.values(AR_CONTENT_TYPES) as [string, ...string[]], "Use a PNG, WebP, GLB or USDZ file"),
  size: z.number().int().min(1, "The file is empty").max(MAX_AR_BYTES, "Use a file under 25 MB"),
});

/** A one-time signed upload URL in the ar-assets bucket, on a path the server picks. */
export async function createArAssetUploadAction(request: unknown): Promise<UploadTicket> {
  const auth = await authorizeAdmin("ar.manage");
  if (!auth.ok) return denied(auth.reason);
  const parsed = uploadRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That file can't be uploaded." };

  const db = adminDb();
  const { data: product } = await db.from("products").select("id").eq("id", parsed.data.productId).maybeSingle();
  if (!product) return { ok: false, message: "That product no longer exists. Refresh the page." };

  const path = `products/${parsed.data.productId}/${randomUUID()}.${arFormatForContentType(parsed.data.contentType)!}`;
  // Signed with the caller's token, so the ar-assets insert policy (ar.manage) applies.
  const { data, error } = await db.storage.from(AR_ASSETS_BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error("Admin action failed (sign AR asset upload)");
    return { ok: false, message: "The upload couldn't start. Please try again." };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}

/** Deletes an AR file the admin uploaded; seed keys (no file) are left alone. */
async function removeUploadedArFile(db: ReturnType<typeof adminDb>, path: string | null | undefined): Promise<void> {
  if (!path || !parseArAssetPath(path)) return;
  const { error } = await db.storage.from(AR_ASSETS_BUCKET).remove([path]);
  // The row is saved either way; a leftover file is only storage, and the cleanup panel lists it.
  if (error) console.error("Admin action: an AR file was not removed from storage");
}

function fieldError(field: string, message: string): ActionResult {
  return { ok: false, message, fieldErrors: { [field]: message } };
}

export async function saveArAssetAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const rawId = formData.get("assetId");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id !== null && !recordId.safeParse(id).success) return NOT_UPDATED;
  const input = await authorizeAndParse("ar.manage", arAssetFormSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;
  const db = adminDb();

  const existing = id
    ? (await db.from("product_ar_assets").select("product_id, asset_path, asset_format").eq("id", id).maybeSingle()).data
    : null;
  if (id && !existing) return NOT_UPDATED;
  // An asset stays with its product; its file lives under that product's folder.
  if (existing && existing.product_id !== values.productId) return NOT_UPDATED;

  let format: string;
  const fileChanged = !existing || existing.asset_path !== values.assetPath;
  if (fileChanged) {
    const uploaded = parseArAssetPath(values.assetPath);
    if (!uploaded || uploaded.productId !== values.productId) return fieldError("assetPath", "That upload isn't valid. Upload the file again.");
    if (!formatSuitsMode(values.mode, uploaded.format)) {
      return fieldError("assetPath", `${AR_MODE_LABELS[values.mode]} needs a ${values.mode === "live_3d" ? "GLB or USDZ model" : "PNG or WebP image"}.`);
    }
    const verified = await verifyStoredArAsset(db, values.assetPath, uploaded.format);
    if (!verified.ok) return fieldError("assetPath", verified.message);
    format = uploaded.format;
  } else {
    format = existing.asset_format;
    if (!formatSuitsMode(values.mode, format)) {
      return fieldError("mode", `This ${format.toUpperCase()} file doesn't suit ${AR_MODE_LABELS[values.mode]}. Upload a matching file.`);
    }
  }

  const row = {
    variant_id: values.variantId,
    mode: values.mode,
    placement: values.placement,
    asset_path: values.assetPath,
    asset_format: format,
    calibration: toCalibration(values),
    is_active: values.isActive,
  };

  if (!existing) {
    const { data, error } = await db.from("product_ar_assets").insert({ ...row, product_id: values.productId }).select("id, products(slug)").single();
    if (error) return saveErrorResult(error, "create AR asset");
    revalidateStorefrontCatalog(data.products?.slug);
    redirect(`/admin/ar/${data.id}/edit?created=1`);
  }

  const { data, error } = await db.from("product_ar_assets").update(row).eq("id", id!).select("products(slug)");
  if (error) return saveErrorResult(error, "update AR asset");
  if (data.length !== 1) return NOT_UPDATED;
  if (fileChanged) await removeUploadedArFile(db, existing.asset_path);

  revalidateStorefrontCatalog(data[0]!.products?.slug);
  refresh();
  return { ok: true, message: "AR asset saved." };
}

export async function deleteArAssetAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("ar.manage", z.object({ assetId: recordId }), formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data, error } = await db.from("product_ar_assets").delete().eq("id", input.data.assetId).select("asset_path, products(slug)");
  if (error) return databaseErrorResult(error, "delete AR asset");
  if (data.length !== 1) return NOT_UPDATED;

  await removeUploadedArFile(db, data[0]!.asset_path);
  revalidateStorefrontCatalog(data[0]!.products?.slug);
  redirect("/admin/ar?deleted=1");
}
