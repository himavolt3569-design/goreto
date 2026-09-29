/**
 * Builds the canonical Nepal geography (AGENTS §15.5) from open data:
 *
 * - Local levels (753): Open Knowledge Nepal "localboundaries", CC BY 4.0.
 * - Wards (~6,740): OpenStreetMap admin_level=9 boundaries, ODbL.
 * - Ward counts (6,743): Department of Postal Services directory (government).
 *
 * Writes, all committed:
 * - src/data/nepal/divisions.json      provinces + districts
 * - src/data/nepal/municipalities.json every local level with code, type, ward count, centre
 * - src/data/nepal/boundaries.json     simplified TopoJSON for the map lookup
 * - src/data/nepal/README.md           sources, licences and counts
 * - supabase/migrations/<NEPAL_MIGRATION> the reference-data upsert
 *
 * Run by hand: `node scripts/geo/build-nepal.ts` (add `--refresh` to download
 * again). Downloads are cached in scripts/geo/.cache. The build fails loudly
 * on anything it can't place, rather than guessing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import osmtogeojson from "osmtogeojson";
import { feature, merge, quantize } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { GeometryCollection, Topology } from "topojson-specification";
import { buildAreaIndex, lookupArea, type BoundaryTopology } from "../../src/features/delivery/area-lookup.ts";
import { bboxOf, inBBox, interiorPoint, pointInMultiPolygon, type MultiPolygon, type Position } from "../../src/features/delivery/geo.ts";
import { distance, nameKey, splitNepaliLocalLevel, transliterate } from "./devanagari.ts";
import { districts, provinces } from "../seed/data/nepal.ts";
import { slugify } from "../seed/lib/ids.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = join(ROOT, "scripts/geo/.cache");
const OUT = join(ROOT, "src/data/nepal");
export const NEPAL_MIGRATION = "20261003090000_nepal_geography.sql";
const REFRESH = process.argv.includes("--refresh");

const OKN_URL = "https://raw.githubusercontent.com/okfnepal/localboundaries/HEAD/public/data/local-level/nepal.topojson";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
// Government of Nepal, Department of Postal Services directory (753 local levels, 6,743 wards), as JSON.
const POSTAL_URL = "https://raw.githubusercontent.com/Forgesaroj/nepal-reference-data/HEAD/data/nepal-postal-codes.json";
const BOUNDARIES_MAX_BYTES = 4_500_000;
// Longitude bands small enough for a public Overpass server to answer.
const WARD_BANDS: [number, number][] = [[80, 81.3], [81.3, 82.5], [82.5, 84.5], [84.5, 86], [86, 88.3]];

type MunicipalityType = "metropolitan_city" | "sub_metropolitan_city" | "municipality" | "rural_municipality";

const TYPES: Record<string, MunicipalityType> = {
  Mahanagarpalika: "metropolitan_city",
  Upamahanagarpalika: "sub_metropolitan_city",
  Nagarpalika: "municipality",
  Gaunpalika: "rural_municipality",
};
const SUFFIX: Record<MunicipalityType, string> = {
  metropolitan_city: "Metropolitan City",
  sub_metropolitan_city: "Sub-Metropolitan City",
  municipality: "Municipality",
  rural_municipality: "Rural Municipality",
};

type Aliases = { districts: Record<string, string>; names: Record<string, string>; nepaliDistricts: Record<string, string> };
type Legacy = { code: string; name: string; districtCode: string; wardCount: number; postalCode: string | null };

const aliases = JSON.parse(readFileSync(join(ROOT, "scripts/geo/aliases.json"), "utf8")) as Aliases;
const legacy = JSON.parse(readFileSync(join(ROOT, "scripts/geo/legacy-municipalities.json"), "utf8")) as Legacy[];

const problems: string[] = [];
const problem = (message: string) => problems.push(message);

/* ---------- Downloads ---------- */

async function cached(name: string, fetcher: () => Promise<string>): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, name);
  if (!REFRESH && existsSync(path)) return readFileSync(path, "utf8");
  const body = await fetcher();
  writeFileSync(path, body);
  return body;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { ...init, headers: { "User-Agent": "goreto-geo-build/1.0", ...init?.headers } });
    const body = await response.text();
    if (response.ok && body.trimStart().startsWith("{")) return body;
    if (attempt >= 4) throw new Error(`${url} failed (${response.status}): ${body.slice(0, 200)}`);
    console.warn(`  retrying ${url} (${response.status})`);
    await new Promise((resolve) => setTimeout(resolve, 20_000 * attempt));
  }
}

function wardQuery([west, east]: [number, number]): string {
  return `[out:json][timeout:280];relation["boundary"="administrative"]["admin_level"="9"](26,${west},31,${east});out geom;`;
}

/* ---------- Shapes ---------- */

function asMulti(geometry: GeoJSON.Geometry): MultiPolygon {
  if (geometry.type === "Polygon") return [geometry.coordinates as MultiPolygon[number]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as MultiPolygon;
  return [];
}

const round = (value: number, places = 6) => Number(value.toFixed(places));

/* ---------- Local levels ---------- */

type LocalLevel = {
  code: string;
  name: string;
  type: MunicipalityType;
  districtCode: string;
  shape: MultiPolygon;
  bbox: ReturnType<typeof bboxOf>;
  centre: Position;
};

function districtCodeFor(oknDistrict: string): string | null {
  const code = aliases.districts[oknDistrict] ?? slugify(oknDistrict.toLowerCase().replace(/_/g, " "));
  return districts.some((district) => district.code === code) ? code : null;
}

type OknProps = { DISTRICT: string; GaPa_NaPa: string; Type_GN: string };

async function loadLocalLevels(): Promise<LocalLevel[]> {
  const topo = JSON.parse(await cached("okn-local-levels.topojson", () => fetchText(OKN_URL))) as Topology;
  const object = topo.objects.local_levels as GeometryCollection<OknProps>;

  // Some local levels are split into two features; merge them per district + name.
  const groups = new Map<string, typeof object.geometries>();
  for (const geometry of object.geometries) {
    const props = geometry.properties as OknProps;
    if (!TYPES[props.Type_GN]) continue; // national parks and reserves aren't local levels
    const key = `${props.DISTRICT}|${props.GaPa_NaPa}`;
    groups.set(key, [...(groups.get(key) ?? []), geometry]);
  }

  const levels: LocalLevel[] = [];
  for (const [key, members] of groups) {
    const props = members[0]!.properties as OknProps;
    const districtCode = districtCodeFor(props.DISTRICT);
    if (!districtCode) {
      problem(`Unknown district "${props.DISTRICT}" (${key})`);
      continue;
    }
    const type = TYPES[props.Type_GN]!;
    const name = aliases.names[`${districtCode}|${props.GaPa_NaPa}`] ?? props.GaPa_NaPa.trim();
    const shape = asMulti(members.length === 1 ? (feature(topo, members[0]!) as GeoJSON.Feature).geometry : merge(topo, members as never));
    levels.push({
      code: "",
      name: `${name} ${SUFFIX[type]}`,
      type,
      districtCode,
      shape,
      bbox: bboxOf(shape),
      centre: interiorPoint(shape),
    });
  }

  // Codes follow the existing scheme: slug of the full name. A name used in
  // more than one district gets the district appended, except the legacy row
  // that already owns the plain code.
  const bySlug = new Map<string, LocalLevel[]>();
  for (const level of levels) bySlug.set(slugify(level.name), [...(bySlug.get(slugify(level.name)) ?? []), level]);
  for (const [slug, group] of bySlug) {
    const owner = legacy.find((row) => row.code === slug);
    for (const level of group) {
      const plain = group.length === 1 || owner?.districtCode === level.districtCode;
      level.code = plain ? slug : `${slug}-${level.districtCode}`;
    }
  }
  return levels.sort((a, b) => a.code.localeCompare(b.code));
}

/* ---------- Wards ---------- */

type Ward = { municipalityCode: string; ward: number; shape: MultiPolygon; osmId: string };

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/(rural municipality|sub-metropolitan city|metropolitan city|municipality|gaunpalika|nagarpalika)/g, "")
    .replace(/[^a-z]/g, "");
}

async function loadWards(levels: LocalLevel[]): Promise<Ward[]> {
  const byOsmId = new Map<string, { tags: Record<string, string>; shape: MultiPolygon }>();
  for (const band of WARD_BANDS) {
    const raw = await cached(`osm-wards-${band.join("-")}.json`, () =>
      fetchText(OVERPASS_URL, { method: "POST", body: new URLSearchParams({ data: wardQuery(band) }) }),
    );
    const collection = osmtogeojson(JSON.parse(raw)) as GeoJSON.FeatureCollection;
    for (const item of collection.features) {
      const id = String(item.id ?? "");
      if (!id.startsWith("relation/") || byOsmId.has(id)) continue;
      const shape = asMulti(item.geometry);
      if (shape.length === 0) continue;
      const props = item.properties as { tags?: Record<string, string> } & Record<string, string>;
      byOsmId.set(id, { tags: props.tags ?? props, shape });
    }
  }

  const byNormalisedName = new Map<string, LocalLevel[]>();
  for (const level of levels) byNormalisedName.set(normalise(level.name), [...(byNormalisedName.get(normalise(level.name)) ?? []), level]);

  const wards: Ward[] = [];
  let outsideNepal = 0;
  for (const [osmId, { tags, shape }] of byOsmId) {
    const point = interiorPoint(shape);
    const nameMatch = /^(.*?)[\s-]*0*(\d{1,2})$/.exec(tags.name ?? "");
    const tagged = Number((tags.ward ?? "").normalize("NFKC").trim());
    const number = Number.isInteger(tagged) && tagged >= 1 ? tagged : Number(nameMatch?.[2]);
    if (!Number.isInteger(number) || number < 1 || number > 40) {
      // e.g. a tole mapped at ward level; not a ward we can use.
      console.warn(`  ${osmId} "${tags.name}" has no ward number; skipped`);
      continue;
    }

    let owner = levels.find((level) => inBBox(point, level.bbox) && pointInMultiPolygon(point, level.shape));
    if (!owner && nameMatch) {
      // Inside a national park (carved out of the local levels) or just over a
      // border line: fall back to the ward's name, nearest one if repeated.
      const candidates = byNormalisedName.get(normalise(nameMatch[1]!)) ?? [];
      owner = candidates.sort(
        (a, b) => Math.hypot(a.centre[0] - point[0], a.centre[1] - point[1]) - Math.hypot(b.centre[0] - point[0], b.centre[1] - point[1]),
      )[0];
      if (owner && Math.hypot(owner.centre[0] - point[0], owner.centre[1] - point[1]) > 0.5) owner = undefined;
    }
    if (!owner) {
      // The download bands overlap India; its wards (if any) land here.
      outsideNepal++;
      continue;
    }
    wards.push({ municipalityCode: owner.code, ward: number, shape, osmId });
  }
  console.log(`  wards outside every local level (skipped): ${outsideNepal}`);

  // A ward mapped as two relations (usually two pieces) becomes one shape.
  const byKey = new Map<string, Ward>();
  for (const ward of wards.sort((a, b) => a.osmId.localeCompare(b.osmId))) {
    const key = `${ward.municipalityCode}#${ward.ward}`;
    const existing = byKey.get(key);
    if (existing) existing.shape = [...existing.shape, ...ward.shape];
    else byKey.set(key, { ...ward });
  }
  return [...byKey.values()];
}

/* ---------- Official ward counts ---------- */

type PostalUnit = { district_ne: string; local_level_ne: string; ward_count: number };

/**
 * Ward counts from the government directory, whose names are Nepali only.
 * Each unit is matched to a local level in the same district and of the same
 * type by transliterated name, one-to-one, closest names first. A loose name
 * match is accepted only when OSM's ward numbers agree with the count.
 */
async function officialWardCounts(levels: LocalLevel[], osmMaxWard: Map<string, number>): Promise<Map<string, number>> {
  const directory = JSON.parse(await cached("postal-directory.json", () => fetchText(POSTAL_URL))) as { units: PostalUnit[] };
  if (directory.units.length !== 753) problem(`Postal directory has ${directory.units.length} local levels, expected 753`);

  const districtOf = (nepali: string) =>
    aliases.nepaliDistricts[nepali] ??
    districts
      .map((district) => ({ code: district.code, score: distance(nameKey(transliterate(nepali)), nameKey(district.name)) }))
      .sort((a, b) => a.score - b.score)[0]!.code;

  const counts = new Map<string, number>();
  const unitsByDistrict = new Map<string, PostalUnit[]>();
  for (const unit of directory.units) {
    const code = districtOf(unit.district_ne);
    unitsByDistrict.set(code, [...(unitsByDistrict.get(code) ?? []), unit]);
  }

  for (const [districtCode, units] of unitsByDistrict) {
    const local = levels.filter((level) => level.districtCode === districtCode);
    if (units.length !== local.length) problem(`${districtCode}: ${units.length} local levels in the directory, ${local.length} in the boundaries`);
    const pairs = units.flatMap((unit) => {
      const { name, type } = splitNepaliLocalLevel(unit.local_level_ne);
      const key = nameKey(transliterate(name));
      return local
        .filter((level) => !type || level.type === type)
        .map((level) => {
          const other = nameKey(level.name);
          return { unit, level, score: distance(key, other) / Math.max(key.length, other.length, 1) };
        });
    });
    pairs.sort((a, b) => a.score - b.score);
    const usedUnits = new Set<PostalUnit>();
    for (const pair of pairs) {
      if (usedUnits.has(pair.unit) || counts.has(pair.level.code)) continue;
      const osm = osmMaxWard.get(pair.level.code);
      if (pair.score > 0.3 && osm !== pair.unit.ward_count) {
        problem(`Unsure match in ${districtCode}: ${pair.unit.local_level_ne} -> ${pair.level.name} (OSM wards ${osm}, official ${pair.unit.ward_count})`);
      }
      usedUnits.add(pair.unit);
      counts.set(pair.level.code, pair.unit.ward_count);
    }
    for (const unit of units) if (!usedUnits.has(unit)) problem(`${districtCode}: ${unit.local_level_ne} matched nothing`);
  }
  return counts;
}

/* ---------- Simplification ---------- */

/** Share of random points in Nepal that resolve to the same area after simplification. */
function lookupAgreement(simplified: BoundaryTopology, wards: Ward[], levels: LocalLevel[]): number {
  const index = buildAreaIndex(simplified);
  const fullWards = wards.map((ward) => ({ ...ward, bbox: bboxOf(ward.shape) }));
  let seed = 42;
  const random = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  let tested = 0;
  let agreed = 0;
  while (tested < 4000) {
    const point: Position = [80.06 + random() * 8.15, 26.35 + random() * 4.1];
    const ward = fullWards.find((item) => inBBox(point, item.bbox) && pointInMultiPolygon(point, item.shape));
    const level = ward ? undefined : levels.find((item) => inBBox(point, item.bbox) && pointInMultiPolygon(point, item.shape));
    if (!ward && !level) continue;
    tested++;
    const found = lookupArea(index, point);
    const same = ward
      ? found?.municipalityCode === ward.municipalityCode && found.ward === ward.ward
      : found?.municipalityCode === level!.code;
    if (same) agreed++;
  }
  return agreed / tested;
}

/* ---------- Outputs ---------- */

function sqlText(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

function migrationSql(rows: MunicipalityRow[]): string {
  const provinceValues = provinces
    .map((p, index) => `  (${sqlText(p.code)}, ${p.number}, ${sqlText(p.name)}, ${index + 1})`)
    .join(",\n");
  const districtValues = districts
    .map((d, index) => `  (${sqlText(d.code)}, ${sqlText(d.provinceCode)}, ${sqlText(d.name)}, ${index + 1})`)
    .join(",\n");
  const municipalityValues = rows
    .map(
      (m) =>
        `  (${sqlText(m.code)}, ${sqlText(m.districtCode)}, ${sqlText(m.name)}, '${m.type}', ${m.wardCount}, ${sqlText(m.postalCode)}, ${m.latitude}, ${m.longitude})`,
    )
    .join(",\n");

  return `-- Canonical Nepal geography (AGENTS §15.5), generated by scripts/geo/build-nepal.ts.
-- Do not edit by hand: change the build inputs and run the script again.
--
-- Sources: local levels from Open Knowledge Nepal "localboundaries" (CC BY 4.0);
-- ward counts from the Department of Postal Services local-level directory.
-- See src/data/nepal/README.md. Rows are upserted by code, so existing codes
-- (and every address, order and delivery zone that uses them) are kept.

insert into public.nepal_provinces (code, number, name, sort_order) values
${provinceValues}
on conflict (code) do update set number = excluded.number, name = excluded.name, sort_order = excluded.sort_order;

insert into public.nepal_districts (code, province_code, name, sort_order) values
${districtValues}
on conflict (code) do update set province_code = excluded.province_code, name = excluded.name, sort_order = excluded.sort_order;

insert into public.nepal_municipalities (code, district_code, name, type, ward_count, postal_code, latitude, longitude) values
${municipalityValues}
on conflict (code) do update set
  district_code = excluded.district_code,
  name = excluded.name,
  type = excluded.type,
  ward_count = excluded.ward_count,
  postal_code = coalesce(excluded.postal_code, public.nepal_municipalities.postal_code),
  latitude = excluded.latitude,
  longitude = excluded.longitude;
`;
}

type MunicipalityRow = {
  code: string;
  name: string;
  type: MunicipalityType;
  districtCode: string;
  wardCount: number;
  postalCode: string | null;
  latitude: number;
  longitude: number;
};

async function main() {
  console.log("Local levels (Open Knowledge Nepal)…");
  const levels = await loadLocalLevels();
  console.log(`  ${levels.length} local levels`);

  console.log("Wards (OpenStreetMap)…");
  const wards = await loadWards(levels);
  console.log(`  ${wards.length} wards placed`);

  const wardsByLevel = new Map<string, number[]>();
  for (const ward of wards) wardsByLevel.set(ward.municipalityCode, [...(wardsByLevel.get(ward.municipalityCode) ?? []), ward.ward]);
  const osmMaxWard = new Map([...wardsByLevel].map(([code, numbers]) => [code, Math.max(...numbers)]));

  console.log("Official ward counts (Department of Postal Services)...");
  const official = await officialWardCounts(levels, osmMaxWard);
  let osmGaps = 0;
  for (const level of levels) {
    const count = official.get(level.code) ?? 0;
    const numbers = new Set(wardsByLevel.get(level.code) ?? []);
    osmGaps += Array.from({ length: count }, (_, index) => index + 1).filter((n) => !numbers.has(n)).length;
  }
  console.log(`  ${osmGaps} official wards have no OSM polygon; points there ask for the ward`);

  const legacyByCode = new Map(legacy.map((row) => [row.code, row]));
  const rows: MunicipalityRow[] = levels.map((level) => ({
    code: level.code,
    name: level.name,
    type: level.type,
    districtCode: level.districtCode,
    wardCount: official.get(level.code) ?? 0,
    postalCode: legacyByCode.get(level.code)?.postalCode ?? null,
    latitude: round(level.centre[1]),
    longitude: round(level.centre[0]),
  }));
  // OSM wards numbered above the official count are mapping errors: drop them.
  const validWards = wards.filter((ward) => ward.ward <= (official.get(ward.municipalityCode) ?? 0));
  if (validWards.length !== wards.length) console.warn(`  dropped ${wards.length - validWards.length} OSM ward(s) above the official count`);

  const codes = new Set(rows.map((row) => row.code));
  for (const row of legacy) {
    if (!codes.has(row.code)) problem(`Legacy code ${row.code} (${row.name}, ${row.districtCode}) is missing; add a name alias`);
  }
  for (const district of districts) {
    if (!rows.some((row) => row.districtCode === district.code)) problem(`District ${district.code} has no local levels`);
  }
  if (rows.length !== 753) problem(`Expected 753 local levels, got ${rows.length}`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }

  // Boundaries for the lookup: quantised TopoJSON with only codes, simplified
  // until it fits the size budget, checking that lookups still agree.
  const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
  const multi = (shape: MultiPolygon): GeoJSON.MultiPolygon => ({ type: "MultiPolygon", coordinates: shape });
  const topo = topology(
    {
      municipalities: collection(levels.map((level) => ({ type: "Feature", properties: { c: level.code }, geometry: multi(level.shape) }))),
      wards: collection(
        validWards.map((ward) => ({ type: "Feature", properties: { m: ward.municipalityCode, w: ward.ward }, geometry: multi(ward.shape) })),
      ),
    },
    1e5,
  );
  const presimplified = presimplify(topo as unknown as Parameters<typeof presimplify>[0]);
  let simplified: BoundaryTopology | null = null;
  let agreement = 0;
  // `share` is the fraction of points kept; the least simplified that fits wins.
  for (const share of [0.3, 0.2, 0.15, 0.1, 0.07, 0.05]) {
    const candidate = quantize(simplify(presimplified, quantile(presimplified, share)), 1e5) as unknown as BoundaryTopology;
    const size = JSON.stringify(candidate).length;
    agreement = lookupAgreement(candidate, validWards, levels);
    console.log(`  simplify ${share}: ${(size / 1e6).toFixed(1)} MB, lookups agree ${(agreement * 100).toFixed(2)}%`);
    simplified = candidate;
    if (size <= BOUNDARIES_MAX_BYTES) break;
  }
  if (!simplified || agreement < 0.99) problem(`Simplified boundaries agree on only ${(agreement * 100).toFixed(2)}% of lookups`);
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "boundaries.json"), JSON.stringify(simplified));
  writeFileSync(
    join(OUT, "divisions.json"),
    `${JSON.stringify({ provinces, districts: districts.map(({ code, name, provinceCode }) => ({ code, name, provinceCode })) }, null, 2)}\n`,
  );
  writeFileSync(join(OUT, "municipalities.json"), `${JSON.stringify(rows, null, 1)}\n`);
  writeFileSync(join(ROOT, "supabase/migrations", NEPAL_MIGRATION), migrationSql(rows));

  const totalWards = rows.reduce((sum, row) => sum + row.wardCount, 0);
  const fetched = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(OUT, "README.md"),
    `# Nepal geography

Generated by \`node scripts/geo/build-nepal.ts\` on ${fetched}. Do not edit the JSON by hand.

| File | Contents |
| --- | --- |
| \`divisions.json\` | ${provinces.length} provinces and ${districts.length} districts |
| \`municipalities.json\` | ${rows.length} local levels: code, type, district, ward count (${totalWards} wards in total), centre point |
| \`boundaries.json\` | Simplified TopoJSON for the address map lookup: ${levels.length} local levels and ${validWards.length} ward polygons. ${osmGaps} official wards have no polygon, so points there ask for the ward. ${(agreement * 100).toFixed(1)}% of 4,000 random lookups match the full-detail shapes. |

## Sources and licences

- **Local-level boundaries and names**: [Open Knowledge Nepal, localboundaries](https://github.com/okfnepal/localboundaries), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Ward boundaries**: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). \`boundaries.json\` is a derived database and is available under the ODbL.
- **Ward counts**: Government of Nepal, Department of Postal Services, [local-level postal directory](https://gpo.gov.np/pages/postal-code-1259614658/), read from the JSON copy in [Forgesaroj/nepal-reference-data](https://github.com/Forgesaroj/nepal-reference-data). Its Nepali names are matched to the boundary names by transliteration within each district and type (\`scripts/geo/devanagari.ts\`).

The map picker credits both sources. The lookup is assistance only: shoppers review and can change every field (AGENTS §4.4).
`,
  );
  console.log(`\nWrote ${rows.length} local levels (${totalWards} wards), ${validWards.length} ward polygons.`);
}

await main();
