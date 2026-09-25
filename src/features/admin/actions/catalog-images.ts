"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/media/storage";
import { authorizeAdmin, deniedResult } from "../auth";
import { imageFolder } from "../catalog-forms";
import { formatForContentType, IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from "../product-form/file-signature";
import { adminDb } from "../queries/shared";
import type { UploadTicket } from "./products";

/*
 * Signed upload for a category image (catalog.write) or a collection hero
 * image (content.manage), on a path the server picks (AGENTS §18.3). The
 * save action verifies the stored bytes before the image is used.
 */

const uploadRequestSchema = z
  .object({
    kind: z.enum(["category", "collection"]),
    /** The record being edited... */
    ownerId: z.uuid().optional(),
    /** ...or the create form's staging id. */
    stagingId: z.uuid().optional(),
    contentType: z.enum(Object.values(IMAGE_CONTENT_TYPES) as [string, ...string[]], "Use a JPEG, PNG, WebP or AVIF image"),
    size: z.number().int().min(1, "The file is empty").max(MAX_IMAGE_BYTES, "Use an image under 10 MB"),
  })
  .refine((request) => Boolean(request.ownerId) !== Boolean(request.stagingId), "Invalid upload");

export async function createCatalogImageUploadAction(request: unknown): Promise<UploadTicket> {
  const parsed = uploadRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That file can't be uploaded." };
  const { kind, ownerId, stagingId, contentType } = parsed.data;

  const auth = await authorizeAdmin(kind === "category" ? "catalog.write" : "content.manage");
  if (!auth.ok) {
    const denied = deniedResult(auth.reason);
    return { ok: false, message: denied.ok ? "" : denied.message };
  }

  const db = adminDb();
  if (ownerId) {
    const table = kind === "category" ? "categories" : "collections";
    const { data: record } = await db.from(table).select("id").eq("id", ownerId).maybeSingle();
    if (!record) return { ok: false, message: "This record no longer exists. Refresh the page." };
  }

  const folder = imageFolder(kind, ownerId ? { ownerId } : { stagingId: stagingId! });
  const path = `${folder}/${randomUUID()}.${formatForContentType(contentType)!}`;
  // Signed with the caller's token, so the Storage insert policy applies.
  const { data, error } = await db.storage.from(PRODUCT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error(`Admin action failed (sign ${kind} image upload)`);
    return { ok: false, message: "The upload couldn't start. Please try again." };
  }
  return { ok: true, path, signedUrl: data.signedUrl };
}
