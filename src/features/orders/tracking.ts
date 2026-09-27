import "server-only";
import { cache } from "react";
import { isOrderNumber, readTrackingSecret, trackingLinkPath } from "@/features/checkout/tracking-access";
import { getUserSupabase } from "@/lib/supabase/server";
import { parseOrderTracking, type OrderTracking } from "./tracking-model";

export type OrderTrackingAccess =
  | { found: true; order: OrderTracking; trackingLink: string | null }
  | { found: false };

/**
 * The order for the confirmation and tracking pages: to its signed-in owner,
 * or to a browser holding the tracking secret cookie. Anything else (wrong
 * number, no access) is `found: false`, so a page never reveals whether an
 * order exists.
 */
export const loadOrderTracking = cache(async (orderNumber: string): Promise<OrderTrackingAccess> => {
  if (!isOrderNumber(orderNumber)) return { found: false };
  const secret = await readTrackingSecret(orderNumber);

  const { data, error } = await getUserSupabase().rpc("get_order_tracking", {
    p_order_number: orderNumber,
    p_secret: secret ?? undefined,
  });
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  if (data === null) return { found: false };

  return {
    found: true,
    order: parseOrderTracking(data),
    trackingLink: secret ? trackingLinkPath(orderNumber, secret) : null,
  };
});
