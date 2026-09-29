import { describe, expect, it } from "vitest";
import { pageNumber, pageRange, toPage } from "./page";

describe("pageNumber", () => {
  it("reads a 1-based page and falls back to 1", () => {
    expect(pageNumber("3")).toBe(3);
    expect(pageNumber(["2", "9"])).toBe(2);
    expect(pageNumber(undefined)).toBe(1);
    expect(pageNumber("0")).toBe(1);
    expect(pageNumber("-2")).toBe(1);
    expect(pageNumber("1.5")).toBe(1);
    expect(pageNumber("abc")).toBe(1);
    expect(pageNumber("10001")).toBe(1);
  });
});

describe("pageRange", () => {
  it("returns the inclusive row range for a page", () => {
    expect(pageRange(1)).toEqual([0, 19]);
    expect(pageRange(3, 10)).toEqual([20, 29]);
  });
});

describe("toPage", () => {
  it("counts pages from the total, with at least one page", () => {
    expect(toPage(["a"], 21, 1)).toEqual({ rows: ["a"], total: 21, page: 1, pageCount: 2 });
    expect(toPage([], 0, 1, 10).pageCount).toBe(1);
    expect(toPage(["a", "b"], null, 1, 10).total).toBe(2);
  });
});
