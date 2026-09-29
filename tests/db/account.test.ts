// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Customer account reads (migration account_reads): each signed-in user sees
 * only their own order figures and shipment events, even when their role could
 * read every order. Every call runs in a rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const fulfilmentStaff = as("user_seed_staff_fulfilment"); // orders.read/write

let customerClerkId = "";
let customerId = "";
let otherOrderNumber = "";

const SUMMARY = "select row_to_json(s) from public.account_summary() s";

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

type Summary = {
  order_count: number;
  in_progress_count: number;
  billed_paisa: number;
  billed_order_count: number;
  pending_paisa: number;
  pending_order_count: number;
};

/** The same figures computed directly as the superuser, for comparison. */
function expectedSummarySql(profileId: string): string {
  return `select json_build_object(
      'order_count', count(*),
      'in_progress_count', count(*) filter (where status not in ('delivered', 'canceled')),
      'billed_paisa', coalesce(sum(total_paisa) filter (where payment_status = 'collected'), 0),
      'billed_order_count', count(*) filter (where payment_status = 'collected'),
      'pending_paisa', coalesce(sum(total_paisa) filter (where payment_status = 'pending' and status <> 'canceled'), 0),
      'pending_order_count', count(*) filter (where payment_status = 'pending' and status <> 'canceled')
    ) from public.orders where user_id = '${profileId}'`;
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  // A customer with a mix of delivered and live orders.
  const row = await db.query<{ clerk_user_id: string; id: string }>(`
    select p.clerk_user_id, p.id from profiles p
    where p.role = 'customer' and p.deleted_at is null
      and exists (select 1 from orders o where o.user_id = p.id and o.payment_status = 'collected')
      and exists (select 1 from orders o where o.user_id = p.id and o.status not in ('delivered', 'canceled'))
    order by p.id limit 1`);
  customerClerkId = row.rows[0]!.clerk_user_id;
  customerId = row.rows[0]!.id;
  otherOrderNumber = await scalar<string>(
    `select order_number from orders where user_id is not null and user_id <> '${customerId}' order by created_at desc limit 1`,
  );
}, 120_000);

describe("account_summary", () => {
  it("matches the customer's own orders exactly", async () => {
    const expected = await scalar<Summary>(expectedSummarySql(customerId));
    const actual = (await runAs(db, as(customerClerkId), SUMMARY)) as Summary;
    expect(actual).toEqual(expected);
    expect(actual.order_count).toBeGreaterThan(0);
    expect(actual.billed_paisa).toBeGreaterThan(0);
  });

  it("gives staff with orders.read only their own figures, not the store's", async () => {
    const staffId = await scalar<string>("select id from profiles where clerk_user_id = 'user_seed_staff_fulfilment'");
    const expected = await scalar<Summary>(expectedSummarySql(staffId));
    const actual = (await runAs(db, fulfilmentStaff, SUMMARY)) as Summary;
    const storeCount = await scalar<number>("select count(*)::integer from orders");
    expect(actual).toEqual(expected);
    expect(actual.order_count).toBeLessThan(storeCount);
  });

  it("returns zeros for a profile with no orders", async () => {
    const [actual] = await runStepsWithSetup(
      db,
      ["insert into profiles (clerk_user_id) values ('user_test_new_customer')"],
      as("user_test_new_customer"),
      [SUMMARY],
    );
    expect(actual).toEqual({
      order_count: 0,
      in_progress_count: 0,
      billed_paisa: 0,
      billed_order_count: 0,
      pending_paisa: 0,
      pending_order_count: 0,
    });
  });

  it("drops a refunded order from billed and a canceled one from pending", async () => {
    const before = (await runAs(db, as(customerClerkId), SUMMARY)) as Summary;
    const collected = await db.query<{ id: string; total_paisa: number }>(
      `select id, total_paisa::integer from orders where user_id = '${customerId}' and payment_status = 'collected' order by created_at limit 1`,
    );
    const pending = await db.query<{ id: string; total_paisa: number }>(
      `select id, total_paisa::integer from orders
       where user_id = '${customerId}' and payment_status = 'pending' and status <> 'canceled' order by created_at limit 1`,
    );
    const refundedOrder = collected.rows[0]!;
    const setup = [
      `update orders set payment_status = 'refunded', refunded_at = now() where id = '${refundedOrder.id}'`,
      ...(pending.rows[0]
        ? [`update orders set status = 'canceled', canceled_at = now() where id = '${pending.rows[0].id}'`]
        : []),
    ];
    const [after] = (await runStepsWithSetup(db, setup, as(customerClerkId), [SUMMARY])) as Summary[];

    expect(after!.billed_paisa).toBe(before.billed_paisa - refundedOrder.total_paisa);
    expect(after!.billed_order_count).toBe(before.billed_order_count - 1);
    if (pending.rows[0]) {
      expect(after!.pending_paisa).toBe(before.pending_paisa - pending.rows[0].total_paisa);
      expect(after!.in_progress_count).toBe(before.in_progress_count - 1);
    }
  });

  it("is not executable by anon", async () => {
    expect(await runAs(db, anon, SUMMARY)).toMatch(/^error:permission denied/);
  });
});

describe("account_tracking_events", () => {
  const EVENTS = (limit: number | null) =>
    `select coalesce(json_agg(row_to_json(e)), '[]'::json) from public.account_tracking_events(${limit ?? "default"}) e`;

  it("returns only the caller's events, newest first", async () => {
    type Event = { order_number: string; occurred_at: string };
    const events = (await runAs(db, as(customerClerkId), EVENTS(100))) as Event[];
    const ownNumbers = new Set(
      (await db.query<{ order_number: string }>(`select order_number from orders where user_id = '${customerId}'`)).rows.map(
        (row) => row.order_number,
      ),
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => ownNumbers.has(event.order_number))).toBe(true);
    const times = events.map((event) => new Date(event.occurred_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("gives staff with orders.read none of the store's events", async () => {
    const staffEvents = (await runAs(db, fulfilmentStaff, EVENTS(100))) as unknown[];
    const staffId = await scalar<string>("select id from profiles where clerk_user_id = 'user_seed_staff_fulfilment'");
    const own = await scalar<number>(`
      select count(*)::integer from shipment_events e
      join shipments s on s.id = e.shipment_id
      join orders o on o.id = s.order_id
      where o.user_id = '${staffId}'`);
    expect(staffEvents.length).toBe(Math.min(own, 100));
  });

  it("clamps the limit to 1–100", async () => {
    expect(((await runAs(db, as(customerClerkId), EVENTS(0))) as unknown[]).length).toBe(1);
    expect(((await runAs(db, as(customerClerkId), EVENTS(5000))) as unknown[]).length).toBeLessThanOrEqual(100);
  });

  it("is not executable by anon", async () => {
    expect(await runAs(db, anon, EVENTS(10))).toMatch(/^error:permission denied/);
  });
});

describe("order detail without a tracking secret", () => {
  it("returns the caller's own order", async () => {
    const own = await scalar<string>(`select order_number from orders where user_id = '${customerId}' limit 1`);
    const result = await runAs(db, as(customerClerkId), `select public.get_order_tracking('${own}') ->> 'order_number'`);
    expect(result).toBe(own);
  });

  it("returns null for another customer's order", async () => {
    const result = await runAs(db, as(customerClerkId), `select public.get_order_tracking('${otherOrderNumber}') is null`);
    expect(result).toBe(true);
  });
});
