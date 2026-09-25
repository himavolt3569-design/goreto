// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, type Session } from "./harness";

/*
 * Clerk -> profiles sync and owner bootstrap (migration clerk_profile_sync).
 * The webhook, lazy upsert and bootstrap script call these as service_role;
 * signed-in users and guests must not be able to call them at all.
 */

let db: PGlite;
let customerClerkId = "";

const service: Session = { role: "service_role" };
const anon: Session = { role: "anon" };
const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");

const T1 = "2026-09-01T00:00:00Z";
const T2 = "2026-09-02T00:00:00Z";

function sync(clerkUserId: string, email: string | null, name: string | null, updatedAt: string): string {
  const text = (value: string | null) => (value === null ? "null" : `'${value}'`);
  return `select public.sync_clerk_profile('${clerkUserId}', ${text(email)}, ${text(name)}, null, '${updatedAt}')`;
}

const profileField = (clerkUserId: string, column: string) =>
  `select ${column} from public.profiles where clerk_user_id = '${clerkUserId}'`;

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  const result = await db.query(`
    select p.clerk_user_id
    from profiles p
    where p.role = 'customer' and p.deleted_at is null
      and exists (select 1 from customer_addresses a where a.user_id = p.id)
      and exists (select 1 from wishlist_items w where w.user_id = p.id)
      and exists (select 1 from orders o where o.user_id = p.id)
    order by p.clerk_user_id
    limit 1`);
  customerClerkId = (result.rows[0] as { clerk_user_id: string }).clerk_user_id;
});

describe("sync_clerk_profile", () => {
  it("creates a customer profile with a lowercased email", async () => {
    const [id, role, email] = await runStepsAs(db, service, [
      sync("user_new", "New.Person@Example.com", "New Person", T1),
      profileField("user_new", "role"),
      profileField("user_new", "email"),
    ]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(role).toBe("customer");
    expect(email).toBe("new.person@example.com");
  });

  it("applies newer snapshots and ignores older ones", async () => {
    const outcomes = await runStepsAs(db, service, [
      sync("user_new", "first@example.com", "First", T1),
      sync("user_new", "second@example.com", "Second", T2),
      sync("user_new", "stale@example.com", "Stale", T1),
      profileField("user_new", "email"),
      profileField("user_new", "full_name"),
    ]);
    expect(outcomes.slice(3)).toEqual(["second@example.com", "Second"]);
    // The stale call still reports the active profile.
    expect(outcomes[2]).toBe(outcomes[0]);
  });

  it("keeps an in-app name when Clerk has none, and never changes role", async () => {
    const outcomes = await runStepsAs(db, service, [
      sync("user_seed_owner", "owner@example.com", null, T2),
      profileField("user_seed_owner", "full_name"),
      profileField("user_seed_owner", "role"),
    ]);
    expect(outcomes.slice(1)).toEqual(["Sanjeev Maharjan", "owner"]);
  });

  it("ignores snapshots for a deleted user", async () => {
    const outcomes = await runStepsAs(db, service, [
      sync("user_new", "a@example.com", "A", T1),
      "select public.mark_clerk_profile_deleted('user_new')",
      sync("user_new", "b@example.com", "B", T2),
      profileField("user_new", "email"),
    ]);
    expect(outcomes[2]).toBeNull();
    expect(outcomes[3]).toBeNull();
  });
});

describe("mark_clerk_profile_deleted", () => {
  it("anonymizes the profile and removes account-only data, keeping orders", async () => {
    const id = `(select id from public.profiles where clerk_user_id = '${customerClerkId}')`;
    const outcomes = await runStepsAs(db, service, [
      `select count(*)::int from public.orders where user_id = ${id}`,
      `select public.mark_clerk_profile_deleted('${customerClerkId}')`,
      `select concat_ws('|', email, full_name, phone_e164, role, deleted_at is not null)
         from public.profiles where clerk_user_id = '${customerClerkId}'`,
      `select count(*)::int from public.customer_addresses where user_id = ${id}`,
      `select count(*)::int from public.wishlist_items where user_id = ${id}`,
      `select count(*)::int from public.orders where user_id = ${id}`,
    ]);
    const [ordersBefore, , summary, addresses, wishlist, ordersAfter] = outcomes;
    expect(summary).toBe("customer|t");
    expect(addresses).toBe(0);
    expect(wishlist).toBe(0);
    expect(ordersAfter).toBe(ordersBefore);
  });

  it("leaves a tombstone when the delete arrives before the create", async () => {
    const outcomes = await runStepsAs(db, service, [
      "select public.mark_clerk_profile_deleted('user_early_delete')",
      sync("user_early_delete", "late@example.com", "Late", T1),
      profileField("user_early_delete", "deleted_at is not null"),
      profileField("user_early_delete", "email"),
    ]);
    expect(outcomes.slice(1)).toEqual([null, true, null]);
  });

  it("is a no-op when repeated", async () => {
    // now() is fixed within a transaction, so pin deleted_at to the past to
    // tell a skipped update from a rewrite with the same timestamp.
    const outcomes = await runStepsAs(db, service, [
      `select public.mark_clerk_profile_deleted('${customerClerkId}')`,
      `update public.profiles set deleted_at = '2020-01-01T00:00:00Z' where clerk_user_id = '${customerClerkId}'`,
      `select public.mark_clerk_profile_deleted('${customerClerkId}')`,
      profileField(customerClerkId, "deleted_at = '2020-01-01T00:00:00Z'::timestamptz"),
    ]);
    expect(outcomes[3]).toBe(true);
  });

  it("hides the profile from its own session afterwards", async () => {
    const session: Session = { role: "authenticated", clerkUserId: customerClerkId };
    expect(await runAs(db, session, "select public.current_profile_id() is not null")).toBe(true);
    // Deletion commits here only inside the rolled-back steps below.
    const outcomes = await runStepsAs(db, service, [
      `select public.mark_clerk_profile_deleted('${customerClerkId}')`,
      `select set_config('request.jwt.claims', '{"sub":"${customerClerkId}","role":"authenticated"}', true)`,
      "select public.current_profile_id() is null",
    ]);
    expect(outcomes[2]).toBe(true);
  });
});

describe("bootstrap_owner", () => {
  const promote = (clerkUserId: string, replace: boolean) =>
    `select concat_ws('|', owner_id is not null, demoted_owner_id is not null)
       from public.bootstrap_owner('${clerkUserId}', ${replace})`;

  it("refuses while another owner is active", async () => {
    const outcomes = await runStepsAs(db, service, [
      sync("user_real_owner", "me@example.com", "Real Owner", T1),
      promote("user_real_owner", false),
    ]);
    expect(outcomes[1]).toMatch(/another active owner exists/);
  });

  it("transfers ownership with replace, and is idempotent", async () => {
    const outcomes = await runStepsAs(db, service, [
      sync("user_real_owner", "me@example.com", "Real Owner", T1),
      promote("user_real_owner", true),
      profileField("user_real_owner", "role"),
      profileField("user_seed_owner", "role"),
      promote("user_real_owner", false),
      "select count(*)::int from public.profiles where role = 'owner' and deleted_at is null",
    ]);
    expect(outcomes.slice(1)).toEqual(["t|t", "owner", "customer", "t|f", 1]);
  });

  it("clears the new owner's staff permissions", async () => {
    const staffId = "(select id from public.profiles where clerk_user_id = 'user_seed_staff_catalog_manager')";
    const outcomes = await runStepsAs(db, service, [
      `select count(*)::int > 0 from public.staff_permissions where profile_id = ${staffId}`,
      promote("user_seed_staff_catalog_manager", true),
      `select count(*)::int from public.staff_permissions where profile_id = ${staffId}`,
    ]);
    expect(outcomes).toEqual([true, "t|t", 0]);
  });

  it("rejects unknown users", async () => {
    expect(await runAs(db, service, promote("user_missing", true))).toMatch(/no active profile/);
  });

  it("allows only one active owner even outside the function", async () => {
    const result = await runAs(
      db,
      service,
      "update public.profiles set role = 'owner' where clerk_user_id = 'user_seed_staff_fulfilment'",
    );
    expect(result).toMatch(/profiles_single_active_owner/);
  });
});

describe("who may call the sync functions", () => {
  const calls = [
    sync("user_attacker", "x@example.com", "X", T1),
    "select public.mark_clerk_profile_deleted('user_seed_owner')",
    "select * from public.bootstrap_owner('user_seed_staff_fulfilment', true)",
  ];

  it.each(calls)("denies anon: %s", async (sql) => {
    expect(await runAs(db, anon, sql)).toMatch(/permission denied/);
  });

  it.each(calls)("denies signed-in users: %s", async (sql) => {
    const session: Session = { role: "authenticated", clerkUserId: customerClerkId };
    expect(await runAs(db, session, sql)).toMatch(/permission denied/);
  });

  it("still blocks a signed-in user from changing their own role", async () => {
    const session: Session = { role: "authenticated", clerkUserId: customerClerkId };
    const result = await runAs(
      db,
      session,
      `update public.profiles set role = 'owner' where clerk_user_id = '${customerClerkId}'`,
    );
    expect(isError(result)).toBe(true);
  });
});
