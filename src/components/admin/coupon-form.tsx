"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input, fieldControlClasses } from "@/components/ui/input";
import { saveCouponAction } from "@/features/admin/actions/coupons";
import { couponSummary } from "@/features/admin/coupon-label";
import type { CouponFormValues } from "@/features/admin/queries/coupon-editor";
import { parseRupeesToPaisa } from "@/lib/money/parse";
import { cn } from "@/lib/utils/cn";
import { FormSection } from "./product-form/fields";
import { editorGridClasses } from "./admin-ui";
import { CheckboxField, SaveCard, useEditorForm } from "./editor-parts";

/*
 * Add/Edit coupon (admin phase 3). Only the chosen discount type's fields are
 * rendered, so only they are submitted. Once orders used a coupon, its code and
 * type are shown read-only (the database refuses changing them too).
 */

const TYPES = [
  { value: "percentage", label: "Percentage", description: "A share of the order subtotal, optionally capped." },
  { value: "fixed", label: "Fixed amount", description: "A set rupee amount off the subtotal." },
] as const;

function paisaOrNull(value: string): number | null {
  const parsed = parseRupeesToPaisa(value);
  return value.trim() !== "" && parsed.ok ? parsed.paisa : null;
}

export function CouponForm({
  couponId,
  values,
  orderCount,
  timesUsed,
  updatedLabel,
}: {
  couponId: string | null;
  values: CouponFormValues;
  /** Orders that used it: code and type are locked. */
  orderCount: number;
  timesUsed: number;
  updatedLabel: string | null;
}) {
  const { state, errors, pending, onSubmit } = useEditorForm(saveCouponAction);
  const locked = orderCount > 0;
  const [code, setCode] = useState(values.code);
  const [type, setType] = useState(values.type);
  const [percentOff, setPercentOff] = useState(values.percentOff);
  const [maxDiscount, setMaxDiscount] = useState(values.maxDiscount);
  const [amountOff, setAmountOff] = useState(values.amountOff);
  const [minOrder, setMinOrder] = useState(values.minOrder);

  const percent = /^\d{1,3}$/.test(percentOff.trim()) ? Number(percentOff) : null;
  const summary = couponSummary({
    type,
    percentOff: percent,
    maxDiscountPaisa: paisaOrNull(maxDiscount),
    amountOffPaisa: paisaOrNull(amountOff),
    minOrderPaisa: paisaOrNull(minOrder),
  });

  return (
    <form onSubmit={onSubmit} noValidate className={editorGridClasses}>
      {couponId ? <input type="hidden" name="couponId" value={couponId} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="code" title="Code & description" description="Shoppers type the code at checkout. The description tells them what it does.">
          <Field
            label="Coupon code"
            required
            error={errors.code}
            hint={locked ? `Used by ${orderCount === 1 ? "1 order" : `${orderCount} orders`}, so the code can't change.` : "3–32 letters and digits. Shoppers can type it in any case."}
          >
            {(control) => (
              <Input
                {...control}
                name="code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
                readOnly={locked}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. TIHAR15"
                className="font-semibold tracking-wide read-only:bg-neutral-100 read-only:text-neutral-700"
                required
              />
            )}
          </Field>
          <Field label="Description" error={errors.description} hint="Up to 200 characters.">
            {(control) => (
              <textarea
                {...control}
                name="description"
                defaultValue={values.description}
                rows={2}
                maxLength={200}
                placeholder="e.g. Tihar offer: 15% off orders over Rs. 2,000."
                className={cn(fieldControlClasses, "h-auto py-3")}
              />
            )}
          </Field>
        </FormSection>

        <FormSection id="discount" title="Discount" description={<span aria-live="polite">{summary}</span>}>
          {locked ? (
            <>
              <input type="hidden" name="type" value={type} />
              <p className="text-body text-neutral-700">
                Discount type: <span className="font-medium text-neutral-900">{TYPES.find((option) => option.value === type)?.label}</span>. Orders already used
                this coupon, so the type can&apos;t change.
              </p>
            </>
          ) : (
            <fieldset className="flex flex-col gap-2" aria-describedby={errors.type ? "coupon-type-error" : undefined}>
              <legend className="mb-2 text-body font-medium text-neutral-900">Discount type</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {TYPES.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors",
                      type === option.value ? "border-primary-500 bg-primary-100" : "border-neutral-200 hover:border-neutral-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={option.value}
                      checked={type === option.value}
                      onChange={() => setType(option.value)}
                      className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary-500"
                    />
                    <span className="flex flex-col">
                      <span className="text-body font-medium text-neutral-900">{option.label}</span>
                      <span className="text-small text-neutral-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.type ? (
                <p id="coupon-type-error" className="text-small text-error-700">
                  {errors.type}
                </p>
              ) : null}
            </fieldset>
          )}

          {type === "percentage" ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Percent off" required error={errors.percentOff} hint="1–100.">
                {(control) => (
                  <Input {...control} name="percentOff" inputMode="numeric" value={percentOff} onChange={(event) => setPercentOff(event.target.value)} placeholder="e.g. 15" required />
                )}
              </Field>
              <Field label="Maximum discount (Rs.)" error={errors.maxDiscount} hint="Leave empty for no cap.">
                {(control) => (
                  <Input {...control} name="maxDiscount" inputMode="decimal" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value)} placeholder="No cap" />
                )}
              </Field>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Amount off (Rs.)" required error={errors.amountOff}>
                {(control) => (
                  <Input {...control} name="amountOff" inputMode="decimal" value={amountOff} onChange={(event) => setAmountOff(event.target.value)} placeholder="e.g. 200" required />
                )}
              </Field>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Minimum order (Rs.)" error={errors.minOrder} hint="The subtotal before delivery. Leave empty for any order.">
              {(control) => <Input {...control} name="minOrder" inputMode="decimal" value={minOrder} onChange={(event) => setMinOrder(event.target.value)} placeholder="Any order" />}
            </Field>
          </div>
        </FormSection>

        <FormSection id="schedule" title="Schedule" description="Dates and times are in Nepal time (Asia/Kathmandu).">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Starts" required error={errors.startsAt}>
              {(control) => <Input {...control} name="startsAt" type="datetime-local" defaultValue={values.startsAt} required />}
            </Field>
            <Field label="Ends" error={errors.endsAt} hint="Leave empty to keep it running.">
              {(control) => <Input {...control} name="endsAt" type="datetime-local" defaultValue={values.endsAt} />}
            </Field>
          </div>
        </FormSection>

        <FormSection
          id="limits"
          title="Limits"
          description={couponId ? `Used ${timesUsed === 1 ? "1 time" : `${timesUsed.toLocaleString("en-IN")} times`} so far.` : "Leave empty for no limit."}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Total uses" error={errors.usageLimit} hint="Across all customers.">
              {(control) => <Input {...control} name="usageLimit" inputMode="numeric" defaultValue={values.usageLimit} placeholder="No limit" />}
            </Field>
            <Field label="Uses per customer" error={errors.usageLimitPerCustomer} hint="How many times one customer can use it.">
              {(control) => <Input {...control} name="usageLimitPerCustomer" inputMode="numeric" defaultValue={values.usageLimitPerCustomer} placeholder="No limit" />}
            </Field>
          </div>
        </FormSection>
      </div>

      <SaveCard title="Status" submitLabel={couponId ? "Save changes" : "Create coupon"} pending={pending} state={state} updatedLabel={updatedLabel}>
        <CheckboxField name="isActive" defaultChecked={values.isActive} label="Enabled" description="Turned-off coupons can't be used on new orders." />
      </SaveCard>
    </form>
  );
}
