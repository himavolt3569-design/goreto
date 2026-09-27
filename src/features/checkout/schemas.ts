import { z } from "zod";
import { MAX_QUANTITY_PER_LINE } from "@/features/catalog/variants";
import { requiredNepalPhoneSchema } from "@/lib/validation/phone";

/*
 * Checkout inputs (AGENTS §4.4, §20). The client form and the Server Actions
 * parse the same schemas; place_order validates everything again in SQL.
 * Nothing here carries a price: the database prices every line.
 */

/** Matches checkout_price in the checkout_place_order migration. */
export const MAX_CART_LINES = 20;
export const MAX_NOTE_LENGTH = 500;

export const cartItemsSchema = z
  .array(
    z.object({
      variantId: z.uuid(),
      quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
    }),
  )
  .min(1, "Your cart is empty.")
  .max(MAX_CART_LINES, `A cart can hold up to ${MAX_CART_LINES} different items.`)
  .refine((items) => new Set(items.map((item) => item.variantId)).size === items.length, "Each item can appear only once.");

export type CartItemInput = z.infer<typeof cartItemsSchema>[number];

const areaCode = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const quoteRequestSchema = z.object({
  items: cartItemsSchema,
  municipalityCode: areaCode.optional(),
  courierServiceId: z.uuid().optional(),
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  email: z.string().trim().toLowerCase().max(254).optional(),
});

export type QuoteRequest = z.input<typeof quoteRequestSchema>;

export const checkoutFormSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100, "Use at most 100 characters"),
  email: z.string().trim().toLowerCase().max(254, "Use at most 254 characters").pipe(z.email("Enter a valid email address")),
  phone: requiredNepalPhoneSchema,
  provinceCode: z.string().min(1, "Choose a province"),
  districtCode: z.string().min(1, "Choose a district"),
  municipalityCode: z.string().min(1, "Choose a municipality or city"),
  ward: z
    .string()
    .regex(/^[0-9]{1,2}$/, "Choose a ward")
    .transform(Number),
  streetLandmark: z.string().trim().min(2, "Enter a street or landmark").max(200, "Use at most 200 characters"),
  postalCode: z.string().trim().regex(/^([0-9]{5})?$/, "Postal codes have 5 digits"),
  latitude: z.number().min(26).max(31).nullable(),
  longitude: z.number().min(80).max(89).nullable(),
  courierServiceId: z.string().pipe(z.uuid("Choose a delivery option")),
  couponCode: z.string().trim().toUpperCase().max(32),
  note: z.string().trim().max(MAX_NOTE_LENGTH, `Keep notes under ${MAX_NOTE_LENGTH} characters`),
});

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>;
export type CheckoutFormData = z.output<typeof checkoutFormSchema>;

export const placeOrderSchema = checkoutFormSchema.extend({ items: cartItemsSchema });

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
