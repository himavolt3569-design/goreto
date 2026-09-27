"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { LightningIcon, StorefrontIcon, TruckIcon, WarningCircleIcon, type Icon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { deliveryEstimate, type CheckoutQuote, type ServiceLevel } from "@/features/checkout/quote";
import type { CheckoutFormValues } from "@/features/checkout/schemas";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { NumberedSection } from "./numbered-section";

const levelIcons: Record<ServiceLevel, Icon> = {
  standard: TruckIcon,
  express: LightningIcon,
  pickup: StorefrontIcon,
};

/**
 * Step 3: the delivery services the store's zones and rates offer for the
 * chosen address, with real fees and day ranges (AGENTS §11.7).
 */
export function DeliverySection({ quote, loading, hasAddress }: { quote: CheckoutQuote | null; loading: boolean; hasAddress: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const selected = useWatch({ control, name: "courierServiceId" });
  const options = hasAddress ? (quote?.deliveryOptions ?? []) : [];
  const errorId = "delivery-option-error";

  return (
    <NumberedSection step={3} title="Delivery Option" description="Choose how you’d like to receive your order.">
      {!hasAddress ? (
        <p className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-500">
          Choose your municipality above to see delivery options and fees.
        </p>
      ) : options.length === 0 ? (
        loading || !quote ? (
          <p aria-busy="true" className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-500">
            Finding delivery options for your address…
          </p>
        ) : (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
            We don&rsquo;t deliver to this area yet. Please check the address, or contact us to arrange delivery.
          </p>
        )
      ) : (
        <fieldset aria-describedby={errors.courierServiceId ? errorId : undefined} aria-busy={loading || undefined}>
          <legend className="sr-only">Delivery option</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {options.map((option) => {
              const OptionIcon = levelIcons[option.serviceLevel];
              const checked = selected === option.courierServiceId;
              return (
                <label
                  key={option.courierServiceId}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500/40",
                    checked ? "border-primary-500 bg-primary-100" : "border-neutral-200 bg-white hover:border-primary-300",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      value={option.courierServiceId}
                      {...register("courierServiceId")}
                      className="size-5 shrink-0 accent-primary-500"
                    />
                    <OptionIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
                  </span>
                  <span className="mt-2 text-body-lg font-semibold text-neutral-900">{option.serviceName}</span>
                  <span className="text-body text-neutral-500">
                    {deliveryEstimate(option.estimatedMinDays, option.estimatedMaxDays)}
                  </span>
                  <span className="text-body-lg font-bold text-primary-500">{formatNpr(option.pricePaisa)}</span>
                  <span className="text-small text-neutral-500">
                    {option.description || `By ${option.courierName}`}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.courierServiceId ? (
            <p id={errorId} className="mt-2 text-small text-error-700">
              {errors.courierServiceId.message}
            </p>
          ) : null}
        </fieldset>
      )}
    </NumberedSection>
  );
}
