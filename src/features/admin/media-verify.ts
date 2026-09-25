import "server-only";
import { PRODUCT_MEDIA_BUCKET, productMediaUrl } from "@/lib/media/storage";
import { detectImageFormat, MAX_IMAGE_BYTES, SIGNATURE_BYTES, type ImageFormat } from "./product-form/file-signature";
import type { adminDb } from "./queries/shared";

/*
 * Server check of an uploaded image (AGENTS §18.4), shared by the product,
 * category and collection editors: the stored bytes must be the image type
 * the server-chosen path says, and within the size limit. Rejected uploads
 * are deleted.
 */

/** First bytes and total size of a stored object, via a Range request on the public bucket. */
async function readObjectHead(path: string): Promise<{ bytes: Uint8Array; size: number } | null> {
  const response = await fetch(productMediaUrl(path), { headers: { Range: `bytes=0-${SIGNATURE_BYTES - 1}` }, cache: "no-store" });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer()).subarray(0, SIGNATURE_BYTES);
  const total = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1];
  return { bytes, size: total ? Number(total) : bytes.length };
}

export type VerifyResult = { ok: true } | { ok: false; message: string };

export async function verifyStoredImage(db: ReturnType<typeof adminDb>, path: string, format: ImageFormat): Promise<VerifyResult> {
  const reject = async (message: string) => {
    await db.storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
    return { ok: false as const, message };
  };

  const head = await readObjectHead(path);
  if (!head) return { ok: false, message: "The upload didn't finish. Please try again." };
  if (detectImageFormat(head.bytes) !== format) return reject("That file isn't a JPEG, PNG, WebP or AVIF image.");
  if (head.size > MAX_IMAGE_BYTES) return reject("Use an image under 10 MB.");
  return { ok: true };
}
