import type { Metadata } from "next";
import { OrderAccessPage } from "@/components/store/orders/order-access-page";

export const metadata: Metadata = {
  title: "Track Your Order",
  robots: { index: false, follow: false },
};

export default async function TrackOrderPage({ params }: PageProps<"/track/[orderNumber]">) {
  const { orderNumber } = await params;
  return <OrderAccessPage orderNumber={orderNumber} variant="tracking" />;
}
