// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Account phase 2 (migration account_addresses_wishlist): saved addresses
 * keep exactly one default and belong only to their owner; addresses and
 * wishlist items are capped per profile. Every call is rolled back.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const NEW_USER = "user_test_addresses";
const newUser = as(NEW_USER);
const CREATE_NEW_USER = `insert into profiles (clerk_user_id) values ('${NEW_USER}')`;
const supportStaff = as("user_seed_staff_support"); // customers.read

let area = { province: "", district: "", municipality: "" };
let otherClerkId = "";
let otherAddressId = "";
let activeProductIds: string[] = [];

function save(id: string | null, options: { makeDefault?: boolean; label?: string; ward?: number } = {}): string {
  return `select public.account_save_address(
    ${id ? `'${id}'` : "null"}, '${options.label ?? "Home"}', 'Sita Sharma', '+9779812345678',
    '${area.province}', '${area.district}', '${area.municipality}', ${options.ward ?? 1},
    'Near the temple', '', ${options.makeDefault ?? false})`;
}

const DEFAULTS = `select coalesce(json_agg(label order by label), '[]') from customer_addresses
  where user_id = public.current_profile_id() and is_default`;
const COUNT = "select count(*)::integer from customer_addresses where user_id = public.current_profile_id()";

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  const municipality = await db.query<{ province: string; district: string; municipality: string }>(`
    select d.province_code as province, d.code as district, m.code as municipality
    from nepal_municipalities m join nepal_districts d on d.code = m.district_code
    where m.ward_count >= 5 order by m.code limit 1`);
  area = municipality.rows[0]!;
  const other = await db.query<{ clerk_user_id: string; id: string }>(`
    select p.clerk_user_id, a.id from customer_addresses a join profiles p on p.id = a.user_id
    where p.role = 'customer' order by a.id limit 1`);
  otherClerkId = other.rows[0]!.clerk_user_id;
  otherAddressId = other.rows[0]!.id;
  const products = await db.query<{ id: string }>("select id from products where status = 'active' order by id limit 3");
  activeProductIds = products.rows.map((row) => row.id);
}, 120_000);

describe("account_save_address", () => {
  it("makes the first address the default even when not asked", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [save(null), DEFAULTS]);
    expect(outcomes[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(outcomes[1]).toEqual(["Home"]);
  });

  it("moves the default to a new address when asked, leaving exactly one", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save(null, { label: "Home" }),
      save(null, { label: "Work" }),
      DEFAULTS,
      save(null, { label: "Office", makeDefault: true }),
      DEFAULTS,
    ]);
    expect(outcomes[2]).toEqual(["Home"]);
    expect(outcomes[4]).toEqual(["Office"]);
  });

  it("keeps the only address the default when an edit unticks it", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save(null),
      `select public.account_save_address(
        (select id from customer_addresses where user_id = public.current_profile_id()),
        'Home', 'Sita Sharma', '+9779812345678', '${area.province}', '${area.district}', '${area.municipality}',
        2, 'Near the temple', '44600', false)`,
      DEFAULTS,
      "select ward from customer_addresses where user_id = public.current_profile_id()",
    ]);
    expect(outcomes[2]).toEqual(["Home"]);
    expect(outcomes[3]).toBe(2);
  });

  it("rejects an invalid ward, label or hierarchy", async () => {
    expect((await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [save(null, { ward: 99 })]))[0]).toMatch(/^error:Address hierarchy/);
    expect((await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [save(null, { label: "" })]))[0]).toMatch(/^error:Label/);
  });

  it("can't update another customer's address", async () => {
    const [outcome] = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [save(otherAddressId)]);
    expect(outcome).toMatch(/^error:Address not found/);
  });

  it("stops at 10 addresses", async () => {
    const steps = Array.from({ length: 11 }, (_, index) => save(null, { label: `Place ${index + 1}` }));
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, steps);
    expect(outcomes).toHaveLength(11);
    expect(outcomes[10]).toMatch(/^error:Address limit reached/);
  });

  it("is not executable by anon", async () => {
    expect(await runAs(db, anon, save(null))).toMatch(/^error:permission denied/);
    expect(await runAs(db, anon, `select public.account_delete_address('${otherAddressId}')`)).toMatch(/^error:permission denied/);
    expect(await runAs(db, anon, `select public.account_set_default_address('${otherAddressId}')`)).toMatch(/^error:permission denied/);
  });
});

describe("account_set_default_address / account_delete_address", () => {
  const ID_OF = (label: string) =>
    `(select id from customer_addresses where user_id = public.current_profile_id() and label = '${label}')`;

  it("switches the default to the chosen address", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save(null, { label: "Home" }),
      save(null, { label: "Work" }),
      `select public.account_set_default_address(${ID_OF("Work")})`,
      DEFAULTS,
    ]);
    expect(outcomes[3]).toEqual(["Work"]);
  });

  it("promotes the newest remaining address when the default is deleted", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save(null, { label: "Home" }),
      save(null, { label: "Work" }),
      save(null, { label: "Office" }),
      `select public.account_delete_address(${ID_OF("Home")})`,
      DEFAULTS,
      COUNT,
    ]);
    // Same-transaction rows share created_at; the id breaks the tie, so check
    // only that exactly one of the remaining two became the default.
    expect(outcomes[4]).toHaveLength(1);
    expect(["Work", "Office"]).toContain((outcomes[4] as string[])[0]);
    expect(outcomes[5]).toBe(2);
  });

  it("deleting a non-default address leaves the default alone", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      save(null, { label: "Home" }),
      save(null, { label: "Work" }),
      `select public.account_delete_address(${ID_OF("Work")})`,
      DEFAULTS,
    ]);
    expect(outcomes[3]).toEqual(["Home"]);
  });

  it("can't touch another customer's address", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      `select public.account_set_default_address('${otherAddressId}')`,
    ]);
    expect(outcomes[0]).toMatch(/^error:Address not found/);
    const deleted = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [`select public.account_delete_address('${otherAddressId}')`]);
    expect(deleted[0]).toMatch(/^error:Address not found/);
    expect(await runAs(db, as(otherClerkId), `select count(*)::integer from customer_addresses where id = '${otherAddressId}'`)).toBe(1);
  });

  it("lets staff with customers.read read, but not change, a customer's address", async () => {
    expect(await runAs(db, supportStaff, `select count(*)::integer from customer_addresses where id = '${otherAddressId}'`)).toBe(1);
    expect(await runAs(db, supportStaff, `select public.account_delete_address('${otherAddressId}')`)).toMatch(/^error:Address not found/);
    expect(await runAs(db, supportStaff, `update customer_addresses set label = 'X' where id = '${otherAddressId}'`)).toBe("affected:0");
  });
});

describe("wishlist_items", () => {
  const insert = (productId: string, userSql = "public.current_profile_id()") =>
    `insert into wishlist_items (user_id, product_id) values (${userSql}, '${productId}')`;

  it("rejects a duplicate save and a save for another profile", async () => {
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [insert(activeProductIds[0]!), insert(activeProductIds[0]!)]);
    expect(outcomes[1]).toMatch(/^error:duplicate key/);
    const [otherProfile] = await runStepsWithSetup(db, [CREATE_NEW_USER], newUser, [
      insert(activeProductIds[0]!, `(select id from profiles where clerk_user_id = '${otherClerkId}')`),
    ]);
    expect(otherProfile).toMatch(/^error:new row violates row-level security/);
  });

  it("stops at 200 items", async () => {
    // The seed has fewer than 200 products, so the rolled-back setup drops the
    // unique constraint and fills the cap with one product repeated.
    const fill = [
      "alter table wishlist_items drop constraint wishlist_items_user_id_product_id_key",
      `insert into wishlist_items (user_id, product_id)
       select (select id from profiles where clerk_user_id = '${NEW_USER}'), '${activeProductIds[0]}'
       from generate_series(1, 199)`,
    ];
    const outcomes = await runStepsWithSetup(db, [CREATE_NEW_USER, ...fill], newUser, [
      insert(activeProductIds[1]!),
      insert(activeProductIds[2]!),
    ]);
    expect(outcomes[0]).toBe("affected:1");
    expect(outcomes[1]).toMatch(/^error:Wishlist limit reached/);
  });

  it("is closed to anon", async () => {
    expect(await runAs(db, anon, "select count(*) from wishlist_items")).toMatch(/^error:permission denied/);
    expect(await runStepsAs(db, anon, [insert(activeProductIds[0]!, "gen_random_uuid()")])).toEqual([
      expect.stringMatching(/^error:permission denied/),
    ]);
  });
});
