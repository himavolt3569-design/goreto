import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkTabs, PageHeader, Pagination, Panel } from "@/components/admin/admin-ui";
import { AutopilotCard } from "@/components/admin/parcels/autopilot-card";
import { ParcelRefresh } from "@/components/admin/parcels/parcel-actions";
import { ParcelList } from "@/components/admin/parcels/parcel-list";
import { SendDesk } from "@/components/admin/parcels/send-desk";
import { buttonClasses } from "@/components/ui/button";
import { LightningIcon, MagnifyingGlassIcon, PackageIcon } from "@/components/ui/icons";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { SearchInput } from "@/components/ui/search-input";
import { requireAdminAccess } from "@/features/admin/auth";
import { canAccess } from "@/features/admin/nav";
import { autopilotState } from "@/features/admin/parcels";
import { fetchAutopilotStatus, fetchDarazServiceIds, fetchParcelDeskContext, fetchParcels, PARCEL_VIEWS, type ParcelView } from "@/features/admin/queries/parcels";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { fetchStoreSettings } from "@/features/admin/queries/system";
import { hrefWith } from "@/features/admin/url";
import { getNepalAddressData } from "@/features/delivery/nepal-address-data";
import { SEARCH_MAX_LENGTH } from "@/features/admin/search-input";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Send & track" };

const VIEW_LABELS: Record<ParcelView, string> = { open: "Open", delivered: "Delivered", all: "All" };

/**
 * Send & track (prompts/goreto-send-and-track.md): enter an order and send it
 * to its courier in one click, then follow every parcel on the same page.
 * Reading needs orders.read; sending needs orders.write; Autopilot needs
 * settings.manage and delivery.manage.
 */
export default async function ParcelsPage({ searchParams }: PageProps<"/admin/parcels">) {
  const profile = await requireAdminAccess("orders.read");
  const params = await searchParams;
  const view = pickEnum(params.view, PARCEL_VIEWS) ?? "open";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, SEARCH_MAX_LENGTH) : "";
  const page = pageNumber(params.page);
  const canWrite = canAccess(profile, "orders.write");
  const canAutopilot = canAccess(profile, "settings.manage") && canAccess(profile, "delivery.manage");

  const [parcels, context, autopilot, desk] = await Promise.all([
    fetchParcels({ view, q, page }),
    fetchParcelDeskContext(),
    canAutopilot ? fetchAutopilotStatus() : Promise.resolve(null),
    canWrite ? Promise.all([getNepalAddressData(), fetchStoreSettings(), fetchDarazServiceIds()]) : Promise.resolve(null),
  ]);

  const searching = q.length >= 2;
  const openDaraz = parcels.rows.filter((row) => row.courier?.daraz && row.shipment?.booked && row.shipment.status !== "delivered" && row.shipment.status !== "returned");
  const autopilotOn = autopilot ? autopilotState(autopilot).state : null;

  return (
    <>
      <PageHeader
        title="Send & track"
        description="Type the order and press Send. Goreto accepts it, sends it to the right courier and keeps tracking it here."
        eyebrow={
          autopilotOn ? (
            <Link
              href="#autopilot"
              className={cn(
                "inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-small font-medium",
                autopilotOn === "on" ? "bg-success-100 text-success-700" : autopilotOn === "partly" ? "bg-warning-100 text-warning-700" : "bg-neutral-100 text-neutral-700",
              )}
            >
              <LightningIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
              Autopilot {autopilotOn === "on" ? "on" : autopilotOn === "partly" ? "partly on" : "off"}
            </Link>
          ) : null
        }
      />

      {desk ? (
        <SendDesk
          address={desk[0]}
          canLinkCustomer={canAccess(profile, "customers.read")}
          codEnabled={desk[1]?.cod_enabled ?? false}
          darazServiceIds={desk[2]}
          usualWeightGrams={context.usualWeightGrams}
          initiallyOpen={params.new === "1"}
        />
      ) : null}

      <Panel
        title="Parcels"
        description={context.darazConnected ? "Daraz tracking updates by itself. The newest parcels are first." : "Newest first. Daraz Express isn't connected yet, so Daraz parcels wait to be booked."}
        action={canWrite && context.darazConnected ? <ParcelRefresh staleOrderIds={parcels.rows.filter((row) => row.stale).map((row) => row.orderId)} openOrderIds={openDaraz.map((row) => row.orderId)} /> : null}
      >
        <form method="get" role="search" className="flex flex-col gap-2 px-6 pb-4 md:flex-row md:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor="parcel-q" className="text-small font-medium text-neutral-700">
              Find a parcel
            </label>
            <SearchInput id="parcel-q" name="q" defaultValue={q} placeholder="Order number, phone, name or tracking number" maxLength={SEARCH_MAX_LENGTH} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClasses({ variant: "primary", size: "md" })}>
              Search
            </button>
            {q ? (
              <Link href="/admin/parcels" className={buttonClasses({ variant: "tertiary", size: "md" })}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {searching ? (
          <p className="px-6 pb-2 text-body text-neutral-500">
            {parcels.total === 0 ? "No parcels match" : `${parcels.total} ${parcels.total === 1 ? "parcel matches" : "parcels match"}`} &ldquo;{q}&rdquo;, in every status.
          </p>
        ) : (
          <div className="px-6">
            <LinkTabs
              label="Which parcels"
              tabs={PARCEL_VIEWS.map((value) => ({
                label: VIEW_LABELS[value],
                href: hrefWith("/admin/parcels", {}, { view: value === "open" ? null : value }),
                active: view === value,
              }))}
            />
          </div>
        )}

        {parcels.rows.length === 0 ? (
          searching ? (
            <EmptyState icon={MagnifyingGlassIcon} title="Nothing found" description="Check the number, or search by the customer's phone or name." />
          ) : (
            <EmptyState
              icon={PackageIcon}
              title={view === "delivered" ? "No delivered parcels yet" : view === "open" ? "No parcels on the way" : "No parcels yet"}
              description={canWrite ? "Press New order to send the first one." : undefined}
            />
          )
        ) : (
          <>
            <ParcelList rows={parcels.rows} context={context} canWrite={canWrite} canManageDelivery={canAccess(profile, "delivery.manage")} />
            <Pagination pathname="/admin/parcels" params={params} page={parcels.page} pageCount={parcels.pageCount} total={parcels.total} noun="parcels" />
          </>
        )}
      </Panel>

      {autopilot ? (
        <section id="autopilot" aria-label="Autopilot" className="scroll-mt-24">
          <AutopilotCard status={autopilot} canChange={canAutopilot} />
        </section>
      ) : null}
    </>
  );
}
