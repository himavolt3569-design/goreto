import "server-only";
import type { Database } from "@/types/database";
import { paisaToRupeesInput } from "@/lib/money/parse";
import { adminDb, fail } from "./shared";

/*
 * Add/Edit courier, service, zone and rate (delivery.manage). Form values are
 * the strings the inputs hold.
 */

type ServiceLevel = Database["public"]["Enums"]["service_level"];

/* ---------- History (orders and shipments that used a courier or service) ---------- */

export type DeliveryHistory = { services: Map<string, number>; couriers: Map<string, number> };

export async function fetchDeliveryHistory(): Promise<DeliveryHistory> {
  const { data, error } = await adminDb().rpc("admin_delivery_history_counts");
  if (error) fail("delivery history", error);
  const history: DeliveryHistory = { services: new Map(), couriers: new Map() };
  for (const row of data) {
    (row.record_type === "courier" ? history.couriers : history.services).set(row.record_id, Number(row.use_count));
  }
  return history;
}

/* ---------- Couriers ---------- */

export type CourierFormValues = { title: string; slug: string; supportPhone: string; websiteUrl: string; isActive: boolean };

export const EMPTY_COURIER_VALUES: CourierFormValues = { title: "", slug: "", supportPhone: "", websiteUrl: "", isActive: true };

export type CourierServiceValues = {
  id: string;
  name: string;
  serviceCode: string;
  level: ServiceLevel;
  description: string;
  minDays: number;
  maxDays: number;
  isActive: boolean;
  rateCount: number;
  /** Orders and shipments that used it: can't be deleted. */
  useCount: number;
};

export type CourierEditorData = {
  id: string;
  values: CourierFormValues;
  integrationMode: Database["public"]["Enums"]["courier_integration_mode"];
  services: CourierServiceValues[];
  shipmentCount: number;
  updatedAt: string;
};

export async function fetchCourierEditor(id: string): Promise<CourierEditorData | null> {
  const [courier, history] = await Promise.all([
    adminDb()
      .from("couriers")
      .select(
        "id, name, slug, support_phone, website_url, integration_mode, is_active, updated_at, courier_services(id, name, service_code, service_level, description, estimated_min_days, estimated_max_days, is_active, delivery_rates(count))",
      )
      .eq("id", id)
      .order("name", { referencedTable: "courier_services" })
      .maybeSingle(),
    fetchDeliveryHistory(),
  ]);
  if (courier.error) fail("courier editor", courier.error);
  const row = courier.data;
  if (!row) return null;

  return {
    id: row.id,
    values: { title: row.name, slug: row.slug, supportPhone: row.support_phone ?? "", websiteUrl: row.website_url ?? "", isActive: row.is_active },
    integrationMode: row.integration_mode,
    services: row.courier_services.map((service) => ({
      id: service.id,
      name: service.name,
      serviceCode: service.service_code,
      level: service.service_level,
      description: service.description,
      minDays: service.estimated_min_days,
      maxDays: service.estimated_max_days,
      isActive: service.is_active,
      rateCount: service.delivery_rates[0]?.count ?? 0,
      useCount: history.services.get(service.id) ?? 0,
    })),
    shipmentCount: history.couriers.get(row.id) ?? 0,
    updatedAt: row.updated_at,
  };
}

/* ---------- Zones ---------- */

export type ZoneFormValues = { title: string; slug: string; description: string; sortOrder: number; isActive: boolean; districtCodes: string[] };

export type DistrictChoice = { code: string; name: string; zone: { id: string; name: string } | null };
export type ProvinceDistricts = { code: string; name: string; districts: DistrictChoice[] };

/** All districts by province, each with the zone that already covers it. */
export async function fetchDistrictGroups(): Promise<ProvinceDistricts[]> {
  const db = adminDb();
  const [provinces, districts, zones] = await Promise.all([
    db.from("nepal_provinces").select("code, name, sort_order").order("sort_order"),
    db.from("nepal_districts").select("code, name, province_code").order("name"),
    db.from("delivery_zones").select("id, name, district_codes"),
  ]);
  if (provinces.error) fail("provinces", provinces.error);
  if (districts.error) fail("districts", districts.error);
  if (zones.error) fail("zones", zones.error);

  const zoneOf = new Map<string, { id: string; name: string }>();
  for (const zone of zones.data) for (const code of zone.district_codes) zoneOf.set(code, { id: zone.id, name: zone.name });

  return provinces.data.map((province) => ({
    code: province.code,
    name: province.name,
    districts: districts.data
      .filter((district) => district.province_code === province.code)
      .map((district) => ({ code: district.code, name: district.name, zone: zoneOf.get(district.code) ?? null })),
  }));
}

export type ZoneEditorData = { id: string; values: ZoneFormValues; rateCount: number; updatedAt: string };

export async function fetchZoneEditor(id: string): Promise<ZoneEditorData | null> {
  const { data, error } = await adminDb()
    .from("delivery_zones")
    .select("id, name, slug, description, sort_order, is_active, district_codes, updated_at, delivery_rates(count)")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("zone editor", error);
  if (!data) return null;
  return {
    id: data.id,
    values: {
      title: data.name,
      slug: data.slug,
      description: data.description,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      districtCodes: data.district_codes,
    },
    rateCount: data.delivery_rates[0]?.count ?? 0,
    updatedAt: data.updated_at,
  };
}

/* ---------- Rates ---------- */

export type RateFormValues = {
  zoneId: string;
  serviceId: string;
  price: string;
  minDays: string;
  maxDays: string;
  minOrder: string;
  minWeight: string;
  maxWeight: string;
  isActive: boolean;
};

export function emptyRateValues(zoneId = "", serviceId = ""): RateFormValues {
  return { zoneId, serviceId, price: "", minDays: "", maxDays: "", minOrder: "", minWeight: "", maxWeight: "", isActive: true };
}

export type RateZoneOption = { id: string; name: string; isActive: boolean };
export type RateServiceOption = { id: string; name: string; code: string; courierName: string; isActive: boolean; minDays: number; maxDays: number };
export type RateOptions = {
  zones: RateZoneOption[];
  services: RateServiceOption[];
  /** `${zoneId}:${serviceId}` -> rate id, to point at the existing rate for a pair. */
  existing: Record<string, string>;
};

export async function fetchRateOptions(): Promise<RateOptions> {
  const db = adminDb();
  const [zones, services, rates] = await Promise.all([
    db.from("delivery_zones").select("id, name, is_active, sort_order").order("sort_order").order("name"),
    db.from("courier_services").select("id, name, service_code, is_active, estimated_min_days, estimated_max_days, couriers(name, is_active)"),
    db.from("delivery_rates").select("id, zone_id, courier_service_id"),
  ]);
  if (zones.error) fail("rate zones", zones.error);
  if (services.error) fail("rate services", services.error);
  if (rates.error) fail("rate pairs", rates.error);

  return {
    zones: zones.data.map((zone) => ({ id: zone.id, name: zone.name, isActive: zone.is_active })),
    services: services.data
      .map((service) => ({
        id: service.id,
        name: service.name,
        code: service.service_code,
        courierName: service.couriers?.name ?? "—",
        isActive: service.is_active && (service.couriers?.is_active ?? false),
        minDays: service.estimated_min_days,
        maxDays: service.estimated_max_days,
      }))
      .sort((a, b) => a.courierName.localeCompare(b.courierName) || a.name.localeCompare(b.name)),
    existing: Object.fromEntries(rates.data.map((rate) => [`${rate.zone_id}:${rate.courier_service_id}`, rate.id])),
  };
}

export type RateEditorData = { id: string; values: RateFormValues; zoneName: string; serviceLabel: string; updatedAt: string };

const numberInput = (value: number | null) => (value === null ? "" : String(value));

export async function fetchRateEditor(id: string): Promise<RateEditorData | null> {
  const { data, error } = await adminDb()
    .from("delivery_rates")
    .select(
      "id, zone_id, courier_service_id, price_paisa, estimated_min_days, estimated_max_days, min_order_paisa, min_weight_grams, max_weight_grams, is_active, updated_at, delivery_zones(name), courier_services(name, couriers(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail("rate editor", error);
  if (!data) return null;
  return {
    id: data.id,
    values: {
      zoneId: data.zone_id,
      serviceId: data.courier_service_id,
      price: paisaToRupeesInput(data.price_paisa),
      minDays: numberInput(data.estimated_min_days),
      maxDays: numberInput(data.estimated_max_days),
      minOrder: paisaToRupeesInput(data.min_order_paisa),
      minWeight: numberInput(data.min_weight_grams),
      maxWeight: numberInput(data.max_weight_grams),
      isActive: data.is_active,
    },
    zoneName: data.delivery_zones?.name ?? "—",
    serviceLabel: `${data.courier_services?.couriers?.name ?? "—"} · ${data.courier_services?.name ?? "—"}`,
    updatedAt: data.updated_at,
  };
}
