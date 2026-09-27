"use client";

import { useMemo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { MapPinIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { districtsIn, findMunicipality, municipalitiesIn, wardOptions, type NepalAddressData } from "@/features/delivery/nepal-address";

/** The address fields a form using NepalAddressFields must have (all strings, as typed). */
export type NepalAddressFieldValues = {
  provinceCode: string;
  districtCode: string;
  municipalityCode: string;
  ward: string;
  streetLandmark: string;
  postalCode: string;
};

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

/**
 * Nepal address fields (AGENTS §4.4, §15.5): Province → District →
 * Municipality → Ward from the canonical dataset, then street/landmark and
 * postal code. Changing a parent clears its children. Used by the storefront
 * checkout and the admin WhatsApp order form, inside a react-hook-form
 * FormProvider whose values include NepalAddressFieldValues.
 */
export function NepalAddressFields({ data }: { data: NepalAddressData }) {
  const {
    control,
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<NepalAddressFieldValues>();
  const [provinceCode, districtCode, municipalityCode] = useWatch({ control, name: ["provinceCode", "districtCode", "municipalityCode"] });

  const provinceOptions = useMemo(() => data.provinces.map((province) => ({ value: province.code, label: province.name })), [data]);
  const districtOptions = useMemo(
    () => districtsIn(data, provinceCode).map((district) => ({ value: district.code, label: district.name })),
    [data, provinceCode],
  );
  const municipalityOptions = useMemo(
    () => municipalitiesIn(data, districtCode).map((municipality) => ({ value: municipality.code, label: municipality.name })),
    [data, districtCode],
  );
  const municipality = findMunicipality(data, municipalityCode);
  const wards = useMemo(() => wardOptions(municipality?.wardCount ?? 0), [municipality]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Province" required error={errors.provinceCode?.message}>
          {(wiring) => (
            <Controller
              control={control}
              name="provinceCode"
              render={({ field }) => (
                <Select
                  {...wiring}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={(value) => {
                    if (value === field.value) return;
                    field.onChange(value);
                    setValue("districtCode", "", { shouldDirty: true });
                    setValue("municipalityCode", "", { shouldDirty: true });
                    setValue("ward", "", { shouldDirty: true });
                  }}
                  options={provinceOptions}
                  placeholder="Choose a province"
                />
              )}
            />
          )}
        </Field>
        <Field label="District / Region" required error={errors.districtCode?.message}>
          {(wiring) => (
            <Controller
              control={control}
              name="districtCode"
              render={({ field }) => (
                <Select
                  {...wiring}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  disabled={!provinceCode}
                  onValueChange={(value) => {
                    if (value === field.value) return;
                    field.onChange(value);
                    setValue("municipalityCode", "", { shouldDirty: true });
                    setValue("ward", "", { shouldDirty: true });
                  }}
                  options={districtOptions}
                  placeholder={provinceCode ? "Choose a district" : "Choose a province first"}
                />
              )}
            />
          )}
        </Field>
        <Field
          label="Municipality / City"
          required
          error={errors.municipalityCode?.message}
          hint={districtCode && municipalityOptions.length === 0 ? "We don't have municipalities for this district yet." : undefined}
        >
          {(wiring) => (
            <Controller
              control={control}
              name="municipalityCode"
              render={({ field }) => (
                <Select
                  {...wiring}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  disabled={!districtCode || municipalityOptions.length === 0}
                  onValueChange={(value) => {
                    if (value === field.value) return;
                    field.onChange(value);
                    setValue("ward", "", { shouldDirty: true });
                    const next = findMunicipality(data, value);
                    if (next?.postalCode && !getValues("postalCode")) setValue("postalCode", next.postalCode, { shouldDirty: true });
                  }}
                  options={municipalityOptions}
                  placeholder={districtCode ? "Choose a municipality" : "Choose a district first"}
                />
              )}
            />
          )}
        </Field>
        <Field label="Ward No." required error={errors.ward?.message}>
          {(wiring) => (
            <Controller
              control={control}
              name="ward"
              render={({ field }) => (
                <Select
                  {...wiring}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  disabled={!municipality}
                  onValueChange={field.onChange}
                  options={wards}
                  placeholder={municipality ? "Choose a ward" : "Choose a municipality first"}
                />
              )}
            />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Street / Landmark" required error={errors.streetLandmark?.message}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register("streetLandmark")}
              autoComplete="address-line1"
              leadingIcon={<MapPinIcon {...iconProps} />}
              placeholder="e.g. Thamel, near Garden of Dreams"
            />
          )}
        </Field>
        <Field label="Postal Code" error={errors.postalCode?.message}>
          {(wiring) => <Input {...wiring} {...register("postalCode")} inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="44600" />}
        </Field>
      </div>
    </>
  );
}
