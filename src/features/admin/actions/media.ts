"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { AR_ASSETS_BUCKET, PRODUCT_MEDIA_BUCKET } from "@/lib/media/storage";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { searchPickerProducts, type ProductSearchResult } from "../queries/collection-editor";
import { adminDb } from "../queries/shared";
import { authorizeAndParse } from "./helpers";

/*
 * Media library actions (prompts/goreto-admin-media-ar.md): the product
 * search for uploading from /admin/media, and deleting uploads nothing uses.
 * Photo upload itself reuses the product editor's upload and attach actions.
 */

export async function searchMediaProductsAction(query: unknown): Promise<ProductSearchResult> {
  const auth = await authorizeAdmin("catalog.write");
  if (!auth.ok) {
    const denied = deniedResult(auth.reason);
    return { ok: false, message: denied.ok ? "" : denied.message };
  }
  return searchPickerProducts(query, "search media products");
}

/** Deleted per click; the rest wait for the next click. */
const CLEANUP_LIMIT = 500;
/** Keys per Storage remove request. */
const REMOVE_BATCH = 100;

const BUCKET_ACCESS = { [PRODUCT_MEDIA_BUCKET]: "catalog.write", [AR_ASSETS_BUCKET]: "ar.manage" } as const;

const cleanupSchema = z.object({ bucket: z.enum([PRODUCT_MEDIA_BUCKET, AR_ASSETS_BUCKET]) });

/**
 * Deletes uploads older than 24 hours that no record uses. The list is read
 * fresh from the database here, never taken from the browser, so a file
 * attached since the page loaded is not removed. Deletes go through the
 * Storage API with the caller's token (Storage RLS applies).
 */
export async function cleanUpStorageAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const bucket = cleanupSchema.safeParse({ bucket: formData.get("bucket") });
  if (!bucket.success) return { ok: false, message: "Unknown storage area." };
  const input = await authorizeAndParse(BUCKET_ACCESS[bucket.data.bucket], cleanupSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data, error } = await db.rpc("admin_orphaned_storage_objects", { p_bucket: input.data.bucket }).limit(CLEANUP_LIMIT);
  if (error) return databaseErrorResult(error, "list unused uploads");
  if (data.length === 0) return { ok: true, message: "Nothing to clean up." };

  const names = data.map((row) => row.name);
  let removed = 0;
  for (let start = 0; start < names.length; start += REMOVE_BATCH) {
    const batch = names.slice(start, start + REMOVE_BATCH);
    const { data: deleted, error: removeError } = await db.storage.from(input.data.bucket).remove(batch);
    if (removeError) {
      console.error(`Admin action: unused uploads were not removed from ${input.data.bucket}`);
      break;
    }
    removed += deleted.length;
  }

  refresh();
  if (removed === 0) return { ok: false, message: "The files couldn't be deleted. Please try again." };
  const noun = removed === 1 ? "unused file" : "unused files";
  return { ok: true, message: `Deleted ${removed.toLocaleString("en-IN")} ${noun}.` };
}
