import { z } from "zod";
import { parseRupeesToPaisa } from "@/lib/money/parse";
import { nepalPhoneSchema, requiredNepalPhoneSchema } from "@/lib/validation/phone";
import { checkbox, text } from "./catalog-forms";

/*
 * Daraz Express admin forms (prompts/goreto-daraz-courier.md): FormData
 * schemas for the booking, tracking, settlement, support and setup actions.
 * The database functions validate again; Daraz validates its own fields and
 * its messages are shown as they come.
 */

const id = z.uuid("Invalid choice");

const optional = (max: number) => text(max).transform((value) => (value === "" ? null : value));

/** A decimal in [min, max] with at most one decimal place. */
const measure = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((raw, context) => {
      if (!/^\d{1,4}(\.\d)?$/.test(raw)) {
        context.addIssue({ code: "custom", message: `Enter the ${label}` });
        return z.NEVER;
      }
      const value = Number(raw);
      if (value < min || value > max) {
        context.addIssue({ code: "custom", message: `Use ${min}–${max}` });
        return z.NEVER;
      }
      return value;
    });

const rupees = (label: string, required: boolean) =>
  z
    .string()
    .optional()
    .default("")
    .transform((raw, context) => {
      const value = raw.trim();
      if (value === "") {
        if (!required) return 0;
        context.addIssue({ code: "custom", message: `Enter the ${label}` });
        return z.NEVER;
      }
      const parsed = parseRupeesToPaisa(value);
      if (!parsed.ok) {
        context.addIssue({ code: "custom", message: parsed.message });
        return z.NEVER;
      }
      return parsed.paisa;
    });

/** Optional whole grams (1–100,000); empty means "not set". */
export const optionalGramsSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{1,6}$/.test(value) && Number(value) >= 1 && Number(value) <= 100_000), "Enter whole grams from 1 to 100,000")
  .transform((value) => (value === "" ? null : Number(value)));

export const darazOrderSchema = z.object({ orderId: id });

export const darazBookingSchema = z.object({
  orderId: id,
  deliveryOption: z.enum(["standard", "economy"], { error: "Choose a delivery option" }),
  weightGrams: z.coerce.number({ error: "Enter the parcel weight in grams" }).int("Use whole grams").min(1, "Enter the parcel weight in grams").max(100_000, "Use at most 100,000 g"),
  lengthCm: measure("length", 1, 300),
  widthCm: measure("width", 1, 300),
  heightCm: measure("height", 1, 300),
  openBox: checkbox,
  deliveryNote: optional(200),
});
export type DarazBookingInput = z.infer<typeof darazBookingSchema>;

export const darazCancelSchema = z.object({
  orderId: id,
  reason: z.string().trim().min(3, "Write a short reason").max(300, "Use at most 300 characters"),
});

export const darazReceiverSchema = z.object({
  orderId: id,
  receiverName: z.string().trim().min(1, "Enter the receiver's name").max(120, "Use at most 120 characters"),
  receiverPhone: requiredNepalPhoneSchema,
  details: optional(300),
  deliveryNote: optional(200),
});

export const darazFeedbackSchema = z
  .object({
    orderId: id,
    feedback: z.enum(["REATTEMPT", "RETURN"], { error: "Choose re-attempt or return" }),
    reattemptOn: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a date")
      .transform((value) => (value === "" ? null : value)),
    note: optional(200),
  })
  .refine((value) => value.feedback === "RETURN" || value.reattemptOn !== null, { message: "Choose the re-attempt date", path: ["reattemptOn"] });

export const darazLabelSchema = z.object({
  orders: z
    .string()
    .transform((value) => [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))])
    .pipe(z.array(id).min(1, "Choose at least one order").max(50, "Print at most 50 labels at a time")),
  type: z.enum(["pdf", "zpl"]).default("pdf"),
});

export const darazBulkSchema = z.object({
  operation: z.enum(["book", "ready", "refresh"]),
  orderIds: z
    .string()
    .transform((value) => [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))])
    .pipe(z.array(id).min(1, "Choose at least one order").max(25, "Choose at most 25 orders at a time")),
});

export const remittanceSchema = z
  .object({
    reference: z.string().trim().min(1, "Enter the payout reference").max(100, "Use at most 100 characters"),
    statementDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the payout date"),
    grossAmount: rupees("COD amount paid", true),
    deductions: rupees("deductions", false),
    note: optional(500),
    trackingNumbers: z
      .string()
      .transform((value) => [...new Set(value.split(/[\s,;]+/).map((part) => part.trim().toUpperCase()).filter(Boolean))])
      .pipe(z.array(z.string().regex(/^[A-Z0-9_-]{3,100}$/, "Tracking numbers use letters, digits, dashes")).min(1, "Paste the tracking numbers this payout covers").max(1000, "At most 1,000 parcels per payout")),
  })
  .refine((value) => value.deductions <= value.grossAmount, { message: "Deductions can't be more than the COD amount", path: ["deductions"] });

export const remittanceIdSchema = z.object({ remittanceId: id });

export const supportCaseSchema = z.object({
  orderId: z
    .string()
    .trim()
    .refine((value) => value === "" || z.uuid().safeParse(value).success, "Invalid order")
    .transform((value) => (value === "" ? null : value)),
  trackingNumber: optional(100).transform((value) => value?.toUpperCase() ?? null),
  subject: z.string().trim().min(3, "Write a short subject").max(200, "Use at most 200 characters"),
  description: z.string().trim().min(10, "Describe the problem in a sentence or two").max(2000, "Use at most 2,000 characters"),
});

export const supportRatingSchema = z.object({
  caseId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,60}$/, "Invalid case"),
  rating: z.coerce.number({ error: "Choose a rating" }).int().min(1, "Choose a rating").max(5, "Choose a rating"),
  remark: optional(300),
});

const code = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^[A-Za-z0-9_-]{1,64}$/.test(value), `${label}: letters, digits, dashes and underscores`)
    .transform((value) => (value === "" ? null : value));

const coordinate = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (/^-?\d{1,3}(\.\d{1,6})?$/.test(value) && Number(value) >= min && Number(value) <= max), "Enter a coordinate with up to 6 decimals")
    .transform((value) => (value === "" ? null : Number(value)));

export const boxPresetsSchema = z
  .string()
  .transform((value, context) => {
    const boxes: { name: string; length_cm: number; width_cm: number; height_cm: number }[] = [];
    for (const [index, line] of value.split("\n").map((part) => part.trim()).filter(Boolean).entries()) {
      // "Small: 20 x 15 x 5"
      const match = /^(.{1,40}?)\s*:\s*(\d{1,3}(?:\.\d)?)\s*[x×*]\s*(\d{1,3}(?:\.\d)?)\s*[x×*]\s*(\d{1,3}(?:\.\d)?)$/i.exec(line);
      const sizes = match ? [Number(match[2]), Number(match[3]), Number(match[4])] : [];
      if (!match || sizes.some((size) => size < 1 || size > 300)) {
        context.addIssue({ code: "custom", message: `Line ${index + 1}: write "Name: L x W x H" in cm (1–300)` });
        return z.NEVER;
      }
      boxes.push({ name: match[1]!.trim(), length_cm: sizes[0]!, width_cm: sizes[1]!, height_cm: sizes[2]! });
    }
    if (boxes.length > 10) {
      context.addIssue({ code: "custom", message: "Use at most 10 box sizes" });
      return z.NEVER;
    }
    return boxes;
  });

export const darazSettingsSchema = z
  .object({
    platformName: optional(100),
    externalSellerId: optional(100),
    originName: optional(120),
    originPhone: nepalPhoneSchema,
    originEmail: z
      .string()
      .trim()
      .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email")
      .transform((value) => (value === "" ? null : value)),
    originAddressDetails: optional(300),
    originDarazAddressId: code("Daraz location id"),
    originLatitude: coordinate(-90, 90),
    originLongitude: coordinate(-180, 180),
    pickupWarehouseCode: code("Pickup warehouse code"),
    returnWarehouseCode: code("Return warehouse code"),
    solutionCodes: z
      .string()
      .transform((value) => [...new Set(value.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean))])
      .pipe(z.array(z.string().regex(/^[A-Za-z0-9_-]{1,60}$/, "Solution codes use letters, digits, dashes, underscores")).max(20, "Use at most 20 codes")),
    bookingEndpoint: z.enum(["create", "consign"]),
    defaultDeliveryOption: z.enum(["standard", "economy"]),
    phoneFormat: z.enum(["national", "e164"]),
    undeliverableOption: z.enum(["RETURN", "SCRAP"]),
    defaultOpenBox: checkbox,
    declareInsurance: checkbox,
    autoBook: checkbox,
    defaultWeightGrams: optionalGramsSchema,
    defaultItemCategory: optional(60),
    boxPresets: boxPresetsSchema,
    xspaceCaseTemplateId: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{1,12}$/.test(value), "Enter the number Daraz gave you")
      .transform((value) => (value === "" ? null : Number(value))),
    xspaceCategoryId: optional(60),
  })
  .refine((value) => (value.originLatitude === null) === (value.originLongitude === null), {
    message: "Enter both latitude and longitude, or neither",
    path: ["originLongitude"],
  });

export const darazLinkSchema = z.object({
  otp: z.string().trim().min(4, "Paste the code from DEX OMS").max(64, "That code is too long").regex(/^[A-Za-z0-9_-]+$/, "Codes use letters and digits"),
});

export const darazWarehouseSchema = z.object({ kind: z.enum(["pickup", "return"]) });

/** "Name: L x W x H" lines for the settings textarea. */
export function boxPresetsText(boxes: readonly { name: string; length_cm: number; width_cm: number; height_cm: number }[]): string {
  return boxes.map((box) => `${box.name}: ${box.length_cm} x ${box.width_cm} x ${box.height_cm}`).join("\n");
}
