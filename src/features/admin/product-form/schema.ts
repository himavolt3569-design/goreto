import { z } from "zod";
import { parseRupeesToPaisa } from "@/lib/money/parse";
import { slugProblem } from "./keys";
import { combinationKey, MAX_OPTION_VALUES, MAX_OPTIONS, MAX_VARIANTS } from "./variant-matrix";

/*
 * The product editor's one schema (AGENTS §4.7, §20). The browser runs it for
 * inline errors; the Server Action runs it again on the untrusted input and
 * sends the parsed payload to admin_save_product, which validates once more.
 *
 * Input = what the form holds (rupee strings, typed text).
 * Output = the database payload (integer paisa, trimmed text).
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductFormStatus = (typeof PRODUCT_STATUSES)[number];

const text = (max: number, label = "this") => z.string().trim().max(max, `Keep ${label} under ${max + 1} characters`);

const requiredText = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Use at most ${max} characters`);

const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max, message)
    .transform(Number);

const optionalWholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max), message)
    .transform((value) => (value === "" ? null : Number(value)));

const rupees = (required: boolean) =>
  z.string().transform((value, context) => {
    if (value.trim() === "") {
      if (required) context.addIssue({ code: "custom", message: "Enter a price" });
      return null;
    }
    const parsed = parseRupeesToPaisa(value);
    if (!parsed.ok) {
      context.addIssue({ code: "custom", message: parsed.message });
      return z.NEVER;
    }
    return parsed.paisa;
  });

const optionValueSchema = z.object({
  value: z.string().regex(SLUG, "Give this value a label"),
  label: requiredText(40, "Enter a label"),
  swatchHex: z
    .string()
    .trim()
    .refine((value) => value === "" || HEX.test(value), "Use a colour like #C19A6B")
    .transform((value) => (value === "" ? null : value.toUpperCase())),
  /** Saved keys stay fixed when the label changes (variants reference them). Not sent to the database. */
  locked: z.boolean().optional(),
});

const optionSchema = z.object({
  name: requiredText(30, "Name this option, e.g. Colour"),
  values: z.array(optionValueSchema).min(1, "Add at least one value").max(MAX_OPTION_VALUES, `Use at most ${MAX_OPTION_VALUES} values`),
});

const variantSchema = z.object({
  id: z.uuid().nullable(),
  sku: z.string().trim().toUpperCase().max(64, "Use at most 64 characters").regex(SKU, "Use letters, digits and single dashes, e.g. GRT-PDE-GLD"),
  title: z.string().trim().max(120),
  optionValues: z.record(z.string(), z.string()),
  price: rupees(false),
  weightGrams: optionalWholeNumber(1, 100_000, "Enter grams between 1 and 100,000, or leave empty"),
  isActive: z.boolean(),
  initialStock: wholeNumber(0, 100_000, "Enter stock between 0 and 100,000"),
});

const specSchema = z.object({
  label: requiredText(40, "Enter a label"),
  value: requiredText(200, "Enter a value"),
});

export const productFormSchema = z
  .object({
    title: requiredText(120, "Enter a product name"),
    slug: z
      .string()
      .trim()
      .superRefine((slug, context) => {
        const problem = slugProblem(slug);
        if (problem) context.addIssue({ code: "custom", message: problem });
      }),
    categoryId: z.uuid("Choose a category"),
    shortDescription: text(200, "the short description"),
    description: text(5000, "the description"),
    basePrice: rupees(true),
    compareAtPrice: rupees(false),
    status: z.enum(PRODUCT_STATUSES),
    isFeatured: z.boolean(),
    isBestseller: z.boolean(),
    isLimitedEdition: z.boolean(),
    lowStockThreshold: wholeNumber(0, 10_000, "Enter a number between 0 and 10,000"),
    options: z.array(optionSchema).max(MAX_OPTIONS, `Use at most ${MAX_OPTIONS} options`),
    variants: z.array(variantSchema).min(1, "Add at least one variant").max(MAX_VARIANTS, `Use at most ${MAX_VARIANTS} variants`),
    specs: z.array(specSchema).max(30, "Use at most 30 specifications"),
    careInstructions: text(2000, "care instructions"),
    tags: z
      .array(z.string().trim().toLowerCase().regex(SLUG, "Tags use lowercase letters, digits and dashes").max(40))
      .max(20, "Use at most 20 tags"),
    /** null = links not editable by this user; the server leaves them untouched. */
    collectionIds: z.array(z.uuid()).max(50).nullable(),
  })
  .superRefine((product, context) => {
    const issue = (path: (string | number)[], message: string) => context.addIssue({ code: "custom", path, message });

    if (product.basePrice !== null && product.compareAtPrice !== null && product.compareAtPrice <= product.basePrice) {
      issue(["compareAtPrice"], "The compare-at price must be higher than the price");
    }

    const names = product.options.map((option) => option.name.toLowerCase());
    product.options.forEach((option, index) => {
      if (names.indexOf(option.name.toLowerCase()) !== index) issue(["options", index, "name"], "Each option needs a different name");
      const keys = option.values.map((value) => value.value);
      option.values.forEach((value, valueIndex) => {
        if (keys.indexOf(value.value) !== valueIndex) issue(["options", index, "values", valueIndex, "label"], "This value is already listed");
      });
    });

    if (product.options.length === 0 && product.variants.length !== 1) {
      issue(["variants"], "A product without options has exactly one variant");
    }

    const allowed = new Map(product.options.map((option) => [option.name, new Set(option.values.map((value) => value.value))]));
    const seenCombinations = new Set<string>();
    const seenSkus = new Map<string, number>();
    product.variants.forEach((variant, index) => {
      const entries = Object.entries(variant.optionValues);
      const matches = entries.length === allowed.size && entries.every(([name, value]) => allowed.get(name)?.has(value));
      if (!matches) issue(["variants"], "Options changed since the variants were generated. Choose Update variants.");

      const key = combinationKey(variant.optionValues);
      if (seenCombinations.has(key)) issue(["variants", index, "sku"], "Another variant has the same options");
      seenCombinations.add(key);

      if (seenSkus.has(variant.sku)) issue(["variants", index, "sku"], "Each variant needs its own SKU");
      seenSkus.set(variant.sku, index);
    });

    if (product.status === "active" && !product.variants.some((variant) => variant.isActive)) {
      issue(["status"], "An active product needs at least one active variant");
    }
  });

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;
export type VariantFormValues = ProductFormValues["variants"][number];
export type OptionFormValues = ProductFormValues["options"][number];

/** Parsed form -> admin_save_product arguments (snake_case JSON, paisa). */
export function toSavePayload(product: ProductFormOutput) {
  return {
    product: {
      title: product.title,
      slug: product.slug,
      category_id: product.categoryId,
      short_description: product.shortDescription,
      description: product.description,
      base_price_paisa: product.basePrice,
      compare_at_price_paisa: product.compareAtPrice,
      status: product.status,
      is_featured: product.isFeatured,
      is_bestseller: product.isBestseller,
      is_limited_edition: product.isLimitedEdition,
      low_stock_threshold: product.lowStockThreshold,
      options: product.options.map((option) => ({
        name: option.name,
        values: option.values.map((value) => ({ value: value.value, label: value.label, swatch_hex: value.swatchHex })),
      })),
      specs: product.specs,
      care_instructions: product.careInstructions,
      tags: [...new Set(product.tags)],
    },
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      option_values: variant.optionValues,
      price_paisa: variant.price,
      weight_grams: variant.weightGrams,
      is_active: variant.isActive,
      initial_stock: variant.initialStock,
    })),
    collectionIds: product.collectionIds,
  };
}

/** Every issue keyed by its full path ("variants.2.sku"), first message wins. */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

/** A new variant row (no id yet; starts with no stock). */
export function emptyVariant(sku: string, optionValues: Record<string, string>): VariantFormValues {
  return { id: null, sku, title: "", optionValues, price: "", weightGrams: "", isActive: true, initialStock: "0" };
}

/** Values for a new product: a draft with one variant and no options. */
export function emptyProductValues(lowStockThreshold: number, canLinkCollections: boolean): ProductFormValues {
  return {
    title: "",
    slug: "",
    categoryId: "",
    shortDescription: "",
    description: "",
    basePrice: "",
    compareAtPrice: "",
    status: "draft",
    isFeatured: false,
    isBestseller: false,
    isLimitedEdition: false,
    lowStockThreshold: String(lowStockThreshold),
    options: [],
    variants: [emptyVariant("", {})],
    specs: [],
    careInstructions: "",
    tags: [],
    collectionIds: canLinkCollections ? [] : null,
  };
}
