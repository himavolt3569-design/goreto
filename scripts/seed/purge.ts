/**
 * Removes the development seed from the Supabase project, leaving any data
 * the owner or staff created.
 *
 *   npm run seed:purge -- --dry-run   report what would be deleted
 *   npm run seed:purge                delete it
 *
 * Deletes exactly the rows whose keys appear in seed.ndjson, in reverse
 * foreign-key order, plus the catalog images the loader uploaded. Nepal
 * geography and store_settings are kept (see KEEP_ON_PURGE). A seeded row
 * that real data still references (e.g. a seeded category holding an owner
 * product) is not force-deleted: it is listed so it can be reassigned first.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, assertDevelopmentTarget, createServiceClient, targetHost } from "./lib/env.ts";
import {
  KEEP_ON_PURGE,
  PRIMARY_KEYS,
  chunk,
  mediaObjects,
  readSeedFile,
  type SeedFile,
} from "./lib/ndjson.ts";
import { TABLE_ORDER, type TableName } from "./types.ts";

const ID_BATCH = 200;

type Blocked = { table: TableName; key: string; reason: string };

function seedKeys(seed: SeedFile, table: TableName): Record<string, string>[] {
  const columns = PRIMARY_KEYS[table];
  return (seed.byTable.get(table) ?? []).map((line) => {
    const data = line.data as unknown as Record<string, string>;
    return Object.fromEntries(columns.map((column) => [column, data[column]]));
  });
}

async function countPresent(client: SupabaseClient, table: TableName, keys: Record<string, string>[]) {
  if (table === "collection_products") {
    const collectionIds = [...new Set(keys.map((key) => key.collection_id))];
    const productIds = [...new Set(keys.map((key) => key.product_id))];
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("collection_id", collectionIds)
      .in("product_id", productIds);
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  }

  const [column] = PRIMARY_KEYS[table];
  let present = 0;
  for (const batch of chunk(keys.map((key) => key[column]), ID_BATCH)) {
    const { count, error } = await client
      .from(table)
      .select(column, { count: "exact", head: true })
      .in(column, batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    present += count ?? 0;
  }
  return present;
}

async function deleteRows(
  client: SupabaseClient,
  table: TableName,
  keys: Record<string, string>[],
  blocked: Blocked[],
): Promise<void> {
  if (table === "collection_products") {
    // Only the seeded (collection, product) pairs; links the owner added stay.
    const byCollection = new Map<string, string[]>();
    for (const key of keys) byCollection.set(key.collection_id, [...(byCollection.get(key.collection_id) ?? []), key.product_id]);
    for (const [collectionId, productIds] of byCollection) {
      const { error } = await client.from(table).delete().eq("collection_id", collectionId).in("product_id", productIds);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    return;
  }

  const [column] = PRIMARY_KEYS[table];
  for (const batch of chunk(keys.map((key) => key[column]), ID_BATCH)) {
    const { error } = await client.from(table).delete().in(column, batch);
    if (!error) continue;
    // Usually a foreign key from non-seed data. Retry one by one to isolate it.
    for (const value of batch) {
      const single = await client.from(table).delete().eq(column, value);
      if (single.error) blocked.push({ table, key: value, reason: single.error.message });
    }
  }
}

async function removeMedia(client: SupabaseClient, paths: string[]): Promise<void> {
  for (const batch of chunk(paths, 100)) {
    const { error } = await client.storage.from(MEDIA_BUCKET).remove(batch);
    if (error) throw new Error(`storage remove: ${error.message}`);
  }
}

async function main(): Promise<void> {
  assertDevelopmentTarget();
  const dryRun = process.argv.includes("--dry-run");
  const seed = readSeedFile();
  const client = createServiceClient();
  const tables = [...TABLE_ORDER].reverse().filter((table) => !KEEP_ON_PURGE.has(table));

  console.log(`${dryRun ? "Dry run: would purge" : "Purging"} the development seed from ${targetHost()}`);

  const blocked: Blocked[] = [];
  for (const table of tables) {
    const keys = seedKeys(seed, table);
    const present = await countPresent(client, table, keys);
    if (!dryRun && present > 0) await deleteRows(client, table, keys, blocked);
    console.log(`  ${table.padEnd(24)} ${String(present).padStart(6)} seeded rows${dryRun ? "" : " deleted"}`);
  }

  const paths = [...new Set(mediaObjects(seed.byTable).map((object) => object.path))];
  if (dryRun) {
    console.log(`  ${"storage objects".padEnd(24)} ${String(paths.length).padStart(6)} in ${MEDIA_BUCKET}`);
  } else {
    await removeMedia(client, paths);
    console.log(`  ${"storage objects".padEnd(24)} ${String(paths.length).padStart(6)} removed`);
  }

  console.log(`Kept: ${[...KEEP_ON_PURGE].join(", ")}.`);
  if (blocked.length > 0) {
    console.log(`\n${blocked.length} seeded rows are still referenced by real data and were kept:`);
    for (const row of blocked.slice(0, 50)) console.log(`  ${row.table} ${row.key}: ${row.reason}`);
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
