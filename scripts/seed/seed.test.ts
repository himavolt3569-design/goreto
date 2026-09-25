// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { seedProducts } from "@/test/fixtures/catalog";
import { SEED_PATH, generateSeedLines } from "./generate.ts";
import { TABLE_ORDER, type SeedLine, type SeedTables, type TableName } from "./types.ts";

type Row = Record<string, unknown>;
type Meta = { reference_now: string; counts: Record<string, number> };

let text = "";
let meta: Meta;
let lines: SeedLine[] = [];
const rows = {} as { [T in TableName]: SeedTables[T][] };
const byId = new Map<string, Map<unknown, Row>>();

function index<T extends TableName>(table: T, key = "id"): Map<unknown, SeedTables[T]> {
  const cacheKey = `${table}.${key}`;
  if (!byId.has(cacheKey)) {
    byId.set(cacheKey, new Map((rows[table] as Row[]).map((row) => [row[key], row])));
  }
  return byId.get(cacheKey) as Map<unknown, SeedTables[T]>;
}

function duplicates(values: unknown[]): unknown[] {
  const seen = new Set<unknown>();
  return values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

beforeAll(() => {
  text = readFileSync(SEED_PATH, "utf8");
  const parsed = text.trimEnd().split("\n").map((line) => JSON.parse(line) as { table: string; data: unknown; dev?: unknown });
  const first = parsed.shift()!;
  expect(first.table).toBe("_meta");
  meta = first.data as Meta;
  lines = parsed as SeedLine[];
  for (const table of TABLE_ORDER) (rows as Record<string, unknown[]>)[table] = [];
  for (const line of lines) (rows as Record<string, unknown[]>)[line.table]?.push(line.data);
});

describe("seed file format", () => {
  it("is exactly what the generator produces (deterministic and up to date)", () => {
    expect(text).toBe(`${generateSeedLines().join("\n")}\n`);
  });

  it("uses known tables in foreign-key order, matching the _meta counts", () => {
    let position = 0;
    for (const line of lines) {
      const tablePosition = TABLE_ORDER.indexOf(line.table);
      expect(tablePosition, `unknown table ${line.table}`).toBeGreaterThanOrEqual(0);
      expect(tablePosition).toBeGreaterThanOrEqual(position);
      position = tablePosition;
    }
    for (const table of TABLE_ORDER) expect(rows[table].length, table).toBe(meta.counts[table]);
  });

  it("only uses documented dev hints", () => {
    for (const line of lines) {
      if (!line.dev) continue;
      expect(Object.keys(line.dev).every((key) => key === "placeholder_url" || key === "tracking_secret")).toBe(true);
      if (line.dev.placeholder_url) expect(line.dev.placeholder_url).toMatch(/^https:\/\/picsum\.photos\/id\/\d+\/\d+\/\d+$/);
    }
  });
});

describe("keys and references", () => {
  it("has unique primary and natural keys", () => {
    for (const table of TABLE_ORDER) {
      const sample = rows[table][0] as Row | undefined;
      if (sample && "id" in sample) expect(duplicates((rows[table] as Row[]).map((row) => row.id)), table).toEqual([]);
    }
    const unique: [TableName, (row: Row) => unknown][] = [
      ["nepal_provinces", (row) => row.code],
      ["nepal_districts", (row) => row.code],
      ["nepal_municipalities", (row) => row.code],
      ["profiles", (row) => row.clerk_user_id],
      ["categories", (row) => row.slug],
      ["products", (row) => row.slug],
      ["product_variants", (row) => row.sku],
      ["collections", (row) => row.slug],
      ["collection_products", (row) => `${row.collection_id}:${row.product_id}`],
      ["coupons", (row) => row.code],
      ["orders", (row) => row.order_number],
      ["shipments", (row) => row.order_id],
      ["reviews", (row) => `${row.user_id}:${row.product_id}`],
      ["wishlist_items", (row) => `${row.user_id}:${row.product_id}`],
      ["newsletter_subscribers", (row) => row.email],
      ["staff_permissions", (row) => `${row.profile_id}:${row.permission_key}`],
    ];
    for (const [table, key] of unique) expect(duplicates((rows[table] as Row[]).map(key)), table).toEqual([]);
    const emails = rows.profiles.map((row) => row.email).filter(Boolean);
    expect(duplicates(emails)).toEqual([]);
    const tracking = rows.shipments.map((row) => row.tracking_number).filter(Boolean);
    expect(duplicates(tracking)).toEqual([]);
  });

  it("resolves every foreign key to a row that appears earlier in the file", () => {
    const refs: [TableName, string, TableName, string][] = [
      ["nepal_districts", "province_code", "nepal_provinces", "code"],
      ["nepal_municipalities", "district_code", "nepal_districts", "code"],
      ["store_settings", "dispatch_municipality_code", "nepal_municipalities", "code"],
      ["staff_permissions", "profile_id", "profiles", "id"],
      ["staff_permissions", "granted_by", "profiles", "id"],
      ["customer_addresses", "user_id", "profiles", "id"],
      ["customer_addresses", "province_code", "nepal_provinces", "code"],
      ["customer_addresses", "district_code", "nepal_districts", "code"],
      ["customer_addresses", "municipality_code", "nepal_municipalities", "code"],
      ["categories", "parent_id", "categories", "id"],
      ["products", "category_id", "categories", "id"],
      ["product_variants", "product_id", "products", "id"],
      ["product_media", "product_id", "products", "id"],
      ["product_media", "variant_id", "product_variants", "id"],
      ["product_ar_assets", "product_id", "products", "id"],
      ["collection_products", "collection_id", "collections", "id"],
      ["collection_products", "product_id", "products", "id"],
      ["courier_services", "courier_id", "couriers", "id"],
      ["delivery_rates", "zone_id", "delivery_zones", "id"],
      ["delivery_rates", "courier_service_id", "courier_services", "id"],
      ["orders", "user_id", "profiles", "id"],
      ["orders", "courier_service_id", "courier_services", "id"],
      ["orders", "coupon_id", "coupons", "id"],
      ["order_items", "order_id", "orders", "id"],
      ["order_items", "product_id", "products", "id"],
      ["order_items", "variant_id", "product_variants", "id"],
      ["shipments", "order_id", "orders", "id"],
      ["shipments", "courier_id", "couriers", "id"],
      ["shipments", "courier_service_id", "courier_services", "id"],
      ["shipment_events", "shipment_id", "shipments", "id"],
      ["reviews", "user_id", "profiles", "id"],
      ["reviews", "product_id", "products", "id"],
      ["reviews", "order_item_id", "order_items", "id"],
      ["reviews", "moderated_by", "profiles", "id"],
      ["wishlist_items", "user_id", "profiles", "id"],
      ["wishlist_items", "product_id", "products", "id"],
      ["newsletter_subscribers", "profile_id", "profiles", "id"],
    ];
    const lineOf = new Map<string, number>();
    lines.forEach((line, position) => {
      const data = line.data as Row;
      const key = "id" in data ? data.id : "code" in data ? data.code : null;
      if (key !== null) lineOf.set(`${line.table}:${String(key)}`, position);
    });
    lines.forEach((line, position) => {
      for (const [table, column, target] of refs) {
        if (line.table !== table) continue;
        const value = (line.data as Row)[column];
        if (value === null) continue;
        const targetLine = lineOf.get(`${target}:${String(value)}`);
        expect(targetLine, `${table}.${column} -> ${target} (${String(value)})`).toBeDefined();
        expect(targetLine!).toBeLessThan(position);
      }
    });
  });
});

describe("domain rules", () => {
  it("uses only the enum values from AGENTS §11", () => {
    const enums: [TableName, string, string[]][] = [
      ["profiles", "role", ["customer", "owner", "staff"]],
      ["products", "status", ["draft", "active", "archived"]],
      ["product_ar_assets", "mode", ["live_2d", "live_3d"]],
      ["product_ar_assets", "placement", ["ear", "face", "neck", "wrist", "hand", "upper_body", "full_body", "freeform"]],
      ["reviews", "status", ["pending", "published", "rejected"]],
      ["coupons", "type", ["fixed", "percentage"]],
      ["couriers", "integration_mode", ["manual", "api"]],
      ["courier_services", "service_level", ["standard", "express", "pickup"]],
      ["orders", "status", ["pending_confirmation", "confirmed", "processing", "packed", "shipped", "delivered", "canceled"]],
      ["orders", "payment_method", ["cod"]],
      ["orders", "payment_status", ["pending", "collected", "failed", "refunded"]],
      ["orders", "currency", ["NPR"]],
      ["shipments", "status", ["awaiting_assignment", "assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "exception", "returned"]],
      ["shipment_events", "status", ["awaiting_assignment", "assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "exception", "returned"]],
    ];
    for (const [table, column, allowed] of enums) {
      for (const row of rows[table] as Row[]) expect(allowed, `${table}.${column}`).toContain(row[column]);
    }
    expect(rows.profiles.filter((row) => row.role === "owner")).toHaveLength(1);
    const staffIds = new Set(rows.profiles.filter((row) => row.role === "staff").map((row) => row.id));
    for (const permission of rows.staff_permissions) expect(staffIds.has(permission.profile_id)).toBe(true);
  });

  it("stores money as non-negative integer paisa", () => {
    for (const line of lines) {
      for (const [column, value] of Object.entries(line.data as Row)) {
        if (!column.endsWith("_paisa") || value === null) continue;
        expect(Number.isSafeInteger(value) && (value as number) >= 0, `${line.table}.${column}`).toBe(true);
      }
    }
  });

  it("never records anything after the reference 'now'", () => {
    const now = meta.reference_now;
    const scheduled = new Set(["coupons.starts_at", "coupons.ends_at", "collections.starts_at", "collections.ends_at"]);
    for (const line of lines) {
      for (const [column, value] of Object.entries(line.data as Row)) {
        if (!column.endsWith("_at") || value === null || scheduled.has(`${line.table}.${column}`)) continue;
        expect((value as string) <= now, `${line.table}.${column} = ${String(value)}`).toBe(true);
      }
    }
  });

  it("keeps people fictional", () => {
    const emails = [
      ...rows.profiles.map((row) => row.email),
      ...rows.orders.map((row) => row.contact_email),
      ...rows.newsletter_subscribers.map((row) => row.email),
    ].filter((email): email is string => email !== null);
    for (const email of emails) expect(email).toMatch(/^[a-z0-9._]+@example\.(com|net|org)$/);
    for (const profile of rows.profiles) expect(profile.clerk_user_id).toMatch(/^user_seed_/);
    for (const order of rows.orders) expect(order.contact_phone_e164).toMatch(/^\+9779[78]\d{8}$/);
  });

  it("anonymises deleted profiles", () => {
    const deleted = rows.profiles.filter((row) => row.deleted_at !== null);
    expect(deleted.length).toBeGreaterThan(0);
    for (const profile of deleted) expect([profile.full_name, profile.email, profile.phone_e164]).toEqual([null, null, null]);
  });
});

describe("geography and addresses", () => {
  it("puts every district in exactly one delivery zone", () => {
    const zoneCount = new Map<string, number>();
    for (const zone of rows.delivery_zones) for (const code of zone.district_codes) zoneCount.set(code, (zoneCount.get(code) ?? 0) + 1);
    expect(rows.nepal_districts).toHaveLength(77);
    expect(rows.nepal_provinces).toHaveLength(7);
    for (const district of rows.nepal_districts) expect(zoneCount.get(district.code), district.code).toBe(1);
  });

  it("keeps address hierarchy and wards consistent", () => {
    const municipalities = index("nepal_municipalities", "code");
    const districts = index("nepal_districts", "code");
    const snapshots = [...rows.customer_addresses, ...rows.orders.map((order) => order.shipping_address)];
    for (const address of snapshots) {
      const municipality = municipalities.get(address.municipality_code)!;
      expect(municipality.district_code).toBe(address.district_code);
      expect(districts.get(address.district_code)!.province_code).toBe(address.province_code);
      expect(address.ward).toBeGreaterThanOrEqual(1);
      expect(address.ward).toBeLessThanOrEqual(municipality.ward_count);
    }
  });

  it("gives each customer with addresses exactly one default", () => {
    const defaults = new Map<string, number>();
    for (const address of rows.customer_addresses) defaults.set(address.user_id, (defaults.get(address.user_id) ?? 0) + (address.is_default ? 1 : 0));
    for (const [userId, count] of defaults) expect(count, userId).toBe(1);
  });
});

describe("catalog", () => {
  it("keeps the existing dev-seed products identical", () => {
    const products = index("products", "slug");
    const variantsByProduct = new Map<string, SeedTables["product_variants"][]>();
    for (const variant of rows.product_variants) variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), variant]);
    for (const expected of seedProducts) {
      const product = products.get(expected.slug);
      expect(product, expected.slug).toBeDefined();
      expect(product!.title).toBe(expected.title);
      expect(product!.base_price_paisa).toBe(expected.basePricePaisa);
      const variants = variantsByProduct.get(product!.id)!;
      expect(variants.map((variant) => [variant.sku, variant.price_paisa, variant.stock_quantity]).sort()).toEqual(
        expected.variants.map((variant) => [variant.sku, variant.pricePaisa, variant.stockQuantity]).sort(),
      );
    }
  });

  it("has sane stock, prices and option values", () => {
    const products = index("products");
    for (const variant of rows.product_variants) {
      expect(variant.stock_quantity, variant.sku).toBeGreaterThanOrEqual(0);
      const product = products.get(variant.product_id)!;
      for (const [name, value] of Object.entries(variant.option_values)) {
        const option = product.options.find((candidate) => candidate.name === name);
        expect(option?.values.some((candidate) => candidate.value === value), `${variant.sku} ${name}`).toBe(true);
      }
    }
    for (const product of rows.products) {
      if (product.compare_at_price_paisa !== null) expect(product.compare_at_price_paisa).toBeGreaterThan(product.base_price_paisa);
      expect(product.status === "draft" ? product.published_at === null : product.published_at !== null).toBe(true);
      expect(product.status === "archived").toBe(product.archived_at !== null);
    }
  });
});

describe("orders", () => {
  it("adds up: line totals, subtotal, discount, delivery fee and total", () => {
    const itemsByOrder = new Map<string, SeedTables["order_items"][]>();
    for (const item of rows.order_items) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
    for (const order of rows.orders) {
      const items = itemsByOrder.get(order.id) ?? [];
      expect(items.length, order.order_number).toBeGreaterThan(0);
      for (const item of items) expect(item.line_total_paisa).toBe(item.unit_price_paisa * item.quantity);
      expect(order.subtotal_paisa).toBe(items.reduce((sum, item) => sum + item.line_total_paisa, 0));
      expect(order.discount_paisa).toBeLessThanOrEqual(order.subtotal_paisa);
      expect(order.total_paisa).toBe(order.subtotal_paisa - order.discount_paisa + order.delivery_fee_paisa);
    }
  });

  it("snapshots the purchased product and variant", () => {
    const products = index("products");
    const variants = index("product_variants");
    for (const item of rows.order_items) {
      const variant = variants.get(item.variant_id)!;
      expect(variant.product_id).toBe(item.product_id);
      expect(item.sku).toBe(variant.sku);
      expect(item.product_title).toBe(products.get(item.product_id)!.title);
    }
  });

  it("applies coupons inside their rules and counts every use", () => {
    const coupons = index("coupons");
    const uses = new Map<string, number>();
    for (const order of rows.orders) {
      if (order.coupon_id === null) {
        expect(order.discount_paisa).toBe(0);
        continue;
      }
      const coupon = coupons.get(order.coupon_id)!;
      uses.set(coupon.id, (uses.get(coupon.id) ?? 0) + 1);
      expect(order.coupon_code).toBe(coupon.code);
      expect(coupon.is_active).toBe(true);
      expect(order.created_at >= coupon.starts_at).toBe(true);
      if (coupon.ends_at) expect(order.created_at <= coupon.ends_at).toBe(true);
      if (coupon.min_order_paisa !== null) expect(order.subtotal_paisa).toBeGreaterThanOrEqual(coupon.min_order_paisa);
      const expected =
        coupon.type === "fixed"
          ? Math.min(coupon.amount_off_paisa!, order.subtotal_paisa)
          : Math.min(Math.floor((order.subtotal_paisa * coupon.percent_off!) / 100 / 100) * 100, coupon.max_discount_paisa ?? Infinity);
      expect(order.discount_paisa, order.order_number).toBe(expected);
    }
    for (const coupon of rows.coupons) {
      expect(coupon.times_used, coupon.code).toBe(uses.get(coupon.id) ?? 0);
      if (coupon.usage_limit !== null) expect(coupon.times_used).toBeLessThanOrEqual(coupon.usage_limit);
    }
  });

  it("charges the active rate for the address zone and chosen service", () => {
    const zoneOfDistrict = new Map<string, string>();
    for (const zone of rows.delivery_zones) for (const code of zone.district_codes) zoneOfDistrict.set(code, zone.id);
    const rates = new Map(rows.delivery_rates.filter((rate) => rate.is_active).map((rate) => [`${rate.zone_id}:${rate.courier_service_id}`, rate]));
    for (const order of rows.orders) {
      const zoneId = zoneOfDistrict.get(order.shipping_address.district_code)!;
      const rate = rates.get(`${zoneId}:${order.courier_service_id}`);
      expect(rate, order.order_number).toBeDefined();
      expect(order.delivery_fee_paisa).toBe(rate!.price_paisa);
      expect(order.delivery_snapshot.zone_id).toBe(zoneId);
      expect(order.delivery_snapshot.price_paisa).toBe(rate!.price_paisa);
    }
  });

  it("keeps order, payment and lifecycle timestamps consistent", () => {
    for (const order of rows.orders) {
      const stamps = [order.created_at, order.confirmed_at, order.packed_at, order.shipped_at, order.delivered_at].filter(
        (value): value is string => value !== null,
      );
      expect([...stamps].sort(), order.order_number).toEqual(stamps);
      if (order.payment_status === "collected") expect(order.status).toBe("delivered");
      if (order.payment_status === "refunded") expect(order.refunded_at).not.toBeNull();
      if (order.status === "delivered") expect(["collected", "refunded"]).toContain(order.payment_status);
      if (order.status === "canceled") {
        expect(order.payment_status).toBe("failed");
        expect(order.canceled_at).not.toBeNull();
        expect(order.cancellation_reason).not.toBeNull();
      } else {
        expect(order.canceled_at).toBeNull();
      }
      expect(order.order_number).toMatch(/^GT\d{10}$/);
    }
  });

  it("gives guest orders a verifiable tracking hash, and signed-in orders none", () => {
    for (const line of lines) {
      if (line.table !== "orders") continue;
      const order = line.data as SeedTables["orders"];
      if (order.user_id === null) {
        expect(line.dev?.tracking_secret).toBeDefined();
        expect(order.guest_tracking_hash).toBe(createHash("sha256").update(line.dev!.tracking_secret!).digest("hex"));
      } else {
        expect(order.guest_tracking_hash).toBeNull();
        expect(line.dev).toBeUndefined();
      }
    }
  });

  it("appends shipment events in order and matches the shipment status", () => {
    const orders = index("orders");
    const eventsByShipment = new Map<string, SeedTables["shipment_events"][]>();
    for (const event of rows.shipment_events) eventsByShipment.set(event.shipment_id, [...(eventsByShipment.get(event.shipment_id) ?? []), event]);
    for (const shipment of rows.shipments) {
      const events = eventsByShipment.get(shipment.id) ?? [];
      const order = orders.get(shipment.order_id)!;
      expect(events[0]?.status).toBe("awaiting_assignment");
      expect(events[0]?.occurred_at).toBe(order.created_at);
      const times = events.map((event) => event.occurred_at);
      expect([...times].sort()).toEqual(times);
      expect(shipment.status).toBe(events[events.length - 1]!.status);
      for (const event of events) expect([event.latitude, event.longitude]).toEqual([null, null]);
      if (order.status === "delivered") expect(shipment.status).toBe("delivered");
      if (shipment.status === "delivered") expect(order.status).toBe("delivered");
      expect(shipment.courier_id === null).toBe(shipment.assigned_at === null);
      expect(shipment.tracking_number === null).toBe(shipment.assigned_at === null);
    }
  });
});

describe("reviews", () => {
  it("links verified reviews to the reviewer's own delivered items", () => {
    const items = index("order_items");
    const orders = index("orders");
    for (const review of rows.reviews) {
      if (review.order_item_id === null) continue;
      const item = items.get(review.order_item_id)!;
      const order = orders.get(item.order_id)!;
      expect(item.product_id).toBe(review.product_id);
      expect(order.user_id).toBe(review.user_id);
      expect(order.status).toBe("delivered");
      expect(review.created_at > order.delivered_at!).toBe(true);
    }
  });

  it("only moderates reviews that were published or rejected", () => {
    for (const review of rows.reviews) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(review.status === "pending").toBe(review.moderated_by === null);
      expect(review.status === "rejected").toBe(review.moderation_note !== null);
    }
  });
});
