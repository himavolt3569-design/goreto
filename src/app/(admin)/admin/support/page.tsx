import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/admin-ui";
import { NAV_ICONS } from "@/components/admin/sidebar-nav";
import { ActivePill, Pill } from "@/components/admin/status-pills";
import { EnvelopeSimpleIcon, PhoneIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatNepalPhone } from "@/features/admin/format";
import { ADMIN_NAV, canAccess } from "@/features/admin/nav";
import { fetchCouriers, fetchStoreSettings } from "@/features/admin/queries/system";

export const metadata: Metadata = { title: "Support" };

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], mac: ["⌘", "K"], action: "Focus the admin search" },
  { keys: ["Esc"], action: "Close a menu or dialog" },
  { keys: ["←", "→"], action: "Read values on a focused chart" },
  { keys: ["↑", "↓"], action: "Move between menu items" },
];

/** Operator help: store contacts, what's configured, shortcuts and where things live. */
export default async function SupportPage() {
  const profile = await requireAdminAccess("admin");
  const canDelivery = canAccess(profile, "delivery.manage");
  const [settings, couriers] = await Promise.all([fetchStoreSettings(), canDelivery ? fetchCouriers() : Promise.resolve(null)]);
  const photoProvider = Boolean(process.env.AR_PROVIDER);
  const activeCouriers = couriers?.filter((courier) => courier.isActive) ?? [];

  const sections = ADMIN_NAV.flatMap((group) => group.items)
    .filter((item) => item.href !== "/admin/support" && canAccess(profile, item.access));

  return (
    <>
      <PageHeader title="Support" description="Store contacts, system status and a map of the admin." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Store contacts" description="What customers see as your support details." bodyClassName="gap-4 px-6 pb-6">
          {settings?.support_email || settings?.support_phone_e164 ? (
            <ul className="flex flex-col gap-3 text-body">
              {settings.support_email ? (
                <li className="flex items-center gap-3">
                  <EnvelopeSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                  <a href={`mailto:${settings.support_email}`} className="rounded-xs text-primary-600 hover:underline">
                    {settings.support_email}
                  </a>
                </li>
              ) : null}
              {settings.support_phone_e164 ? (
                <li className="flex items-center gap-3">
                  <PhoneIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                  <a href={`tel:${settings.support_phone_e164}`} className="rounded-xs text-primary-600 hover:underline">
                    {formatNepalPhone(settings.support_phone_e164)}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-body text-neutral-500">No support email or phone is set yet.</p>
          )}
          {canAccess(profile, "settings.manage") ? (
            <Link href="/admin/settings" className="w-fit rounded-xs text-body font-medium text-primary-600 hover:underline">
              Edit store contacts
            </Link>
          ) : null}
        </Panel>

        <Panel title="System status" description="Configuration only; secrets are never shown." bodyClassName="px-6 pb-6">
          <dl className="flex flex-col divide-y divide-neutral-100 text-body">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <dt className="text-neutral-700">Cash on Delivery</dt>
              <dd>{settings ? <ActivePill active={settings.cod_enabled} activeLabel="Accepting orders" inactiveLabel="Paused" /> : <Pill tone="error">Settings missing</Pill>}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-neutral-700">Online payments</dt>
              <dd>
                <Pill tone="neutral">Not offered (COD only)</Pill>
              </dd>
            </div>
            {couriers ? (
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-neutral-700">Couriers</dt>
                <dd className="text-right text-neutral-900">
                  {activeCouriers.length} active · {activeCouriers.every((courier) => courier.integrationMode === "manual") ? "manual tracking" : "API tracking for some"}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-neutral-700">Live AR try-on</dt>
              <dd>
                <Pill tone="success">Runs in the shopper&apos;s browser</Pill>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <dt className="text-neutral-700">Photo try-on provider</dt>
              <dd>
                <ActivePill active={photoProvider} activeLabel="Configured" inactiveLabel="Not configured" />
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Keyboard shortcuts" bodyClassName="px-6 pb-6">
          <dl className="flex flex-col gap-3 text-body">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.action} className="flex items-center justify-between gap-4">
                <dt className="text-neutral-700">{shortcut.action}</dt>
                <dd className="flex gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd key={key} className="rounded-xs border border-neutral-200 bg-neutral-50 px-2 py-1 font-sans text-small font-medium text-neutral-700">
                      {key}
                    </kbd>
                  ))}
                  {shortcut.mac ? <span className="sr-only">(Command K on Mac)</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Where things live" bodyClassName="px-6 pb-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {sections.map((item) => {
              const ItemIcon = NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link href={item.href} className="flex h-11 items-center gap-3 rounded-md px-3 text-body text-neutral-900 hover:bg-neutral-100">
                    <ItemIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
