"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NepalAddressFields } from "@/components/delivery/nepal-address-fields";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { PhoneIcon, TagIcon, UserIcon, WarningCircleIcon } from "@/components/ui/icons";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { saveAddressAction } from "@/features/account/address-actions";
import { ADDRESS_LABELS, addressFormSchema, type AddressFormData, type AddressFormValues } from "@/features/account/address-schema";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { cn } from "@/lib/utils/cn";

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

/**
 * Add or edit a saved Nepal address (AGENTS §4.9, §11.6). Uses the same
 * Province → District → Municipality → Ward fields as checkout. The server
 * validates again; on success it returns to the address list.
 */
export function AddressForm({
  addressId,
  defaults,
  data,
  isOnlyAddress,
}: {
  /** Null when adding. */
  addressId: string | null;
  defaults: AddressFormValues;
  data: NepalAddressData;
  /** The first (or only) address is always the default, so there is no checkbox. */
  isOnlyAddress: boolean;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<AddressFormValues, unknown, AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: isOnlyAddress ? { ...defaults, makeDefault: true } : defaults,
    mode: "onTouched",
  });
  const {
    register,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const [label, latitude, longitude] = useWatch({ control: form.control, name: ["label", "latitude", "longitude"] });

  async function submit() {
    setSubmitError(null);
    // On success the action redirects to the list, so only failures return.
    const result = await saveAddressAction(addressId, form.getValues()).catch(() => ({
      ok: false as const,
      message: "Your address couldn't be saved. Check your connection and try again.",
      fieldErrors: undefined,
    }));
    if (result.ok) return;
    setSubmitError(result.message);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      form.setError(field as keyof AddressFormValues, { message });
    }
  }

  // Move focus to the summary so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-6 p-6">
          <h2 className="text-h2 text-neutral-900">Recipient</h2>
          <div className="flex flex-col gap-2">
            <Field label="Label" required error={errors.label?.message} hint="A short name so you can tell your addresses apart.">
              {(control) => (
                <Input {...control} {...register("label")} maxLength={40} leadingIcon={<TagIcon {...iconProps} />} placeholder="Home" />
              )}
            </Field>
            <div role="group" aria-label="Quick labels" className="flex flex-wrap gap-2">
              {ADDRESS_LABELS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={label === option}
                  onClick={() => setValue("label", option, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full border px-4 text-body font-medium transition-colors",
                    label === option
                      ? "border-primary-200 bg-primary-100 text-primary-600"
                      : "border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Recipient name" required error={errors.recipientName?.message}>
              {(control) => (
                <Input
                  {...control}
                  {...register("recipientName")}
                  autoComplete="name"
                  leadingIcon={<UserIcon {...iconProps} />}
                  placeholder="Full name of the person receiving"
                />
              )}
            </Field>
            <Field label="Phone number" required error={errors.phone?.message}>
              {(control) => (
                <div className="flex">
                  <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-l-md border border-r-0 border-neutral-200 bg-neutral-50 px-3 text-body text-neutral-700">
                    <PhoneIcon {...iconProps} className="text-neutral-500" />
                    <span aria-hidden="true">+977</span>
                    <span className="sr-only">Nepal country code +977</span>
                  </span>
                  <input
                    {...control}
                    {...register("phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="98XXXXXXXX"
                    className={cn(fieldControlClasses, "min-w-0 rounded-l-none")}
                  />
                </div>
              )}
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-6 p-6">
          <h2 className="text-h2 text-neutral-900">Address</h2>
          <NepalAddressFields
            data={data}
            location={latitude != null && longitude != null ? { latitude, longitude } : null}
            onLocationPicked={(lat, lng) => {
              setValue("latitude", lat, { shouldDirty: true });
              setValue("longitude", lng, { shouldDirty: true });
            }}
          />
          {isOnlyAddress ? (
            <p className="text-small text-neutral-500">This is your only address, so it&apos;s your default. Checkout fills it in for you.</p>
          ) : (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                {...register("makeDefault")}
                className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500"
              />
              <span className="flex flex-col">
                <span className="text-body font-medium text-neutral-900">Use as my default address</span>
                <span className="text-small text-neutral-500">Checkout fills in your default address for you.</span>
              </span>
            </label>
          )}
        </Card>

        {submitError ? (
          <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-3 rounded-md bg-error-100 p-4 text-body text-neutral-900">
            <WarningCircleIcon {...iconProps} className="mt-0.5 shrink-0 text-error-700" />
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/account/addresses" className={buttonClasses({ variant: "tertiary", size: "lg" })}>
            Cancel
          </Link>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {addressId ? "Save changes" : "Save address"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
