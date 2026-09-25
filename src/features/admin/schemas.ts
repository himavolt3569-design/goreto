import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";
import { MANUAL_TRACKING_STATUSES } from "./order-transitions";

/*
 * Server Action inputs for the admin panel (AGENTS §20). Every action parses
 * FormData through one of these before touching the database; the database
 * constraints and functions validate again.
 */

const id = z.uuid();

/** FormData checkbox: present = true. */
const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((value) => (value === "" ? null : value));

export const orderTransitionSchema = z.object({
  orderId: id,
  status: z.enum(["confirmed", "processing", "packed", "shipped", "delivered", "canceled"]),
  reason: optionalText(300).optional().default(null),
});

export const assignCourierSchema = z.object({
  orderId: id,
  courierId: id,
  trackingNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^[A-Z0-9-]{3,64}$/.test(value), "Use letters, digits and dashes (3–64 characters)")
    .transform((value) => (value === "" ? null : value)),
});

export const shipmentEventSchema = z.object({
  orderId: id,
  status: z.enum(MANUAL_TRACKING_STATUSES),
  message: z.string().trim().min(1, "Write a short update for the customer").max(280, "Use at most 280 characters"),
  location: optionalText(120),
});

export const orderIdSchema = z.object({ orderId: id });

export const stockAdjustSchema = z.object({
  variantId: id,
  delta: z.coerce
    .number({ error: "Enter a whole number" })
    .int("Enter a whole number")
    .min(-100_000, "Too large")
    .max(100_000, "Too large")
    .refine((value) => value !== 0, "Enter a number other than 0"),
});

export const productStatusSchema = z.object({
  productId: id,
  status: z.enum(["draft", "active", "archived"]),
});

export const reviewModerationSchema = z
  .object({
    reviewId: id,
    decision: z.enum(["published", "rejected"]),
    note: optionalText(500),
  })
  .refine((value) => value.decision !== "rejected" || value.note !== null, {
    message: "Add a short note explaining the rejection",
    path: ["note"],
  });

/** Active/flag toggles: the target state comes from the form, never from the current row. */
export const toggleSchema = z.object({ id, value: checkbox });

export const productFlagSchema = z.object({
  id,
  flag: z.enum(["is_featured", "is_bestseller"]),
  value: checkbox,
});

export const staffPermissionSchema = z.object({
  profileId: id,
  permission: z.enum([
    "analytics.read",
    "catalog.read",
    "catalog.write",
    "inventory.write",
    "orders.read",
    "orders.write",
    "customers.read",
    "reviews.manage",
    "promotions.manage",
    "content.manage",
    "ar.manage",
    "delivery.manage",
    "settings.manage",
    "staff.manage",
  ]),
  value: checkbox,
});

/** Nepal numbers, typed with or without +977, stored as E.164 (AGENTS §15.3). */
export const nepalPhoneSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    const phone = parsePhoneNumberFromString(value, "NP");
    if (!phone?.isValid() || phone.country !== "NP") {
      context.addIssue({ code: "custom", message: "Enter a valid Nepal phone number" });
      return z.NEVER;
    }
    return phone.number;
  });

const wholeRupeesToPaisa = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    if (!/^\d{1,9}$/.test(value.replace(/,/g, ""))) {
      context.addIssue({ code: "custom", message: "Enter a whole rupee amount" });
      return z.NEVER;
    }
    const rupees = Number(value.replace(/,/g, ""));
    if (rupees < 1) {
      context.addIssue({ code: "custom", message: "Enter at least Rs. 1, or leave it empty for no limit" });
      return z.NEVER;
    }
    return rupees * 100;
  });

export const storeSettingsSchema = z.object({
  storeName: z.string().trim().min(1, "Enter the store name").max(80, "Use at most 80 characters"),
  tagline: optionalText(140),
  supportEmail: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address")
    .transform((value) => (value === "" ? null : value)),
  supportPhone: nepalPhoneSchema,
  codEnabled: checkbox,
  codMaxOrder: wholeRupeesToPaisa,
  returnsWindowDays: z.coerce
    .number({ error: "Enter a number of days" })
    .int("Enter a whole number of days")
    .min(0, "Use 0 or more days")
    .max(90, "Use at most 90 days"),
  lowStockThreshold: z.coerce
    .number({ error: "Enter a number" })
    .int("Enter a whole number")
    .min(0, "Use 0 or more")
    .max(10_000, "Use at most 10,000"),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

/** First error message per field, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** FormData -> plain object of string values (files are ignored). */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
