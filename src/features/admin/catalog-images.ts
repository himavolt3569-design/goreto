import "server-only";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/media/storage";
import { parseUploadedImagePath, type CatalogImageKind } from "./catalog-forms";
import { verifyStoredImage } from "./media-verify";
import type { adminDb } from "./queries/shared";

/*
 * The single image of a category or collection. The form sends back an
 * object key; the server accepts it only if it is unchanged, empty, or an
 * upload on the path this record (or this form session) was given, with
 * verified bytes. Old files are removed only when the admin uploaded them;
 * seed images are left for `seed:purge`.
 */

type Db = ReturnType<typeof adminDb>;

export type ImageChange =
  | { ok: true; path: string | null; replaced: string | null }
  | { ok: false; message: string };

export async function resolveImageChange(
  db: Db,
  kind: CatalogImageKind,
  owner: { recordId: string } | { stagingId: string | undefined },
  previous: string | null,
  next: string | null,
): Promise<ImageChange> {
  if (next === previous) return { ok: true, path: next, replaced: null };
  if (next === null) return { ok: true, path: null, replaced: previous };

  const parsed = parseUploadedImagePath(kind, next);
  const expected = "recordId" in owner ? { staged: false, ownerId: owner.recordId } : { staged: true, ownerId: owner.stagingId };
  if (!parsed || parsed.staged !== expected.staged || parsed.ownerId !== expected.ownerId) {
    return { ok: false, message: "That image upload isn't valid. Upload it again." };
  }
  const verified = await verifyStoredImage(db, next, parsed.format);
  if (!verified.ok) return verified;
  return { ok: true, path: next, replaced: previous };
}

/** Deletes an image file the admin uploaded; anything else (seed files, null) is left alone. */
export async function removeUploadedImage(db: Db, kind: CatalogImageKind, path: string | null): Promise<void> {
  if (!path || !parseUploadedImagePath(kind, path)) return;
  const { error } = await db.storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
  // The record is saved either way; a leftover file is only storage.
  if (error) console.error(`Admin action: a replaced ${kind} image was not removed from storage`);
}
