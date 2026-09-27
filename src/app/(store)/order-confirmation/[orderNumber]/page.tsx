import type { Metadata } from "next";
import { OrderAccessPage } from "@/components/store/orders/order-access-page";

export const metadata: Metadata = {
  title: "Order Confirmation",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({ params }: PageProps<"/order-confirmation/[orderNumber]">) {
  const { orderNumber } = await params;
  return <OrderAccessPage orderNumber={orderNumber} variant="confirmation" />;
}
