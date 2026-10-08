/**
 * Loads Daraz's Nepal location list into daraz_locations, so bookings carry
 * Daraz's own location ID (R-code) for the delivery municipality
 * (docs/couriers/daraz.md §6). Booking works without it; this improves routing.
 *
 *   npm run daraz:locations -- --file daraz-np-locations.csv --dry-run
 *   npm run daraz:locations -- --file daraz-np-locations.csv
 *   production: node --env-file=.env.production.local scripts/daraz/import-locations.ts --file … --dry-run
 *
 * CSV layouts (see scripts/daraz/locations.ts): municipality_code,daraz_address_id[,daraz_city]
 * or district,municipality,daraz_address_id[,daraz_city]. Rows that can't be
 * matched are listed and skipped. Existing mappings are updated, never deleted.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceClient, targetHost } from "../seed/lib/env.ts";
import { matchLocations, type Municipality } from "./locations.ts";

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const file = argument("--file");
const dryRun = process.argv.includes("--dry-run");
if (!file) {
  console.error("Usage: npm run daraz:locations -- --file <csv> [--dry-run]");
  process.exit(1);
}

const municipalities = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../src/data/nepal/municipalities.json"), "utf8")) as Municipality[];
const report = matchLocations(readFileSync(resolve(file), "utf8"), municipalities);

console.log(`Matched ${report.rows.length} of ${municipalities.length} municipalities; ${report.unmatched.length} rows skipped.`);
for (const item of report.unmatched.slice(0, 50)) console.log(`  line ${item.line}: ${item.reason}  (${item.text})`);
if (report.unmatched.length > 50) console.log(`  … and ${report.unmatched.length - 50} more`);

if (dryRun) {
  console.log(`Dry run: nothing written to ${targetHost()}.`);
  process.exit(0);
}
if (report.rows.length === 0) {
  console.error("Nothing to write.");
  process.exit(1);
}

const db = createServiceClient();
for (let start = 0; start < report.rows.length; start += 200) {
  const batch = report.rows.slice(start, start + 200).map((row) => ({ ...row, updated_at: new Date().toISOString() }));
  const { error } = await db.from("daraz_locations").upsert(batch, { onConflict: "municipality_code" });
  if (error) {
    console.error(`Write failed: ${error.message}`);
    process.exit(1);
  }
}
console.log(`Wrote ${report.rows.length} Daraz location IDs to ${targetHost()}.`);
