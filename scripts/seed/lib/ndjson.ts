import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TABLE_ORDER, type SeedLine, type TableName } from "../types.ts";

export const SEED_FILE = fileURLToPath(new URL("../../../supabase/seed.ndjson", import.meta.url));

export type SeedMeta = { counts: Record<string, number>; environment: string };

export type SeedFile = {
  meta: SeedMeta;
  /** Every data line, grouped by table, in file (foreign-key) order. */
  byTable: Map<TableName, SeedLine[]>;
};

export function readSeedFile(path = SEED_FILE): SeedFile {
  const text = readFileSync(path, "utf8");
  const byTable = new Map<TableName, SeedLine[]>(TABLE_ORDER.map((table) => [table, []]));
  let meta: SeedMeta | null = null;

  for (const [index, raw] of text.split("\n").entries()) {
    if (raw.trim() === "") continue;
    const line = JSON.parse(raw) as { table: string; data: unknown; dev?: unknown };
    if (line.table === "_meta") {
      meta = line.data as SeedMeta;
      continue;
    }
    const bucket = byTable.get(line.table as TableName);
    if (!bucket) throw new Error(`Line ${index + 1}: unknown table "${line.table}"`);
    bucket.push(line as SeedLine);
  }

  if (!meta) throw new Error("seed.ndjson has no _meta line");
  if (meta.environment !== "development") throw new Error("seed.ndjson is not development data");
  return { meta, byTable };
}

/** Primary-key columns per table; the loader upserts and the purge deletes by these. */
export const PRIMARY_KEYS: Record<TableName, readonly string[]> = Object.fromEntries(
  TABLE_ORDER.map((table) => {
    if (table.startsWith("nepal_")) return [table, ["code"]];
    if (table === "collection_products") return [table, ["collection_id", "product_id"]];
    return [table, ["id"]];
  }),
) as unknown as Record<TableName, readonly string[]>;

/**
 * Tables the purge keeps: Nepal geography is real reference data and
 * store_settings is the store's configuration, not demo content.
 */
export const KEEP_ON_PURGE: ReadonlySet<TableName> = new Set([
  "nepal_provinces",
  "nepal_districts",
  "nepal_municipalities",
  "store_settings",
]);

export type MediaObject = { path: string; sourceUrl: string };

/** Catalog images the loader uploads to the product-media bucket. */
export function mediaObjects(byTable: SeedFile["byTable"]): MediaObject[] {
  const objects: MediaObject[] = [];
  const add = (path: unknown, url: string | undefined) => {
    if (typeof path === "string" && url) objects.push({ path, sourceUrl: url });
  };

  for (const line of byTable.get("categories") ?? []) {
    // The seed hint is the 160px rail size; category tiles render at 480px.
    add(
      (line.data as { image_path: string | null }).image_path,
      line.dev?.placeholder_url?.replace(/\/\d+\/\d+$/, "/480/480"),
    );
  }
  for (const line of byTable.get("collections") ?? []) {
    add((line.data as { hero_image_path: string | null }).hero_image_path, line.dev?.placeholder_url);
  }
  for (const line of byTable.get("product_media") ?? []) {
    add((line.data as { storage_path: string }).storage_path, line.dev?.placeholder_url);
  }
  return objects;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}
