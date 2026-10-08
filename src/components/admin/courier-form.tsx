"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveCourierAction } from "@/features/admin/actions/delivery";
import type { CourierFormValues } from "@/features/admin/queries/delivery-editor";
import { FormSection } from "./product-form/fields";
import { editorGridClasses } from "./admin-ui";
import { CheckboxField, SaveCard, useEditorForm } from "./editor-parts";
import { NameSlugFields } from "./slug-field";

/*
 * Add/Edit courier (admin phase 3). Couriers are manual (staff record each
 * tracking update) unless booked through the Daraz Express API, whose keys
 * are server secrets and never stored here (AGENTS §11.7).
 */

export function CourierForm({
  courierId,
  values,
  savedSlug,
  updatedLabel,
}: {
  courierId: string | null;
  values: CourierFormValues;
  savedSlug: string | null;
  updatedLabel: string | null;
}) {
  const { state, errors, pending, onSubmit } = useEditorForm(saveCourierAction);

  return (
    <form onSubmit={onSubmit} noValidate className={editorGridClasses}>
      {courierId ? <input type="hidden" name="courierId" value={courierId} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="courier" title="Courier" description="The delivery company. Customers see its name with the service they choose.">
          <NameSlugFields
            nameLabel="Courier name"
            namePlaceholder="e.g. Pathao"
            nameMaxLength={80}
            defaultTitle={values.title}
            defaultSlug={values.slug}
            savedSlug={savedSlug}
            errors={errors}
          />
        </FormSection>

        <FormSection id="contact" title="Contact" description="For staff and for customers asking about a delivery.">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Support phone" error={errors.supportPhone} hint="Nepal number, with or without +977.">
              {(control) => <Input {...control} name="supportPhone" type="tel" defaultValue={values.supportPhone} autoComplete="off" placeholder="98XXXXXXXX" />}
            </Field>
            <Field
              label="Dispatch WhatsApp number"
              error={errors.dispatchWhatsapp}
              hint="Accepted orders are sent here with “Send to courier on WhatsApp”. Nepal number, with or without +977."
            >
              {(control) => (
                <Input {...control} name="dispatchWhatsapp" type="tel" defaultValue={values.dispatchWhatsapp} autoComplete="off" placeholder="98XXXXXXXX" />
              )}
            </Field>
            <Field label="Website" error={errors.websiteUrl} hint="Must start with https://">
              {(control) => <Input {...control} name="websiteUrl" type="url" defaultValue={values.websiteUrl} autoComplete="off" placeholder="https://" />}
            </Field>
            <Field
              label="Tracking link for customers"
              error={errors.trackingUrlTemplate}
              hint="Optional. The courier's tracking page with {tracking} where the number goes, e.g. https://example.com/track?no={tracking}"
            >
              {(control) => (
                <Input {...control} name="trackingUrlTemplate" type="url" defaultValue={values.trackingUrlTemplate} autoComplete="off" placeholder="https://…{tracking}" />
              )}
            </Field>
          </div>
        </FormSection>
      </div>

      <SaveCard title="Status" submitLabel={courierId ? "Save changes" : "Create courier"} pending={pending} state={state} updatedLabel={updatedLabel}>
        <CheckboxField
          name="isActive"
          defaultChecked={values.isActive}
          label="Active"
          description="Turning a courier off hides all its services at checkout."
        />
        <CheckboxField
          name="darazApi"
          defaultChecked={values.darazApi}
          label="Booked through the Daraz Express API"
          description="Orders with this courier are booked, labelled and tracked from the Daraz Express panel. Leave off for other couriers: staff record their tracking by hand."
        />
      </SaveCard>
    </form>
  );
}
