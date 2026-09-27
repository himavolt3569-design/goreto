import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { getStorefrontInfo } from "@/features/checkout/store-info";
import { loadOrderTracking } from "@/features/orders/tracking";
import { OrderTrackingView } from "./order-tracking-view";
import { UnlockOrderForm } from "./unlock-order-form";

/**
 * Shared body of /order-confirmation/[orderNumber] and /track/[orderNumber]:
 * the order when this browser may see it, otherwise the tracking-code form.
 * The form never says whether the order number exists.
 */
export async function OrderAccessPage({ orderNumber, variant }: { orderNumber: string; variant: "confirmation" | "tracking" }) {
  const [access, info] = await Promise.all([loadOrderTracking(orderNumber), getStorefrontInfo()]);
  const crumb = variant === "confirmation" ? "Order Confirmation" : "Track Order";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 md:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: crumb }]} />
      {access.found ? (
        <OrderTrackingView order={access.order} trackingLink={access.trackingLink} info={info} variant={variant} />
      ) : (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-display-2 text-neutral-900">Track Your Order</h1>
            <p className="text-body-lg text-neutral-500">
              Enter the tracking code for order <span className="font-medium text-neutral-900">#{orderNumber}</span>. If you
              placed it while signed in, sign in to see it.
            </p>
          </div>
          <UnlockOrderForm orderNumber={orderNumber} />
        </div>
      )}
    </div>
  );
}
