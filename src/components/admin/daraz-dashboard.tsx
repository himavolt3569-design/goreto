"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { CheckCircleIcon, CopyIcon, LinkIcon, PrinterIcon, StarIcon, WarningCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/features/admin/auth";
import {
  bulkDarazAction,
  deleteRemittanceAction,
  linkDarazAccountAction,
  rateDarazSupportCaseAction,
  recordRemittanceAction,
  saveDarazSettingsAction,
  saveDarazWarehouseAction,
  supportCaseDetailAction,
  testDarazConnectionAction,
} from "@/features/admin/actions/daraz";
import { formatDateTime } from "@/features/admin/format";
import type { DarazShipmentRow, UnsettledParcel } from "@/features/admin/queries/daraz";
import type { SupportCase } from "@/lib/courier/daraz/epis";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { ActionForm, ActionMessage, FormDialog, SubmitButton } from "./action-forms";
import { SHIPMENT_LABELS } from "./status-pills";
import { tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses, TableScroll } from "./admin-ui";

/*
 * Client parts of Admin › Daraz Express (docs/couriers/daraz.md §10): the
 * selectable shipments table with bulk actions, COD settlements, support
 * cases and the setup forms. Every action re-checks permission on the server.
 */

/* ---------- Shipments ---------- */

export function DarazShipmentsTable({ rows, canWrite }: { rows: DarazShipmentRow[]; canWrite: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(bulkDarazAction, null);
  const ids = [...selected];
  const all = rows.length > 0 && rows.every((row) => selected.has(row.orderId));

  function toggle(orderId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2 px-6" aria-label="Bulk actions">
          <span className="text-small text-neutral-500">{ids.length > 0 ? `${ids.length} selected` : "Select orders for bulk actions"}</span>
          {(["book", "ready", "refresh"] as const).map((operation) => (
            <form key={operation} action={formAction}>
              <input type="hidden" name="operation" value={operation} />
              <input type="hidden" name="orderIds" value={ids.join(",")} />
              <Button type="submit" variant={operation === "book" ? "primary" : "tertiary"} disabled={ids.length === 0 || pending} loading={pending}>
                {{ book: "Book selected", ready: "Ready to ship", refresh: "Refresh tracking" }[operation]}
              </Button>
            </form>
          ))}
          <a
            href={ids.length > 0 ? `/admin/daraz/labels?orders=${ids.join(",")}&type=pdf` : undefined}
            target="_blank"
            rel="noopener"
            aria-disabled={ids.length === 0}
            className={cn(buttonClasses({ variant: "secondary", size: "md" }), ids.length === 0 && "pointer-events-none opacity-50")}
          >
            <PrinterIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            Print labels
            <span className="sr-only"> (one PDF, opens in a new tab)</span>
          </a>
          <ActionMessage state={state} className="basis-full" />
          <p className="basis-full text-small text-neutral-500">Bulk booking uses the first box size, the product weights and each order&rsquo;s delivery option.</p>
        </div>
      ) : null}

      <TableScroll label="Daraz shipments">
        <table className={cn(tableClasses, "min-w-[960px]")}>
          <thead>
            <tr className={theadRowClasses}>
              {canWrite ? (
                <th scope="col" className={cn(thClasses, "w-10")}>
                  <input
                    type="checkbox"
                    aria-label="Select all orders on this page"
                    checked={all}
                    onChange={() => setSelected(all ? new Set() : new Set(rows.map((row) => row.orderId)))}
                    className="size-4 accent-primary-500"
                  />
                </th>
              ) : null}
              <th scope="col" className={thClasses}>Order</th>
              <th scope="col" className={thClasses}>Customer</th>
              <th scope="col" className={thClasses}>Tracking</th>
              <th scope="col" className={thClasses}>Status</th>
              <th scope="col" className={cn(thClasses, "text-right")}>COD</th>
              <th scope="col" className={cn(thClasses, "text-right")}>Daraz fee</th>
              <th scope="col" className={thClasses}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.shipmentId} className="hover:bg-neutral-50">
                {canWrite ? (
                  <td className={tdClasses}>
                    <input
                      type="checkbox"
                      aria-label={`Select order ${row.orderNumber}`}
                      checked={selected.has(row.orderId)}
                      onChange={() => toggle(row.orderId)}
                      className="size-4 accent-primary-500"
                    />
                  </td>
                ) : null}
                <td className={tdClasses}>
                  <Link href={`/admin/orders/${row.orderNumber}`} className="rounded-xs font-medium hover:text-primary-600">
                    #{row.orderNumber}
                  </Link>
                </td>
                <td className={tdClasses}>
                  <span className="flex flex-col">
                    <span>{row.customer}</span>
                    {row.municipality ? <span className="text-small text-neutral-500">{row.municipality}</span> : null}
                  </span>
                </td>
                <td className={cn(tdClasses, "whitespace-nowrap")}>{row.trackingNumber ?? <span className="text-neutral-500">Not booked</span>}</td>
                <td className={tdClasses}>
                  <span className="flex flex-col gap-1">
                    <span className={cn("font-medium", row.needsAction || row.status === "exception" ? "text-warning-700" : "text-neutral-900")}>
                      {row.needsAction ? "Needs action" : !row.booked ? "To book" : row.status === "assigned" ? (row.readyToShip ? "Awaiting pickup" : row.labelPrinted ? "Label printed" : "Booked") : SHIPMENT_LABELS[row.status]}
                    </span>
                    {row.providerStatus ? <span className="text-small text-neutral-500">{row.providerStatus}</span> : null}
                    {row.status === "delivered" ? <span className="text-small text-neutral-500">{row.settled ? "COD settled" : "COD with Daraz"}</span> : null}
                  </span>
                </td>
                <td className={cn(tdClasses, numericClasses)}>{formatNpr(row.totalPaisa)}</td>
                <td className={cn(tdClasses, numericClasses)}>{row.feePaisa !== null ? formatNpr(row.feePaisa) : "—"}</td>
                <td className={cn(tdClasses, "whitespace-nowrap text-small text-neutral-700")}>{row.syncedAt ? formatDateTime(row.syncedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}

/* ---------- COD settlements ---------- */

export function RecordSettlementForm({ unsettled }: { unsettled: UnsettledParcel[] }) {
  const [numbers, setNumbers] = useState("");
  const [state, formAction] = useActionState(recordRemittanceAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const chosen = new Set(numbers.split(/[\s,;]+/).map((part) => part.trim().toUpperCase()).filter(Boolean));
  const expected = unsettled.filter((parcel) => chosen.has(parcel.trackingNumber.toUpperCase())).reduce((sum, parcel) => sum + parcel.totalPaisa, 0);
  const [today] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" }));

  return (
    <form action={formAction} className="flex flex-col gap-4 px-6 pb-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Payout reference" required error={errors.reference} hint="From the DEX statement or bank transfer.">
          {(control) => <Input {...control} name="reference" maxLength={100} required />}
        </Field>
        <Field label="Payout date" required error={errors.statementDate}>
          {(control) => <Input {...control} name="statementDate" type="date" max={today} defaultValue={today} required />}
        </Field>
        <Field label="COD amount paid (Rs.)" required error={errors.grossAmount}>
          {(control) => <Input {...control} name="grossAmount" inputMode="decimal" required placeholder="e.g. 12500" />}
        </Field>
        <Field label="Deductions (Rs.)" error={errors.deductions} hint="DEX fees taken from this payout, if any.">
          {(control) => <Input {...control} name="deductions" inputMode="decimal" placeholder="0" />}
        </Field>
      </div>
      <Field
        label="Tracking numbers in this payout"
        required
        error={errors.trackingNumbers}
        hint={chosen.size > 0 ? `${chosen.size} parcels · Goreto's COD for the matching parcels: ${formatNpr(expected)}` : "Paste them from the statement: one per line, or separated by commas."}
      >
        {(control) => (
          <textarea {...control} name="trackingNumbers" rows={5} value={numbers} onChange={(event) => setNumbers(event.target.value)} required className={cn(fieldControlClasses, "h-auto py-3 font-mono")} />
        )}
      </Field>
      <Field label="Note" error={errors.note}>
        {(control) => <Input {...control} name="note" maxLength={500} />}
      </Field>
      {unsettled.length > 0 ? (
        <button
          type="button"
          className={buttonClasses({ variant: "text", size: "md", className: "self-start" })}
          onClick={() => setNumbers(unsettled.map((parcel) => parcel.trackingNumber).join("\n"))}
        >
          Fill in all {unsettled.length} unsettled parcels
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Record payout</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function DeleteSettlementButton({ remittanceId, reference }: { remittanceId: string; reference: string }) {
  return (
    <FormDialog
      action={deleteRemittanceAction}
      hidden={{ remittanceId }}
      title="Delete this payout?"
      description="Use this only for a mistaken entry. Its parcels go back to unsettled."
      triggerLabel="Delete"
      triggerVariant="text"
      triggerContext={reference}
      submitLabel="Delete payout"
    >
      <p className="text-body text-neutral-700">Payout {reference}</p>
    </FormDialog>
  );
}

/* ---------- Support cases ---------- */

export function SupportCaseDetail({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<SupportCase | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={buttonClasses({ variant: "text", size: "md", className: "self-start" })}
        disabled={loading}
        onClick={() =>
          startLoading(async () => {
            const result = await supportCaseDetailAction(caseId);
            if (result.ok) {
              setDetail(result.detail);
              setMessage(null);
            } else setMessage(result.message);
          })
        }
      >
        {loading ? "Loading…" : detail ? "Reload from Daraz" : "Show Daraz's replies"}
      </button>
      {message ? <p className="text-small text-error-700">{message}</p> : null}
      {detail ? (
        <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3 text-small text-neutral-700">
          <p>
            <span className="font-medium text-neutral-900">Status:</span> {detail.status ?? "unknown"}
          </p>
          {detail.description ? <p className="whitespace-pre-line">{detail.description}</p> : null}
          {(detail.mails ?? []).map((mail, index) => (
            <p key={index} className="whitespace-pre-line border-t border-neutral-200 pt-2">
              {typeof mail === "object" && mail !== null ? Object.values(mail as Record<string, unknown>).filter((value) => typeof value === "string").join(" · ") : String(mail)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RateSupportCase({ caseId }: { caseId: string }) {
  return (
    <FormDialog
      action={rateDarazSupportCaseAction}
      hidden={{ caseId }}
      title={`Rate case #${caseId}`}
      description="Daraz asks partners to rate resolved cases."
      triggerLabel="Rate"
      triggerVariant="text"
      triggerIcon={<StarIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Send rating"
    >
      {(state) => (
        <>
          <Field label="Rating" required error={state && !state.ok ? state.fieldErrors?.rating : undefined}>
            {(control) => (
              <Select
                {...control}
                name="rating"
                defaultValue="5"
                options={[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} star${value === 1 ? "" : "s"}` }))}
              />
            )}
          </Field>
          <Field label="Comment" error={state && !state.ok ? state.fieldErrors?.remark : undefined}>
            {(control) => <Input {...control} name="remark" maxLength={300} />}
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/* ---------- Setup ---------- */

export function TestConnectionButton() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [testing, startTesting] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="secondary" loading={testing} onClick={() => startTesting(async () => setResult(await testDarazConnectionAction()))}>
        Test connection
      </Button>
      <ActionMessage state={result} />
    </div>
  );
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded-xs bg-neutral-100 px-2 py-1 text-small text-neutral-900">{value}</code>
      <button
        type="button"
        className={buttonClasses({ variant: "text", size: "md" })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} /> : <CopyIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
        {copied ? "Copied" : `Copy ${label}`}
      </button>
    </span>
  );
}

export function LinkAccountForm({ linkedAt }: { linkedAt: string | null }) {
  return (
    <ActionForm action={linkDarazAccountAction} className="flex flex-col gap-3">
      {(state) => (
        <>
          <p className="text-body text-neutral-700">
            {linkedAt ? (
              <span className="inline-flex items-center gap-1 text-success-700">
                <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} /> Linked {formatDateTime(linkedAt)}
              </span>
            ) : (
              "Not linked yet. In DEX OMS (oms.dex.com.np), generate the link (bundle) code for Goreto and paste it here."
            )}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Link code (OTP)" error={state && !state.ok ? state.fieldErrors?.otp : undefined} className="min-w-56 flex-1">
              {(control) => <Input {...control} name="otp" autoComplete="one-time-code" maxLength={64} required />}
            </Field>
            <SubmitButton variant="secondary">
              <LinkIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              {linkedAt ? "Link again" : "Link account"}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function SyncWarehouseButton({ kind, syncedAt, disabled }: { kind: "pickup" | "return"; syncedAt: string | null; disabled: boolean }) {
  return (
    <ActionForm action={saveDarazWarehouseAction} hidden={{ kind }} className="flex flex-col items-start gap-2">
      <p className="text-small text-neutral-500">{syncedAt ? `Sent to Daraz ${formatDateTime(syncedAt)}` : "Not sent to Daraz yet."}</p>
      {disabled ? (
        <Button type="button" variant="tertiary" disabled>
          Save {kind} warehouse with Daraz
        </Button>
      ) : (
        <SubmitButton variant="tertiary">Save {kind} warehouse with Daraz</SubmitButton>
      )}
    </ActionForm>
  );
}

export type DarazSettingsValues = {
  platformName: string;
  externalSellerId: string;
  originName: string;
  originPhone: string;
  originEmail: string;
  originAddressDetails: string;
  originDarazAddressId: string;
  originLatitude: string;
  originLongitude: string;
  pickupWarehouseCode: string;
  returnWarehouseCode: string;
  solutionCodes: string;
  bookingEndpoint: string;
  defaultDeliveryOption: string;
  phoneFormat: string;
  undeliverableOption: string;
  defaultOpenBox: boolean;
  declareInsurance: boolean;
  autoBook: boolean;
  defaultWeightGrams: string;
  defaultItemCategory: string;
  boxPresets: string;
  xspaceCaseTemplateId: string;
  xspaceCategoryId: string;
};

export function DarazSettingsForm({ values }: { values: DarazSettingsValues }) {
  const [state, formAction] = useActionState(saveDarazSettingsAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const text = (name: keyof DarazSettingsValues, label: string, hint?: string, props: Record<string, unknown> = {}) => (
    <Field label={label} hint={hint} error={errors[name]}>
      {(control) => <Input {...control} name={name} defaultValue={String(values[name])} autoComplete="off" {...props} />}
    </Field>
  );
  const check = (name: "defaultOpenBox" | "declareInsurance" | "autoBook", label: string, description: string) => (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={values[name]} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500" />
      <span className="flex flex-col">
        <span className="text-body font-medium text-neutral-900">{label}</span>
        <span className="text-small text-neutral-500">{description}</span>
      </span>
    </label>
  );
  const select = (name: keyof DarazSettingsValues, label: string, options: { value: string; label: string }[], hint?: string) => (
    <Field label={label} hint={hint} error={errors[name]}>
      {(control) => <Select {...control} name={name} defaultValue={String(values[name])} options={options} />}
    </Field>
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-h3 text-neutral-900">Daraz account</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {text("platformName", "Platform name", "Exactly as Daraz registered Goreto (platformName).", { maxLength: 100 })}
          {text("externalSellerId", "External seller ID", "The store's ID on the Goreto platform (externalSellerId). Agree it with Daraz.", { maxLength: 100 })}
        </div>
        <Field label="Solution codes" hint="From Daraz, e.g. DARAZ_STANDARD_NP. Separate with commas." error={errors.solutionCodes}>
          {(control) => <Input {...control} name="solutionCodes" defaultValue={values.solutionCodes} autoComplete="off" />}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-h3 text-neutral-900">Pickup point and returns</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {text("originName", "Contact name", undefined, { maxLength: 120 })}
          {text("originPhone", "Contact phone", "Nepal number, with or without +977.", { type: "tel" })}
          {text("originEmail", "Contact email", undefined, { type: "email" })}
          {text("originDarazAddressId", "Daraz location ID", "The R-code Daraz gives for the pickup address.", { maxLength: 64 })}
        </div>
        <Field label="Pickup address" hint="Street, ward, municipality, district." error={errors.originAddressDetails}>
          {(control) => <textarea {...control} name="originAddressDetails" defaultValue={values.originAddressDetails} maxLength={300} rows={2} className={cn(fieldControlClasses, "h-auto py-3")} />}
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          {text("originLatitude", "Latitude", "Optional. Helps Daraz quote and route.", { inputMode: "decimal" })}
          {text("originLongitude", "Longitude", undefined, { inputMode: "decimal" })}
          {text("pickupWarehouseCode", "Pickup warehouse code", "Your own short code, e.g. WH_KTM.", { maxLength: 64 })}
          {text("returnWarehouseCode", "Return warehouse code", "Where failed parcels come back, e.g. WH_KTM_RET.", { maxLength: 64 })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-h3 text-neutral-900">Booking</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {select(
            "bookingEndpoint",
            "Booking call",
            [
              { value: "create", label: "Create package (DEX default)" },
              { value: "consign", label: "Consign" },
            ],
            "Use what Daraz tells you; DEX documents Create package.",
          )}
          {select("defaultDeliveryOption", "Default delivery option", [
            { value: "standard", label: "Standard" },
            { value: "economy", label: "Economy" },
          ])}
          {select(
            "phoneFormat",
            "Phone format sent to Daraz",
            [
              { value: "national", label: "98XXXXXXXX" },
              { value: "e164", label: "+97798XXXXXXXX" },
            ],
            "Ask Daraz which one Nepal expects.",
          )}
          {select("undeliverableOption", "If a parcel can't be delivered", [
            { value: "RETURN", label: "Return it to the store" },
            { value: "SCRAP", label: "Dispose of it" },
          ])}
          {text("defaultItemCategory", "Item category sent to Daraz", "Optional, e.g. Fashion.", { maxLength: 60 })}
          {text("defaultWeightGrams", "Usual parcel weight (g)", "Used when products have no weight saved. Daraz weighs parcels at pickup.", { inputMode: "numeric", maxLength: 6 })}
        </div>
        <Field label="Box sizes" hint={'One per line: "Name: L x W x H" in cm. The first one is the default.'} error={errors.boxPresets}>
          {(control) => <textarea {...control} name="boxPresets" defaultValue={values.boxPresets} rows={4} className={cn(fieldControlClasses, "h-auto py-3 font-mono")} />}
        </Field>
        <div className="flex flex-col gap-3">
          {check("defaultOpenBox", "Allow open box by default", "Customers may check the items before paying.")}
          {check("declareInsurance", "Declare the goods value as insurance", "Ask Daraz about the cost first.")}
          {check("autoBook", "Book automatically when an order is accepted", "Uses the first box size and the product weights, or the usual parcel weight. Orders with no weight at all wait for staff.")}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-h3 text-neutral-900">Support cases</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {text("xspaceCaseTemplateId", "Case template ID", "From Daraz (XSpace). Optional.", { inputMode: "numeric" })}
          {text("xspaceCategoryId", "Case category ID", "From Daraz (XSpace). Optional.", { maxLength: 60 })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save settings</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function SetupChecklist({ items }: { items: { label: string; done: boolean; hint?: string }[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-3">
          {item.done ? (
            <CheckCircleIcon aria-hidden="true" size={20} weight="fill" className="mt-0.5 shrink-0 text-success-700" />
          ) : (
            <WarningCircleIcon aria-hidden="true" size={20} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
          )}
          <span className="flex flex-col">
            <span className="text-body font-medium text-neutral-900">
              {item.label}
              <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
            </span>
            {item.hint ? <span className="text-small text-neutral-500">{item.hint}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
