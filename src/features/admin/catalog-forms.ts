import { z } from "zod";
import type { ImageFormat } from "./product-form/file-signature";
import { slugProblem } from "./product-form/keys";

/*
 * Category and collection editors (admin phase 2): FormData schemas shared by
 * the browser forms and the Server Actions, the image path rules, and
 * Asia/Kathmandu date-time conversion for collection schedules.
 */

export type CatalogImageKind = "category" | "collection";

const IMAGE_FOLDERS: Record<CatalogImageKind, string> = { category: "categories", collection: "collections" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const IMAGE_PATTERNS: Record<CatalogImageKind, RegExp> = {
  category: new RegExp(`^categories/(new-)?(${UUID})/${UUID}\\.(jpg|png|webp|avif)$`),
  collection: new RegExp(`^collections/(new-)?(${UUID})/${UUID}\\.(jpg|png|webp|avif)$`),
};

export type UploadedImagePath = { staged: boolean; ownerId: string; format: ImageFormat };

/**
 * An image uploaded through the admin (`categories/<id>/<uuid>.jpg`, or
 * `categories/new-<stagingId>/...` before the record exists), or null for any
 * other key (seed images, other folders).
 */
export function parseUploadedImagePath(kind: CatalogImageKind, path: string): UploadedImagePath | null {
  const match = IMAGE_PATTERNS[kind].exec(path);
  return match ? { staged: match[1] === "new-", ownerId: match[2]!, format: match[3] as ImageFormat } : null;
}

/** Where the server puts a new upload for this record (or form session). */
export function imageFolder(kind: CatalogImageKind, target: { ownerId: string } | { stagingId: string }): string {
  return `${IMAGE_FOLDERS[kind]}/${"ownerId" in target ? target.ownerId : `new-${target.stagingId}`}`;
}

/* ---------- Asia/Kathmandu date-times (UTC+05:45, no daylight saving) ---------- */

const NPT_OFFSET_MINUTES = 5 * 60 + 45;

/** ISO timestamp -> `YYYY-MM-DDTHH:mm` in Nepal time, for `<input type="datetime-local">`. */
export function toKathmanduInput(iso: string | null): string {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  return new Date(time + NPT_OFFSET_MINUTES * 60_000).toISOString().slice(0, 16);
}

/** `YYYY-MM-DDTHH:mm` typed in Nepal time -> ISO timestamp, or null when empty or invalid. */
export function fromKathmanduInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = new Date(`${value}:00+05:45`).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/* ---------- Shared field rules ---------- */

export const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

export const slug = z
  .string()
  .trim()
  .superRefine((value, context) => {
    const problem = slugProblem(value);
    if (problem) context.addIssue({ code: "custom", message: problem });
  });

export const sortOrder = z.coerce
  .number({ error: "Enter a whole number" })
  .int("Enter a whole number")
  .min(0, "Use 0 or more")
  .max(9999, "Use at most 9,999");

/** "" = no image; otherwise an object key (checked against the stored value on the server). */
const imagePath = z
  .string()
  .trim()
  .max(300, "Invalid image")
  .transform((value) => (value === "" ? null : value));

/** A disabled select sends nothing, so a missing value means "none". */
const optionalUuid = z
  .string()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.uuid("Invalid choice").nullable());

/* ---------- Category ---------- */

export const categoryFormSchema = z.object({
  title: text(80).min(1, "Enter a category name"),
  slug,
  parentId: optionalUuid,
  description: text(500),
  imagePath,
  isActive: checkbox,
  sortOrder,
  stagingId: z.uuid().optional(),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

/* ---------- Collection ---------- */

export const kathmanduDateTime = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    const iso = fromKathmanduInput(value);
    if (!iso) {
      context.addIssue({ code: "custom", message: "Enter a date and time" });
      return z.NEVER;
    }
    return iso;
  });

export const MAX_COLLECTION_PRODUCTS = 200;

export const collectionFormSchema = z
  .object({
    title: text(120).min(1, "Enter a title"),
    slug,
    eyebrow: text(40),
    description: text(300),
    heroImagePath: imagePath,
    // The alt text field is disabled (and not submitted) without an image.
    heroImageAlt: text(200).default(""),
    isActive: checkbox,
    sortOrder,
    startsAt: kathmanduDateTime,
    endsAt: kathmanduDateTime,
    productIds: z
      .string()
      .transform((value) => value.split(",").filter(Boolean))
      .pipe(
        z
          .array(z.uuid("Invalid product"))
          .max(MAX_COLLECTION_PRODUCTS, `Add at most ${MAX_COLLECTION_PRODUCTS} products`)
          .refine((ids) => new Set(ids).size === ids.length, "A product is listed twice"),
      ),
    stagingId: z.uuid().optional(),
  })
  .refine((value) => value.heroImagePath === null || value.heroImageAlt !== "", {
    message: "Describe the image for people using screen readers",
    path: ["heroImageAlt"],
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
    message: "The end has to be after the start",
    path: ["endsAt"],
  });

export type CollectionFormInput = z.infer<typeof collectionFormSchema>;
