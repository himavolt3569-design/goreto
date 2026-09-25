import { describe, expect, it, vi } from "vitest";
import {
  cardRows,
  categoryRows,
  collectionRows,
  detailRow,
  FIXED_NOW,
  ratingRows,
  testimonialRows,
} from "@/test/fixtures/catalog-rows";
import {
  indexCategories,
  parseOptions,
  parseSpecs,
  productBadge,
  toCategoryDetail,
  toCategorySummary,
  toHomeCollection,
  toHomeProduct,
  toProductDetail,
  toProductSummary,
  toTestimonial,
} from "./mappers";

const DAY = 24 * 60 * 60 * 1000;

// Top level: some describe blocks map fixtures while tests are collected.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");

describe("indexCategories", () => {
  const index = indexCategories(categoryRows);

  it("lists top-level categories in the given order", () => {
    expect(index.topLevel.map((row) => row.slug)).toEqual(["jewelry", "bags", "hats"]);
  });

  it("resolves the top-level ancestor at any depth", () => {
    expect(index.rootOf("c-jhumkas")?.slug).toBe("jewelry");
    expect(index.rootOf("c-bags")?.slug).toBe("bags");
    expect(index.rootOf("missing")).toBeUndefined();
  });

  it("collects a category's whole subtree", () => {
    expect(index.subtreeIds("c-jewelry").sort()).toEqual(["c-earrings", "c-jewelry", "c-jhumkas"]);
    expect(index.subtreeIds("c-hats")).toEqual(["c-hats"]);
  });

  it("survives a parent cycle", () => {
    const cyclic = indexCategories([
      { ...categoryRows[0], id: "a", parent_id: "b" },
      { ...categoryRows[1], id: "b", parent_id: "a" },
    ]);
    expect(cyclic.rootOf("a")).toBeDefined();
    expect(cyclic.subtreeIds("a").sort()).toEqual(["a", "b"]);
  });
});

describe("category view models", () => {
  const index = indexCategories(categoryRows);

  it("counts subcategory products and keeps missing photos as null", () => {
    const counts = new Map([
      ["c-jewelry", 1],
      ["c-earrings", 2],
      ["c-jhumkas", 3],
    ]);
    const jewelry = toCategorySummary(categoryRows[0], index, counts);
    expect(jewelry.productCount).toBe(6);
    expect(jewelry.image?.src).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-media/categories/jewelry.jpg",
    );
    expect(jewelry.image?.alt).toBe("");
    expect(toCategorySummary(categoryRows[2], index, counts)).toMatchObject({ productCount: 0, image: null });
  });

  it("gives subcategories their parent for breadcrumbs", () => {
    expect(toCategoryDetail(categoryRows[3], index).parent).toEqual({ slug: "jewelry", title: "Jewelry" });
    expect(toCategoryDetail(categoryRows[0], index).parent).toBeNull();
  });
});

describe("product cards", () => {
  const index = indexCategories(categoryRows);
  const ratings = new Map(ratingRows.map((row) => [row.product_id, row]));

  it("uses the top-level category slug so homepage tabs keep working", () => {
    expect(toHomeProduct(cardRows[2], index).categorySlug).toBe("jewelry");
  });

  it("uses the cover photo, or null without one", () => {
    expect(toHomeProduct(cardRows[0], index).image?.alt).toBe("Pearl Drop Earrings photo");
    expect(toHomeProduct(cardRows[2], index).image).toBeNull();
  });

  it("attaches ratings only when there are published reviews", () => {
    expect(toProductSummary(cardRows[0], index, ratings).rating).toEqual({ value: 4.8, count: 120 });
    expect(toProductSummary(cardRows[3], index, ratings).rating).toBeNull();
    expect(toProductSummary(cardRows[4], index, ratings).rating).toBeNull();
  });
});

describe("productBadge", () => {
  const base = { is_limited_edition: false, is_bestseller: false, published_at: null };

  it("prefers limited, then bestseller, then new", () => {
    const recent = new Date(FIXED_NOW - 5 * DAY).toISOString();
    expect(productBadge({ ...base, is_limited_edition: true, is_bestseller: true, published_at: recent }, FIXED_NOW)?.tone).toBe("limited");
    expect(productBadge({ ...base, is_bestseller: true, published_at: recent }, FIXED_NOW)?.tone).toBe("bestseller");
    expect(productBadge({ ...base, published_at: recent }, FIXED_NOW)).toEqual({ tone: "new", label: "New" });
  });

  it("drops New after 30 days and ignores future dates", () => {
    expect(productBadge({ ...base, published_at: new Date(FIXED_NOW - 31 * DAY).toISOString() }, FIXED_NOW)).toBeNull();
    expect(productBadge({ ...base, published_at: new Date(FIXED_NOW + DAY).toISOString() }, FIXED_NOW)).toBeNull();
    expect(productBadge(base, FIXED_NOW)).toBeNull();
  });
});

describe("toProductDetail", () => {
  const index = indexCategories(categoryRows);
  const product = toProductDetail(detailRow, index, ratingRows[0], FIXED_NOW);

  it("maps the category, badge and rating", () => {
    expect(product.category).toEqual({ slug: "earrings", title: "Earrings" });
    expect(product.badge?.tone).toBe("bestseller");
    expect(product.rating).toEqual({ value: 4.8, count: 120 });
  });

  it("keeps active variants only, in sort order, with price overrides and stock", () => {
    expect(product.variants).toEqual([
      { id: "v-gold", sku: "GRT-PDE-GLD", optionValues: { Metal: "gold" }, pricePaisa: null, stockQuantity: 12 },
      { id: "v-silver", sku: "GRT-PDE-SLV", optionValues: { Metal: "silver" }, pricePaisa: 229900, stockQuantity: 0 },
    ]);
  });

  it("orders media and keeps variant-specific photos linked", () => {
    expect(product.media.map((item) => [item.id, item.variantId])).toEqual([
      ["m-1", null],
      ["m-2", "v-silver"],
    ]);
    expect(product.media[0].image.alt).toBe("Pearl earrings on a model");
  });

  it("maps swatches from snake_case JSON", () => {
    expect(product.options).toEqual([
      {
        name: "Metal",
        values: [
          { value: "gold", label: "Gold", swatchHex: "#C9A24A" },
          { value: "silver", label: "Silver" },
        ],
      },
    ]);
  });

  it("offers live try-on only from live assets, never photo try-on", () => {
    expect(product.tryOn).toEqual({
      modes: ["live"],
      placement: "ear",
      previewImage: {
        src: "https://abc.supabase.co/storage/v1/object/public/product-media/products/pearl-drop-earrings/01.jpg",
        alt: "",
      },
    });
    const photoOnly = toProductDetail(
      { ...detailRow, product_ar_assets: [{ mode: "photo_ai", placement: "upper_body", is_active: true }] },
      index,
      undefined,
      FIXED_NOW,
    );
    expect(photoOnly.tryOn).toBeNull();
    const inactive = toProductDetail(
      { ...detailRow, product_ar_assets: [{ mode: "live_2d", placement: "ear", is_active: false }] },
      index,
      undefined,
      FIXED_NOW,
    );
    expect(inactive.tryOn).toBeNull();
  });
});

describe("JSONB parsing", () => {
  it("treats malformed options and specs as empty", () => {
    expect(parseOptions({ not: "an array" })).toEqual([]);
    expect(parseOptions([{ name: "Color", values: [{ value: "red" }] }])).toEqual([]);
    expect(parseSpecs("nope")).toEqual([]);
    expect(parseSpecs([{ label: "Fit", value: "Relaxed" }])).toEqual([{ label: "Fit", value: "Relaxed" }]);
  });
});

describe("homepage content", () => {
  it("skips collections without a hero photo", () => {
    expect(toHomeCollection(collectionRows[0])?.image.alt).toBe("Woven wrap");
    expect(toHomeCollection(collectionRows[1])).toBeNull();
  });

  it("labels testimonials as verified customers without an avatar", () => {
    expect(toTestimonial(testimonialRows[0])).toEqual({
      id: "r-1",
      quote: "Beautiful finish and quick delivery to Pokhara.",
      authorName: "Priya S.",
      authorLabel: "Verified Customer",
    });
  });
});
