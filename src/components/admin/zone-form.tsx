"use client";

import { Field } from "@/components/ui/field";
import { Input, fieldControlClasses } from "@/components/ui/input";
import { saveZoneAction } from "@/features/admin/actions/delivery";
import type { ProvinceDistricts, ZoneFormValues } from "@/features/admin/queries/delivery-editor";
import { cn } from "@/lib/utils/cn";
import { DistrictPicker } from "./district-picker";
import { FormSection } from "./product-form/fields";
import { editorGridClasses } from "./admin-ui";
import { CheckboxField, SaveCard, useEditorForm } from "./editor-parts";
import { NameSlugFields } from "./slug-field";

/* Add/Edit delivery zone (admin phase 3): a named group of districts that share rates. */

export function ZoneForm({
  zoneId,
  values,
  groups,
  savedSlug,
  updatedLabel,
}: {
  zoneId: string | null;
  values: ZoneFormValues;
  groups: ProvinceDistricts[];
  savedSlug: string | null;
  updatedLabel: string | null;
}) {
  const { state, errors, pending, onSubmit } = useEditorForm(saveZoneAction);

  return (
    <form onSubmit={onSubmit} noValidate className={editorGridClasses}>
      {zoneId ? <input type="hidden" name="zoneId" value={zoneId} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="zone" title="Zone" description="Staff see the name. Checkout uses the zone to pick the rates for an address.">
          <NameSlugFields
            nameLabel="Zone name"
            namePlaceholder="e.g. Kathmandu Valley"
            nameMaxLength={80}
            defaultTitle={values.title}
            defaultSlug={values.slug}
            savedSlug={savedSlug}
            errors={errors}
          />
          <Field label="Description" error={errors.description} hint="Up to 200 characters.">
            {(control) => (
              <textarea {...control} name="description" defaultValue={values.description} rows={2} maxLength={200} className={cn(fieldControlClasses, "h-auto py-3")} />
            )}
          </Field>
        </FormSection>

        <FormSection id="districts" title="Districts" description="Each district belongs to one zone. To move a district, remove it from its zone first.">
          <DistrictPicker groups={groups} zoneId={zoneId} defaultSelected={values.districtCodes} error={errors.districtCodes} />
        </FormSection>
      </div>

      <SaveCard title="Status" submitLabel={zoneId ? "Save changes" : "Create zone"} pending={pending} state={state} updatedLabel={updatedLabel}>
        <CheckboxField name="isActive" defaultChecked={values.isActive} label="Active" description="Inactive zones offer no delivery at checkout." />
        <Field label="Sort order" error={errors.sortOrder} hint="Lower numbers come first in the admin.">
          {(control) => <Input {...control} name="sortOrder" type="number" min={0} max={9999} step={1} defaultValue={values.sortOrder} required />}
        </Field>
      </SaveCard>
    </form>
  );
}
