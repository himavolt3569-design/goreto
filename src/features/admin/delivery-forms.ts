import { z } from "zod";
import { parseRupeesToPaisa } from "@/lib/money/parse";
import { checkbox, kathmanduDateTime, slug, sortOrder, text } from "./catalog-forms";
import { nepalPhoneSchema } from "./schemas";

/*
 * Coupon, courier, courier service, delivery zone and delivery rate editors
 * (admin phase 3): FormData schemas for the Server Actions. Money is typed in
 * rupees and parsed to integer paisa as text (AGENTS §26.9). The database
 * checks validate again.
 */

/** "" -> null; otherwise rupees -> paisa. `min` in paisa. */
function rupees({ required, min, requiredMessage }: { required: boolean; min: number; requiredMessage?: string }) {
  return z
    .string()
    .optional()
    .default("")
    .transform((raw, context) => {
      const value = raw.trim();
      if (value === "") {
        if (required) {
          context.addIssue({ code: "custom", message: requiredMessage ?? "Enter an amount" });
          return z.NEVER;
        }
        return null;
      }
      const parsed = parseRupeesToPaisa(value);
      if (!parsed.ok) {
        context.addIssue({ code: "custom", message: parsed.message });
        return z.NEVER;
      }
      if (parsed.paisa < min) {
        context.addIssue({ code: "custom", message: min === 0 ? "Use 0 or more" : `Enter at least Rs. ${min / 100}` });
        return z.NEVER;
      }
      return parsed.paisa;
    });
}

/** "" -> null; otherwise a whole number in [min, max]. */
function optionalWhole(min: number, max: number, label = "number") {
  return z
    .string()
    .optional()
    .default("")
    .transform((raw, context) => {
      const value = raw.trim().replace(/,/g, "");
      if (value === "") return null;
      if (!/^\d+$/.test(value)) {
        context.addIssue({ code: "custom", message: `Enter a whole ${label}` });
        return z.NEVER;
      }
      const number = Number(value);
      if (number < min || number > max) {
        context.addIssue({ code: "custom", message: `Use ${min.toLocaleString("en-IN")}–${max.toLocaleString("en-IN")}` });
        return z.NEVER;
      }
      return number;
    });
}

const days = z.coerce.number({ error: "Enter a number of days" }).int("Enter a whole number of days").min(0, "Use 0 or more days").max(60, "Use at most 60 days");

const id = z.uuid("Invalid choice");

/* ---------- Coupons ---------- */

export const COUPON_CODE_PATTERN = /^[A-Z0-9]{3,32}$/;

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => COUPON_CODE_PATTERN.test(value), "Use 3–32 letters and digits, no spaces"),
    description: text(200),
    type: z.enum(["percentage", "fixed"], { error: "Choose a discount type" }),
    // Only the chosen type's fields are submitted (the others are disabled).
    percentOff: optionalWhole(1, 100, "percentage"),
    maxDiscount: rupees({ required: false, min: 100 }),
    amountOff: rupees({ required: false, min: 100 }),
    minOrder: rupees({ required: false, min: 100 }),
    startsAt: kathmanduDateTime,
    endsAt: kathmanduDateTime,
    usageLimit: optionalWhole(1, 1_000_000, "number of uses"),
    usageLimitPerCustomer: optionalWhole(1, 1000, "number of uses"),
    isActive: checkbox,
  })
  .superRefine((value, context) => {
    if (value.type === "percentage" && value.percentOff === null) {
      context.addIssue({ code: "custom", message: "Enter the percentage off", path: ["percentOff"] });
    }
    if (value.type === "fixed" && value.amountOff === null) {
      context.addIssue({ code: "custom", message: "Enter the amount off", path: ["amountOff"] });
    }
    if (value.startsAt === null) {
      context.addIssue({ code: "custom", message: "Choose when the coupon starts", path: ["startsAt"] });
    }
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      context.addIssue({ code: "custom", message: "The end has to be after the start", path: ["endsAt"] });
    }
    if (value.usageLimit !== null && value.usageLimitPerCustomer !== null && value.usageLimitPerCustomer > value.usageLimit) {
      context.addIssue({ code: "custom", message: "Can't be more than the total uses", path: ["usageLimitPerCustomer"] });
    }
  });

export type CouponFormInput = z.infer<typeof couponFormSchema>;

/** Columns for `coupons` (never `times_used`). */
export function couponRow(input: CouponFormInput) {
  const percentage = input.type === "percentage";
  return {
    code: input.code,
    description: input.description,
    type: input.type,
    percent_off: percentage ? input.percentOff : null,
    max_discount_paisa: percentage ? input.maxDiscount : null,
    amount_off_paisa: percentage ? null : input.amountOff,
    min_order_paisa: input.minOrder,
    starts_at: input.startsAt!,
    ends_at: input.endsAt,
    usage_limit: input.usageLimit,
    usage_limit_per_customer: input.usageLimitPerCustomer,
    is_active: input.isActive,
  };
}

/* ---------- Couriers and services ---------- */

export const courierFormSchema = z.object({
  title: text(80).min(1, "Enter the courier's name"),
  slug,
  supportPhone: nepalPhoneSchema,
  websiteUrl: z
    .string()
    .trim()
    .max(300, "Use at most 300 characters")
    .refine((value) => {
      if (value === "") return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a full https:// address")
    .transform((value) => (value === "" ? null : value)),
  isActive: checkbox,
});

export type CourierFormInput = z.infer<typeof courierFormSchema>;

export const SERVICE_CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export const courierServiceFormSchema = z
  .object({
    courierId: id,
    serviceId: z
      .string()
      .optional()
      .transform((value) => (value ? value : null))
      .pipe(id.nullable()),
    name: text(80).min(1, "Enter the service name"),
    serviceCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value.length >= 2 && value.length <= 40 && SERVICE_CODE_PATTERN.test(value), "Use 2–40 letters, digits and single dashes, e.g. PTH-EXP"),
    level: z.enum(["standard", "express", "pickup"], { error: "Choose a service level" }),
    description: text(200),
    minDays: days,
    maxDays: days,
    isActive: checkbox,
  })
  .refine((value) => value.maxDays >= value.minDays, { message: "Can't be less than the minimum", path: ["maxDays"] });

export type CourierServiceFormInput = z.infer<typeof courierServiceFormSchema>;

/* ---------- Zones ---------- */

export const MAX_ZONE_DISTRICTS = 77;

export const zoneFormSchema = z.object({
  title: text(80).min(1, "Enter the zone's name"),
  slug,
  description: text(200),
  sortOrder,
  isActive: checkbox,
  districtCodes: z
    .string()
    .transform((value) => [...new Set(value.split(",").filter(Boolean))])
    .pipe(
      z
        .array(z.string().regex(/^[a-z0-9-]{1,40}$/, "Invalid district"))
        .max(MAX_ZONE_DISTRICTS, "Too many districts"),
    ),
});

export type ZoneFormInput = z.infer<typeof zoneFormSchema>;

/* ---------- Rates ---------- */

export const rateFormSchema = z
  .object({
    zoneId: z.string({ error: "Choose a zone" }).min(1, "Choose a zone").pipe(id),
    serviceId: z.string({ error: "Choose a service" }).min(1, "Choose a service").pipe(id),
    // Required: never null after parsing.
    price: rupees({ required: true, min: 0, requiredMessage: "Enter the fee (0 for free delivery)" }).pipe(z.number()),
    minDays: optionalWhole(0, 60, "number of days"),
    maxDays: optionalWhole(0, 60, "number of days"),
    minOrder: rupees({ required: false, min: 100 }),
    minWeight: optionalWhole(0, 1_000_000, "number of grams"),
    maxWeight: optionalWhole(1, 1_000_000, "number of grams"),
    isActive: checkbox,
  })
  .superRefine((value, context) => {
    if ((value.minDays === null) !== (value.maxDays === null)) {
      context.addIssue({ code: "custom", message: "Fill both, or leave both empty to use the service's estimate", path: [value.minDays === null ? "minDays" : "maxDays"] });
    }
    if (value.minDays !== null && value.maxDays !== null && value.maxDays < value.minDays) {
      context.addIssue({ code: "custom", message: "Can't be less than the minimum", path: ["maxDays"] });
    }
    if (value.minWeight !== null && value.maxWeight !== null && value.maxWeight < value.minWeight) {
      context.addIssue({ code: "custom", message: "Can't be less than the minimum", path: ["maxWeight"] });
    }
  });

export type RateFormInput = z.infer<typeof rateFormSchema>;
