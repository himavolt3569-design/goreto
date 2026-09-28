"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quoteManualOrderAction } from "@/features/admin/actions/manual-orders";
import type { CheckoutQuote } from "@/features/checkout/quote";

/*
 * Server prices for the WhatsApp order form: asks admin_order_quote (the same
 * maths as checkout) whenever the items, address, service, coupon or linked
 * customer change. The browser only displays the result.
 */

type QuoteInput = {
  items: { variantId: string; quantity: number }[];
  municipalityCode: string;
  courierServiceId: string;
  couponCode: string;
  email: string;
  customerId: string;
};

type Resolved = { key: string; quote: CheckoutQuote | null; error: string | null };

const DEBOUNCE_MS = 250;

export function useManualOrderQuote(input: QuoteInput) {
  const [resolved, setResolved] = useState<Resolved>({ key: "", quote: null, error: null });
  const [refreshCount, setRefreshCount] = useState(0);
  const latest = useRef(0);

  const request = useMemo(
    () => ({
      items: input.items.filter((item) => item.variantId && item.quantity > 0),
      municipalityCode: input.municipalityCode || undefined,
      courierServiceId: input.courierServiceId || undefined,
      couponCode: input.couponCode || undefined,
      // Only needed for per-customer coupon limits.
      email: input.couponCode && input.email ? input.email : undefined,
      customerId: input.customerId || undefined,
    }),
    [input.items, input.municipalityCode, input.courierServiceId, input.couponCode, input.email, input.customerId],
  );
  const key = `${refreshCount}:${JSON.stringify(request)}`;
  // The key decides when to quote; the timer reads the latest request so a new object identity alone doesn't restart it.
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    const id = ++latest.current;
    const requestKey = key;
    const timer = window.setTimeout(async () => {
      const request = requestRef.current;
      if (request.items.length === 0) {
        setResolved({ key: requestKey, quote: null, error: null });
        return;
      }
      const result = await quoteManualOrderAction(request).catch(() => ({
        ok: false as const,
        message: "Prices couldn't be loaded. Check your connection and try again.",
      }));
      if (id !== latest.current) return;
      setResolved((previous) =>
        result.ok ? { key: requestKey, quote: result.quote, error: null } : { key: requestKey, quote: previous.quote, error: result.message },
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  return { quote: request.items.length === 0 ? null : resolved.quote, error: resolved.error, loading: resolved.key !== key, refresh };
}
