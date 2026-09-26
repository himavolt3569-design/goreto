// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Admin phase 4 (migration admin_staff_invitations): owner-only invitations,
 * acceptance through the Clerk profile sync, and owner role changes. Every
 * test runs in a rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const service: Session = { role: "service_role" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const staff = as("user_seed_staff_support");
let customer: Session;
let customerId = "";
let customerEmail = "";
let ownerId = "";
let staffId = "";

async function scalar<T>(sql: string): Promise<T> {
  const result = await db.query(sql);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

const T1 = "2026-09-01T00:00:00Z";
const sync = (clerkUserId: string, email: string) =>
  `select public.sync_clerk_profile('${clerkUserId}', '${email}', 'New Staff', null, '${T1}')`;
const invite = (email: string, permissions = "{orders.read,orders.write}") =>
  `insert into staff_invitations (email, permissions, invited_by) values ('${email}', '${permissions}', '${ownerId}')`;
const roleOf = (clerkUserId: string) => `select role from profiles where clerk_user_id = '${clerkUserId}'`;
const permissionsOf = (clerkUserId: string) =>
  `select coalesce(string_agg(sp.permission_key::text, ',' order by sp.permission_key::text), '')
   from staff_permissions sp join profiles p on p.id = sp.profile_id where p.clerk_user_id = '${clerkUserId}'`;
const grantStaffManage = () =>
  `insert into staff_permissions (profile_id, permission_key) values ('${staffId}', 'staff.manage') on conflict do nothing`;

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
  ownerId = await scalar<string>("select id from profiles where clerk_user_id = 'user_seed_owner'");
  staffId = await scalar<string>("select id from profiles where clerk_user_id = 'user_seed_staff_support'");
  const row = (
    await db.query<{ id: string; clerk_user_id: string; email: string }>(
      "select id, clerk_user_id, email from profiles where role = 'customer' and deleted_at is null and email is not null order by id limit 1",
    )
  ).rows[0]!;
  customer = as(row.clerk_user_id);
  customerId = row.id;
  customerEmail = row.email;
}, 120_000);

describe("staff_invitations RLS", () => {
  it("lets the owner create, read, attach the Clerk id and revoke", async () => {
    const outcomes = await runStepsAs(db, owner, [
      invite("new.staff@example.com"),
      "update staff_invitations set clerk_invitation_id = 'inv_1' where email = 'new.staff@example.com'",
      "update staff_invitations set status = 'revoked' where email = 'new.staff@example.com'",
      "select status::text || ':' || (revoked_at is not null)::text from staff_invitations where email = 'new.staff@example.com'",
    ]);
    expect(outcomes).toEqual(["affected:1", "affected:1", "affected:1", "revoked:true"]);
  });

  it("allows one pending invitation per email", async () => {
    const outcomes = await runStepsAs(db, owner, [invite("dup@example.com"), invite("dup@example.com")]);
    expect(outcomes.at(-1)).toMatch(/staff_invitations_one_pending_per_email/);
  });

  it("refuses emails that aren't lowercase addresses", async () => {
    expect(await runAs(db, owner, invite("Mixed@Example.com"))).toMatch(/staff_invitations_email_format/);
    expect(await runAs(db, owner, invite("not-an-email"))).toMatch(/staff_invitations_email_format/);
  });

  it("won't let the owner insert on someone else's behalf or pre-accept", async () => {
    expect(
      await runAs(db, owner, `insert into staff_invitations (email, invited_by) values ('x@example.com', '${staffId}')`),
    ).toMatch(/row-level security/);
    expect(
      await runAs(db, owner, `insert into staff_invitations (email, invited_by, status) values ('x@example.com', '${ownerId}', 'accepted')`),
    ).toMatch(/permission denied/);
  });

  it("blocks the owner from marking an invitation accepted or reopening it", async () => {
    const accepted = await runStepsAs(db, owner, [
      invite("a@example.com"),
      "update staff_invitations set status = 'accepted' where email = 'a@example.com'",
    ]);
    expect(accepted.at(-1)).toMatch(/Only a pending invitation can be revoked/);

    const reopened = await runStepsAs(db, owner, [
      invite("b@example.com"),
      "update staff_invitations set status = 'revoked' where email = 'b@example.com'",
      "update staff_invitations set status = 'pending' where email = 'b@example.com'",
    ]);
    expect(reopened.at(-1)).toMatch(/Only a pending invitation can be revoked/);
  });

  it("sets the Clerk invitation id only once", async () => {
    const outcomes = await runStepsAs(db, owner, [
      invite("c@example.com"),
      "update staff_invitations set clerk_invitation_id = 'inv_1' where email = 'c@example.com'",
      "update staff_invitations set clerk_invitation_id = 'inv_2' where email = 'c@example.com'",
    ]);
    expect(outcomes.at(-1)).toMatch(/already set/);
  });

  it("lets the owner delete only unsent invitations", async () => {
    const outcomes = await runStepsAs(db, owner, [
      invite("unsent@example.com"),
      invite("sent@example.com"),
      "update staff_invitations set clerk_invitation_id = 'inv_sent' where email = 'sent@example.com'",
      "delete from staff_invitations where email in ('unsent@example.com', 'sent@example.com')",
    ]);
    expect(outcomes.at(-1)).toBe("affected:1");
  });

  it("hides invitations from staff (even with staff.manage), customers and anon", async () => {
    const setup = [grantStaffManage(), invite("hidden@example.com")];
    expect(await runStepsWithSetup(db, setup, staff, ["select count(*)::int from staff_invitations"])).toEqual([0]);
    expect(await runStepsWithSetup(db, setup, customer, ["select count(*)::int from staff_invitations"])).toEqual([0]);
    expect((await runStepsWithSetup(db, setup, anon, ["select count(*)::int from staff_invitations"]))[0]).toMatch(/permission denied/);
    expect((await runStepsWithSetup(db, [grantStaffManage()], staff, [invite("x@example.com")]))[0]).toMatch(/row-level security/);
  });
});

describe("accepting an invitation on profile sync", () => {
  const setupInvite = (email: string, extra = "") => [invite(email) + extra];

  it("makes a new verified user staff with the invited permissions", async () => {
    const outcomes = await runStepsWithSetup(db, setupInvite("new.staff@example.com"), service, [
      sync("user_invited", "New.Staff@Example.com"),
      roleOf("user_invited"),
      permissionsOf("user_invited"),
      "select status::text || ':' || (accepted_profile_id is not null)::text from staff_invitations where email = 'new.staff@example.com'",
      "select granted_by::text from staff_permissions sp join profiles p on p.id = sp.profile_id where p.clerk_user_id = 'user_invited' limit 1",
    ]);
    expect(outcomes.slice(1)).toEqual(["staff", "orders.read,orders.write", "accepted:true", ownerId]);
  });

  it("is idempotent when the webhook replays", async () => {
    const outcomes = await runStepsWithSetup(db, setupInvite("new.staff@example.com"), service, [
      sync("user_invited", "new.staff@example.com"),
      sync("user_invited", "new.staff@example.com"),
      roleOf("user_invited"),
      permissionsOf("user_invited"),
    ]);
    expect(outcomes.slice(2)).toEqual(["staff", "orders.read,orders.write"]);
  });

  it("promotes an existing customer on their next sync", async () => {
    const outcomes = await runStepsWithSetup(db, setupInvite(customerEmail), service, [
      `select public.sync_clerk_profile('${customer.role === "authenticated" ? customer.clerkUserId : ""}', '${customerEmail}', null, null, now())`,
      `select role from profiles where id = '${customerId}'`,
    ]);
    expect(outcomes.at(-1)).toBe("staff");
  });

  it("ignores expired, revoked and other-email invitations, and unverified users", async () => {
    const expired = await runStepsWithSetup(
      db,
      [invite("late@example.com"), "update staff_invitations set expires_at = now() - interval '1 minute' where email = 'late@example.com'"],
      service,
      [sync("user_late", "late@example.com"), roleOf("user_late")],
    );
    expect(expired.at(-1)).toBe("customer");

    const revoked = await runStepsWithSetup(
      db,
      [invite("gone@example.com"), "update staff_invitations set status = 'revoked' where email = 'gone@example.com'"],
      service,
      [sync("user_gone", "gone@example.com"), roleOf("user_gone")],
    );
    expect(revoked.at(-1)).toBe("customer");

    const other = await runStepsWithSetup(db, setupInvite("someone@example.com"), service, [
      sync("user_other", "other@example.com"),
      roleOf("user_other"),
      "select status::text from staff_invitations where email = 'someone@example.com'",
    ]);
    expect(other.slice(1)).toEqual(["customer", "pending"]);

    const unverified = await runStepsWithSetup(db, setupInvite("someone@example.com"), service, [
      "select public.sync_clerk_profile('user_unverified', null, 'No Email', null, now())",
      roleOf("user_unverified"),
    ]);
    expect(unverified.at(-1)).toBe("customer");
  });

  it("never changes the owner or an existing staff member", async () => {
    const outcomes = await runStepsWithSetup(db, [invite("owner@example.com", "{orders.read}")], service, [
      "select public.sync_clerk_profile('user_seed_owner', 'owner@example.com', null, null, now())",
      roleOf("user_seed_owner"),
      "select status::text from staff_invitations where email = 'owner@example.com'",
    ]);
    expect(outcomes.slice(1)).toEqual(["owner", "pending"]);
  });

  it("can't be called by signed-in users or guests", async () => {
    expect(await runAs(db, owner, `select public.apply_staff_invitation('${customerId}')`)).toMatch(/permission denied/);
    expect(await runAs(db, anon, `select public.apply_staff_invitation('${customerId}')`)).toMatch(/permission denied/);
  });
});

describe("admin_set_staff_role", () => {
  it("lets the owner promote a customer with permissions and demote them again", async () => {
    const clerkUserId = customer.role === "authenticated" ? customer.clerkUserId : "";
    const outcomes = await runStepsAs(db, owner, [
      `select public.admin_set_staff_role('${customerId}', 'staff', '{catalog.read}')`,
      `select role::text from profiles where id = '${customerId}'`,
      permissionsOf(clerkUserId),
      `select public.admin_set_staff_role('${customerId}', 'customer')`,
      `select role::text from profiles where id = '${customerId}'`,
      permissionsOf(clerkUserId),
    ]);
    expect(outcomes).toEqual(["", "staff", "catalog.read", "", "customer", ""]);
  });

  it("refuses the owner, the caller, ownership, deleted accounts and no-op changes", async () => {
    expect(await runAs(db, owner, `select public.admin_set_staff_role('${ownerId}', 'customer')`)).toMatch(/owner's role can't be changed/);
    expect(await runAs(db, owner, `select public.admin_set_staff_role('${customerId}', 'owner')`)).toMatch(/Ownership can't be transferred/);
    expect(await runAs(db, owner, `select public.admin_set_staff_role('${staffId}', 'staff')`)).toMatch(/Already on the team/);
    expect(await runAs(db, owner, `select public.admin_set_staff_role('${customerId}', 'customer')`)).toMatch(/isn't on the staff/);
    expect(await runAs(db, owner, "select public.admin_set_staff_role(gen_random_uuid(), 'staff')")).toMatch(/no longer exists/);
  });

  it("is denied for staff (even with staff.manage), customers and anon", async () => {
    const call = `select public.admin_set_staff_role('${customerId}', 'staff', '{catalog.read}')`;
    expect((await runStepsWithSetup(db, [grantStaffManage()], staff, [call]))[0]).toMatch(/Only the store owner/);
    expect(await runAs(db, customer, call)).toMatch(/Only the store owner/);
    expect(await runAs(db, anon, call)).toMatch(/permission denied/);
  });

  it("still leaves profiles.role unwritable directly", async () => {
    expect(await runAs(db, owner, `update profiles set role = 'staff' where id = '${customerId}'`)).toMatch(/permission denied|read-only/);
  });
});
