import { describe, expect, it } from "vitest";
import { categoryOptions } from "./category-options";

describe("categoryOptions", () => {
  it("lists each parent followed by its own children, keeping input order", () => {
    const rows = [
      { id: "earrings", title: "Earrings", parentId: "jewelry" },
      { id: "dresses", title: "Dresses", parentId: null },
      { id: "maxi", title: "Maxi Dresses", parentId: "dresses" },
      { id: "jewelry", title: "Jewelry", parentId: null },
      { id: "midi", title: "Midi Dresses", parentId: "dresses" },
      { id: "rings", title: "Rings", parentId: "jewelry" },
    ];
    expect(categoryOptions(rows)).toEqual([
      { value: "dresses", label: "Dresses", depth: 0 },
      { value: "maxi", label: "Maxi Dresses", depth: 1, context: "Dresses" },
      { value: "midi", label: "Midi Dresses", depth: 1, context: "Dresses" },
      { value: "jewelry", label: "Jewelry", depth: 0 },
      { value: "earrings", label: "Earrings", depth: 1, context: "Jewelry" },
      { value: "rings", label: "Rings", depth: 1, context: "Jewelry" },
    ]);
  });

  it("keeps a subcategory whose parent is missing, at the top level", () => {
    expect(categoryOptions([{ id: "orphan", title: "Orphan", parentId: "gone" }])).toEqual([
      { value: "orphan", label: "Orphan", depth: 0 },
    ]);
  });

  it("returns nothing for no rows", () => {
    expect(categoryOptions([])).toEqual([]);
  });
});
