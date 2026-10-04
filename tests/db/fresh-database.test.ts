// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createMigratedDatabase, runAs } from "./harness";

/*
 * A production database gets the migrations and never the development seed
 * (prompts/goreto-production-release.md). It must still have what the app
 * needs to run: the store settings row, the Nepal geography and the buckets.
 */

let db: PGlite;

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

beforeAll(async () => {
  db = await createMigratedDatabase();
}, 120_000);

describe("a fresh database (migrations only)", () => {
  it("has exactly one store settings row with the store defaults", async () => {
    expect(await scalar<number>("select count(*)::integer from store_settings")).toBe(1);
    const settings = (await db.query<Record<string, unknown>>("select * from store_settings")).rows[0]!;
    expect(settings).toMatchObject({
      store_name: "Goreto.store",
      currency: "NPR",
      timezone: "Asia/Kathmandu",
      cod_enabled: true,
      courier_assignment_mode: "manual",
      auto_accept_website_orders: false,
      auto_accept_whatsapp_orders: false,
    });
  });

  it("lets shoppers read the settings row", async () => {
    expect(await runAs(db, { role: "anon" }, "select store_name from store_settings")).toBe("Goreto.store");
  });

  it("keeps the settings row when the migration runs again", async () => {
    const file = readdirSync(resolve(import.meta.dirname, "../../supabase/migrations")).find((name) => name.endsWith("_store_settings_singleton.sql"))!;
    await db.exec(readFileSync(join(import.meta.dirname, "../../supabase/migrations", file), "utf8"));
    expect(await scalar<number>("select count(*)::integer from store_settings")).toBe(1);
  });

  it("has the Nepal geography and storage buckets but no demo data", async () => {
    expect(await scalar<number>("select count(*)::integer from nepal_municipalities")).toBe(753);
    expect(await scalar<number>("select count(*)::integer from storage.buckets")).toBeGreaterThan(0);
    for (const table of ["products", "categories", "orders", "profiles", "reviews", "couriers", "delivery_rates"]) {
      expect(await scalar<number>(`select count(*)::integer from ${table}`), table).toBe(0);
    }
  });
});
