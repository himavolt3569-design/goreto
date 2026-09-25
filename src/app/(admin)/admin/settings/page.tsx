import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/admin-ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { ArrowRightIcon, GearSixIcon } from "@/components/ui/icons";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { requireAdminAccess } from "@/features/admin/auth";
import { canAccess } from "@/features/admin/nav";
import { fetchStoreSettings } from "@/features/admin/queries/system";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireAdminAccess("settings.manage");
  const settings = await fetchStoreSettings();

  const related = [
    { label: "Delivery zones, couriers and rates", href: "/admin/delivery", show: canAccess(profile, "delivery.manage") },
    { label: "AR try-on assets", href: "/admin/ar", show: canAccess(profile, "ar.manage") },
    { label: "Staff roles and permissions", href: "/admin/staff", show: canAccess(profile, "owner") },
  ].filter((link) => link.show);

  return (
    <>
      <PageHeader title="Settings" description="Store profile, Nepal defaults and checkout rules. API keys stay in the server environment and never appear here." />
      {settings ? (
        <SettingsForm
          currency={settings.currency}
          timezone={settings.timezone}
          phoneCountryCode={settings.phone_country_code}
          values={{
            storeName: settings.store_name,
            tagline: settings.tagline ?? "",
            supportEmail: settings.support_email ?? "",
            supportPhone: settings.support_phone_e164 ?? "",
            codEnabled: settings.cod_enabled,
            codMaxOrderRupees: settings.cod_max_order_paisa ? String(Math.trunc(settings.cod_max_order_paisa / 100)) : "",
            returnsWindowDays: settings.returns_window_days,
            lowStockThreshold: settings.default_low_stock_threshold,
          }}
        />
      ) : (
        <Card>
          <EmptyState icon={GearSixIcon} title="Store settings are missing" description="The settings row hasn't been created. Load the store seed or run the setup migration." />
        </Card>
      )}

      {related.length > 0 ? (
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="text-h3 text-neutral-900">More settings</h2>
          <ul className="flex flex-col gap-2">
            {related.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex items-center gap-2 rounded-xs text-body font-medium text-primary-600 hover:underline">
                  {link.label}
                  <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
