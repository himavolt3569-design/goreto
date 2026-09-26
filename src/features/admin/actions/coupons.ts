"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { databaseErrorResult, type ActionResult } from "../auth";
import { couponFormSchema, couponRow } from "../delivery-forms";
import { adminDb } from "../queries/shared";
import { authorizeAndParse, NOT_UPDATED, saveErrorResult } from "./helpers";

/*
 * Coupon create/edit/delete (admin phase 3, RLS: promotions.manage). The
 * database locks the code and type of a coupon orders used, and refuses
 * deleting it. Checkout (later) re-validates coupons when an order is placed.
 */

const couponId = z.uuid();

const UNIQUE = { coupons_code_key: { field: "code", message: "Another coupon already uses this code" } };

/** Create (no `couponId` field) or update a coupon. Creating redirects to its edit page. */
export async function saveCouponAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const rawId = formData.get("couponId");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id !== null && !couponId.safeParse(id).success) return NOT_UPDATED;

  const input = await authorizeAndParse("promotions.manage", couponFormSchema, formData);
  if (!input.ok) return input.result;
  const row = couponRow(input.data);
  const db = adminDb();

  if (id === null) {
    const { data, error } = await db.from("coupons").insert(row).select("id").single();
    if (error) return saveErrorResult(error, "create coupon", UNIQUE);
    redirect(`/admin/coupons/${data.id}/edit?created=1`);
  }

  const { data, error } = await db.from("coupons").update(row).eq("id", id).select("id");
  if (error) return saveErrorResult(error, "update coupon", UNIQUE);
  if (data.length !== 1) return NOT_UPDATED;

  refresh();
  return { ok: true, message: "Coupon saved." };
}

const deleteSchema = z.object({ couponId });

export async function deleteCouponAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("promotions.manage", deleteSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().from("coupons").delete().eq("id", input.data.couponId).select("id");
  if (error) return databaseErrorResult(error, "delete coupon");
  if (data.length !== 1) return NOT_UPDATED;
  redirect("/admin/coupons?deleted=1");
}
