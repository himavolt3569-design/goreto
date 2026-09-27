// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * WhatsApp orders, acceptance, auto-accept, notifications and the courier
 * handoff (migration whatsapp_orders). Every test runs in a rolled-back
 * transaction. Steps can switch the signed-in user mid-transaction with
 * `signIn(...)`, or read as the superuser after `reset role`.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager"); // no orders permissions
const fulfilment = as("user_seed_staff_fulfilment"); // orders.read/write, customers.read
const support = as("user_seed_staff_support"); // orders.read, customers.read (no orders.write)
let customer: Session;
let customerProfileId = "";
let fulfilmentProfileId = "";

const signIn = (clerkUserId: string) =>
  `select set_config('request.jwt.claims', '${JSON.stringify({ sub: clerkUserId, role: "authenticated" })}', true)`;
const RESET = "reset role";

type Variant = { id: string; stock: number; price: number };
let variant: Variant;
let address: Record<string, unknown>;
let serviceId = "";
let servicePrice = 0;
let serviceCourierId = "";
let otherCourierId = "";
let pendingOrderId = "";

const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");
const sqlJson = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

async function rows<T>(sql: string): Promise<T[]> {
  return (await db.query(sql)).rows as T[];
}
async function scalar<T>(sql: string): Promise<T> {
  const [row] = await rows<Record<string, unknown>>(sql);
  return Object.values(row!)[0] as T;
}

const WHATSAPP_CONTACT = { name: "Sita Gurung", phone_e164: "+9779812345678" };
/** The one WhatsApp order a test creates (the seed has none). */
const LAST_WA = "(select id from orders where channel = 'whatsapp' order by created_at desc, id limit 1)";
const RECIPIENTS = `(select count(*)::int from profiles p where p.deleted_at is null and (p.role = 'owner'
  or (p.role = 'staff' and exists (select 1 from staff_permissions sp where sp.profile_id = p.id and sp.permission_key = 'orders.read'))))`;

function createOrder(options: { quantity?: number; contact?: Record<string, unknown>; customerId?: string | null; whatsapp?: string | null } = {}) {
  const customerId = options.customerId ? `'${options.customerId}'` : "null";
  const whatsapp = options.whatsapp === undefined ? "'+9779812345678'" : options.whatsapp === null ? "null" : `'${options.whatsapp}'`;
  return `select public.admin_create_order(
    ${sqlJson([{ variant_id: variant.id, quantity: options.quantity ?? 2 }])},
    ${sqlJson(options.contact ?? WHATSAPP_CONTACT)},
    ${sqlJson(address)},
    '${serviceId}', null, 'Call before coming', ${customerId}, ${whatsapp}
  ) ->> 'order_number'`;
}

function websiteOrder() {
  return `select public.place_order(
    ${sqlJson([{ variant_id: variant.id, quantity: 1 }])},
    ${sqlJson({ name: "Web Shopper", email: "web@example.com", phone_e164: "+9779841234567" })},
    ${sqlJson(address)},
    '${serviceId}', null, null, encode(sha256(convert_to('secret-0123456789abcdef', 'UTF8')), 'hex')
  ) ->> 'status'`;
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  const [first] = await rows<{ clerk_user_id: string; id: string }>(
    "select clerk_user_id, id from profiles where role = 'customer' and deleted_at is null order by id limit 1",
  );
  customer = as(first!.clerk_user_id);
  customerProfileId = first!.id;
  fulfilmentProfileId = await scalar<string>("select id from profiles where clerk_user_id = 'user_seed_staff_fulfilment'");

  [variant] = (await rows<Variant>(`
    select v.id, v.stock_quantity as stock, coalesce(v.price_paisa, p.base_price_paisa)::integer as price
    from product_variants v join products p on p.id = v.product_id
    where p.status = 'active' and v.is_active and v.stock_quantity >= 5
    order by v.id limit 1`)) as [Variant];

  const [place] = await rows<Record<string, string | number>>(`
    select m.code as municipality_code, d.code as district_code, d.province_code,
           r.courier_service_id as service_id, r.price_paisa::integer as price, cs.courier_id
    from delivery_zones z
    join nepal_districts d on d.code = any (z.district_codes)
    join nepal_municipalities m on m.district_code = d.code
    join delivery_rates r on r.zone_id = z.id and r.is_active
      and r.min_order_paisa is null and r.min_weight_grams is null and r.max_weight_grams is null
    join courier_services cs on cs.id = r.courier_service_id and cs.is_active
    join couriers c on c.id = cs.courier_id and c.is_active
    where z.is_active
    order by m.code, r.price_paisa limit 1`);
  address = {
    province_code: place!.province_code,
    district_code: place!.district_code,
    municipality_code: place!.municipality_code,
    ward: 1,
    street_landmark: "Lakeside, near the boat station",
    postal_code: null,
  };
  serviceId = String(place!.service_id);
  servicePrice = Number(place!.price);
  serviceCourierId = String(place!.courier_id);
  otherCourierId = await scalar<string>(`select id from couriers where is_active and id <> '${serviceCourierId}' order by name limit 1`);

  pendingOrderId = await scalar<string>(`
    select o.id from orders o
    join courier_services cs on cs.id = o.courier_service_id
    join couriers c on c.id = cs.courier_id and c.is_active
    where o.status = 'pending_confirmation'
      and exists (select 1 from order_items i where i.order_id = o.id and i.variant_id is not null)
    order by o.created_at desc limit 1`);
}, 120_000);

describe("admin_create_order (WhatsApp entry)", () => {
  it("creates a pending WhatsApp order priced by the database", async () => {
    const outcomes = await runStepsAs(db, fulfilment, [
      createOrder({ quantity: 2 }),
      `select concat_ws('/', status, channel, payment_method, whatsapp_e164, coalesce(contact_email, '-'), coalesce(user_id::text, '-'), created_by)
         from orders where id = ${LAST_WA}`,
      `select subtotal_paisa::int from orders where id = ${LAST_WA}`,
      `select total_paisa::int from orders where id = ${LAST_WA}`,
      `select stock_quantity from product_variants where id = '${variant.id}'`,
      `select count(*)::int from shipment_events e join shipments s on s.id = e.shipment_id where s.order_id = ${LAST_WA}`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[0]).toMatch(/^[A-Z]{2,4}[0-9]{12}$/);
    expect(outcomes[1]).toBe(`pending_confirmation/whatsapp/cod/+9779812345678/-/-/${fulfilmentProfileId}`);
    expect(outcomes[2]).toBe(variant.price * 2);
    expect(outcomes[3]).toBe(variant.price * 2 + servicePrice);
    expect(outcomes[4]).toBe(variant.stock - 2);
    expect(outcomes[5]).toBe(1);
  });

  it("takes no prices from the caller", async () => {
    const args = await scalar<string>(
      "select pg_get_function_arguments(p.oid) from pg_proc p where p.proname = 'admin_create_order'",
    );
    expect(args).not.toMatch(/price|total|fee|discount|paisa/);
  });

  it("needs orders.write", async () => {
    expect(await runAs(db, support, createOrder())).toMatch(/orders.write required/);
    expect(await runAs(db, catalogStaff, createOrder())).toMatch(/orders.write required/);
    expect(await runAs(db, customer, createOrder())).toMatch(/orders.write required/);
    expect(await runAs(db, anon, createOrder())).toMatch(/^error:permission denied/);
  });

  it("links an existing customer only with customers.read, and never the staff member", async () => {
    const linked = await runStepsAs(db, fulfilment, [
      createOrder({ customerId: customerProfileId }),
      `select user_id from orders where id = ${LAST_WA}`,
    ]);
    expect(linked[1]).toBe(customerProfileId);

    expect(await runAs(db, fulfilment, createOrder({ customerId: fulfilmentProfileId }))).toMatch(/customer account isn't available/);

    const writerOnly = await runStepsWithSetup(
      db,
      [
        `insert into profiles (id, clerk_user_id, role) values ('00000000-0000-4000-8000-00000000a001', 'user_test_writer', 'staff')`,
        `insert into staff_permissions (profile_id, permission_key) values
           ('00000000-0000-4000-8000-00000000a001', 'orders.read'), ('00000000-0000-4000-8000-00000000a001', 'orders.write')`,
      ],
      as("user_test_writer"),
      [createOrder(), createOrder({ customerId: customerProfileId })],
    );
    expect(writerOnly[0]).toMatch(/^[A-Z]/);
    expect(writerOnly[1]).toMatch(/customers.read required/);
  });

  it("validates the WhatsApp number and allows no email, but the storefront still needs one", async () => {
    expect(await runAs(db, fulfilment, createOrder({ whatsapp: "+14155550100" }))).toMatch(/checkout:invalid_contact/);
    expect(await runAs(db, fulfilment, createOrder({ whatsapp: null }))).toMatch(/^[A-Z]/);
    expect(await runAs(db, fulfilment, createOrder({ contact: { ...WHATSAPP_CONTACT, email: "nope" } }))).toMatch(/invalid_contact/);
    const noEmail = `select public.place_order(
      ${sqlJson([{ variant_id: variant.id, quantity: 1 }])},
      ${sqlJson({ name: "Web Shopper", phone_e164: "+9779841234567" })},
      ${sqlJson(address)}, '${serviceId}', null, null, encode(sha256(convert_to('secret-0123456789abcdef', 'UTF8')), 'hex'))`;
    expect(await runAs(db, anon, noEmail)).toMatch(/checkout:invalid_contact/);
  });

  it("quotes with the same maths, gated the same way", async () => {
    const quote = `select (public.admin_order_quote(${sqlJson([{ variant_id: variant.id, quantity: 3 }])},
      '${address.municipality_code}', '${serviceId}') ->> 'total_paisa')::int`;
    expect(await runAs(db, fulfilment, quote)).toBe(variant.price * 3 + servicePrice);
    expect(await runAs(db, support, quote)).toMatch(/orders.write required/);
  });
});

describe("notifications", () => {
  it("go to the owner and orders.read staff, one row each; seed inserts notify nobody", async () => {
    expect(await scalar<number>("select count(*)::int from notifications")).toBe(0);
    const outcomes = await runStepsAs(db, fulfilment, [
      createOrder(),
      RESET,
      `select count(*)::int from notifications where order_id = ${LAST_WA}`,
      RECIPIENTS,
      `select count(*)::int from notifications n join profiles p on p.id = n.recipient_id
        where n.order_id = ${LAST_WA} and p.clerk_user_id in ('user_seed_staff_catalog_manager')`,
      `select kind || '|' || title || '|' || href from notifications where order_id = ${LAST_WA} limit 1`,
    ]);
    expect(outcomes[2]).toBeGreaterThan(1);
    expect(outcomes[2]).toBe(outcomes[3]);
    expect(outcomes[4]).toBe(0);
    expect(outcomes[5]).toMatch(/^order_pending\|New WhatsApp order #[A-Z0-9]+\|\/admin\/orders\/[A-Z0-9]+$/);
  });

  it("are visible only to their recipient while they hold orders.read", async () => {
    const outcomes = await runStepsAs(db, fulfilment, [
      createOrder(),
      `select count(*)::int from notifications`,
      signIn("user_seed_staff_support"),
      `select count(*)::int from notifications`,
      `select count(*)::int from notifications n join profiles p on p.id = n.recipient_id where p.clerk_user_id <> 'user_seed_staff_support'`,
      signIn("user_seed_staff_catalog_manager"),
      `select count(*)::int from notifications`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes.slice(1)).toEqual([1, expect.anything(), 1, 0, expect.anything(), 0]);

    // A customer who somehow had a row still can't read it (no orders.read).
    const customerRead = await runStepsWithSetup(
      db,
      [`insert into notifications (recipient_id, kind, title, href) values ('${customerProfileId}', 'order_pending', 'x', '/admin')`],
      customer,
      ["select count(*)::int from notifications"],
    );
    expect(customerRead).toEqual([0]);
  });

  it("let recipients change only read_at, and never insert or delete", async () => {
    const outcomes = await runStepsAs(db, fulfilment, [
      createOrder(),
      signIn("user_seed_staff_support"),
      "update notifications set read_at = now()",
      "update notifications set title = 'changed'",
    ]);
    expect(outcomes[2]).toBe("affected:1");
    expect(outcomes[3]).toMatch(/^error:permission denied/);
    expect(await runAs(db, support, "insert into notifications (recipient_id, kind, title, href) values (public.current_profile_id(), 'order_pending', 'x', '/admin')")).toMatch(/^error:permission denied/);
    expect(await runAs(db, support, "delete from notifications")).toMatch(/^error:permission denied/);
  });

  it("are resolved for everyone when the order is accepted or rejected", async () => {
    const accepted = await runStepsAs(db, fulfilment, [
      createOrder(),
      `select public.admin_accept_order(${LAST_WA}, '${serviceCourierId}') ->> 'status'`,
      RESET,
      `select count(*)::int from notifications where order_id = ${LAST_WA} and read_at is null`,
    ]);
    expect(accepted[1]).toBe("confirmed");
    expect(accepted[3]).toBe(0);

    const rejected = await runStepsAs(db, fulfilment, [
      createOrder(),
      `select public.admin_transition_order(${LAST_WA}, 'canceled', 'Customer changed their mind')`,
      RESET,
      `select count(*)::int from notifications where order_id = ${LAST_WA} and read_at is null`,
      `select canceled_by from orders where id = ${LAST_WA}`,
    ]);
    expect(rejected[3]).toBe(0);
    expect(rejected[4]).toBe(fulfilmentProfileId);
  });
});

describe("admin_accept_order", () => {
  const acceptedState = (id: string) =>
    `select concat_ws('/', o.status, o.accepted_via, o.accepted_by, s.courier_id, s.status)
       from orders o join shipments s on s.order_id = o.id where o.id = ${id}`;

  it("manual mode needs a courier; accepting records who, when and the courier", async () => {
    expect(await runAs(db, fulfilment, `select public.admin_accept_order('${pendingOrderId}')`)).toMatch(/Choose a courier/);
    const outcomes = await runStepsAs(db, fulfilment, [
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}') ->> 'courier_id'`,
      acceptedState(`'${pendingOrderId}'`),
      `select (accepted_at is not null and confirmed_at is not null) from orders where id = '${pendingOrderId}'`,
      `select count(*)::int from courier_handoffs where order_id = '${pendingOrderId}' and status = 'pending'`,
    ]);
    expect(outcomes[0]).toBe(otherCourierId);
    expect(outcomes[1]).toBe(`confirmed/staff/${fulfilmentProfileId}/${otherCourierId}/assigned`);
    expect(outcomes[2]).toBe(true);
    expect(outcomes[3]).toBe(1);
  });

  it("auto mode uses the purchased service's courier, then the default courier", async () => {
    const auto = await runStepsWithSetup(db, ["update store_settings set courier_assignment_mode = 'auto'"], fulfilment, [
      `select public.admin_accept_preview('${pendingOrderId}') ->> 'source'`,
      `select public.admin_accept_order('${pendingOrderId}') ->> 'courier_id'`,
    ]);
    const purchasedCourier = await scalar<string>(
      `select cs.courier_id from orders o join courier_services cs on cs.id = o.courier_service_id where o.id = '${pendingOrderId}'`,
    );
    expect(auto).toEqual(["service", purchasedCourier]);

    const defaultCourier = await scalar<string>(`select name from couriers where is_active and id <> '${purchasedCourier}' order by name limit 1`);
    const fallback = await runStepsWithSetup(
      db,
      [
        "update store_settings set courier_assignment_mode = 'auto'",
        `update couriers set is_active = false where id = '${purchasedCourier}'`,
        `update store_settings set default_courier_id = (select id from couriers where is_active order by name limit 1)`,
      ],
      fulfilment,
      [`select public.admin_accept_preview('${pendingOrderId}') ->> 'source'`, `select public.admin_accept_order('${pendingOrderId}') ->> 'courier_name'`],
    );
    expect(fallback).toEqual(["default", defaultCourier]);

    const none = await runStepsWithSetup(
      db,
      ["update store_settings set courier_assignment_mode = 'auto', default_courier_id = null", `update couriers set is_active = false where id = '${purchasedCourier}'`],
      fulfilment,
      [`select public.admin_accept_order('${pendingOrderId}')`],
    );
    expect(none[0]).toMatch(/Choose a courier/);
  });

  it("refuses inactive couriers, canceled orders and staff without orders.write", async () => {
    const inactive = await runStepsWithSetup(db, [`update couriers set is_active = false where id = '${otherCourierId}'`], fulfilment, [
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}')`,
    ]);
    expect(inactive[0]).toMatch(/Choose an active courier/);
    const canceled = await runStepsAs(db, fulfilment, [
      `select public.admin_transition_order('${pendingOrderId}', 'canceled', 'Duplicate')`,
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}')`,
    ]);
    expect(canceled[1]).toMatch(/can't be accepted/);
    expect(await runAs(db, support, `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}')`)).toMatch(/orders.write required/);
    expect(await runAs(db, customer, `select public.admin_accept_preview('${pendingOrderId}')`)).toMatch(/orders.read required/);
  });

  it("is idempotent", async () => {
    const eventCount = `select count(*)::int from shipment_events e join shipments s on s.id = e.shipment_id where s.order_id = '${pendingOrderId}'`;
    const outcomes = await runStepsAs(db, fulfilment, [
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}') ->> 'already_accepted'`,
      eventCount,
      `select public.admin_accept_order('${pendingOrderId}', '${serviceCourierId}') ->> 'already_accepted'`,
      eventCount,
      `select courier_id from shipments where order_id = '${pendingOrderId}'`,
      `select count(*)::int from courier_handoffs where order_id = '${pendingOrderId}' and status <> 'superseded'`,
    ]);
    expect(outcomes[0]).toBe("false");
    expect(outcomes[2]).toBe("true");
    expect(outcomes[3]).toBe(outcomes[1]);
    expect(outcomes[4]).toBe(otherCourierId);
    expect(outcomes[5]).toBe(1);
  });
});

describe("courier handoff", () => {
  const record = (id: string) => `select (public.admin_record_courier_handoff('${id}') ->> 'attempts')::int`;
  const sentEvents = (id: string) =>
    `select count(*)::int from shipment_events e join shipments s on s.id = e.shipment_id
      where s.order_id = '${id}' and e.message like 'Order details sent to %'`;

  it("never reaches the courier before acceptance", async () => {
    expect(await runAs(db, fulfilment, record(pendingOrderId))).toMatch(/only after they are accepted/);
    const noCourier = await runStepsAs(db, fulfilment, [
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}')`,
      `update shipments set courier_id = null where order_id = '${pendingOrderId}'`,
      record(pendingOrderId),
    ]);
    expect(noCourier[2]).toMatch(/Assign a courier first/);
  });

  it("adds one tracking event on the first send; resends only count attempts", async () => {
    const outcomes = await runStepsAs(db, fulfilment, [
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}')`,
      record(pendingOrderId),
      record(pendingOrderId),
      sentEvents(pendingOrderId),
      `select concat_ws('/', status, attempts, last_sent_by, courier_id) from courier_handoffs where order_id = '${pendingOrderId}' and status <> 'superseded'`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes.slice(1, 4)).toEqual([1, 2, 1]);
    expect(outcomes[4]).toBe(`sent/2/${fulfilmentProfileId}/${otherCourierId}`);
    expect(await runAs(db, support, record(pendingOrderId))).toMatch(/orders.write required/);
  });

  it("starts over for a new courier after reassignment", async () => {
    const outcomes = await runStepsAs(db, fulfilment, [
      `select public.admin_accept_order('${pendingOrderId}', '${otherCourierId}')`,
      record(pendingOrderId),
      `select public.admin_assign_courier('${pendingOrderId}', '${serviceCourierId}', null)`,
      `select string_agg(status || ':' || attempts, ',' order by created_at, status desc) from courier_handoffs where order_id = '${pendingOrderId}'`,
      `select courier_id from courier_handoffs where order_id = '${pendingOrderId}' and status = 'pending'`,
    ]);
    expect(outcomes[3]).toMatch(/superseded:1/);
    expect(outcomes[3]).toMatch(/pending:0/);
    expect(outcomes[4]).toBe(serviceCourierId);
  });

  it("is readable by orders.read staff only", async () => {
    expect(await runAs(db, support, "select count(*)::int from courier_handoffs")).toBeGreaterThan(0);
    expect(await runAs(db, catalogStaff, "select count(*)::int from courier_handoffs")).toBe(0);
    expect(await runAs(db, customer, "select count(*)::int from courier_handoffs")).toBe(0);
    expect(await runAs(db, support, "insert into courier_handoffs (order_id, shipment_id) select order_id, id from shipments limit 1")).toMatch(
      /^error:permission denied/,
    );
  });
});

describe("auto-accept", () => {
  it("is off by default: orders wait for a person", async () => {
    expect(await runAs(db, fulfilment, `${createOrder().replace("->> 'order_number'", "->> 'status'")}`)).toBe("pending_confirmation");
    expect(await runAs(db, anon, websiteOrder())).toBe("pending_confirmation");
  });

  it("accepts WhatsApp orders with the automatic courier when switched on", async () => {
    const outcomes = await runStepsWithSetup(db, ["update store_settings set auto_accept_whatsapp_orders = true"], fulfilment, [
      createOrder(),
      `select concat_ws('/', o.status, o.accepted_via, coalesce(o.accepted_by::text, '-'), s.courier_id)
         from orders o join shipments s on s.order_id = o.id where o.id = ${LAST_WA}`,
      `select count(*)::int from courier_handoffs where order_id = ${LAST_WA} and status = 'pending'`,
      RESET,
      `select string_agg(distinct kind::text, ',') || '/' || count(*) filter (where read_at is null) from notifications where order_id = ${LAST_WA}`,
      RECIPIENTS,
      `select string_agg(e.status::text, ',' order by e.occurred_at) from shipment_events e join shipments s on s.id = e.shipment_id where s.order_id = ${LAST_WA}`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[1]).toBe(`confirmed/auto/-/${serviceCourierId}`);
    expect(outcomes[2]).toBe(1);
    expect(outcomes[4]).toBe(`order_auto_accepted/${outcomes[5]}`);
    expect(outcomes[6]).toBe("awaiting_assignment,assigned");

    // Website orders keep waiting while only the WhatsApp switch is on.
    const website = await runStepsWithSetup(db, ["update store_settings set auto_accept_whatsapp_orders = true"], anon, [websiteOrder()]);
    expect(website).toEqual(["pending_confirmation"]);
  });

  it("accepts storefront orders (even from guests) when the website switch is on", async () => {
    const outcomes = await runStepsWithSetup(db, ["update store_settings set auto_accept_website_orders = true"], anon, [
      websiteOrder(),
      RESET,
      "select accepted_via::text from orders where contact_email = 'web@example.com'",
    ]);
    expect(outcomes).toEqual(["confirmed", "affected:0", "auto"]);
  });

  it("clears the 'ready to send' notification on the first handoff, or on cancel", async () => {
    const unread = `select count(*)::int from notifications where order_id = ${LAST_WA} and read_at is null`;
    const sent = await runStepsWithSetup(db, ["update store_settings set auto_accept_whatsapp_orders = true"], fulfilment, [
      createOrder(),
      `select public.admin_record_courier_handoff(${LAST_WA})`,
      RESET,
      unread,
    ]);
    expect(sent[3]).toBe(0);
    const canceled = await runStepsWithSetup(db, ["update store_settings set auto_accept_whatsapp_orders = true"], fulfilment, [
      createOrder(),
      `select public.admin_transition_order(${LAST_WA}, 'canceled', 'Out of stock after all')`,
      RESET,
      unread,
    ]);
    expect(canceled[3]).toBe(0);
  });
});

describe("settings, staff names and grants", () => {
  it("only settings.manage can switch acceptance settings", async () => {
    const change = "update store_settings set auto_accept_website_orders = true, courier_assignment_mode = 'auto'";
    expect(await runAs(db, fulfilment, change)).toBe("affected:0");
    expect(await runAs(db, owner, change)).toBe("affected:1");
  });

  it("names staff for audit fields, never customers", async () => {
    const ids = `array['${fulfilmentProfileId}', '${customerProfileId}']::uuid[]`;
    expect(await runAs(db, support, `select string_agg(id::text, ',') from public.admin_staff_names(${ids})`)).toBe(fulfilmentProfileId);
    expect(await runAs(db, customer, `select count(*) from public.admin_staff_names(${ids})`)).toMatch(/admin access required/);
  });

  it("keeps the private functions private and admin functions away from anon", async () => {
    for (const call of [
      "select public.auto_courier_for_order(gen_random_uuid())",
      "select public.accept_order_core(gen_random_uuid(), gen_random_uuid(), 'staff', null)",
      "select public.notify_new_order(gen_random_uuid(), null)",
      "select public.admin_assert_linkable_customer(null)",
    ]) {
      expect(await runAs(db, owner, call)).toMatch(/^error:permission denied/);
    }
    for (const call of [
      `select public.admin_accept_order('${pendingOrderId}')`,
      `select public.admin_accept_preview('${pendingOrderId}')`,
      `select public.admin_record_courier_handoff('${pendingOrderId}')`,
      "select public.admin_staff_names(array[]::uuid[])",
      createOrder(),
    ]) {
      expect(await runAs(db, anon, call)).toMatch(/^error:permission denied/);
    }
    expect(await runAs(db, anon, "select count(*) from notifications")).toMatch(/^error:permission denied/);
    expect(await runAs(db, anon, "select count(*) from courier_handoffs")).toMatch(/^error:permission denied/);
  });
});
