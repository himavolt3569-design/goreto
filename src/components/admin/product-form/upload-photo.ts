import { createProductMediaUploadAction } from "@/features/admin/actions/products";
import { detectImageFormat, IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES, SIGNATURE_BYTES } from "@/features/admin/product-form/file-signature";

/*
 * Browser half of a photo upload (AGENTS §18.3–18.4): pre-check the file's
 * bytes and size, ask the server for a signed URL on a path it chooses, and
 * PUT the file straight to Storage. The server verifies the stored bytes
 * again before the photo joins a gallery.
 */

const MIN_RECOMMENDED_EDGE = 800;

export type UploadTarget = { productId: string } | { stagingId: string };

export type UploadedPhoto = { ok: true; path: string; warning?: string } | { ok: false; message: string };

/** Short side in pixels, or null when the browser can't decode the format. */
async function shortestEdge(file: File): Promise<number | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const edge = Math.min(bitmap.width, bitmap.height);
    bitmap.close();
    return edge;
  } catch {
    return null;
  }
}

export async function uploadPhotoFile(target: UploadTarget, file: File): Promise<UploadedPhoto> {
  const format = detectImageFormat(new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer()));
  if (!format) return { ok: false, message: "Not a JPEG, PNG, WebP or AVIF image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "Larger than 10 MB." };
  const edge = await shortestEdge(file);

  const contentType = IMAGE_CONTENT_TYPES[format];
  const ticket = await createProductMediaUploadAction({ ...target, contentType, size: file.size });
  if (!ticket.ok) return { ok: false, message: ticket.message };

  const body = new FormData();
  body.append("cacheControl", "31536000");
  body.append("", new Blob([file], { type: contentType }));
  const upload = await fetch(ticket.signedUrl, { method: "PUT", body, headers: { "x-upsert": "false" } }).catch(() => null);
  if (!upload?.ok) return { ok: false, message: "The upload failed. Check your connection and try again." };

  return edge !== null && edge < MIN_RECOMMENDED_EDGE
    ? { ok: true, path: ticket.path, warning: `It's ${edge}px on the short side; ${MIN_RECOMMENDED_EDGE}px or more looks sharper.` }
    : { ok: true, path: ticket.path };
}

export const ACCEPTED_IMAGE_TYPES = Object.values(IMAGE_CONTENT_TYPES).join(",");
