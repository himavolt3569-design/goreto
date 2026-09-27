import { NextResponse, type NextRequest } from "next/server";
import { isOrderNumber, isTrackingSecret, rememberTrackingSecret } from "@/features/checkout/tracking-access";
import { getUserSupabase } from "@/lib/supabase/server";

/*
 * Opening a tracking link: /track/<order>/access?code=<secret>. A valid code
 * is stored in the httpOnly order cookie and the browser is sent to the clean
 * /track/<order> URL, so the secret doesn't stay in the address bar or
 * history. An invalid code lands on the same page, which asks for the code.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/track/[orderNumber]/access">) {
  const { orderNumber } = await params;
  if (!isOrderNumber(orderNumber)) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const target = NextResponse.redirect(new URL(`/track/${orderNumber}`, request.url), 303);
  target.headers.set("Referrer-Policy", "no-referrer");
  target.headers.set("Cache-Control", "no-store");

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!isTrackingSecret(code)) return target;

  const { data, error } = await getUserSupabase().rpc("get_order_tracking", { p_order_number: orderNumber, p_secret: code });
  if (!error && data !== null) await rememberTrackingSecret(orderNumber, code);
  return target;
}
