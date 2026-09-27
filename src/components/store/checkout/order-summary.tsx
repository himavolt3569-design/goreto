"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { CaretDownIcon, TagIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SOFT_SECONDARY } from "@/components/store/product/classes";
import { CartLineRow, CartNotices } from "@/components/store/cart/cart-line-row";
import { countItems, type CartLine, type CartNotice } from "@/features/cart/store";
import type { AppliedCoupon, CheckoutQuote } from "@/features/checkout/quote";
import { couponErrorMessage } from "@/features/checkout/errors";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

type OrderSummaryProps = {
  lines: CartLine[];
  quote: CheckoutQuote | null;
  loading: boolean;
  quoteError: string | null;
  notices: CartNotice[];
  onDismissNotices: () => void;
  appliedCoupon: string;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
};

function couponFeedback(coupon: AppliedCoupon | null): { tone: "success" | "error"; text: string } | null {
  if (!coupon) return null;
  if (coupon.status === "applied") {
    return { tone: "success", text: `${coupon.code} applied${coupon.description ? `: ${coupon.description}` : ""}` };
  }
  return { tone: "error", text: couponErrorMessage(coupon.error, coupon.minOrderPaisa) };
}

/** Right-hand order summary from the checkout reference: lines, coupon, totals. */
export function OrderSummary({
  lines,
  quote,
  loading,
  quoteError,
  notices,
  onDismissNotices,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
}: OrderSummaryProps) {
  const couponPanelId = useId();
  const couponInputId = useId();
  const [couponOpen, setCouponOpen] = useState(Boolean(appliedCoupon));
  const [draft, setDraft] = useState(appliedCoupon);

  const itemCount = countItems(lines);
  const subtotal = lines.reduce((total, line) => total + line.unitPricePaisa * line.quantity, 0);
  const coupon = appliedCoupon && quote?.coupon?.code === appliedCoupon.toUpperCase() ? quote.coupon : null;
  const discount = coupon?.status === "applied" ? Math.min(coupon.discountPaisa, subtotal) : 0;
  const delivery = quote?.selectedDelivery ?? null;
  const total = subtotal - discount + (delivery?.pricePaisa ?? 0);
  const feedback = couponFeedback(coupon);

  return (
    <section aria-labelledby="order-summary-title" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="order-summary-title" className="font-display text-h2 text-neutral-900">
          Order Summary{" "}
          <span className="font-sans text-body-lg font-normal text-neutral-500">
            ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
        </h2>
        <Link href="/cart" className="shrink-0 rounded-xs text-body font-medium text-primary-500 underline-offset-4 hover:underline">
          Edit Cart
        </Link>
      </div>

      <CartNotices notices={notices} onDismiss={onDismissNotices} />

      {/* Many items scroll here, so the sticky summary keeps its totals on screen. */}
      <ul className="flex flex-col divide-y divide-neutral-200 lg:max-h-80 lg:overflow-y-auto">
        {lines.map((line) => (
          <CartLineRow key={line.variantId} line={line} />
        ))}
      </ul>

      <div className="border-t border-neutral-200 pt-4">
        <button
          type="button"
          aria-expanded={couponOpen}
          aria-controls={couponPanelId}
          onClick={() => setCouponOpen((open) => !open)}
          className="flex h-11 w-full items-center gap-3 rounded-md text-left text-body-lg text-neutral-700"
        >
          <TagIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
          <span className="flex-1">Have a coupon code?</span>
          <CaretDownIcon
            aria-hidden="true"
            size={ICON_SIZE_XS}
            weight={ICON_WEIGHT_OUTLINE}
            className={cn("transition-transform motion-reduce:transition-none", couponOpen && "rotate-180")}
          />
        </button>
        <div id={couponPanelId} hidden={!couponOpen} className="flex flex-col gap-2 pt-2">
          <label htmlFor={couponInputId} className="sr-only">
            Coupon code
          </label>
          <div className="flex gap-3">
            <Input
              id={couponInputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (draft.trim()) onApplyCoupon(draft.trim());
                }
              }}
              placeholder="Enter coupon code"
              autoComplete="off"
              maxLength={32}
              aria-invalid={feedback?.tone === "error" ? true : undefined}
              aria-describedby={feedback ? `${couponInputId}-feedback` : undefined}
            />
            {coupon?.status === "applied" ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  onRemoveCoupon();
                }}
                className={buttonClasses({ variant: "tertiary", size: "md" })}
              >
                <XIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                Remove
              </button>
            ) : (
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => onApplyCoupon(draft.trim())}
                className={buttonClasses({ variant: "secondary", size: "md", className: cn(SOFT_SECONDARY, "px-6") })}
              >
                Apply
              </button>
            )}
          </div>
          {feedback ? (
            <p
              id={`${couponInputId}-feedback`}
              role="status"
              className={cn("text-small", feedback.tone === "success" ? "text-success-700" : "text-error-700")}
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      </div>

      <dl aria-busy={loading || undefined} className="flex flex-col gap-3 border-t border-neutral-200 pt-4 text-body-lg">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-700">
            Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
          </dt>
          <dd className="font-semibold text-neutral-900">{formatNpr(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-700">Delivery Fee</dt>
          <dd className={delivery ? "font-semibold text-neutral-900" : "text-neutral-500"}>
            {delivery ? formatNpr(delivery.pricePaisa) : "Choose an address"}
          </dd>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-700">Discount</dt>
            <dd className="font-semibold text-success-700">- {formatNpr(discount)}</dd>
          </div>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-4 border-t border-neutral-200 pt-4">
          <dt className="flex flex-col">
            <span className="font-display text-h2 text-neutral-900">Total Amount</span>
            <span className="text-small text-neutral-500">Pay in cash on delivery</span>
          </dt>
          <dd className="font-display text-display-2 text-primary-500">{formatNpr(total)}</dd>
        </div>
      </dl>
      {quoteError ? (
        <p role="alert" className="text-small text-error-700">
          {quoteError}
        </p>
      ) : null}
    </section>
  );
}
