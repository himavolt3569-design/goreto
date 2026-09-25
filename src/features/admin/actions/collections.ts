"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorizeAdmin, databaseErrorResult, type ActionResult } from "../auth";
import { collectionFormSchema } from "../catalog-forms";
import { removeUploadedImage, resolveImageChange } from "../catalog-images";
import { mapPickerProduct, PICKER_PRODUCT_COLUMNS, type PickerProduct } from "../queries/collection-editor";
import { adminDb } from "../queries/shared";
import { containsPattern, sanitizeSearch } from "../search-input";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog } from "./helpers";

/*
 * Collection create/edit/delete (admin phase 2, RLS: content.manage). The
 * collection row and its ordered products are saved together by
 * admin_save_collection. Collections show on the homepage carousel while
 * live, so saves refresh the catalog tag and the homepage.
 */

const collectionId = z.uuid();

type SaveRpcResult = { id: string; slug: string; previous_slug: string | null };

function saveErrorResult(error: { code?: string; message: string; details?: string | null }): ActionResult {
  if (error.code === "22023" && error.details) return { ok: false, message: error.message, fieldErrors: { [error.details]: error.message } };
  if (error.code === "23505" && error.message.includes("slug")) {
    const message = "Another collection already uses this URL slug";
    return { ok: false, message, fieldErrors: { slug: message } };
  }
  return databaseErrorResult(error, "save collection");
}

/** Create (no `collectionId` field) or update a collection. Creating redirects to its edit page. */
export async function saveCollectionAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const rawId = formData.get("collectionId");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id !== null && !collectionId.safeParse(id).success) return NOT_UPDATED;

  const input = await authorizeAndParse("content.manage", collectionFormSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;

  const db = adminDb();
  const current = id === null ? null : (await db.from("collections").select("hero_image_path").eq("id", id).maybeSingle()).data;
  if (id !== null && !current) return NOT_UPDATED;

  const image = await resolveImageChange(
    db,
    "collection",
    id === null ? { stagingId: values.stagingId } : { recordId: id },
    current?.hero_image_path ?? null,
    values.heroImagePath,
  );
  if (!image.ok) return { ok: false, message: image.message, fieldErrors: { heroImagePath: image.message } };

  const { data, error } = await db.rpc("admin_save_collection", {
    p_collection_id: id as string,
    p_collection: {
      title: values.title,
      slug: values.slug,
      eyebrow: values.eyebrow,
      description: values.description,
      hero_image_path: image.path,
      hero_image_alt: image.path ? values.heroImageAlt : "",
      sort_order: values.sortOrder,
      is_active: values.isActive,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
    },
    p_product_ids: values.productIds,
  });
  if (error) return saveErrorResult(error);
  const result = data as SaveRpcResult;

  await removeUploadedImage(db, "collection", image.replaced);
  revalidateStorefrontCatalog();
  if (id === null) redirect(`/admin/promotions/${result.id}/edit?created=1`);
  refresh();
  return { ok: true, message: "Collection saved." };
}

const deleteSchema = z.object({ collectionId });

export async function deleteCollectionAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("content.manage", deleteSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data, error } = await db.from("collections").delete().eq("id", input.data.collectionId).select("hero_image_path");
  if (error) return databaseErrorResult(error, "delete collection");
  if (data.length !== 1) return NOT_UPDATED;

  await removeUploadedImage(db, "collection", data[0]!.hero_image_path);
  revalidateStorefrontCatalog();
  redirect("/admin/promotions?deleted=1");
}

export type ProductSearchResult = { ok: true; products: PickerProduct[] } | { ok: false; message: string };

/** Products whose name contains `query`, for the collection editor's picker (at most 20). */
export async function searchCollectionProductsAction(query: unknown): Promise<ProductSearchResult> {
  const auth = await authorizeAdmin("content.manage");
  if (!auth.ok) return { ok: false, message: "You don't have permission to do that." };
  const term = sanitizeSearch(query);
  if (term.length < 2) return { ok: true, products: [] };

  const { data, error } = await adminDb()
    .from("products")
    .select(PICKER_PRODUCT_COLUMNS)
    .ilike("title", containsPattern(term))
    .neq("status", "archived")
    .order("title")
    .order("sort_order", { referencedTable: "product_media" })
    .limit(1, { referencedTable: "product_media" })
    .limit(20);
  if (error) {
    console.error(`Admin action failed (search collection products): ${error.code ?? "unknown"}`);
    return { ok: false, message: "Search didn't work. Please try again." };
  }
  return { ok: true, products: data.map(mapPickerProduct) };
}
