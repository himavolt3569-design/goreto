import "server-only";
import { getPublicSupabase } from "@/lib/supabase/public";

/** Public store settings the checkout and tracking pages show. */
export type StorefrontInfo = {
  codEnabled: boolean;
  returnsWindowDays: number;
  supportEmail: string | null;
  supportPhoneE164: string | null;
};

export async function getStorefrontInfo(): Promise<StorefrontInfo> {
  const { data, error } = await getPublicSupabase()
    .from("store_settings")
    .select("cod_enabled, returns_window_days, support_email, support_phone_e164")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load store settings: ${error.message}`);

  return {
    codEnabled: data?.cod_enabled ?? false,
    returnsWindowDays: data?.returns_window_days ?? 7,
    supportEmail: data?.support_email ?? null,
    supportPhoneE164: data?.support_phone_e164 ?? null,
  };
}
