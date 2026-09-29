import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountPageHeader } from "@/components/store/account/account-ui";
import { AddressForm } from "@/components/store/account/address-form";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { EMPTY_ADDRESS, MAX_ADDRESSES } from "@/features/account/address-schema";
import { fetchAddresses } from "@/features/account/addresses";
import { getNepalAddressData } from "@/features/delivery/nepal-address-data";
import { requireProfile } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Add address" };

export default async function NewAddressPage() {
  const profile = await requireProfile();
  const [addresses, data] = await Promise.all([fetchAddresses(profile.id), getNepalAddressData()]);
  if (addresses.length >= MAX_ADDRESSES) redirect("/account/addresses");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Addresses", href: "/account/addresses" },
          { label: "Add address" },
        ]}
      />
      <AccountPageHeader title="Add address" description="Choose your area from the list, then add a street or landmark the courier can find." />
      <AddressForm
        addressId={null}
        defaults={{ ...EMPTY_ADDRESS, recipientName: profile.fullName ?? "" }}
        data={data}
        isOnlyAddress={addresses.length === 0}
      />
    </>
  );
}
