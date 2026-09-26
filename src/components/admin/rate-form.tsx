"use client";

import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { saveRateAction } from "@/features/admin/actions/delivery";
import type { RateFormValues, RateOptions } from "@/features/admin/queries/delivery-editor";
import { FormSection } from "./product-form/fields";
import { editorGridClasses } from "./admin-ui";
import { CheckboxField, SaveCard, useEditorForm } from "./editor-parts";

/*
 * Add/Edit delivery rate (admin phase 3): the fee for one service in one
 * zone. A zone has at most one rate per service; choosing a pair that
 * already has one links to it.
 */

export function RateForm({
  rateId,
  values,
  options,
  updatedLabel,
}: {
  rateId: string | null;
  values: RateFormValues;
  options: RateOptions;
  updatedLabel: string | null;
}) {
  const { state, errors, pending, onSubmit } = useEditorForm(saveRateAction);
  const [zoneId, setZoneId] = useState(values.zoneId);
  const [serviceId, setServiceId] = useState(values.serviceId);

  const zoneOptions: SelectOption[] = options.zones.map((zone) => ({ value: zone.id, label: zone.isActive ? zone.name : `${zone.name} (inactive)` }));
  const serviceOptions: SelectOption[] = options.services.map((service) => ({
    value: service.id,
    label: `${service.name} · ${service.code}${service.isActive ? "" : " (off)"}`,
    context: service.courierName,
  }));
  const service = options.services.find((option) => option.id === serviceId);
  const existing = zoneId && serviceId ? options.existing[`${zoneId}:${serviceId}`] : undefined;
  const duplicate = existing !== undefined && existing !== rateId ? existing : null;

  return (
    <form onSubmit={onSubmit} noValidate className={editorGridClasses}>
      {rateId ? <input type="hidden" name="rateId" value={rateId} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="rate" title="Zone and service" description="Checkout offers this service to addresses in the zone, at this fee.">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Zone" required error={errors.zoneId} className="min-w-0">
              {(control) => <Select {...control} name="zoneId" options={zoneOptions} value={zoneId} onValueChange={setZoneId} placeholder="Choose a zone" required />}
            </Field>
            <Field
              label="Service"
              className="min-w-0"
              required
              error={errors.serviceId}
              hint={
                duplicate ? (
                  <span className="text-warning-700">
                    This zone already has a rate for that service.{" "}
                    <Link href={`/admin/delivery/rates/${duplicate}/edit`} className="font-medium underline">
                      Edit that rate
                    </Link>
                  </span>
                ) : undefined
              }
            >
              {(control) => (
                <Select {...control} name="serviceId" options={serviceOptions} value={serviceId} onValueChange={setServiceId} placeholder="Choose a service" required />
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection id="fee" title="Fee and estimate">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Delivery fee (Rs.)" required error={errors.price} hint="0 means free delivery.">
              {(control) => <Input {...control} name="price" inputMode="decimal" defaultValue={values.price} placeholder="e.g. 150" required />}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min. days" error={errors.minDays}>
                {(control) => (
                  <Input {...control} name="minDays" inputMode="numeric" defaultValue={values.minDays} placeholder={service ? String(service.minDays) : "Default"} />
                )}
              </Field>
              <Field label="Max. days" error={errors.maxDays}>
                {(control) => (
                  <Input {...control} name="maxDays" inputMode="numeric" defaultValue={values.maxDays} placeholder={service ? String(service.maxDays) : "Default"} />
                )}
              </Field>
            </div>
          </div>
          <p className="text-small text-neutral-500">
            {service
              ? `Leave the days empty to use the service's estimate (${service.minDays}–${service.maxDays} days).`
              : "Leave the days empty to use the service's estimate."}
          </p>
        </FormSection>

        <FormSection id="conditions" title="Conditions" description="Optional. Leave empty to offer the rate on every order.">
          <div className="grid gap-6 md:grid-cols-3">
            <Field label="Minimum order (Rs.)" error={errors.minOrder} hint="Subtotal before delivery.">
              {(control) => <Input {...control} name="minOrder" inputMode="decimal" defaultValue={values.minOrder} placeholder="Any order" />}
            </Field>
            <Field label="Min. weight (g)" error={errors.minWeight}>
              {(control) => <Input {...control} name="minWeight" inputMode="numeric" defaultValue={values.minWeight} placeholder="Any" />}
            </Field>
            <Field label="Max. weight (g)" error={errors.maxWeight}>
              {(control) => <Input {...control} name="maxWeight" inputMode="numeric" defaultValue={values.maxWeight} placeholder="Any" />}
            </Field>
          </div>
        </FormSection>
      </div>

      <SaveCard title="Status" submitLabel={rateId ? "Save changes" : "Create rate"} pending={pending} state={state} updatedLabel={updatedLabel}>
        <CheckboxField name="isActive" defaultChecked={values.isActive} label="Active" description="Inactive rates aren't offered at checkout." />
      </SaveCard>
    </form>
  );
}
