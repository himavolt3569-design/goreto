"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ArrowsClockwiseIcon, FileTextIcon, HeadsetIcon, PackageIcon, PencilSimpleIcon, PrinterIcon, TruckIcon, WarningCircleIcon, XCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/features/admin/auth";
import {
  bookDarazAction,
  cancelDarazBookingAction,
  createDarazSupportCaseAction,
  darazFeedbackAction,
  proofOfDeliveryAction,
  quoteDarazAction,
  readyToShipDarazAction,
  refreshDarazTrackingAction,
  updateDarazReceiverAction,
  type DarazQuote,
  type ProofOfDelivery,
} from "@/features/admin/actions/daraz";
import { formatDate, formatDateTime } from "@/features/admin/format";
import type { BoxPreset, DarazShipment } from "@/features/admin/queries/daraz";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { ActionForm, ActionMessage, FormDialog, SubmitButton } from "./action-forms";

/*
 * The Daraz Express panel on the order page (docs/couriers/daraz.md §10):
 * book, label, ready to ship, tracking, receiver changes, failed-delivery
 * decisions, proof of delivery and support cases. Every button calls a
 * server action that re-checks permission and re-reads the order.
 */

const STALE_MS = 15 * 60_000;

export type DarazPanelProps = {
  orderId: string;
  orderNumber: string;
  /** Accepted and not shipped yet: the states in which booking is allowed. */
  bookable: boolean;
  configured: boolean;
  liveGateway: boolean;
  setupMissing: string[];
  setupHref: string | null;
  canWrite: boolean;
  shipment: DarazShipment | null;
  suggestedWeightGrams: number | null;
  /** The store's usual parcel weight (Daraz Setup), for orders whose products have no weight. */
  usualWeightGrams: number | null;
  defaultOption: "standard" | "economy";
  defaultOpenBox: boolean;
  boxPresets: BoxPreset[];
  mappedLocation: boolean;
  recipient: { name: string; phoneE164: string; details: string };
  supportCases: { caseId: string; subject: string; status: string | null }[];
};

function stateLabel(shipment: DarazShipment): { label: string; tone: string } {
  if (shipment.needsAction || shipment.status === "exception") return { label: "Needs action", tone: "bg-warning-100 text-warning-700" };
  switch (shipment.status) {
    case "delivered":
      return { label: "Delivered", tone: "bg-success-100 text-success-700" };
    case "returned":
      return { label: "Returned to store", tone: "bg-neutral-100 text-neutral-700" };
    case "out_for_delivery":
      return { label: "Out for delivery", tone: "bg-info-100 text-info-700" };
    case "picked_up":
    case "in_transit":
      return { label: "With Daraz", tone: "bg-info-100 text-info-700" };
    default:
      if (shipment.readyToShipAt) return { label: "Ready to ship, awaiting pickup", tone: "bg-primary-100 text-primary-700" };
      if (shipment.awbPrintedAt) return { label: "Label printed", tone: "bg-primary-100 text-primary-700" };
      return { label: "Booked", tone: "bg-primary-100 text-primary-700" };
  }
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-900">{children}</dd>
    </>
  );
}

export function DarazShipmentPanel(props: DarazPanelProps) {
  const { orderId, shipment, canWrite } = props;
  const [refreshResult, setRefreshResult] = useState<ActionResult | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const autoRefreshed = useRef(false);

  const booked = Boolean(shipment?.packageCode);
  const final = shipment?.status === "delivered" || shipment?.status === "returned";

  // Once per visit: pull Daraz's latest tracking when ours is older than 15 minutes.
  useEffect(() => {
    if (autoRefreshed.current || !props.configured || !canWrite || !booked || final) return;
    const syncedAt = shipment?.syncedAt ? Date.parse(shipment.syncedAt) : 0;
    if (Date.now() - syncedAt < STALE_MS) return;
    autoRefreshed.current = true;
    startRefresh(async () => setRefreshResult(await refreshDarazTrackingAction(orderId)));
  }, [props.configured, canWrite, booked, final, shipment?.syncedAt, orderId]);

  if (!props.configured) {
    return (
      <p className="text-body text-neutral-700">
        Daraz Express isn&rsquo;t connected yet.{" "}
        {props.setupHref ? (
          <Link href={props.setupHref} className="font-medium text-primary-600 hover:text-primary-700">
            Open Daraz setup
          </Link>
        ) : (
          "Ask someone with delivery access to finish the Daraz setup."
        )}
      </p>
    );
  }

  if (!booked) {
    return (
      <div className="flex flex-col gap-4">
        {props.setupMissing.length > 0 ? (
          <p className="flex items-start gap-2 rounded-md bg-warning-100 p-3 text-body text-warning-700">
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
            <span>
              Finish Daraz setup before booking: {props.setupMissing.join(", ")}.{" "}
              {props.setupHref ? (
                <Link href={props.setupHref} className="font-medium underline">
                  Setup
                </Link>
              ) : null}
            </span>
          </p>
        ) : null}
        {shipment?.canceledAt ? (
          <p className="text-small text-neutral-500">
            The previous booking was canceled {formatDateTime(shipment.canceledAt)}. Booking again sends a new reference to Daraz.
          </p>
        ) : null}
        {!props.bookable ? (
          <p className="text-body text-neutral-500">Booking opens once the order is accepted, and closes when it ships.</p>
        ) : canWrite && props.setupMissing.length === 0 ? (
          <BookDialog {...props} />
        ) : null}
        {!props.liveGateway ? <p className="text-small text-warning-700">Connected to a test gateway, not Daraz live.</p> : null}
      </div>
    );
  }

  const state = stateLabel(shipment!);
  const labelHref = (type: "pdf" | "zpl") => `/admin/daraz/labels?orders=${orderId}&type=${type}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-small font-medium", state.tone)}>
          <TruckIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} />
          {state.label}
        </span>
        {shipment!.providerStatus ? <span className="text-small text-neutral-500">Daraz: {shipment!.providerStatus}</span> : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
        <Detail label="Tracking">{shipment!.trackingNumber}</Detail>
        <Detail label="Package">{shipment!.packageCode}</Detail>
        {shipment!.reference ? <Detail label="Reference">{shipment!.reference}</Detail> : null}
        {shipment!.estimatedFrom && shipment!.estimatedTo ? (
          <Detail label="Estimate">
            {formatDate(`${shipment!.estimatedFrom}T06:00:00Z`)} – {formatDate(`${shipment!.estimatedTo}T06:00:00Z`)}
          </Detail>
        ) : null}
        {shipment!.lastMileProvider ? <Detail label="Last mile">{shipment!.lastMileProvider}</Detail> : null}
        {shipment!.pickupCutoffAt ? <Detail label="Pickup cutoff">{formatDateTime(shipment!.pickupCutoffAt)}</Detail> : null}
        <Detail label="Parcel">
          {[
            shipment!.package.weightGrams ? `${shipment!.package.weightGrams} g` : null,
            shipment!.package.lengthCm ? `${shipment!.package.lengthCm}×${shipment!.package.widthCm}×${shipment!.package.heightCm} cm` : null,
            shipment!.deliveryOption,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Detail>
        {shipment!.estimatedFeePaisa !== null || shipment!.actualFeePaisa !== null ? (
          <Detail label="Daraz fee">
            {shipment!.actualFeePaisa !== null ? formatNpr(shipment!.actualFeePaisa) : `${formatNpr(shipment!.estimatedFeePaisa!)} (estimate)`}
          </Detail>
        ) : null}
        {shipment!.receiver ? (
          <Detail label="Deliver to">
            {shipment!.receiver.name}, {shipment!.receiver.phoneE164}
            {shipment!.receiver.details ? `, ${shipment!.receiver.details}` : ""} <span className="text-small text-neutral-500">(changed)</span>
          </Detail>
        ) : null}
        <Detail label="Synced">{shipment!.syncedAt ? formatDateTime(shipment!.syncedAt) : "Not yet"}</Detail>
      </dl>

      {canWrite ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {!final ? (
              <a href={labelHref("pdf")} target="_blank" rel="noopener" className={buttonClasses({ variant: shipment!.awbPrintedAt ? "tertiary" : "primary", size: "md" })}>
                <PrinterIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                {shipment!.awbPrintedAt ? "Print label again" : "Print label"}
                <span className="sr-only"> (opens a PDF in a new tab)</span>
              </a>
            ) : null}
            {shipment!.status === "assigned" && !shipment!.readyToShipAt ? (
              <ActionForm action={readyToShipDarazAction} hidden={{ orderId }}>
                <SubmitButton variant={shipment!.awbPrintedAt ? "primary" : "secondary"}>
                  <PackageIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  Ready to ship
                </SubmitButton>
              </ActionForm>
            ) : null}
            {!final ? (
              <button
                type="button"
                className={buttonClasses({ variant: "tertiary", size: "md" })}
                disabled={refreshing}
                aria-busy={refreshing || undefined}
                onClick={() => startRefresh(async () => setRefreshResult(await refreshDarazTrackingAction(orderId)))}
              >
                <ArrowsClockwiseIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />
                {refreshing ? "Refreshing…" : "Refresh tracking"}
              </button>
            ) : null}
          </div>
          <ActionMessage state={refreshResult} />

          {(shipment!.needsAction || shipment!.status === "exception") && !final ? <FeedbackDialog orderId={orderId} /> : null}

          <div className="flex flex-wrap gap-2">
            {/* Daraz takes receiver changes after ready-to-ship; before that, cancel and book again. */}
            {!final && (shipment!.readyToShipAt || shipment!.status !== "assigned") ? (
              <ReceiverDialog orderId={orderId} recipient={shipment!.receiver ? { ...shipment!.receiver, details: shipment!.receiver.details ?? "" } : props.recipient} />
            ) : null}
            {shipment!.status === "assigned" ? <CancelDialog orderId={orderId} /> : null}
            <SupportDialog orderId={orderId} trackingNumber={shipment!.trackingNumber} />
            {!final ? (
              <a href={labelHref("zpl")} target="_blank" rel="noopener" className={buttonClasses({ variant: "text", size: "md" })}>
                Thermal label (ZPL)
              </a>
            ) : null}
          </div>
          {shipment!.status === "delivered" ? <ProofOfDelivery orderId={orderId} /> : null}
        </div>
      ) : null}

      {props.supportCases.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-neutral-200 pt-3">
          <p className="text-small font-medium text-neutral-700">Support cases</p>
          <ul className="flex flex-col gap-1 text-small text-neutral-700">
            {props.supportCases.map((item) => (
              <li key={item.caseId}>
                <Link href={`/admin/daraz?tab=support&case=${encodeURIComponent(item.caseId)}`} className="font-medium text-primary-600 hover:text-primary-700">
                  #{item.caseId}
                </Link>{" "}
                {item.subject} · {item.status ?? "open"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Book ---------- */

function BookDialog(props: DarazPanelProps) {
  return (
    <FormDialog
      action={bookDarazAction}
      hidden={{ orderId: props.orderId }}
      title="Book with Daraz Express"
      description="Goreto sends the order's items, delivery address and Cash on Delivery amount from the order itself. Choose the box and weight."
      triggerLabel="Book with Daraz"
      triggerVariant="primary"
      triggerIcon={<TruckIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Book parcel"
    >
      {(state) => <BookingFields {...props} errors={state && !state.ok ? (state.fieldErrors ?? {}) : {}} />}
    </FormDialog>
  );
}

function BookingFields({
  orderId,
  suggestedWeightGrams,
  usualWeightGrams,
  defaultOption,
  defaultOpenBox,
  boxPresets,
  shipment,
  mappedLocation,
  errors,
}: DarazPanelProps & { errors: Record<string, string> }) {
  const first = boxPresets[0];
  const [option, setOption] = useState<"standard" | "economy">(shipment?.serviceOption ?? defaultOption);
  const [box, setBox] = useState(first ? "0" : "custom");
  const [dims, setDims] = useState({
    length: String(shipment?.package.lengthCm ?? first?.length_cm ?? 30),
    width: String(shipment?.package.widthCm ?? first?.width_cm ?? 20),
    height: String(shipment?.package.heightCm ?? first?.height_cm ?? 10),
  });
  const [weight, setWeight] = useState(String(shipment?.package.weightGrams ?? suggestedWeightGrams ?? usualWeightGrams ?? ""));
  const [quote, setQuote] = useState<DarazQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();

  function chooseBox(value: string) {
    setBox(value);
    const preset = boxPresets[Number(value)];
    if (preset) setDims({ length: String(preset.length_cm), width: String(preset.width_cm), height: String(preset.height_cm) });
  }

  function getQuote() {
    setQuoteError(null);
    startQuote(async () => {
      const result = await quoteDarazAction(orderId, Number(weight), option);
      if (result.ok) setQuote(result.quote);
      else {
        setQuote(null);
        setQuoteError(result.message);
      }
    });
  }

  return (
    <>
      <Field label="Delivery option" required error={errors.deliveryOption}>
        {(control) => (
          <Select
            {...control}
            name="deliveryOption"
            value={option}
            onValueChange={(value) => setOption(value === "economy" ? "economy" : "standard")}
            options={[
              { value: "standard", label: "Standard" },
              { value: "economy", label: "Economy" },
            ]}
          />
        )}
      </Field>
      <Field label="Box">
        {(control) => (
          <Select
            {...control}
            value={box}
            onValueChange={chooseBox}
            options={[...boxPresets.map((preset, index) => ({ value: String(index), label: `${preset.name} (${preset.length_cm}×${preset.width_cm}×${preset.height_cm} cm)` })), { value: "custom", label: "Custom size" }]}
          />
        )}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {(["length", "width", "height"] as const).map((side) => (
          <Field key={side} label={`${side[0]!.toUpperCase()}${side.slice(1)} (cm)`} required error={errors[`${side}Cm`]}>
            {(control) => (
              <Input
                {...control}
                name={`${side}Cm`}
                inputMode="decimal"
                value={dims[side]}
                onChange={(event) => {
                  setBox("custom");
                  setDims((current) => ({ ...current, [side]: event.target.value }));
                }}
                required
              />
            )}
          </Field>
        ))}
      </div>
      <Field
        label="Weight (g)"
        required
        error={errors.weightGrams}
        hint={
          suggestedWeightGrams
            ? `From the product weights: ${suggestedWeightGrams} g. Add the packaging.`
            : usualWeightGrams
              ? "Some items have no weight saved, so this is the usual parcel weight. Weigh the parcel if it's heavier."
              : "Some items have no weight saved. Weigh the packed parcel."
        }
      >
        {(control) => <Input {...control} name="weightGrams" inputMode="numeric" value={weight} onChange={(event) => setWeight(event.target.value)} required />}
      </Field>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="openBox" defaultChecked={defaultOpenBox} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500" />
        <span className="flex flex-col">
          <span className="text-body font-medium text-neutral-900">Allow open box</span>
          <span className="text-small text-neutral-500">The customer may check the items before paying.</span>
        </span>
      </label>
      <Field label="Note for the rider" hint="Optional. The customer's order note is sent too." error={errors.deliveryNote}>
        {(control) => <textarea {...control} name="deliveryNote" maxLength={200} rows={2} className={cn(fieldControlClasses, "h-auto py-3")} />}
      </Field>

      <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-small text-neutral-700">Daraz charges the store for delivery. Check the fee before booking.</span>
          <button type="button" onClick={getQuote} disabled={quoting || !weight} className={buttonClasses({ variant: "secondary", size: "md" })}>
            {quoting ? "Checking…" : "Get fee estimate"}
          </button>
        </div>
        {quote ? (
          <div className="flex flex-col gap-1 text-small text-neutral-700" role="status">
            {quote.feePaisa !== null ? (
              <p>
                <span className="font-semibold text-neutral-900">Estimated Daraz fee: {formatNpr(quote.feePaisa)}</span>
                {quote.feeLines.length > 1 ? ` (${quote.feeLines.map((line) => `${line.name} ${formatNpr(line.paisa)}`).join(", ")})` : ""}
              </p>
            ) : null}
            {quote.options.map((item) => (
              <p key={item.deliveryOption}>
                {item.deliveryOption}: {item.firstMileType === "Drop-off" ? "drop off at a hub" : "pickup"}
                {item.pickupCutoffAt ? `, cutoff ${formatDateTime(item.pickupCutoffAt)}` : ""}
              </p>
            ))}
            {quote.notes.map((note) => (
              <p key={note} className="text-neutral-500">
                {note}
              </p>
            ))}
          </div>
        ) : null}
        {quoteError ? <ActionMessage state={{ ok: false, message: quoteError }} /> : null}
        {!mappedLocation ? <p className="text-small text-neutral-500">This municipality has no Daraz location ID yet; Daraz routes it by the written address.</p> : null}
      </div>
    </>
  );
}

/* ---------- After booking ---------- */

function CancelDialog({ orderId }: { orderId: string }) {
  return (
    <FormDialog
      action={cancelDarazBookingAction}
      hidden={{ orderId }}
      title="Cancel the Daraz booking?"
      description="Only before pickup. Daraz won't collect the parcel. You can book again or choose another courier."
      triggerLabel="Cancel booking"
      triggerIcon={<XCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Cancel booking"
    >
      {(state) => (
        <Field label="Reason (sent to Daraz)" required error={state && !state.ok ? state.fieldErrors?.reason : undefined}>
          {(control) => <Input {...control} name="reason" maxLength={300} required placeholder="e.g. Wrong box size" />}
        </Field>
      )}
    </FormDialog>
  );
}

function ReceiverDialog({ orderId, recipient }: { orderId: string; recipient: { name: string; phoneE164: string; details: string } }) {
  return (
    <FormDialog
      action={updateDarazReceiverAction}
      hidden={{ orderId }}
      title="Change delivery details"
      description="Tell Daraz who receives the parcel and where. The order keeps the address the customer gave at checkout."
      triggerLabel="Edit delivery details"
      triggerIcon={<PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Send to Daraz"
    >
      {(state) => {
        const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
        return (
          <>
            <Field label="Receiver name" required error={errors.receiverName}>
              {(control) => <Input {...control} name="receiverName" defaultValue={recipient.name} maxLength={120} required />}
            </Field>
            <Field label="Receiver phone" required error={errors.receiverPhone} hint="Nepal number, with or without +977.">
              {(control) => <Input {...control} name="receiverPhone" type="tel" defaultValue={recipient.phoneE164} required />}
            </Field>
            <Field label="Address" error={errors.details} hint="Leave as is to keep the address.">
              {(control) => <textarea {...control} name="details" defaultValue={recipient.details} maxLength={300} rows={2} className={cn(fieldControlClasses, "h-auto py-3")} />}
            </Field>
            <Field label="Note for the rider" error={errors.deliveryNote}>
              {(control) => <Input {...control} name="deliveryNote" maxLength={200} />}
            </Field>
          </>
        );
      }}
    </FormDialog>
  );
}

function FeedbackDialog({ orderId }: { orderId: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-warning-100 p-3">
      <p className="flex items-start gap-2 text-body text-warning-700">
        <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
        Daraz couldn&rsquo;t deliver this parcel. Call the customer, then choose what Daraz should do.
      </p>
      <FailedDeliveryDialog orderId={orderId} triggerLabel="Re-attempt or return" />
    </div>
  );
}

/** Re-attempt or return a failed Daraz delivery. Also used by Send & track. */
export function FailedDeliveryDialog({ orderId, triggerLabel }: { orderId: string; triggerLabel: string }) {
  const [feedback, setFeedback] = useState<"REATTEMPT" | "RETURN">("REATTEMPT");
  // Computed once per mount; the earliest re-attempt date in Kathmandu.
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" }));
  return (
    <FormDialog
      action={darazFeedbackAction}
      hidden={{ orderId }}
      title="Failed delivery"
      description="Daraz keeps the parcel until you decide. Call the customer first."
      triggerLabel={triggerLabel}
      triggerVariant="primary"
      submitLabel="Send to Daraz"
    >
      {(state) => {
        const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
        return (
          <>
            <Field label="What should Daraz do?" required error={errors.feedback}>
              {(control) => (
                <Select
                  {...control}
                  name="feedback"
                  value={feedback}
                  onValueChange={(value) => setFeedback(value === "RETURN" ? "RETURN" : "REATTEMPT")}
                  options={[
                    { value: "REATTEMPT", label: "Try delivering again" },
                    { value: "RETURN", label: "Return it to the store" },
                  ]}
                />
              )}
            </Field>
            {feedback === "REATTEMPT" ? (
              <Field label="Re-attempt on" required error={errors.reattemptOn}>
                {(control) => <Input {...control} name="reattemptOn" type="date" min={tomorrow} defaultValue={tomorrow} required />}
              </Field>
            ) : (
              <input type="hidden" name="reattemptOn" value="" />
            )}
            <Field label="Note for Daraz" error={errors.note} hint="e.g. Customer will be home after 4 pm.">
              {(control) => <Input {...control} name="note" maxLength={200} />}
            </Field>
          </>
        );
      }}
    </FormDialog>
  );
}

export function SupportDialog({ orderId, trackingNumber }: { orderId: string | null; trackingNumber: string | null }) {
  return (
    <FormDialog
      action={createDarazSupportCaseAction}
      hidden={{ orderId: orderId ?? "", trackingNumber: trackingNumber ?? "" }}
      title="Open a Daraz support case"
      description="For lost or damaged parcels, wrong statuses or delivery disputes. Daraz answers in the case; follow it under Daraz Express › Support."
      triggerLabel="Support case"
      triggerIcon={<HeadsetIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Open case"
    >
      {(state) => {
        const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
        return (
          <>
            {!orderId ? (
              <Field label="Tracking number" error={errors.trackingNumber}>
                {(control) => <Input {...control} name="trackingNumber" maxLength={100} />}
              </Field>
            ) : null}
            <Field label="Subject" required error={errors.subject}>
              {(control) => <Input {...control} name="subject" maxLength={200} required placeholder="e.g. Parcel marked delivered but customer has not received it" />}
            </Field>
            <Field label="What happened" required error={errors.description}>
              {(control) => <textarea {...control} name="description" maxLength={2000} rows={4} required className={cn(fieldControlClasses, "h-auto py-3")} />}
            </Field>
          </>
        );
      }}
    </FormDialog>
  );
}

function ProofOfDelivery({ orderId }: { orderId: string }) {
  const [proof, setProof] = useState<ProofOfDelivery | null>(null);
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
            const result = await proofOfDeliveryAction(orderId);
            if (result.ok) {
              setProof(result.proof);
              setMessage(result.proof.length === 0 ? "Daraz has no proof of delivery for this parcel." : null);
            } else setMessage(result.message);
          })
        }
      >
        <FileTextIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
        {loading ? "Loading…" : "View proof of delivery"}
      </button>
      {proof && proof.length > 0 ? (
        <ul className="flex flex-col gap-1 text-small">
          {proof.flatMap((entry) =>
            entry.links.map((link, index) => (
              <li key={`${entry.at}-${index}`}>
                <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:text-primary-700">
                  {entry.status} {entry.at ? `· ${formatDateTime(entry.at)}` : ""} ({index + 1})
                </a>
              </li>
            )),
          )}
        </ul>
      ) : null}
      {message ? <p className="text-small text-neutral-500">{message}</p> : null}
      <p className="text-small text-neutral-500">Shown from Daraz each time; Goreto doesn&rsquo;t store photos.</p>
    </div>
  );
}
