// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Migrations category_heroes and product_sponsored: who may write the new
 * columns, what shoppers can read, and that the unused-upload cleanup keeps
 * category hero images. Every test runs in a rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const catalogStaff = as("user_seed_staff_catalog_manager"); // catalog.write + content.manage
const supportStaff = as("user_seed_staff_support"); // catalog.read only
let customer: Session;

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

let categoryId = "";
let categorySlug = "";
let productId = "";
let productSlug = "";
let productTitle = "";

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  customer = as(await scalar<string>("select clerk_user_id from profiles where role = 'customer' and deleted_at is null order by id limit 1"));
  categoryId = await scalar<string>("select id from categories where is_active order by sort_order limit 1");
  categorySlug = await scalar<string>(`select slug from categories where id = '${categoryId}'`);
  productId = await scalar<string>("select id from products where status = 'active' order by slug limit 1");
  productSlug = await scalar<string>(`select slug from products where id = '${productId}'`);
  productTitle = await scalar<string>(`select title from products where id = '${productId}'`);
}, 120_000);

describe("category hero columns", () => {
  const setHero = () =>
    `update categories set hero_image_path = 'categories/${categoryId}/${UUID_A}.jpg', hero_image_alt = 'Model', hero_title = 'Summer dresses', hero_text = 'Light fabrics.' where id = '${categoryId}'`;

  it("lets the owner and catalog.write staff set a hero", async () => {
    expect(await runAs(db, owner, setHero())).toBe("affected:1");
    expect(await runAs(db, catalogStaff, setHero())).toBe("affected:1");
  });

  it("refuses customers and staff without catalog.write", async () => {
    // RLS filters the row out, so nothing is updated.
    expect(await runAs(db, customer, setHero())).toBe("affected:0");
    expect(await runAs(db, supportStaff, setHero())).toBe("affected:0");
  });

  it("lets shoppers read the hero of an active category", async () => {
    const [title] = await runStepsWithSetup(db, [setHero()], anon, [`select hero_title from categories where slug = '${categorySlug}'`]);
    expect(title).toBe("Summer dresses");
  });

  it("rejects a URL as the hero image and over-long text", async () => {
    expect(await runAs(db, owner, `update categories set hero_image_path = 'https://example.com/a.jpg' where id = '${categoryId}'`)).toMatch(/check constraint/);
    expect(await runAs(db, owner, `update categories set hero_text = repeat('a', 241) where id = '${categoryId}'`)).toMatch(/check constraint/);
  });

  it("keeps a category's hero image out of the unused-upload cleanup", async () => {
    const outcomes = await runStepsWithSetup(
      db,
      [
        `insert into storage.objects (bucket_id, name, created_at) values ('product-media', 'categories/${categoryId}/${UUID_A}.jpg', now() - interval '2 days'), ('product-media', 'categories/${categoryId}/${UUID_B}.jpg', now() - interval '2 days')`,
        setHero(),
      ],
      owner,
      ["select coalesce(json_agg(o.name order by o.name), '[]') from public.admin_orphaned_storage_objects('product-media') o where o.name like 'categories/%'"],
    );
    expect(outcomes[0]).toEqual([`categories/${categoryId}/${UUID_B}.jpg`]);
  });
});

describe("products.is_sponsored", () => {
  const sponsor = () => `update products set is_sponsored = true where id = '${productId}'`;

  it("defaults to false", async () => {
    expect(await scalar<number>("select count(*)::int from products where is_sponsored")).toBe(0);
  });

  it("lets the owner and catalog.write staff set it", async () => {
    expect(await runAs(db, owner, sponsor())).toBe("affected:1");
    expect(await runAs(db, catalogStaff, sponsor())).toBe("affected:1");
  });

  it("refuses customers, anon and staff without catalog.write", async () => {
    expect(await runAs(db, customer, sponsor())).toBe("affected:0");
    expect(await runAs(db, supportStaff, sponsor())).toBe("affected:0");
    expect(await runAs(db, anon, sponsor())).toMatch(/^error:|affected:0/);
  });

  it("comes back from search_products", async () => {
    const [flag] = await runStepsWithSetup(db, [sponsor()], anon, [
      `select s.is_sponsored from public.search_products('${productTitle.replaceAll("'", "''")}', null, null, null, null, 48, 0) s where s.slug = '${productSlug}'`,
    ]);
    expect(flag).toBe(true);
  });
});
