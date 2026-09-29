/*
 * Browser side of the address area lookup: asks /api/geocode/reverse which
 * province, district, municipality and ward a point is in, and turns every
 * failure into a message the shopper can act on.
 */

export type PointArea = {
  provinceCode: string;
  districtCode: string;
  municipalityCode: string;
  /** Null where no ward boundary covers the point. */
  ward: number | null;
  postalCode: string | null;
};

export type PointLookup = { ok: true; area: PointArea } | { ok: false; message: string };

export async function lookupPoint(latitude: number, longitude: number, signal?: AbortSignal): Promise<PointLookup> {
  try {
    const response = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, { signal });
    if (response.status === 422) return { ok: false, message: "That spot is outside Nepal. Pick a spot in Nepal or enter your address." };
    if (!response.ok) {
      return { ok: false, message: "We couldn't match that spot to a municipality (national parks aren't part of one). Try a spot nearby or choose your area." };
    }
    return { ok: true, area: (await response.json()) as PointArea };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, message: "We couldn't look up that spot. Check your connection and try again." };
  }
}

/** A friendly reason for a failed browser location request. */
export function positionErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is off. That's fine: tap the map instead, or allow location in your browser settings.";
  }
  if (error.code === error.TIMEOUT) return "Finding your location took too long. Try again, or tap the map instead.";
  return "Your location isn't available right now. Tap the map instead.";
}
