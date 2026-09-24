import { describe, expect, it } from "vitest";
import { parseCategorySort, sortProducts } from "./category-sort";

describe("parseCategorySort", () => {
  it("accepts known values", () => {
    expect(parseCategorySort("price-asc")).toBe("price-asc");
    expect(parseCategorySort("price-desc")).toBe("price-desc");
    expect(parseCategorySort("featured")).toBe("featured");
  });

  it("falls back to featured for missing or unknown values", () => {
    expect(parseCategorySort(undefined)).toBe("featured");
    expect(parseCategorySort("")).toBe("featured");
    expect(parseCategorySort("junk")).toBe("featured");
    expect(parseCategorySort("PRICE-ASC")).toBe("featured");
  });

  it("uses the first value when the param repeats", () => {
    expect(parseCategorySort(["price-desc", "price-asc"])).toBe("price-desc");
  });
});

describe("sortProducts", () => {
  const products = [
    { slug: "b", pricePaisa: 250000 },
    { slug: "a", pricePaisa: 99900 },
    { slug: "c", pricePaisa: 250000 },
    { slug: "d", pricePaisa: 399900 },
  ];

  it("keeps catalog order for featured", () => {
    expect(sortProducts(products, "featured").map((p) => p.slug)).toEqual(["b", "a", "c", "d"]);
  });

  it("sorts by price, keeping catalog order for ties", () => {
    expect(sortProducts(products, "price-asc").map((p) => p.slug)).toEqual(["a", "b", "c", "d"]);
    expect(sortProducts(products, "price-desc").map((p) => p.slug)).toEqual(["d", "b", "c", "a"]);
  });

  it("does not mutate the input", () => {
    sortProducts(products, "price-asc");
    expect(products.map((p) => p.slug)).toEqual(["b", "a", "c", "d"]);
  });
});
