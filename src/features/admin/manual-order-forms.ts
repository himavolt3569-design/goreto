import { z } from "zod";
import { cartItemsSchema, MAX_NOTE_LENGTH } from "@/features/checkout/schemas";
import { checkoutFailureFromError, type LineIssue } from "@/features/checkout/errors";
import { requiredNepalPhoneSchema, toNepalE164 } from "@/lib/validation/phone";

/*
 * Manual WhatsApp order entry (/admin/orders/new, worklog §4.0). The client
 * form and createManualOrderAction parse the same schema; admin_create_order
 * validates everything again. Nothing here carries a price: the database
 * prices every line, the delivery fee and any discount.
 */

export { MAX_CART_LINES as MAX_ORDER_LINES } from "@/features/checkout/schemas";

const optionalUuid = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || z.uuid().safeParse(value).success, message)
    .transform((value) => (value === "" ? null : value));

export const manualOrderSchema = z
  .object({
    customerId: optionalUuid("Choose the customer again"),
    fullName: z.string().trim().min(2, "Enter the customer's full name").max(100, "Use at most 100 characters"),
    phone: requiredNepalPhoneSchema,
    whatsappSameAsPhone: z.boolean(),
    whatsapp: z.string().trim(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Use at most 254 characters")
      .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address, or leave it empty")
      .transform((value) => (value === "" ? null : value)),
    items: cartItemsSchema,
    provinceCode: z.string().min(1, "Choose a province"),
    districtCode: z.string().min(1, "Choose a district"),
    municipalityCode: z.string().min(1, "Choose a municipality or city"),
    ward: z
      .string()
      .regex(/^[0-9]{1,2}$/, "Choose a ward")
      .transform(Number),
    streetLandmark: z.string().trim().min(2, "Enter a street or landmark").max(200, "Use at most 200 characters"),
    postalCode: z.string().trim().regex(/^([0-9]{5})?$/, "Postal codes have 5 digits"),
    courierServiceId: z.string().pipe(z.uuid("Choose a delivery option")),
    couponCode: z.string().trim().toUpperCase().max(32, "Use at most 32 characters"),
    note: z.string().trim().max(MAX_NOTE_LENGTH, `Keep notes under ${MAX_NOTE_LENGTH} characters`),
  })
  .superRefine((value, context) => {
    if (!value.whatsappSameAsPhone && !toNepalE164(value.whatsapp)) {
      context.addIssue({ code: "custom", path: ["whatsapp"], message: "Enter a valid Nepal WhatsApp number" });
    }
  })
  .transform(({ whatsappSameAsPhone, whatsapp, ...order }) => ({
    ...order,
    // The number the customer messaged from; the database stores it in E.164.
    whatsappE164: whatsappSameAsPhone ? order.phone : toNepalE164(whatsapp)!,
  }));

export type ManualOrderValues = z.input<typeof manualOrderSchema>;
export type ManualOrder = z.output<typeof manualOrderSchema>;

export function emptyManualOrder(): ManualOrderValues {
  return {
    customerId: "",
    fullName: "",
    phone: "",
    whatsappSameAsPhone: true,
    whatsapp: "",
    email: "",
    items: [],
    provinceCode: "",
    districtCode: "",
    municipalityCode: "",
    ward: "",
    streetLandmark: "",
    postalCode: "",
    courierServiceId: "",
    couponCode: "",
    note: "",
  };
}

export type ManualOrderFailure = {
  ok: false;
  message: string;
  lineIssues?: LineIssue[];
  fieldErrors?: Record<string, string>;
};

/** admin_create_order's `checkout:<reason>` errors, worded for staff instead of shoppers. */
export function manualOrderFailure(error: { code?: string; message: string; details?: string | null }): ManualOrderFailure {
  if (error.code === "42501") {
    return { ok: false, message: /customers\.read/.test(error.message) ? "You can't link customer accounts. Leave the customer unlinked." : "You don't have permission to create orders." };
  }
  if (error.code === "22023" && error.details === "customerId") {
    return { ok: false, message: error.message, fieldErrors: { customerId: error.message } };
  }

  const reason = /^checkout:([a-z_]+)$/.exec(error.message)?.[1];
  const failure = checkoutFailureFromError(error);
  switch (reason) {
    case "stock_changed":
      return {
        ok: false,
        message: "Stock changed for some items. Check the highlighted lines, then create the order again.",
        lineIssues: failure.lineIssues,
      };
    case "cod_disabled":
      return { ok: false, message: "Cash on Delivery is turned off in Settings, so new orders are paused." };
    case "cod_limit":
      return { ok: false, message: failure.message.replace("Please remove some items.", "Remove some items or raise the limit in Settings.") };
    case "invalid_contact":
      return {
        ok: false,
        message: error.details === "whatsapp" ? "Check the WhatsApp number." : "Check the customer's name, phone and email.",
      };
    case "invalid_address":
      return { ok: false, message: "Check the address. The ward must exist in the chosen municipality." };
    case "invalid_items":
      return { ok: false, message: "An item can't be ordered. Review the items." };
    case "delivery_unavailable":
      return { ok: false, message: "That delivery option isn't available for this address anymore. Choose another." };
    default:
      return { ok: false, message: failure.message };
  }
}

/** Short line-level note for a stock issue from the quote or a failed create. */
export function lineIssueMessage(status: "unavailable" | "insufficient_stock", available: number): string {
  return status === "unavailable" ? "No longer available" : `Only ${available} in stock`;
}
