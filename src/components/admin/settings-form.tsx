"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { WarningCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  autoAcceptWebsiteOrders: boolean;
  autoAcceptWhatsappOrders: boolean;
  courierAssignmentMode: "auto" | "manual";
  defaultCourierId: string;
};

const checkboxClasses = "mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500";

const COURIER_MODES = [
  {
    value: "auto",
    label: "Pick the courier automatically",
    description: "Accept is one click: the courier of the customer’s delivery service, or the default courier below.",
  },
  {
    value: "manual",
    label: "Staff choose the courier",
    description: "The Accept dialog always asks which courier gets the order.",
  },
] as const;

/**
 * Store settings, grouped by responsibility (AGENTS §4.8). Values are
 * validated again on the server; secrets never appear here.
 */
export function SettingsForm({
  values,
  currency,
  timezone,
  phoneCountryCode,
  couriers,
}: {
  values: SettingsFormValues;
  currency: string;
  timezone: string;
  phoneCountryCode: string;
  /** Active couriers, for the default courier. */
  couriers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateStoreSettingsAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const [autoAccept, setAutoAccept] = useState({ website: values.autoAcceptWebsiteOrders, whatsapp: values.autoAcceptWhatsappOrders });
  const [defaultCourierId, setDefaultCourierId] = useState(values.defaultCourierId);
  const courierOptions = [{ value: "", label: "No default courier" }, ...couriers.map((courier) => ({ value: courier.id, label: courier.name }))];

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

      <Card id="acceptance" className="flex scroll-mt-24 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Order acceptance & couriers</h2>
          <p className="text-body text-neutral-500">
            New orders wait in Pending until someone accepts them. Only accepted orders can be sent to a courier.
          </p>
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-h3 text-neutral-900">Auto-accept new orders</legend>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="autoAcceptWebsiteOrders"
              defaultChecked={values.autoAcceptWebsiteOrders}
              onChange={(event) => setAutoAccept((current) => ({ ...current, website: event.target.checked }))}
              className={checkboxClasses}
            />
            <span className="flex flex-col">
              <span className="text-body font-medium text-neutral-900">Website orders</span>
              <span className="text-small text-neutral-500">Storefront checkouts are accepted the moment they&rsquo;re placed.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="autoAcceptWhatsappOrders"
              defaultChecked={values.autoAcceptWhatsappOrders}
              onChange={(event) => setAutoAccept((current) => ({ ...current, whatsapp: event.target.checked }))}
              className={checkboxClasses}
            />
            <span className="flex flex-col">
              <span className="text-body font-medium text-neutral-900">WhatsApp orders</span>
              <span className="text-small text-neutral-500">Orders staff enter from WhatsApp are accepted as soon as they&rsquo;re saved.</span>
            </span>
          </label>
          <p className="rounded-md bg-neutral-50 px-4 py-3 text-small text-neutral-700">
            Auto-accepted orders get their courier automatically: the courier of the customer&rsquo;s delivery service, or the default courier.
            You still tap <span className="font-medium">Send to courier on WhatsApp</span> on the order to pass it on. The bell reminds you
            until it&rsquo;s sent.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-h3 text-neutral-900">When someone accepts an order</legend>
          {COURIER_MODES.map((mode) => (
            <label key={mode.value} className="flex items-start gap-3">
              <input
                type="radio"
                name="courierAssignmentMode"
                value={mode.value}
                defaultChecked={values.courierAssignmentMode === mode.value}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary-500"
              />
              <span className="flex flex-col">
                <span className="text-body font-medium text-neutral-900">{mode.label}</span>
                <span className="text-small text-neutral-500">{mode.description}</span>
              </span>
            </label>
          ))}
          {errors.courierAssignmentMode ? <p className="text-small text-error-700">{errors.courierAssignmentMode}</p> : null}
        </fieldset>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Default courier" error={errors.defaultCourierId} hint="Used when the customer’s delivery service has no active courier.">
            {(control) => <Select {...control} name="defaultCourierId" value={defaultCourierId} onValueChange={setDefaultCourierId} options={courierOptions} />}
          </Field>
        </div>
        {(autoAccept.website || autoAccept.whatsapp) && !defaultCourierId ? (
          <p role="status" className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
            No default courier: an order whose delivery service has no active courier will wait for a person.
          </p>
        ) : null}
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
