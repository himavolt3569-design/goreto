import "server-only";
import { getUserSupabase } from "@/lib/supabase/server";
import { formatAddressLines, type NepalAddressData } from "@/features/delivery/nepal-address";
import type { AddressFormValues } from "./address-schema";

/*
 * Saved addresses through the Clerk-token client (AGENTS §4.9, §10.8). RLS
 * would also show staff with customers.read other people's addresses, so
 * every read filters on the caller's own profile.
 */

export type SavedAddress = {
  id: string;
  label: string;
  recipientName: string;
  phoneE164: string;
  provinceCode: string;
  districtCode: string;
  municipalityCode: string;
  ward: number;
  streetLandmark: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
};

const SELECT =
  "id, label, recipient_name, phone_e164, province_code, district_code, municipality_code, ward, street_landmark, postal_code, latitude, longitude, is_default";

type Row = {
  id: string;
  label: string;
  recipient_name: string;
  phone_e164: string;
  province_code: string;
  district_code: string;
  municipality_code: string;
  ward: number;
  street_landmark: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

function toSavedAddress(row: Row): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    phoneE164: row.phone_e164,
    provinceCode: row.province_code,
    districtCode: row.district_code,
    municipalityCode: row.municipality_code,
    ward: row.ward,
    streetLandmark: row.street_landmark,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    isDefault: row.is_default,
  };
}

function fail(what: string, error: { message: string; code?: string }): never {
  throw new Error(`Address query failed (${what}): ${error.code ?? ""} ${error.message}`.trim());
}

/** The profile's addresses: default first, then newest. */
export async function fetchAddresses(profileId: string): Promise<SavedAddress[]> {
  const { data, error } = await getUserSupabase()
    .from("customer_addresses")
    .select(SELECT)
    .eq("user_id", profileId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id");
  if (error) fail("list", error);
  return data.map(toSavedAddress);
}

function nationalNumber(e164: string): string {
  return e164.startsWith("+977") ? e164.slice(4) : e164;
}

/** Form values for editing a saved address (the +977 prefix is shown by the field). */
export function toAddressFormValues(address: SavedAddress): AddressFormValues {
  return {
    label: address.label,
    recipientName: address.recipientName,
    phone: nationalNumber(address.phoneE164),
    provinceCode: address.provinceCode,
    districtCode: address.districtCode,
    municipalityCode: address.municipalityCode,
    ward: String(address.ward),
    streetLandmark: address.streetLandmark,
    postalCode: address.postalCode ?? "",
    latitude: address.latitude,
    longitude: address.longitude,
    makeDefault: address.isDefault,
  };
}

/** Display lines with names from the canonical Nepal data (codes are kept if a name is missing). */
export function addressLines(address: SavedAddress, data: NepalAddressData): string[] {
  const municipality = data.municipalities.find((item) => item.code === address.municipalityCode);
  const district = data.districts.find((item) => item.code === address.districtCode);
  const province = data.provinces.find((item) => item.code === address.provinceCode);
  const lines = formatAddressLines({
    streetLandmark: address.streetLandmark,
    municipalityName: municipality?.name ?? address.municipalityCode,
    ward: address.ward,
    districtName: district?.name ?? address.districtCode,
    provinceName: province?.name ?? address.provinceCode,
    postalCode: address.postalCode,
  });
  return [lines.line1, lines.line2, lines.line3, ...(lines.postal ? [lines.postal] : [])];
}
