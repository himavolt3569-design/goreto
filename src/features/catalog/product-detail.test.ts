import { afterEach, describe, expect, it, vi } from "vitest";
import { seedFeaturedProducts, seedProducts } from "./dev-seed";
import { getProductBySlug, getProductSlugs, getRelatedProducts } from "./product-detail";

describe("product detail reads", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("finds a seed product by slug outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const product = await getProductBySlug("beaded-wrist-stack");
    expect(product?.title).toBe("Beaded Wrist Stack");
    expect(await getProductBySlug("does-not-exist")).toBeNull();
  });

  it("never serves seed products in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await getProductBySlug("felt-fedora")).toBeNull();
    expect(await getProductSlugs()).toEqual([]);
    expect(await getRelatedProducts({ slug: "x", category: { slug: "hats", title: "Hats" } })).toEqual(
      [],
    );
  });

  it("has a product page for every featured homepage product", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const slugs = await getProductSlugs();
    for (const featured of seedFeaturedProducts) {
      expect(slugs).toContain(featured.slug);
    }
  });

  it("puts same-category products first and never the product itself", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const beanie = await getProductBySlug("knit-slouch-beanie");
    if (!beanie) throw new Error("missing beanie");
    const related = await getRelatedProducts(beanie, 4);
    expect(related).toHaveLength(4);
    expect(related[0].slug).toBe("felt-fedora");
    expect(related.map((item) => item.slug)).not.toContain("knit-slouch-beanie");
  });
});

describe("seed catalog integrity", () => {
  it("uses unique slugs, variant ids and SKUs", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(seedProducts.map((product) => product.slug))).toBe(true);
    const variants = seedProducts.flatMap((product) => product.variants);
    expect(unique(variants.map((variant) => variant.id))).toBe(true);
    expect(unique(variants.map((variant) => variant.sku))).toBe(true);
  });

  it("stores money as integer paisa and stock as non-negative integers", () => {
    for (const product of seedProducts) {
      expect(Number.isSafeInteger(product.basePricePaisa)).toBe(true);
      for (const variant of product.variants) {
        if (variant.pricePaisa !== null) expect(Number.isSafeInteger(variant.pricePaisa)).toBe(true);
        expect(Number.isSafeInteger(variant.stockQuantity)).toBe(true);
        expect(variant.stockQuantity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("gives every variant a value for each of its product's options", () => {
    for (const product of seedProducts) {
      expect(product.variants.length).toBeGreaterThan(0);
      expect(product.media.length).toBeGreaterThan(0);
      for (const variant of product.variants) {
        for (const option of product.options) {
          const value = variant.optionValues[option.name];
          expect(option.values.map((candidate) => candidate.value)).toContain(value);
        }
      }
    }
  });
});
