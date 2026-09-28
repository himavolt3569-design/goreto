// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeededDatabase, runAs, runStepsWithSetup, type Session } from "./harness";

/*
 * Storefront search (migration storefront_search): search_products as the
 * anonymous shopper. Every call runs in a rolled-back transaction.
 */

let db: PGlite;
const anon: Session = { role: "anon" };

type Hit = {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  base_price_paisa: number;
  published_at: string;
  cover_path: string | null;
  total_count: number;
};

type Args = {
  q?: string | null;
  category?: string | null;
  min?: number | null;
  max?: number | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
};

const literal = (value: string | number | null | undefined) =>
  value === null || value === undefined
    ? "null"
    : typeof value === "number"
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`;

function searchSql(args: Args): string {
  return `select coalesce(json_agg(t order by n), '[]'::json)
    from public.search_products(
      ${literal(args.q)}, ${literal(args.category)}, ${literal(args.min)}, ${literal(args.max)},
      ${literal(args.sort)}, ${args.limit ?? 48}, ${args.offset ?? 0}
    ) with ordinality as t(id, slug, title, category_id, base_price_paisa, is_bestseller,
      is_limited_edition, published_at, cover_path, cover_alt, total_count, n)`;
}

async function search(args: Args, setup: string[] = []): Promise<Hit[]> {
  const [result] = await runStepsWithSetup(db, setup, anon, [searchSql(args)]);
  if (typeof result === "string") throw new Error(result);
  return result as Hit[];
}

async function scalar<T>(sql: string): Promise<T> {
  const { rows } = await db.query(sql);
  return Object.values(rows[0] as Record<string, unknown>)[0] as T;
}

beforeAll(async () => {
  ({ db } = await createSeededDatabase());
});

describe("search_products relevance", () => {
  it("ranks an exact title first", async () => {
    const hits = await search({ q: "Pearl Choker" });
    expect(hits[0]?.title).toBe("Pearl Choker");
  });

  it("matches word prefixes", async () => {
    const hits = await search({ q: "earr" });
    expect(hits.length).toBeGreaterThan(3);
    expect(hits.slice(0, 3).every((hit) => /earring/i.test(hit.title))).toBe(true);
  });

  it("tolerates typos through trigram similarity", async () => {
    expect((await search({ q: "jhumkaa" })).map((hit) => hit.title)).toContain("Oxidised Silver Jhumkas");
    expect((await search({ q: "earings" })).some((hit) => /earrings/i.test(hit.title))).toBe(true);
  });

  it("matches the category title when the product title does not", async () => {
    const necklaceCategory = await scalar<string>(
      "select id from public.categories where slug = 'necklaces'",
    );
    const hits = await search({ q: "necklace" });
    expect(hits.some((hit) => hit.category_id === necklaceCategory && !/necklace/i.test(hit.title))).toBe(true);
  });

  it("returns nothing for gibberish", async () => {
    expect(await search({ q: "zzqxwv" })).toEqual([]);
  });

  it("with no query lists every active product", async () => {
    const active = await scalar<number>("select count(*)::int from public.products where status = 'active'");
    const [first] = await search({ limit: 1 });
    expect(Number(first?.total_count)).toBe(active);
  });
});

describe("search_products visibility", () => {
  it("never returns draft or archived products", async () => {
    const hits = await search({ q: "Pearl Choker" }, [
      "update public.products set status = 'draft' where title = 'Pearl Choker'",
    ]);
    expect(hits.map((hit) => hit.title)).not.toContain("Pearl Choker");

    const archived = await search({ q: "Pearl Choker" }, [
      "update public.products set status = 'archived', archived_at = now() where title = 'Pearl Choker'",
    ]);
    expect(archived.map((hit) => hit.title)).not.toContain("Pearl Choker");
  });

  it("hides products of an inactive category", async () => {
    const hits = await search({ q: "Pearl Choker" }, [
      `update public.categories set is_active = false
        where id = (select category_id from public.products where title = 'Pearl Choker')`,
    ]);
    expect(hits.map((hit) => hit.title)).not.toContain("Pearl Choker");
  });
});

describe("search_products filters, sort and paging", () => {
  it("filters by a top-level category including its subcategories", async () => {
    const subtree = await db.query<{ id: string }>(`
      with recursive tree as (
        select id from public.categories where slug = 'jewelry'
        union select c.id from public.categories c join tree t on c.parent_id = t.id
      ) select id from tree`);
    const ids = new Set(subtree.rows.map((row) => row.id));
    expect(ids.size).toBeGreaterThan(1);

    const hits = await search({ category: "jewelry" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => ids.has(hit.category_id))).toBe(true);
    expect(new Set(hits.map((hit) => hit.category_id)).size).toBeGreaterThan(1);
  });

  it("unknown category matches nothing", async () => {
    expect(await search({ category: "no-such-category" })).toEqual([]);
  });

  it("applies inclusive price bounds", async () => {
    const hits = await search({ min: 100000, max: 300000 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.base_price_paisa >= 100000 && hit.base_price_paisa <= 300000)).toBe(true);
    const [exact] = await db.query<{ p: number }>(
      "select base_price_paisa::int as p from public.products where status = 'active' limit 1",
    ).then((result) => result.rows);
    const pinned = await search({ min: exact!.p, max: exact!.p });
    expect(pinned.every((hit) => Number(hit.base_price_paisa) === exact!.p)).toBe(true);
    expect(pinned.length).toBeGreaterThan(0);
  });

  it("sorts by price and by newest", async () => {
    const asc = (await search({ sort: "price-asc" })).map((hit) => Number(hit.base_price_paisa));
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await search({ sort: "price-desc" })).map((hit) => Number(hit.base_price_paisa));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const newest = (await search({ sort: "newest" })).map((hit) => Date.parse(hit.published_at));
    expect(newest).toEqual([...newest].sort((a, b) => b - a));
  });

  it("treats an unknown sort as the default", async () => {
    expect(await search({ q: "Pearl Choker", sort: "bogus" })).toEqual(await search({ q: "Pearl Choker" }));
  });

  it("pages with a stable total", async () => {
    const all = await search({ q: "earrings", limit: 48 });
    const first = await search({ q: "earrings", limit: 5 });
    const second = await search({ q: "earrings", limit: 5, offset: 5 });
    expect(first.map((hit) => hit.id)).toEqual(all.slice(0, 5).map((hit) => hit.id));
    expect(second.map((hit) => hit.id)).toEqual(all.slice(5, 10).map((hit) => hit.id));
    expect(Number(first[0]?.total_count)).toBe(all.length);
  });

  it("clamps the page size and offset", async () => {
    expect((await search({ limit: 1000 })).length).toBe(48);
    expect((await search({ limit: 0 })).length).toBe(1);
    expect((await search({ limit: 5, offset: -10 })).map((hit) => hit.id)).toEqual(
      (await search({ limit: 5 })).map((hit) => hit.id),
    );
  });

  it("returns the cover photo path", async () => {
    const [hit] = await search({ q: "Pearl Choker" });
    expect(hit?.cover_path).toMatch(/^products\//);
  });
});

describe("search_products safety", () => {
  it.each([
    "'); drop table public.products; --",
    "%_\\",
    "a:* & !b | (c",
    "<script>",
    "x".repeat(5000),
    "   ",
  ])("handles hostile input %#", async (q) => {
    await expect(search({ q })).resolves.toBeInstanceOf(Array);
    expect(await scalar<number>("select count(*)::int from public.products")).toBeGreaterThan(0);
  });

  it("is callable by anon and runs with a fixed search_path as invoker", async () => {
    expect(await runAs(db, anon, "select count(*)::int from public.search_products('earrings')")).toBeGreaterThan(0);
    const config = await scalar<string[]>(
      "select proconfig from pg_proc where proname = 'search_products'",
    );
    expect(config).toContain('search_path=""');
    expect(await scalar<boolean>("select prosecdef from pg_proc where proname = 'search_products'")).toBe(false);
  });
});
