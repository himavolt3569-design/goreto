// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Checkout (migration checkout_place_order): checkout_quote, place_order,
 * get_order_tracking and nearest_municipality. Every test runs in a
 * rolled-back transaction, so they don't affect each other.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
let customer: Session;
let otherCustomer: Session;
let customerProfileId = "";

type Variant = { id: string; product_id: string; stock: number; price: number };
let variantA: Variant;
let variantB: Variant;
let address: { province_code: string; district_code: string; municipality_code: string; ward: number };
let serviceId = "";
let servicePrice = 0;
let noZoneMunicipality = "";
let guestOrderNumber = "";

const SECRET = "test-secret-0123456789abcdef";
const SECRET_HASH_SQL = `encode(sha256(convert_to('${SECRET}', 'UTF8')), 'hex')`;

async function rows<T>(sql: string): Promise<T[]> {
  return (await db.query(sql)).rows as T[];
}
async function scalar<T>(sql: string): Promise<T> {
  const [row] = await rows<Record<string, unknown>>(sql);
  return Object.values(row!)[0] as T;
}

const sqlJson = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const items = (...lines: [Variant, number][]) =>
  sqlJson(lines.map(([variant, quantity]) => ({ variant_id: variant.id, quantity })));
const contact = { name: "Aarushi Shrestha", email: "Aarushi@Example.com", phone_e164: "+9779841234567" };
const fullAddress = () => ({ ...address, street_landmark: "Thamel, near Garden of Dreams", postal_code: "44600" });

function placeOrder(options: {
  lines?: string;
  service?: string | null;
  coupon?: string | null;
  address?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  hash?: string | null;
} = {}): string {
  const service = options.service === undefined ? `'${serviceId}'` : options.service === null ? "null" : `'${options.service}'`;
  const coupon = options.coupon ? `'${options.coupon}'` : "null";
  const hash = options.hash === undefined ? SECRET_HASH_SQL : options.hash === null ? "null" : `'${options.hash}'`;
  return `select public.place_order(
    ${options.lines ?? items([variantA, 2])},
    ${sqlJson(options.contact ?? contact)},
    ${sqlJson(options.address ?? fullAddress())},
    ${service}, ${coupon}, 'Please call before delivery', ${hash}
  )`;
}

function quote(lines: string, extra = "") {
  return `select public.checkout_quote(${lines}, '${address.municipality_code}', '${serviceId}'${extra})`;
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  const [first, second] = await rows<{ clerk_user_id: string; id: string }>(
    `select p.clerk_user_id, p.id from profiles p
     where p.role = 'customer' and p.deleted_at is null
     order by exists (select 1 from orders o where o.user_id = p.id) desc, p.id limit 2`,
  );
  customer = as(first!.clerk_user_id);
  customerProfileId = first!.id;
  otherCustomer = as(second!.clerk_user_id);

  const variants = await rows<Variant>(`
    select v.id, v.product_id, v.stock_quantity as stock, coalesce(v.price_paisa, p.base_price_paisa)::integer as price
    from product_variants v join products p on p.id = v.product_id
    where p.status = 'active' and v.is_active and v.stock_quantity >= 5
    order by v.id limit 2`);
  [variantA, variantB] = variants as [Variant, Variant];

  const [place] = await rows<typeof address & { service_id: string; price: number }>(`
    select m.code as municipality_code, d.code as district_code, d.province_code, 1 as ward,
           r.courier_service_id as service_id, r.price_paisa::integer as price
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
  };
  serviceId = place!.service_id;
  servicePrice = place!.price;

  guestOrderNumber = await scalar<string>("select order_number from orders where user_id is null order by id limit 1");
  noZoneMunicipality = await scalar<string>(`
    select m.code from nepal_municipalities m
    where not exists (select 1 from delivery_zones z where z.is_active and m.district_code = any (z.district_codes))
    order by m.code limit 1`).catch(() => "");
}, 120_000);

describe("checkout_quote", () => {
  it("prices lines from the database and adds the delivery fee", async () => {
    const result = (await runAs(db, anon, quote(items([variantA, 2], [variantB, 1])))) as Record<string, unknown>;
    const subtotal = variantA.price * 2 + variantB.price;
    expect(result.subtotal_paisa).toBe(subtotal);
    expect(result.delivery_fee_paisa).toBe(servicePrice);
    expect(result.total_paisa).toBe(subtotal + servicePrice);
    expect((result.lines as { status: string }[]).map((line) => line.status)).toEqual(["ok", "ok"]);
    expect((result.delivery_options as unknown[]).length).toBeGreaterThan(0);
  });

  it("flags lines over stock and inactive products", async () => {
    const setup = [
      `update product_variants set stock_quantity = 1 where id = '${variantA.id}'`,
      `update products set status = 'draft' where id = '${variantB.product_id}'`,
    ];
    const [result] = (await runStepsWithSetup(db, setup, anon, [quote(items([variantA, 3], [variantB, 1]))])) as Record<string, unknown>[];
    const lines = result!.lines as { status: string; available_quantity: number }[];
    expect(lines[0]).toMatchObject({ status: "insufficient_stock", available_quantity: 1 });
    expect(lines[1]).toMatchObject({ status: "unavailable", available_quantity: 0 });
  });

  it("refuses malformed items", async () => {
    for (const bad of [
      "'[]'::jsonb",
      "'{}'::jsonb",
      `'[{"variant_id":"${"x".repeat(36)}","quantity":1}]'::jsonb`,
      `'[{"variant_id":"${variantA?.id}","quantity":0}]'::jsonb`,
      `'[{"variant_id":"${variantA?.id}","quantity":11}]'::jsonb`,
      `'[{"variant_id":"${variantA?.id}","quantity":1.5}]'::jsonb`,
      `'[{"variant_id":"${variantA?.id}"}]'::jsonb`,
      `'[{"variant_id":"${variantA?.id}","quantity":1},{"variant_id":"${variantA?.id}","quantity":1}]'::jsonb`,
    ]) {
      expect(await runAs(db, anon, `select public.checkout_quote(${bad})`)).toMatch(/checkout:invalid_items/);
    }
  });

  it("offers no delivery where no zone covers the district", async () => {
    if (!noZoneMunicipality) return;
    const result = (await runAs(
      db,
      anon,
      `select public.checkout_quote(${items([variantA, 1])}, '${noZoneMunicipality}', null)`,
    )) as Record<string, unknown>;
    expect(result.delivery_options).toEqual([]);
    expect(result.zone).toBeNull();
  });

  it("applies rate conditions for order value and weight", async () => {
    const minOrder = [`update delivery_rates set min_order_paisa = 999999999 where courier_service_id = '${serviceId}'`];
    const [a] = (await runStepsWithSetup(db, minOrder, anon, [quote(items([variantA, 1]))])) as Record<string, unknown>[];
    expect(a!.selected_delivery).toBeNull();

    const heavy = [
      `update product_variants set weight_grams = 5000 where id = '${variantA.id}'`,
      `update delivery_rates set max_weight_grams = 1000 where courier_service_id = '${serviceId}'`,
    ];
    const [b] = (await runStepsWithSetup(db, heavy, anon, [quote(items([variantA, 1]))])) as Record<string, unknown>[];
    expect(b!.selected_delivery).toBeNull();
  });

  describe("coupons", () => {
    const withCoupon = (sets: string) => [
      `insert into coupons (code, type, percent_off, starts_at, is_active) values ('TEST10', 'percentage', 10, now() - interval '1 day', true)`,
      ...(sets ? [`update coupons set ${sets} where code = 'TEST10'`] : []),
    ];
    const coupon = async (sets: string, email = "null") => {
      const [result] = (await runStepsWithSetup(db, withCoupon(sets), anon, [
        quote(items([variantA, 2]), `, ' test10 ', ${email}`),
      ])) as Record<string, unknown>[];
      return result!;
    };

    it("applies a percentage rounded down", async () => {
      const result = await coupon("");
      expect(result.discount_paisa).toBe(Math.floor((variantA.price * 2 * 10) / 100));
      expect(result.coupon).toMatchObject({ code: "TEST10" });
    });

    it("caps the discount", async () => {
      expect((await coupon("max_discount_paisa = 100")).discount_paisa).toBe(100);
    });

    it("reports why a code doesn't apply", async () => {
      expect((await coupon("is_active = false")).coupon).toMatchObject({ error: "not_found" });
      expect((await coupon("starts_at = now() + interval '1 day'")).coupon).toMatchObject({ error: "not_started" });
      expect((await coupon("ends_at = now() - interval '1 hour', starts_at = now() - interval '2 days'")).coupon).toMatchObject({ error: "expired" });
      expect((await coupon("usage_limit = 1, times_used = 1")).coupon).toMatchObject({ error: "usage_limit" });
      expect((await coupon("min_order_paisa = 999999999")).coupon).toMatchObject({ error: "min_order", min_order_paisa: 999999999 });
    });

    it("limits uses per customer by email for guests", async () => {
      const setup = [
        ...withCoupon("usage_limit_per_customer = 1"),
        `update orders set coupon_id = (select id from coupons where code = 'TEST10'), contact_email = 'repeat@example.com', status = 'confirmed'
         where id = (select id from orders order by id limit 1)`,
      ];
      const [result] = (await runStepsWithSetup(db, setup, anon, [
        quote(items([variantA, 1]), ", 'TEST10', 'Repeat@example.com'"),
      ])) as Record<string, unknown>[];
      expect(result!.coupon).toMatchObject({ error: "customer_limit" });
    });
  });
});

describe("place_order", () => {
  it("creates a guest order and writes what the quote promised", async () => {
    const latest = "(select id from orders where created_at = now())";
    const [placed, , stored, stock, shipment, event] = (await runStepsAs(db, anon, [
      placeOrder(),
      "reset role",
      `select to_jsonb(o) from (select user_id, contact_email, subtotal_paisa, discount_paisa, delivery_fee_paisa, total_paisa,
         status, payment_status, guest_tracking_hash, shipping_address, delivery_snapshot from orders where id = ${latest}) o`,
      `select stock_quantity from product_variants where id = '${variantA.id}'`,
      `select to_jsonb(s) from (select status, estimated_delivery_from is not null as has_eta from shipments where order_id = ${latest}) s`,
      `select to_jsonb(e) from (select e.status, e.source from shipment_events e join shipments s on s.id = e.shipment_id where s.order_id = ${latest}) e`,
    ])) as Record<string, unknown>[];

    expect(placed).toMatchObject({ order_number: expect.stringMatching(/^GT[0-9]{12}$/) });
    expect(stored).toMatchObject({
      user_id: null,
      contact_email: "aarushi@example.com",
      subtotal_paisa: variantA.price * 2,
      discount_paisa: 0,
      delivery_fee_paisa: servicePrice,
      total_paisa: variantA.price * 2 + servicePrice,
      status: "pending_confirmation",
      payment_status: "pending",
    });
    expect(stored!.guest_tracking_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.shipping_address).toMatchObject({ municipality_code: address.municipality_code, ward: 1, postal_code: "44600" });
    expect(stored!.delivery_snapshot).toMatchObject({ courier_service_id: serviceId, price_paisa: servicePrice });
    expect(stock).toBe(variantA.stock - 2);
    expect(shipment).toEqual({ status: "awaiting_assignment", has_eta: true });
    expect(event).toEqual({ status: "awaiting_assignment", source: "system" });
  });

  it("links a signed-in order to the caller's profile, not to input", async () => {
    const outcomes = await runStepsAs(db, customer, [
      placeOrder({ hash: null }),
      "select count(*)::int from orders where user_id = public.current_profile_id() and created_at = now()",
    ]);
    expect(outcomes[0]).toMatchObject({ order_number: expect.any(String) });
    expect(outcomes[1]).toBe(1);
  });

  it("requires a tracking hash from guests", async () => {
    expect(await runAs(db, anon, placeOrder({ hash: null }))).toMatch(/checkout:invalid_tracking/);
    expect(await runAs(db, anon, placeOrder({ hash: "abc" }))).toMatch(/checkout:invalid_tracking/);
  });

  it("refuses to oversell and names the lines", async () => {
    const setup = [`update product_variants set stock_quantity = 1 where id = '${variantA.id}'`];
    const [outcome] = await runStepsWithSetup(db, setup, anon, [placeOrder()]);
    expect(outcome).toMatch(/checkout:stock_changed/);
  });

  it("second order for the last units fails after the first succeeds", async () => {
    const setup = [`update product_variants set stock_quantity = 2 where id = '${variantA.id}'`];
    const outcomes = await runStepsWithSetup(db, setup, anon, [placeOrder(), placeOrder()]);
    expect(outcomes[0]).toMatchObject({ order_number: expect.any(String) });
    expect(outcomes[1]).toMatch(/checkout:stock_changed/);
  });

  it("refuses bad contact and address details", async () => {
    expect(await runAs(db, anon, placeOrder({ contact: { ...contact, phone_e164: "+14155550100" } }))).toMatch(/invalid_contact/);
    expect(await runAs(db, anon, placeOrder({ contact: { ...contact, email: "nope" } }))).toMatch(/invalid_contact/);
    expect(await runAs(db, anon, placeOrder({ address: { ...fullAddress(), ward: 99 } }))).toMatch(/invalid_address/);
    expect(await runAs(db, anon, placeOrder({ address: { ...fullAddress(), district_code: "atlantis" } }))).toMatch(/invalid_address/);
    expect(await runAs(db, anon, placeOrder({ address: { ...fullAddress(), latitude: 40, longitude: 85 } }))).toMatch(/invalid_address/);
    expect(await runAs(db, anon, placeOrder({ address: { ...fullAddress(), latitude: 27.7 } }))).toMatch(/invalid_address/);
  });

  it("refuses a service that isn't offered for the address", async () => {
    expect(await runAs(db, anon, placeOrder({ service: null }))).toMatch(/checkout:delivery_unavailable/);
    const setup = [`update delivery_rates set is_active = false where courier_service_id = '${serviceId}'`];
    const [outcome] = await runStepsWithSetup(db, setup, anon, [placeOrder()]);
    expect(outcome).toMatch(/checkout:delivery_unavailable/);
  });

  it("applies a coupon and counts its use; refuses an invalid one", async () => {
    const setup = [`insert into coupons (code, type, amount_off_paisa, starts_at) values ('FLAT100', 'fixed', 10000, now() - interval '1 day')`];
    const outcomes = await runStepsWithSetup(db, setup, anon, [
      placeOrder({ coupon: "flat100" }),
      "reset role",
      "select times_used from coupons where code = 'FLAT100'",
    ]);
    expect(outcomes[0]).toMatchObject({ order_number: expect.any(String) });
    expect(outcomes[2]).toBe(1);

    expect(await runAs(db, anon, placeOrder({ coupon: "NOSUCHCODE" }))).toMatch(/checkout:coupon_invalid/);
  });

  it("respects the COD switches in store settings", async () => {
    const [disabled] = await runStepsWithSetup(db, ["update store_settings set cod_enabled = false"], anon, [placeOrder()]);
    expect(disabled).toMatch(/checkout:cod_disabled/);
    const [limited] = await runStepsWithSetup(db, ["update store_settings set cod_max_order_paisa = 100"], anon, [placeOrder()]);
    expect(limited).toMatch(/checkout:cod_limit/);
  });
});

describe("get_order_tracking", () => {
  const track = (secret: string | null) =>
    `select public.get_order_tracking('${guestOrderNumber}', ${secret === null ? "null" : `'${secret}'`})`;
  const guestSetup = () => [`update orders set guest_tracking_hash = ${SECRET_HASH_SQL} where order_number = '${guestOrderNumber}'`];

  it("returns the order to a guest with the right secret, with items and events", async () => {
    const [result] = (await runStepsWithSetup(db, guestSetup(), anon, [track(SECRET)])) as Record<string, unknown>[];
    expect(result).toMatchObject({ order_number: expect.any(String), payment_method: "cod" });
    expect((result!.items as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(result!.events)).toBe(true);
  });

  it("returns nothing for a wrong or missing secret", async () => {
    expect((await runStepsWithSetup(db, guestSetup(), anon, [track("wrong-secret-0000000000")]))[0]).toBeNull();
    expect((await runStepsWithSetup(db, guestSetup(), anon, [track(null)]))[0]).toBeNull();
  });

  it("returns a signed-in customer's own order without a secret, and not someone else's", async () => {
    const ownNumber = await scalar<string>(`select order_number from orders where user_id = '${customerProfileId}' limit 1`);
    const call = `select public.get_order_tracking('${ownNumber}') is not null`;
    expect(await runAs(db, customer, call)).toBe(true);
    expect(await runAs(db, otherCustomer, call)).toBe(false);
    expect(await runAs(db, anon, call)).toBe(false);
  });

  it("ignores malformed order numbers", async () => {
    expect(await runAs(db, anon, "select public.get_order_tracking('x'' or 1=1', null)")).toBeNull();
  });
});

describe("access boundaries", () => {
  it("keeps the order tables closed to anon", async () => {
    expect(await runAs(db, anon, "select count(*) from orders")).toMatch(/permission denied/);
    expect(await runAs(db, anon, "select count(*) from order_items")).toMatch(/permission denied/);
  });

  it("keeps the pricing core private", async () => {
    const call = `select public.checkout_price('[]'::jsonb, null, null, null, null, null)`;
    expect(await runAs(db, anon, call)).toMatch(/permission denied/);
    expect(await runAs(db, customer, call)).toMatch(/permission denied/);
  });
});

describe("nearest_municipality", () => {
  it("suggests the closest municipality for coordinates in Nepal", async () => {
    const [target] = await rows<{ code: string; latitude: string; longitude: string }>(
      "select code, latitude, longitude from nepal_municipalities where latitude is not null order by code limit 1",
    );
    const result = await runAs(
      db,
      anon,
      `select municipality_code from public.nearest_municipality(${target!.latitude}, ${target!.longitude})`,
    );
    expect(result).toBe(target!.code);
  });

  it("returns nothing outside Nepal", async () => {
    expect(await runAs(db, anon, "select count(*)::int from public.nearest_municipality(51.5, -0.1)")).toBe(0);
  });
});
