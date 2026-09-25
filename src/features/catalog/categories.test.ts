import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCategories, getCategoryBySlug, getCategoryProducts } from "./categories";

vi.mock("./queries", () => import("@/test/fakes/catalog-queries"));
// unstable_cache needs the Next.js runtime; in tests it just calls through.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
});

describe("category reads", () => {
  it("lists top-level categories with counts that include subcategories", async () => {
    const categories = await getCategories();
    expect(categories.map((category) => [category.slug, category.productCount])).toEqual([
      ["jewelry", 3],
      ["bags", 1],
      ["hats", 1],
    ]);
  });

  it("finds a category by slug, with its parent for subcategories", async () => {
    expect(await getCategoryBySlug("jewelry")).toMatchObject({ title: "Jewelry", parent: null });
    expect((await getCategoryBySlug("earrings"))?.parent).toEqual({ slug: "jewelry", title: "Jewelry" });
    expect(await getCategoryBySlug("does-not-exist")).toBeNull();
  });

  it("rejects malformed slugs without querying", async () => {
    expect(await getCategoryBySlug("Jewelry")).toBeNull();
    expect(await getCategoryBySlug("../jewelry")).toBeNull();
    expect(await getCategoryProducts("a".repeat(121), "featured")).toEqual([]);
  });

  it("includes subcategory products, sorted", async () => {
    const featured = await getCategoryProducts("jewelry", "featured");
    expect(featured.map((product) => product.slug).sort()).toEqual([
      "minimal-gold-bracelet",
      "pearl-drop-earrings",
      "silver-jhumka",
    ]);
    expect(featured.every((product) => product.categorySlug === "jewelry")).toBe(true);

    const ascending = await getCategoryProducts("jewelry", "price-asc");
    expect(ascending.map((product) => product.pricePaisa)).toEqual([129900, 179900, 249900]);
    const descending = await getCategoryProducts("jewelry", "price-desc");
    expect(descending.map((product) => product.slug)).toEqual([...ascending].reverse().map((p) => p.slug));

    expect((await getCategoryProducts("earrings", "featured")).map((p) => p.slug).sort()).toEqual([
      "pearl-drop-earrings",
      "silver-jhumka",
    ]);
    expect(await getCategoryProducts("does-not-exist", "featured")).toEqual([]);
  });

  it("attaches published ratings", async () => {
    const [pearl] = (await getCategoryProducts("earrings", "price-desc"));
    expect(pearl.rating).toEqual({ value: 4.8, count: 120 });
  });
});
