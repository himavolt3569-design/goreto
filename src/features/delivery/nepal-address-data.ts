import "server-only";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { NepalAddressData } from "./nepal-address";

/**
 * The canonical Nepal geography from the database (public reference data,
 * read with the anonymous client). Sorted for display.
 */
export async function getNepalAddressData(): Promise<NepalAddressData> {
  const supabase = getPublicSupabase();
  const [provinces, districts, municipalities] = await Promise.all([
    supabase.from("nepal_provinces").select("code, name").order("sort_order").order("number"),
    supabase.from("nepal_districts").select("code, province_code, name").order("name"),
    supabase.from("nepal_municipalities").select("code, district_code, name, ward_count, postal_code").order("name"),
  ]);
  const error = provinces.error ?? districts.error ?? municipalities.error;
  if (error) throw new Error(`Could not load Nepal addresses: ${error.message}`);

  return {
    provinces: provinces.data ?? [],
    districts: (districts.data ?? []).map((row) => ({ code: row.code, provinceCode: row.province_code, name: row.name })),
    municipalities: (municipalities.data ?? []).map((row) => ({
      code: row.code,
      districtCode: row.district_code,
      name: row.name,
      wardCount: row.ward_count,
      postalCode: row.postal_code,
    })),
  };
}
