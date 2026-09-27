"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quoteCheckoutAction } from "@/features/checkout/actions";
import type { CheckoutQuote } from "@/features/checkout/quote";
import { orderableLines, useCartStore, type CartLine, type CartNotice } from "@/features/cart/store";

/*
 * Live prices for the cart and checkout. Asks the server (checkout_quote) for
 * current prices, stock, delivery options and discount whenever the cart or
 * the chosen address/service/coupon changes, and applies price and stock
 * changes to the saved cart with a notice for each.
 */

type QuoteParams = {
  lines: CartLine[];
  hydrated: boolean;
  municipalityCode?: string;
  courierServiceId?: string;
  couponCode?: string;
  email?: string;
};

type Resolved = { key: string; quote: CheckoutQuote | null; error: string | null };

const DEBOUNCE_MS = 250;
const NETWORK_ERROR = "We couldn't load current prices. Check your connection and try again.";

function mergeNotices(current: CartNotice[], changes: CartNotice[]): CartNotice[] {
  const kept = current.filter(
    (notice) => !changes.some((change) => change.variantId === notice.variantId && change.kind === notice.kind),
  );
  return [...kept, ...changes];
}

export function useCheckoutQuote({ lines, hydrated, municipalityCode, courierServiceId, couponCode, email }: QuoteParams) {
  const reconcile = useCartStore((state) => state.reconcile);
  const [resolved, setResolved] = useState<Resolved>({ key: "", quote: null, error: null });
  const [notices, setNotices] = useState<CartNotice[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const latest = useRef(0);

  const request = useMemo(() => {
    const orderable = orderableLines(lines);
    return {
      items: orderable.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      hasUnorderable: orderable.length !== lines.length,
      municipalityCode: municipalityCode || undefined,
      courierServiceId: courierServiceId || undefined,
      couponCode: couponCode || undefined,
      // Only needed for per-customer coupon limits.
      email: couponCode && email ? email : undefined,
    };
  }, [lines, municipalityCode, courierServiceId, couponCode, email]);
  const key = `${refreshCount}:${JSON.stringify(request)}`;

  useEffect(() => {
    if (!hydrated) return;
    const id = ++latest.current;
    const requestKey = `${refreshCount}:${JSON.stringify(request)}`;

    const timer = window.setTimeout(async () => {
      if (request.items.length === 0) {
        // Old lines the server can't price: drop them with a notice.
        if (request.hasUnorderable) {
          const removed = reconcile([]);
          if (removed.length) setNotices((current) => mergeNotices(current, removed));
        }
        setResolved({ key: requestKey, quote: null, error: null });
        return;
      }

      const result = await quoteCheckoutAction({
        items: request.items,
        municipalityCode: request.municipalityCode,
        courierServiceId: request.courierServiceId,
        couponCode: request.couponCode,
        email: request.email,
      }).catch(() => ({ ok: false as const, message: NETWORK_ERROR }));
      if (id !== latest.current) return;

      if (!result.ok) {
        setResolved((previous) => ({ key: requestKey, quote: previous.quote, error: result.message }));
        return;
      }
      setResolved({ key: requestKey, quote: result.quote, error: null });
      const changes = reconcile(
        result.quote.lines.map((line) => ({
          variantId: line.variantId,
          unitPricePaisa: line.unitPricePaisa,
          availableQuantity: line.availableQuantity,
        })),
      );
      if (changes.length) setNotices((current) => mergeNotices(current, changes));
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [request, hydrated, refreshCount, reconcile]);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);
  const dismissNotices = useCallback(() => setNotices([]), []);

  return {
    quote: resolved.quote,
    error: resolved.error,
    /** True while the shown quote is older than the current cart/choices. */
    loading: !hydrated || resolved.key !== key,
    notices,
    refresh,
    dismissNotices,
  };
}
