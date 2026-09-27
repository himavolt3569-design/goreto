import { describe, expect, it } from "vitest";
import { copySku, copySlug, copyTitle, duplicateValues } from "./duplicate";
import { slugProblem } from "./keys";
import { emptyProductValues, emptyVariant, productFormSchema } from "./schema";

describe("copySlug", () => {
  it("adds -copy, then numbers", () => {
    expect(copySlug("pearl-drop-earrings", new Set())).toBe("pearl-drop-earrings-copy");
    expect(copySlug("pearl-drop-earrings", new Set(["pearl-drop-earrings-copy", "pearl-drop-earrings-copy-2"]))).toBe("pearl-drop-earrings-copy-3");
  });

  it("keeps the 8-word and 80-character limits", () => {
    const eight = "one-two-three-four-five-six-seven-eight";
    expect(copySlug(eight, new Set())).toBe("one-two-three-four-five-six-seven-copy");
    expect(copySlug(eight, new Set(["one-two-three-four-five-six-seven-copy"]))).toBe("one-two-three-four-five-six-copy-2");
    const long = `${"a".repeat(38)}-${"b".repeat(38)}`;
    const copied = copySlug(long, new Set());
    expect(slugProblem(copied)).toBeNull();
    expect(copied).toBe(`${"a".repeat(38)}-copy`);
  });
});

describe("copySku", () => {
  it("adds -COPY, avoids taken SKUs and remembers what it used", () => {
    const taken = new Set(["GRT-PDE-GLD-COPY"]);
    expect(copySku("GRT-PDE-GLD", taken)).toBe("GRT-PDE-GLD-COPY-2");
    expect(copySku("GRT-PDE-GLD", taken)).toBe("GRT-PDE-GLD-COPY-3");
    expect(copySku("X".repeat(64), new Set())).toHaveLength(64);
  });
});

describe("duplicateValues", () => {
  const source = {
    ...emptyProductValues(5, true),
    title: "Pearl Drop Earrings",
    slug: "pearl-drop-earrings",
    categoryId: "11111111-1111-4111-8111-111111111111",
    basePrice: "2499",
    status: "active" as const,
    isFeatured: true,
    isBestseller: true,
    variants: [{ ...emptyVariant("GRT-PDE-STD", {}), id: "22222222-2222-4222-8222-222222222222", initialStock: "0" }],
    collectionIds: ["33333333-3333-4333-8333-333333333333"],
  };

  it("makes a valid draft copy with new variants", () => {
    const copy = duplicateValues(source, { takenSlugs: new Set(), takenSkus: new Set(), linkCollections: true });
    expect(copy).toMatchObject({ title: "Pearl Drop Earrings (copy)", slug: "pearl-drop-earrings-copy", status: "draft", isFeatured: false, isBestseller: false });
    expect(copy.variants).toEqual([expect.objectContaining({ id: null, sku: "GRT-PDE-STD-COPY", initialStock: "0" })]);
    expect(copy.collectionIds).toEqual(source.collectionIds);
    expect(productFormSchema.safeParse(copy).success).toBe(true);
  });

  it("leaves collections out when the caller can't link them", () => {
    expect(duplicateValues(source, { takenSlugs: new Set(), takenSkus: new Set(), linkCollections: false }).collectionIds).toBeNull();
  });

  it("caps a long name", () => {
    expect(copyTitle("x".repeat(120))).toHaveLength(120);
  });
});
