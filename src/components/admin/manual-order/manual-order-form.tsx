"use client";

import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editorGridClasses } from "@/components/admin/admin-ui";
import { FormSection } from "@/components/admin/product-form/fields";
import { NepalAddressFields } from "@/components/delivery/nepal-address-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { TruckIcon, WarningCircleIcon, WhatsappLogoIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { createManualOrderAction } from "@/features/admin/actions/manual-orders";
import { sendNewOrderAction, type SendOutcome } from "@/features/admin/actions/parcels";
import { emptyManualOrder, manualOrderSchema, type ManualOrder, type ManualOrderFailure, type ManualOrderValues } from "@/features/admin/manual-order-forms";
import type { OrderVariantOption } from "@/features/admin/queries/manual-orders";
import type { LineIssue } from "@/features/checkout/errors";
import { couponErrorMessage } from "@/features/checkout/errors";
import { deliveryEstimate } from "@/features/checkout/quote";
import { MAX_NOTE_LENGTH } from "@/features/checkout/schemas";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { CustomerSection } from "./customer-section";
import { ItemsSection } from "./items-section";
import { useManualOrderQuote } from "./use-manual-order-quote";

export type SentOrder = Extract<SendOutcome, { ok: true }>;

/** Send & track: save, accept and send in one click, then stay on the page. */
export type SendMode = {
  /** Delivery services whose courier is booked through the Daraz API. */
  darazServiceIds: readonly string[];
  usualWeightGrams: number | null;
  onSent: (order: SentOrder) => void;
};

/**
 * New WhatsApp order (worklog §4.0): staff key in what the customer asked
 * for on WhatsApp. Every amount shown comes from admin_order_quote and is
 * recalculated by admin_create_order; payment is Cash on Delivery. The order
 * waits for acceptance unless WhatsApp auto-accept is on. With `send`
 * (Send & track) it is accepted, routed and booked on save instead.
 */
export function ManualOrderForm({
  address,
  canLinkCustomer,
  autoAccept,
  codEnabled,
  send,
}: {
  address: NepalAddressData;
  canLinkCustomer: boolean;
  autoAccept: boolean;
  codEnabled: boolean;
  send?: SendMode;
}) {
  const [variants, setVariants] = useState<Record<string, OrderVariantOption>>({});
  const [lineIssues, setLineIssues] = useState<LineIssue[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [weight, setWeight] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const form = useForm<ManualOrderValues, unknown, ManualOrder>({
    resolver: zodResolver(manualOrderSchema),
    defaultValues: emptyManualOrder(),
    mode: "onTouched",
  });
  const [items, municipalityCode, courierServiceId, couponCode, email, customerId] = useWatch({
    control: form.control,
    name: ["items", "municipalityCode", "courierServiceId", "couponCode", "email", "customerId"],
  });

  const { quote, error: quoteError, loading, refresh } = useManualOrderQuote({
    items: items.map((item) => ({ variantId: item.variantId, quantity: Number.isFinite(item.quantity) ? item.quantity : 0 })),
    municipalityCode,
    courierServiceId,
    couponCode: couponCode.trim().toUpperCase(),
    email,
    customerId,
  });

  // Keep the chosen service valid for the current address; preselect the first.
  useEffect(() => {
    if (!quote || loading) return;
    const current = form.getValues("courierServiceId");
    if (current && quote.deliveryOptions.some((option) => option.courierServiceId === current)) return;
    form.setValue("courierServiceId", quote.deliveryOptions[0]?.courierServiceId ?? "", { shouldValidate: form.formState.isSubmitted });
  }, [quote, loading, form]);

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const options = municipalityCode ? (quote?.deliveryOptions ?? []) : [];
  const overCodLimit = Boolean(quote?.codMaxOrderPaisa && quote.totalPaisa > quote.codMaxOrderPaisa);
  const couponRejected = quote?.coupon?.status === "rejected" ? quote.coupon : null;
  const canSubmit = codEnabled && items.length > 0 && !loading && !submitting && !overCodLimit && !couponRejected;

  const selectedOption = options.find((option) => option.courierServiceId === courierServiceId) ?? null;
  const darazSelected = Boolean(send && selectedOption && send.darazServiceIds.includes(selectedOption.courierServiceId));
  // What the server books with when the weight is left empty: the products' total, then the usual weight.
  const productGrams =
    items.length > 0 && items.every((item) => variants[item.variantId]?.weightGrams)
      ? items.reduce((sum, item) => sum + variants[item.variantId]!.weightGrams! * (Number.isFinite(item.quantity) ? item.quantity : 0), 0)
      : null;
  const autoGrams = productGrams ?? send?.usualWeightGrams ?? null;

  // Runs after the resolver validated the form; the action parses the raw values again.
  async function submit() {
    setSubmitError(null);
    setWeightError(null);
    setSubmitting(true);
    const offline: ManualOrderFailure = { ok: false, message: "The order couldn't be saved. Check your connection and try again." };
    const result = send
      ? await sendNewOrderAction(form.getValues(), darazSelected ? weight : "").catch(() => offline)
      : await createManualOrderAction(form.getValues()).catch(() => offline);
    setSubmitting(false);
    if (result.ok) {
      // Send & track stays on the page: show the result and start a fresh order.
      if (send && "orderNumber" in result) {
        send.onSent(result);
        form.reset(emptyManualOrder());
        setVariants({});
        setLineIssues([]);
        setWeight("");
      }
      return;
    }
    // On success the create action redirects to the new order.
    setSubmitError(result.message);
    if ("fieldErrors" in result && result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (field in emptyManualOrder()) form.setError(field as keyof ManualOrderValues, { message });
        if (field === "weightGrams") setWeightError(message);
      }
    }
    setLineIssues("lineIssues" in result && result.lineIssues ? result.lineIssues : []);
    refresh();
  }

  const submitLabel = send ? `Save and send${selectedOption ? ` to ${selectedOption.courierName}` : ""}` : autoAccept ? "Create and accept order" : "Create order";
  const submitNote = send
    ? darazSelected
      ? "Goreto accepts the order and books it with Daraz Express straight away."
      : selectedOption
        ? `Goreto accepts the order for ${selectedOption.courierName}. Then tap Send on WhatsApp to give them the details.`
        : "Choose a delivery option to see who delivers it."
    : autoAccept
      ? "WhatsApp auto-accept is on: the order is accepted and a courier assigned as soon as it's saved."
      : "The order is saved as Pending. Someone with order access accepts it before it goes to a courier.";

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(submit)} className={editorGridClasses}>
        <div className="flex min-w-0 flex-col gap-6">
          {!codEnabled ? (
            <p role="alert" className="flex items-start gap-3 rounded-md bg-warning-100 p-4 text-body text-neutral-900">
              <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
              Cash on Delivery is turned off in Settings, so new orders are paused.
            </p>
          ) : null}

          <CustomerSection canLinkCustomer={canLinkCustomer} />

          <ItemsSection
            variants={variants}
            onVariantAdded={(variant) => {
              setVariants((current) => ({ ...current, [variant.variantId]: variant }));
              setLineIssues((current) => current.filter((issue) => issue.variantId !== variant.variantId));
            }}
            quoteLines={quote?.lines ?? []}
            lineIssues={lineIssues}
          />

          <FormSection id="address" title="Delivery address" description="Where the courier delivers. Confirm the ward and a landmark with the customer.">
            <NepalAddressFields data={address} />
          </FormSection>

          <FormSection id="delivery" title="Delivery option" description="Services the store's delivery zones offer for this address, with their real fees.">
            {!municipalityCode ? (
              <p className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-500">Choose the municipality to see delivery options.</p>
            ) : items.length === 0 ? (
              <p className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-500">Add an item to see delivery options and fees.</p>
            ) : options.length === 0 ? (
              loading || !quote ? (
                <p aria-busy="true" className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-500">
                  Finding delivery options…
                </p>
              ) : (
                <p role="alert" className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
                  <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
                  No delivery zone covers this address yet. Add it in Delivery → Zones, or check the address.
                </p>
              )
            ) : (
              <fieldset aria-busy={loading || undefined} className="flex flex-col gap-2">
                <legend className="sr-only">Delivery option</legend>
                {options.map((option) => (
                  <label
                    key={option.courierServiceId}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500/40",
                      courierServiceId === option.courierServiceId ? "border-primary-500 bg-primary-100" : "border-neutral-200 hover:border-primary-300",
                    )}
                  >
                    <input type="radio" value={option.courierServiceId} {...form.register("courierServiceId")} className="size-5 shrink-0 accent-primary-500" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-medium text-neutral-900">
                        {option.courierName} · {option.serviceName}
                      </span>
                      {send?.darazServiceIds.includes(option.courierServiceId) ? (
                        <span className="mt-1 w-fit rounded-full bg-primary-100 px-2 text-small font-medium text-primary-700">Books through Daraz Express</span>
                      ) : null}
                      <span className="text-small text-neutral-500">{deliveryEstimate(option.estimatedMinDays, option.estimatedMaxDays)}</span>
                    </span>
                    <span className="text-body font-semibold tabular-nums text-neutral-900">{formatNpr(option.pricePaisa)}</span>
                  </label>
                ))}
                {form.formState.errors.courierServiceId ? (
                  <p className="text-small text-error-700">{form.formState.errors.courierServiceId.message}</p>
                ) : null}
              </fieldset>
            )}
          </FormSection>

          <FormSection id="extras" title="Coupon and note" description="Optional.">
            <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
              <Field
                label="Coupon code"
                error={form.formState.errors.couponCode?.message ?? (couponRejected ? couponErrorMessage(couponRejected.error, couponRejected.minOrderPaisa) : undefined)}
              >
                {(control) => <Input {...control} {...form.register("couponCode")} autoComplete="off" maxLength={32} className="uppercase" />}
              </Field>
              <Field label="Note for this order" error={form.formState.errors.note?.message} hint="Shown on the order, not sent to the courier.">
                {(control) => (
                  <textarea
                    {...control}
                    {...form.register("note")}
                    rows={3}
                    maxLength={MAX_NOTE_LENGTH}
                    className={cn(fieldControlClasses, "h-auto py-3")}
                    placeholder="e.g. Customer asked for gift wrapping."
                  />
                )}
              </Field>
            </div>
          </FormSection>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-24">
          <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-h3 text-neutral-900">Order summary</h2>
              <p className="text-small text-neutral-500">Calculated by the server from current prices.</p>
            </div>
            <dl aria-busy={loading || undefined} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-body">
              <dt className="text-neutral-500">Subtotal</dt>
              <dd className="text-right tabular-nums">{quote ? formatNpr(quote.subtotalPaisa) : "—"}</dd>
              {quote && quote.discountPaisa > 0 ? (
                <>
                  <dt className="text-neutral-500">Discount</dt>
                  <dd className="text-right tabular-nums text-success-700">−{formatNpr(quote.discountPaisa)}</dd>
                </>
              ) : null}
              <dt className="text-neutral-500">Delivery</dt>
              <dd className="text-right tabular-nums">{quote?.selectedDelivery ? formatNpr(quote.deliveryFeePaisa) : "—"}</dd>
              <dt className="border-t border-neutral-200 pt-2 font-semibold">Cash to collect</dt>
              <dd className="border-t border-neutral-200 pt-2 text-right font-semibold tabular-nums">{quote ? formatNpr(quote.totalPaisa) : "—"}</dd>
            </dl>
            {quoteError ? <p className="text-small text-error-700">{quoteError}</p> : null}
            {overCodLimit && quote?.codMaxOrderPaisa ? (
              <p className="text-small text-error-700">Cash on Delivery orders can be up to {formatNpr(quote.codMaxOrderPaisa)}.</p>
            ) : null}
            {darazSelected ? (
              <Field
                label="Parcel weight (g)"
                error={weightError ?? undefined}
                hint={
                  productGrams
                    ? `Leave empty to use the product weights (${productGrams} g).`
                    : autoGrams
                      ? `Leave empty to use the usual parcel weight (${autoGrams} g).`
                      : "Some items have no weight saved. Weigh the packed parcel."
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    placeholder={autoGrams ? `Auto: ${autoGrams} g` : "e.g. 500"}
                  />
                )}
              </Field>
            ) : null}
            <p className="text-small text-neutral-700">{submitNote}</p>
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={!canSubmit}
              leadingIcon={
                send ? (
                  <TruckIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                ) : (
                  <WhatsappLogoIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                )
              }
            >
              {submitLabel}
            </Button>
            {submitError ? (
              <div ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 text-small text-error-700 outline-none">
                <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
                {submitError}
              </div>
            ) : null}
          </Card>
        </aside>
      </form>
    </FormProvider>
  );
}
