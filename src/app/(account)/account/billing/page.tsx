import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState, AccountPageHeader, AccountPagination } from "@/components/store/account/account-ui";
import { BillingList } from "@/components/store/account/billing-list";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { ClockCounterClockwiseIcon, MoneyIcon, ReceiptIcon } from "@/components/ui/icons";
import { StatCard } from "@/components/ui/stat-card";
import { fetchAccountOrders, fetchAccountSummary } from "@/features/account/queries";
import { requireProfile } from "@/lib/auth/profile";
import { formatNpr } from "@/lib/money/format";
import { pageNumber } from "@/lib/pagination/page";

export const metadata: Metadata = { title: "Billing" };

function ordersLabel(count: number): string {
  return `${count} ${count === 1 ? "order" : "orders"}`;
}

/**
 * Billing (AGENTS §4.9): billed to date = cash collected on delivery; pending
 * COD is shown separately. Both totals come from SQL (account_summary).
 */
export default async function AccountBillingPage({ searchParams }: PageProps<"/account/billing">) {
  const profile = await requireProfile();
  const page = pageNumber((await searchParams).page);
  const [summary, orders] = await Promise.all([fetchAccountSummary(), fetchAccountOrders(profile.id, page)]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Billing" }]} />
      <AccountPageHeader title="Billing" description="Every order is cash on delivery. You're billed only when you pay the courier." />

      <section aria-label="Billing summary" className="grid gap-6 sm:grid-cols-2">
        <StatCard
          label="Billed to date"
          value={formatNpr(summary.billedPaisa)}
          hint={summary.billedOrderCount > 0 ? `Paid on delivery · ${ordersLabel(summary.billedOrderCount)}` : "Nothing billed yet"}
          icon={MoneyIcon}
          tone="success"
        />
        <StatCard
          label="Pending on delivery"
          value={formatNpr(summary.pendingPaisa)}
          hint={
            summary.pendingOrderCount > 0
              ? `To pay the courier · ${ordersLabel(summary.pendingOrderCount)} · not included above`
              : "No payments due"
          }
          icon={ClockCounterClockwiseIcon}
          tone="warning"
        />
      </section>

      <section aria-labelledby="billing-orders-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="billing-orders-title" className="text-h2 text-neutral-900">
            By order
          </h2>
          <p className="text-body text-neutral-500">Canceled and refunded orders are listed but never counted.</p>
        </div>
        {orders.rows.length ? (
          <>
            <BillingList orders={orders.rows} />
            <AccountPagination pathname="/account/billing" page={orders.page} pageCount={orders.pageCount} />
          </>
        ) : orders.total > 0 ? (
          <AccountEmptyState
            icon={ReceiptIcon}
            title="There's nothing on this page"
            action={
              <Link href="/account/billing" className={buttonClasses({ variant: "secondary" })}>
                Go to the first page
              </Link>
            }
          />
        ) : (
          <AccountEmptyState
            icon={ReceiptIcon}
            title="No orders to bill yet"
            description="Once you order while signed in, each order and what you've paid for it appears here."
            action={
              <Link href="/categories" className={buttonClasses({ variant: "secondary" })}>
                Start shopping
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
