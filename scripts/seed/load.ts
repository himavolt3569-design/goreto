/**
 * Loads `supabase/seed.ndjson` into the DEVELOPMENT Supabase project.
 *
 *   npm run seed:load                 rows + catalog images
 *   npm run seed:load -- --skip-media rows only
 *
 * Idempotent: rows are upserted by primary key (ids are deterministic), and
 * images are uploaded with upsert. Refuses to run unless
 * GORETO_DATA_ENV=development. Remove everything again with `npm run seed:purge`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, assertDevelopmentTarget, createServiceClient, targetHost } from "./lib/env.ts";
import { PRIMARY_KEYS, chunk, mediaObjects, readSeedFile, type MediaObject } from "./lib/ndjson.ts";
import { TABLE_ORDER } from "./types.ts";

const ROW_BATCH = 500;
const MEDIA_CONCURRENCY = 8;

async function loadRows(client: SupabaseClient, seed: ReturnType<typeof readSeedFile>): Promise<void> {
  for (const table of TABLE_ORDER) {
    const rows = (seed.byTable.get(table) ?? []).map((line) => line.data);
    for (const batch of chunk(rows, ROW_BATCH)) {
      const { error } = await client
        .from(table)
        .upsert(batch as Record<string, unknown>[], { onConflict: PRIMARY_KEYS[table].join(",") });
      if (error) throw new Error(`${table}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
    }

    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table} count: ${error.message}`);
    const expected = seed.meta.counts[table];
    const note = count !== null && count > expected ? ` (+${count - expected} non-seed rows)` : "";
    if (count === null || count < expected) {
      throw new Error(`${table}: expected at least ${expected} rows, found ${count}`);
    }
    console.log(`  ${table.padEnd(24)} ${String(expected).padStart(6)}${note}`);
  }
}

async function uploadMedia(client: SupabaseClient, objects: MediaObject[]): Promise<void> {
  // Placeholder photos repeat across products; download each source once.
  const downloads = new Map<string, Promise<{ bytes: ArrayBuffer; type: string }>>();
  const download = (url: string) => {
    let pending = downloads.get(url);
    if (!pending) {
      pending = fetch(url, { redirect: "follow" }).then(async (response) => {
        if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
        return { bytes: await response.arrayBuffer(), type: response.headers.get("content-type") ?? "image/jpeg" };
      });
      downloads.set(url, pending);
    }
    return pending;
  };

  let done = 0;
  const queue = [...objects];
  const worker = async () => {
    for (let object = queue.shift(); object; object = queue.shift()) {
      const { bytes, type } = await download(object.sourceUrl);
      const { error } = await client.storage
        .from(MEDIA_BUCKET)
        .upload(object.path, bytes, { contentType: type, upsert: true, cacheControl: "31536000" });
      if (error) throw new Error(`upload ${object.path}: ${error.message}`);
      done += 1;
      if (done % 100 === 0 || done === objects.length) console.log(`  images ${done}/${objects.length}`);
    }
  };
  await Promise.all(Array.from({ length: MEDIA_CONCURRENCY }, worker));
}

async function main(): Promise<void> {
  assertDevelopmentTarget();
  const skipMedia = process.argv.includes("--skip-media");
  const seed = readSeedFile();
  const client = createServiceClient();

  console.log(`Loading development seed into ${targetHost()}`);
  await loadRows(client, seed);

  if (skipMedia) {
    console.log("Skipped images (--skip-media).");
  } else {
    console.log(`Uploading catalog images to the ${MEDIA_BUCKET} bucket`);
    await uploadMedia(client, mediaObjects(seed.byTable));
  }
  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
