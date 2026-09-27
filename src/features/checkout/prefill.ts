import "server-only";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getUserSupabase } from "@/lib/supabase/server";
import type { CheckoutFormValues } from "./schemas";

export const EMPTY_CHECKOUT: CheckoutFormValues = {
  fullName: "",
  email: "",
  phone: "",
  provinceCode: "",
  districtCode: "",
  municipalityCode: "",
  ward: "",
  streetLandmark: "",
  postalCode: "",
  latitude: null,
  longitude: null,
  courierServiceId: "",
  couponCode: "",
  note: "",
};

function nationalNumber(e164: string | null | undefined): string {
  return e164?.startsWith("+977") ? e164.slice(4) : "";
}

/**
 * Starting values for checkout. Signed-in shoppers get their name, email and
 * default saved address (AGENTS §9.1), read through RLS as themselves.
 * Guests start empty. Every value stays editable.
 */
export async function getCheckoutDefaults(): Promise<CheckoutFormValues> {
  const profile = await getCurrentProfile().catch(() => null);
  if (!profile) return EMPTY_CHECKOUT;

  const { data: address } = await getUserSupabase()
    .from("customer_addresses")
    .select("recipient_name, phone_e164, province_code, district_code, municipality_code, ward, street_landmark, postal_code, latitude, longitude")
    .eq("user_id", profile.id)
    .eq("is_default", true)
    .maybeSingle();

  return {
    ...EMPTY_CHECKOUT,
    fullName: address?.recipient_name ?? profile.fullName ?? "",
    email: profile.email ?? "",
    phone: nationalNumber(address?.phone_e164),
    ...(address
      ? {
          provinceCode: address.province_code,
          districtCode: address.district_code,
          municipalityCode: address.municipality_code,
          ward: String(address.ward),
          streetLandmark: address.street_landmark,
          postalCode: address.postal_code ?? "",
          latitude: address.latitude,
          longitude: address.longitude,
        }
      : {}),
  };
}
