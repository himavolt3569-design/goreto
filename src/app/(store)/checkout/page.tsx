import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { CheckoutView } from "@/components/store/checkout/checkout-view";
import { getCheckoutDefaults } from "@/features/checkout/prefill";
import { getStorefrontInfo } from "@/features/checkout/store-info";
import { getNepalAddressData } from "@/features/delivery/nepal-address-data";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const [address, info, defaults] = await Promise.all([getNepalAddressData(), getStorefrontInfo(), getCheckoutDefaults()]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 md:px-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-2 text-neutral-900 md:text-display-1">Checkout</h1>
        <p className="text-body-lg text-neutral-500">Almost there! Complete your order and get ready to shine.</p>
      </header>
      <CheckoutView
        address={address}
        defaults={defaults}
        codEnabled={info.codEnabled}
        returnsWindowDays={info.returnsWindowDays}
      />
    </div>
  );
}
