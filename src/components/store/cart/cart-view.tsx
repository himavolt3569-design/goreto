"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, HandbagIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { AssuranceTiles, checkoutAssurances } from "@/components/store/assurance";
import { useCheckoutQuote } from "@/components/store/checkout/use-checkout-quote";
import { countItems } from "@/features/cart/store";
import { useHydratedCart } from "@/features/cart/use-hydrated-cart";
import { formatNpr } from "@/lib/money/format";
import { CartLineRow, CartNotices } from "./cart-line-row";

/**
 * Cart page. Lines live in this browser; the server re-prices them on load
 * and after every change, so prices and stock limits are current. Delivery
 * and discounts are worked out at checkout.
 */
export function CartView({ returnsWindowDays }: { returnsWindowDays: number }) {
  const { lines, hydrated } = useHydratedCart();
  const { error, loading, notices, dismissNotices } = useCheckoutQuote({ lines, hydrated });

  if (!hydrated) {
    return <div aria-busy="true" aria-label="Loading your cart" className="h-64 rounded-lg border border-neutral-200 bg-white" />;
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-200 bg-white px-6 py-16 text-center">
        <CartNotices notices={notices} onDismiss={dismissNotices} />
        <HandbagIcon aria-hidden="true" size={40} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
        <h2 className="font-display text-h2 text-neutral-900">Your cart is empty</h2>
        <p className="max-w-md text-body text-neutral-500">Browse the collection and add the pieces you love.</p>
        <Link href="/categories" className={buttonClasses()}>
          Start shopping
        </Link>
      </div>
    );
  }

  const itemCount = countItems(lines);
  const subtotal = lines.reduce((total, line) => total + line.unitPricePaisa * line.quantity, 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <section aria-labelledby="cart-items-title" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 id="cart-items-title" className="font-display text-h2 text-neutral-900">
          Items{" "}
          <span className="font-sans text-body-lg font-normal text-neutral-500">({itemCount})</span>
        </h2>
        <CartNotices notices={notices} onDismiss={dismissNotices} />
        <ul className="flex flex-col divide-y divide-neutral-200">
          {lines.map((line) => (
            <CartLineRow key={line.variantId} line={line} size="lg" />
          ))}
        </ul>
        <Link href="/categories" className={buttonClasses({ variant: "text", className: "self-start text-neutral-900" })}>
          <ArrowLeftIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Continue shopping
        </Link>
      </section>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
        <section aria-labelledby="cart-summary-title" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 id="cart-summary-title" className="font-display text-h2 text-neutral-900">
            Order Summary
          </h2>
          <dl aria-busy={loading || undefined} className="flex flex-col gap-3 text-body-lg">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-700">
                Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
              </dt>
              <dd className="font-semibold text-neutral-900">{formatNpr(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-700">Delivery Fee</dt>
              <dd className="text-neutral-500">At checkout</dd>
            </div>
          </dl>
          <p className="text-small text-neutral-500">
            Delivery fees depend on your address. Coupons are applied at checkout. You pay in cash when your order arrives.
          </p>
          {error ? (
            <p role="alert" className="text-small text-error-700">
              {error}
            </p>
          ) : null}
          <Link href="/checkout" className={buttonClasses({ fullWidth: true })}>
            Proceed to Checkout
            <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          </Link>
        </section>
        <div className="rounded-lg bg-primary-100 px-2 py-6">
          <AssuranceTiles items={checkoutAssurances(returnsWindowDays)} />
        </div>
      </aside>
    </div>
  );
}
