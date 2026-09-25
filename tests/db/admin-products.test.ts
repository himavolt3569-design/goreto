// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Product editor functions (migration admin_product_editor): save, delete,
 * photo order and the publish check, per role. Every test runs in a
 * rolled-back transaction, so products created here never touch the seed.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager"); // catalog.write + content.manage
const fulfilmentStaff = as("user_seed_staff_fulfilment"); // catalog.read, no catalog.write
const writerOnly = as("user_test_catalog_writer");
let customer: Session;

/** A staff member with catalog.read + catalog.write only (no content.manage). */
const setupWriterOnly = [
  "insert into profiles (clerk_user_id, role) values ('user_test_catalog_writer', 'staff')",
  `insert into staff_permissions (profile_id, permission_key)
     select id, unnest(array['catalog.read', 'catalog.write']::staff_permission[]) from profiles
     where clerk_user_id = 'user_test_catalog_writer'`,
];

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

let categoryId = "";
let collectionIds: string[] = [];
let orderedProductId = "";

const OPTIONS = [
  { name: "Colour", values: [{ value: "tan", label: "Tan", swatch_hex: "#C19A6B" }, { value: "black", label: "Black", swatch_hex: null }] },
  { name: "Size", values: [{ value: "s", label: "S" }, { value: "m", label: "M" }] },
];

type VariantInput = {
  id?: string | null;
  sku: string;
  option_values: Record<string, string>;
  price_paisa?: number | null;
  weight_grams?: number | null;
  is_active?: boolean;
  initial_stock?: number;
};

function variants(stem: string): VariantInput[] {
  return [
    ["tan", "s"],
    ["tan", "m"],
    ["black", "s"],
    ["black", "m"],
  ].map(([colour, size]) => ({
    sku: `GRT-${stem}-${colour!.toUpperCase()}-${size!.toUpperCase()}`,
    option_values: { Colour: colour!, Size: size! },
    is_active: true,
    initial_stock: 5,
  }));
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Tote",
    slug: "test-tote",
    category_id: categoryId,
    short_description: "A test bag.",
    description: "",
    base_price_paisa: 249950,
    compare_at_price_paisa: null,
    status: "draft",
    is_featured: false,
    is_bestseller: false,
    is_limited_edition: false,
    low_stock_threshold: 3,
    options: OPTIONS,
    specs: [{ label: "Material", value: "Canvas" }],
    care_instructions: "",
    tags: ["tote", "canvas"],
    ...overrides,
  };
}

const json = (value: unknown) => `$json$${JSON.stringify(value)}$json$::jsonb`;
const uuids = (ids: string[] | null) => (ids === null ? "null" : `array[${ids.map((id) => `'${id}'`).join(",")}]::uuid[]`);

function saveSql(productId: string | null, payload: object, variantRows: VariantInput[], collections: string[] | null = null) {
  return `select public.admin_save_product(${productId ? `'${productId}'` : "null"}, ${json(payload)}, ${json(variantRows)}, ${uuids(collections)})`;
}

/** Creates the test product in the same transaction; later steps can read its id with TEST_ID. */
const createStep = () => saveSql(null, product(), variants("TTOTE"));
const TEST_ID = "(select id from products where slug = 'test-tote')";

const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  customer = as(await scalar<string>("select clerk_user_id from profiles where role = 'customer' and deleted_at is null order by id limit 1"));
  categoryId = await scalar<string>("select id from categories where parent_id is not null order by sort_order limit 1");
  collectionIds = (await db.query<{ id: string }>("select id from collections order by sort_order limit 2")).rows.map((row) => row.id);
  orderedProductId = await scalar<string>("select product_id from order_items where product_id is not null order by id limit 1");
}, 120_000);

describe("admin_save_product access", () => {
  it("is refused to anon, customers and staff without catalog.write", async () => {
    expect(await runAs(db, anon, createStep())).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, createStep())).toMatch(/catalog.write required/);
    expect(await runAs(db, fulfilmentStaff, createStep())).toMatch(/catalog.write required/);
  });

  it("refuses collection links without content.manage, but saves without them", async () => {
    const [linked] = await runStepsWithSetup(db, setupWriterOnly, writerOnly, [
      saveSql(null, product(), variants("TTOTE"), collectionIds),
    ]);
    expect(linked).toMatch(/content.manage required/);

    const [saved] = await runStepsWithSetup(db, setupWriterOnly, writerOnly, [createStep()]);
    expect(isError(saved)).toBe(false);
  });
});

describe("admin_save_product create", () => {
  it("creates the product, its variants with starting stock, and collection links", async () => {
    const outcomes = await runStepsAs(db, catalogStaff, [
      saveSql(null, product({ status: "active" }), variants("TTOTE"), collectionIds),
      `select jsonb_build_object('status', status, 'published', published_at is not null, 'options', jsonb_array_length(options), 'tags', tags) from products where id = ${TEST_ID}`,
      `select jsonb_agg(jsonb_build_object('sku', sku, 'stock', stock_quantity, 'sort', sort_order) order by sort_order) from product_variants where product_id = ${TEST_ID}`,
      `select count(*)::int from collection_products where product_id = ${TEST_ID}`,
    ]);
    const [result, row, variantRows, links] = outcomes;
    expect(result).toMatchObject({ slug: "test-tote", previous_slug: null, deactivated_skus: [] });
    expect(row).toEqual({ status: "active", published: true, options: 2, tags: ["tote", "canvas"] });
    expect(variantRows).toEqual([
      { sku: "GRT-TTOTE-TAN-S", stock: 5, sort: 0 },
      { sku: "GRT-TTOTE-TAN-M", stock: 5, sort: 1 },
      { sku: "GRT-TTOTE-BLACK-S", stock: 5, sort: 2 },
      { sku: "GRT-TTOTE-BLACK-M", stock: 5, sort: 3 },
    ]);
    expect(links).toBe(2);
  });

  it("creates a product without options as one variant", async () => {
    const [result] = await runStepsAs(db, owner, [
      saveSql(null, product({ options: [] }), [{ sku: "GRT-TTOTE-STD", option_values: {}, is_active: true, initial_stock: 0 }]),
    ]);
    expect(isError(result)).toBe(false);
  });
});

describe("admin_save_product validation", () => {
  const cases: [string, () => string, RegExp][] = [
    ["an existing slug", () => saveSql(null, product({ slug: "__EXISTING__" }), variants("TTOTE")), /already uses this URL slug/],
    ["a SKU another product uses", () => saveSql(null, product(), [{ ...variants("TTOTE")[0]!, sku: "__EXISTING_SKU__" }, ...variants("TTOTE").slice(1)]), /already used by another variant/],
    ["duplicate SKUs", () => saveSql(null, product(), variants("TTOTE").map((row) => ({ ...row, sku: "GRT-DUP" }))), /own SKU/],
    ["duplicate combinations", () => saveSql(null, product(), [variants("A")[0]!, { ...variants("B")[0]! }]), /same option combination/],
    ["a missing option value", () => saveSql(null, product(), [{ sku: "GRT-X", option_values: { Colour: "tan" } }]), /one value for each option/],
    ["an unknown option value", () => saveSql(null, product(), [{ sku: "GRT-X", option_values: { Colour: "red", Size: "s" } }]), /one value for each option/],
    ["two variants without options", () => saveSql(null, product({ options: [] }), [{ sku: "GRT-A", option_values: {} }, { sku: "GRT-B", option_values: {} }]), /exactly one variant/],
    ["no variants", () => saveSql(null, product(), []), /1 to 100 variants/],
    ["four options", () => saveSql(null, product({ options: [...OPTIONS, { name: "Strap", values: [{ value: "a", label: "A" }] }, { name: "Lining", values: [{ value: "b", label: "B" }] }] }), variants("TTOTE")), /at most 3 options/],
    ["a bad swatch", () => saveSql(null, product({ options: [{ name: "Colour", values: [{ value: "tan", label: "Tan", swatch_hex: "red" }] }] }), [{ sku: "GRT-X", option_values: { Colour: "tan" } }]), /#RRGGBB/],
    ["active without an active variant", () => saveSql(null, product({ status: "active" }), variants("TTOTE").map((row) => ({ ...row, is_active: false }))), /at least one active variant/],
    ["compare-at not above the price", () => saveSql(null, product({ compare_at_price_paisa: 100 }), variants("TTOTE")), /check constraint/],
  ];

  it.each(cases)("rejects %s", async (_label, sql, message) => {
    const existingSlug = await scalar<string>("select slug from products order by slug limit 1");
    const existingSku = await scalar<string>("select sku from product_variants order by sku limit 1");
    const statement = sql().replace("__EXISTING__", existingSlug).replace("__EXISTING_SKU__", existingSku);
    expect(await runAs(db, owner, statement)).toMatch(message);
  });

  it("names the field in the error detail", async () => {
    const existingSlug = await scalar<string>("select slug from products order by slug limit 1");
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: "user_seed_owner", role: "authenticated" })]);
      await tx.exec("set local role authenticated");
      const error = await tx.query(saveSql(null, product({ slug: existingSlug }), variants("TTOTE"))).catch((caught: { detail?: string }) => caught);
      expect((error as { detail?: string }).detail).toBe("slug");
      await tx.rollback();
    }).catch(() => undefined);
  });
});

describe("admin_save_product update", () => {
  it("never changes the stock of existing variants", async () => {
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      `select public.admin_adjust_stock((select id from product_variants where sku = 'GRT-TTOTE-TAN-S'), 7)`,
      `select public.admin_save_product(${TEST_ID},
         ${json(product({ title: "Test Tote II", base_price_paisa: 300000 }))},
         (select jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'option_values', option_values, 'is_active', true, 'initial_stock', 999, 'price_paisa', 310000) order by sort_order)
          from product_variants where product_id = ${TEST_ID}),
         null)`,
      `select jsonb_build_object('title', title, 'price', base_price_paisa) from products where id = ${TEST_ID}`,
      `select jsonb_object_agg(sku, jsonb_build_array(stock_quantity, price_paisa)) from product_variants where product_id = ${TEST_ID}`,
    ]);
    expect(outcomes[3]).toEqual({ title: "Test Tote II", price: 300000 });
    expect(outcomes[4]).toEqual({
      "GRT-TTOTE-TAN-S": [12, 310000],
      "GRT-TTOTE-TAN-M": [5, 310000],
      "GRT-TTOTE-BLACK-S": [5, 310000],
      "GRT-TTOTE-BLACK-M": [5, 310000],
    });
  });

  it("deletes removed variants that were never ordered and keeps their photos", async () => {
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      `insert into product_media (product_id, variant_id, storage_path) values (${TEST_ID}, (select id from product_variants where sku = 'GRT-TTOTE-BLACK-M'), 'products/test-tote/01.jpg')`,
      `select public.admin_save_product(${TEST_ID}, ${json(product())},
         (select jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'option_values', option_values, 'is_active', true) order by sort_order)
          from product_variants where product_id = ${TEST_ID} and sku <> 'GRT-TTOTE-BLACK-M'),
         null)`,
      `select count(*)::int from product_variants where product_id = ${TEST_ID}`,
      `select count(*)::int from product_media where product_id = ${TEST_ID} and variant_id is null`,
    ]);
    expect(outcomes[2]).toMatchObject({ deactivated_skus: [] });
    expect(outcomes[3]).toBe(3);
    expect(outcomes[4]).toBe(1);
  });

  it("deactivates removed variants that were ordered, and reuses them when the combination returns", async () => {
    const orderedVariant = await scalar<string>("select variant_id from order_items where variant_id is not null order by id limit 1");
    const productId = await scalar<string>(`select product_id from product_variants where id = '${orderedVariant}'`);
    const current = `(select jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'option_values', option_values, 'is_active', is_active, 'price_paisa', price_paisa) order by sort_order) from product_variants where product_id = '${productId}'`;
    const productJson = `(select jsonb_build_object(
        'title', title, 'slug', slug, 'category_id', category_id, 'base_price_paisa', base_price_paisa,
        'compare_at_price_paisa', compare_at_price_paisa, 'status', 'draft', 'low_stock_threshold', low_stock_threshold,
        'options', options, 'specs', specs, 'tags', to_jsonb(tags)) from products where id = '${productId}')`;
    const variantCount = await scalar<number>(`select count(*)::int from product_variants where product_id = '${productId}'`);

    const outcomes = await runStepsAs(db, owner, [
      // Remove the ordered variant: it stays, inactive.
      `select public.admin_save_product('${productId}', ${productJson}, ${current} and id <> '${orderedVariant}'), null)`,
      `select jsonb_build_object('exists', count(*), 'active', bool_or(is_active)) from product_variants where id = '${orderedVariant}'`,
      // Add the same combination back without an id: the same row returns.
      `select public.admin_save_product('${productId}', ${productJson},
         ${current} and id <> '${orderedVariant}') || jsonb_build_array((select jsonb_build_object('sku', sku, 'option_values', option_values, 'is_active', true, 'initial_stock', 0) from product_variants where id = '${orderedVariant}')),
         null)`,
      `select jsonb_build_object('count', (select count(*)::int from product_variants where product_id = '${productId}'), 'active', (select is_active from product_variants where id = '${orderedVariant}'))`,
    ]);
    const orderedSku = await scalar<string>(`select sku from product_variants where id = '${orderedVariant}'`);
    expect(outcomes[0]).toMatchObject({ deactivated_skus: [orderedSku] });
    expect(outcomes[1]).toEqual({ exists: 1, active: false });
    expect(isError(outcomes[2])).toBe(false);
    expect(outcomes[3]).toEqual({ count: variantCount, active: true });
  });

  it("rejects a variant id from another product", async () => {
    const foreignVariant = await scalar<string>("select id from product_variants order by id limit 1");
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      saveSql(null, product({ slug: "test-tote-2" }), [{ id: foreignVariant, sku: "GRT-X", option_values: { Colour: "tan", Size: "s" }, is_active: true }]),
    ]);
    expect(outcomes[1]).toMatch(/variant not found/);
  });

  it("replaces collection links when given, and leaves them when null", async () => {
    const outcomes = await runStepsAs(db, catalogStaff, [
      saveSql(null, product(), variants("TTOTE"), collectionIds),
      `select public.admin_save_product(${TEST_ID}, ${json(product())},
         (select jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'option_values', option_values, 'is_active', true)) from product_variants where product_id = ${TEST_ID}),
         null)`,
      `select count(*)::int from collection_products where product_id = ${TEST_ID}`,
      `select public.admin_save_product(${TEST_ID}, ${json(product())},
         (select jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'option_values', option_values, 'is_active', true)) from product_variants where product_id = ${TEST_ID}),
         ${uuids([collectionIds[0]!])})`,
      `select array_agg(collection_id::text) from collection_products where product_id = ${TEST_ID}`,
    ]);
    expect(outcomes[2]).toBe(2);
    expect(outcomes[4]).toEqual([collectionIds[0]]);
  });
});

describe("admin_delete_product", () => {
  it("deletes a never-ordered product and returns its media keys", async () => {
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      `insert into product_media (product_id, storage_path) values (${TEST_ID}, 'products/test-tote/01.jpg'), (${TEST_ID}, 'products/test-tote/02.jpg')`,
      `select public.admin_delete_product(${TEST_ID})`,
      "select count(*)::int from products where slug = 'test-tote'",
      "select count(*)::int from product_variants where sku like 'GRT-TTOTE-%'",
    ]);
    expect([...(outcomes[2] as string[])].sort()).toEqual(["products/test-tote/01.jpg", "products/test-tote/02.jpg"]);
    expect(outcomes[3]).toBe(0);
    expect(outcomes[4]).toBe(0);
  });

  it("refuses a product that has orders, even for catalog staff who can't see orders", async () => {
    expect(await runAs(db, catalogStaff, `select public.admin_delete_product('${orderedProductId}')`)).toMatch(/has orders/);
    expect(await runAs(db, owner, `select public.admin_delete_product('${orderedProductId}')`)).toMatch(/has orders/);
  });

  it("is refused without catalog.write", async () => {
    expect(await runAs(db, fulfilmentStaff, `select public.admin_delete_product('${orderedProductId}')`)).toMatch(/catalog.write required/);
    expect(await runAs(db, anon, `select public.admin_delete_product('${orderedProductId}')`)).toMatch(/^error:permission denied/);
  });
});

describe("order history helpers", () => {
  it("answer for catalog staff and refuse everyone else", async () => {
    expect(await runAs(db, catalogStaff, `select public.admin_product_has_orders('${orderedProductId}')`)).toBe(true);
    expect(await runAs(db, catalogStaff, `select count(*)::int from public.admin_ordered_variant_ids('${orderedProductId}')`)).toBeGreaterThan(0);
    expect(await runAs(db, fulfilmentStaff, `select public.admin_product_has_orders('${orderedProductId}')`)).toMatch(/catalog.write required/);
    expect(await runAs(db, customer, `select count(*) from public.admin_ordered_variant_ids('${orderedProductId}')`)).toMatch(/catalog.write required/);
    expect(await runAs(db, anon, `select public.admin_product_has_orders('${orderedProductId}')`)).toMatch(/^error:permission denied/);
  });
});

describe("admin_reorder_product_media", () => {
  const media = `(select array_agg(id order by storage_path desc) from product_media where product_id = ${TEST_ID})`;

  it("sets the order from the list", async () => {
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      `insert into product_media (product_id, storage_path, sort_order) values (${TEST_ID}, 'products/test-tote/01.jpg', 0), (${TEST_ID}, 'products/test-tote/02.jpg', 1)`,
      `select public.admin_reorder_product_media(${TEST_ID}, ${media})`,
      `select array_agg(storage_path order by sort_order) from product_media where product_id = ${TEST_ID}`,
    ]);
    expect(outcomes[3]).toEqual(["products/test-tote/02.jpg", "products/test-tote/01.jpg"]);
  });

  it("needs every photo exactly once", async () => {
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      `insert into product_media (product_id, storage_path) values (${TEST_ID}, 'products/test-tote/01.jpg'), (${TEST_ID}, 'products/test-tote/02.jpg')`,
      `select public.admin_reorder_product_media(${TEST_ID}, (select array_agg(id) from (select id from product_media where product_id = ${TEST_ID} limit 1) m))`,
    ]);
    expect(outcomes[2]).toMatch(/photo list changed/);
  });
});

describe("admin_set_product_status", () => {
  it("won't publish a product without an active variant", async () => {
    const outcomes = await runStepsAs(db, owner, [
      createStep(),
      `update product_variants set is_active = false where product_id = ${TEST_ID}`,
      `select public.admin_set_product_status(${TEST_ID}, 'active')`,
    ]);
    expect(outcomes[2]).toMatch(/active variant before publishing/);
  });

  it("still reports a missing product as not found", async () => {
    expect(await runAs(db, owner, "select public.admin_set_product_status(gen_random_uuid(), 'active')")).toMatch(/product not found/);
  });
});
