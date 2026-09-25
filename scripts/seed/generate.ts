/**
 * Generates `supabase/seed.ndjson`, the Goreto.store DEVELOPMENT seed.
 *
 *   npm run seed:generate
 *
 * Output is deterministic: the same code always writes the same bytes. See
 * prompts/goreto-seed-data.md for the format and the decisions behind it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "./build/catalog.ts";
import { buildDelivery } from "./build/delivery.ts";
import { buildEngagement } from "./build/engagement.ts";
import { buildOrders } from "./build/orders.ts";
import {
  addressLines,
  buildPeople,
  geographyLines,
  profileLines,
  staffPermissionLines,
  storeSettingsLine,
} from "./build/people.ts";
import { municipalities } from "./data/nepal.ts";
import { BASE_SEED, rngFor } from "./lib/random.ts";
import { DAY, NOW, iso } from "./lib/time.ts";
import { TABLE_ORDER, type SeedLine, type TableName } from "./types.ts";

export const SEED_PATH = fileURLToPath(new URL("../../supabase/seed.ndjson", import.meta.url));

export function generateSeedLines(): string[] {
  const catalog = buildCatalog();
  const people = buildPeople();
  const delivery = buildDelivery();
  const orders = buildOrders({
    products: catalog.products,
    customers: people.customers,
    persons: people.persons,
    ratesByDistrict: delivery.ratesByDistrict,
  });

  // A few customers deleted their Clerk account; their profile is anonymised
  // and their order snapshots stay for accounting (AGENTS §9.4).
  const deletionRng = rngFor("deletions");
  const deletable = people.customers.filter((customer) => {
    const last = orders.lastOrderAtByCustomer.get(customer.id);
    return last !== undefined && last < NOW - 60 * DAY;
  });
  for (const customer of deletionRng.sample(deletable, 5)) {
    const last = orders.lastOrderAtByCustomer.get(customer.id)!;
    customer.deletedAt = Math.min(last + deletionRng.int(20, 50) * DAY, NOW - DAY);
  }

  const support = people.staff.find((member) => member.permissions.includes("reviews.manage"))!;
  const engagement = buildEngagement({
    customers: people.customers,
    products: catalog.products,
    deliveredItemsByCustomer: orders.deliveredItemsByCustomer,
    persons: people.persons,
    moderators: { support: support.id, owner: people.owner.id },
  });

  const byTable: { [T in TableName]: SeedLine<T>[] } = {
    ...geographyLines(),
    store_settings: [storeSettingsLine(people.owner.createdAt)],
    profiles: profileLines(people),
    staff_permissions: staffPermissionLines(people),
    customer_addresses: addressLines(people.customers),
    ...catalog.lines,
    ...delivery.lines,
    ...orders.lines,
    ...engagement,
  };

  const counts = Object.fromEntries(TABLE_ORDER.map((table) => [table, byTable[table].length]));
  const meta = {
    table: "_meta",
    data: {
      format: "goreto-seed-ndjson",
      version: 1,
      environment: "development",
      generated_by: "scripts/seed/generate.ts",
      prng_seed: BASE_SEED,
      reference_now: iso(NOW),
      reference_now_npt: "2026-09-24T12:00:00+05:45",
      currency: "NPR",
      money_unit: "paisa",
      table_order: TABLE_ORDER,
      counts,
      nepal_municipalities: { source: "dev-seed-subset", rows: municipalities.length, of_total: 753 },
      notes: [
        "DEVELOPMENT DATA ONLY. Never load this file into a production database.",
        "Each line is {table, data, dev?}. Insert `data` as the row; `dev` holds loader hints and is never a column.",
        "Lines are in foreign-key order. Ids are deterministic UUIDv5, so reloading upserts rather than duplicates.",
        "People, emails and phone numbers are fictional. Emails use reserved example.* domains. Never message seed phone numbers: they may belong to real people.",
        "clerk_user_id values (user_seed_*) do not exist in Clerk. Bootstrap the real owner by mapping the owner profile to their Clerk user id.",
        "nepal_municipalities is a subset used by seed addresses, not the full 753 local levels.",
        "product_media.storage_path and product_ar_assets.asset_path point to files that do not exist yet. dev.placeholder_url gives Picsum stand-ins; they repeat across products and may not match the alt text.",
        "Shipment events have no coordinates: couriers are manual integrations and no live location source exists.",
        "Canceled orders carry payment_status 'failed' (no cash will be collected). Pending COD is payment_status 'pending' only.",
        "Orders canceled before dispatch keep a shipment in awaiting_assignment with no courier; the order status is the source of truth.",
        "Guest orders store guest_tracking_hash = sha256(dev.tracking_secret). The plaintext secret is included for testing guest tracking.",
        "Product ratings are not stored; aggregate them from published reviews.",
        "product_variants.stock_quantity is the stock left after all seeded orders.",
      ],
    },
  };

  const lines = [JSON.stringify(meta)];
  for (const table of TABLE_ORDER) {
    for (const line of byTable[table]) lines.push(JSON.stringify(line));
  }
  return lines;
}

function main() {
  const lines = generateSeedLines();
  mkdirSync(dirname(SEED_PATH), { recursive: true });
  writeFileSync(SEED_PATH, `${lines.join("\n")}\n`, "utf8");
  const meta = JSON.parse(lines[0]!) as { data: { counts: Record<string, number> } };
  const sizeMb = Buffer.byteLength(lines.join("\n")) / 1024 / 1024;
  console.log(`Wrote ${lines.length.toLocaleString("en")} lines (${sizeMb.toFixed(1)} MB) to ${SEED_PATH}`);
  for (const [table, count] of Object.entries(meta.data.counts)) console.log(`  ${table.padEnd(24)} ${count}`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invokedDirectly) main();
