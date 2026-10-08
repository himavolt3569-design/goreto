import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkTabs, PageHeader, Pagination, Panel, StatCard, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import {
  CopyValue,
  DarazSettingsForm,
  DarazShipmentsTable,
  DeleteSettlementButton,
  LinkAccountForm,
  RateSupportCase,
  RecordSettlementForm,
  SetupChecklist,
  SupportCaseDetail,
  SyncWarehouseButton,
  TestConnectionButton,
} from "@/components/admin/daraz-dashboard";
import { SupportDialog } from "@/components/admin/daraz-shipment-panel";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  HeadsetIcon,
  MoneyIcon,
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
  WarningCircleIcon,
} from "@/components/ui/icons";
import { requireAdminAccess } from "@/features/admin/auth";
import { boxPresetsText } from "@/features/admin/daraz-forms";
import { formatCount, formatDate, formatDateTime } from "@/features/admin/format";
import { canAccess } from "@/features/admin/nav";
import {
  bookingAccount,
  fetchApiLog,
  fetchCourierOverview,
  fetchDarazSettings,
  fetchDarazShipments,
  fetchRemittances,
  fetchSupportCases,
  fetchUnsettledParcels,
  SHIPMENT_VIEWS,
  type ShipmentView,
} from "@/features/admin/queries/daraz";
import { pageNumber, pickEnum } from "@/features/admin/queries/shared";
import { hrefWith } from "@/features/admin/url";
import { darazConfig, isLiveDaraz } from "@/lib/courier/daraz/config";
import { formatNpr } from "@/lib/money/format";
import { formatNepalPhone } from "@/lib/validation/phone";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Daraz Express" };

const TABS = ["overview", "shipments", "action", "settlements", "support", "activity", "setup"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  shipments: "Shipments",
  action: "Needs action",
  settlements: "COD settlements",
  support: "Support cases",
  activity: "Activity",
  setup: "Setup",
};

const VIEW_LABELS: Record<ShipmentView, string> = {
  to_book: "To book",
  booked: "Booked",
  with_daraz: "With Daraz",
  needs_action: "Needs action",
  delivered: "Delivered",
  returned: "Returned",
  all: "All",
};

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://goreto-kappa.vercel.app").replace(/\/+$/, "");
}

/**
 * Daraz Express (docs/couriers/daraz.md §10): the integration dashboard for
 * booking, labels, tracking, failed deliveries, COD settlements, support
 * cases, API activity and setup. Shipping work needs orders.write; setup
 * needs delivery.manage.
 */
export default async function DarazPage({ searchParams }: PageProps<"/admin/daraz">) {
  const profile = await requireAdminAccess("orders.read");
  const params = await searchParams;
  const canWrite = canAccess(profile, "orders.write");
  const canSetup = canAccess(profile, "delivery.manage");
  const tab = pickEnum(params.tab, TABS) ?? "overview";
  const page = pageNumber(params.page);
  const config = darazConfig();

  const tabs = TABS.filter((value) => value !== "setup" || canSetup).map((value) => ({
    label: TAB_LABELS[value],
    href: hrefWith("/admin/daraz", {}, { tab: value === "overview" ? null : value }),
    active: tab === value,
  }));

  return (
    <>
      <PageHeader
        title="Daraz Express"
        description="Book, label and track parcels with Daraz Express (DEX), handle failed deliveries, and match COD payouts."
        eyebrow={
          <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-small font-medium", config ? (isLiveDaraz(config) ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-700") : "bg-neutral-100 text-neutral-700")}>
            {config ? (isLiveDaraz(config) ? "Connected to Daraz" : "Connected to a test gateway") : "Not connected"}
          </span>
        }
      />
      <LinkTabs label="Daraz Express sections" tabs={tabs} />

      {tab === "overview" ? <Overview canSetup={canSetup} /> : null}
      {tab === "shipments" || tab === "action" ? (
        <Shipments view={tab === "action" ? "needs_action" : (pickEnum(params.view, SHIPMENT_VIEWS) ?? "to_book")} page={page} params={params} canWrite={canWrite} fixed={tab === "action"} />
      ) : null}
      {tab === "settlements" ? <Settlements page={page} params={params} canWrite={canWrite} isOwner={profile.role === "owner"} /> : null}
      {tab === "support" ? <Support page={page} params={params} canWrite={canWrite} /> : null}
      {tab === "activity" ? <Activity page={page} params={params} failuresOnly={params.failures === "1"} /> : null}
      {tab === "setup" && canSetup ? <Setup /> : null}
    </>
  );
}

async function Overview({ canSetup }: { canSetup: boolean }) {
  const overview = await fetchCourierOverview();
  const link = (view: ShipmentView) => hrefWith("/admin/daraz", {}, { tab: "shipments", view });
  const cards = [
    { label: "To book", value: overview.to_book, hint: "Accepted, not booked yet", icon: PackageIcon, tone: "primary" as const, href: link("to_book") },
    { label: "Booked, not ready", value: overview.booked_not_ready, hint: "Print labels, then Ready to ship", icon: ReceiptIcon, tone: "primary" as const, href: link("booked") },
    { label: "Awaiting pickup", value: overview.awaiting_pickup, hint: "Ready to ship", icon: ClockCounterClockwiseIcon, tone: "info" as const, href: link("booked") },
    { label: "With Daraz", value: overview.in_transit + overview.out_for_delivery, hint: `${formatCount(overview.out_for_delivery)} out for delivery`, icon: TruckIcon, tone: "info" as const, href: link("with_daraz") },
    { label: "Needs action", value: overview.needs_action, hint: "Failed deliveries and exceptions", icon: WarningCircleIcon, tone: overview.needs_action > 0 ? ("warning" as const) : ("neutral" as const), href: "/admin/daraz?tab=action" },
    { label: "Delivered (7 days)", value: overview.delivered_7d, hint: `${formatCount(overview.returned_30d)} returned in 30 days`, icon: CheckCircleIcon, tone: "success" as const, href: link("delivered") },
  ];

  const health = [
    { label: "API keys", ok: Boolean(darazConfig()), value: darazConfig() ? "Set" : "Missing" },
    { label: "Last tracking sync", ok: overview.last_synced_at !== null, value: overview.last_synced_at ? formatDateTime(overview.last_synced_at) : "Never" },
    { label: "Last webhook", ok: overview.webhook_errors_24h === 0, value: overview.last_webhook_at ? formatDateTime(overview.last_webhook_at) : "None received (tracking still syncs on schedule)" },
    { label: "API calls (24 h)", ok: overview.api_failures_24h === 0, value: `${formatCount(overview.api_calls_24h)} calls, ${formatCount(overview.api_failures_24h)} failed` },
    { label: "Daraz location IDs", ok: overview.mapped_municipalities > 0, value: `${formatCount(overview.mapped_municipalities)} of ${formatCount(overview.total_municipalities)} municipalities` },
  ];

  return (
    <>
      <section aria-label="Shipments" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary-500">
            <StatCard label={card.label} value={formatCount(card.value)} hint={card.hint} icon={card.icon} tone={card.tone} />
          </Link>
        ))}
      </section>

      <section aria-label="Money" className="grid gap-6 sm:grid-cols-2">
        <Link href="/admin/daraz?tab=settlements" className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary-500">
          <StatCard label="COD with Daraz" value={formatNpr(overview.cod_unsettled_paisa)} hint={`${formatCount(overview.cod_unsettled_count)} delivered parcels not in a recorded payout`} icon={MoneyIcon} tone="warning" />
        </Link>
        <StatCard label="Daraz fees this month" value={formatNpr(overview.fees_month_paisa)} hint="Reported by Daraz for parcels delivered this month" icon={ReceiptIcon} tone="neutral" />
      </section>

      <Panel title="Connection health" bodyClassName="px-6 pb-6">
        <dl className="grid gap-x-6 gap-y-3 text-body sm:grid-cols-[auto_1fr]">
          {health.map((item) => (
            <div key={item.label} className="contents">
              <dt className="flex items-center gap-2 text-neutral-500">
                {item.ok ? (
                  <CheckCircleIcon aria-hidden="true" size={18} weight="fill" className="text-success-700" />
                ) : (
                  <WarningCircleIcon aria-hidden="true" size={18} className="text-warning-700" />
                )}
                {item.label}
              </dt>
              <dd className="text-neutral-900">{item.value}</dd>
            </div>
          ))}
        </dl>
        {canSetup ? (
          <p className="mt-4 text-small text-neutral-500">
            Configure the connection under{" "}
            <Link href="/admin/daraz?tab=setup" className="font-medium text-primary-600 hover:text-primary-700">
              Setup
            </Link>
            .
          </p>
        ) : null}
      </Panel>
    </>
  );
}

async function Shipments({
  view,
  page,
  params,
  canWrite,
  fixed,
}: {
  view: ShipmentView;
  page: number;
  params: Record<string, string | string[] | undefined>;
  canWrite: boolean;
  fixed: boolean;
}) {
  const shipments = await fetchDarazShipments(view, page);
  const viewTabs = SHIPMENT_VIEWS.filter((value) => value !== "needs_action").map((value) => ({
    label: VIEW_LABELS[value],
    href: hrefWith("/admin/daraz", {}, { tab: "shipments", view: value }),
    active: view === value,
  }));

  return (
    <>
      {!fixed ? <LinkTabs label="Shipment status" tabs={viewTabs} /> : null}
      <Panel title={`${formatCount(shipments.total)} ${fixed ? "parcels need a decision" : `${VIEW_LABELS[view].toLowerCase()} shipments`}`}>
        {shipments.rows.length === 0 ? (
          <EmptyState
            icon={TruckIcon}
            title={fixed ? "Nothing needs action" : "No shipments here"}
            description={fixed ? "Failed deliveries and courier exceptions appear here." : "Accept orders with Daraz Express as the courier to book them here."}
          />
        ) : (
          <>
            <DarazShipmentsTable rows={shipments.rows} canWrite={canWrite} />
            <Pagination pathname="/admin/daraz" params={params} page={shipments.page} pageCount={shipments.pageCount} total={shipments.total} noun="shipments" />
          </>
        )}
      </Panel>
    </>
  );
}

async function Settlements({ page, params, canWrite, isOwner }: { page: number; params: Record<string, string | string[] | undefined>; canWrite: boolean; isOwner: boolean }) {
  const [remittances, unsettled] = await Promise.all([fetchRemittances(page), fetchUnsettledParcels()]);
  const unsettledTotal = unsettled.reduce((sum, parcel) => sum + parcel.totalPaisa, 0);

  return (
    <>
      <section aria-label="COD with Daraz" className="grid gap-6 sm:grid-cols-2">
        <StatCard label="COD with Daraz" value={formatNpr(unsettledTotal)} hint={`${formatCount(unsettled.length)} delivered parcels not in a recorded payout`} icon={MoneyIcon} tone="warning" />
        <StatCard
          label="Last payout"
          value={remittances.rows[0] ? formatNpr(remittances.rows[0].net_paisa ?? 0) : "—"}
          hint={remittances.rows[0] ? `${remittances.rows[0].reference} · ${formatDate(`${remittances.rows[0].statement_date}T06:00:00Z`)}` : "No payouts recorded yet"}
          icon={ReceiptIcon}
          tone="success"
        />
      </section>

      {canWrite ? (
        <Panel title="Record a DEX payout" description="DEX pays COD 3–5 business days after delivery, several times a week. Copy the reference and tracking numbers from the DEX OMS statement.">
          <RecordSettlementForm unsettled={unsettled} />
        </Panel>
      ) : null}

      <Panel title="Recorded payouts">
        {remittances.rows.length === 0 ? (
          <EmptyState icon={ReceiptIcon} title="No payouts recorded" description="Record each DEX payout to see which COD Daraz still holds." />
        ) : (
          <>
            <TableScroll label="Recorded payouts">
              <table className={cn(tableClasses, "min-w-[860px]")}>
                <thead>
                  <tr className={theadRowClasses}>
                    <th scope="col" className={thClasses}>Reference</th>
                    <th scope="col" className={thClasses}>Date</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Parcels</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Expected COD</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Paid</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Deductions</th>
                    <th scope="col" className={cn(thClasses, "text-right")}>Net</th>
                    {isOwner ? <th scope="col" className={thClasses}><span className="sr-only">Actions</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {remittances.rows.map((row) => {
                    const mismatch = row.gross_paisa !== row.expected_paisa;
                    return (
                      <tr key={row.id}>
                        <td className={tdClasses}>
                          <span className="flex flex-col">
                            <span className="font-medium">{row.reference}</span>
                            {row.note ? <span className="text-small text-neutral-500">{row.note}</span> : null}
                          </span>
                        </td>
                        <td className={cn(tdClasses, "whitespace-nowrap")}>{formatDate(`${row.statement_date}T06:00:00Z`)}</td>
                        <td className={cn(tdClasses, numericClasses)}>{formatCount(row.parcel_count)}</td>
                        <td className={cn(tdClasses, numericClasses)}>{formatNpr(row.expected_paisa)}</td>
                        <td className={cn(tdClasses, numericClasses, mismatch && "text-warning-700")}>
                          {formatNpr(row.gross_paisa)}
                          {mismatch ? <span className="block text-small">does not match</span> : null}
                        </td>
                        <td className={cn(tdClasses, numericClasses)}>{formatNpr(row.deductions_paisa)}</td>
                        <td className={cn(tdClasses, numericClasses, "font-medium")}>{formatNpr(row.net_paisa ?? 0)}</td>
                        {isOwner ? (
                          <td className={tdClasses}>
                            <DeleteSettlementButton remittanceId={row.id} reference={row.reference} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            <Pagination pathname="/admin/daraz" params={params} page={remittances.page} pageCount={remittances.pageCount} total={remittances.total} noun="payouts" />
          </>
        )}
      </Panel>

      {unsettled.length > 0 ? (
        <Panel title="Delivered, not yet paid out" description="Oldest first. These are in the COD Daraz holds for the store.">
          <TableScroll label="Unsettled parcels">
            <table className={cn(tableClasses, "min-w-[560px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Tracking</th>
                  <th scope="col" className={thClasses}>Order</th>
                  <th scope="col" className={thClasses}>Delivered</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>COD</th>
                </tr>
              </thead>
              <tbody>
                {unsettled.slice(0, 50).map((parcel) => (
                  <tr key={parcel.trackingNumber}>
                    <td className={cn(tdClasses, "font-mono text-small")}>{parcel.trackingNumber}</td>
                    <td className={tdClasses}>
                      <Link href={`/admin/orders/${parcel.orderNumber}`} className="rounded-xs font-medium hover:text-primary-600">
                        #{parcel.orderNumber}
                      </Link>
                    </td>
                    <td className={cn(tdClasses, "whitespace-nowrap")}>{parcel.deliveredAt ? formatDateTime(parcel.deliveredAt) : "—"}</td>
                    <td className={cn(tdClasses, numericClasses)}>{formatNpr(parcel.totalPaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      ) : null}
    </>
  );
}

async function Support({ page, params, canWrite }: { page: number; params: Record<string, string | string[] | undefined>; canWrite: boolean }) {
  const cases = await fetchSupportCases(page);
  return (
    <Panel
      title="Support cases with Daraz"
      description="Lost or damaged parcels, wrong statuses and disputes. Open new cases from an order, or here with a tracking number."
      action={canWrite ? <SupportDialog orderId={null} trackingNumber={null} /> : undefined}
    >
      {cases.rows.length === 0 ? (
        <EmptyState icon={HeadsetIcon} title="No support cases" description="Cases you open with Daraz appear here with their status." />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-neutral-100 px-6 pb-6">
            {cases.rows.map((item) => (
              <li key={item.id} id={`case-${item.case_id}`} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body font-medium text-neutral-900">
                    #{item.case_id} · {item.subject}
                  </p>
                  <span className="text-small text-neutral-700">
                    {item.status ?? "open"}
                    {item.rating ? ` · rated ${item.rating}/5` : ""}
                  </span>
                </div>
                <p className="text-small text-neutral-500">
                  Opened {formatDateTime(item.created_at)}
                  {item.orderNumber ? (
                    <>
                      {" "}
                      for{" "}
                      <Link href={`/admin/orders/${item.orderNumber}`} className="font-medium text-primary-600 hover:text-primary-700">
                        #{item.orderNumber}
                      </Link>
                    </>
                  ) : null}
                  {item.tracking_number ? ` · ${item.tracking_number}` : ""}
                  {item.synced_at ? ` · checked ${formatDateTime(item.synced_at)}` : ""}
                </p>
                <div className="flex flex-wrap items-start gap-4">
                  <SupportCaseDetail caseId={item.case_id} />
                  {canWrite && !item.rating ? <RateSupportCase caseId={item.case_id} /> : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination pathname="/admin/daraz" params={params} page={cases.page} pageCount={cases.pageCount} total={cases.total} noun="cases" />
        </>
      )}
    </Panel>
  );
}

async function Activity({ page, params, failuresOnly }: { page: number; params: Record<string, string | string[] | undefined>; failuresOnly: boolean }) {
  const log = await fetchApiLog(page, { failuresOnly });
  return (
    <Panel
      title="API activity"
      description="Every call Goreto made to Daraz. Give Daraz support the trace ID when a call fails. Requests and customer details are never logged."
      action={
        <Link href={hrefWith("/admin/daraz", {}, { tab: "activity", failures: failuresOnly ? null : "1" })} className="text-body font-medium text-primary-600 hover:text-primary-700">
          {failuresOnly ? "Show all calls" : "Show failures only"}
        </Link>
      }
    >
      {log.rows.length === 0 ? (
        <EmptyState icon={ArrowsClockwiseIcon} title="No calls yet" description="Calls appear here once Goreto talks to Daraz." />
      ) : (
        <>
          <TableScroll label="API activity">
            <table className={cn(tableClasses, "min-w-[900px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>When</th>
                  <th scope="col" className={thClasses}>Call</th>
                  <th scope="col" className={thClasses}>Order</th>
                  <th scope="col" className={thClasses}>Result</th>
                  <th scope="col" className={thClasses}>Trace ID</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Time</th>
                  <th scope="col" className={thClasses}>By</th>
                </tr>
              </thead>
              <tbody>
                {log.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={cn(tdClasses, "whitespace-nowrap text-small")}>{formatDateTime(row.created_at)}</td>
                    <td className={tdClasses}>{row.action.replace(/_/g, " ")}</td>
                    <td className={tdClasses}>
                      {row.orderNumber ? (
                        <Link href={`/admin/orders/${row.orderNumber}`} className="rounded-xs font-medium hover:text-primary-600">
                          #{row.orderNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={tdClasses}>
                      {row.success ? (
                        <span className="text-success-700">OK</span>
                      ) : (
                        <span className="flex flex-col text-error-700">
                          <span className="font-medium">{row.error_code}</span>
                          {row.error_message ? <span className="text-small">{row.error_message}</span> : null}
                        </span>
                      )}
                    </td>
                    <td className={cn(tdClasses, "font-mono text-small")}>{row.trace_id ?? "—"}</td>
                    <td className={cn(tdClasses, numericClasses, "text-small")}>{row.duration_ms !== null ? `${formatCount(row.duration_ms)} ms` : "—"}</td>
                    <td className={cn(tdClasses, "text-small")}>{row.actorName ?? (row.actor_id ? "Former staff" : "Scheduled sync")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <Pagination pathname="/admin/daraz" params={params} page={log.page} pageCount={log.pageCount} total={log.total} noun="calls" />
        </>
      )}
    </Panel>
  );
}

async function Setup() {
  const [settings, overview] = await Promise.all([fetchDarazSettings(), fetchCourierOverview()]);
  const config = darazConfig();
  const account = bookingAccount(settings);
  const origin = siteOrigin();
  if (!settings) return <EmptyState icon={WarningCircleIcon} title="Settings unavailable" description="Your access can't read the Daraz settings." />;

  const checklist = [
    { label: "App key and secret set on the server", done: Boolean(config), hint: config ? (isLiveDaraz(config) ? "Using api.daraz.com.np" : `Using ${config.apiUrl} (test)`) : "Add DARAZ_APP_KEY and DARAZ_APP_SECRET in Vercel and .env.local, then redeploy." },
    { label: "Platform name, seller ID and pickup contact saved", done: account.ok, hint: account.ok ? undefined : `Missing: ${account.missing.join(", ")}` },
    { label: "Store's DEX account linked (OTP)", done: Boolean(settings.linked_at) },
    { label: "Pickup warehouse saved with Daraz", done: Boolean(settings.pickup_synced_at) },
    { label: "Return warehouse saved with Daraz", done: Boolean(settings.return_synced_at), hint: "Optional if returns go to the pickup address." },
    { label: "Courier “Daraz Express” set to book through the API", done: true, hint: "Admin › Delivery & Courier › the courier › “Booked through the Daraz Express API”." },
    { label: "Daraz location IDs imported", done: overview.mapped_municipalities > 0, hint: "Run scripts/daraz/import-locations.ts with Daraz's Nepal list. Optional, but improves routing." },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Settings" description="Non-secret values from Daraz. The app key and secret stay in the server environment." bodyClassName="px-6 pb-6">
          <DarazSettingsForm
            values={{
              platformName: settings.platform_name ?? "",
              externalSellerId: settings.external_seller_id ?? "",
              originName: settings.origin_name ?? "",
              originPhone: settings.origin_phone_e164 ? formatNepalPhone(settings.origin_phone_e164) : "",
              originEmail: settings.origin_email ?? "",
              originAddressDetails: settings.origin_address_details ?? "",
              originDarazAddressId: settings.origin_daraz_address_id ?? "",
              originLatitude: settings.origin_latitude?.toString() ?? "",
              originLongitude: settings.origin_longitude?.toString() ?? "",
              pickupWarehouseCode: settings.pickup_warehouse_code ?? "",
              returnWarehouseCode: settings.return_warehouse_code ?? "",
              solutionCodes: settings.solution_codes.join(", "),
              bookingEndpoint: settings.booking_endpoint,
              defaultDeliveryOption: settings.default_delivery_option,
              phoneFormat: settings.phone_format,
              undeliverableOption: settings.undeliverable_option,
              defaultOpenBox: settings.default_open_box,
              declareInsurance: settings.declare_insurance,
              autoBook: settings.auto_book,
              defaultWeightGrams: settings.default_weight_grams?.toString() ?? "",
              defaultItemCategory: settings.default_item_category ?? "",
              boxPresets: boxPresetsText(settings.box_presets),
              xspaceCaseTemplateId: settings.xspace_case_template_id?.toString() ?? "",
              xspaceCategoryId: settings.xspace_category_id ?? "",
            }}
          />
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Checklist" bodyClassName="px-6 pb-6">
          <SetupChecklist items={checklist} />
        </Panel>
        <Panel title="Connection" bodyClassName="flex flex-col gap-4 px-6 pb-6">
          <p className="text-body text-neutral-700">Signs a harmless tracking lookup with the app key and secret.</p>
          <TestConnectionButton />
        </Panel>
        <Panel title="Link the store's DEX account" bodyClassName="px-6 pb-6">
          <LinkAccountForm linkedAt={settings.linked_at} />
        </Panel>
        <Panel title="Warehouses" bodyClassName="flex flex-col gap-4 px-6 pb-6">
          <p className="text-body text-neutral-700">Sends the pickup point above to Daraz. Needs the solution codes and the Daraz location ID.</p>
          <SyncWarehouseButton kind="pickup" syncedAt={settings.pickup_synced_at} disabled={!config} />
          <SyncWarehouseButton kind="return" syncedAt={settings.return_synced_at} disabled={!config || !settings.return_warehouse_code} />
        </Panel>
        <Panel title="For the Daraz App Console" bodyClassName="flex flex-col gap-3 px-6 pb-6">
          <p className="text-small text-neutral-500">Push (webhook) URL for Message Service:</p>
          <CopyValue value={`${origin}/api/courier/webhooks/daraz`} label="webhook URL" />
          <p className="text-small text-neutral-500">Daraz requires an OV/EV certificate for pushes. Without pushes, tracking still syncs on a schedule and whenever staff open an order.</p>
          <p className="text-small text-neutral-500">App callback URL:</p>
          <CopyValue value={`${origin}/admin/daraz`} label="callback URL" />
        </Panel>
      </div>
    </div>
  );
}
