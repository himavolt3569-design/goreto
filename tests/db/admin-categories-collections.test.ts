// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Admin phase 2 (migration admin_categories_collections): the two-level
 * category tree, category delete, collection save/links and the storage
 * policy for collection hero images. Every test runs in a rolled-back
 * transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager"); // catalog.write + content.manage
const supportStaff = as("user_seed_staff_support"); // catalog.read only
const contentOnly = as("user_test_content_only");
let customer: Session;

/** A staff member with content.manage only. */
const setupContentOnly = [
  "insert into profiles (clerk_user_id, role) values ('user_test_content_only', 'staff')",
  `insert into staff_permissions (profile_id, permission_key)
     select id, 'content.manage'::staff_permission from profiles where clerk_user_id = 'user_test_content_only'`,
];

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");
const json = (value: unknown) => `$json$${JSON.stringify(value)}$json$::jsonb`;
const uuids = (ids: string[]) => `array[${ids.map((id) => `'${id}'`).join(",")}]::uuid[]`;

let topLevelId = "";
let subcategoryId = "";
let emptyTopLevelInsert = "";
let productIds: string[] = [];

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  customer = as(await scalar<string>("select clerk_user_id from profiles where role = 'customer' and deleted_at is null order by id limit 1"));
  topLevelId = await scalar<string>("select id from categories where parent_id is null and exists (select 1 from categories c where c.parent_id = categories.id) order by sort_order limit 1");
  subcategoryId = await scalar<string>(`select id from categories where parent_id = '${topLevelId}' order by sort_order limit 1`);
  productIds = (await db.query<{ id: string }>("select id from products where status = 'active' order by slug limit 3")).rows.map((row) => row.id);
  emptyTopLevelInsert = "insert into categories (title, slug) values ('Test Empty', 'test-empty')";
}, 120_000);

describe("two-level category tree", () => {
  it("refuses a subcategory as parent", async () => {
    const outcome = await runAs(db, owner, `insert into categories (title, slug, parent_id) values ('Deep', 'deep', '${subcategoryId}')`);
    expect(outcome).toMatch(/can't have its own subcategories/);
  });

  it("refuses a parent for a category that has subcategories", async () => {
    const outcomes = await runStepsAs(db, owner, [
      emptyTopLevelInsert,
      `update categories set parent_id = (select id from categories where slug = 'test-empty') where id = '${topLevelId}'`,
    ]);
    expect(outcomes.at(-1)).toMatch(/has subcategories/);
  });

  it("refuses a category as its own parent with a parentId error", async () => {
    const outcome = await runAs(db, owner, `update categories set parent_id = id where id = '${subcategoryId}'`);
    expect(outcome).toMatch(/can't be its own parent/);
  });

  it("allows a top-level parent", async () => {
    const outcome = await runAs(db, owner, `insert into categories (title, slug, parent_id) values ('Child', 'test-child', '${topLevelId}')`);
    expect(outcome).toBe("affected:1");
  });
});

describe("admin_delete_category", () => {
  it("is refused to anon, customers and staff without catalog.write", async () => {
    expect(await runAs(db, anon, `select public.admin_delete_category('${subcategoryId}')`)).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, `select public.admin_delete_category('${subcategoryId}')`)).toMatch(/catalog.write required/);
    expect(await runAs(db, supportStaff, `select public.admin_delete_category('${subcategoryId}')`)).toMatch(/catalog.write required/);
  });

  it("refuses a category with subcategories", async () => {
    expect(await runAs(db, owner, `select public.admin_delete_category('${topLevelId}')`)).toMatch(/has subcategories/);
  });

  it("sees subcategories hidden from a catalog.write-only caller", async () => {
    const outcomes = await runStepsWithSetup(
      db,
      [
        "insert into profiles (clerk_user_id, role) values ('user_test_catalog_write_only', 'staff')",
        `insert into staff_permissions (profile_id, permission_key)
           select id, 'catalog.write'::staff_permission from profiles where clerk_user_id = 'user_test_catalog_write_only'`,
        emptyTopLevelInsert,
        "insert into categories (title, slug, parent_id, is_active) select 'Hidden Child', 'test-hidden-child', id, false from categories where slug = 'test-empty'",
      ],
      as("user_test_catalog_write_only"),
      [
        "select count(*)::int from categories where slug = 'test-hidden-child'",
        "select public.admin_delete_category((select id from categories where slug = 'test-empty'))",
      ],
    );
    expect(outcomes[0]).toBe(0);
    expect(outcomes.at(-1)).toMatch(/has subcategories/);
  });

  it("keeps the subcategory check to catalog writers", async () => {
    expect(await runAs(db, customer, `select public.category_has_children('${topLevelId}')`)).toMatch(/catalog.write required/);
    expect(await runAs(db, anon, `select public.category_has_children('${topLevelId}')`)).toMatch(/^error:permission denied/);
    expect(await runAs(db, owner, `select public.category_has_children('${topLevelId}')`)).toBe(true);
  });

  it("refuses a category with products, even draft ones", async () => {
    const withProducts = await scalar<string>("select category_id from products group by category_id order by category_id limit 1");
    const outcomes = await runStepsAs(db, owner, [
      `update categories set parent_id = null where id = '${withProducts}'`,
      `update categories set parent_id = null where parent_id = '${withProducts}'`,
      `select public.admin_delete_category('${withProducts}')`,
    ]);
    expect(outcomes.at(-1)).toMatch(/still has products/);
  });

  it("deletes an empty category and returns its image key", async () => {
    const outcomes = await runStepsAs(db, catalogStaff, [
      "insert into categories (title, slug, image_path) values ('Test Empty', 'test-empty', 'categories/x/y.jpg')",
      "select public.admin_delete_category((select id from categories where slug = 'test-empty'))",
      "select count(*)::int from categories where slug = 'test-empty'",
    ]);
    expect(outcomes).toEqual(["affected:1", "categories/x/y.jpg", 0]);
  });

  it("reports a missing category", async () => {
    expect(await runAs(db, owner, "select public.admin_delete_category('00000000-0000-4000-8000-000000000000')")).toMatch(/not found/);
  });
});

describe("admin_save_collection", () => {
  const collection = (overrides: Record<string, unknown> = {}) => ({
    title: "Dashain Edit",
    slug: "test-festive-edit",
    eyebrow: "Festive",
    description: "For the season.",
    hero_image_path: "collections/new-x/y.jpg",
    hero_image_alt: "Red sari",
    sort_order: 5,
    is_active: true,
    starts_at: null,
    ends_at: null,
    ...overrides,
  });
  const saveSql = (id: string | null, payload: object, products: string[]) =>
    `select public.admin_save_collection(${id ? `'${id}'` : "null"}, ${json(payload)}, ${uuids(products)})`;
  const TEST_ID = "(select id from collections where slug = 'test-festive-edit')";
  const linksSql = `select coalesce(jsonb_agg(product_id order by sort_order), '[]') from collection_products where collection_id = ${TEST_ID}`;

  it("is refused to anon, customers and staff without content.manage", async () => {
    expect(await runAs(db, anon, saveSql(null, collection(), []))).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, saveSql(null, collection(), []))).toMatch(/content.manage required/);
    expect(await runAs(db, supportStaff, saveSql(null, collection(), []))).toMatch(/content.manage required/);
  });

  it("creates a collection with ordered products", async () => {
    const [result, links] = await runStepsAs(db, catalogStaff, [saveSql(null, collection(), productIds), linksSql]);
    expect(result).toMatchObject({ slug: "test-festive-edit", previous_slug: null });
    expect(links).toEqual(productIds);
  });

  it("replaces and reorders links on update", async () => {
    const reordered = [productIds[2]!, productIds[0]!];
    const outcomes = await runStepsAs(db, owner, [
      saveSql(null, collection(), productIds),
      saveSql("__ID__", collection({ slug: "test-festive-edit-2" }), reordered).replace("'__ID__'", TEST_ID),
      linksSql.replace("'test-festive-edit'", "'test-festive-edit-2'"),
    ]);
    expect(outcomes[1]).toMatchObject({ slug: "test-festive-edit-2", previous_slug: "test-festive-edit" });
    expect(outcomes[2]).toEqual(reordered);
  });

  it("lets a content.manage-only staff member save and see an off collection", async () => {
    const outcomes = await runStepsWithSetup(db, setupContentOnly, contentOnly, [
      saveSql(null, collection({ is_active: false }), productIds.slice(0, 1)),
      "select count(*)::int from collections where slug = 'test-festive-edit'",
    ]);
    expect(isError(outcomes[0])).toBe(false);
    expect(outcomes[1]).toBe(1);
  });

  const cases: [string, () => string, RegExp][] = [
    ["an existing slug", () => saveSql(null, collection({ slug: "__EXISTING__" }), []), /already uses this URL slug/],
    ["a bad slug", () => saveSql(null, collection({ slug: "Bad Slug" }), []), /lowercase letters/],
    ["an empty title", () => saveSql(null, collection({ title: " " }), []), /Enter a title/],
    ["an image without alt text", () => saveSql(null, collection({ hero_image_alt: "" }), []), /screen readers/],
    ["an end before the start", () => saveSql(null, collection({ starts_at: "2026-10-10T00:00:00+05:45", ends_at: "2026-10-01T00:00:00+05:45" }), []), /end has to be after/],
    ["a duplicate product", () => saveSql(null, collection(), [productIds[0]!, productIds[0]!]), /listed twice/],
    ["an unknown product", () => saveSql(null, collection(), ["00000000-0000-4000-8000-000000000000"]), /no longer exists/],
  ];

  it.each(cases)("rejects %s", async (_label, sql, message) => {
    const existing = await scalar<string>("select slug from collections order by slug limit 1");
    expect(await runAs(db, owner, sql().replace("__EXISTING__", existing))).toMatch(message);
  });
});

describe("collection hero image storage", () => {
  const insert = (name: string) => `insert into storage.objects (bucket_id, name) values ('product-media', '${name}')`;

  it("lets content.manage staff write under collections/ only", async () => {
    expect((await runStepsWithSetup(db, setupContentOnly, contentOnly, [insert("collections/new-a/b.jpg")]))[0]).toBe("affected:1");
    expect((await runStepsWithSetup(db, setupContentOnly, contentOnly, [insert("categories/a/b.jpg")]))[0]).toMatch(/row-level security/);
    expect((await runStepsWithSetup(db, setupContentOnly, contentOnly, [insert("products/a/b.jpg")]))[0]).toMatch(/row-level security/);
  });

  it("still refuses customers", async () => {
    expect(await runAs(db, customer, insert("collections/new-a/b.jpg"))).toMatch(/row-level security/);
  });
});
