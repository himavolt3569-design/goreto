import type { Metadata } from "next";
import Link from "next/link";
import { AccountEmptyState, AccountPageHeader } from "@/components/store/account/account-ui";
import { AddressCard } from "@/components/store/account/address-card";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { MapPinIcon, PlusIcon } from "@/components/ui/icons";
import { MAX_ADDRESSES } from "@/features/account/address-schema";
import { addressLines, fetchAddresses } from "@/features/account/addresses";
import { getNepalAddressData } from "@/features/delivery/nepal-address-data";
import { requireProfile } from "@/lib/auth/profile";
import { formatNepalPhone } from "@/lib/validation/phone";

export const metadata: Metadata = { title: "Addresses" };

const addLink = (
  <Link href="/account/addresses/new" className={buttonClasses({ variant: "primary", size: "md" })}>
    <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
    Add address
  </Link>
);

/** Saved Nepal addresses (AGENTS §4.9, §11.6). Checkout prefills the default. */
export default async function AccountAddressesPage() {
  const profile = await requireProfile();
  const [addresses, data] = await Promise.all([fetchAddresses(profile.id), getNepalAddressData()]);
  const full = addresses.length >= MAX_ADDRESSES;

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Addresses" }]} />
      <AccountPageHeader
        title="Addresses"
        description="Checkout fills in your default address. You can still change it for any order."
        action={addresses.length > 0 && !full ? addLink : undefined}
      />
      {full ? (
        <p className="rounded-md bg-info-100 p-4 text-body text-neutral-900">
          You&apos;ve saved {MAX_ADDRESSES} addresses, the most we keep. Delete one to add another.
        </p>
      ) : null}
      {addresses.length ? (
        <ul aria-label="Saved addresses" className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id}>
              <AddressCard
                address={{
                  id: address.id,
                  label: address.label,
                  isDefault: address.isDefault,
                  recipientName: address.recipientName,
                  phone: formatNepalPhone(address.phoneE164),
                  lines: addressLines(address, data),
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <AccountEmptyState
          icon={MapPinIcon}
          title="No saved addresses"
          description="Save where you'd like your orders delivered, and checkout fills it in for you."
          action={addLink}
        />
      )}
    </>
  );
}
