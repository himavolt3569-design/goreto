import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState, AccountPageHeader } from "@/components/store/account/account-ui";
import { WishlistGrid } from "@/components/store/account/wishlist-grid";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { HeartIcon } from "@/components/ui/icons";
import { fetchWishlist } from "@/features/wishlist/queries";
import { requireProfile } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Wishlist" };

function savedLabel(count: number): string {
  return `${count} saved ${count === 1 ? "product" : "products"}`;
}

/** Wishlist (AGENTS §4.9): saved products with today's price and stock. */
export default async function AccountWishlistPage() {
  const profile = await requireProfile();
  const entries = await fetchWishlist(profile.id);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Wishlist" }]} />
      <AccountPageHeader
        title="Wishlist"
        description={entries.length ? `${savedLabel(entries.length)}. Prices and stock are live.` : "Products you save appear here."}
      />
      {entries.length ? (
        <WishlistGrid entries={entries} />
      ) : (
        <AccountEmptyState
          icon={HeartIcon}
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here for later."
          action={
            <Link href="/search" className={buttonClasses({ variant: "primary", size: "md" })}>
              Browse products
            </Link>
          }
        />
      )}
    </>
  );
}
