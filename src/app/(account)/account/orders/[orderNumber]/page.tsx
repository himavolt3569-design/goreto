import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTrackingView } from "@/components/store/orders/order-tracking-view";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { loadAccountOrder } from "@/features/account/queries";
import { getStorefrontInfo } from "@/features/checkout/store-info";
import { requireProfile } from "@/lib/auth/profile";

export async function generateMetadata({ params }: PageProps<"/account/orders/[orderNumber]">): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order #${orderNumber}` };
}

/** One of the customer's own orders with its stepper and shipment timeline (AGENTS §4.5, §4.9). */
export default async function AccountOrderPage({ params }: PageProps<"/account/orders/[orderNumber]">) {
  await requireProfile();
  const { orderNumber } = await params;
  const [order, info] = await Promise.all([loadAccountOrder(orderNumber), getStorefrontInfo()]);
  if (!order) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Orders", href: "/account/orders" },
          { label: `#${order.orderNumber}` },
        ]}
      />
      <OrderTrackingView order={order} trackingLink={null} info={info} variant="account" />
    </>
  );
}
