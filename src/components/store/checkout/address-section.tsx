"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { NepalAddressFields } from "@/components/delivery/nepal-address-fields";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon, MapPinIcon, NavigationArrowIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { LocationMap } from "@/components/store/map/location-map";
import { SOFT_SECONDARY } from "@/components/store/product/classes";
import type { CheckoutFormValues } from "@/features/checkout/schemas";
import { lookupPoint, type PointArea } from "@/features/delivery/area-client";
import { findMunicipality, type NepalAddressData } from "@/features/delivery/nepal-address";
import { cn } from "@/lib/utils/cn";
import { NumberedSection } from "./numbered-section";

type LocationState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "detected"; wardFound: boolean }
  | { kind: "suggestion"; suggestion: PointArea }
  | { kind: "error"; message: string };

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

function positionError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is off. That's fine: enter your address below, pick it on the map, or allow location in your browser settings.";
  }
  if (error.code === error.TIMEOUT) return "Finding your location took too long. Please try again or enter your address below.";
  return "Your location isn't available right now. Please enter your address below.";
}

/**
 * Step 2: Nepal address. "Use Current Location" and "Pick on map" are
 * optional help: a point is matched to province, district, municipality and
 * (where our boundary data covers it) ward, and the shopper reviews every
 * field. The street is never guessed. Everything works without location
 * access.
 */
export function AddressSection({ data }: { data: NepalAddressData }) {
  const {
    control,
    setValue,
    getValues,
    formState: { touchedFields },
  } = useFormContext<CheckoutFormValues>();
  const [latitude, longitude] = useWatch({ control, name: ["latitude", "longitude"] });
  const [location, setLocation] = useState<LocationState>({ kind: "idle" });

  const validate = (field: keyof CheckoutFormValues) => ({ shouldValidate: Boolean(touchedFields[field]), shouldDirty: true });

  function applySuggestion(suggestion: PointArea) {
    setValue("provinceCode", suggestion.provinceCode, validate("provinceCode"));
    setValue("districtCode", suggestion.districtCode, validate("districtCode"));
    if (getValues("municipalityCode") !== suggestion.municipalityCode) {
      setValue("municipalityCode", suggestion.municipalityCode, validate("municipalityCode"));
      setValue("ward", "", { shouldDirty: true });
    }
    if (suggestion.ward) setValue("ward", String(suggestion.ward), validate("ward"));
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
        const result = await lookupPoint(lat, lng);
        if (!result.ok) {
          setLocation({ kind: "error", message: result.message });
          return;
        }
        setValue("latitude", lat, { shouldDirty: true });
        setValue("longitude", lng, { shouldDirty: true });
        applySuggestion(result.area);
        setLocation({ kind: "detected", wardFound: result.area.ward !== null });
      },
      (error) => setLocation({ kind: "error", message: positionError(error) }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function onPinMoved(lat: number, lng: number) {
    const previous = { latitude: getValues("latitude"), longitude: getValues("longitude") };
    setValue("latitude", lat, { shouldDirty: true });
    setValue("longitude", lng, { shouldDirty: true });
    const result = await lookupPoint(lat, lng);
    if (!result.ok) {
      // Keep the pin where it last matched a known area; the map follows these values.
      setValue("latitude", previous.latitude, { shouldDirty: true });
      setValue("longitude", previous.longitude, { shouldDirty: true });
      setLocation({ kind: "error", message: result.message });
      return;
    }
    const suggestion = result.area;
    const sameWard = suggestion.ward === null || String(suggestion.ward) === getValues("ward");
    if (suggestion.municipalityCode !== getValues("municipalityCode") || !sameWard) {
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
                {suggestion.ward ? `Ward ${suggestion.ward}, ` : ""}
                {suggestedMunicipality.name}
                {suggestedDistrict ? `, ${suggestedDistrict.name}` : ""}
              </p>
              <button
                type="button"
                onClick={() => {
                  applySuggestion(suggestion);
                  setLocation({ kind: "detected", wardFound: suggestion.ward !== null });
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
            {location.wardFound
              ? "Your location has been detected. Please check the area and ward, then add your street or a landmark."
              : "Your location has been detected. Please check the area, then choose your ward and add your street."}
          </p>
        ) : location.kind === "error" ? (
          <p className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
            {location.message}
          </p>
        ) : null}
      </div>

      <NepalAddressFields
        data={data}
        location={hasPin ? { latitude, longitude } : null}
        onLocationPicked={(lat, lng) => {
          setValue("latitude", lat, { shouldDirty: true });
          setValue("longitude", lng, { shouldDirty: true });
          setLocation({ kind: "idle" });
        }}
      />
    </NumberedSection>
  );
}
