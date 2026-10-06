import type { Metadata } from "next";
import { UserProfile } from "@clerk/nextjs";
import { AccountPageHeader } from "@/components/store/account/account-ui";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { clerkUserProfileAppearance } from "@/lib/auth/clerk-appearance";
import { requireProfile } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Profile & security" };

/**
 * Profile & security (AGENTS §4.9): Clerk's <UserProfile /> for name, email,
 * phone, password, connected accounts and sessions. The optional catch-all
 * lets its subpages (/account/profile/security) load directly and on refresh.
 */
export default async function AccountProfilePage() {
  await requireProfile();

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Profile & security" }]} />
      <AccountPageHeader title="Profile & security" description="Your name, email, phone, password and signed-in devices." />
      <UserProfile appearance={clerkUserProfileAppearance} />
    </>
  );
}
