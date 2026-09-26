import "server-only";
import type { Database } from "@/types/database";
import type { StaffPermission } from "@/lib/auth/permissions";
import { adminDb, fail } from "./shared";

/* Delivery configuration (delivery.manage), staff (owner) and store settings. */

export type CourierRow = {
  id: string;
  name: string;
  slug: string;
  integrationMode: Database["public"]["Enums"]["courier_integration_mode"];
  supportPhone: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  services: {
    id: string;
    name: string;
    code: string;
    level: Database["public"]["Enums"]["service_level"];
    minDays: number;
    maxDays: number;
    isActive: boolean;
  }[];
};

export async function fetchCouriers(): Promise<CourierRow[]> {
  const { data, error } = await adminDb()
    .from("couriers")
    .select(
      "id, name, slug, integration_mode, support_phone, website_url, is_active, courier_services(id, name, service_code, service_level, estimated_min_days, estimated_max_days, is_active)",
    )
    .order("name")
    .order("name", { referencedTable: "courier_services" });
  if (error) fail("couriers", error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    integrationMode: row.integration_mode,
    supportPhone: row.support_phone,
    websiteUrl: row.website_url,
    isActive: row.is_active,
    services: row.courier_services.map((service) => ({
      id: service.id,
      name: service.name,
      code: service.service_code,
      level: service.service_level,
      minDays: service.estimated_min_days,
      maxDays: service.estimated_max_days,
      isActive: service.is_active,
    })),
  }));
}

export type ZoneRow = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  districts: string[];
  rateCount: number;
};

export async function fetchZones(): Promise<ZoneRow[]> {
  const [zones, districts] = await Promise.all([
    adminDb().from("delivery_zones").select("id, name, description, district_codes, is_active, sort_order, delivery_rates(count)").order("sort_order"),
    adminDb().from("nepal_districts").select("code, name"),
  ]);
  if (zones.error) fail("zones", zones.error);
  if (districts.error) fail("districts", districts.error);
  const names = new Map(districts.data.map((district) => [district.code, district.name]));
  return zones.data.map((zone) => ({
    id: zone.id,
    name: zone.name,
    description: zone.description,
    isActive: zone.is_active,
    districts: zone.district_codes.map((code) => names.get(code) ?? code).sort((a, b) => a.localeCompare(b)),
    rateCount: zone.delivery_rates[0]?.count ?? 0,
  }));
}

export type RateRow = {
  id: string;
  zoneName: string;
  courierName: string;
  serviceName: string;
  serviceLevel: Database["public"]["Enums"]["service_level"];
  pricePaisa: number;
  minDays: number;
  maxDays: number;
  minOrderPaisa: number | null;
  weightRange: string | null;
  isActive: boolean;
  zoneOrder: number;
};

export async function fetchRates(): Promise<RateRow[]> {
  const { data, error } = await adminDb()
    .from("delivery_rates")
    .select(
      "id, price_paisa, estimated_min_days, estimated_max_days, min_weight_grams, max_weight_grams, min_order_paisa, is_active, delivery_zones(name, sort_order), courier_services(name, service_level, estimated_min_days, estimated_max_days, couriers(name))",
    );
  if (error) fail("rates", error);
  return data
    .map((row) => {
      const service = row.courier_services;
      const weight =
        row.min_weight_grams !== null || row.max_weight_grams !== null
          ? `${row.min_weight_grams ?? 0}–${row.max_weight_grams ?? "∞"} g`
          : null;
      return {
        id: row.id,
        zoneName: row.delivery_zones?.name ?? "—",
        zoneOrder: row.delivery_zones?.sort_order ?? 0,
        courierName: service?.couriers?.name ?? "—",
        serviceName: service?.name ?? "—",
        serviceLevel: service?.service_level ?? "standard",
        pricePaisa: row.price_paisa,
        minDays: row.estimated_min_days ?? service?.estimated_min_days ?? 0,
        maxDays: row.estimated_max_days ?? service?.estimated_max_days ?? 0,
        minOrderPaisa: row.min_order_paisa,
        weightRange: weight,
        isActive: row.is_active,
      };
    })
    .sort((a, b) => a.zoneOrder - b.zoneOrder || a.pricePaisa - b.pricePaisa);
}

export type StaffMember = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: "owner" | "staff";
  createdAt: string;
  permissions: StaffPermission[];
};

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data, error } = await adminDb()
    .from("profiles")
    .select("id, full_name, email, role, created_at, staff_permissions!staff_permissions_profile_id_fkey(permission_key)")
    .in("role", ["owner", "staff"])
    .is("deleted_at", null)
    .order("role")
    .order("created_at");
  if (error) fail("staff", error);
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role === "owner" ? "owner" : "staff",
    createdAt: row.created_at,
    permissions: row.staff_permissions.map((permission) => permission.permission_key),
  }));
}

export type StoreSettings = Database["public"]["Tables"]["store_settings"]["Row"];

export async function fetchStoreSettings(): Promise<StoreSettings | null> {
  const { data, error } = await adminDb().from("store_settings").select("*").eq("singleton", true).maybeSingle();
  if (error) fail("store settings", error);
  return data;
}

export type StaffInvitation = {
  id: string;
  email: string;
  permissions: StaffPermission[];
  createdAt: string;
  expiresAt: string;
};

/** Pending invitations, newest first (owner only by RLS). Expired ones stay until revoked. */
export async function fetchStaffInvitations(): Promise<StaffInvitation[]> {
  const { data, error } = await adminDb()
    .from("staff_invitations")
    .select("id, email, permissions, created_at, expires_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) fail("staff invitations", error);
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    permissions: row.permissions,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}
