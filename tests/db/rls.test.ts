// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, type Session } from "./harness";

/*
 * Migrations + development seed + RLS, per role (AGENTS §16, §23.3).
 * Clerk users are simulated with `sub` claims, as Supabase third-party auth
 * delivers them; nothing here calls Clerk or a hosted project.
 */

let db: PGlite;
let counts: Record<string, number>;
const users = {} as Record<"owner" | "catalogStaff" | "fulfilmentStaff" | "customer", Session>;
let otherCustomerId = "";

const anon: Session = { role: "anon" };
const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");
const isDenied = (value: unknown) => isError(value) || value === "affected:0";

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

beforeAll(async () => {
  ({ db, meta: { counts } } = await createSeededDatabase());
  const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });

  users.owner = as("user_seed_owner");
  users.catalogStaff = as("user_seed_staff_catalog_manager");
  users.fulfilmentStaff = as("user_seed_staff_fulfilment");
  users.customer = as(
    await scalar<string>(`
      select p.clerk_user_id from profiles p join orders o on o.user_id = p.id
      where p.role = 'customer' and p.deleted_at is null
      group by p.clerk_user_id order by count(*) desc, p.clerk_user_id limit 1`),
  );
  otherCustomerId = await scalar<string>(`
    select id from profiles
    where role = 'customer' and clerk_user_id <> '${(users.customer as { clerkUserId: string }).clerkUserId}'
    order by id limit 1`);
}, 120_000);

describe("migrations and seed", () => {
  it("loads every seed table with its _meta count", async () => {
    for (const [table, expected] of Object.entries(counts)) {
      expect(await scalar<number>(`select count(*)::int from public.${table}`), table).toBe(expected);
    }
  });

  it("grants user roles nothing implicitly (no TRUNCATE, no blanket column UPDATE)", async () => {
    expect(
      await scalar<number>(`
        select count(*)::int from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated')
          and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')`),
    ).toBe(0);
    expect(
      await scalar<string>(`
        select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'profiles'
          and grantee = 'authenticated' and privilege_type = 'UPDATE'`),
    ).toBe("full_name,phone_e164");
    expect(
      await scalar<number>(`
        select count(*)::int from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'`),
    ).toBe(0);
  });

  it("enables RLS on every public table", async () => {
    expect(
      await scalar<number>(`
        select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`),
    ).toBe(0);
  });
});

describe("anon (guest shopper)", () => {
  it("reads only the active catalog", async () => {
    expect(await runAs(db, anon, "select count(*)::int from products where status <> 'active'")).toBe(0);
    expect(await runAs(db, anon, "select count(*)::int from products")).toBe(
      await scalar<number>("select count(*)::int from products where status = 'active'"),
    );
    expect(
      await runAs(db, anon, `
        select count(*)::int from product_variants v
        where not exists (select 1 from products p where p.id = v.product_id)`),
    ).toBe(0);
  });

  it("sees collections only inside their schedule window", async () => {
    expect(await runAs(db, anon, "select count(*)::int from collections")).toBe(
      await scalar<number>(`
        select count(*)::int from collections where is_active
          and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())`),
    );
  });

  it.each(["orders", "order_items", "profiles", "customer_addresses", "coupons", "reviews", "newsletter_subscribers", "wishlist_items", "staff_permissions"])(
    "cannot read %s",
    async (table) => {
      expect(isDenied(await runAs(db, anon, `select count(*)::int from ${table}`))).toBe(true);
    },
  );

  it("cannot write the catalog or storage", async () => {
    expect(isDenied(await runAs(db, anon, "update products set base_price_paisa = 1"))).toBe(true);
    expect(isDenied(await runAs(db, anon, "insert into categories (title, slug) values ('X', 'x-cat')"))).toBe(true);
    expect(isDenied(await runAs(db, anon, "insert into storage.objects (bucket_id, name) values ('product-media', 'x.jpg')"))).toBe(true);
  });

  it("gets rating aggregates and testimonials through the storefront functions only", async () => {
    expect(
      await runAs(db, anon, "select count(*)::int from product_rating_summaries(array(select id from products))"),
    ).toBeGreaterThan(100);
    expect(
      await runAs(db, anon, `
        select count(*)::int from product_rating_summaries(
          (select array_agg(id) from products where status <> 'active'))`),
    ).toBe(0);
    expect(await runAs(db, anon, "select count(*)::int from storefront_testimonials(3)")).toBe(3);
    // Bylines are first name + initial, never full names or emails.
    expect(
      await runAs(db, anon, `select count(*)::int from storefront_testimonials(12) where author_name !~ '^\\S+( \\S\\.)?$'`),
    ).toBe(0);
  });
});

describe("customer", () => {
  it("reads only their own orders, items and shipment events", async () => {
    expect(await runAs(db, users.customer, "select count(*)::int from orders")).toBeGreaterThan(0);
    expect(await runAs(db, users.customer, "select count(*)::int from orders where user_id <> current_profile_id()")).toBe(0);
    expect(
      await runAs(db, users.customer, `
        select count(distinct o.user_id)::int from shipment_events e
        join shipments s on s.id = e.shipment_id join orders o on o.id = s.order_id`),
    ).toBe(1);
  });

  it("reads only their own profile and addresses", async () => {
    expect(await runAs(db, users.customer, "select count(*)::int from profiles")).toBe(1);
    expect(await runAs(db, users.customer, "select count(*)::int from customer_addresses where user_id <> current_profile_id()")).toBe(0);
  });

  it("can edit their name but never their role", async () => {
    expect(await runAs(db, users.customer, "update profiles set full_name = 'X' returning 1")).toBe(1);
    expect(isDenied(await runAs(db, users.customer, "update profiles set role = 'owner'"))).toBe(true);
    expect(isDenied(await runAs(db, users.customer, "update profiles set email = 'x@example.com'"))).toBe(true);
    expect(isDenied(await runAs(db, users.customer, "truncate orders"))).toBe(true);
    expect(isDenied(await runAs(db, users.customer, "update profiles set full_name = 'X' where id <> current_profile_id()"))).toBe(true);
  });

  it("cannot write another customer's address or an invalid ward", async () => {
    const insert = (userId: string, ward: number) => `
      insert into customer_addresses
        (user_id, recipient_name, phone_e164, province_code, district_code, municipality_code, ward, street_landmark)
      values (${userId}, 'A', '+9779800000000', 'bagmati', 'kathmandu', 'kathmandu-metropolitan-city', ${ward}, 'Thamel')`;
    expect(isError(await runAs(db, users.customer, insert(`'${otherCustomerId}'`, 1)))).toBe(true);
    expect(isError(await runAs(db, users.customer, insert("current_profile_id()", 99)))).toBe(true);
    expect(await runAs(db, users.customer, `${insert("current_profile_id()", 1)} returning 1`)).toBe(1);
  });

  it("cannot self-publish reviews, grant permissions, see coupons or append tracking", async () => {
    expect(
      isDenied(
        await runAs(db, users.customer, `
          insert into reviews (user_id, product_id, rating, body, status)
          select current_profile_id(), id, 5, 'Great', 'published' from products where status = 'active' limit 1`),
      ),
    ).toBe(true);
    expect(isDenied(await runAs(db, users.customer, "insert into staff_permissions (profile_id, permission_key) select current_profile_id(), 'catalog.write'"))).toBe(true);
    expect(await runAs(db, users.customer, "select count(*)::int from coupons")).toBe(0);
    expect(
      isDenied(
        await runAs(db, users.customer, `
          insert into shipment_events (shipment_id, status, message, source, occurred_at)
          select id, 'delivered', 'x', 'staff', now() from shipments limit 1`),
      ),
    ).toBe(true);
  });
});

describe("staff", () => {
  it("catalog staff see drafts and edit products and media, but not orders", async () => {
    expect(await runAs(db, users.catalogStaff, "select count(*)::int from products where status <> 'active'")).toBeGreaterThan(0);
    expect(await runAs(db, users.catalogStaff, "update products set title = title where slug = 'pearl-drop-earrings' returning 1")).toBe(1);
    expect(await runAs(db, users.catalogStaff, "insert into storage.objects (bucket_id, name) values ('product-media', 'x.jpg') returning 1")).toBe(1);
    expect(await runAs(db, users.catalogStaff, "select count(*)::int from orders")).toBe(0);
  });

  it("staff without catalog.write cannot edit products or grant themselves access", async () => {
    expect(isDenied(await runAs(db, users.fulfilmentStaff, "update products set title = 'x' where slug = 'pearl-drop-earrings'"))).toBe(true);
    expect(isDenied(await runAs(db, users.fulfilmentStaff, "insert into staff_permissions (profile_id, permission_key) select current_profile_id(), 'catalog.write'"))).toBe(true);
  });
});

describe("owner", () => {
  it("reads every order and coupon and manages staff permissions", async () => {
    expect(await runAs(db, users.owner, "select count(*)::int from orders")).toBe(counts.orders);
    expect(await runAs(db, users.owner, "select count(*)::int from coupons")).toBe(counts.coupons);
    expect(
      await runAs(db, users.owner, `
        insert into staff_permissions (profile_id, permission_key)
        select id, 'analytics.read' from profiles where clerk_user_id = 'user_seed_staff_fulfilment'
        on conflict do nothing returning 1`),
    ).toBe(1);
  });

  it("identity guard holds even if a grant is widened, but trusted code can still change roles", async () => {
    await db.exec("grant update on public.profiles to authenticated");
    try {
      const attempt = await runAs(db, users.customer, "update profiles set role = 'owner'");
      expect(attempt).toMatch(/read-only/);
    } finally {
      await db.exec("revoke update on public.profiles from authenticated; grant update (full_name, phone_e164) on public.profiles to authenticated");
    }
    expect(
      await runAs(db, { role: "service_role" }, "update profiles set role = 'staff' where clerk_user_id = 'user_seed_0001' returning 1"),
    ).toBe(1);
  });

  it("cannot change roles through the user path, and tracking history is append-only", async () => {
    expect(isDenied(await runAs(db, users.owner, "update profiles set role = 'customer'"))).toBe(true);
    expect(isDenied(await runAs(db, users.owner, "update shipment_events set message = 'x'"))).toBe(true);
    expect(isDenied(await runAs(db, users.owner, "delete from shipment_events"))).toBe(true);
  });
});
