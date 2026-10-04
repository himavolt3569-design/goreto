// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import canonical from "../../src/data/nepal/municipalities.json";
import legacy from "../../scripts/geo/legacy-municipalities.json";
import { createSeededDatabase, runAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Canonical Nepal geography (migration nepal_geography) and saved-address
 * coordinates (migration account_address_coordinates).
 */

let db: PGlite;
const NEW_USER = "user_test_geo";
const newUser: Session = { role: "authenticated", clerkUserId: NEW_USER };
const CREATE_NEW_USER = `insert into profiles (clerk_user_id) values ('${NEW_USER}')`;

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
}, 120_000);

describe("nepal_geography", () => {
  it("loads every province, district and local level with the official ward total", async () => {
    expect(await scalar<number>("select count(*)::integer from nepal_provinces")).toBe(7);
    expect(await scalar<number>("select count(*)::integer from nepal_districts")).toBe(77);
    expect(await scalar<number>("select count(*)::integer from nepal_municipalities")).toBe(753);
    expect(await scalar<number>("select sum(ward_count)::integer from nepal_municipalities")).toBe(6743);
    expect(await scalar<number>("select count(*)::integer from nepal_districts d where not exists (select 1 from nepal_municipalities m where m.district_code = d.code)")).toBe(0);
  });

  it("matches the committed dataset and keeps every existing code", async () => {
    const codes = new Set((await db.query<{ code: string }>("select code from nepal_municipalities")).rows.map((row) => row.code));
    expect(codes.size).toBe(canonical.length);
    for (const row of legacy) expect(codes.has(row.code), row.code).toBe(true);
    expect(await scalar<number>("select ward_count from nepal_municipalities where code = 'kathmandu-metropolitan-city'")).toBe(32);
  });

  it("leaves every seeded address, order and zone valid", async () => {
    const badAddresses = await scalar<number>(`
      select count(*)::integer from customer_addresses a
      join nepal_municipalities m on m.code = a.municipality_code
      where a.ward > m.ward_count or m.district_code <> a.district_code`);
    expect(badAddresses).toBe(0);
  });
});

describe("account_save_address with coordinates", () => {
  const area = { province: "bagmati", district: "kathmandu", municipality: "kathmandu-metropolitan-city" };
  const save = (id: string, lat: string, lng: string, municipality = area.municipality, district = area.district) =>
    `select public.account_save_address(${id}, 'Home', 'Sita Sharma', '+9779812345678',
      '${area.province}', '${district}', '${municipality}', 5, 'Thamel', '', false, ${lat}, ${lng})`;
  const POINT = "select json_build_object('lat', latitude, 'lng', longitude) from customer_addresses where user_id = public.current_profile_id()";
  const OWN_ID = "(select id from customer_addresses where user_id = public.current_profile_id())";

  it("stores the picked point and keeps it on an edit without one", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save("null", "27.7153", "85.3123"),
      POINT,
      save(OWN_ID, "null", "null"),
      POINT,
    ]);
    expect(outcomes[1]).toEqual({ lat: 27.7153, lng: 85.3123 });
    expect(outcomes[3]).toEqual({ lat: 27.7153, lng: 85.3123 });
  });

  it("drops the old point when the municipality changes without a new one", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save("null", "27.7153", "85.3123"),
      save(OWN_ID, "null", "null", "kirtipur-municipality"),
      POINT,
    ]);
    expect(outcomes[2]).toEqual({ lat: null, lng: null });
  });

  it("rejects a half or out-of-Nepal point", async () => {
    const [half] = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [save("null", "27.7", "null")]);
    expect(half).toMatch(/^error:Location is outside Nepal/);
    const [outside] = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [save("null", "40", "85")]);
    expect(outside).toMatch(/^error:Location is outside Nepal/);
  });

  it("is still closed to anon", async () => {
    expect(await runAs(db, { role: "anon" }, save("null", "null", "null"))).toMatch(/^error:permission denied/);
  });
});
