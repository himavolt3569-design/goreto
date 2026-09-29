import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState, AccountPageHeader } from "@/components/store/account/account-ui";
import { TrackingFeed } from "@/components/store/account/tracking-feed";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { TruckIcon } from "@/components/ui/icons";
import { fetchAccountTrackingEvents } from "@/features/account/queries";
import { requireProfile } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Tracking" };

const EVENT_LIMIT = 50;

/** Shipment updates across the customer's orders, newest first (AGENTS §4.9). */
export default async function AccountTrackingPage() {
  await requireProfile();
  const events = await fetchAccountTrackingEvents(EVENT_LIMIT);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Tracking" }]} />
      <AccountPageHeader
        title="Tracking history"
        description={
          events.length === EVENT_LIMIT
            ? `Your latest ${EVENT_LIMIT} delivery updates. Open an order for its full history.`
            : "Delivery updates across your orders, newest first."
        }
      />
      {events.length ? (
        <TrackingFeed events={events} />
      ) : (
        <AccountEmptyState
          icon={TruckIcon}
          title="No delivery updates yet"
          description="Tracking updates appear here once you place an order while signed in."
          action={
            <Link href="/categories" className={buttonClasses({ variant: "secondary" })}>
              Start shopping
            </Link>
          }
        />
      )}
    </>
  );
}
