import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AccountPageHeader } from "@/components/store/account/account-ui";
import { AddressForm } from "@/components/store/account/address-form";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { fetchAddresses, toAddressFormValues } from "@/features/account/addresses";
import { getNepalAddressData } from "@/features/delivery/nepal-address-data";
import { requireProfile } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Edit address" };

/** Edit one of the caller's own addresses; any other id is a 404. */
export default async function EditAddressPage({ params }: PageProps<"/account/addresses/[id]/edit">) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [addresses, data] = await Promise.all([fetchAddresses(profile.id), getNepalAddressData()]);
  const address = addresses.find((candidate) => candidate.id === id);
  if (!address) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Addresses", href: "/account/addresses" },
          { label: `Edit ${address.label}` },
        ]}
      />
      <AccountPageHeader
        title="Edit address"
        description="Changes apply to future orders. Orders already placed keep the address they were sent to."
      />
      <AddressForm addressId={address.id} defaults={toAddressFormValues(address)} data={data} isOnlyAddress={addresses.length === 1} />
    </>
  );
}
