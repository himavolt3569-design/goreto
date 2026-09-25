import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedFeaturedProducts } from "@/test/fixtures/catalog";
import { FEATURED_TABS, filterByTab } from "./featured-tabs";
import { getHomepageData } from "./homepage";

vi.mock("./queries", () => import("@/test/fakes/catalog-queries"));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_anon_key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_service_role_key");
});

function tab(key: string) {
  const found = FEATURED_TABS.find((t) => t.key === key);
  if (!found) throw new Error(`missing tab ${key}`);
  return found;
}

describe("getHomepageData", () => {
  it("builds every section from the catalog queries", async () => {
    const data = await getHomepageData();
    expect(data.categories.map((category) => category.slug)).toEqual(["jewelry", "bags", "hats"]);
    expect(data.featuredProducts.map((product) => product.slug)).toEqual([
      "pearl-drop-earrings",
      "canvas-tote",
    ]);
    expect(data.featuredProducts[0].categorySlug).toBe("jewelry");
    expect(data.collections.map((collection) => collection.slug)).toEqual(["autumn-styles"]);
    expect(data.testimonials).toHaveLength(1);
  });

  it("keeps prices as integer paisa", async () => {
    for (const product of (await getHomepageData()).featuredProducts) {
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
