/**
 * Matching Daraz's Nepal location list to Goreto's 753 municipalities
 * (src/data/nepal). Pure, so it can be tested; scripts/daraz/import-locations.ts
 * reads the file and writes daraz_locations.
 *
 * Two CSV layouts are accepted (header row required, any column order):
 *   municipality_code, daraz_address_id [, daraz_city]
 *   district, municipality, daraz_address_id [, daraz_city]
 */

export type Municipality = { code: string; name: string; districtCode: string };
export type LocationRow = { municipality_code: string; daraz_address_id: string; daraz_city: string | null };
export type MatchReport = { rows: LocationRow[]; unmatched: { line: number; text: string; reason: string }[] };

const ADDRESS_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Minimal CSV: quoted fields, commas, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

/** "Pokhara Metropolitan City" / "pokhara mahanagarpalika" -> "pokhara". */
export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(sub[- ]?metropolitan|metropolitan|rural|municipality|city|gaunpalika|nagarpalika|mahanagarpalika|upamahanagarpalika|gaupalika|rm|mun)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

export function matchLocations(csv: string, municipalities: readonly Municipality[]): MatchReport {
  const [header, ...lines] = parseCsv(csv);
  if (!header) return { rows: [], unmatched: [{ line: 1, text: "", reason: "empty file" }] };
  const columns = header.map((name) => name.toLowerCase().replace(/[^a-z_]/g, ""));
  const at = (name: string) => columns.indexOf(name);
  const codeColumn = at("municipality_code");
  const idColumn = at("daraz_address_id");
  const cityColumn = at("daraz_city");
  const districtColumn = at("district");
  const municipalityColumn = at("municipality");
  if (idColumn === -1 || (codeColumn === -1 && (districtColumn === -1 || municipalityColumn === -1))) {
    return { rows: [], unmatched: [{ line: 1, text: header.join(","), reason: "header needs daraz_address_id and municipality_code, or district + municipality" }] };
  }

  const byCode = new Map(municipalities.map((item) => [item.code, item]));
  const byDistrictName = new Map<string, Municipality[]>();
  for (const item of municipalities) {
    const key = `${item.districtCode}|${normaliseName(item.name)}`;
    byDistrictName.set(key, [...(byDistrictName.get(key) ?? []), item]);
  }

  const rows = new Map<string, LocationRow>();
  const unmatched: MatchReport["unmatched"] = [];
  lines.forEach((cells, index) => {
    const line = index + 2;
    const text = cells.join(",");
    const addressId = cells[idColumn] ?? "";
    if (!ADDRESS_ID.test(addressId)) {
      unmatched.push({ line, text, reason: "missing or invalid daraz_address_id" });
      return;
    }
    let municipality: Municipality | undefined;
    if (codeColumn !== -1 && cells[codeColumn]) {
      municipality = byCode.get(cells[codeColumn]!);
      if (!municipality) {
        unmatched.push({ line, text, reason: "unknown municipality_code" });
        return;
      }
    } else {
      const district = normaliseName(cells[districtColumn] ?? "").replace(/district$/, "");
      const candidates = byDistrictName.get(`${district}|${normaliseName(cells[municipalityColumn] ?? "")}`) ?? [];
      if (candidates.length !== 1) {
        unmatched.push({ line, text, reason: candidates.length === 0 ? "no municipality with that name in that district" : "name matches more than one municipality" });
        return;
      }
      municipality = candidates[0];
    }
    const city = cityColumn === -1 ? null : (cells[cityColumn] || null);
    rows.set(municipality!.code, { municipality_code: municipality!.code, daraz_address_id: addressId, daraz_city: city?.slice(0, 120) ?? null });
  });
  return { rows: [...rows.values()], unmatched };
}
