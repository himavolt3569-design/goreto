// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Admin panel functions (migration admin_operations) per role: aggregates are
 * gated by permission and match raw SQL; operations follow the order state
 * machine, keep shipments and stock consistent, and respect RLS.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager"); // analytics.read, catalog, inventory, ar, content, promotions
const fulfilmentStaff = as("user_seed_staff_fulfilment"); // orders.read/write, inventory, delivery, customers, catalog.read
const supportStaff = as("user_seed_staff_support"); // orders.read, customers.read, reviews.manage, catalog.read
let customer: Session;

const SEP = "'2026-09-01'::date, '2026-09-30'::date";
const KPIS = `public.admin_dashboard_kpis(${SEP}, '2026-08-01'::date, '2026-08-31'::date)`;
const NPT_SEP = `created_at >= '2026-09-01T00:00:00+05:45' and created_at < '2026-10-01T00:00:00+05:45'`;

const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

let pendingOrderId = "";
let activeCourierId = "";

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  customer = as(await scalar<string>("select clerk_user_id from profiles where role = 'customer' and deleted_at is null order by id limit 1"));
  // Pending orders from the seed that have at least one variant-backed item.
  pendingOrderId = await scalar<string>(`
    select o.id from orders o
    where o.status = 'pending_confirmation'
      and exists (select 1 from order_items i where i.order_id = o.id and i.variant_id is not null)
    order by o.created_at desc limit 1`);
  activeCourierId = await scalar<string>("select id from couriers where is_active order by name limit 1");
}, 120_000);

describe("aggregate access", () => {
  it("is denied to anon, customers and staff without the permission", async () => {
    expect(await runAs(db, anon, `select ${KPIS}`)).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, `select ${KPIS}`)).toMatch(/analytics.read required/);
    expect(await runAs(db, fulfilmentStaff, `select ${KPIS}`)).toMatch(/analytics.read required/);
    expect(await runAs(db, fulfilmentStaff, `select count(*) from public.admin_revenue_series(${SEP}, 'day')`)).toMatch(/analytics.read/);
    expect(await runAs(db, supportStaff, `select public.admin_analytics_breakdown(${SEP})`)).toMatch(/analytics.read/);
    expect(await runAs(db, catalogStaff, "select count(*) from public.admin_customer_summaries(null, null, 20, 0)")).toMatch(/customers.read/);
    expect(await runAs(db, catalogStaff, `select count(*) from public.admin_payment_summary(${SEP})`)).toMatch(/orders.read/);
  });

  it("rejects invalid ranges and options", async () => {
    expect(await runAs(db, owner, "select public.admin_dashboard_kpis('2026-09-30', '2026-09-01', '2026-08-01', '2026-08-31')")).toMatch(/invalid date range/);
    expect(await runAs(db, owner, `select count(*) from public.admin_revenue_series(${SEP}, 'week')`)).toMatch(/bucket/);
    expect(await runAs(db, owner, "select count(*) from public.admin_customer_summaries(null, 'drop', 20, 0)")).toMatch(/invalid sort/);
  });
});

describe("dashboard KPIs", () => {
  it("match raw SQL for September 2026 (Kathmandu days)", async () => {
    const kpis = (await runAs(db, catalogStaff, `select ${KPIS}`)) as {
      current: Record<string, number>;
      previous: Record<string, number>;
      daily: { day: string; sales_paisa: number; orders: number }[];
    };
    const sales = await scalar<number>(
      `select coalesce(sum(total_paisa), 0)::bigint from orders where ${NPT_SEP} and status <> 'canceled' and payment_status <> 'refunded'`,
    );
    const orders = await scalar<number>(`select count(*)::int from orders where ${NPT_SEP}`);
    expect(Number(kpis.current.sales_paisa)).toBe(Number(sales));
    expect(kpis.current.orders).toBe(orders);
    expect(kpis.current.active_products).toBe(await scalar<number>("select count(*)::int from products where status = 'active'"));
    expect(kpis.current.customers).toBe(
      await scalar<number>("select count(*)::int from profiles where role = 'customer' and deleted_at is null and created_at < now()"),
    );
    expect(kpis.previous.orders).toBe(
      await scalar<number>("select count(*)::int from orders where created_at >= '2026-08-01T00:00:00+05:45' and created_at < '2026-09-01T00:00:00+05:45'"),
    );
    // The daily series stops at today and adds up to the period totals.
    expect(kpis.daily[0]!.day).toBe("2026-09-01");
    expect(kpis.daily.reduce((sum, day) => sum + day.orders, 0)).toBe(orders);
    expect(kpis.daily.reduce((sum, day) => sum + Number(day.sales_paisa), 0)).toBe(Number(sales));
  });

  it("revenue series and breakdown agree with the KPIs", async () => {
    const bucketCount = await runAs(db, owner, `select count(*)::int from public.admin_revenue_series(${SEP}, 'day')`);
    expect(bucketCount).toBe(30);
    const seriesSales = await runAs(db, owner, `select sum(sales_paisa)::bigint from public.admin_revenue_series(${SEP}, 'day')`);
    const breakdown = (await runAs(db, owner, `select public.admin_analytics_breakdown(${SEP})`)) as {
      sales_paisa: number;
      top_products: unknown[];
      status_counts: { count: number }[];
      order_count: number;
    };
    const kpis = (await runAs(db, owner, `select ${KPIS}`)) as { current: { sales_paisa: number } };
    expect(Number(seriesSales)).toBe(Number(kpis.current.sales_paisa));
    expect(Number(breakdown.sales_paisa)).toBe(Number(kpis.current.sales_paisa));
    expect(breakdown.top_products.length).toBeLessThanOrEqual(10);
    expect(breakdown.status_counts.reduce((sum, row) => sum + row.count, 0)).toBe(breakdown.order_count);
    expect(await runAs(db, owner, "select count(*)::int from public.admin_revenue_series('2025-10-01', '2026-09-30', 'month')")).toBe(12);
  });
});

describe("customer summaries", () => {
  it("bill only collected COD and page correctly", async () => {
    const top = (await runStepsAs(db, supportStaff, [
      "select row_to_json(s) from public.admin_customer_summaries(null, 'billed', 1, 0) s",
    ]))[0] as { id: string; billed_paisa: number; total_count: number };
    const billed = await scalar<number>(
      `select coalesce(sum(total_paisa), 0)::bigint from orders where user_id = '${top.id}' and payment_status = 'collected'`,
    );
    expect(Number(top.billed_paisa)).toBe(Number(billed));
    expect(Number(top.total_count)).toBe(
      await scalar<number>("select count(*)::int from profiles where role = 'customer' and deleted_at is null"),
    );
    expect(await runAs(db, supportStaff, "select count(*)::int from public.admin_customer_summaries(null, null, 500, 0)")).toBe(100);
  });

  it("treats search wildcards literally", async () => {
    expect(await runAs(db, supportStaff, "select count(*)::int from public.admin_customer_summaries('%', null, 20, 0)")).toBe(0);
    expect(await runAs(db, supportStaff, "select count(*)::int from public.admin_customer_summaries('example', null, 20, 0)")).toBeGreaterThan(0);
  });
});

describe("attention counts", () => {
  it("are zero without permission and match raw counts for the owner", async () => {
    expect(await runAs(db, customer, "select row_to_json(c)::text from public.admin_attention_counts() c")).toBe(
      '{"pending_orders":0,"pending_reviews":0,"low_stock_variants":0,"sold_out_variants":0}',
    );
    expect(await runAs(db, owner, "select pending_orders from public.admin_attention_counts()")).toBe(
      await scalar<number>("select count(*)::int from orders where status = 'pending_confirmation'"),
    );
    expect(await runAs(db, owner, "select pending_reviews from public.admin_attention_counts()")).toBe(
      await scalar<number>("select count(*)::int from reviews where status = 'pending'"),
    );
  });
});

describe("order transitions", () => {
  it("runs the full fulfilment flow with shipment events and COD collection", async () => {
    const id = pendingOrderId;
    const outcomes = await runStepsAs(db, fulfilmentStaff, [
      `select public.admin_transition_order('${id}', 'confirmed', null)`,
      `select public.admin_transition_order('${id}', 'processing', null)`,
      `select public.admin_transition_order('${id}', 'packed', null)`,
      `select public.admin_assign_courier('${id}', '${activeCourierId}', 'pth-123456')`,
      `select public.admin_transition_order('${id}', 'shipped', null)`,
      `select public.admin_add_shipment_event('${id}', 'out_for_delivery', 'Out for delivery with a rider.', 'Baneshwor')`,
      `select public.admin_transition_order('${id}', 'delivered', null)`,
      `select status || '/' || payment_status || '/' || (payment_collected_at is not null) from orders where id = '${id}'`,
      `select s.status || '/' || s.tracking_number from shipments s where s.order_id = '${id}'`,
      `select string_agg(e.status::text, ',' order by e.occurred_at, e.created_at)
         from shipment_events e join shipments s on s.id = e.shipment_id
        where s.order_id = '${id}' and e.source = 'staff'`,
      `select count(*)::int from shipment_events e join shipments s on s.id = e.shipment_id
        where s.order_id = '${id}' and e.latitude is not null`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[7]).toBe("delivered/collected/true");
    expect(outcomes[8]).toBe("delivered/PTH-123456");
    expect(outcomes[9]).toBe("assigned,picked_up,out_for_delivery,delivered");
    expect(outcomes[10]).toBe(0);
  });

  it("rejects skipped steps, shipping without a courier, and unauthorised staff", async () => {
    const id = pendingOrderId;
    expect(await runAs(db, fulfilmentStaff, `select public.admin_transition_order('${id}', 'delivered', null)`)).toMatch(
      /cannot be moved to delivered/,
    );
    const noCourier = await runStepsAs(db, fulfilmentStaff, [
      `update shipments set courier_id = null where order_id = '${id}'`,
      `select public.admin_transition_order('${id}', 'confirmed', null)`,
      `select public.admin_transition_order('${id}', 'processing', null)`,
      `select public.admin_transition_order('${id}', 'packed', null)`,
      `select public.admin_transition_order('${id}', 'shipped', null)`,
    ]);
    expect(noCourier.at(-1)).toMatch(/Assign a courier/);
    expect(await runAs(db, catalogStaff, `select public.admin_transition_order('${id}', 'confirmed', null)`)).toMatch(/orders.write required/);
    expect(await runAs(db, supportStaff, `select public.admin_assign_courier('${id}', '${activeCourierId}', null)`)).toMatch(/orders.write required/);
    expect(await runAs(db, fulfilmentStaff, `select public.admin_add_shipment_event('${id}', 'in_transit', 'Moving', null)`)).toMatch(
      /only while the order is shipped/,
    );
  });

  it("requires a reason to cancel, restocks the variants and fails the payment", async () => {
    const id = pendingOrderId;
    expect(await runAs(db, fulfilmentStaff, `select public.admin_transition_order('${id}', 'canceled', '  ')`)).toMatch(/reason/);

    const stockSql = `select coalesce(sum(v.stock_quantity), 0)::int from product_variants v
      where v.id in (select variant_id from order_items where order_id = '${id}')`;
    const quantity = await scalar<number>(
      `select sum(quantity)::int from order_items where order_id = '${id}' and variant_id is not null`,
    );
    const [before, , after, payment] = await runStepsAs(db, fulfilmentStaff, [
      stockSql,
      `select public.admin_transition_order('${id}', 'canceled', 'Customer asked to cancel')`,
      stockSql,
      `select payment_status::text || '/' || cancellation_reason from orders where id = '${id}'`,
    ]);
    expect((after as number) - (before as number)).toBe(quantity);
    expect(payment).toBe("failed/Customer asked to cancel");
  });

  it("marks a return when a shipped order is canceled", async () => {
    const shippedId = await scalar<string>("select id from orders where status = 'shipped' order by created_at limit 1");
    const outcomes = await runStepsAs(db, owner, [
      `select public.admin_transition_order('${shippedId}', 'canceled', 'Customer unreachable')`,
      `select status::text from shipments where order_id = '${shippedId}'`,
    ]);
    expect(outcomes).toEqual(["canceled", "returned"]);
  });

  it("refunds only delivered orders with collected payment", async () => {
    const collectedId = await scalar<string>("select id from orders where status = 'delivered' and payment_status = 'collected' limit 1");
    const outcomes = await runStepsAs(db, fulfilmentStaff, [
      `select public.admin_mark_refunded('${collectedId}')`,
      `select payment_status::text || '/' || (refunded_at is not null) from orders where id = '${collectedId}'`,
      `select public.admin_mark_refunded('${collectedId}')`,
    ]);
    expect(outcomes[1]).toBe("refunded/true");
    expect(outcomes[2]).toMatch(/Only delivered orders with collected payment/);
    expect(await runAs(db, supportStaff, `select public.admin_mark_refunded('${collectedId}')`)).toMatch(/orders.write required/);
  });
});

describe("stock and product status", () => {
  it("adjusts stock atomically and never below zero", async () => {
    const variantId = await scalar<string>("select id from product_variants where stock_quantity >= 2 order by sku limit 1");
    const stock = await scalar<number>(`select stock_quantity from product_variants where id = '${variantId}'`);
    const outcomes = await runStepsAs(db, fulfilmentStaff, [
      `select public.admin_adjust_stock('${variantId}', 5)`,
      `select public.admin_adjust_stock('${variantId}', -${stock + 4})`,
      // Two sequential -1s on stock 1: the second must fail, like a concurrent race.
      `select public.admin_adjust_stock('${variantId}', -1)`,
      `select public.admin_adjust_stock('${variantId}', -1)`,
    ]);
    expect(outcomes.slice(0, 3)).toEqual([stock + 5, 1, 0]);
    expect(outcomes[3]).toMatch(/below zero/);
    expect(await runAs(db, fulfilmentStaff, `select public.admin_adjust_stock('${variantId}', 0)`)).toMatch(/not 0/);
    expect(await runAs(db, supportStaff, `select public.admin_adjust_stock('${variantId}', 1)`)).toMatch(/inventory.write required/);
    expect(await runAs(db, customer, `select public.admin_adjust_stock('${variantId}', 1)`)).toMatch(/inventory.write required/);
  });

  it("sets publish and archive timestamps with the status", async () => {
    const draftId = await scalar<string>("select id from products where status = 'draft' limit 1");
    const outcomes = await runStepsAs(db, catalogStaff, [
      `select public.admin_set_product_status('${draftId}', 'active')`,
      `select (published_at is not null) and archived_at is null from products where id = '${draftId}'`,
      `select public.admin_set_product_status('${draftId}', 'archived')`,
      `select archived_at is not null from products where id = '${draftId}'`,
    ]);
    expect(outcomes).toEqual(["active", true, "archived", true]);
    expect(await runAs(db, fulfilmentStaff, `select public.admin_set_product_status('${draftId}', 'active')`)).toMatch(/catalog.write required/);
  });
});

describe("admin_inventory view", () => {
  it("applies the caller's RLS and agrees with the attention counts", async () => {
    expect(await runAs(db, anon, "select count(*) from admin_inventory")).toMatch(/^error:permission denied/);
    expect(await runAs(db, owner, "select count(*)::int from admin_inventory")).toBe(
      await scalar<number>("select count(*)::int from product_variants"),
    );
    expect(await runAs(db, customer, "select count(*)::int from admin_inventory where product_status <> 'active'")).toBe(0);
    expect(
      await runAs(db, owner, "select count(*)::int from admin_inventory where stock_state = 'low_stock' and product_status = 'active' and variant_active"),
    ).toBe(await runAs(db, owner, "select low_stock_variants from public.admin_attention_counts()"));
  });
});

describe("manager read policies", () => {
  const setupStaff = (permission: string) => [
    "insert into profiles (clerk_user_id, role) values ('user_test_manager', 'staff')",
    `insert into staff_permissions (profile_id, permission_key)
       select id, '${permission}' from profiles where clerk_user_id = 'user_test_manager'`,
    "update product_ar_assets set is_active = false where id = (select id from product_ar_assets order by id limit 1)",
    "update collections set is_active = false where id = (select id from collections order by id limit 1)",
  ];
  const manager = as("user_test_manager");

  it("let ar.manage staff see inactive AR assets", async () => {
    const [visible] = await runStepsWithSetup(db, setupStaff("ar.manage"), manager, [
      "select count(*)::int from product_ar_assets where not is_active",
    ]);
    expect(visible).toBeGreaterThan(0);
  });

  it("let content.manage staff see inactive collections", async () => {
    const [visible] = await runStepsWithSetup(db, setupStaff("content.manage"), manager, [
      "select count(*)::int from collections where not is_active",
    ]);
    expect(visible).toBeGreaterThan(0);
  });

  it("still hide inactive AR assets from other staff", async () => {
    const [visible] = await runStepsWithSetup(db, setupStaff("reviews.manage"), manager, [
      "select count(*)::int from product_ar_assets where not is_active",
    ]);
    expect(visible).toBe(0);
  });
});
