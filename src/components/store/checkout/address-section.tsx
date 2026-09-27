"use client";

import { useMemo, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { CheckCircleIcon, MapPinIcon, NavigationArrowIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LocationMap } from "@/components/store/map/location-map";
import { SOFT_SECONDARY } from "@/components/store/product/classes";
import type { CheckoutFormValues } from "@/features/checkout/schemas";
import {
  districtsIn,
  findMunicipality,
  municipalitiesIn,
  wardOptions,
  type NepalAddressData,
} from "@/features/delivery/nepal-address";
import { cn } from "@/lib/utils/cn";
import { NumberedSection } from "./numbered-section";

type Suggestion = { provinceCode: string; districtCode: string; municipalityCode: string; postalCode: string | null };

type LocationState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "detected" }
  | { kind: "suggestion"; suggestion: Suggestion }
  | { kind: "error"; message: string };

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

async function suggestArea(latitude: number, longitude: number): Promise<Suggestion | string> {
  try {
    const response = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
    if (response.status === 422) return "That location looks outside Nepal. Please enter your address below.";
    if (!response.ok) return "We couldn't match your location to an area. Please choose it below.";
    return (await response.json()) as Suggestion;
  } catch {
    return "We couldn't look up your location. Please choose your area below.";
  }
}

function positionError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is off. That's fine: enter your address below, or allow location in your browser settings.";
  }
  if (error.code === error.TIMEOUT) return "Finding your location took too long. Please try again or enter your address below.";
  return "Your location isn't available right now. Please enter your address below.";
}

/**
 * Step 2: Nepal address. "Use Current Location" is optional help: the browser
 * gives coordinates, the server suggests the nearest municipality from our
 * own data, and the shopper reviews every field (ward and street are never
 * guessed). Everything works without location access.
 */
export function AddressSection({ data }: { data: NepalAddressData }) {
  const {
    control,
    register,
    setValue,
    getValues,
    formState: { errors, touchedFields },
  } = useFormContext<CheckoutFormValues>();
  const [provinceCode, districtCode, municipalityCode, latitude, longitude] = useWatch({
    control,
    name: ["provinceCode", "districtCode", "municipalityCode", "latitude", "longitude"],
  });
  const [location, setLocation] = useState<LocationState>({ kind: "idle" });

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

  const validate = (field: keyof CheckoutFormValues) => ({ shouldValidate: Boolean(touchedFields[field]), shouldDirty: true });

  function applySuggestion(suggestion: Suggestion) {
    setValue("provinceCode", suggestion.provinceCode, validate("provinceCode"));
    setValue("districtCode", suggestion.districtCode, validate("districtCode"));
    if (getValues("municipalityCode") !== suggestion.municipalityCode) {
      setValue("municipalityCode", suggestion.municipalityCode, validate("municipalityCode"));
      setValue("ward", "", { shouldDirty: true });
    }
    if (suggestion.postalCode) setValue("postalCode", suggestion.postalCode, { shouldDirty: true });
  }

  function locateShopper() {
    if (!("geolocation" in navigator)) {
      setLocation({ kind: "error", message: "This browser can't share your location. Please enter your address below." });
      return;
    }
    setLocation({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const suggestion = await suggestArea(lat, lng);
        if (typeof suggestion === "string") {
          setLocation({ kind: "error", message: suggestion });
          return;
        }
        setValue("latitude", lat, { shouldDirty: true });
        setValue("longitude", lng, { shouldDirty: true });
        applySuggestion(suggestion);
        setLocation({ kind: "detected" });
      },
      (error) => setLocation({ kind: "error", message: positionError(error) }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function onPinMoved(lat: number, lng: number) {
    const previous = { latitude: getValues("latitude"), longitude: getValues("longitude") };
    setValue("latitude", lat, { shouldDirty: true });
    setValue("longitude", lng, { shouldDirty: true });
    const suggestion = await suggestArea(lat, lng);
    if (typeof suggestion === "string") {
      // Keep the pin where it last matched a known area; the map follows these values.
      setValue("latitude", previous.latitude, { shouldDirty: true });
      setValue("longitude", previous.longitude, { shouldDirty: true });
      setLocation({ kind: "error", message: suggestion });
      return;
    }
    if (suggestion.municipalityCode !== getValues("municipalityCode")) {
      setLocation({ kind: "suggestion", suggestion });
    }
  }

  function removePin() {
    setValue("latitude", null, { shouldDirty: true });
    setValue("longitude", null, { shouldDirty: true });
    setLocation({ kind: "idle" });
  }

  const suggestion = location.kind === "suggestion" ? location.suggestion : null;
  const suggestedMunicipality = suggestion ? findMunicipality(data, suggestion.municipalityCode) : undefined;
  const suggestedDistrict = suggestion ? data.districts.find((district) => district.code === suggestion.districtCode) : undefined;
  const hasPin = latitude !== null && longitude !== null && latitude !== undefined && longitude !== undefined;

  return (
    <NumberedSection
      step={2}
      title="Delivery Address"
      description="Detect your current location or enter your address manually."
      action={
        <Button
          variant="secondary"
          size="md"
          onClick={locateShopper}
          loading={location.kind === "locating"}
          className={cn(SOFT_SECONDARY, "self-start")}
          leadingIcon={<MapPinIcon {...iconProps} />}
        >
          {location.kind === "locating" ? "Finding you…" : "Use Current Location"}
        </Button>
      }
    >
      {hasPin ? (
        <div className="relative">
          <LocationMap
            latitude={latitude}
            longitude={longitude}
            label="Your delivery location. Drag to adjust."
            caption="Map showing your delivery location. You can drag the pin to adjust it."
            onMove={onPinMoved}
            className="h-56 sm:h-64"
          />
          {suggestion && suggestedMunicipality ? (
            <div className="absolute left-4 top-4 z-10 flex max-w-72 flex-col gap-1 rounded-md bg-white p-4 shadow-lg">
              <p className="flex items-center gap-2 text-body font-semibold text-neutral-900">
                <NavigationArrowIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
                Pin moved
              </p>
              <p className="text-body text-neutral-700">
                {suggestedMunicipality.name}
                {suggestedDistrict ? `, ${suggestedDistrict.name}` : ""}
              </p>
              <button
                type="button"
                onClick={() => {
                  applySuggestion(suggestion);
                  setLocation({ kind: "detected" });
                }}
                className="self-start rounded-xs text-body font-medium text-primary-500 underline underline-offset-4"
              >
                Use this address
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={removePin}
            className="absolute bottom-3 right-3 z-10 inline-flex h-11 items-center gap-2 rounded-md bg-white px-3 text-body font-medium text-neutral-900 shadow-md hover:bg-neutral-100"
          >
            <XIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            Remove pin
          </button>
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {location.kind === "detected" ? (
          <p className="flex items-start gap-2 rounded-md bg-success-100 px-4 py-3 text-body text-success-700">
            <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
            Your location has been detected. Please review the area, then choose your ward and street.
          </p>
        ) : location.kind === "error" ? (
          <p className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
            {location.message}
          </p>
        ) : null}
      </div>

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
    </NumberedSection>
  );
}
