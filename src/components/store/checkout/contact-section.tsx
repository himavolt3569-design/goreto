"use client";

import { useFormContext } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { EnvelopeSimpleIcon, PhoneIcon, UserIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { fieldControlClasses, Input } from "@/components/ui/input";
import type { CheckoutFormValues } from "@/features/checkout/schemas";
import { cn } from "@/lib/utils/cn";
import { NumberedSection } from "./numbered-section";

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

/** Step 1: name, email and Nepal phone. The +977 prefix is fixed, so the code is never typed twice. */
export function ContactSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  return (
    <NumberedSection step={1} title="Contact Information" description="We’ll use this information to keep you updated about your order.">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Full Name" required error={errors.fullName?.message}>
          {(control) => (
            <Input {...control} {...register("fullName")} autoComplete="name" leadingIcon={<UserIcon {...iconProps} />} placeholder="Your full name" />
          )}
        </Field>
        <Field label="Email Address" required error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
              {...register("email")}
              type="email"
              autoComplete="email"
              inputMode="email"
              leadingIcon={<EnvelopeSimpleIcon {...iconProps} />}
              placeholder="you@example.com"
            />
          )}
        </Field>
        <Field label="Phone Number" required error={errors.phone?.message}>
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
    </NumberedSection>
  );
}
