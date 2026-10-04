import type { NextRequest } from "next/server";
import { z } from "zod";
import { locateArea } from "@/features/delivery/locate";

/*
 * Location assistance for address forms (AGENTS §4.4, §15.4): a map or GPS
 * point → province, district, municipality and (where the ward boundaries
 * cover it) ward, from our own boundary data. No third-party geocoder is
 * called. The result is a suggestion the shopper reviews; the street is never
 * guessed.
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

  const result = await locateArea(parsed.data.lat, parsed.data.lng);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: result.reason === "outside_nepal" ? 422 : 404 });
  }
  return Response.json(result.area, { headers: { "Cache-Control": "no-store" } });
}
