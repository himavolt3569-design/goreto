import type { NextRequest } from "next/server";
import { z } from "zod";
import { getPublicSupabase } from "@/lib/supabase/public";

/*
 * Location assistance for checkout (AGENTS §4.4, §15.4): browser coordinates
 * → the nearest municipality in our own Nepal dataset. No third-party
 * geocoder is called. The result is a suggestion the shopper confirms; the
 * ward and street are never guessed.
 */

const query = z.object({
  lat: z.coerce.number().min(26).max(31),
  lng: z.coerce.number().min(80).max(89),
});

export async function GET(request: NextRequest) {
  const parsed = query.safeParse({
    lat: request.nextUrl.searchParams.get("lat"),
    lng: request.nextUrl.searchParams.get("lng"),
  });
  if (!parsed.success) {
    return Response.json({ error: "outside_nepal" }, { status: 422 });
  }

  const { data, error } = await getPublicSupabase().rpc("nearest_municipality", {
    p_latitude: parsed.data.lat,
    p_longitude: parsed.data.lng,
  });
  if (error) {
    console.error("nearest_municipality failed", error.code, error.message);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const match = data?.[0];
  if (!match) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json(
    {
      provinceCode: match.province_code,
      districtCode: match.district_code,
      municipalityCode: match.municipality_code,
      postalCode: match.postal_code,
      distanceKm: match.distance_km,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
