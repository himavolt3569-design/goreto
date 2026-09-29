import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState } from "@/components/store/account/account-ui";
import { OrderList } from "@/components/store/account/order-list";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowRightIcon, ClockCounterClockwiseIcon, FileTextIcon, MoneyIcon, PackageIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatCard } from "@/components/ui/stat-card";
import { fetchAccountOrders, fetchAccountSummary } from "@/features/account/queries";
import { requireProfile } from "@/lib/auth/profile";
import type { ProfileRole } from "@/lib/auth/permissions";
import { formatNpr } from "@/lib/money/format";

export const metadata: Metadata = { title: { absolute: "Your account | Goreto.store" } };

const ROLE_LABELS: Record<ProfileRole, string> = {
  customer: "Customer",
  staff: "Staff",
  owner: "Store owner",
};

const RECENT_ORDERS = 3;

/** Account overview (AGENTS §4.9): who you are, your order figures and latest orders. */
export default async function AccountPage() {
  const profile = await requireProfile();
  const [summary, recent] = await Promise.all([fetchAccountSummary(), fetchAccountOrders(profile.id, 1, RECENT_ORDERS)]);
  const firstName = profile.fullName?.split(" ")[0];

  return (
    <>
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
        <SectionHeading
          as="h1"
          eyebrow="Your account"
          title={firstName ? `Namaste, ${firstName}` : "Namaste"}
          description="Your orders, deliveries and billing in one place."
        />
      </div>

      <section aria-label="Order summary" className="grid gap-6 sm:grid-cols-3">
        <StatCard label="Total orders" value={summary.orderCount} icon={FileTextIcon} />
        <StatCard
          label="In progress"
          value={summary.inProgressCount}
          hint="Not yet delivered"
          icon={ClockCounterClockwiseIcon}
          tone="info"
        />
        <StatCard
          label="Billed to date"
          value={formatNpr(summary.billedPaisa)}
          hint={summary.pendingPaisa > 0 ? `${formatNpr(summary.pendingPaisa)} pending on delivery` : "Cash collected on delivery"}
          icon={MoneyIcon}
          tone="success"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="recent-orders-title" className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-orders-title" className="text-h2 text-neutral-900">
              Recent orders
            </h2>
            {recent.total > 0 ? (
              <Link href="/account/orders" className={buttonClasses({ variant: "text", size: "md", className: "h-8" })}>
                View all
                <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
              </Link>
            ) : null}
          </div>
          {recent.rows.length ? (
            <OrderList orders={recent.rows} label="Recent orders" />
          ) : (
            <AccountEmptyState
              icon={PackageIcon}
              title="You haven't placed an order yet"
              description="When you order while signed in, it appears here with its delivery updates."
              action={
                <Link href="/categories" className={buttonClasses({ variant: "primary" })}>
                  Start shopping
                </Link>
              }
            />
          )}
        </section>

        <Card className="flex h-fit flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-h2 text-neutral-900">Profile</h2>
            <Badge tone={profile.role === "customer" ? "neutral" : "new"}>{ROLE_LABELS[profile.role]}</Badge>
          </div>
          <dl className="flex flex-col gap-4 text-body">
            <div className="flex flex-col gap-1">
              <dt className="text-small text-neutral-500">Name</dt>
              <dd className="text-neutral-900">{profile.fullName ?? "Not set"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-small text-neutral-500">Email</dt>
              <dd className="break-all text-neutral-900">{profile.email ?? "No verified email yet"}</dd>
            </div>
          </dl>
          {profile.role !== "customer" ? (
            <Link href="/admin" className={buttonClasses({ variant: "primary", size: "md", className: "w-fit" })}>
              Open admin
            </Link>
          ) : null}
        </Card>
      </div>
    </>
  );
}
