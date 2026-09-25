"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PRODUCT_MEDIA_BUCKET, productMediaUrl } from "@/lib/media/storage";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { canAccess } from "../nav";
import {
  detectImageFormat,
  formatForContentType,
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_STAGED_PHOTOS,
  SIGNATURE_BYTES,
  type ImageFormat,
} from "../product-form/file-signature";
import { issuesByPath, productFormSchema, toSavePayload } from "../product-form/schema";
import { adminDb } from "../queries/shared";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog } from "./helpers";

/*
 * Product editor actions (AGENTS §4.7, §10.2). Each one re-checks the
 * caller's permission, validates with Zod and runs under RLS; the SQL
 * functions check again. Photos upload straight from the browser to Storage
 * with a server-issued signed URL on a server-chosen path (AGENTS §18.3); the
 * server then checks the stored bytes before a product_media row exists.
 * On Add product, photos are staged under `products/new-<stagingId>/` and
 * attached when the product is created.
 */

const productId = z.uuid();

type SaveRpcResult = { id: string; slug: string; previous_slug: string | null; deactivated_skus: string[] };

/** Postgres validation errors carry the form field in DETAIL. */
function saveErrorResult(error: { code?: string; message: string; details?: string | null }): ActionResult {
  if (error.code === "22023" && error.details) return { ok: false, message: error.message, fieldErrors: { [error.details]: error.message } };
  if (error.code === "23514" && error.message.includes("compare_at")) {
    const message = "The compare-at price must be higher than the price";
    return { ok: false, message, fieldErrors: { compareAtPrice: message } };
  }
  if (error.code === "23505") {
    const field = error.message.includes("sku") ? "variants" : error.message.includes("slug") ? "slug" : "form";
    const message = field === "variants" ? "A SKU is already used by another variant." : "Another product already uses this URL slug";
    return { ok: false, message, fieldErrors: { [field]: message } };
  }
  return databaseErrorResult(error, "save product");
}

/* ---------- Photo checks shared by the editor and Add product ---------- */

/** Editor: `products/<productId>/<uuid>.<ext>`. Add product: `products/new-<stagingId>/<uuid>.<ext>`. */
const PATH_PATTERN = /^products\/(new-)?([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

type StoredPath = { staged: boolean; ownerId: string; format: ImageFormat };

function parsePath(path: string): StoredPath | null {
  const match = PATH_PATTERN.exec(path);
  return match ? { staged: match[1] === "new-", ownerId: match[2]!, format: match[3] as ImageFormat } : null;
}

/** First bytes and total size of a stored object, via a Range request on the public bucket. */
async function readObjectHead(path: string): Promise<{ bytes: Uint8Array; size: number } | null> {
  const response = await fetch(productMediaUrl(path), { headers: { Range: `bytes=0-${SIGNATURE_BYTES - 1}` }, cache: "no-store" });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer()).subarray(0, SIGNATURE_BYTES);
  const total = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1];
  return { bytes, size: total ? Number(total) : bytes.length };
}

type MediaInsert = { productId: string; path: string; format: ImageFormat; altText: string; variantId: string | null; sortOrder: number };

/**
 * Checks the stored file really is the image type its name says, then adds it
 * to the product's gallery. Anything rejected is deleted from storage.
 */
async function verifyAndInsertMedia(db: ReturnType<typeof adminDb>, media: MediaInsert): Promise<{ ok: true; slug: string | null } | { ok: false; message: string }> {
  const bucket = db.storage.from(PRODUCT_MEDIA_BUCKET);
  const reject = async (message: string) => {
    await bucket.remove([media.path]);
    return { ok: false as const, message };
  };

  const head = await readObjectHead(media.path);
  if (!head) return { ok: false, message: "The upload didn't finish. Please try again." };
  if (detectImageFormat(head.bytes) !== media.format) return reject("That file isn't a JPEG, PNG, WebP or AVIF image.");
  if (head.size > MAX_IMAGE_BYTES) return reject("Use an image under 10 MB.");

  if (media.variantId) {
    const { data: variant } = await db.from("product_variants").select("id").eq("id", media.variantId).eq("product_id", media.productId).maybeSingle();
    if (!variant) return reject("That variant no longer exists. Refresh the page.");
  }

  const { data, error } = await db
    .from("product_media")
    .insert({ product_id: media.productId, storage_path: media.path, alt_text: media.altText, variant_id: media.variantId, sort_order: media.sortOrder })
    .select("products(slug)")
    .single();
  if (error) {
    await bucket.remove([media.path]);
    const result = databaseErrorResult(error, "attach product photo");
    return { ok: false, message: result.ok ? "The photo couldn't be added." : result.message };
  }
  return { ok: true, slug: data.products?.slug ?? null };
}

/* ---------- Save and delete ---------- */


const stagedMediaSchema = z
  .object({
    stagingId: z.uuid(),
    photos: z
      .array(z.object({ path: z.string().regex(PATH_PATTERN, "Invalid upload"), altText: z.string().trim().max(200, "Use at most 200 characters") }))
      .max(MAX_STAGED_PHOTOS, `Add at most ${MAX_STAGED_PHOTOS} photos at once`),
  })
  .refine(
    (staged) =>
      staged.photos.every((photo) => {
        const path = parsePath(photo.path);
        return path?.staged === true && path.ownerId === staged.stagingId;
      }),
    "Invalid upload",
  );

/**
 * Create (`id` null) or update a product. Creating attaches the photos staged
 * on the Add product page, in order, then redirects to the editor; updating
 * refreshes in place.
 */
export async function saveProductAction(id: string | null, input: unknown, staged?: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) return deniedResult(auth.reason);
  if (id !== null && !productId.safeParse(id).success) return NOT_UPDATED;

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = issuesByPath(parsed.error);
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }
  const stagedMedia = id === null && staged !== undefined ? stagedMediaSchema.safeParse(staged) : null;
  if (stagedMedia && !stagedMedia.success) return { ok: false, message: stagedMedia.error.issues[0]?.message ?? "Invalid upload" };
  const payload = toSavePayload(parsed.data);
  if (payload.collectionIds !== null && !canAccess(auth.profile, "content.manage")) return deniedResult("forbidden");

  const db = adminDb();
  const { data, error } = await db.rpc("admin_save_product", {
    p_product_id: id as string,
    p_product: payload.product,
    p_variants: payload.variants,
    p_collection_ids: payload.collectionIds as string[],
  });
  if (error) return saveErrorResult(error);
  const result = data as SaveRpcResult;

  if (id === null) {
    let added = 0;
    let rejected = 0;
    for (const photo of stagedMedia?.data?.photos ?? []) {
      const outcome = await verifyAndInsertMedia(db, {
        productId: result.id,
        path: photo.path,
        format: parsePath(photo.path)!.format,
        altText: photo.altText,
        variantId: null,
        sortOrder: added,
      });
      if (outcome.ok) added += 1;
      else rejected += 1;
    }
    revalidateStorefrontCatalog(result.slug);
    redirect(`/admin/products/${result.id}/edit?created=1&photos=${added}${rejected > 0 ? `&rejected=${rejected}` : ""}`);
  }

  revalidateStorefrontCatalog(result.previous_slug);
  if (result.previous_slug !== result.slug) revalidatePath(`/products/${result.slug}`);
  refresh();
  const kept = result.deactivated_skus;
  return {
    ok: true,
    message:
      kept.length > 0
        ? `Saved. ${kept.join(", ")} ${kept.length === 1 ? "has" : "have"} orders, so ${kept.length === 1 ? "it was" : "they were"} set inactive instead of deleted.`
        : "Product saved.",
  };
}

const deleteSchema = z.object({ productId });

export async function deleteProductAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", deleteSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data: existing } = await db.from("products").select("slug").eq("id", input.data.productId).maybeSingle();
  const { data: paths, error } = await db.rpc("admin_delete_product", { p_product_id: input.data.productId });
  if (error) return databaseErrorResult(error, "delete product");

  if (paths.length > 0) {
    const { error: removeError } = await db.storage.from(PRODUCT_MEDIA_BUCKET).remove(paths);
    // The product is gone either way; leftover files are only storage.
    if (removeError) console.error(`Admin action: ${paths.length} product photos were not removed from storage`);
  }

  revalidateStorefrontCatalog(existing?.slug);
  redirect("/admin/products?deleted=1");
}

/* ---------- Photos ---------- */

const uploadRequestSchema = z
  .object({
    /** An existing product (editor)... */
    productId: productId.optional(),
    /** ...or the Add product page's staging id. */
    stagingId: z.uuid().optional(),
    contentType: z.enum(Object.values(IMAGE_CONTENT_TYPES) as [string, ...string[]], "Use a JPEG, PNG, WebP or AVIF image"),
    size: z.number().int().min(1, "The file is empty").max(MAX_IMAGE_BYTES, "Use an image under 10 MB"),
  })
  .refine((request) => Boolean(request.productId) !== Boolean(request.stagingId), "Invalid upload");

export type UploadTicket = { ok: true; path: string; signedUrl: string } | { ok: false; message: string };

/** A one-time signed upload URL for a new photo, on a path the server picks. */
export async function createProductMediaUploadAction(request: unknown): Promise<UploadTicket> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) {
    const denied = deniedResult(auth.reason);
    return { ok: false, message: denied.ok ? "" : denied.message };
  }
  const parsed = uploadRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That file can't be uploaded." };

  const db = adminDb();
  if (parsed.data.productId) {
    const { data: product } = await db.from("products").select("id").eq("id", parsed.data.productId).maybeSingle();
    if (!product) return { ok: false, message: "That product no longer exists. Refresh the page." };
  }

  const format = formatForContentType(parsed.data.contentType)!;
  const folder = parsed.data.productId ?? `new-${parsed.data.stagingId}`;
  const path = `products/${folder}/${randomUUID()}.${format}`;
  // Signed with the caller's token, so the Storage insert policy (catalog.write) applies.
  const { data, error } = await db.storage.from(PRODUCT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error("Admin action failed (sign product upload)");
    return { ok: false, message: "The upload couldn't start. Please try again." };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}

const attachSchema = z.object({
  productId,
  path: z.string().regex(PATH_PATTERN, "Invalid upload"),
  altText: z.string().trim().max(200, "Use at most 200 characters"),
  variantId: z.uuid().nullable(),
});

/** Adds a photo uploaded in the editor to the end of the product's gallery. */
export async function attachProductMediaAction(input: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) return deniedResult(auth.reason);
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid upload" };
  const path = parsePath(parsed.data.path)!;
  if (path.staged || path.ownerId !== parsed.data.productId) return { ok: false, message: "Invalid upload" };

  const db = adminDb();
  const { data: last } = await db
    .from("product_media")
    .select("sort_order")
    .eq("product_id", parsed.data.productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const outcome = await verifyAndInsertMedia(db, {
    productId: parsed.data.productId,
    path: parsed.data.path,
    format: path.format,
    altText: parsed.data.altText,
    variantId: parsed.data.variantId,
    sortOrder: (last?.sort_order ?? -1) + 1,
  });
  if (!outcome.ok) return outcome;

  revalidateStorefrontCatalog(outcome.slug);
  refresh();
  return { ok: true };
}

const discardSchema = z.object({ stagingId: z.uuid(), path: z.string().regex(PATH_PATTERN) });

/** Removes a photo uploaded on the Add product page before the product was created. */
export async function discardStagedMediaAction(input: unknown): Promise<ActionResult> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) return deniedResult(auth.reason);
  const parsed = discardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid upload" };
  const path = parsePath(parsed.data.path)!;
  if (!path.staged || path.ownerId !== parsed.data.stagingId) return { ok: false, message: "Invalid upload" };

  const { error } = await adminDb().storage.from(PRODUCT_MEDIA_BUCKET).remove([parsed.data.path]);
  if (error) console.error("Admin action: a discarded upload was not removed from storage");
  return { ok: true };
}

const mediaUpdateSchema = z.object({
  mediaId: z.uuid(),
  altText: z.string().trim().max(200, "Use at most 200 characters"),
  variantId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
});

export async function updateProductMediaAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", mediaUpdateSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data: media } = await db.from("product_media").select("product_id").eq("id", input.data.mediaId).maybeSingle();
  if (!media) return NOT_UPDATED;
  if (input.data.variantId) {
    const { data: variant } = await db.from("product_variants").select("id").eq("id", input.data.variantId).eq("product_id", media.product_id).maybeSingle();
    if (!variant) return { ok: false, message: "That variant no longer exists. Refresh the page." };
  }

  const { data, error } = await db
    .from("product_media")
    .update({ alt_text: input.data.altText, variant_id: input.data.variantId })
    .eq("id", input.data.mediaId)
    .select("products(slug)");
  if (error) return databaseErrorResult(error, "update product photo");
  if (data.length !== 1) return NOT_UPDATED;

  revalidateStorefrontCatalog(data[0]!.products?.slug);
  refresh();
  return { ok: true, message: "Photo saved." };
}

const mediaIdSchema = z.object({ mediaId: z.uuid() });

export async function deleteProductMediaAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", mediaIdSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data, error } = await db.from("product_media").delete().eq("id", input.data.mediaId).select("storage_path, products(slug)");
  if (error) return databaseErrorResult(error, "delete product photo");
  if (data.length !== 1) return NOT_UPDATED;

  const { error: removeError } = await db.storage.from(PRODUCT_MEDIA_BUCKET).remove([data[0]!.storage_path]);
  if (removeError) console.error("Admin action: a deleted product photo was not removed from storage");

  revalidateStorefrontCatalog(data[0]!.products?.slug);
  refresh();
  return { ok: true };
}

const reorderSchema = z.object({
  productId,
  mediaIds: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(z.uuid()).min(1).max(200)),
});

export async function reorderProductMediaAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", reorderSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { error } = await db.rpc("admin_reorder_product_media", { p_product_id: input.data.productId, p_media_ids: input.data.mediaIds });
  if (error) return databaseErrorResult(error, "reorder product photos");

  const { data } = await db.from("products").select("slug").eq("id", input.data.productId).maybeSingle();
  revalidateStorefrontCatalog(data?.slug);
  refresh();
  return { ok: true };
}
