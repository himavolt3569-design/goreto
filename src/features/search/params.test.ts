import { describe, expect, it } from "vitest";
import {
  buildSearchHref,
  hasActiveFilters,
  parseSearchParams,
  rupeesToPaisa,
  searchSortOptions,
  type SearchParams,
} from "./params";

const base: SearchParams = {
  q: "",
  category: null,
  minRupees: null,
  maxRupees: null,
  sort: "featured",
  page: 1,
};

describe("parseSearchParams", () => {
  it("defaults to the full listing", () => {
    expect(parseSearchParams({})).toEqual(base);
  });

  it("sanitises and bounds the query", () => {
    expect(parseSearchParams({ q: "  pearl,(drop)* " }).q).toBe("pearl drop");
    expect(parseSearchParams({ q: "x".repeat(200) }).q).toHaveLength(64);
    expect(parseSearchParams({ q: ["earrings", "rings"] }).q).toBe("earrings");
  });

  it("defaults the sort to relevance with a query and featured without", () => {
    expect(parseSearchParams({ q: "hoops" }).sort).toBe("relevance");
    expect(parseSearchParams({}).sort).toBe("featured");
    expect(parseSearchParams({ sort: "relevance" }).sort).toBe("featured");
    expect(parseSearchParams({ sort: "newest" }).sort).toBe("newest");
    expect(parseSearchParams({ q: "hoops", sort: "junk" }).sort).toBe("relevance");
  });

  it("accepts only valid category slugs", () => {
    expect(parseSearchParams({ category: "earrings" }).category).toBe("earrings");
    expect(parseSearchParams({ category: "Ear rings" }).category).toBeNull();
    expect(parseSearchParams({ category: "a,b)" }).category).toBeNull();
  });

  it("parses whole-rupee prices and swaps a reversed range", () => {
    expect(parseSearchParams({ min: "1,000", max: "5000" })).toMatchObject({ minRupees: 1000, maxRupees: 5000 });
    expect(parseSearchParams({ min: "5000", max: "1000" })).toMatchObject({ minRupees: 1000, maxRupees: 5000 });
    for (const bad of ["-5", "12.5", "1e5", "abc", "", "99999999999"]) {
      expect(parseSearchParams({ min: bad }).minRupees).toBeNull();
    }
    expect(parseSearchParams({ max: "0" }).maxRupees).toBe(0);
  });

  it("clamps the page", () => {
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
    expect(parseSearchParams({ page: "0" }).page).toBe(1);
    expect(parseSearchParams({ page: "-2" }).page).toBe(1);
    expect(parseSearchParams({ page: "9999" }).page).toBe(200);
    expect(parseSearchParams({ page: "two" }).page).toBe(1);
  });
});

describe("buildSearchHref", () => {
  const withQuery: SearchParams = { ...base, q: "gold hoops", sort: "relevance", page: 3 };

  it("leaves defaults out of the URL", () => {
    expect(buildSearchHref(base)).toBe("/search");
    expect(buildSearchHref({ ...base, q: "gold hoops", sort: "relevance" })).toBe("/search?q=gold+hoops");
  });

  it("resets the page when anything but the page changes", () => {
    expect(buildSearchHref(withQuery, { sort: "price-asc" })).toBe("/search?q=gold+hoops&sort=price-asc");
    expect(buildSearchHref(withQuery, { page: 4 })).toBe("/search?q=gold+hoops&page=4");
  });

  it("writes every filter", () => {
    expect(
      buildSearchHref({ ...base, category: "earrings", minRupees: 500, maxRupees: 2000, sort: "newest" }),
    ).toBe("/search?category=earrings&min=500&max=2000&sort=newest");
  });

  it("drops relevance when the query is cleared", () => {
    expect(buildSearchHref(withQuery, { q: "" })).toBe("/search");
  });
});

describe("helpers", () => {
  it("offers relevance only with a query", () => {
    expect(searchSortOptions("").map((option) => option.value)).not.toContain("relevance");
    expect(searchSortOptions("x").map((option) => option.value)).toContain("relevance");
  });

  it("detects active filters", () => {
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, q: "x" })).toBe(false);
    expect(hasActiveFilters({ ...base, maxRupees: 0 })).toBe(true);
  });

  it("converts rupees to integer paisa", () => {
    expect(rupeesToPaisa(2499)).toBe(249900);
    expect(rupeesToPaisa(null)).toBeNull();
  });
});
