"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/media/storage";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { canAccess } from "../nav";
import { verifyStoredMedia } from "../media-verify";
import {
  MAX_IMAGE_BYTES,
  MAX_PHOTOS,
  MAX_VIDEO_BYTES,
  MAX_VIDEOS,
  MEDIA_CONTENT_TYPES,
  mediaFormatForContentType,
  mediaKindOf,
  type MediaFormat,
} from "../product-form/file-signature";
import { duplicateValues } from "../product-form/duplicate";
import { defaultAltText, numberedSku, numberedSlug, quickKeys, quickProductSchema, toProductFormValues } from "../product-form/quick-product";
import { issuesByPath, productFormSchema, toSavePayload } from "../product-form/schema";
import { fetchDefaultLowStockThreshold, fetchProductEditor } from "../queries/product-editor";
import { adminDb } from "../queries/shared";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog } from "./helpers";

/*
 * Product editor actions (AGENTS §4.7, §10.2). Each one re-checks the
 * caller's permission, validates with Zod and runs under RLS; the SQL
 * functions check again. Photos upload straight from the browser to Storage
 * with a server-issued signed URL on a server-chosen path (AGENTS §18.3); the
 * server then checks the stored bytes before a product_media row exists.
 * On Add product and Bulk add, photos and videos are staged under
 * `products/new-<stagingId>/` and attached when the product is created.
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

/**
 * products.is_sponsored, written right after admin_save_product (which doesn't
 * know the column) under the same catalog.write policy. A new product that
 * fails here is still created, so only an update reports the error.
 */
async function saveSponsored(db: ReturnType<typeof adminDb>, id: string, value: boolean, isNew: boolean): Promise<ActionResult | null> {
  const { error } = await db.from("products").update({ is_sponsored: value }).eq("id", id);
  if (!error) return null;
  if (isNew) {
    console.error("Admin action failed (save sponsored flag on a new product)");
    return null;
  }
  return databaseErrorResult(error, "save sponsored flag");
}

/* ---------- Media checks shared by the editor, Add product and Bulk add ---------- */

/** Editor: `products/<productId>/<uuid>.<ext>`. Add product: `products/new-<stagingId>/<uuid>.<ext>`. */
const PATH_PATTERN = /^products\/(new-)?([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4|webm)$/;

type StoredPath = { staged: boolean; ownerId: string; format: MediaFormat };

function parsePath(path: string): StoredPath | null {
  const match = PATH_PATTERN.exec(path);
  return match ? { staged: match[1] === "new-", ownerId: match[2]!, format: match[3] as MediaFormat } : null;
}

type MediaInsert = { productId: string; path: string; format: MediaFormat; altText: string; variantId: string | null; sortOrder: number };

/**
 * Checks the stored file really is the photo or video type its name says,
 * then adds it to the product's gallery. Anything rejected is deleted from
 * storage. The database refuses more than 7 photos or 3 videos per product.
 */
async function verifyAndInsertMedia(db: ReturnType<typeof adminDb>, media: MediaInsert): Promise<{ ok: true; slug: string | null } | { ok: false; message: string }> {
  const bucket = db.storage.from(PRODUCT_MEDIA_BUCKET);
  const reject = async (message: string) => {
    await bucket.remove([media.path]);
    return { ok: false as const, message };
  };

  const verified = await verifyStoredMedia(db, media.path, media.format);
  if (!verified.ok) return verified;

  const kind = mediaKindOf(media.format);
  if (media.variantId && kind === "video") return reject("Videos are shared by every variant.");
  if (media.variantId) {
    const { data: variant } = await db.from("product_variants").select("id").eq("id", media.variantId).eq("product_id", media.productId).maybeSingle();
    if (!variant) return reject("That variant no longer exists. Refresh the page.");
  }

  const { data, error } = await db
    .from("product_media")
    .insert({ product_id: media.productId, kind, storage_path: media.path, alt_text: media.altText, variant_id: media.variantId, sort_order: media.sortOrder })
    .select("products(slug)")
    .single();
  if (error) {
    await bucket.remove([media.path]);
    const result = databaseErrorResult(error, "attach product media");
    return { ok: false, message: result.ok ? "The file couldn't be added." : result.message };
  }
  return { ok: true, slug: data.products?.slug ?? null };
}

/* ---------- Save and delete ---------- */

const stagedMediaSchema = z
  .object({
    stagingId: z.uuid(),
    /** Gallery order. Empty alt text is filled from the product name on Bulk add. */
    media: z
      .array(z.object({ path: z.string().regex(PATH_PATTERN, "Invalid upload"), altText: z.string().trim().max(200, "Use at most 200 characters") }))
      .max(MAX_PHOTOS + MAX_VIDEOS, `Add at most ${MAX_PHOTOS} photos and ${MAX_VIDEOS} videos`),
  })
  .superRefine((staged, context) => {
    const paths = staged.media.map((item) => parsePath(item.path));
    if (!paths.every((path) => path?.staged === true && path.ownerId === staged.stagingId)) {
      context.addIssue({ code: "custom", message: "Invalid upload" });
      return;
    }
    const videos = paths.filter((path) => mediaKindOf(path!.format) === "video").length;
    if (paths.length - videos > MAX_PHOTOS) context.addIssue({ code: "custom", message: `Add at most ${MAX_PHOTOS} photos` });
    if (videos > MAX_VIDEOS) context.addIssue({ code: "custom", message: `Add at most ${MAX_VIDEOS} videos` });
  });

type StagedMedia = z.output<typeof stagedMediaSchema>;

/** Attaches staged uploads to a new product in order; counts what was added (and how many photos) and rejected. */
async function attachStagedMedia(
  db: ReturnType<typeof adminDb>,
  newProductId: string,
  staged: StagedMedia | undefined,
  altFor: (kind: "image" | "video", position: number) => string = () => "",
): Promise<{ added: number; images: number; rejected: number }> {
  let added = 0;
  let images = 0;
  let rejected = 0;
  const positions = { image: 0, video: 0 };
  for (const item of staged?.media ?? []) {
    const format = parsePath(item.path)!.format;
    const kind = mediaKindOf(format);
    positions[kind] += 1;
    const outcome = await verifyAndInsertMedia(db, {
      productId: newProductId,
      path: item.path,
      format,
      altText: item.altText || altFor(kind, positions[kind]),
      variantId: null,
      sortOrder: added,
    });
    if (outcome.ok) {
      added += 1;
      if (kind === "image") images += 1;
    } else rejected += 1;
  }
  return { added, images, rejected };
}

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
  const sponsored = await saveSponsored(db, result.id, payload.product.is_sponsored, id === null);
  if (sponsored) return sponsored;

  if (id === null) {
    const { added, rejected } = await attachStagedMedia(db, result.id, stagedMedia?.data);
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

/* ---------- Bulk add ---------- */

export type QuickCreateResult =
  | { ok: true; id: string; slug: string; published: boolean; mediaAdded: number; mediaRejected: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Free slug and SKU for a new product: exact lookups, numbering past any that exist. */
async function freeKeys(db: ReturnType<typeof adminDb>, title: string): Promise<{ slug: string; sku: string } | { error: { code?: string; message: string } } | null> {
  const base = quickKeys(title);
  let slug: string | null = null;
  let sku: string | null = null;
  for (let attempt = 1; attempt <= 50 && (slug === null || sku === null); attempt += 1) {
    const [slugs, skus] = await Promise.all([
      slug === null ? db.from("products").select("slug").eq("slug", numberedSlug(base.slug, attempt)) : null,
      sku === null ? db.from("product_variants").select("sku").eq("sku", numberedSku(base.sku, attempt)) : null,
    ]);
    const error = slugs?.error ?? skus?.error;
    if (error) return { error };
    if (slugs?.data?.length === 0) slug = numberedSlug(base.slug, attempt);
    if (skus?.data?.length === 0) sku = numberedSku(base.sku, attempt);
  }
  return slug && sku ? { slug, sku } : null;
}

/**
 * Bulk add: creates one product from a short card (no options, one variant)
 * through the same schema and admin_save_product as the full editor, then
 * attaches its staged photos and videos. The page calls it once per card.
 */
export async function quickCreateProductAction(input: unknown, staged: unknown): Promise<QuickCreateResult> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) {
    const denied = deniedResult(auth.reason);
    return { ok: false, message: denied.ok ? "" : denied.message };
  }

  const card = quickProductSchema.safeParse(input);
  if (!card.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: issuesByPath(card.error) };
  const media = stagedMediaSchema.safeParse(staged);
  if (!media.success) return { ok: false, message: media.error.issues[0]?.message ?? "Invalid upload" };
  const hasPhoto = media.data.media.some((item) => mediaKindOf(parsePath(item.path)!.format) === "image");
  if (card.data.publish && !hasPhoto) return { ok: false, message: "Add a photo before publishing.", fieldErrors: { publish: "Add a photo before publishing" } };

  const db = adminDb();
  const lowStockThreshold = await fetchDefaultLowStockThreshold();
  const rawCard = input as Parameters<typeof toProductFormValues>[0];

  // A name another card or product just took can still collide; look again once.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const keys = await freeKeys(db, card.data.title);
    if (keys === null) return { ok: false, message: "Too many products already use this name. Change it a little and try again." };
    if ("error" in keys) return databaseErrorResult(keys.error, "pick product slug") as QuickCreateResult;

    // Saved as a draft; it's published only once a photo is attached.
    const parsed = productFormSchema.safeParse(toProductFormValues({ ...rawCard, publish: false }, { ...keys, lowStockThreshold }));
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: issuesByPath(parsed.error) };
    const payload = toSavePayload(parsed.data);

    const { data, error } = await db.rpc("admin_save_product", {
      p_product_id: null as unknown as string,
      p_product: payload.product,
      p_variants: payload.variants,
      p_collection_ids: null as unknown as string[],
    });
    if (error?.code === "23505" && attempt === 0) continue;
    if (error) return saveErrorResult(error) as QuickCreateResult;

    const created = data as SaveRpcResult;
    // Media follows the same check as the editor; alt text comes from the name.
    const { added, images, rejected } = await attachStagedMedia(db, created.id, media.data, (kind, position) => defaultAltText(card.data.title, kind, position));
    let published = false;
    if (card.data.publish && images > 0) {
      const { error: statusError } = await db.rpc("admin_set_product_status", { p_product_id: created.id, p_status: "active" });
      if (statusError) console.error(`Admin action: a bulk-added product was left as a draft (${statusError.code ?? "unknown"})`);
      else published = true;
    }
    if (published) revalidateStorefrontCatalog(created.slug);
    revalidatePath("/admin/products");
    return { ok: true, id: created.id, slug: created.slug, published, mediaAdded: added, mediaRejected: rejected };
  }
  return { ok: false, message: "Another product took this name at the same moment. Try again." };
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

/* ---------- Duplicate ---------- */

const COPYABLE_MEDIA = /\.(jpe?g|png|webp|avif|mp4|webm)$/i;

/**
 * Copies a product into a new draft: same details, options and prices, new
 * variants with `-COPY` SKUs and no stock, and copies of its photos as new
 * files. AR assets and merchandising flags aren't copied. Saved through the
 * same function and checks as Create, then opens the copy in the editor.
 */
export async function duplicateProductAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) return deniedResult(auth.reason);
  const sourceId = productId.safeParse(formData.get("productId"));
  if (!sourceId.success) return NOT_UPDATED;

  const source = await fetchProductEditor(sourceId.data);
  if (!source) return NOT_UPDATED;

  const db = adminDb();
  const photos = await db.from("product_media").select("storage_path, alt_text, kind").eq("product_id", source.id).order("sort_order");
  if (photos.error) return databaseErrorResult(photos.error, "prepare product copy");

  // Look up exactly the slug and SKUs each attempt would use (never a capped
  // pattern search), and move past any that exist until none collide.
  const takenSlugs = new Set<string>();
  const takenSkus = new Set<string>();
  const linkCollections = canAccess(auth.profile, "content.manage");
  let values = duplicateValues(source.values, { takenSlugs, takenSkus, linkCollections });
  for (let attempt = 0; ; attempt += 1) {
    const skuCandidates = values.variants.map((variant) => variant.sku);
    const [slugs, skus] = await Promise.all([
      db.from("products").select("slug").eq("slug", values.slug),
      db.from("product_variants").select("sku").in("sku", skuCandidates),
    ]);
    if (slugs.error || skus.error) return databaseErrorResult((slugs.error ?? skus.error)!, "prepare product copy");
    if (slugs.data.length === 0 && skus.data.length === 0) break;
    if (attempt >= 20) return { ok: false, message: "Too many copies of this product already exist. Rename one and try again." };
    for (const row of slugs.data) takenSlugs.add(row.slug);
    for (const row of skus.data) takenSkus.add(row.sku);
    values = duplicateValues(source.values, { takenSlugs, takenSkus, linkCollections });
  }
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: "This product can't be copied as it is. Open it, fix the highlighted fields and save, then try again." };
  const payload = toSavePayload(parsed.data);

  const { data, error } = await db.rpc("admin_save_product", {
    p_product_id: null as unknown as string,
    p_product: payload.product,
    p_variants: payload.variants,
    p_collection_ids: payload.collectionIds as string[],
  });
  if (error) return saveErrorResult(error);
  const copy = data as SaveRpcResult;

  const bucket = db.storage.from(PRODUCT_MEDIA_BUCKET);
  const rows: { product_id: string; kind: "image" | "video"; storage_path: string; alt_text: string; sort_order: number }[] = [];
  let skipped = 0;
  for (const photo of photos.data) {
    const extension = COPYABLE_MEDIA.exec(photo.storage_path)?.[1]?.toLowerCase().replace("jpeg", "jpg");
    const target = `products/${copy.id}/${randomUUID()}.${extension}`;
    if (!extension || (await bucket.copy(photo.storage_path, target)).error) {
      skipped += 1;
      continue;
    }
    rows.push({ product_id: copy.id, kind: photo.kind, storage_path: target, alt_text: photo.alt_text, sort_order: rows.length });
  }
  if (rows.length > 0) {
    const { error: mediaError } = await db.from("product_media").insert(rows);
    if (mediaError) {
      await bucket.remove(rows.map((row) => row.storage_path));
      console.error(`Admin action: photos for a product copy were not attached (${mediaError.code ?? "unknown"})`);
      skipped += rows.length;
      rows.length = 0;
    }
  }

  // The copy is a draft, so no storefront page changes.
  revalidatePath("/admin/products");
  redirect(`/admin/products/${copy.id}/edit?duplicated=1&photos=${rows.length}${skipped > 0 ? `&rejected=${skipped}` : ""}`);
}

/* ---------- Photos ---------- */

const uploadRequestSchema = z
  .object({
    /** An existing product (editor)... */
    productId: productId.optional(),
    /** ...or the Add product page's staging id. */
    stagingId: z.uuid().optional(),
    contentType: z.enum(Object.values(MEDIA_CONTENT_TYPES) as [string, ...string[]], "Use a JPEG, PNG, WebP or AVIF photo, or an MP4 or WebM video"),
    size: z.number().int().min(1, "The file is empty"),
  })
  .refine((request) => Boolean(request.productId) !== Boolean(request.stagingId), "Invalid upload")
  .superRefine((request, context) => {
    const video = mediaKindOf(mediaFormatForContentType(request.contentType)!) === "video";
    if (request.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      context.addIssue({ code: "custom", message: video ? "Use a video under 50 MB" : "Use an image under 10 MB" });
    }
  });

export type UploadTicket = { ok: true; path: string; signedUrl: string } | { ok: false; message: string };

/** A one-time signed upload URL for a new photo or video, on a path the server picks. */
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

  const format = mediaFormatForContentType(parsed.data.contentType)!;
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
  const { data: media } = await db.from("product_media").select("product_id, kind").eq("id", input.data.mediaId).maybeSingle();
  if (!media) return NOT_UPDATED;
  if (input.data.variantId && media.kind === "video") return { ok: false, message: "Videos are shared by every variant." };
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
