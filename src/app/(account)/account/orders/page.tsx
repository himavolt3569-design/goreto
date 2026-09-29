import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState, AccountPageHeader, AccountPagination } from "@/components/store/account/account-ui";
import { OrderList } from "@/components/store/account/order-list";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { PackageIcon } from "@/components/ui/icons";
import { fetchAccountOrders } from "@/features/account/queries";
import { requireProfile } from "@/lib/auth/profile";
import { pageNumber } from "@/lib/pagination/page";

export const metadata: Metadata = { title: "Orders" };

export default async function AccountOrdersPage({ searchParams }: PageProps<"/account/orders">) {
  const profile = await requireProfile();
  const page = pageNumber((await searchParams).page);
  const orders = await fetchAccountOrders(profile.id, page);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Orders" }]} />
      <AccountPageHeader
        title="Your orders"
        description={orders.total > 0 ? `${orders.total} ${orders.total === 1 ? "order" : "orders"}, newest first.` : undefined}
      />

      {orders.rows.length ? (
        <>
          <OrderList orders={orders.rows} />
          <AccountPagination pathname="/account/orders" page={orders.page} pageCount={orders.pageCount} />
        </>
      ) : orders.total > 0 ? (
        <AccountEmptyState
          icon={PackageIcon}
          title="There's nothing on this page"
          action={
            <Link href="/account/orders" className={buttonClasses({ variant: "secondary" })}>
              Go to the first page
            </Link>
          }
        />
      ) : (
        <AccountEmptyState
          icon={PackageIcon}
          title="You haven't placed an order yet"
          description="Orders you place while signed in appear here. Orders placed as a guest can be followed with their tracking link."
          action={
            <Link href="/categories" className={buttonClasses({ variant: "primary" })}>
              Start shopping
            </Link>
          }
        />
      )}
    </>
  );
}
