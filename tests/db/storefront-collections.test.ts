// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Storefront collection pages (no migration): the anonymous reads behind
 * /collections and /collections/[slug] rely on the catalog RLS. Every call
 * runs in a rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };

const liveSlugsSql = `select coalesce(json_agg(slug order by sort_order), '[]'::json)
  from public.collections where is_active`;

// Mirrors the PostgREST `products!inner(...)` embed: links to hidden products drop out.
const pashminaProductsSql = `select coalesce(json_agg(p.slug order by cp.sort_order), '[]'::json)
  from public.collection_products cp
  join public.products p on p.id = cp.product_id
  where cp.collection_id = (select id from public.collections where slug = 'pashmina-edit')
    and p.status = 'active'`;

async function liveSlugs(setup: string[] = []): Promise<string[]> {
  const [result] = await runStepsWithSetup(db, setup, anon, [liveSlugsSql]);
  return result as string[];
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
});

describe("collections as the anonymous shopper", () => {
  it("hides the ended Teej collection and shows unscheduled ones", async () => {
    const slugs = await liveSlugs();
    expect(slugs).not.toContain("teej-collection");
    expect(slugs).toEqual(expect.arrayContaining(["autumn-styles", "layer-up", "pashmina-edit"]));
  });

  it("hides inactive, not-yet-started and ended collections", async () => {
    const slugs = await liveSlugs([
      "update public.collections set is_active = false where slug = 'layer-up'",
      "update public.collections set starts_at = now() + interval '1 day' where slug = 'autumn-styles'",
      "update public.collections set ends_at = now() - interval '1 minute', starts_at = null where slug = 'pashmina-edit'",
    ]);
    expect(slugs).not.toContain("layer-up");
    expect(slugs).not.toContain("autumn-styles");
    expect(slugs).not.toContain("pashmina-edit");
    expect(slugs).toContain("leather-and-knits");
  });

  it("drops a product from the collection when it goes to draft", async () => {
    const before = (await runAs(db, anon, pashminaProductsSql)) as string[];
    expect(before.length).toBeGreaterThan(0);

    const [after] = await runStepsWithSetup(
      db,
      [`update public.products set status = 'draft' where slug = '${before[0]}'`],
      anon,
      [pashminaProductsSql],
    );
    expect(after).toEqual(before.slice(1));
  });

  it("cannot write collections or their product links", async () => {
    expect(await runAs(db, anon, "update public.collections set title = 'x'")).toMatch(/^error:|^affected:0$/);
    expect(await runAs(db, anon, "delete from public.collection_products")).toMatch(/^error:|^affected:0$/);
  });
});
