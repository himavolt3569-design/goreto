// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Daraz Express bookings (migration daraz_courier): settings, booking,
 * history sync, guards and grants. Each test runs in a rolled-back
 * transaction; `setup` turns one seed courier into the Daraz API courier.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const service: Session = { role: "service_role" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager");
const fulfilment = as("user_seed_staff_fulfilment"); // orders.read/write
const support = as("user_seed_staff_support"); // orders.read only
let customer: Session;
let customerClerkId = "";
let customerProfileId = "";

const RESET = "reset role";
const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");
const sqlJson = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

let variantId = "";
let address: Record<string, unknown>;
let serviceId = "";
let courierId = "";

const DARAZ_COURIER = () => [`update couriers set integration_mode = 'api', api_provider = 'daraz' where id = '${courierId}'`];
const LAST_WA = "(select id from orders where channel = 'whatsapp' order by created_at desc, id limit 1)";
const SHIPMENT = `(select id from shipments where order_id = ${LAST_WA})`;

const createAndAccept = () => [
  `select public.admin_create_order(${sqlJson([{ variant_id: variantId, quantity: 1 }])},
     ${sqlJson({ name: "Sita Gurung", phone_e164: "+9779812345678" })}, ${sqlJson(address)},
     '${serviceId}', null, null, null, null) ->> 'order_number'`,
  `select public.admin_accept_order(${LAST_WA}, '${courierId}') ->> 'status'`,
];

const BOOKING = {
  package_code: "FU2420083700001",
  tracking_number: "npd-0001",
  delivery_option: "standard",
  weight_grams: 500,
  length_cm: 30,
  width_cm: 20,
  height_cm: 10,
  last_mile_provider: "DEX-NP",
  min_eta_ms: 1_791_400_000_000,
  max_eta_ms: 1_791_600_000_000,
};
const book = (booking: Record<string, unknown> = BOOKING) =>
  `select public.admin_record_provider_booking(${LAST_WA}, 'daraz', ${sqlJson(booking)})`;

const history = (events: { key: string; status: string | null; at: string; message?: string }[], extra: Record<string, unknown> = {}) => ({
  provider_status: events.at(-1)?.key.split("|")[0] ?? null,
  status: [...events].reverse().find((event) => event.status)?.status ?? null,
  fee_paisa: 15000,
  needs_action: false,
  last_mile_provider: null,
  events: events.map((event) => ({
    key: event.key,
    status: event.status,
    message: event.message ?? `Daraz: ${event.key}`,
    location: "Kathmandu hub",
    occurred_at: event.at,
  })),
  ...extra,
});

async function rows<T>(sql: string): Promise<T[]> {
  return (await db.query(sql)).rows as T[];
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  const [first] = await rows<{ clerk_user_id: string; id: string }>(
    "select clerk_user_id, id from profiles where role = 'customer' and deleted_at is null order by id limit 1",
  );
  customer = as(first!.clerk_user_id);
  customerClerkId = first!.clerk_user_id;
  customerProfileId = first!.id;
  [{ id: variantId }] = (await rows<{ id: string }>(`
    select v.id from product_variants v join products p on p.id = v.product_id
    where p.status = 'active' and v.is_active and v.stock_quantity >= 5 order by v.id limit 1`)) as [{ id: string }];
  const [place] = await rows<Record<string, string>>(`
    select m.code as municipality_code, d.code as district_code, d.province_code,
           r.courier_service_id as service_id, cs.courier_id
    from delivery_zones z
    join nepal_districts d on d.code = any (z.district_codes)
    join nepal_municipalities m on m.district_code = d.code
    join delivery_rates r on r.zone_id = z.id and r.is_active
      and r.min_order_paisa is null and r.min_weight_grams is null and r.max_weight_grams is null
    join courier_services cs on cs.id = r.courier_service_id and cs.is_active
    join couriers c on c.id = cs.courier_id and c.is_active
    where z.is_active order by m.code, r.price_paisa limit 1`);
  address = {
    province_code: place!.province_code,
    district_code: place!.district_code,
    municipality_code: place!.municipality_code,
    ward: 3,
    street_landmark: "Lakeside, near the boat station",
    postal_code: null,
  };
  serviceId = place!.service_id!;
  courierId = place!.courier_id!;
}, 120_000);

describe("schema", () => {
  it("keeps api_provider and integration_mode consistent", async () => {
    expect(await runAs(db, service, `update couriers set api_provider = 'daraz' where id = '${courierId}'`)).toMatch(/couriers_api_provider_matches_mode/);
    expect(await runAs(db, service, `update couriers set integration_mode = 'api' where id = '${courierId}'`)).toMatch(/couriers_api_provider_matches_mode/);
    expect(await runAs(db, service, DARAZ_COURIER()[0]!)).toBe("affected:1");
  });

  it("creates the Daraz settings row", async () => {
    expect(await runAs(db, service, "select count(*)::int from courier_provider_accounts where provider = 'daraz'")).toBe(1);
  });
});

describe("grants and RLS", () => {
  it("hides the webhook inbox from everyone but the service role", async () => {
    for (const session of [anon, customer, owner, fulfilment]) {
      expect(await runAs(db, session, "select count(*) from courier_webhook_inbox")).toMatch(/^error:permission denied/);
    }
    expect(await runAs(db, service, "select count(*)::int from courier_webhook_inbox")).toBe(0);
  });

  it("lets only order and delivery staff read settings, the log and locations", async () => {
    expect(await runAs(db, anon, "select count(*) from courier_provider_accounts")).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, "select count(*)::int from courier_provider_accounts")).toBe(0);
    expect(await runAs(db, support, "select count(*)::int from courier_provider_accounts")).toBe(0);
    expect(await runAs(db, fulfilment, "select count(*)::int from courier_provider_accounts")).toBe(1);
    expect(await runAs(db, owner, "select count(*)::int from courier_provider_accounts")).toBe(1);
    expect(await runAs(db, anon, "select count(*) from courier_api_log")).toMatch(/^error:permission denied/);
    expect(await runAs(db, anon, "select count(*) from daraz_locations")).toMatch(/^error:permission denied/);
  });

  it("allows no direct writes", async () => {
    expect(await runAs(db, owner, "update courier_provider_accounts set platform_name = 'x'")).toMatch(/^error:permission denied/);
    expect(await runAs(db, owner, "insert into courier_api_log (provider, action, success) values ('daraz', 'x', true)")).toMatch(/^error:permission denied/);
    expect(await runAs(db, owner, "insert into daraz_locations (municipality_code, daraz_address_id) values ('x', 'R1')")).toMatch(/^error:permission denied/);
  });

  it("keeps the history writer to the service role", async () => {
    const call = `select public.courier_apply_provider_history(gen_random_uuid(), '{}'::jsonb)`;
    expect(await runAs(db, owner, call)).toMatch(/^error:permission denied/);
    expect(await runAs(db, anon, call)).toMatch(/^error:permission denied/);
    expect(await runAs(db, owner, "select public.provider_history_core(gen_random_uuid(), '{}'::jsonb)")).toMatch(/^error:permission denied/);
  });
});

describe("admin_update_provider_account", () => {
  it("needs delivery.manage and changes only listed keys", async () => {
    const patch = (value: unknown) => `select public.admin_update_provider_account('daraz', ${sqlJson(value)})`;
    expect(await runAs(db, support, patch({ platform_name: "Goreto" }))).toMatch(/delivery.manage required/);
    expect(await runAs(db, owner, patch({ linked_at: "2020-01-01" }))).toMatch(/Unknown setting linked_at/);

    const outcomes = await runStepsAs(db, owner, [
      patch({ platform_name: " Goreto ", external_seller_id: "GS-1", solution_codes: ["NP_COD", " "], default_length_cm: 25, mark_linked: true }),
      patch({ default_open_box: true }),
      `select concat_ws('|', platform_name, external_seller_id, array_to_string(solution_codes, ','), default_length_cm, default_open_box, linked_at is not null)
         from courier_provider_accounts where provider = 'daraz'`,
      patch({ default_delivery_option: "overnight" }),
    ]);
    expect(outcomes[2]).toBe("Goreto|GS-1|NP_COD|25.0|t|t");
    expect(outcomes[3]).toMatch(/default_delivery_option_check/);
  });
});

describe("booking", () => {
  it("records a booking, shows it to the customer, and is idempotent", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      book(),
      `select concat_ws('|', provider, provider_package_code, tracking_number, package_weight_grams, estimated_delivery_from is not null, status)
         from shipments where id = ${SHIPMENT}`,
      `select message from shipment_events where shipment_id = ${SHIPMENT} and source = 'courier_api'`,
      `select count(*)::int from shipment_events where shipment_id = ${SHIPMENT} and source = 'courier_api'`,
      book({ ...BOOKING, package_code: "OTHER" }),
    ]);
    expect(outcomes.slice(0, 7).filter(isError)).toEqual([]);
    expect(outcomes[4]).toBe("daraz|FU2420083700001|NPD-0001|500|t|assigned");
    expect(outcomes[5]).toBe("Booked with Daraz Express. Tracking number NPD-0001.");
    expect(outcomes[6]).toBe(1);
    expect(outcomes[7]).toMatch(/already has a courier booking/);
  });

  it("refuses couriers without the API, unaccepted orders, and staff without orders.write", async () => {
    const manual = await runStepsAs(db, fulfilment, [...createAndAccept(), book()]);
    expect(manual[2]).toMatch(/isn't booked through the daraz API/);

    const pending = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [createAndAccept()[0]!, book()]);
    expect(pending[1]).toMatch(/Only accepted orders/);

    const denied = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      `select set_config('request.jwt.claims', '{"sub":"user_seed_staff_support","role":"authenticated"}', true)`,
      book(),
    ]);
    expect(denied[3]).toMatch(/orders.write required/);
  });

  it("pins the courier and blocks canceling the order until the booking is canceled", async () => {
    const booked = [...createAndAccept(), book()];
    const reassign = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...booked,
      `update shipments set courier_id = (select id from couriers where id <> '${courierId}' limit 1) where id = ${SHIPMENT}`,
    ]);
    expect(reassign[3]).toMatch(/Cancel the booking before changing the courier/);

    const cancelOrder = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...booked,
      `select public.admin_transition_order(${LAST_WA}, 'canceled', 'Customer changed their mind')`,
    ]);
    expect(cancelOrder[3]).toMatch(/Cancel the Daraz Express booking before canceling/);

    const noReason = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...booked,
      `select public.admin_clear_provider_booking(${LAST_WA}, 'daraz', '')`,
    ]);
    expect(noReason[3]).toMatch(/cancellation reason/);

    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...booked,
      `select public.admin_clear_provider_booking(${LAST_WA}, 'daraz', 'Wrong address')`,
      `select concat_ws('|', coalesce(provider_package_code, '-'), coalesce(tracking_number, '-'), provider_canceled_at is not null) from shipments where id = ${SHIPMENT}`,
      `select public.admin_transition_order(${LAST_WA}, 'canceled', 'Customer changed their mind')`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[4]).toBe("-|-|t");
    expect(outcomes[5]).toBe("canceled");
  });

  it("marks ready to ship only after booking", async () => {
    const early = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      `select public.admin_mark_provider_ready(${LAST_WA}, 'daraz')`,
    ]);
    expect(early[2]).toMatch(/Book the order with the courier first/);
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      `select public.admin_mark_provider_ready(${LAST_WA}, 'daraz')`,
      `select ready_to_ship_at is not null from shipments where id = ${SHIPMENT}`,
    ]);
    expect(outcomes[4]).toBe(true);
  });
});

describe("provider history", () => {
  const PICKED = { key: "PICKED_UP|1791400000000", status: "picked_up", at: "2026-10-08T05:00:00Z" };
  const UNKNOWN = { key: "SORTING|1791410000000", status: null, at: "2026-10-08T07:00:00Z" };
  const DELIVERED = { key: "DELIVERED|1791500000000", status: "delivered", at: "2026-10-09T05:00:00Z" };

  it("adds events once, ships, then delivers and collects COD", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED, UNKNOWN]))}) ->> 'inserted'`,
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED, UNKNOWN]))}) ->> 'inserted'`,
      `select concat_ws('|', o.status, s.status, f.actual_fee_paisa, o.shipped_at = '2026-10-08T05:00:00Z'::timestamptz)
         from orders o join shipments s on s.order_id = o.id left join shipment_courier_finance f on f.shipment_id = s.id
         where o.id = ${LAST_WA}`,
      `select status from shipment_events where shipment_id = ${SHIPMENT} and provider_event_key like 'SORTING%'`,
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED, UNKNOWN, DELIVERED]))}) ->> 'inserted'`,
      `select concat_ws('|', o.status, o.payment_status, s.status, s.delivered_at is not null) from orders o join shipments s on s.order_id = o.id where o.id = ${LAST_WA}`,
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([{ key: "IN_TRANSIT|1791600000000", status: "in_transit", at: "2026-10-10T05:00:00Z" }]))}) ->> 'status'`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[3]).toBe("2");
    expect(outcomes[4]).toBe("0");
    expect(outcomes[5]).toBe("shipped|picked_up|15000|t");
    expect(outcomes[6]).toBe("picked_up"); // an unknown status keeps the shipment's current one
    expect(outcomes[7]).toBe("1");
    expect(outcomes[8]).toBe("delivered|collected|delivered|t");
    expect(outcomes[9]).toBe("delivered"); // never regresses
  });

  it("notifies staff on a failed delivery and never cancels", async () => {
    const failed = { key: "FAILED_DELIVERY|1791450000000", status: "exception", at: "2026-10-08T09:00:00Z", message: "Customer not reachable" };
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED, failed], { needs_action: true }))}) ->> 'status'`,
      RESET,
      `select concat_ws('|', o.status, s.provider_needs_action) from orders o join shipments s on s.order_id = o.id where o.id = ${LAST_WA}`,
      `select count(*)::int from notifications where order_id = ${LAST_WA} and kind = 'courier_attention' and body = 'Customer not reachable'`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[3]).toBe("exception");
    expect(outcomes[5]).toBe("shipped|t");
    expect(outcomes[6]).toBeGreaterThan(0);
  });

  it("is applied by the service role for webhooks and polling", async () => {
    const outcomes = await runStepsWithSetup(
      db,
      DARAZ_COURIER(),
      fulfilment,
      [
        ...createAndAccept(),
        book(),
        RESET,
        "set local role service_role",
        `select public.courier_apply_provider_history(${SHIPMENT}, ${sqlJson(history([PICKED]))}) ->> 'status'`,
      ],
    );
    expect(outcomes[5]).toBe("picked_up");
  });

  it("is refused for staff without orders.write and for unbooked orders", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED]))})`,
    ]);
    expect(outcomes[2]).toMatch(/isn't booked with a courier API/);
    expect(await runAs(db, support, `select public.admin_apply_provider_history(gen_random_uuid(), '{}'::jsonb)`)).toMatch(/orders.write required/);
    expect(await runAs(db, catalogStaff, `select public.admin_log_courier_call('daraz', 'consign', null, true, null, null, null, 10)`)).toMatch(/required/);
  });
});

describe("operations (migration daraz_courier_ops)", () => {
  const PICKED = { key: "PICKED_UP|1791400000000", status: "picked_up", at: "2026-10-08T05:00:00Z" };
  const DELIVERED = { key: "DELIVERED|1791500000000", status: "delivered", at: "2026-10-09T05:00:00Z" };
  const deliver = () => `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED, DELIVERED]))}) ->> 'status'`;
  const remit = (numbers: string[], reference = "PAYOUT-1") =>
    `select public.admin_record_remittance('daraz', '${reference}', '2026-10-06', 100000, 5000, null,
       array[${numbers.map((number) => `'${number}'`).join(",")}]::text[]) ->> 'parcel_count'`;

  it("keeps the Daraz tracking number when staff re-save the same courier", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      `select public.admin_assign_courier(${LAST_WA}, '${courierId}', null)`,
    ]);
    expect(outcomes[3]).toMatch(/Cancel the booking before changing the courier or tracking number/);
  });

  it("gives a new reference after a cancellation, so Daraz doesn't treat the rebooking as a duplicate", async () => {
    const reference = `select public.admin_provider_booking_reference(${LAST_WA}, 'daraz')`;
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      reference,
      book({ ...BOOKING, reference: "FIRST" }),
      `select public.admin_clear_provider_booking(${LAST_WA}, 'daraz', 'Wrong box')`,
      reference,
      book({ ...BOOKING, package_code: "FU-SECOND", reference: "SECOND" }),
      `select concat_ws('|', provider_booking_attempts, provider_reference, provider_package_code) from shipments where id = ${SHIPMENT}`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[2]).toMatch(/^[A-Z]{2,4}[0-9]+$/);
    expect(outcomes[5]).toBe(`${String(outcomes[2])}-R2`);
    expect(outcomes[7]).toBe("2|SECOND|FU-SECOND");
  });

  it("marks the courier handoff sent through the API and resolves the 'ready to send' alert", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      RESET,
      `insert into notifications (recipient_id, kind, order_id, title, href)
         select id, 'order_auto_accepted', ${LAST_WA}, 'Ready', '/admin' from profiles where clerk_user_id = 'user_seed_owner'`,
      "set local role authenticated",
      book(),
      RESET,
      `select concat_ws('|', status, channel, attempts) from courier_handoffs where order_id = ${LAST_WA} and status <> 'superseded'`,
      `select count(*)::int from notifications where order_id = ${LAST_WA} and kind = 'order_auto_accepted' and read_at is null`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[7]).toBe("sent|daraz_api|1");
    expect(outcomes[8]).toBe(0);
  });

  it("records AWB printing, receiver updates and failed-delivery decisions", async () => {
    const failed = { key: "1ST_ATTEMPT_FAILED|1791450000000", status: "exception", at: "2026-10-08T09:00:00Z" };
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      `select public.admin_mark_awb_printed(${LAST_WA}, 'daraz')`,
      `select public.admin_record_provider_receiver_update(${LAST_WA}, 'daraz', ${sqlJson({ name: "Ram", phone_e164: "+9779800000001", details: "New Road" })})`,
      `select public.admin_apply_provider_history(${LAST_WA}, ${sqlJson(history([PICKED, failed], { needs_action: true }))}) ->> 'status'`,
      `select public.admin_record_provider_feedback(${LAST_WA}, 'daraz', 'REATTEMPT', '2026-10-10')`,
      `select concat_ws('|', awb_printed_at is not null, provider_receiver ->> 'name', provider_needs_action) from shipments where id = ${SHIPMENT}`,
      `select string_agg(message, ' / ' order by message) from shipment_events
         where shipment_id = ${SHIPMENT} and source = 'staff' and message like 'Deliver%'`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[7]).toBe("t|Ram|f");
    expect(outcomes[8]).toBe("Delivery details updated with the courier. / Delivery will be attempted again on 10 Oct 2026.");
    expect(await runAs(db, fulfilment, `select public.admin_record_provider_feedback(gen_random_uuid(), 'daraz', 'LATER', null)`)).toMatch(/Choose re-attempt or return/);
  });

  it("settles COD only for delivered, collected, unsettled Daraz parcels", async () => {
    const notDelivered = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [...createAndAccept(), book(), remit(["npd-0001"])]);
    expect(notDelivered[3]).toMatch(/Not delivered, not collected, or already settled: NPD-0001/);
    expect(await runAs(db, fulfilment, remit(["NOPE-1"]))).toMatch(/Not Daraz parcels in Goreto: NOPE-1/);

    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      deliver(),
      remit([" npd-0001 ", "NPD-0001"]),
      `select concat_ws('|', r.parcel_count, r.expected_paisa = o.total_paisa, r.net_paisa)
         from courier_remittances r, orders o where r.reference = 'PAYOUT-1' and o.id = ${LAST_WA}`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[4]).toBe("1");
    expect(outcomes[5]).toBe("1|t|95000");

    const twice = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [...createAndAccept(), book(), deliver(), remit(["NPD-0001"]), remit(["NPD-0001"], "PAYOUT-2")]);
    expect(twice[5]).toMatch(/already settled/);

    const ownerOnlyDelete = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      book(),
      deliver(),
      remit(["NPD-0001"]),
      "select public.admin_delete_remittance((select id from courier_remittances where reference = 'PAYOUT-1'))",
    ]);
    expect(ownerOnlyDelete[5]).toMatch(/Only the owner/);
  });

  it("keeps courier money and support cases away from customers", async () => {
    expect(await runAs(db, customer, "select count(*)::int from shipment_courier_finance")).toBe(0);
    expect(await runAs(db, customer, "select count(*)::int from courier_remittances")).toBe(0);
    expect(await runAs(db, customer, "select count(*)::int from courier_support_cases")).toBe(0);
    expect(await runAs(db, anon, "select count(*) from shipment_courier_finance")).toMatch(/^error:permission denied/);
    expect(
      await runAs(db, owner, "insert into courier_remittances (provider, reference, statement_date, gross_paisa, expected_paisa, parcel_count) values ('daraz', 'x', current_date, 1, 1, 1)"),
    ).toMatch(/^error:permission denied/);
    expect(await runAs(db, owner, "update shipment_courier_finance set actual_fee_paisa = 1")).toMatch(/^error:permission denied/);
    expect(await runAs(db, service, "select count(*)::int from information_schema.columns where table_name = 'shipments' and column_name = 'provider_fee_paisa'")).toBe(0);
  });

  it("records and updates support cases", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      `select public.admin_record_support_case('daraz', '12345', ${LAST_WA}, 'npd-1', 'Parcel damaged') is not null`,
      "select public.admin_update_support_case('daraz', '12345', 'closed', 4::smallint)",
      "select concat_ws('|', case_id, tracking_number, status, rating) from courier_support_cases where case_id = '12345'",
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[4]).toBe("12345|NPD-1|closed|4");
    expect(await runAs(db, support, "select public.admin_record_support_case('daraz', '1', null, null, 'x')")).toMatch(/orders.write required/);
  });

  it("summarises the dashboard for order staff only", async () => {
    const outcomes = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      "select (public.admin_courier_overview('daraz') ->> 'to_book')::int >= 1",
      book(),
      deliver(),
      `select concat_ws('|', public.admin_courier_overview('daraz') ->> 'cod_unsettled_count',
         (public.admin_courier_overview('daraz') ->> 'total_municipalities')::int > 700)`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[2]).toBe(true);
    expect(outcomes[5]).toBe("1|t");
    expect(await runAs(db, catalogStaff, "select public.admin_courier_overview('daraz')")).toMatch(/orders.read required/);
    expect(await runAs(db, anon, "select public.admin_courier_overview('daraz')")).toMatch(/^error:permission denied/);
  });

  it("gives customers the courier's tracking link once there is a tracking number", async () => {
    const forCustomer = `select public.admin_create_order(${sqlJson([{ variant_id: variantId, quantity: 1 }])},
      ${sqlJson({ name: "Sita Gurung", phone_e164: "+9779812345678" })}, ${sqlJson(address)},
      '${serviceId}', null, null, '${customerProfileId}', null) ->> 'order_number'`;
    const link = `select public.get_order_tracking((select order_number from orders where id = ${LAST_WA}), null) -> 'shipment' ->> 'courier_tracking_url'`;
    const outcomes = await runStepsWithSetup(
      db,
      [...DARAZ_COURIER(), `update couriers set tracking_url_template = 'https://dex.example/track?no={tracking}' where id = '${courierId}'`],
      fulfilment,
      [
        forCustomer,
        `select public.admin_accept_order(${LAST_WA}, '${courierId}') ->> 'status'`,
        `select set_config('request.jwt.claims', '{"sub":"${customerClerkId}","role":"authenticated"}', true)`,
        `select coalesce(${link.slice(7)}, 'none')`,
        `select set_config('request.jwt.claims', '{"sub":"user_seed_staff_fulfilment","role":"authenticated"}', true)`,
        book(),
        `select set_config('request.jwt.claims', '{"sub":"${customerClerkId}","role":"authenticated"}', true)`,
        link,
      ],
    );
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[3]).toBe("none");
    expect(outcomes[7]).toBe("https://dex.example/track?no=NPD-0001");
  });

  it("lets the service role book automatically, once, and flags failures for staff", async () => {
    const autoBookOn = "update courier_provider_accounts set auto_book = true where provider = 'daraz'";
    const outcomes = await runStepsWithSetup(db, [...DARAZ_COURIER(), autoBookOn], fulfilment, [
      ...createAndAccept(),
      RESET,
      "set local role service_role",
      `select count(*)::int from public.courier_auto_book_candidates('daraz', 10) c where c.order_id = ${LAST_WA}`,
      `select public.courier_provider_booking_reference(${LAST_WA}, 'daraz') = (select order_number from orders where id = ${LAST_WA})`,
      `select public.courier_record_provider_booking(${LAST_WA}, 'daraz', ${sqlJson(BOOKING)})`,
      `select count(*)::int from public.courier_auto_book_candidates('daraz', 10) c where c.order_id = ${LAST_WA}`,
      `select concat_ws('|', h.status, h.channel, coalesce(h.last_sent_by::text, 'auto')) from courier_handoffs h where h.order_id = ${LAST_WA} and h.status <> 'superseded'`,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect(outcomes[4]).toBe(1);
    expect(outcomes[5]).toBe(true);
    expect(outcomes[7]).toBe(0);
    expect(outcomes[8]).toBe("sent|daraz_api|auto");

    const failure = await runStepsWithSetup(db, [...DARAZ_COURIER(), autoBookOn], fulfilment, [
      ...createAndAccept(),
      RESET,
      "set local role service_role",
      `select public.courier_auto_book_failed(${LAST_WA}, 'Some items have no weight saved.')`,
      `select count(*)::int from public.courier_auto_book_candidates('daraz', 10) c where c.order_id = ${LAST_WA}`,
      `select count(*)::int from notifications where order_id = ${LAST_WA} and kind = 'courier_attention'`,
    ]);
    expect(failure.filter(isError)).toEqual([]);
    expect(failure[5]).toBe(0);
    expect(failure[6]).toBeGreaterThan(0);

    const off = await runStepsWithSetup(db, DARAZ_COURIER(), fulfilment, [
      ...createAndAccept(),
      RESET,
      "set local role service_role",
      `select count(*)::int from public.courier_auto_book_candidates('daraz', 10) c where c.order_id = ${LAST_WA}`,
    ]);
    expect(off[4]).toBe(0);
  });

  it("keeps the automatic-booking functions away from staff and customers", async () => {
    for (const call of [
      "select public.courier_auto_book_candidates('daraz', 10)",
      "select public.courier_auto_book_failed(gen_random_uuid(), 'x')",
      "select public.courier_record_provider_booking(gen_random_uuid(), 'daraz', '{}'::jsonb)",
      "select public.courier_provider_booking_reference(gen_random_uuid(), 'daraz')",
      "select public.provider_record_booking_core(gen_random_uuid(), 'daraz', '{}'::jsonb, null)",
    ]) {
      expect(await runAs(db, owner, call)).toMatch(/^error:permission denied/);
      expect(await runAs(db, anon, call)).toMatch(/^error:permission denied/);
    }
  });

  it("validates settings, box sizes and tracking link templates", async () => {
    const patch = (value: unknown) => `select public.admin_update_provider_account('daraz', ${sqlJson(value)})`;
    expect(await runAs(db, owner, patch({ box_presets: [{ name: "Tiny", length_cm: 0, width_cm: 1, height_cm: 1 }] }))).toMatch(/Each box needs a name/);
    expect(await runAs(db, owner, patch({ booking_endpoint: "teleport" }))).toMatch(/booking_endpoint_check/);
    expect(await runAs(db, owner, patch({ origin_latitude: 27.7 }))).toMatch(/origin_point/);
    const saved = await runStepsAs(db, owner, [
      patch({ booking_endpoint: "consign", phone_format: "e164", auto_book: true, origin_latitude: 27.7, origin_longitude: 85.3, xspace_case_template_id: 7 }),
      "select concat_ws('|', booking_endpoint, phone_format, auto_book, xspace_case_template_id) from courier_provider_accounts where provider = 'daraz'",
    ]);
    expect(saved[1]).toBe("consign|e164|t|7");
    expect(await runAs(db, service, `update couriers set tracking_url_template = 'https://dex.example/track' where id = '${courierId}'`)).toMatch(/tracking_url_template_check/);
    expect(await runAs(db, service, `update couriers set tracking_url_template = 'https://dex.example/track?no={tracking}' where id = '${courierId}'`)).toBe("affected:1");
  });
});

describe("usual parcel weight (Send & track)", () => {
  const patch = (value: unknown) => `select public.admin_update_provider_account('daraz', ${sqlJson(value)})`;
  const read = "select coalesce(default_weight_grams::text, 'none') from courier_provider_accounts where provider = 'daraz'";

  it("saves, keeps and clears the usual weight through the patch RPC", async () => {
    const outcomes = await runStepsAs(db, owner, [
      read,
      patch({ default_weight_grams: 500, auto_book: true }),
      read,
      patch({ platform_name: "Goreto" }),
      read,
      patch({ default_weight_grams: null }),
      read,
    ]);
    expect(outcomes.filter(isError)).toEqual([]);
    expect([outcomes[0], outcomes[2], outcomes[4], outcomes[6]]).toEqual(["none", "500", "500", "none"]);
  });

  it("refuses weights out of range or not whole grams", async () => {
    for (const value of [0, 100_001, 12.5, "500", true]) {
      expect(await runAs(db, owner, patch({ default_weight_grams: value }))).toMatch(/usual parcel weight must be a whole number/);
    }
  });

  it("stays behind delivery.manage, and customers and guests can't read it", async () => {
    expect(await runAs(db, support, patch({ default_weight_grams: 500 }))).toMatch(/delivery.manage required/);
    expect(await runAs(db, catalogStaff, patch({ default_weight_grams: 500 }))).toMatch(/delivery.manage required/);
    expect(await runAs(db, customer, patch({ default_weight_grams: 500 }))).toMatch(/delivery.manage required/);
    expect(await runAs(db, anon, patch({ default_weight_grams: 500 }))).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, "select count(default_weight_grams)::int from courier_provider_accounts")).toBe(0);
    expect(await runAs(db, owner, "update courier_provider_accounts set default_weight_grams = 1")).toMatch(/^error:permission denied/);
  });
});
