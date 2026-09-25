"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateStoreSettingsAction } from "@/features/admin/actions/system";
import { ActionMessage } from "./action-forms";

export type SettingsFormValues = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  codEnabled: boolean;
  codMaxOrderRupees: string;
  returnsWindowDays: number;
  lowStockThreshold: number;
};

/**
 * Store settings, grouped by responsibility (AGENTS §4.8). Values are
 * validated again on the server; secrets never appear here.
 */
export function SettingsForm({ values, currency, timezone, phoneCountryCode }: { values: SettingsFormValues; currency: string; timezone: string; phoneCountryCode: string }) {
  const [state, formAction, pending] = useActionState(updateStoreSettingsAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  // Submitted by hand so React doesn't reset the fields when validation fails.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Store profile & contact</h2>
          <p className="text-body text-neutral-500">Shown to customers on order emails and the help pages.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Store name" required error={errors.storeName}>
            {(control) => <Input {...control} name="storeName" defaultValue={values.storeName} maxLength={80} required />}
          </Field>
          <Field label="Tagline" error={errors.tagline}>
            {(control) => <Input {...control} name="tagline" defaultValue={values.tagline} maxLength={140} />}
          </Field>
          <Field label="Support email" error={errors.supportEmail} hint="Leave empty to hide it.">
            {(control) => <Input {...control} name="supportEmail" type="email" defaultValue={values.supportEmail} autoComplete="off" />}
          </Field>
          <Field label="Support phone" error={errors.supportPhone} hint={`Nepal number, with or without ${phoneCountryCode}.`}>
            {(control) => <Input {...control} name="supportPhone" type="tel" defaultValue={values.supportPhone} autoComplete="off" />}
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Nepal store defaults</h2>
          <p className="text-body text-neutral-500">Fixed for Goreto. Money is stored in paisa and times in UTC.</p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-md bg-neutral-50 p-4">
            <dt className="text-small text-neutral-500">Currency</dt>
            <dd className="text-body font-medium text-neutral-900">{currency} (Rs.)</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-md bg-neutral-50 p-4">
            <dt className="text-small text-neutral-500">Time zone</dt>
            <dd className="text-body font-medium text-neutral-900">{timezone}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-md bg-neutral-50 p-4">
            <dt className="text-small text-neutral-500">Phone country code</dt>
            <dd className="text-body font-medium text-neutral-900">{phoneCountryCode}</dd>
          </div>
        </dl>
      </Card>

      <Card id="checkout" className="flex scroll-mt-24 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Checkout & Cash on Delivery</h2>
          <p className="text-body text-neutral-500">Goreto takes Cash on Delivery only. There are no online payment gateways.</p>
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="codEnabled"
            defaultChecked={values.codEnabled}
            className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500"
          />
          <span className="flex flex-col">
            <span className="text-body font-medium text-neutral-900">Accept Cash on Delivery orders</span>
            <span className="text-small text-neutral-500">Turn off to pause new orders without hiding the catalog.</span>
          </span>
        </label>
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="COD order limit (Rs.)" error={errors.codMaxOrder} hint="Leave empty for no limit.">
            {(control) => <Input {...control} name="codMaxOrder" inputMode="numeric" defaultValue={values.codMaxOrderRupees} placeholder="No limit" />}
          </Field>
          <Field label="Returns window (days)" required error={errors.returnsWindowDays}>
            {(control) => <Input {...control} name="returnsWindowDays" type="number" min={0} max={90} step={1} defaultValue={values.returnsWindowDays} required />}
          </Field>
          <Field label="Default low-stock alert" required error={errors.lowStockThreshold} hint="Used for new products.">
            {(control) => <Input {...control} name="lowStockThreshold" type="number" min={0} max={10000} step={1} defaultValue={values.lowStockThreshold} required />}
          </Field>
        </div>
      </Card>

      <div className="flex flex-col items-end gap-2">
        <Button type="submit" size="lg" loading={pending}>
          Save settings
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
