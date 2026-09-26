// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, type Session } from "./harness";

/*
 * Admin phase 3 (migration admin_coupons_delivery): one zone per district,
 * coupon code/type lock and delete protection, courier and service delete
 * protection, and the history-count functions. Every test runs in a
 * rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const promotionsStaff = as("user_seed_staff_catalog_manager"); // promotions.manage, no delivery.manage
const deliveryStaff = as("user_seed_staff_fulfilment"); // delivery.manage, no promotions.manage
let customer: Session;

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

let usedCouponId = "";
let usedServiceId = "";
let usedCourierId = "";
let valleyZoneId = "";

const insertCoupon = (code: string) =>
  `insert into coupons (code, type, percent_off, starts_at) values ('${code}', 'percentage', 10, now())`;
const insertCourier = "insert into couriers (name, slug) values ('Test Courier', 'test-courier')";
const insertService = `insert into courier_services (courier_id, name, service_code, service_level, estimated_min_days, estimated_max_days)
  select id, 'Test Standard', 'TST-STD', 'standard', 2, 4 from couriers where slug = 'test-courier'`;

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  customer = as(await scalar<string>("select clerk_user_id from profiles where role = 'customer' and deleted_at is null order by id limit 1"));
  usedCouponId = await scalar<string>("select coupon_id from orders where coupon_id is not null limit 1");
  usedServiceId = await scalar<string>("select courier_service_id from orders where courier_service_id is not null limit 1");
  usedCourierId = await scalar<string>("select courier_id from shipments where courier_id is not null limit 1");
  valleyZoneId = await scalar<string>("select id from delivery_zones where slug = 'kathmandu-valley'");
}, 120_000);

describe("one delivery zone per district", () => {
  it("refuses a district that already belongs to another zone", async () => {
    const outcome = await runAs(db, owner, "insert into delivery_zones (name, slug, district_codes) values ('Test', 'test-zone', '{kathmandu}')");
    expect(outcome).toMatch(/Already in another zone: Kathmandu \(in Kathmandu Valley\)/);
  });

  it("refuses the same on update", async () => {
    const outcome = await runAs(db, owner, "update delivery_zones set district_codes = district_codes || '{kaski}' where slug = 'kathmandu-valley'");
    expect(outcome).toMatch(/Already in another zone: Kaski/);
  });

  it("refuses unknown district codes", async () => {
    const outcome = await runAs(db, owner, "insert into delivery_zones (name, slug, district_codes) values ('Test', 'test-zone', '{atlantis}')");
    expect(outcome).toMatch(/Unknown district: atlantis/);
  });

  it("allows moving a district after removing it from its zone, and stores codes sorted without duplicates", async () => {
    const moved = await runStepsAs(db, deliveryStaff, [
      "update delivery_zones set district_codes = array_remove(district_codes, 'mustang') where slug = 'remote-himalayan'",
      "insert into delivery_zones (name, slug, district_codes) values ('Test', 'test-zone', '{mustang,mustang}')",
      "select district_codes::text from delivery_zones where slug = 'test-zone'",
    ]);
    expect(moved.at(-1)).toBe("{mustang}");
  });

  it("lets a zone keep its own districts when saved again", async () => {
    const outcome = await runAs(db, owner, `update delivery_zones set name = 'Valley', district_codes = district_codes where id = '${valleyZoneId}'`);
    expect(outcome).toBe("affected:1");
  });

  it("is still guarded by RLS for staff without delivery.manage", async () => {
    const outcome = await runAs(db, promotionsStaff, "insert into delivery_zones (name, slug) values ('Test', 'test-zone')");
    expect(outcome).toMatch(/row-level security/);
  });
});

describe("coupon history", () => {
  it("locks the code and type of a coupon that orders used", async () => {
    expect(await runAs(db, promotionsStaff, `update coupons set code = 'RENAMED' where id = '${usedCouponId}'`)).toMatch(/can't change/);
    expect(await runAs(db, owner, `update coupons set type = 'fixed', percent_off = null, amount_off_paisa = 1000 where id = '${usedCouponId}'`)).toMatch(/can't change/);
  });

  it("still allows other edits to a used coupon", async () => {
    expect(await runAs(db, promotionsStaff, `update coupons set description = 'Updated', usage_limit = 9999 where id = '${usedCouponId}'`)).toBe("affected:1");
  });

  it("refuses deleting a used coupon", async () => {
    expect(await runAs(db, owner, `delete from coupons where id = '${usedCouponId}'`)).toMatch(/can't be deleted/);
  });

  it("allows editing and deleting an unused coupon", async () => {
    const outcomes = await runStepsAs(db, promotionsStaff, [
      insertCoupon("TESTUNUSED"),
      "update coupons set code = 'TESTRENAMED', type = 'fixed', percent_off = null, amount_off_paisa = 5000 where code = 'TESTUNUSED'",
      "delete from coupons where code = 'TESTRENAMED'",
    ]);
    expect(outcomes).toEqual(["affected:1", "affected:1", "affected:1"]);
  });

  it("is refused to staff without promotions.manage", async () => {
    expect(await runAs(db, deliveryStaff, insertCoupon("TESTDENIED"))).toMatch(/row-level security/);
  });
});

describe("courier and service history", () => {
  it("refuses deleting a service that orders used", async () => {
    expect(await runAs(db, owner, `delete from courier_services where id = '${usedServiceId}'`)).toMatch(/can't be deleted/);
  });

  it("deletes an unused service together with its rates", async () => {
    const outcomes = await runStepsAs(db, deliveryStaff, [
      insertCourier,
      insertService,
      `insert into delivery_rates (zone_id, courier_service_id, price_paisa) select '${valleyZoneId}', id, 15000 from courier_services where service_code = 'TST-STD'`,
      "delete from courier_services where service_code = 'TST-STD'",
      "select count(*)::int from delivery_rates r join delivery_zones z on z.id = r.zone_id where r.price_paisa = 15000 and z.slug = 'kathmandu-valley' and not exists (select 1 from courier_services s where s.id = r.courier_service_id)",
    ]);
    expect(outcomes.slice(0, 4)).toEqual(["affected:1", "affected:1", "affected:1", "affected:1"]);
    expect(outcomes.at(-1)).toBe(0);
  });

  it("refuses deleting a courier that still has services", async () => {
    const outcomes = await runStepsAs(db, owner, [insertCourier, insertService, "delete from couriers where slug = 'test-courier'"]);
    expect(outcomes.at(-1)).toMatch(/still has services/);
  });

  it("refuses deleting a courier with shipments", async () => {
    const outcomes = await runStepsAs(db, owner, [
      insertCourier,
      "update shipments set courier_id = (select id from couriers where slug = 'test-courier') where id = (select id from shipments order by id limit 1)",
      "delete from couriers where slug = 'test-courier'",
    ]);
    expect(outcomes.at(-1)).toMatch(/Shipments were assigned/);
  });

  it("deletes an unused courier without services", async () => {
    const outcomes = await runStepsAs(db, deliveryStaff, [insertCourier, "delete from couriers where slug = 'test-courier'"]);
    expect(outcomes).toEqual(["affected:1", "affected:1"]);
  });

  it("keeps rate pairs unique", async () => {
    const outcomes = await runStepsAs(db, owner, [
      `insert into delivery_rates (zone_id, courier_service_id, price_paisa)
         select zone_id, courier_service_id, 1 from delivery_rates limit 1`,
    ]);
    expect(outcomes.at(-1)).toMatch(/duplicate key/);
  });
});

describe("history count functions", () => {
  it("counts coupon orders for promotions.manage only", async () => {
    const count = await runAs(db, promotionsStaff, `select order_count::int from public.admin_coupon_order_counts() where coupon_id = '${usedCouponId}'`);
    expect(count).toBeGreaterThan(0);
    expect(await runAs(db, deliveryStaff, "select count(*) from public.admin_coupon_order_counts()")).toMatch(/promotions.manage required/);
    expect(await runAs(db, customer, "select count(*) from public.admin_coupon_order_counts()")).toMatch(/promotions.manage required/);
    expect(await runAs(db, anon, "select count(*) from public.admin_coupon_order_counts()")).toMatch(/^error:permission denied/);
  });

  it("counts service and courier use for delivery.manage only", async () => {
    const service = await runAs(
      db,
      deliveryStaff,
      `select use_count::int from public.admin_delivery_history_counts() where record_type = 'courier_service' and record_id = '${usedServiceId}'`,
    );
    expect(service).toBeGreaterThan(0);
    const courier = await runAs(
      db,
      deliveryStaff,
      `select use_count::int from public.admin_delivery_history_counts() where record_type = 'courier' and record_id = '${usedCourierId}'`,
    );
    expect(courier).toBeGreaterThan(0);
    expect(await runAs(db, promotionsStaff, "select count(*) from public.admin_delivery_history_counts()")).toMatch(/delivery.manage required/);
    expect(await runAs(db, anon, "select count(*) from public.admin_delivery_history_counts()")).toMatch(/^error:permission denied/);
  });
});
