import "server-only";
import { AR_ASSETS_BUCKET, arAssetUrl, PRODUCT_MEDIA_BUCKET, productMediaUrl } from "@/lib/media/storage";
import { AR_SIGNATURE_BYTES, detectArFormat, MAX_AR_BYTES, type ArFormat } from "./asset-signature";
import { detectImageFormat, MAX_IMAGE_BYTES, SIGNATURE_BYTES, type ImageFormat } from "./product-form/file-signature";
import type { adminDb } from "./queries/shared";

/*
 * Server check of an uploaded file (AGENTS §18.4), shared by the product,
 * category, collection and AR editors: the stored bytes must be the type the
 * server-chosen path says, and within the size limit. Rejected uploads are
 * deleted.
 *
 * Uploads are only usable while fresh. The unused-upload cleanup
 * (admin_orphaned_storage_objects) deletes only files older than 24 hours, so
 * a save never references a file the cleanup may be deleting at the same
 * moment: the two act on disjoint age windows, with hours of margin.
 */

/** A file older than this can't be attached; keep well below the cleanup's 24 hours. */
export const UPLOAD_USABLE_HOURS = 20;

/** First bytes and total size of a stored object, via a Range request on its public URL. */
async function readObjectHead(url: string, length: number): Promise<{ bytes: Uint8Array; size: number } | null> {
  const response = await fetch(url, { headers: { Range: `bytes=0-${length - 1}` }, cache: "no-store" });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer()).subarray(0, length);
  const total = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1];
  return { bytes, size: total ? Number(total) : bytes.length };
}

export type VerifyResult = { ok: true } | { ok: false; message: string };

type Check = {
  bucket: string;
  url: string;
  headBytes: number;
  matches: (bytes: Uint8Array) => boolean;
  maxBytes: number;
  wrongType: string;
  tooLarge: string;
};

async function verifyStoredObject(db: ReturnType<typeof adminDb>, path: string, check: Check): Promise<VerifyResult> {
  const reject = async (message: string) => {
    await db.storage.from(check.bucket).remove([path]);
    return { ok: false as const, message };
  };

  const head = await readObjectHead(check.url, check.headBytes);
  if (!head) return { ok: false, message: "The upload didn't finish. Please try again." };
  if (!check.matches(head.bytes)) return reject(check.wrongType);
  if (head.size > check.maxBytes) return reject(check.tooLarge);

  // Storage's own created_at (database time), not anything the browser sent.
  const { data: info, error } = await db.storage.from(check.bucket).info(path);
  if (error || !info) return { ok: false, message: "The upload didn't finish. Please try again." };
  const ageHours = (Date.now() - Date.parse(info.createdAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours > UPLOAD_USABLE_HOURS) return reject("This upload is too old to use. Upload the file again.");
  return { ok: true };
}

export function verifyStoredImage(db: ReturnType<typeof adminDb>, path: string, format: ImageFormat): Promise<VerifyResult> {
  return verifyStoredObject(db, path, {
    bucket: PRODUCT_MEDIA_BUCKET,
    url: productMediaUrl(path),
    headBytes: SIGNATURE_BYTES,
    matches: (bytes) => detectImageFormat(bytes) === format,
    maxBytes: MAX_IMAGE_BYTES,
    wrongType: "That file isn't a JPEG, PNG, WebP or AVIF image.",
    tooLarge: "Use an image under 10 MB.",
  });
}

export function verifyStoredArAsset(db: ReturnType<typeof adminDb>, path: string, format: ArFormat): Promise<VerifyResult> {
  const model = format === "glb" || format === "usdz";
  return verifyStoredObject(db, path, {
    bucket: AR_ASSETS_BUCKET,
    url: arAssetUrl(path),
    headBytes: AR_SIGNATURE_BYTES,
    matches: (bytes) => detectArFormat(bytes) === format,
    maxBytes: MAX_AR_BYTES,
    wrongType: model ? "That file isn't a GLB or USDZ model." : "That file isn't a PNG or WebP image.",
    tooLarge: "Use a file under 25 MB.",
  });
}
