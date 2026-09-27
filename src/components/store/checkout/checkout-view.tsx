"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonClasses } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, HandbagIcon, LockSimpleIcon, MoneyIcon, WarningCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { fieldControlClasses } from "@/components/ui/input";
import { AssuranceTiles, checkoutAssurances, GoodHandsCard } from "@/components/store/assurance";
import { useCartStore } from "@/features/cart/store";
import { useHydratedCart } from "@/features/cart/use-hydrated-cart";
import { placeOrderAction } from "@/features/checkout/actions";
import { checkoutFormSchema, MAX_NOTE_LENGTH, type CheckoutFormData, type CheckoutFormValues } from "@/features/checkout/schemas";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { AddressSection } from "./address-section";
import { ContactSection } from "./contact-section";
import { DeliverySection } from "./delivery-section";
import { NumberedSection } from "./numbered-section";
import { OrderSummary } from "./order-summary";
import { useCheckoutQuote } from "./use-checkout-quote";

type CheckoutViewProps = {
  address: NepalAddressData;
  defaults: CheckoutFormValues;
  codEnabled: boolean;
  returnsWindowDays: number;
};

/**
 * Checkout from the reference: contact, Nepal address, delivery option on the
 * left; order summary on the right; payment (Cash on Delivery only) and notes
 * below. Totals shown here are a preview; place_order recalculates them.
 */
export function CheckoutView({ address, defaults, codEnabled, returnsWindowDays }: CheckoutViewProps) {
  const router = useRouter();
  const { lines, hydrated } = useHydratedCart();
  const clearCart = useCartStore((state) => state.clear);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const form = useForm<CheckoutFormValues, unknown, CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const [municipalityCode, courierServiceId, email] = useWatch({
    control: form.control,
    name: ["municipalityCode", "courierServiceId", "email"],
  });

  const { quote, error: quoteError, loading, notices, refresh, dismissNotices } = useCheckoutQuote({
    lines,
    hydrated,
    municipalityCode,
    courierServiceId,
    couponCode: appliedCoupon,
    email,
  });

  // Keep the chosen service valid for the current address; preselect the first.
  useEffect(() => {
    if (!quote || loading) return;
    const options = quote.deliveryOptions;
    const current = form.getValues("courierServiceId");
    if (current && options.some((option) => option.courierServiceId === current)) return;
    form.setValue("courierServiceId", options[0]?.courierServiceId ?? "", { shouldValidate: form.formState.isSubmitted });
  }, [quote, loading, form]);

  const overCodLimit = Boolean(quote?.codMaxOrderPaisa && quote.totalPaisa > quote.codMaxOrderPaisa);
  const noDelivery = Boolean(municipalityCode && quote && !loading && quote.deliveryOptions.length === 0);
  const canSubmit = codEnabled && hydrated && lines.length > 0 && !loading && !placing && !overCodLimit && !noDelivery;

  async function submit() {
    setSubmitError(null);
    setPlacing(true);
    const values = form.getValues();
    const result = await placeOrderAction({
      ...values,
      // A code the summary already shows as not valid isn't sent; its discount was never in the totals.
      couponCode: quote?.coupon?.status === "applied" ? appliedCoupon : "",
      items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
    }).catch(() => ({ ok: false as const, message: "We couldn't reach the store. Check your connection and try again." }));

    if (result.ok) {
      setPlacedOrder(result.orderNumber);
      clearCart();
      router.push(`/order-confirmation/${result.orderNumber}`);
      return;
    }

    setPlacing(false);
    setSubmitError(result.message);
    if ("fieldErrors" in result && result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (field in defaults) form.setError(field as keyof CheckoutFormValues, { message });
      }
    }
    if ("couponError" in result && result.couponError) setAppliedCoupon("");
    // Stock or delivery changed: fetch fresh prices; the cart updates itself.
    refresh();
  }

  // Move focus to a server error so keyboard and screen reader users hear it.
  // (Field errors from the form itself focus the first invalid field instead.)
  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  if (placedOrder) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white p-12 text-center">
        <p className="font-display text-h2 text-neutral-900">Order placed</p>
        <p className="text-body text-neutral-500">Opening your order confirmation…</p>
      </div>
    );
  }

  if (hydrated && lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-200 bg-white px-6 py-16 text-center">
        <HandbagIcon aria-hidden="true" size={40} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
        <h2 className="font-display text-h2 text-neutral-900">Your cart is empty</h2>
        <p className="max-w-md text-body text-neutral-500">Add something you love, then come back here to check out.</p>
        <Link href="/categories" className={buttonClasses()}>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(submit)}
        className="flex flex-col gap-6"
      >
        {/* Own grid so the sticky summary stops before the payment card below. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            {!codEnabled ? (
              <p role="alert" className="flex items-start gap-3 rounded-md border border-warning-500/40 bg-warning-100 p-4 text-body text-neutral-900">
                <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
                Cash on delivery is paused right now, so we can&rsquo;t take new orders. Please check back soon.
              </p>
            ) : null}
            <ContactSection />
            <AddressSection data={address} />
            <DeliverySection quote={quote} loading={loading} hasAddress={Boolean(municipalityCode)} />
          </div>

          {/* Only the summary is sticky, inside a wrapper that ends above the
              trust tiles, so it stops before them and never covers them or the
              payment card below. */}
          <aside className="flex min-w-0 flex-col gap-6 lg:self-stretch">
            <div className="lg:flex-1">
              <div className="lg:sticky lg:top-24">
                <OrderSummary
                  lines={lines}
                  quote={quote}
                  loading={loading}
                  quoteError={quoteError}
                  notices={notices}
                  onDismissNotices={dismissNotices}
                  appliedCoupon={appliedCoupon}
                  onApplyCoupon={setAppliedCoupon}
                  onRemoveCoupon={() => setAppliedCoupon("")}
                />
              </div>
            </div>
            <div className="rounded-lg bg-primary-100 px-2 py-6">
              <AssuranceTiles items={checkoutAssurances(returnsWindowDays)} />
            </div>
            <GoodHandsCard className="hidden lg:block" />
          </aside>
        </div>

        <div className="flex flex-col gap-8 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <NumberedSection step={4} title="Payment Method" description="Choose your preferred payment method." className="border-0 p-0 shadow-none sm:p-0">
            <fieldset>
              <legend className="sr-only">Payment method</legend>
              <label className="flex max-w-md cursor-default items-center gap-4 rounded-md border border-primary-500 bg-primary-100 p-4">
                <input type="radio" name="paymentMethod" value="cod" checked readOnly className="size-5 accent-primary-500" />
                <MoneyIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} className="shrink-0 text-primary-500" />
                <span className="flex flex-col">
                  <span className="text-body-lg font-semibold text-neutral-900">Cash on Delivery</span>
                  <span className="text-body text-neutral-500">Pay when you receive your order</span>
                </span>
              </label>
            </fieldset>
          </NumberedSection>

          <NumberedSection
            step={5}
            title="Order Notes"
            titleSuffix="(Optional)"
            description="Add any special instructions for your order (e.g. delivery time, landmarks)."
            className="border-0 p-0 shadow-none sm:p-0"
          >
            <label htmlFor="checkout-note" className="sr-only">
              Order notes
            </label>
            <textarea
              id="checkout-note"
              rows={3}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="e.g. Please call before delivery, leave at the security desk, etc."
              aria-invalid={form.formState.errors.note ? true : undefined}
              className={cn(fieldControlClasses, "h-auto min-h-24 resize-y py-3")}
              {...form.register("note")}
            />
          </NumberedSection>

          <div className="flex flex-col gap-4">
            {submitError ? (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="flex items-start gap-3 rounded-md border border-error-500/40 bg-error-100 p-4 text-body text-neutral-900 outline-none"
              >
                <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-error-700" />
                {submitError}
              </div>
            ) : null}
            {overCodLimit && quote?.codMaxOrderPaisa ? (
              <p role="alert" className="text-body text-error-700">
                Cash on delivery orders can be up to {formatNpr(quote.codMaxOrderPaisa)}. Please remove some items.
              </p>
            ) : null}
            <div className="flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/cart" className={buttonClasses({ variant: "text", className: "self-start text-neutral-900" })}>
                <ArrowLeftIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                Back to Cart
              </Link>
              <Button
                type="submit"
                disabled={!canSubmit}
                loading={placing}
                className="sm:min-w-72"
                leadingIcon={<LockSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                trailingIcon={<ArrowRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
              >
                {placing ? "Placing order…" : "Place Order"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
