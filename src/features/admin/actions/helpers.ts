import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { CATALOG_CACHE_TAG } from "@/features/catalog/categories";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import type { AdminAccess } from "../nav";
import { fieldErrors, formValues } from "../schemas";

/*
 * Shared steps for admin Server Actions: authorize against the database
 * profile, parse FormData with Zod, and refresh the storefront pages whose
 * cached data a change affects (AGENTS §18.7: targeted, never global).
 */

type Parsed<T> = { ok: true; data: T; profileId: string } | { ok: false; result: ActionResult };

export async function authorizeAndParse<Schema extends z.ZodType>(
  access: AdminAccess | readonly AdminAccess[],
  schema: Schema,
  formData: FormData,
): Promise<Parsed<z.infer<Schema>>> {
  const auth = await authorizeAdmin(access);
  if (!auth.ok) return { ok: false, result: deniedResult(auth.reason) };

  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      ok: false,
      result: { ok: false, message: Object.values(errors)[0] ?? "Check the form and try again.", fieldErrors: errors },
    };
  }
  return { ok: true, data: parsed.data, profileId: auth.profile.id };
}

/**
 * Catalog visibility changed: the homepage, category pages and (optionally)
 * one product page. `expire: 0` so a product staff just hid is never served
 * stale to the next shopper.
 */
export function revalidateStorefrontCatalog(productSlug?: string | null): void {
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/categories");
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}

export const NOT_UPDATED: ActionResult = {
  ok: false,
  message: "Nothing was updated. The record may have been removed, or you no longer have access.",
};

type DatabaseError = { code?: string; message: string; details?: string | null };

/**
 * Save errors shown on the right field: trigger/function validation (22023,
 * DETAIL = field name) and unique violations, matched by constraint name.
 */
export function saveErrorResult(
  error: DatabaseError,
  action: string,
  unique: Record<string, { field: string; message: string }> = {},
): ActionResult {
  if (error.code === "22023" && error.details) return { ok: false, message: error.message, fieldErrors: { [error.details]: error.message } };
  if (error.code === "23505") {
    const match = Object.entries(unique).find(([constraint]) => error.message.includes(constraint));
    if (match) {
      const [, { field, message }] = match;
      return { ok: false, message, fieldErrors: { [field]: message } };
    }
  }
  return databaseErrorResult(error, action);
}
