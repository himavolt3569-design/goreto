import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { ManualOrderForm } from "@/components/admin/manual-order/manual-order-form";
import { requireAdminAccess } from "@/features/admin/auth";
import { canAccess } from "@/features/admin/nav";
import { fetchStoreSettings } from "@/features/admin/queries/system";
import { getNepalAddressData } from "@/features/delivery/nepal-address-data";

export const metadata: Metadata = { title: "New WhatsApp order" };

/** Manual entry of an order received on WhatsApp (worklog §4.0): orders.write only. */
export default async function NewWhatsappOrderPage() {
  const profile = await requireAdminAccess("orders.write");
  const [address, settings] = await Promise.all([getNepalAddressData(), fetchStoreSettings()]);

  return (
    <>
      <BackLink href="/admin/orders">Orders</BackLink>
      <PageHeader
        title="New WhatsApp order"
        description="Enter an order a customer sent on WhatsApp. Prices, delivery fee and total come from the store; payment is Cash on Delivery."
      />
      <ManualOrderForm
        address={address}
        canLinkCustomer={canAccess(profile, "customers.read")}
        autoAccept={settings?.auto_accept_whatsapp_orders ?? false}
        codEnabled={settings?.cod_enabled ?? false}
      />
    </>
  );
}
