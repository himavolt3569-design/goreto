import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { CartView } from "@/components/store/cart/cart-view";
import { getStorefrontInfo } from "@/features/checkout/store-info";

export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false },
};

/** The cart itself lives in the browser; store settings refresh at most once a minute. */
export const revalidate = 60;

export default async function CartPage() {
  const info = await getStorefrontInfo();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 md:px-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-2 text-neutral-900 md:text-display-1">Your Cart</h1>
        <p className="text-body-lg text-neutral-500">Review your pieces before checkout.</p>
      </header>
      <CartView returnsWindowDays={info.returnsWindowDays} />
    </div>
  );
}
