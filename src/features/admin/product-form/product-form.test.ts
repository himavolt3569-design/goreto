import { describe, expect, it } from "vitest";
import { detectImageFormat, formatForContentType } from "./file-signature";
import { normalizeSku, sanitizeSlugInput, skuStem, slugFromTitle, slugProblem, slugWordCount, suggestSku, toKey, uniqueKey } from "./keys";
import { issuesByPath, productFormSchema, toSavePayload, type ProductFormValues, type VariantFormValues } from "./schema";
import { combinationCount, combinations, mergeVariants, renameOptionKey, variantsMatchOptions } from "./variant-matrix";

describe("keys", () => {
  it("derives keys and slugs", () => {
    expect(toKey("Dusty Rose")).toBe("dusty-rose");
    expect(toKey("  Café  Crème! ")).toBe("cafe-creme");
    expect(slugFromTitle("Pearl Drop Earrings (Gold)")).toBe("pearl-drop-earrings-gold");
    expect(uniqueKey("Red", new Set(["red", "red-2"]))).toBe("red-3");
    expect(uniqueKey("!!!", new Set())).toBe("value");
  });

  it("suggests SKUs in the seed's shape", () => {
    expect(skuStem("Pearl Drop Earrings")).toBe("PDE");
    expect(skuStem("The Tote")).toBe("TOT");
    expect(skuStem("")).toBe("NEW");
    expect(suggestSku("PDE", ["Colour", "Size"], { Colour: "dusty-rose", Size: "m" })).toBe("GRT-PDE-DUSTY-ROSE-M");
    expect(suggestSku("PDE", [], {})).toBe("GRT-PDE-STD");
    expect(normalizeSku(" grt pde / gld ")).toBe("GRT-PDE-GLD");
  });
});

describe("URL slugs", () => {
  it("follows the name, capped at 8 words and 80 characters", () => {
    expect(slugFromTitle("Hand Woven Dhaka Topi With Silver Pin For Festival Wear Extra")).toBe("hand-woven-dhaka-topi-with-silver-pin-for");
    expect(slugWordCount(slugFromTitle("One Two Three Four Five Six Seven Eight Nine Ten"))).toBe(8);
    const long = slugFromTitle("Extraordinarilylongwordnumberone Extraordinarilylongwordnumbertwo Extraordinarilylongwordnumberthree");
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long).toBe("extraordinarilylongwordnumberone-extraordinarilylongwordnumbertwo");
    expect(slugFromTitle("Café Crème — Silk Scarf!")).toBe("cafe-creme-silk-scarf");
  });

  it("cleans a custom slug as it's typed", () => {
    expect(sanitizeSlugInput("Dhaka Topi_Festival")).toBe("dhaka-topi-festival");
    expect(sanitizeSlugInput("  --silk!! scarf ")).toBe("silk-scarf-");
    expect(sanitizeSlugInput("a--b")).toBe("a-b");
  });

  it.each([
    ["", /Enter a URL slug/],
    ["ab", /at least 3/],
    ["Silk-Scarf", /lowercase/],
    ["silk-scarf-", /between words/],
    ["one-two-three-four-five-six-seven-eight-nine", /at most 8 words/],
    ["x".repeat(81), /at most 80/],
  ])("explains what's wrong with %j", (slug, message) => {
    expect(slugProblem(slug)).toMatch(message);
  });

  it("accepts good slugs", () => {
    expect(slugProblem("pearl-drop-earrings")).toBeNull();
    expect(slugProblem("one-two-three-four-five-six-seven-eight")).toBeNull();
  });
});

describe("file signature", () => {
  const bytes = (...values: (number | string)[]) =>
    Uint8Array.from(values.flatMap((value) => (typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [value])));

  it("recognises the bucket's image types", () => {
    expect(detectImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(detectImageFormat(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectImageFormat(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe("webp");
    expect(detectImageFormat(bytes(0, 0, 0, 0x1c, "ftypavif"))).toBe("avif");
  });

  it("rejects everything else, whatever the name says", () => {
    expect(detectImageFormat(bytes("hello world, not an image"))).toBeNull();
    expect(detectImageFormat(bytes("GIF89a......"))).toBeNull();
    expect(detectImageFormat(bytes(0, 0, 0, 0x1c, "ftypmp42"))).toBeNull();
    expect(detectImageFormat(new Uint8Array())).toBeNull();
  });

  it("maps content types", () => {
    expect(formatForContentType("image/JPEG")).toBe("jpg");
    expect(formatForContentType("image/gif")).toBeNull();
  });
});

describe("variant matrix", () => {
  const options = [
    { name: "Colour", values: [{ value: "tan" }, { value: "black" }] },
    { name: "Size", values: [{ value: "s" }, { value: "m" }] },
  ];

  it("builds every combination", () => {
    expect(combinations(options)).toEqual([
      { Colour: "tan", Size: "s" },
      { Colour: "tan", Size: "m" },
      { Colour: "black", Size: "s" },
      { Colour: "black", Size: "m" },
    ]);
    expect(combinations([])).toEqual([{}]);
    expect(combinationCount(options)).toBe(4);
  });

  it("keeps existing rows, adds new ones and reports removed ones", () => {
    const current = [
      { id: "a", optionValues: { Size: "s", Colour: "tan" } },
      { id: "gone", optionValues: { Colour: "red", Size: "s" } },
    ];
    const { rows, removed } = mergeVariants(options, current, (optionValues) => ({ id: null as string | null, optionValues }));
    expect(rows.map((row) => row.id)).toEqual(["a", null, null, null]);
    expect(removed.map((row) => row.id)).toEqual(["gone"]);
  });

  it("checks rows against the options, allowing removed rows", () => {
    expect(variantsMatchOptions(options, [{ optionValues: { Colour: "tan", Size: "s" } }])).toBe(true);
    expect(variantsMatchOptions(options, [{ optionValues: { Colour: "tan" } }])).toBe(false);
    expect(variantsMatchOptions([], [{ optionValues: {} }])).toBe(true);
  });

  it("renames an option key", () => {
    expect(renameOptionKey([{ optionValues: { Colour: "tan", Size: "s" } }], "Colour", "Color")).toEqual([
      { optionValues: { Size: "s", Color: "tan" } },
    ]);
  });
});

describe("productFormSchema", () => {
  const variant = (overrides: Partial<VariantFormValues> = {}): VariantFormValues => ({
    id: null,
    sku: "grt-tte-tan",
    title: "",
    optionValues: { Colour: "tan" },
    price: "",
    weightGrams: "",
    isActive: true,
    initialStock: "5",
    ...overrides,
  });

  const values = (overrides: Partial<ProductFormValues> = {}): ProductFormValues => ({
    title: " Test Tote ",
    slug: "test-tote",
    categoryId: "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80",
    shortDescription: "",
    description: "",
    basePrice: "2,499.50",
    compareAtPrice: "",
    status: "draft",
    isFeatured: false,
    isBestseller: false,
    isLimitedEdition: false,
    lowStockThreshold: "3",
    options: [{ name: "Colour", values: [{ value: "tan", label: "Tan", swatchHex: "#c19a6b" }] }],
    variants: [variant()],
    specs: [],
    careInstructions: "",
    tags: ["tote"],
    collectionIds: null,
    ...overrides,
  });

  it("parses to the database payload in paisa", () => {
    const parsed = productFormSchema.parse(values({ variants: [variant({ price: "2600" })] }));
    const payload = toSavePayload(parsed);
    expect(payload.product).toMatchObject({ title: "Test Tote", base_price_paisa: 249950, compare_at_price_paisa: null, low_stock_threshold: 3 });
    expect(payload.product.options[0]!.values[0]).toEqual({ value: "tan", label: "Tan", swatch_hex: "#C19A6B" });
    expect(payload.variants[0]).toMatchObject({ sku: "GRT-TTE-TAN", price_paisa: 260000, weight_grams: null, initial_stock: 5 });
    expect(payload.collectionIds).toBeNull();
  });

  const errorsFor = (input: ProductFormValues) => {
    const result = productFormSchema.safeParse(input);
    return result.success ? {} : issuesByPath(result.error);
  };

  it("puts each error on its field", () => {
    expect(errorsFor(values({ compareAtPrice: "2000" }))).toHaveProperty("compareAtPrice");
    expect(errorsFor(values({ basePrice: "12.345" }))).toHaveProperty("basePrice");
    expect(errorsFor(values({ slug: "Test Tote" }))).toHaveProperty("slug");
    expect(errorsFor(values({ variants: [variant(), variant({ id: null })] }))).toHaveProperty("variants.1.sku");
    expect(errorsFor(values({ variants: [variant({ sku: "bad sku!" })] }))).toHaveProperty("variants.0.sku");
    expect(errorsFor(values({ status: "active", variants: [variant({ isActive: false })] }))).toHaveProperty("status");
  });

  it("requires variants to match the current options", () => {
    expect(errorsFor(values({ variants: [variant({ optionValues: { Colour: "red" } })] }))).toHaveProperty("variants");
    expect(errorsFor(values({ options: [], variants: [variant({ optionValues: {} }), variant({ sku: "GRT-B", optionValues: {} })] }))).toHaveProperty("variants");
  });

  it("rejects duplicate option names and values", () => {
    const errors = errorsFor(
      values({
        options: [
          { name: "Colour", values: [{ value: "tan", label: "Tan", swatchHex: "" }, { value: "tan", label: "Tan", swatchHex: "" }] },
          { name: "colour", values: [{ value: "x", label: "X", swatchHex: "" }] },
        ],
      }),
    );
    expect(errors).toHaveProperty("options.0.values.1.label");
    expect(errors).toHaveProperty("options.1.name");
  });
});
