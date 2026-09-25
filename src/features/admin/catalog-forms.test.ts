import { describe, expect, it } from "vitest";
import {
  categoryFormSchema,
  collectionFormSchema,
  fromKathmanduInput,
  imageFolder,
  parseUploadedImagePath,
  toKathmanduInput,
} from "./catalog-forms";

const ID = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";
const FILE = "00000000-0000-4000-8000-000000000001";

describe("uploaded image paths", () => {
  it("accepts the record and staging folders of its own kind", () => {
    expect(parseUploadedImagePath("category", `categories/${ID}/${FILE}.jpg`)).toEqual({ staged: false, ownerId: ID, format: "jpg" });
    expect(parseUploadedImagePath("collection", `collections/new-${ID}/${FILE}.webp`)).toEqual({ staged: true, ownerId: ID, format: "webp" });
  });

  it("rejects seed images, other folders and other file types", () => {
    expect(parseUploadedImagePath("category", "categories/dresses.jpg")).toBeNull();
    expect(parseUploadedImagePath("category", `collections/${ID}/${FILE}.jpg`)).toBeNull();
    expect(parseUploadedImagePath("collection", `products/${ID}/${FILE}.jpg`)).toBeNull();
    expect(parseUploadedImagePath("category", `categories/${ID}/${FILE}.gif`)).toBeNull();
    expect(parseUploadedImagePath("category", `categories/${ID}/../${FILE}.jpg`)).toBeNull();
  });

  it("builds folders the parser accepts", () => {
    expect(imageFolder("category", { ownerId: ID })).toBe(`categories/${ID}`);
    expect(imageFolder("collection", { stagingId: ID })).toBe(`collections/new-${ID}`);
  });
});

describe("Kathmandu date-times", () => {
  it("converts UTC to Nepal time (+05:45) for the input and back", () => {
    expect(toKathmanduInput("2026-10-01T03:15:00.000Z")).toBe("2026-10-01T09:00");
    expect(fromKathmanduInput("2026-10-01T09:00")).toBe("2026-10-01T03:15:00.000Z");
    expect(fromKathmanduInput(toKathmanduInput("2026-12-31T20:00:00.000Z"))).toBe("2026-12-31T20:00:00.000Z");
  });

  it("handles empty and invalid values", () => {
    expect(toKathmanduInput(null)).toBe("");
    expect(toKathmanduInput("not a date")).toBe("");
    expect(fromKathmanduInput("")).toBeNull();
    expect(fromKathmanduInput("2026-13-45T99:00")).toBeNull();
  });
});

const category = (overrides: Record<string, string> = {}) => ({
  title: "Festive Wear",
  slug: "festive-wear",
  parentId: "",
  description: "",
  imagePath: "",
  sortOrder: "10",
  ...overrides,
});

describe("categoryFormSchema", () => {
  it("parses a new top-level category", () => {
    expect(categoryFormSchema.parse({ ...category(), isActive: "on" })).toMatchObject({
      title: "Festive Wear",
      slug: "festive-wear",
      parentId: null,
      imagePath: null,
      isActive: true,
      sortOrder: 10,
    });
  });

  it("treats a missing parent (disabled select) as top-level and a missing checkbox as hidden", () => {
    const withoutParent: Record<string, string> = category();
    delete withoutParent.parentId;
    expect(categoryFormSchema.parse(withoutParent)).toMatchObject({ parentId: null, isActive: false });
  });

  it.each([
    ["an empty name", { title: " " }, "title"],
    ["a short slug", { slug: "ab" }, "slug"],
    ["a 9-word slug", { slug: "a1-b2-c3-d4-e5-f6-g7-h8-i9" }, "slug"],
    ["a bad parent id", { parentId: "nope" }, "parentId"],
    ["a negative sort order", { sortOrder: "-1" }, "sortOrder"],
    ["a long description", { description: "x".repeat(501) }, "description"],
  ])("rejects %s", (_label, overrides, field) => {
    const result = categoryFormSchema.safeParse(category(overrides));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });
});

const collection = (overrides: Record<string, string> = {}) => ({
  title: "Dashain Edit",
  slug: "dashain-edit",
  eyebrow: "Festive",
  description: "",
  heroImagePath: `collections/new-${ID}/${FILE}.jpg`,
  heroImageAlt: "Red sari",
  sortOrder: "0",
  startsAt: "2026-10-01T09:00",
  endsAt: "",
  productIds: `${ID},${FILE}`,
  isActive: "on",
  ...overrides,
});

describe("collectionFormSchema", () => {
  it("parses dates in Nepal time and the ordered product list", () => {
    expect(collectionFormSchema.parse(collection())).toMatchObject({
      startsAt: "2026-10-01T03:15:00.000Z",
      endsAt: null,
      productIds: [ID, FILE],
      isActive: true,
    });
  });

  it("defaults the alt text when its field is disabled (no image)", () => {
    const withoutAlt: Record<string, string> = collection({ heroImagePath: "" });
    delete withoutAlt.heroImageAlt;
    expect(collectionFormSchema.parse(withoutAlt)).toMatchObject({ heroImagePath: null, heroImageAlt: "" });
  });

  it.each([
    ["an image without alt text", { heroImageAlt: "" }, "heroImageAlt"],
    ["an end before the start", { endsAt: "2026-09-30T09:00" }, "endsAt"],
    ["a malformed date", { startsAt: "tomorrow" }, "startsAt"],
    ["a duplicate product", { productIds: `${ID},${ID}` }, "productIds"],
    ["a bad product id", { productIds: "abc" }, "productIds"],
  ])("rejects %s", (_label, overrides, field) => {
    const result = collectionFormSchema.safeParse(collection(overrides));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });
});
