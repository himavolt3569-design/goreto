"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormSection } from "@/components/admin/product-form/fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { UserIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { searchOrderCustomersAction } from "@/features/admin/actions/manual-orders";
import type { ManualOrderValues } from "@/features/admin/manual-order-forms";
import type { OrderCustomerOption } from "@/features/admin/queries/manual-orders";
import { formatNepalPhone } from "@/lib/validation/phone";
import { LookupSearch } from "./lookup-search";

/**
 * Who the WhatsApp order is for. Linking an existing account (customers.read
 * only) puts the order in their account history; otherwise the order has
 * contact details only. Phones are Nepal numbers, typed with or without +977.
 */
export function CustomerSection({ canLinkCustomer }: { canLinkCustomer: boolean }) {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<ManualOrderValues>();
  const sameAsPhone = useWatch({ control, name: "whatsappSameAsPhone" });
  const [linked, setLinked] = useState<OrderCustomerOption | null>(null);

  function link(customer: OrderCustomerOption | null) {
    setLinked(customer);
    setValue("customerId", customer?.id ?? "", { shouldDirty: true });
    if (!customer) return;
    // Prefill only what the account knows; staff can still edit each field.
    setValue("fullName", customer.name, { shouldDirty: true, shouldValidate: true });
    if (customer.phone) setValue("phone", customer.phone, { shouldDirty: true, shouldValidate: true });
    if (customer.email) setValue("email", customer.email, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <FormSection id="customer" title="Customer" description="The person who ordered on WhatsApp. They pay cash on delivery.">
      {canLinkCustomer ? (
        linked ? (
          <div className="flex items-center gap-3 rounded-md border border-neutral-200 px-4 py-2">
            <UserIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium text-neutral-900">Linked to {linked.name}</span>
              <span className="truncate text-small text-neutral-500">{[linked.email, linked.phone ? formatNepalPhone(linked.phone) : null].filter(Boolean).join(" · ")}</span>
            </span>
            <Button variant="tertiary" size="md" onClick={() => link(null)}>
              Unlink <span className="sr-only">customer account</span>
            </Button>
          </div>
        ) : (
          <LookupSearch
            label="Existing customer (optional)"
            hint="Link a customer account so the order shows in their account. Search by name, email or phone."
            placeholder="Search customers"
            noun="customers"
            search={searchOrderCustomersAction}
            resultKey={(customer) => customer.id}
            chooseLabel={(customer) => customer.name}
            onChoose={link}
            renderResult={(customer) => (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-medium text-neutral-900">{customer.name}</span>
                <span className="truncate text-small text-neutral-500">
                  {[customer.email, customer.phone ? formatNepalPhone(customer.phone) : null].filter(Boolean).join(" · ")}
                </span>
              </span>
            )}
          />
        )
      ) : null}
      {errors.customerId?.message ? <p className="text-small text-error-700">{errors.customerId.message}</p> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Full name" required error={errors.fullName?.message}>
          {(control) => <Input {...control} {...register("fullName")} autoComplete="off" maxLength={100} />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message} hint="For the courier to call. With or without +977.">
          {(control) => <Input {...control} {...register("phone")} type="tel" autoComplete="off" placeholder="98XXXXXXXX" />}
        </Field>
      </div>

      <label className="flex items-start gap-3">
        <input type="checkbox" {...register("whatsappSameAsPhone")} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500" />
        <span className="flex flex-col">
          <span className="text-body font-medium text-neutral-900">WhatsApp is the same number</span>
          <span className="text-small text-neutral-500">Untick if they messaged from a different number.</span>
        </span>
      </label>

      <div className="grid gap-6 md:grid-cols-2">
        {sameAsPhone ? null : (
          <Field label="WhatsApp number" required error={errors.whatsapp?.message}>
            {(control) => <Input {...control} {...register("whatsapp")} type="tel" autoComplete="off" placeholder="98XXXXXXXX" />}
          </Field>
        )}
        <Field label="Email" error={errors.email?.message} hint="Optional.">
          {(control) => <Input {...control} {...register("email")} type="email" autoComplete="off" />}
        </Field>
      </div>
    </FormSection>
  );
}
