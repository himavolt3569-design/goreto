import { describe, expect, it } from "vitest";
import { slugProblem } from "./keys";
import { defaultAltText, emptyQuickProduct, numberedSku, numberedSlug, quickKeys, quickProductSchema, toProductFormValues } from "./quick-product";
import { productFormSchema } from "./schema";

const CATEGORY_ID = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";

const card = (overrides: Partial<ReturnType<typeof emptyQuickProduct>> = {}) => ({
  ...emptyQuickProduct(CATEGORY_ID),
  title: "Silver Jhumka Earrings",
  price: "2,499",
  ...overrides,
});

describe("quick product card", () => {
  it("needs a name, a category and a price", () => {
    const parsed = quickProductSchema.safeParse(emptyQuickProduct());
    expect(parsed.success).toBe(false);
    const paths = parsed.error!.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["title", "categoryId", "price"]));
  });

  it("parses rupees to paisa and stock to a number", () => {
    const parsed = quickProductSchema.parse(card({ compareAtPrice: "2999.50", stock: "12" }));
    expect(parsed).toMatchObject({ price: 249_900, compareAtPrice: 299_950, stock: 12, publish: false });
  });

  it("wants the was price above the price", () => {
    const parsed = quickProductSchema.safeParse(card({ compareAtPrice: "1,999" }));
    expect(parsed.error?.issues[0]?.path).toEqual(["compareAtPrice"]);
  });

  it("becomes a valid one-variant product for the full editor's schema", () => {
    const values = toProductFormValues(card({ stock: "4", publish: true }), { slug: "silver-jhumka-earrings", sku: "GRT-SJE-STD", lowStockThreshold: 5 });
    const parsed = productFormSchema.parse(values);
    expect(parsed).toMatchObject({ status: "active", basePrice: 249_900, options: [], collectionIds: null });
    expect(parsed.variants).toEqual([expect.objectContaining({ id: null, sku: "GRT-SJE-STD", initialStock: 4, isActive: true })]);
  });
});

describe("quick product keys", () => {
  it("derives the slug and SKU from the name", () => {
    expect(quickKeys("Silver Jhumka Earrings")).toEqual({ slug: "silver-jhumka-earrings", sku: "GRT-SJE-STD" });
    expect(slugProblem(quickKeys("Ab").slug)).toBeNull();
    expect(slugProblem(quickKeys("!!!").slug)).toBeNull();
  });

  it("numbers repeats within the slug limits", () => {
    expect(numberedSlug("silver-hoop", 1)).toBe("silver-hoop");
    expect(numberedSlug("silver-hoop", 2)).toBe("silver-hoop-2");
    const long = "one-two-three-four-five-six-seven-eight";
    expect(numberedSlug(long, 3)).toBe("one-two-three-four-five-six-seven-3");
    expect(slugProblem(numberedSlug(long, 3))).toBeNull();
    expect(numberedSku("GRT-SH-STD", 2)).toBe("GRT-SH-STD-2");
  });

  it("writes alt text from the name", () => {
    expect(defaultAltText(" Silver hoop ", "image", 1)).toBe("Silver hoop");
    expect(defaultAltText("Silver hoop", "image", 3)).toBe("Silver hoop, photo 3");
    expect(defaultAltText("Silver hoop", "video", 1)).toBe("Silver hoop, video 1");
  });
});
