"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { databaseErrorResult, type ActionResult } from "../auth";
import { courierFormSchema, courierServiceFormSchema, rateFormSchema, zoneFormSchema } from "../delivery-forms";
import { adminDb } from "../queries/shared";
import { authorizeAndParse, NOT_UPDATED, saveErrorResult } from "./helpers";

/*
 * Courier, service, zone and rate create/edit/delete (admin phase 3, RLS:
 * delivery.manage). The database keeps each district in one zone and refuses
 * deleting couriers and services that orders or shipments used. No
 * storefront page reads this configuration yet; checkout will read it fresh.
 */

const recordId = z.uuid();

/** The record id from a hidden field: null = create; undefined = invalid. */
function editedId(formData: FormData, field: string): string | null | undefined {
  const raw = formData.get(field);
  if (typeof raw !== "string" || raw === "") return null;
  return recordId.safeParse(raw).success ? raw : undefined;
}

/* ---------- Couriers ---------- */

const COURIER_UNIQUE = { couriers_slug_key: { field: "slug", message: "Another courier already uses this slug" } };

export async function saveCourierAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const id = editedId(formData, "courierId");
  if (id === undefined) return NOT_UPDATED;
  const input = await authorizeAndParse("delivery.manage", courierFormSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;
  // integration_mode stays as stored: API integrations aren't built (worklog §4.5).
  const row = { name: values.title, slug: values.slug, support_phone: values.supportPhone, website_url: values.websiteUrl, is_active: values.isActive };
  const db = adminDb();

  if (id === null) {
    const { data, error } = await db.from("couriers").insert(row).select("id").single();
    if (error) return saveErrorResult(error, "create courier", COURIER_UNIQUE);
    redirect(`/admin/delivery/couriers/${data.id}/edit?created=1`);
  }

  const { data, error } = await db.from("couriers").update(row).eq("id", id).select("id");
  if (error) return saveErrorResult(error, "update courier", COURIER_UNIQUE);
  if (data.length !== 1) return NOT_UPDATED;
  refresh();
  return { ok: true, message: "Courier saved." };
}

export async function deleteCourierAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", z.object({ courierId: recordId }), formData);
  if (!input.ok) return input.result;
  const { data, error } = await adminDb().from("couriers").delete().eq("id", input.data.courierId).select("id");
  if (error) return databaseErrorResult(error, "delete courier");
  if (data.length !== 1) return NOT_UPDATED;
  redirect("/admin/delivery?deleted=1");
}

/* ---------- Courier services ---------- */

const SERVICE_UNIQUE = {
  courier_services_service_code_key: { field: "serviceCode", message: "Another service already uses this code" },
};

/** Add or edit a service from the dialog on the courier's page. */
export async function saveCourierServiceAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", courierServiceFormSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;
  const row = {
    name: values.name,
    service_code: values.serviceCode,
    service_level: values.level,
    description: values.description,
    estimated_min_days: values.minDays,
    estimated_max_days: values.maxDays,
    is_active: values.isActive,
  };
  const db = adminDb();

  if (values.serviceId === null) {
    const { error } = await db.from("courier_services").insert({ ...row, courier_id: values.courierId });
    if (error) return saveErrorResult(error, "create courier service", SERVICE_UNIQUE);
    refresh();
    return { ok: true, message: `${values.name} added.` };
  }

  // Scoped to the courier, so a service can't be moved to another courier.
  const { data, error } = await db.from("courier_services").update(row).eq("id", values.serviceId).eq("courier_id", values.courierId).select("id");
  if (error) return saveErrorResult(error, "update courier service", SERVICE_UNIQUE);
  if (data.length !== 1) return NOT_UPDATED;
  refresh();
  return { ok: true, message: `${values.name} saved.` };
}

export async function deleteCourierServiceAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", z.object({ serviceId: recordId }), formData);
  if (!input.ok) return input.result;
  const { data, error } = await adminDb().from("courier_services").delete().eq("id", input.data.serviceId).select("id");
  if (error) return databaseErrorResult(error, "delete courier service");
  if (data.length !== 1) return NOT_UPDATED;
  refresh();
  return { ok: true, message: "Service deleted." };
}

/* ---------- Zones ---------- */

const ZONE_UNIQUE = { delivery_zones_slug_key: { field: "slug", message: "Another zone already uses this slug" } };

export async function saveZoneAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const id = editedId(formData, "zoneId");
  if (id === undefined) return NOT_UPDATED;
  const input = await authorizeAndParse("delivery.manage", zoneFormSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;
  const row = {
    name: values.title,
    slug: values.slug,
    description: values.description,
    sort_order: values.sortOrder,
    is_active: values.isActive,
    district_codes: values.districtCodes,
  };
  const db = adminDb();

  if (id === null) {
    const { data, error } = await db.from("delivery_zones").insert(row).select("id").single();
    if (error) return saveErrorResult(error, "create zone", ZONE_UNIQUE);
    redirect(`/admin/delivery/zones/${data.id}/edit?created=1`);
  }

  const { data, error } = await db.from("delivery_zones").update(row).eq("id", id).select("id");
  if (error) return saveErrorResult(error, "update zone", ZONE_UNIQUE);
  if (data.length !== 1) return NOT_UPDATED;
  refresh();
  return { ok: true, message: "Zone saved." };
}

export async function deleteZoneAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", z.object({ zoneId: recordId }), formData);
  if (!input.ok) return input.result;
  const { data, error } = await adminDb().from("delivery_zones").delete().eq("id", input.data.zoneId).select("id");
  if (error) return databaseErrorResult(error, "delete zone");
  if (data.length !== 1) return NOT_UPDATED;
  redirect("/admin/delivery/zones?deleted=1");
}

/* ---------- Rates ---------- */

const RATE_UNIQUE = {
  delivery_rates_zone_id_courier_service_id_key: { field: "serviceId", message: "This zone already has a rate for that service" },
};

export async function saveRateAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const id = editedId(formData, "rateId");
  if (id === undefined) return NOT_UPDATED;
  const input = await authorizeAndParse("delivery.manage", rateFormSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;
  const row = {
    zone_id: values.zoneId,
    courier_service_id: values.serviceId,
    price_paisa: values.price,
    estimated_min_days: values.minDays,
    estimated_max_days: values.maxDays,
    min_order_paisa: values.minOrder,
    min_weight_grams: values.minWeight,
    max_weight_grams: values.maxWeight,
    is_active: values.isActive,
  };
  const db = adminDb();

  if (id === null) {
    const { data, error } = await db.from("delivery_rates").insert(row).select("id").single();
    if (error) return saveErrorResult(error, "create rate", RATE_UNIQUE);
    redirect(`/admin/delivery/rates/${data.id}/edit?created=1`);
  }

  const { data, error } = await db.from("delivery_rates").update(row).eq("id", id).select("id");
  if (error) return saveErrorResult(error, "update rate", RATE_UNIQUE);
  if (data.length !== 1) return NOT_UPDATED;
  refresh();
  return { ok: true, message: "Rate saved." };
}

export async function deleteRateAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", z.object({ rateId: recordId }), formData);
  if (!input.ok) return input.result;
  const { data, error } = await adminDb().from("delivery_rates").delete().eq("id", input.data.rateId).select("id");
  if (error) return databaseErrorResult(error, "delete rate");
  if (data.length !== 1) return NOT_UPDATED;
  redirect("/admin/delivery/rates?deleted=1");
}
