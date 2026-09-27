// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Migration admin_ar_media: AR asset format and variant rules, the ar-assets
 * storage policies, and the orphaned-upload listing. Every test runs in a
 * rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager"); // catalog.write + ar.manage
const supportStaff = as("user_seed_staff_support"); // catalog.read only
const arOnly = as("user_test_ar_only");
let customer: Session;

const setupArOnly = [
  "insert into profiles (clerk_user_id, role) values ('user_test_ar_only', 'staff')",
  `insert into staff_permissions (profile_id, permission_key)
     select id, 'ar.manage'::staff_permission from profiles where clerk_user_id = 'user_test_ar_only'`,
];

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

let productId = "";
let otherVariantId = "";
let ownVariantId = "";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  customer = as(await scalar<string>("select clerk_user_id from profiles where role = 'customer' and deleted_at is null order by id limit 1"));
  productId = await scalar<string>("select id from products where status = 'active' order by slug limit 1");
  ownVariantId = await scalar<string>(`select id from product_variants where product_id = '${productId}' order by sku limit 1`);
  otherVariantId = await scalar<string>(`select id from product_variants where product_id <> '${productId}' order by sku limit 1`);
}, 120_000);

const insertAsset = (mode: string, format: string, variantId: string | null = null) =>
  `insert into product_ar_assets (product_id, variant_id, mode, placement, asset_path, asset_format)
   values ('${productId}', ${variantId ? `'${variantId}'` : "null"}, '${mode}', 'ear', 'products/${productId}/${UUID_A}.${format}', '${format}')`;

describe("product_ar_assets rules", () => {
  it.each([
    ["live_2d", "png"],
    ["live_2d", "webp"],
    ["photo_ai", "png"],
    ["live_3d", "glb"],
    ["live_3d", "usdz"],
  ])("accepts %s with %s", async (mode, format) => {
    expect(await runAs(db, owner, insertAsset(mode, format))).toBe("affected:1");
  });

  it.each([
    ["live_2d", "glb"],
    ["photo_ai", "usdz"],
    ["live_3d", "png"],
  ])("refuses %s with %s", async (mode, format) => {
    expect(await runAs(db, owner, insertAsset(mode, format))).toMatch(/product_ar_assets_mode_format_check/);
  });

  it("refuses a variant of another product", async () => {
    expect(await runAs(db, owner, insertAsset("live_2d", "png", otherVariantId))).toMatch(/belongs to another product/);
    expect(await runAs(db, owner, insertAsset("live_2d", "png", ownVariantId))).toBe("affected:1");
  });

  it("lets ar.manage staff write and refuses others", async () => {
    expect((await runStepsWithSetup(db, setupArOnly, arOnly, [insertAsset("live_2d", "png")]))[0]).toBe("affected:1");
    expect(await runAs(db, supportStaff, insertAsset("live_2d", "png"))).toMatch(/row-level security/);
    expect(await runAs(db, customer, insertAsset("live_2d", "png"))).toMatch(/row-level security/);
    expect(await runAs(db, anon, insertAsset("live_2d", "png"))).toMatch(/^error:permission denied/);
  });
});

describe("ar-assets storage", () => {
  const insert = (bucket: string, name: string) => `insert into storage.objects (bucket_id, name) values ('${bucket}', '${name}')`;

  it("is a public bucket limited to overlays and models", async () => {
    const bucket = (await db.query<{ public: boolean; allowed_mime_types: string[] }>("select public, allowed_mime_types from storage.buckets where id = 'ar-assets'")).rows[0];
    expect(bucket?.public).toBe(true);
    expect(bucket?.allowed_mime_types).toEqual(["image/png", "image/webp", "model/gltf-binary", "model/vnd.usdz+zip"]);
  });

  it("lets ar.manage write, and nobody else", async () => {
    const name = `products/${productId}/${UUID_A}.glb`;
    expect((await runStepsWithSetup(db, setupArOnly, arOnly, [insert("ar-assets", name)]))[0]).toBe("affected:1");
    expect(await runAs(db, catalogStaff, insert("ar-assets", name))).toBe("affected:1");
    expect(await runAs(db, supportStaff, insert("ar-assets", name))).toMatch(/row-level security/);
    expect(await runAs(db, customer, insert("ar-assets", name))).toMatch(/row-level security/);
  });

  it("gives ar.manage alone no write access to product photos", async () => {
    expect((await runStepsWithSetup(db, setupArOnly, arOnly, [insert("product-media", `products/${productId}/${UUID_A}.jpg`)]))[0]).toMatch(/row-level security/);
  });
});

describe("admin_orphaned_storage_objects", () => {
  const old = "now() - interval '2 days'";
  const seedObjects = () => [
    // Unreferenced admin uploads, old enough.
    `insert into storage.objects (bucket_id, name, metadata, created_at) values
       ('product-media', 'products/new-${UUID_A}/${UUID_B}.jpg', '{"size": 1200}', ${old}),
       ('product-media', 'categories/${UUID_A}/${UUID_B}.png', '{"size": 300}', ${old}),
       ('ar-assets', 'products/${UUID_A}/${UUID_B}.glb', '{"size": 5000}', ${old})`,
    // Too new, a seed-style path, and a referenced upload.
    `insert into storage.objects (bucket_id, name, created_at) values
       ('product-media', 'products/new-${UUID_B}/${UUID_A}.jpg', now() - interval '2 hours'),
       ('product-media', 'products/some-seed-slug/01.jpg', ${old}),
       ('product-media', 'products/${productId}/${UUID_A}.webp', ${old})`,
    `insert into product_media (product_id, storage_path, alt_text, sort_order) values ('${productId}', 'products/${productId}/${UUID_A}.webp', '', 99)`,
  ];

  const list = (bucket: string) => `select coalesce(json_agg(o.name order by o.name), '[]') from public.admin_orphaned_storage_objects('${bucket}') o`;

  it("lists only old, unreferenced admin uploads", async () => {
    const outcomes = await runStepsWithSetup(db, seedObjects(), owner, [list("product-media")]);
    expect(outcomes[0]).toEqual([`categories/${UUID_A}/${UUID_B}.png`, `products/new-${UUID_A}/${UUID_B}.jpg`]);
  });

  it("reads the size from the object metadata", async () => {
    const outcomes = await runStepsWithSetup(db, seedObjects(), owner, [
      "select sum(size_bytes)::int from public.admin_orphaned_storage_objects('product-media')",
    ]);
    expect(outcomes[0]).toBe(1500);
  });

  it("counts a missing or malformed size as 0 instead of failing", async () => {
    const outcomes = await runStepsWithSetup(
      db,
      [
        `insert into storage.objects (bucket_id, name, metadata, created_at) values
           ('product-media', 'products/new-${UUID_B}/${UUID_B}.png', '{"size": "12.5"}', ${old}),
           ('product-media', 'products/new-${UUID_A}/${UUID_A}.png', '{"size": "99999999999999999999999"}', ${old}),
           ('product-media', 'collections/${UUID_A}/${UUID_A}.png', null, ${old})`,
      ],
      owner,
      ["select json_agg(size_bytes order by name) from public.admin_orphaned_storage_objects('product-media')"],
    );
    expect(outcomes[0]).toEqual([0, 0, 0]);
  });

  it("lists unreferenced AR files for ar.manage only", async () => {
    expect((await runStepsWithSetup(db, [...setupArOnly, ...seedObjects()], arOnly, [list("ar-assets")]))[0]).toEqual([`products/${UUID_A}/${UUID_B}.glb`]);
    expect((await runStepsWithSetup(db, [...setupArOnly, ...seedObjects()], arOnly, [list("product-media")]))[0]).toMatch(/catalog.write required/);
    expect((await runStepsWithSetup(db, seedObjects(), supportStaff, [list("ar-assets")]))[0]).toMatch(/ar.manage required/);
  });

  it("stops listing an AR file once an asset uses it", async () => {
    const steps = await runStepsWithSetup(
      db,
      [
        ...seedObjects(),
        `insert into product_ar_assets (product_id, mode, placement, asset_path, asset_format)
           values ('${productId}', 'live_3d', 'face', 'products/${UUID_A}/${UUID_B}.glb', 'glb')`,
      ],
      owner,
      [list("ar-assets")],
    );
    expect(steps[0]).toEqual([]);
  });

  it("is refused to anon and customers, and for other buckets or short windows", async () => {
    expect(await runAs(db, anon, list("product-media"))).toMatch(/^error:permission denied/);
    expect(await runAs(db, customer, list("product-media"))).toMatch(/catalog.write required/);
    expect(await runAs(db, owner, list("elsewhere"))).toMatch(/Unknown bucket/);
    expect(await runStepsAs(db, owner, ["select count(*) from public.admin_orphaned_storage_objects('product-media', interval '5 minutes')"])).toEqual([
      expect.stringMatching(/younger than an hour/),
    ]);
  });
});
