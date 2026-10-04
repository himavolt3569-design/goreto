import "server-only";
import municipalities from "@/data/nepal/municipalities.json";
import { buildAreaIndex, lookupArea, type AreaIndex, type BoundaryTopology } from "./area-lookup";
import type { Position } from "./geo";

/*
 * Map point → full Nepal address area (AGENTS §4.4, §15.5), from the committed
 * boundaries. The 4 MB boundary file is loaded on first use and kept for the
 * life of the server process. No third-party geocoder is called.
 */

export type LocatedArea = {
  provinceCode: string;
  districtCode: string;
  municipalityCode: string;
  /** Null where the ward boundaries don't cover the point: the shopper picks it. */
  ward: number | null;
  postalCode: string | null;
};

export type LocateResult = { ok: true; area: LocatedArea } | { ok: false; reason: "outside_nepal" | "no_match" };

const municipalityByCode = new Map(municipalities.map((item) => [item.code, item]));
let index: Promise<AreaIndex> | null = null;

async function areaIndex(): Promise<AreaIndex> {
  index ??= import("@/data/nepal/boundaries.json").then((module) =>
    buildAreaIndex((module.default ?? module) as unknown as BoundaryTopology),
  );
  return index;
}

async function districtProvince(): Promise<Map<string, string>> {
  const { districts } = (await import("@/data/nepal/divisions.json")).default;
  return new Map(districts.map((district) => [district.code, district.provinceCode]));
}

export function isInNepalBox(latitude: number, longitude: number): boolean {
  return latitude >= 26 && latitude <= 31 && longitude >= 80 && longitude <= 89;
}

export async function locateArea(latitude: number, longitude: number): Promise<LocateResult> {
  if (!isInNepalBox(latitude, longitude)) return { ok: false, reason: "outside_nepal" };
  const point: Position = [longitude, latitude];
  // Inside the box but in no local level: across the border, or in a national
  // park that the local-level boundaries leave out.
  const match = lookupArea(await areaIndex(), point);
  if (!match) return { ok: false, reason: "no_match" };

  const municipality = municipalityByCode.get(match.municipalityCode);
  const provinceCode = municipality && (await districtProvince()).get(municipality.districtCode);
  if (!municipality || !provinceCode) return { ok: false, reason: "no_match" };

  const ward = match.ward !== null && match.ward <= municipality.wardCount ? match.ward : null;
  return {
    ok: true,
    area: {
      provinceCode,
      districtCode: municipality.districtCode,
      municipalityCode: municipality.code,
      ward,
      postalCode: municipality.postalCode,
    },
  };
}
