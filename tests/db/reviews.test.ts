// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsAs, type Session } from "./harness";

/*
 * Account phase 3 (migration product_reviews): only verified buyers review,
 * edits go back to moderation, customers delete only their own review, and
 * the public reads expose published reviews of active products without ids.
 * Every call is rolled back.
 */

let db: PGlite;
const anon: Session = { role: "anon" };
const as = (clerkUserId: string): Session => ({ role: "authenticated", clerkUserId });
const owner = as("user_seed_owner");
const isError = (value: unknown) => typeof value === "string" && value.startsWith("error:");

const BODY = "Lovely quality, arrived well packed and on time.";

/** A delivered buyer of an active product they haven't reviewed. */
let buyer = { clerk: "", slug: "" };
/** A buyer whose review of the product is published. */
let reviewed = { clerk: "", slug: "", reviewId: "" };
/** A customer who never received this active product. */
let nonBuyer = { clerk: "", slug: "" };
let inactiveSlug = "";
/** A published product with several published reviews. */
let popularSlug = "";

async function row<T>(sql: string): Promise<T> {
  const result = await db.query<T>(sql);
  if (!result.rows[0]) throw new Error(`No fixture row for: ${sql}`);
  return result.rows[0];
}

const submit = (slug: string, rating: number, body = BODY, title: string | null = "Great buy") =>
  `select public.submit_review('${slug}', ${rating}::smallint, ${title === null ? "null" : `'${title}'`}, '${body}')`;

const OWN_REVIEW = (slug: string) => `
  select json_build_object('status', r.status, 'verified', r.order_item_id is not null,
    'moderated', r.moderated_at is not null, 'rating', r.rating)
  from reviews r join products p on p.id = r.product_id
  where r.user_id = current_profile_id() and p.slug = '${slug}'`;

const delivered = (alias: string) => `
  exists (select 1 from order_items oi join orders o on o.id = oi.order_id
    where o.user_id = ${alias}.id and o.status = 'delivered' and oi.product_id = p.id)`;

beforeAll(async () => {
  ({ db } = await createSeededDatabase());

  buyer = await row(`
    select pr.clerk_user_id as clerk, p.slug from profiles pr, products p
    where pr.role = 'customer' and pr.deleted_at is null and p.status = 'active' and ${delivered("pr")}
      and not exists (select 1 from reviews r where r.user_id = pr.id and r.product_id = p.id)
    order by pr.id, p.id limit 1`);

  reviewed = await row(`
    select pr.clerk_user_id as clerk, p.slug, r.id as "reviewId" from reviews r
    join profiles pr on pr.id = r.user_id join products p on p.id = r.product_id
    where r.status = 'published' and pr.role = 'customer' and pr.deleted_at is null and p.status = 'active'
      and ${delivered("pr")}
    order by r.id limit 1`);

  nonBuyer = await row(`
    select pr.clerk_user_id as clerk, p.slug from profiles pr, products p
    where pr.role = 'customer' and pr.deleted_at is null and p.status = 'active' and not ${delivered("pr")}
      and not exists (select 1 from reviews r where r.user_id = pr.id and r.product_id = p.id)
    order by pr.id, p.id limit 1`);

  inactiveSlug = (await row<{ slug: string }>("select slug from products where status <> 'active' order by id limit 1")).slug;

  popularSlug = (
    await row<{ slug: string }>(`
      select p.slug from products p join reviews r on r.product_id = p.id
      where p.status = 'active' and r.status = 'published'
      group by p.id having count(*) >= 3 order by count(*) desc, p.id limit 1`)
  ).slug;
}, 120_000);

describe("submit_review", () => {
  it("creates a pending, verified review for a delivered buyer", async () => {
    const outcomes = await runStepsAs(db, as(buyer.clerk), [submit(buyer.slug, 5), OWN_REVIEW(buyer.slug)]);
    expect(outcomes[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(outcomes[1]).toEqual({ status: "pending", verified: true, moderated: false, rating: 5 });
  });

  it("refuses a customer who never received the product", async () => {
    expect(await runAs(db, as(nonBuyer.clerk), submit(nonBuyer.slug, 4))).toMatch(/not_a_verified_buyer/);
  });

  it("refuses a customer whose order for the product wasn't delivered", async () => {
    const pending = await row<{ clerk: string; slug: string }>(`
      select pr.clerk_user_id as clerk, p.slug
      from order_items oi join orders o on o.id = oi.order_id
      join profiles pr on pr.id = o.user_id join products p on p.id = oi.product_id
      where o.status <> 'delivered' and pr.deleted_at is null and p.status = 'active' and not ${delivered("pr")}
      order by oi.id limit 1`);
    expect(await runAs(db, as(pending.clerk), submit(pending.slug, 4))).toMatch(/not_a_verified_buyer/);
  });

  it("refuses unknown or inactive products and signed-out callers", async () => {
    expect(await runAs(db, as(buyer.clerk), submit("no-such-product", 4))).toMatch(/product_not_found/);
    expect(await runAs(db, as(buyer.clerk), submit(inactiveSlug, 4))).toMatch(/product_not_found/);
    expect(isError(await runAs(db, anon, submit(buyer.slug, 4)))).toBe(true);
  });

  it("validates rating, title and body", async () => {
    const session = as(buyer.clerk);
    expect(await runAs(db, session, submit(buyer.slug, 0))).toMatch(/invalid_rating/);
    expect(await runAs(db, session, submit(buyer.slug, 6))).toMatch(/invalid_rating/);
    expect(await runAs(db, session, submit(buyer.slug, 4, "Too short"))).toMatch(/invalid_body/);
    expect(await runAs(db, session, submit(buyer.slug, 4, "x".repeat(2001)))).toMatch(/invalid_body/);
    expect(await runAs(db, session, submit(buyer.slug, 4, BODY, "t".repeat(121)))).toMatch(/invalid_title/);
    // Whitespace-only title is stored as no title.
    expect(await runAs(db, session, submit(buyer.slug, 4, BODY, "   "))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends an edited published review back to moderation", async () => {
    const outcomes = await runStepsAs(db, as(reviewed.clerk), [submit(reviewed.slug, 2, "Changed my mind after a month of use."), OWN_REVIEW(reviewed.slug)]);
    expect(outcomes[0]).toBe(reviewed.reviewId);
    expect(outcomes[1]).toEqual({ status: "pending", verified: true, moderated: false, rating: 2 });
  });

  it("keeps a review published when it is resubmitted unchanged", async () => {
    const current = await row<{ rating: number; title: string | null; body: string }>(
      `select rating, title, body from reviews where id = '${reviewed.reviewId}'`,
    );
    const resubmit = `select public.submit_review('${reviewed.slug}', ${current.rating}::smallint,
      ${current.title === null ? "null" : `$t$${current.title}$t$`}, $b$${current.body}$b$)`;
    const outcomes = await runStepsAs(db, as(reviewed.clerk), [resubmit, OWN_REVIEW(reviewed.slug)]);
    expect(outcomes[0]).toBe(reviewed.reviewId);
    expect(outcomes[1]).toMatchObject({ status: "published", moderated: true });
  });
});

describe("direct writes", () => {
  it("rejects a direct insert without an order item", async () => {
    const outcome = await runAs(db, as(buyer.clerk), `
      insert into reviews (user_id, product_id, rating, body)
      select current_profile_id(), id, 5, '${BODY}' from products where slug = '${buyer.slug}'`);
    expect(isError(outcome)).toBe(true);
  });

  it("lets a customer delete their own review but not someone else's", async () => {
    expect(await runAs(db, as(reviewed.clerk), `delete from reviews where id = '${reviewed.reviewId}'`)).toBe("affected:1");
    expect(await runAs(db, as(buyer.clerk), `delete from reviews where id = '${reviewed.reviewId}'`)).toBe("affected:0");
    expect(isError(await runAs(db, anon, `delete from reviews where id = '${reviewed.reviewId}'`))).toBe(true);
  });
});

describe("public review reads", () => {
  it("returns published reviews of active products with bylines and no ids", async () => {
    const outcome = (await runAs(db, anon, `
      select json_agg(t) from public.product_reviews('${popularSlug}', 50, 0) t`)) as Record<string, unknown>[];
    const published = await row<{ count: number }>(`
      select count(*)::int from reviews r join products p on p.id = r.product_id
      where p.slug = '${popularSlug}' and r.status = 'published'`);
    expect(outcome).toHaveLength(Math.min(published.count, 50));
    expect(Object.keys(outcome[0]!).sort()).toEqual(["author_name", "body", "created_at", "rating", "review_id", "title", "verified"]);
    for (const review of outcome) expect(review.author_name).toMatch(/^(\S+( \S\.)?|Goreto customer)$/);
  });

  it("clamps limit and offset", async () => {
    expect(await runAs(db, anon, `select count(*)::int from public.product_reviews('${popularSlug}', 1000, 0)`)).toBeLessThanOrEqual(50);
    expect(await runAs(db, anon, `select count(*)::int from public.product_reviews('${popularSlug}', 0, -5)`)).toBe(1);
  });

  it("returns nothing for inactive products", async () => {
    expect(await runAs(db, anon, `select count(*)::int from public.product_reviews('${inactiveSlug}', 50, 0)`)).toBe(0);
    expect(await runAs(db, anon, `select count(*)::int from public.product_rating_breakdown('${inactiveSlug}')`)).toBe(0);
  });

  it("has a breakdown that adds up to the rating summary", async () => {
    const total = await runAs(db, anon, `select sum(review_count)::int from public.product_rating_breakdown('${popularSlug}')`);
    const summary = await runAs(db, anon, `
      select s.rating_count from public.product_rating_summaries(array(select id from products where slug = '${popularSlug}')) s`);
    expect(total).toBe(summary);
  });
});

describe("account_reviewable_products", () => {
  it("lists the caller's delivered, unreviewed, active products", async () => {
    const slugs = (await runAs(db, as(buyer.clerk), "select json_agg(slug) from public.account_reviewable_products()")) as string[];
    expect(slugs).toContain(buyer.slug);
    // After reviewing, the product drops off the list.
    const outcomes = await runStepsAs(db, as(buyer.clerk), [
      submit(buyer.slug, 5),
      `select count(*)::int from public.account_reviewable_products() where slug = '${buyer.slug}'`,
    ]);
    expect(outcomes[1]).toBe(0);
  });

  it("shows owners only their own purchases", async () => {
    const own = await row<{ count: number }>(`
      select count(distinct p.id)::int from orders o join order_items oi on oi.order_id = o.id
      join products p on p.id = oi.product_id and p.status = 'active'
      join profiles pr on pr.id = o.user_id
      where pr.clerk_user_id = 'user_seed_owner' and o.status = 'delivered'
        and not exists (select 1 from reviews r where r.user_id = pr.id and r.product_id = p.id)`);
    expect(await runAs(db, owner, "select count(*)::int from public.account_reviewable_products()")).toBe(Math.min(own.count, 20));
  });

  it("is not available to anon", async () => {
    expect(isError(await runAs(db, anon, "select count(*) from public.account_reviewable_products()"))).toBe(true);
  });
});
