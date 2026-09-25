"use server";

import { refresh } from "next/cache";
import { databaseErrorResult, type ActionResult } from "../auth";
import { adminDb } from "../queries/shared";
import { staffPermissionSchema, storeSettingsSchema, toggleSchema } from "../schemas";
import { authorizeAndParse, NOT_UPDATED } from "./helpers";

/* Delivery configuration (delivery.manage), staff permissions (owner), store settings (settings.manage). */

type DeliveryTable = "couriers" | "courier_services" | "delivery_zones" | "delivery_rates";

async function setDeliveryActive(table: DeliveryTable, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", toggleSchema, formData);
  if (!input.ok) return input.result;

  const { data, error } = await adminDb().from(table).update({ is_active: input.data.value }).eq("id", input.data.id).select("id");
  if (error) return databaseErrorResult(error, `set ${table} active`);
  if (data.length !== 1) return NOT_UPDATED;

  refresh();
  return { ok: true };
}

export async function setCourierActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setDeliveryActive("couriers", formData);
}

export async function setCourierServiceActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setDeliveryActive("courier_services", formData);
}

export async function setZoneActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setDeliveryActive("delivery_zones", formData);
}

export async function setRateActiveAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setDeliveryActive("delivery_rates", formData);
}

export async function setStaffPermissionAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("owner", staffPermissionSchema, formData);
  if (!input.ok) return input.result;
  const { profileId, permission, value } = input.data;

  const db = adminDb();
  const { data: target, error: targetError } = await db
    .from("profiles")
    .select("role, deleted_at")
    .eq("id", profileId)
    .maybeSingle();
  if (targetError) return databaseErrorResult(targetError, "load staff member");
  if (!target || target.role !== "staff" || target.deleted_at) {
    return { ok: false, message: "Permissions can be changed only for active staff members." };
  }

  const { error } = value
    ? await db
        .from("staff_permissions")
        .upsert(
          { profile_id: profileId, permission_key: permission, granted_by: input.profileId },
          { onConflict: "profile_id,permission_key", ignoreDuplicates: true },
        )
    : await db.from("staff_permissions").delete().eq("profile_id", profileId).eq("permission_key", permission);
  if (error) return databaseErrorResult(error, "set staff permission");

  refresh();
  return { ok: true };
}

export async function updateStoreSettingsAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("settings.manage", storeSettingsSchema, formData);
  if (!input.ok) return input.result;
  const settings = input.data;

  const { data, error } = await adminDb()
    .from("store_settings")
    .update({
      store_name: settings.storeName,
      tagline: settings.tagline,
      support_email: settings.supportEmail,
      support_phone_e164: settings.supportPhone,
      cod_enabled: settings.codEnabled,
      cod_max_order_paisa: settings.codMaxOrder,
      returns_window_days: settings.returnsWindowDays,
      default_low_stock_threshold: settings.lowStockThreshold,
    })
    .eq("singleton", true)
    .select("id");
  if (error) return databaseErrorResult(error, "update store settings");
  if (data.length !== 1) return NOT_UPDATED;

  refresh();
  return { ok: true, message: "Settings saved." };
}
