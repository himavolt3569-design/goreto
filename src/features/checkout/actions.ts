"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getUserSupabase } from "@/lib/supabase/server";
import { checkoutFailureFromError, GENERIC_FAILURE, type CheckoutFailure } from "./errors";
import { parseCheckoutQuote, type CheckoutQuote } from "./quote";
import { placeOrderSchema, quoteRequestSchema, type PlaceOrderInput, type QuoteRequest } from "./schemas";
import {
  createTrackingSecret,
  hashTrackingSecret,
  isOrderNumber,
  isTrackingSecret,
  rememberTrackingSecret,
} from "./tracking-access";

/*
 * Storefront checkout Server Actions. Each is a public POST endpoint (Next
 * docs: server-actions), so every input is parsed here and again by the
 * database. Identity comes from the Clerk session through the user-context
 * client (anon for guests); prices never come from the browser.
 */

type QuoteResult = { ok: true; quote: CheckoutQuote } | { ok: false; message: string };

export async function quoteCheckoutAction(request: QuoteRequest): Promise<QuoteResult> {
  const parsed = quoteRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: "Your cart has an item we can't price. Please review your cart." };
  const { items, municipalityCode, courierServiceId, couponCode, email } = parsed.data;

  const { data, error } = await getUserSupabase().rpc("checkout_quote", {
    p_items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    p_municipality_code: municipalityCode,
    p_courier_service_id: courierServiceId,
    p_coupon_code: couponCode || undefined,
    p_contact_email: email || undefined,
  });
  if (error) {
    const failure = checkoutFailureFromError(error);
    if (failure.message === GENERIC_FAILURE) console.error("checkout_quote failed", error.code, error.message);
    return { ok: false, message: failure.message === GENERIC_FAILURE ? "We couldn't load current prices. Please try again." : failure.message };
  }
  return { ok: true, quote: parseCheckoutQuote(data) };
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string }
  | (CheckoutFailure & { fieldErrors?: Record<string, string> });

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const order = parsed.data;

  // A signed-in shopper's profile may not exist yet (webhook delay); create it
  // so the order links to their account. Guests get null.
  await getCurrentProfile().catch((error: unknown) => {
    console.error("Profile lookup before checkout failed", error instanceof Error ? error.message : error);
  });

  const secret = createTrackingSecret();
  const { data, error } = await getUserSupabase().rpc("place_order", {
    p_items: order.items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    p_contact: { name: order.fullName, email: order.email, phone_e164: order.phone },
    p_address: {
      province_code: order.provinceCode,
      district_code: order.districtCode,
      municipality_code: order.municipalityCode,
      ward: order.ward,
      street_landmark: order.streetLandmark,
      postal_code: order.postalCode || null,
      latitude: order.latitude,
      longitude: order.longitude,
    },
    p_courier_service_id: order.courierServiceId,
    p_coupon_code: order.couponCode,
    p_customer_note: order.note,
    p_tracking_hash: hashTrackingSecret(secret),
  });

  if (error) {
    const failure = checkoutFailureFromError(error);
    if (failure.message === GENERIC_FAILURE) console.error("place_order failed", error.code, error.message);
    return failure;
  }

  const placed = z.object({ order_number: z.string() }).safeParse(data);
  if (!placed.success || !isOrderNumber(placed.data.order_number)) {
    console.error("place_order returned an unexpected payload");
    return { ok: false, message: GENERIC_FAILURE };
  }

  await rememberTrackingSecret(placed.data.order_number, secret);
  return { ok: true, orderNumber: placed.data.order_number };
}

export type UnlockOrderState = { error: string | null };

/** "Enter your tracking code" form. Accepts the code or the whole tracking link. */
export async function unlockOrderAction(_state: UnlockOrderState, formData: FormData): Promise<UnlockOrderState> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const raw = String(formData.get("code") ?? "").trim();
  const code = /[?&]code=([^&\s]+)/.exec(raw)?.[1] ?? raw;
  const secret = (() => {
    try {
      return decodeURIComponent(code);
    } catch {
      return code;
    }
  })();

  if (!isOrderNumber(orderNumber)) return { error: "This order number isn't valid." };
  if (!isTrackingSecret(secret)) return { error: "Enter the tracking code from your confirmation page." };

  const { data, error } = await getUserSupabase().rpc("get_order_tracking", {
    p_order_number: orderNumber,
    p_secret: secret,
  });
  if (error) {
    console.error("get_order_tracking failed", error.code, error.message);
    return { error: "We couldn't check that code. Please try again." };
  }
  if (data === null) return { error: "That code doesn't match this order." };

  await rememberTrackingSecret(orderNumber, secret);
  redirect(`/track/${orderNumber}`);
}
