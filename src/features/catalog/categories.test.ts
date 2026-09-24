import { afterEach, describe, expect, it, vi } from "vitest";
import { getCategories, getCategoryBySlug, getCategoryProducts } from "./categories";
import { seedCategories } from "./dev-seed";

describe("category reads", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists every homepage category with its product count", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const categories = await getCategories();
    expect(categories.map((category) => category.slug)).toEqual(
      seedCategories.map((category) => category.slug),
    );
    const counts = Object.fromEntries(categories.map((c) => [c.slug, c.productCount]));
    expect(counts.hats).toBe(2);
    expect(counts.tops).toBe(0);
  });

  it("finds a category by slug", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await getCategoryBySlug("hats"))?.title).toBe("Hats");
    expect(await getCategoryBySlug("does-not-exist")).toBeNull();
  });

  it("returns only that category's products, sorted", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const featured = await getCategoryProducts("hats", "featured");
    expect(featured.every((product) => product.categorySlug === "hats")).toBe(true);
    expect(featured).toHaveLength(2);

    const ascending = await getCategoryProducts("hats", "price-asc");
    const descending = await getCategoryProducts("hats", "price-desc");
    expect(ascending[0].pricePaisa).toBeLessThanOrEqual(ascending[1].pricePaisa);
    expect(descending.map((p) => p.slug)).toEqual([...ascending].reverse().map((p) => p.slug));
    expect(await getCategoryProducts("tops", "featured")).toEqual([]);
  });

  it("never serves seed categories in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await getCategories()).toEqual([]);
    expect(await getCategoryBySlug("hats")).toBeNull();
    expect(await getCategoryProducts("hats", "featured")).toEqual([]);
  });
});
