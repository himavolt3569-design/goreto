import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { PackageIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireProfile } from "@/lib/auth/profile";
import type { ProfileRole } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<ProfileRole, string> = {
  customer: "Customer",
  staff: "Staff",
  owner: "Store owner",
};

/**
 * Account overview (AGENTS §4.9), first slice: who you are to the store.
 * Orders, wishlist, addresses and billing arrive with their own tasks.
 */
export default async function AccountPage() {
  const profile = await requireProfile();
  const firstName = profile.fullName?.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
        <SectionHeading
          as="h1"
          eyebrow="Your account"
          title={firstName ? `Namaste, ${firstName}` : "Namaste"}
          description="Manage your Goreto account and orders."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col gap-4 p-6">
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
        </Card>

        <Card className="flex flex-col items-start gap-4 p-6">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
            <PackageIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-h2 text-neutral-900">Orders, wishlist and addresses are coming soon</h2>
            <p className="text-body text-neutral-500">
              You&apos;ll be able to track orders, save favourites and keep your delivery addresses here.
            </p>
          </div>
          <Link href="/categories" className={buttonClasses({ variant: "secondary" })}>
            Continue shopping
          </Link>
        </Card>
      </div>
    </div>
  );
}
