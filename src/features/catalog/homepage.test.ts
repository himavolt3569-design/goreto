import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURED_TABS, filterByTab } from "./featured-tabs";
import { getHomepageData } from "./homepage";
import { seedFeaturedProducts } from "./dev-seed";

function tab(key: string) {
  const found = FEATURED_TABS.find((t) => t.key === key);
  if (!found) throw new Error(`missing tab ${key}`);
  return found;
}

describe("getHomepageData", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves the development seed outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const data = await getHomepageData();
    expect(data.featuredProducts.length).toBeGreaterThan(0);
    expect(data.testimonials.length).toBeGreaterThan(0);
  });

  it("never serves seed products or testimonials in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const data = await getHomepageData();
    expect(data).toEqual({
      categories: [],
      featuredProducts: [],
      collections: [],
      testimonials: [],
    });
  });

  it("stores seed prices as integer paisa", () => {
    for (const product of seedFeaturedProducts) {
      expect(Number.isSafeInteger(product.pricePaisa)).toBe(true);
    }
  });
});

describe("filterByTab", () => {
  it("returns every product for All", () => {
    expect(filterByTab(seedFeaturedProducts, tab("all"))).toHaveLength(
      seedFeaturedProducts.length,
    );
  });

  it("filters by the tab's category slugs", () => {
    const bags = filterByTab(seedFeaturedProducts, tab("bags"));
    expect(bags.map((p) => p.slug)).toEqual(["leather-weekender-bag"]);

    const accessories = filterByTab(seedFeaturedProducts, tab("accessories"));
    expect(accessories.map((p) => p.slug)).toEqual(["aviator-sunglasses"]);
  });
});
