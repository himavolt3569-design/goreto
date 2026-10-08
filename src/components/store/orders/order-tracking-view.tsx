import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  HeadsetIcon,
  LinkIcon,
  MapPinIcon,
  MoneyIcon,
  PackageIcon,
  PhoneIcon,
  ReceiptIcon,
  TruckIcon,
  UserIcon,
  XCircleIcon,
  type Icon,
} from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { MediaFrame } from "@/components/ui/media-frame";
import { AssuranceTiles, GoodHandsCard, trackingAssurances } from "@/components/store/assurance";
import { LocationMap } from "@/components/store/map/location-map";
import type { StorefrontInfo } from "@/features/checkout/store-info";
import { deliveryEstimate } from "@/features/checkout/quote";
import { formatCalendarRange, formatOrderDateTime } from "@/features/orders/format";
import { buildOrderSteps } from "@/features/orders/stepper";
import { SHIPMENT_STATUS_LABELS } from "@/features/orders/shipment-labels";
import type { OrderStatus, OrderTracking } from "@/features/orders/tracking-model";
import { formatNpr } from "@/lib/money/format";
import { formatNepalPhone } from "@/lib/validation/phone";
import { cn } from "@/lib/utils/cn";
import { CopyButton } from "./copy-button";
import { OrderStepper } from "./order-stepper";
import { OrderPanel } from "./panel";

/*
 * Order confirmation / tracking from the order reference (AGENTS §4.5).
 * Everything shown comes from the order's snapshots and shipment events. The
 * map shows only the delivery location the shopper shared: there is no live
 * courier position, so none is drawn.
 */

const statusBanner: Record<OrderStatus, { title: string; text: string; tone: "success" | "info" | "error" }> = {
  pending_confirmation: {
    title: "Order Placed",
    text: "Thank you for shopping with Goreto.store! We’ll confirm your order shortly, then prepare it for delivery.",
    tone: "success",
  },
  confirmed: { title: "Order Confirmed", text: "Your order is confirmed and being prepared.", tone: "success" },
  processing: { title: "Order Confirmed", text: "Your order is confirmed and being prepared.", tone: "success" },
  packed: { title: "Order Packed", text: "Your order is packed and waiting for the courier.", tone: "success" },
  shipped: { title: "On Its Way", text: "Your order is with the courier and on its way to you.", tone: "info" },
  delivered: { title: "Delivered", text: "Your order has been delivered. Enjoy!", tone: "success" },
  canceled: { title: "Order Canceled", text: "This order was canceled.", tone: "error" },
};

type Variant = "confirmation" | "tracking" | "account";

const variantCopy: Record<Variant, { title: string; text: string }> = {
  confirmation: { title: "Thank You for Your Order", text: "Here are your order details. Keep this page to follow your delivery." },
  tracking: { title: "Track Your Order", text: "Here’s the latest update and tracking details." },
  account: { title: "Order Details", text: "Status, delivery updates and items for this order." },
};

const paymentLabels: Record<OrderTracking["paymentStatus"], string> = {
  pending: "Pay on delivery",
  collected: "Paid",
  failed: "Not collected",
  refunded: "Refunded",
};

function InfoTile({ icon: TileIcon, label, value }: { icon: Icon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-500">
        <TileIcon size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-body text-neutral-500">{label}</span>
        <span className="text-body-lg font-medium text-neutral-900">{value}</span>
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: OrderTracking["items"][number] }) {
  return (
    <li className="flex items-center gap-4 py-3">
      <MediaFrame image={item.image} sizes="80px" className="size-20 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-display text-body-lg font-semibold text-neutral-900">{item.title}</p>
        {item.variantTitle ? <p className="text-body text-neutral-500">{item.variantTitle}</p> : null}
        <p className="text-small text-neutral-500">Qty: {item.quantity}</p>
      </div>
      <p className="shrink-0 text-body-lg font-semibold text-neutral-900">{formatNpr(item.lineTotalPaisa)}</p>
    </li>
  );
}

export function OrderTrackingView({
  order,
  trackingLink,
  info,
  variant,
}: {
  order: OrderTracking;
  trackingLink: string | null;
  info: StorefrontInfo;
  /** "account" sits inside the account shell: smaller title, two columns from xl, back to the order list. */
  variant: Variant;
}) {
  const inAccount = variant === "account";
  const banner = statusBanner[order.status];
  const steps = buildOrderSteps(order);
  const estimate =
    order.shipment?.estimatedFrom && order.shipment.estimatedTo
      ? formatCalendarRange(order.shipment.estimatedFrom, order.shipment.estimatedTo)
      : null;
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const courier = order.shipment?.courier ?? null;
  const address = order.address;
  const BannerIcon = banner.tone === "error" ? XCircleIcon : CheckCircleIcon;
  const supportHref = info.supportEmail
    ? `mailto:${info.supportEmail}?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`
    : info.supportPhoneE164
      ? `tel:${info.supportPhoneE164}`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className={cn("font-display text-display-2 text-neutral-900", !inAccount && "md:text-display-1")}>
            {variantCopy[variant].title}
          </h1>
          <p className="text-body-lg text-neutral-500">{variantCopy[variant].text}</p>
        </div>
        <div className="flex flex-col md:items-end">
          <p className="text-h3 font-semibold text-neutral-900">Order #{order.orderNumber}</p>
          <p className="text-body text-neutral-500">Placed on {formatOrderDateTime(order.placedAt)}</p>
        </div>
      </header>

      <section
        aria-labelledby="order-status-title"
        className={cn(
          "flex flex-col gap-6 rounded-lg border p-4 sm:p-6",
          banner.tone === "error" ? "border-error-500/30 bg-error-100/40" : "border-success-500/30 bg-success-100/40",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full text-white",
              banner.tone === "error" ? "bg-error-500" : "bg-success-500",
            )}
          >
            <BannerIcon size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="order-status-title" className="font-display text-h1 text-neutral-900">
              {banner.title}
            </h2>
            <p className="text-body-lg text-neutral-700">
              {order.status === "canceled" && order.cancellationReason ? `${banner.text} Reason: ${order.cancellationReason}` : banner.text}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile icon={ReceiptIcon} label="Order ID" value={order.orderNumber} />
          <InfoTile icon={CalendarBlankIcon} label="Order Date" value={formatOrderDateTime(order.placedAt)} />
          <InfoTile
            icon={MoneyIcon}
            label="Payment Method"
            value={
              <>
                Cash on Delivery <span className="text-body font-normal text-neutral-500">· {paymentLabels[order.paymentStatus]}</span>
              </>
            }
          />
          <InfoTile
            icon={CalendarBlankIcon}
            label="Estimated Delivery"
            value={order.status === "canceled" ? "—" : (estimate ?? "Shared after confirmation")}
          />
        </div>
      </section>

      {trackingLink ? (
        <section className="flex flex-col gap-3 rounded-lg border border-primary-200 bg-primary-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <LinkIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-primary-500" />
            <div className="flex flex-col gap-1">
              <h2 className="text-body-lg font-semibold text-neutral-900">Save your tracking link</h2>
              <p className="text-body text-neutral-700">
                This browser remembers your order. To check it on another device, keep this link private and open it there.
              </p>
            </div>
          </div>
          <CopyButton value={trackingLink} asUrl label="Copy tracking link" className="self-start border border-primary-200 bg-white sm:self-center" />
        </section>
      ) : null}

      <div
        className={cn(
          "grid items-start gap-6",
          inAccount ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">
          <OrderPanel icon={TruckIcon} title="Order Tracking" description="Follow your order at every step. Updates appear here as they happen.">
            <OrderStepper steps={steps} />

            {address.latitude !== null && address.longitude !== null ? (
              <div className="flex flex-col gap-2">
                <LocationMap
                  latitude={address.latitude}
                  longitude={address.longitude}
                  label="Delivery location"
                  caption="Map of the delivery location shared at checkout."
                  zoom={15}
                  className="h-56 sm:h-64"
                />
                <p className="flex items-center gap-2 text-small text-neutral-500">
                  <MapPinIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
                  Delivery location you shared at checkout. Live courier location isn&rsquo;t available.
                </p>
              </div>
            ) : null}

            {order.events.length ? (
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-h3 text-neutral-900">
                  <ClockCounterClockwiseIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
                  Updates
                </h3>
                <ol className="flex flex-col gap-4 border-l-2 border-neutral-200 pl-4">
                  {order.events.map((event, index) => (
                    <li key={`${event.occurredAt}-${index}`} className="flex flex-col gap-1">
                      <span className="text-body font-semibold text-neutral-900">{SHIPMENT_STATUS_LABELS[event.status]}</span>
                      <span className="text-body text-neutral-700">
                        {event.message}
                        {event.locationLabel ? ` · ${event.locationLabel}` : ""}
                      </span>
                      <time dateTime={event.occurredAt} className="text-small text-neutral-500">
                        {formatOrderDateTime(event.occurredAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </OrderPanel>

          {courier ? (
            <OrderPanel icon={TruckIcon} title="Courier Information" description="Your order is being delivered by our courier partner.">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-4">
                  <span className="font-display text-h3 font-semibold text-neutral-900">{courier.name}</span>
                  <span className="text-body text-neutral-500">{order.delivery.serviceName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-body text-neutral-500">Tracking Number</span>
                  {order.shipment?.trackingNumber ? (
                    <span className="flex items-center gap-1 text-body-lg font-medium text-neutral-900">
                      {order.shipment.trackingNumber}
                      <CopyButton value={order.shipment.trackingNumber} label="Copy tracking number" />
                    </span>
                  ) : (
                    <span className="text-body text-neutral-700">Not assigned yet</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {courier.trackingUrl ? (
                    <a href={courier.trackingUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "primary", size: "md" })}>
                      <TruckIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                      Track on {courier.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {courier.phone ? (
                    <a href={`tel:${courier.phone}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
                      <PhoneIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                      Call Courier
                    </a>
                  ) : null}
                </div>
              </div>
            </OrderPanel>
          ) : null}

          <OrderPanel icon={MapPinIcon} title="Delivery Address" description="Your order will be delivered to this address.">
            <div className="grid gap-4 sm:grid-cols-2 sm:divide-x sm:divide-neutral-200">
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-3 text-body-lg text-neutral-900">
                  <UserIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                  {address.recipientName}
                </p>
                <p className="flex items-center gap-3 text-body-lg text-neutral-900">
                  <PhoneIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                  {formatNepalPhone(address.phoneE164)}
                </p>
              </div>
              <address className="flex gap-3 not-italic sm:pl-4">
                <MapPinIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-neutral-500" />
                <span className="flex flex-col gap-1 text-body text-neutral-500">
                  <span className="text-body-lg font-medium text-neutral-900">{address.streetLandmark}</span>
                  <span>
                    {address.municipalityName}, Ward No. {address.ward}
                  </span>
                  <span>
                    {address.districtName}, {address.provinceName}
                  </span>
                  {address.postalCode ? <span>Postal Code: {address.postalCode}</span> : null}
                </span>
              </address>
            </div>
            {order.note ? (
              <p className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-700">
                <span className="font-medium text-neutral-900">Your note: </span>
                {order.note}
              </p>
            ) : null}
          </OrderPanel>

          <OrderPanel
            icon={PackageIcon}
            title={`Ordered Items (${itemCount})`}
            description="Here are the items from your order. They’ll be delivered together."
          >
            <ul className="flex flex-col divide-y divide-neutral-200">
              {order.items.map((item, index) => (
                <ItemRow key={`${item.sku}-${index}`} item={item} />
              ))}
            </ul>
          </OrderPanel>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="order-total-title" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="order-total-title" className="font-display text-h2 text-neutral-900">
                Order Summary
              </h2>
              <span className="text-body text-neutral-500">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <dl className="flex flex-col gap-3 text-body-lg">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-700">Subtotal</dt>
                <dd className="font-semibold text-neutral-900">{formatNpr(order.subtotalPaisa)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-700">Delivery Fee</dt>
                <dd className="font-semibold text-neutral-900">{formatNpr(order.deliveryFeePaisa)}</dd>
              </div>
              {order.discountPaisa > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-700">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                  <dd className="font-semibold text-success-700">- {formatNpr(order.discountPaisa)}</dd>
                </div>
              ) : null}
              <div className="mt-2 flex items-end justify-between gap-4 border-t border-neutral-200 pt-4">
                <dt className="flex flex-col">
                  <span className="font-display text-h2 text-neutral-900">Total Amount</span>
                  <span className="text-small text-neutral-500">Cash on delivery</span>
                </dt>
                <dd className="font-display text-display-2 text-primary-500">{formatNpr(order.totalPaisa)}</dd>
              </div>
            </dl>
          </section>

          <OrderPanel icon={CalendarBlankIcon} title="Delivery Details">
            <div className="flex flex-col gap-1">
              <span className="text-body text-neutral-500">Estimated Delivery</span>
              <span className="text-h3 font-semibold text-primary-500">
                {order.status === "canceled" ? "Canceled" : (estimate ?? "Shared after confirmation")}
              </span>
              <span className="text-body text-neutral-500">
                {deliveryEstimate(order.delivery.estimatedMinDays, order.delivery.estimatedMaxDays)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md bg-primary-100 p-4">
              <span className="flex items-center gap-3">
                <TruckIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
                <span className="flex flex-col">
                  <span className="text-body-lg font-semibold text-neutral-900">{order.delivery.serviceName}</span>
                  <span className="text-small text-neutral-500">{order.delivery.courierName}</span>
                </span>
              </span>
              <span className="text-body-lg font-bold text-primary-500">{formatNpr(order.delivery.pricePaisa)}</span>
            </div>
          </OrderPanel>

          <OrderPanel icon={HeadsetIcon} title="Need Help?">
            <p className="text-body text-neutral-700">
              Questions about your order, delivery or returns? Contact us with your order number and we&rsquo;ll help.
            </p>
            {supportHref ? (
              <a href={supportHref} className={buttonClasses({ fullWidth: true })}>
                {info.supportEmail ? (
                  <EnvelopeSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                ) : (
                  <PhoneIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                )}
                Contact Support
              </a>
            ) : null}
            {info.supportEmail && info.supportPhoneE164 ? (
              <a href={`tel:${info.supportPhoneE164}`} className="text-body font-medium text-primary-500 underline-offset-4 hover:underline">
                Or call {formatNepalPhone(info.supportPhoneE164)}
              </a>
            ) : null}
          </OrderPanel>

          <GoodHandsCard>
            <div className="bg-primary-100 px-2 pb-6">
              <AssuranceTiles items={trackingAssurances(info.returnsWindowDays)} />
            </div>
          </GoodHandsCard>

          {inAccount ? (
            <Link href="/account/orders" className={buttonClasses({ variant: "secondary", fullWidth: true })}>
              Back to Orders
            </Link>
          ) : (
            <Link href="/categories" className={buttonClasses({ variant: "secondary", fullWidth: true })}>
              Continue Shopping
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
