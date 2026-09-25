import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProductBySlug, getProductSlugs, getRelatedProducts } from "./product-detail";

vi.mock("./queries", () => import("@/test/fakes/catalog-queries"));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
});

describe("product detail reads", () => {
  it("finds an active product by slug", async () => {
    const product = await getProductBySlug("pearl-drop-earrings");
    expect(product?.title).toBe("Pearl Drop Earrings");
    expect(product?.category).toEqual({ slug: "earrings", title: "Earrings" });
    expect(product?.rating).toEqual({ value: 4.8, count: 120 });
    expect(product?.variants.map((variant) => variant.sku)).toEqual(["GRT-PDE-GLD", "GRT-PDE-SLV"]);
  });

  it("returns null for unknown or malformed slugs", async () => {
    expect(await getProductBySlug("does-not-exist")).toBeNull();
    expect(await getProductBySlug("Pearl Drop")).toBeNull();
  });

  it("prerenders the featured products", async () => {
    expect(await getProductSlugs()).toEqual(["pearl-drop-earrings", "canvas-tote"]);
  });

  it("puts the same top-level family first and never the product itself", async () => {
    const related = await getRelatedProducts({
      slug: "pearl-drop-earrings",
      category: { slug: "earrings", title: "Earrings" },
    });
    const slugs = related.map((item) => item.slug);
    expect(slugs.slice(0, 2).sort()).toEqual(["minimal-gold-bracelet", "silver-jhumka"]);
    expect(slugs.slice(2).sort()).toEqual(["canvas-tote", "felt-fedora"]);
    expect(slugs).not.toContain("pearl-drop-earrings");
  });

  it("respects the limit", async () => {
    const related = await getRelatedProducts(
      { slug: "felt-fedora", category: { slug: "hats", title: "Hats" } },
      2,
    );
    expect(related).toHaveLength(2);
    expect(related.map((item) => item.slug)).not.toContain("felt-fedora");
  });
});
