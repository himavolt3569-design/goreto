"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { databaseErrorResult, type ActionResult } from "../auth";
import { categoryFormSchema } from "../catalog-forms";
import { removeUploadedImage, resolveImageChange } from "../catalog-images";
import { adminDb } from "../queries/shared";
import { authorizeAndParse, NOT_UPDATED, revalidateStorefrontCatalog } from "./helpers";

/*
 * Category create/edit/delete (admin phase 2, RLS: catalog.write). The
 * database keeps the tree two levels deep and refuses deleting categories
 * that still have products or subcategories.
 */

const categoryId = z.uuid();

/** Readable errors from the trigger (22023, DETAIL = field) and the slug index. */
function saveErrorResult(error: { code?: string; message: string; details?: string | null }): ActionResult {
  if (error.code === "22023" && error.details) return { ok: false, message: error.message, fieldErrors: { [error.details]: error.message } };
  if (error.code === "23505" && error.message.includes("slug")) {
    const message = "Another category already uses this URL slug";
    return { ok: false, message, fieldErrors: { slug: message } };
  }
  return databaseErrorResult(error, "save category");
}

function revalidateCategory(...slugs: (string | null | undefined)[]) {
  revalidateStorefrontCatalog();
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/categories/${slug}`);
}

type Saved = { ok: true; created: { id: string; title: string; parentId: string | null } | null } | { ok: false; result: ActionResult };

/** Shared by the page form and the pop-up: authorize, validate, check the image, write. */
async function persistCategory(formData: FormData): Promise<Saved> {
  const rawId = formData.get("categoryId");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id !== null && !categoryId.safeParse(id).success) return { ok: false, result: NOT_UPDATED };

  const input = await authorizeAndParse("catalog.write", categoryFormSchema, formData);
  if (!input.ok) return { ok: false, result: input.result };
  const values = input.data;
  if (id !== null && values.parentId === id) {
    const message = "A category can't be its own parent";
    return { ok: false, result: { ok: false, message, fieldErrors: { parentId: message } } };
  }

  const db = adminDb();
  const current = id === null ? null : (await db.from("categories").select("slug, image_path").eq("id", id).maybeSingle()).data;
  if (id !== null && !current) return { ok: false, result: NOT_UPDATED };

  const image = await resolveImageChange(
    db,
    "category",
    id === null ? { stagingId: values.stagingId } : { recordId: id },
    current?.image_path ?? null,
    values.imagePath,
  );
  if (!image.ok) return { ok: false, result: { ok: false, message: image.message, fieldErrors: { imagePath: image.message } } };

  const row = {
    title: values.title,
    slug: values.slug,
    parent_id: values.parentId,
    description: values.description,
    image_path: image.path,
    is_active: values.isActive,
    sort_order: values.sortOrder,
  };

  if (id === null) {
    const { data, error } = await db.from("categories").insert(row).select("id").single();
    if (error) return { ok: false, result: saveErrorResult(error) };
    revalidateCategory(values.slug);
    return { ok: true, created: { id: data.id, title: values.title, parentId: values.parentId } };
  }

  const { data, error } = await db.from("categories").update(row).eq("id", id).select("id");
  if (error) return { ok: false, result: saveErrorResult(error) };
  if (data.length !== 1) return { ok: false, result: NOT_UPDATED };

  await removeUploadedImage(db, "category", image.replaced);
  revalidateCategory(current?.slug, values.slug);
  return { ok: true, created: null };
}

/** Create (no `categoryId` field) or update a category. Creating redirects to its edit page. */
export async function saveCategoryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const saved = await persistCategory(formData);
  if (!saved.ok) return saved.result;
  if (saved.created) redirect(`/admin/categories/${saved.created.id}/edit?created=1`);
  refresh();
  return { ok: true, message: "Category saved." };
}

/** The parent comes along so a dropdown can show "Parent › Child" before the page refresh arrives. */
export type CreatedCategory = { id: string; title: string; parentId: string | null; parent?: { id: string; title: string } };
export type InlineCategoryResult = (ActionResult & { ok: false }) | { ok: true; message: string; category: CreatedCategory };

/**
 * Create a category from the "+ Create new category" pop-up. Returns the new
 * category instead of redirecting; the refresh brings it into every dropdown
 * on the page.
 */
export async function createCategoryInlineAction(_previous: InlineCategoryResult | null, formData: FormData): Promise<InlineCategoryResult> {
  if (formData.get("categoryId")) return { ok: false, message: "Invalid request" };
  const saved = await persistCategory(formData);
  if (!saved.ok) return saved.result.ok ? { ok: false, message: "Something went wrong. Please try again." } : saved.result;
  const category: CreatedCategory = { ...saved.created! };
  if (category.parentId) {
    const { data: parent } = await adminDb().from("categories").select("id, title").eq("id", category.parentId).maybeSingle();
    if (parent) category.parent = parent;
  }
  refresh();
  return { ok: true, message: `${category.title} created.`, category };
}

const deleteSchema = z.object({ categoryId });

export async function deleteCategoryAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("catalog.write", deleteSchema, formData);
  if (!input.ok) return input.result;

  const db = adminDb();
  const { data: existing } = await db.from("categories").select("slug").eq("id", input.data.categoryId).maybeSingle();
  const { data: imagePath, error } = await db.rpc("admin_delete_category", { p_category_id: input.data.categoryId });
  if (error) return databaseErrorResult(error, "delete category");

  await removeUploadedImage(db, "category", imagePath);
  revalidateCategory(existing?.slug);
  redirect("/admin/categories?deleted=1");
}
